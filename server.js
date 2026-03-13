require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const OMDB_KEY = process.env.OMDB_API_KEY || 'trilogy';

// ── OMDb helper ──
async function omdb(params) {
  const url = new URL('https://www.omdbapi.com/');
  url.searchParams.set('apikey', OMDB_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  return res.json();
}

async function searchMovie(title, year) {
  try {
    let data = await omdb({ t: title, y: year, type: 'movie', plot: 'short' });
    if (data.Response === 'True') return data;
    data = await omdb({ s: title, type: 'movie' });
    if (data.Search?.length > 0) {
      const detail = await omdb({ i: data.Search[0].imdbID, plot: 'short' });
      return detail.Response === 'True' ? detail : null;
    }
    return null;
  } catch { return null; }
}

// ── Trending homepage data ──
app.get('/api/trending', async (req, res) => {
  const trending = [
    { t: 'Oppenheimer', y: '2023' }, { t: 'Dune Part Two', y: '2024' },
    { t: 'Poor Things', y: '2023' }, { t: 'Past Lives', y: '2023' },
    { t: 'Killers of the Flower Moon', y: '2023' }, { t: 'Saltburn', y: '2023' },
    { t: 'The Holdovers', y: '2023' }, { t: 'Anatomy of a Fall', y: '2023' },
    { t: 'Mission Impossible Dead Reckoning', y: '2023' }, { t: 'Wonka', y: '2023' },
    { t: 'Napoleon', y: '2023' }, { t: 'Priscilla', y: '2023' },
  ];
  const topRated = [
    { t: 'The Shawshank Redemption', y: '1994' }, { t: 'The Godfather', y: '1972' },
    { t: 'The Dark Knight', y: '2008' }, { t: "Schindler's List", y: '1993' },
    { t: 'Pulp Fiction', y: '1994' }, { t: 'Inception', y: '2010' },
    { t: 'Fight Club', y: '1999' }, { t: 'Forrest Gump', y: '1994' },
    { t: 'The Matrix', y: '1999' }, { t: 'Interstellar', y: '2014' },
    { t: 'Parasite', y: '2019' }, { t: 'Whiplash', y: '2014' },
  ];
  const classics = [
    { t: 'Blade Runner 2049', y: '2017' }, { t: 'Her', y: '2013' },
    { t: 'No Country for Old Men', y: '2007' }, { t: 'Mad Max Fury Road', y: '2015' },
    { t: 'Get Out', y: '2017' }, { t: 'Hereditary', y: '2018' },
    { t: 'Midsommar', y: '2019' }, { t: 'Joker', y: '2019' },
    { t: 'Once Upon a Time in Hollywood', y: '2019' }, { t: 'Marriage Story', y: '2019' },
    { t: 'The Lighthouse', y: '2019' }, { t: 'Uncut Gems', y: '2019' },
  ];
  try {
    const [t, r, c] = await Promise.all([
      Promise.all(trending.map(m => searchMovie(m.t, m.y))),
      Promise.all(topRated.map(m => searchMovie(m.t, m.y))),
      Promise.all(classics.map(m => searchMovie(m.t, m.y))),
    ]);
    res.json({ trending: t.filter(Boolean), topRated: r.filter(Boolean), classics: c.filter(Boolean) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Movie details ──
app.get('/api/movie/:id', async (req, res) => {
  try {
    const data = await omdb({ i: req.params.id, plot: 'full' });
    if (data.Response !== 'True') return res.status(404).json({ error: 'Not found' });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Search ──
app.get('/api/search', async (req, res) => {
  try {
    const data = await omdb({ s: req.query.q, type: 'movie' });
    res.json(data.Search || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── AI Recommendations — Gemini ──
app.post('/api/recommend', async (req, res) => {
  const { query, preferences } = req.body;

  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured. Add it in Render Environment Variables.' });
  }

  try {
    const prompt = `You are CineAI, a world-class film recommendation AI.
User query: "${query}"
Preferences: intensity=${preferences?.intensity||7}/10, complexity=${preferences?.complexity||6}/10, runtime max=${preferences?.runtime||150}min, obscurity=${preferences?.obscurity||5}/10

Respond ONLY with valid JSON. No markdown, no backticks, no extra text.
Format:
{
  "insight": "2 vivid sentences about what you understood and why your picks are perfect",
  "movies": [
    { "title": "Exact English Title", "year": "2023", "imdbId": "tt1234567", "match": 95, "why": "One sharp sentence on why this fits." }
  ]
}
Rules: Recommend exactly 8 movies. Use exact IMDb titles. Include correct IMDb ID. Match score 70-99.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1500 },
        }),
      }
    );

    const geminiData = await geminiRes.json();

    if (geminiData.error) throw new Error(geminiData.error.message);

    let text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Clean markdown if present
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const ai = JSON.parse(text);

    // Fetch real OMDb data for each movie
    const movies = await Promise.all(ai.movies.map(async (m) => {
      try {
        let data;
        if (m.imdbId) data = await omdb({ i: m.imdbId, plot: 'short' });
        if (!data || data.Response !== 'True') data = await searchMovie(m.title, m.year);
        if (!data || data.Response !== 'True') return null;
        return { ...data, match: m.match, why: m.why };
      } catch { return null; }
    }));

    res.json({ insight: ai.insight, movies: movies.filter(Boolean) });
  } catch (e) {
    console.error('Gemini Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🎬 CineAI → http://localhost:${PORT}`));
