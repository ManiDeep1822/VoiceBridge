# VoiceBridge 🎙️
### Real-Time Speech-to-Speech Cross-Language Audio Calling Web App
> **Speak in Telugu, they hear Hindi. Speak in Hindi, you hear Telugu.**

VoiceBridge connects two people from different language backgrounds over a clean audio call link. Raw microphone audio is muted to the listener, and replaced with high-definition, human-like neural synthetic speech in the listener's native language in real-time.

---

## 🌟 Key Features

1. **Natural Human Voices (Not Robotic):**
   - Powered by Microsoft Edge Neural HD voices:
     - **Telugu:** `te-IN-ShrutiNeural` (Female), `te-IN-MohanNeural` (Male)
     - **Hindi:** `hi-IN-SwaraNeural` (Female), `hi-IN-MadhurNeural` (Male)
     - Also supports Tamil, Kannada, Malayalam, Marathi, Bengali, and Indian English.
2. **100% Free-Tier Architecture:**
   - **Zero subscription fees:** No paid APIs required.
   - Built with high-speed Indic translation and Edge Neural TTS.
   - Optional support for Google Gemini Flash if a `GEMINI_API_KEY` is provided in `.env`.
3. **Sub-Second Instant Subtitles & Accelerated Voice:**
   - Stage 1: Live translated text subtitles stream instantly (<200ms) to the screen.
   - Stage 2: Accelerated natural speech (+15% conversational speed) plays through the speakers.
4. **Volume Boost & Hardware Amplification:**
   - +50% TTS volume boost.
   - 1.5× Web Audio `GainNode` hardware booster with in-room volume slider popover (up to 250%).
5. **Anti-Duplicate Speech Engine:**
   - Intelligently waits for finalized clauses and deduplicates utterances to prevent repeated playback.
6. **Deploy Anywhere for Free:**
   - Pre-configured for **Vercel** (`frontend/vercel.json`) and **Render** (`backend/render.yaml`).

---

## 🚀 Quick Start Guide

### Step 1: Install Dependencies & Run

#### Backend (Python 3.10+):
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

#### Frontend (Node 18+):
```powershell
cd frontend
npm install
npm run build
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser!

Or simply run the root launcher:
```powershell
./run.ps1
```

---

### Step 2: Testing with 2 People (or 2 Browser Tabs)
1. In **Tab 1 (You):**
   - Select **Telugu (తెలుగు)**.
   - Click **"Start a Call"**.
   - Copy the invite link using the Copy button.
2. In **Tab 2 (Partner):**
   - Open the copied link (or paste the room code).
   - Select **Hindi (हिन्दी)** and click **"Join Call"**.
3. **Start Talking:**
   - Speak in Telugu: *"నమస్కారం, మీరు ఎలా ఉన్నారు?"*
   - Partner's speaker will speak in natural Hindi: *"नमस्ते, आप कैसे हैं?"*
   - Partner speaks in Hindi: *"मैं ठीक हूँ"*
   - Your speaker will speak in natural Telugu: *"నేను బాగున్నాను"*

---

## ☁️ Free Cloud Deployment (HTTPS for Microphone Access)

Modern browsers strictly require **HTTPS** or `localhost` to allow microphone access. To use VoiceBridge across different devices over the internet:

### 1. Deploy Backend to Render (Free)
1. Push this repository to GitHub.
2. Go to [Render.com](https://render.com) and create a new **Web Service**.
3. Connect your GitHub repository:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:socket_app --host 0.0.0.0 --port $PORT`
4. Copy your Render HTTPS URL (e.g. `https://voicebridge-backend.onrender.com`).

### 2. Deploy Frontend to Vercel (Free)
1. Go to [Vercel.com](https://vercel.com) and import your GitHub repository.
2. Configure settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** `Vite`
3. Add Environment Variable:
   - `VITE_BACKEND_URL` = `https://voicebridge-backend.onrender.com` (your Render URL)
4. Click **Deploy**. Vercel will provide a free HTTPS URL with microphone permissions enabled worldwide!

---

## 🛠️ Project Structure

```
VoiceBridge/
  ├── backend/
  │    ├── main.py                  # FastAPI + Socket.io Server + Static SPA host
  │    ├── socket_handlers.py       # Room management & bidirectional audio streaming
  │    ├── services/
  │    │    ├── translator.py       # Indic translation engine (Free + Gemini fallback)
  │    │    └── tts.py              # Microsoft Edge Neural TTS engine (+15% speed, +50% volume)
  │    ├── test_e2e.py              # Automated 2-client simulation test
  │    ├── requirements.txt
  │    ├── render.yaml              # Render deployment configuration
  │    └── Procfile
  ├── frontend/
  │    ├── src/
  │    │    ├── components/
  │    │    │    ├── Lobby.jsx      # Language picker & room creator
  │    │    │    ├── CallRoom.jsx   # Audio stage with live subtitles & volume dock
  │    │    │    └── Visualizer.jsx # Reactive canvas soundwave
  │    │    ├── hooks/
  │    │    │    ├── useAudioQueue.js        # Web Audio GainNode & sequential queue
  │    │    │    └── useSpeechRecognition.js # Web Speech API + VAD pause & anti-duplicate
  │    │    ├── App.jsx
  │    │    └── index.css
  │    ├── vercel.json              # Vercel SPA routing
  │    └── vite.config.js
  ├── .gitignore
  ├── README.md
  ├── run.ps1
  └── run.bat
```

---

## 📄 License
MIT License - Open Source & Free to use.
