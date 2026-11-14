# BRIEFING — 2026-11-12T16:16:30Z

## Mission
Analyze `backend/services/tts.py` and TTS test suites, identify full recommended `VOICE_MAP` with valid Edge-TTS neural voices (female/male) for 18 global languages + Indian languages, analyze fallback/case/BCP-47 handling, and produce handoff report.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: d:\Real Live Call Translator
- State folder: d:\Real Live Call Translator\.agents\teamwork\explorer_m1_3
- Original parent: 09c35989-656e-479b-be7e-f801f21a0efd
- Milestone: Milestone 1: Backend Infrastructure, Dependencies & Test Configuration

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Write only to `.agents/teamwork/explorer_m1_3/`
- Never place source code or tests in `.agents/teamwork/`
- Follow Karpathy coding principles and Handoff protocol

## Current Parent
- Conversation ID: 09c35989-656e-479b-be7e-f801f21a0efd
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `backend/services/tts.py` (lines 1-139)
  - `frontend/src/utils/languages.js` (lines 1-188)
  - `backend/test_e2e.py` (lines 1-95)
  - `backend/tests/test_tts.py` (lines 1-55)
  - `backend/tests/test_fastapi_endpoints.py`
  - Edge-TTS catalog (322 total voices across 142 locales)
  - gTTS language capabilities
- **Key findings**:
  - `backend/services/tts.py:VOICE_MAP` currently supports only 9 Indian languages. All 18 global languages fallback to `en-IN-NeerjaNeural`.
  - Edge-TTS catalog confirmed exact valid neural female and male voices for 17 global languages (es, de, fr, ja, zh, ar, ru, pt, it, ko, nl, tr, id, vi, th, pl, sv). Real audio synthesis verified for all 34 voices.
  - Critical discovery on Punjabi (`pa`): Edge-TTS public service endpoint lacks any `pa-IN` voices (`pa-IN-OjasNeural` and `pa-IN-GurpreetNeural` exist in paid Azure Cognitive Services, but Edge-TTS returns `NoAudioReceived`). However, `gTTS` natively supports Punjabi (`pa`) and returns authentic speech for Gurmukhi script.
  - In `tts.py:124`, the catastrophic fallback hardcodes a whitelist of only 9 languages, forcing `code = "en"` for all 18 global languages in gTTS.
  - In `get_voice()`, `split("-")[0]` handles `-` but fails on `_` (e.g. `es_ES` -> `es_es`, falls back to `en-IN-NeerjaNeural`).
  - No existing tests in `test_tts.py` cover global languages, male voices, or BCP-47 variants.
- **Unexplored areas**: None for M1 TTS scope.

## Key Decisions Made
- Recommending complete 27-language `VOICE_MAP` with dual-gender mappings.
- Recommending enhancement to `get_voice()` to support underscore normalization and optional BCP-47 exact key matching before prefix fallback.
- Recommending updating `tts.py:124` whitelist to prevent gTTS fallback from forcing English on international languages.

## Artifact Index
- DISPATCH.md — incoming dispatch records
- BRIEFING.md — persistent state memory
- progress.md — liveness heartbeat
- handoff.md — 5-component handoff report
