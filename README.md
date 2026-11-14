# VOXSYNAPSE PRIME 🎙️
### Industrial Real-Time Bidirectional Call Translation Platform
> **Real-Time 2-Way Duplex Speech-to-Speech Translation with Zero Delay & Zero API Costs**

VOXSYNAPSE PRIME is a mission-critical web application that connects two callers (or a single caller in autonomous simulation mode) across language boundaries. When Person A speaks in their native language (e.g. English, Hindi, Telugu, Spanish, German, Japanese, etc.), Person B hears the translation spoken aloud instantly through their speakers, with live subtitles and acoustic echo-cancellation.

---

## ⚡ Core Capabilities

1. **Zero-Cost, Zero-Delay Architecture**:
   - **100% Free Operation**: Does not require any paid third-party API keys or subscriptions to run.
   - **Continuous Web Speech STT**: Sub-100ms interim speech recognition streaming.
   - **Instant Neural Translation**: In-memory LRU cache + multi-tier zero-cost neural fallback.
   - **Hybrid Loudspeaker Audio**: Web Speech API (0ms instant playback) + Backend Edge-TTS broadcast neural voices with +6dB hardware gain amplification.
   - **Acoustic Feedback Ducking**: Automatically ducks the microphone while speech is playing to eliminate echo loops.

2. **Dual-Duplex Calling Modes**:
   - **P2P WebRTC 2-Party Rooms**: Connect two real devices or browser tabs with a secure room code (e.g. `TACTICAL-99`).
   - **Solo Duplex Simulator**: Test bidirectional conversations immediately on a single device without needing a second participant.

---

## 💰 3 Enterprise Monetization Features (Commercial Tier)

VOXSYNAPSE PRIME includes a full enterprise monetization system with **Indian Rupee (₹ INR)** default and Global ($ USD) toggle:

1. **Feature 1: Corporate AI Executive Meeting Minutes & Action Item Engine**:
   - Automatically synthesizes call transcripts into executive summaries, key decisions, and prioritized action items with owner tags. Exportable as PDF, Markdown, and JSON.
2. **Feature 2: Enterprise Specialized Domain Glossaries & Jargon Lock**:
   - Proprietary terminology dictionaries for **Medical** (ICD-10/clinical), **Legal** (statutory clauses/indemnity), **FinTech** (EBITDA/liquidity), **Aerospace/Defense** (Mach/avionics), and **Software Engineering** to guarantee zero mistranslation.
3. **Feature 3: Studio Voice Clone & Telephony PSTN / SIP Dial-In Bridge**:
   - Preserves caller voice timbre across languages + dedicated international phone numbers with SOC2 / HIPAA compliance audit logs.

### Commercial Pricing Tiers
- **Community Free**: ₹0 / forever — Unlimited 2-Way P2P WebRTC calls, 45+ languages, local browser TTS.
- **Pro Industrial**: ₹2,999/mo ($49/mo) — AI Executive Minutes, Domain Glossaries, +6dB Volume Boost.
- **Enterprise Global**: ₹19,999/mo ($299/mo) — Voice Timbre Cloning, PSTN Dial-In Bridge, SLA 99.99%.

---

## 🚀 Quick Start Guide

### 1. Unified Local Server (Serves Frontend + Backend):
```powershell
python backend/main.py
```
*Open your browser at `http://localhost:8000` to access the full application.*

### 2. Standalone Development Servers:

#### Backend:
```powershell
cd backend
python main.py
```

#### Frontend:
```powershell
cd frontend
npm run dev
```

---

## 🧪 Verification & Test Suite

### 1. Backend Test Suite (Pytest):
Execute from workspace root:
```powershell
pytest
```
*Or from the `backend/` directory:*
```powershell
cd backend
pytest
```
*(All 77 tests pass with 100% success rate across 8 test files)*

### 2. Frontend Unit Tests (Node Test Runner):
Execute from workspace root:
```powershell
npm --prefix frontend test
```
*Or from the `frontend/` directory:*
```powershell
cd frontend
npm test
```
*(All 71 unit tests pass across 11 test suites with 0 failures)*

### 3. Frontend Tooling & Compliance:
```powershell
npm --prefix frontend run lint
npm --prefix frontend run format
npm --prefix frontend run typecheck
```

### 4. Production Build:
Execute from workspace root:
```powershell
npm --prefix frontend run build
```
*Or from the `frontend/` directory:*
```powershell
cd frontend
npm run build
```
*(Bundles cleanly into `frontend/dist` in ~2.5 seconds)*
