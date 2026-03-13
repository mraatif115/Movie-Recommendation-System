# 🎬 CineAI — AI Movie Recommendation System

A real AI-powered movie recommendation web app using Claude AI.

---

## 🚀 Deploy in 10 Minutes (FREE on Render.com)

### Step 1 — Get Your Anthropic API Key
1. Go to **https://console.anthropic.com/**
2. Sign up / Log in
3. Click **"API Keys"** → **"Create Key"**
4. Copy the key (starts with `sk-ant-...`)

---

### Step 2 — Push to GitHub
```bash
# In your terminal:
git init
git add .
git commit -m "CineAI initial commit"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/cineai.git
git push -u origin main
```

---

### Step 3 — Deploy on Render.com (FREE)
1. Go to **https://render.com** → Sign up with GitHub
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repo → Select `cineai`
4. Fill in settings:
   - **Name:** `cineai` (or anything)
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
5. Click **"Advanced"** → **"Add Environment Variable"**
   - Key: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-YOUR_KEY_HERE`
6. Click **"Create Web Service"**
7. Wait ~2 min → Your app is live at `https://cineai.onrender.com` ✅

---

## 💻 Run Locally

```bash
# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env
# Edit .env and add your API key

# 3. Start server
npm start

# 4. Open browser at:
# http://localhost:3000
```

---

## 📁 Project Structure

```
cineai/
├── server.js          ← Express server + AI API proxy
├── package.json       ← Dependencies
├── .env.example       ← Environment variable template
├── .gitignore         ← Ignores .env and node_modules
└── public/
    └── index.html     ← Full frontend (HTML + CSS + JS)
```

---

## ✨ Features

- **Real AI Recommendations** — Powered by Claude claude-opus-4-5
- **Natural Language Search** — "something that will haunt me for days"
- **3D Card Animations** — Mouse-tracking tilt effects
- **AI Insight Panel** — Live typewriter analysis
- **Genre Filtering** — Filter results by genre
- **Preference Sliders** — Tune mood, complexity, runtime, obscurity
- **Movie Detail Modal** — Full synopsis + AI insight + streaming hint
- **Custom Cursor** — Cinematic cursor experience
- **Animated Starfield** — Canvas-based background
- **Fully Responsive** — Works on mobile too

---

## 🔧 Customization

### Change AI Model
In `server.js`, change:
```js
model: 'claude-opus-4-5'  // Most capable
model: 'claude-haiku-4-5-20251001'  // Faster + cheaper
```

### Change Default Movies
In `public/index.html`, find `const defaultMovies=[...]` and edit the array.

### Change Colors
In `public/index.html`, find `:root{...}` and edit CSS variables:
```css
--accent: #e63946;   /* Red */
--gold:   #f4a261;   /* Orange */
--teal:   #2ec4b6;   /* Teal */
```

---

## 🆓 Free Tier Limits

| Platform | Limit |
|----------|-------|
| Render.com | Free tier — sleeps after 15min idle |
| Anthropic API | $5 free credit on signup |

---

## 📞 Support

If the app shows **"API key not configured"**, make sure:
1. You added `ANTHROPIC_API_KEY` in Render environment variables
2. You redeployed after adding the key (Render → Manual Deploy)
