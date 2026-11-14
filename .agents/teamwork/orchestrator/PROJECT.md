# Project: VoiceBridge Real Live Call Translator — Issue Remediation & Verification

## Architecture
- **Backend**: FastAPI ASGI application + python-socketio Server (`backend/main.py`, `backend/socket_handlers.py`).
  - Core Services: `backend/services/translator.py` (multi-tier translation), `backend/services/tts.py` (Edge-TTS neural speech synthesis), `backend/services/prosody_engine.py` (spoken slang normalization & intent classification), `backend/services/glossary.py` (domain glossary & jargon lock).
- **Frontend**: React 18 SPA bundled with Vite (`frontend/src/App.jsx`, `frontend/src/components/*`, `frontend/src/hooks/*`, `frontend/src/utils/*`).
  - Core Hooks: `useWebRTC.js` (Socket.IO duplex signaling and data channels), `useSpeechRecognition.js` (Web Speech API STT), `useSpeechSynthesis.js` (browser fallback TTS), `useRoomSync.js`.
  - Core Cockpit: `CallStudio.jsx` (Push-To-Talk, dynamic transcript HUD, audio waveforms, peer controls).
- **Data Flow**:
  1. Audio/Voice Input -> Web Speech STT / Backend STT (`/api/stt`).
  2. Spoken Transcript -> Prosody normalization -> WebSocket `speech_segment` (emitting `originalText`, `sourceLang`, `targetLang`, `domain`).
  3. Backend Socket.IO -> Jargon Lock -> Prosody classification -> Multi-tier translation -> Edge-TTS audio synthesis.
  4. Client Reception -> Instant subtitle render -> Base64 neural audio playback (or fallback Web Speech synthesis).

## Feature Inventory
| # | Feature / Issue | Description | Milestone | Source |
|---|-----------------|-------------|-----------|--------|
| 1 | Pytest Import & Config Defect | Running `pytest` fails with `ModuleNotFoundError: No module named 'backend'` when invoked from `backend/` or without explicit PYTHONPATH. | M1 | Survey (Explorer 1, 2, 3) |
| 2 | Missing Backend Dependencies | `SpeechRecognition` and `standard-aifc` missing from `backend/requirements.txt`, breaking `/api/stt`. Dev dependencies `pytest` and `httpx` also missing. | M1 | Survey (Explorer 1, 2) |
| 3 | Bare Import in Socket Handlers | `backend/socket_handlers.py:6-8` uses bare imports (`from services.translator import ...`) that fail on direct package import. | M1 | Survey (Explorer 2) |
| 4 | Missing `__init__.py` & Main Guard | Missing `backend/__init__.py`. Root `main.py` lines 9-31 execute on import without `if __name__ == "__main__":` guard. | M1 | Survey (Explorer 1, 2) |
| 5 | Missing SPA Build Fallback | `backend/main.py:318-330` returns raw 404 JSON when `frontend/dist` has not yet been built. | M1 | Survey (Explorer 1) |
| 6 | Global Voice Map Coverage | `backend/services/tts.py` only maps 9 Indian languages. 18 global languages fall back to Indian English voice `en-IN-NeerjaNeural`. | M1 | Survey (Explorer 2) |
| 7 | Hindi Exclamation Regex Bug | Stray space before regex flags in `frontend/src/utils/prosodyEngine.js:68` prevents Hindi urgent phrases (e.g., "जल्दी") from matching exclamation intent. | M2 | Survey (Explorer 2) |
| 8 | Domain Jargon Lock WebSocket Bypass | `activeDomain` not passed in `speech_segment` from `App.jsx:248` & `useWebRTC.js:298`, causing backend Jargon Lock to always default to general. | M2 | Survey (Explorer 2) |
| 9 | Fallback TTS Language Mismatch | `frontend/src/App.jsx:305, 311` passes `localLanguage` instead of `targetLang` to fallback Web Speech synthesis. | M2 | Survey (Explorer 2) |
| 10 | Dashboard Export Anchor Bug | `UserDashboard.jsx:154` and `AdminDashboard.jsx:126` trigger `a.click()` without `document.body.appendChild(a)`, breaking file downloads in Firefox. | M2 | Survey (Explorer 2) |
| 11 | Outdated Branding Artifact | Stale "CineSync" brand name in `frontend/src/components/ErrorBoundary.jsx:15, 38` instead of "VoiceBridge". | M2 | Survey (Explorer 2) |
| 12 | Frontend Tooling Scripts | Missing `lint`, `format`, and `typecheck` script declarations in `frontend/package.json`. | M2 | Survey (Explorer 1) |
| 13 | Orphaned Legacy Components | 7 dead, unimported components in `frontend/src` totaling ~1,250 LOC moved to `frontend/src/legacy/`. | M2 | Survey (Explorer 1, 2) |
| 14 | Reproduction & Regression Tests | Unit tests validating the remediations (Hindi intent test, global TTS voice test, domain socket test, direct package import test). | M3 | Survey (Explorer 3) |
| 15 | Documentation Drift | `README.md` lines 78 & 90 synchronized to accurately reflect 77 backend pytest tests and 71 frontend unit tests. | M3 | Survey (Explorer 1, 3) |
| 16 | Opaque-Box E2E Test Suite | Comprehensive 4-Tier test suite testing REST endpoints, socket signaling, translation, TTS, prosody, and edge cases (146 tests). | E2E | Original Request / Test Track |
| 17 | Final E2E Pass & Adversarial Hardening | Verify 100% pass of all E2E tiers and harden test coverage with white-box adversarial Challenger tests. | M_FINAL | Original Request / Dual Track |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Config & Dependencies | Pytest config (`pytest.ini`), requirements manifest (`backend/requirements.txt`), socket handler imports, `backend/__init__.py`, root `main.py` guard, SPA build fallback, and global TTS voice map. | none | DONE (`09c35989-656e-479b-be7e-f801f21a0efd`) |
| M2 | Frontend Logic, Audio & UI | Prosody regex fix, domain socket parameter forwarding, fallback TTS voice language, dashboard download anchors, ErrorBoundary branding, package scripts, and legacy component archiving. | none | DONE (`21620098-d6b8-4f4e-80d5-6f9fb13fc36b`) |
| M3 | Reproduction Tests & Documentation | New unit tests for all fixed defects, verification test runs, and `README.md` documentation synchronization. | M1, M2 | DONE (`5f411e2f-276f-469b-a818-60f115f36cf9`) |
| E2E | E2E Testing Track | Design and build comprehensive opaque-box 4-tier test suite, verify against requirements, publish `TEST_READY.md`. | none | DONE (`503f3fa5-81ff-45d7-bfdf-28000b6d0e5b`) |
| M_FINAL | Final E2E Pass & Coverage Hardening | Run and pass 100% of E2E tests (Tiers 1-4), followed by Tier 5 adversarial testing with Challengers. | M1, M2, M3, E2E | DONE (198 E2E, 77 unit, 71 frontend, build clean, 0 integrity violations) |

