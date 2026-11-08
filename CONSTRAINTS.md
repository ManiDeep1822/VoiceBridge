# CONSTRAINTS & QUALITY BAR — REAL LIVE CALL TRANSLATOR (VOXSYNAPSE)

## 1. Floor & Quality Thresholds
- **Zero-Cost Operation**: The core 2-way call translation system MUST function 100% free without requiring any paid third-party API keys or subscriptions. Uses browser Web Speech API for real-time STT, high-speed free neural translation fallback chain, and local Web SpeechSynthesis + backend Edge-TTS for audio playback.
- **Backend Test Suite**: 100% pass rate (`python -m pytest backend/tests` must pass all tests with 0 failures).
- **Frontend Build & Test Suite**: `npm run build` must succeed with 0 bundle or syntax errors. Unit tests in `frontend/tests` must pass with 0 failures (`npm test`).
- **End-to-End Latency Target**:
  - Interim STT recognition: < 150ms in browser.
  - Neural text translation: < 250ms via LRU cache and parallel fallback.
  - Instant subtitle display: delivered to recipient peer in < 300ms.
  - Spoken audio playback (TTS): < 500ms total from utterance completion.
- **Audio Duplex & Feedback Prevention**: Continuous active call audio MUST enforce `echoCancellation: true`, `noiseSuppression: true`, and `autoGainControl: true`, plus smart microphone muting/ducking while loud translated audio is synthesized or played through speakers.

## 2. Industrial Brutalist Design System & Aesthetics
- **Visual Archetype**: Tactical Telemetry / Swiss Industrial Brutalism.
- **Palette**: Dark titanium/graphite `#0A0D11`, `#11161D`, `#19202B`, bordered with razor 1px borders (`#2A3441`).
- **Telemetry Accents**: Phosphor Emerald `#00FF88` (live call/active translation), Phosphor Amber `#FFB000` (interim speech/buffering), Tactical Cyan `#00E5FF` (P2P WebRTC Direct), Alert Crimson `#FF3B30` (disconnect/errors).
- **Typography**: Rigid modular grid with heavy sans-serif headers (Inter / Archivo) and JetBrains Mono monospace telemetry numbers, millisecond latency readouts, and dB audio meters.
- **Zero generic AI slop**: No floaty cards, no soft purple drop shadows, no bubbly cartoonish pill shapes.

## 3. Required Monetization Features (Enterprise / Paid Tiers)
1. **AI Automated Executive Meeting Minutes & Action Item Engine**: Bilingual executive briefing, consensus decisions, timestamped action items with assignee tags, and one-click PDF / Markdown / JSON export.
2. **Enterprise Specialized Industry Glossaries & Jargon Lock**: Terminology locks for Medical (ICD-10/clinical), Legal (jurisprudence/contracts), FinTech, Aviation/Defense, Maritime, and Software Engineering so proprietary jargon is never mistranslated.
3. **Studio Voice Clone Timbre Preservation & Telephony PSTN/SIP Dial-in Bridge**: Speaker timbre preservation + dedicated international dial-in phone numbers with secure cloud recording & compliance audit trails (SOC2 / HIPAA ready).

## 4. Verification Commands
- `check:backend`: `python -m pytest backend/tests`
- `check:frontend`: `cd frontend; npm test`
- `check:build`: `cd frontend; npm run build`
