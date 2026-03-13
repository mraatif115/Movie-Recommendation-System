require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = process.env.TMDB_API_KEY;
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;

async function tmdb(endpoint, params = {}) {
  const url = new URL(TMDB_BASE + endpoint);
  url.searchParams.set('api_key', TMDB_KEY);
  url.searchParams.set('language', 'en-US');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  return res.json();
}

// Trending + Top Rated + Now Playing
app.get('/api/trending', async (req, res) => {
  try {
    const [trending, topRated, nowPlaying, upcoming] = await Promise.all([
      tmdb('/trending/movie/week'),
      tmdb('/movie/top_rated'),
      tmdb('/movie/now_playing'),
      tmdb('/movie/upcoming'),
    ]);
    res.json({
      trending: trending.results?.slice(0, 12) || [],
      topRated: topRated.results?.slice(0, 12) || [],
      nowPlaying: nowPlaying.results?.slice(0, 12) || [],
      upcoming: upcoming.results?.slice(0, 12) || [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Full movie details
app.get('/api/movie/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const [details, credits, videos, similar, watchProviders] = await Promise.all([
      tmdb(`/movie/${id}`),
      tmdb(`/movie/${id}/credits`),
      tmdb(`/movie/${id}/videos`),
      tmdb(`/movie/${id}/similar`),
      tmdb(`/movie/${id}/watch/providers`),
    ]);
    const trailer = videos.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube')
      || videos.results?.find(v => v.site === 'YouTube');
    const providers = watchProviders.results?.IN || watchProviders.results?.US || {};
    res.json({
      ...details,
      cast: credits.cast?.slice(0, 10) || [],
      director: credits.crew?.find(c => c.job === 'Director')?.name || 'N/A',
      trailerKey: trailer?.key || null,
      similar: similar.results?.slice(0, 8) || [],
      streamingOn: providers.flatrate || providers.rent || [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Search
app.get('/api/search', async (req, res) => {
  try {
    const data = await tmdb('/search/movie', { query: req.query.q, page: 1 });
    res.json(data.results?.slice(0, 12) || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Genre filter
app.get('/api/genre/:id', async (req, res) => {
  try {
    const data = await tmdb('/discover/movie', {
      with_genres: req.params.id,
      sort_by: 'popularity.desc',
      'vote_count.gte': 500,
    });
    res.json(data.results?.slice(0, 12) || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// AI Recommendations — Claude picks titles, TMDB provides real data
app.post('/api/recommend', async (req, res) => {
  const { query, preferences } = req.body;
  if (!CLAUDE_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured in environment.' });
  if (!TMDB_KEY) return res.status(500).json({ error: 'TMDB_API_KEY not configured in environment.' });

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1500,
        system: `You are CineAI, a world-class film recommendation AI with encyclopedic cinema knowledge.
Respond ONLY with valid JSON. No markdown, no backticks, no explanation text whatsoever.
Required JSON format:
{
  "insight": "2 vivid sentences explaining what you understood about the request and why your picks are perfect",
  "movies": [
    { "title": "Exact Official Title", "year": 2023, "match": 95, "why": "One precise sentence on why this film fits." }
  ]
}
Rules:
- Recommend exactly 8 movies
- Use the EXACT official English title (for TMDB accuracy)
- Match score 70-99 based on relevance
- Be bold and specific — no generic picks`,
        messages: [{
          role: 'user',
          content: `User query: "${query}"
Preferences — Intensity: ${preferences?.intensity||7}/10 | Complexity: ${preferences?.complexity||6}/10 | Max runtime: ${preferences?.runtime||150}min | Non-English openness: ${preferences?.language||50}% | Obscurity: ${preferences?.obscurity||5}/10
Return JSON only.`
        }],
      }),
    });

    const cd = await claudeRes.json();
    if (cd.error) throw new Error(cd.error.message);
    const ai = JSON.parse(cd.content[0].text);

    // Fetch real TMDB data for each AI-recommended title
    const results = await Promise.all(ai.movies.map(async (m) => {
      try {
        const s = await tmdb('/search/movie', { query: m.title });
        // Pick best match by year proximity
        const found = s.results?.sort((a, b) => {
          const ay = Math.abs((a.release_date?.split('-')[0] || 0) - m.year);
          const by = Math.abs((b.release_date?.split('-')[0] || 0) - m.year);
          return ay - by;
        })[0];
        if (!found) return null;
        return {
          id: found.id,
          title: found.title,
          year: found.release_date?.split('-')[0] || m.year,
          rating: parseFloat(found.vote_average || 0).toFixed(1),
          votes: found.vote_count || 0,
          poster: found.poster_path ? `https://image.tmdb.org/t/p/w500${found.poster_path}` : null,
          backdrop: found.backdrop_path ? `https://image.tmdb.org/t/p/w1280${found.backdrop_path}` : null,
          overview: found.overview || '',
          match: m.match,
          why: m.why,
          genre_ids: found.genre_ids || [],
          popularity: found.popularity || 0,
        };
      } catch { return null; }
    }));

    res.json({ insight: ai.insight, movies: results.filter(Boolean) });
  } catch (e) {
    console.error('AI Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🎬 CineAI → http://localhost:${PORT}`));