## Interface Contracts
### Frontend (`useWebRTC.js`) ↔ Backend (`backend/socket_handlers.py`)
- Event: `speech_segment`
- Payload:
  ```json
  {
    "originalText": "string",
    "sourceLang": "string (BCP-47 or 2-letter code)",
    "targetLang": "string (BCP-47 or 2-letter code)",
    "domain": "string (optional, defaults to 'general')"
  }
  ```
- Backend Handler Behavior:
  - If `domain` is present and valid, pass `domain` to `apply_glossary_protection(text, domain)`.
  - If `domain` is omitted, default to `"general"`.

### Frontend (`App.jsx`) ↔ Fallback TTS (`speak`)
- Function: `speak(text, lang, audioBase64)`
- Contract:
  - When playing remote neural audio, `lang` is metadata.
  - When `audioBase64` is missing/null, `lang` MUST be `targetLang` (the language of `text`), NEVER `localLanguage` (the language spoken by the local user).

### Backend Test Configuration ↔ Test Runner
- `pytest.ini` at project root:
  ```ini
  [pytest]
  pythonpath = . backend
  testpaths = backend/tests
  ```
- Contract: `pytest` executed from workspace root OR from `backend/` MUST resolve imports identically without `ModuleNotFoundError`.

## Code Layout
- `backend/`: FastAPI backend service, services (`translator.py`, `tts.py`, `prosody_engine.py`, `glossary.py`), socket handlers, tests.
- `frontend/`: React Vite frontend, components (`CallStudio`, `Navigation`, `UserDashboard`, `AdminDashboard`), hooks, utils, tests.
- `tests/e2e/`: Opaque-box 4-tier E2E test suites (`test_tier1_core.py`, `test_tier2_boundaries.py`, `test_tier3_combinations.py`, `test_tier4_scenarios.py`).
- `.agents/teamwork/`: Orchestrator and agent metadata, logs, and state files.
