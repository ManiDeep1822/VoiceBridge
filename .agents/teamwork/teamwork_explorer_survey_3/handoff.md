# Codebase Test and Failure Investigation Report

## 1. Observation

### 1.1 Test Suite & Runner Inventory
The repository contains two distinct test suites across the backend (Python) and frontend (JavaScript/Node.js), plus a standalone E2E integration test:

#### A. Backend Test Suite (Pytest)
- **Framework**: `pytest 9.1.1` on Python 3.13.10.
- **Config Files**: No `pytest.ini`, `pyproject.toml`, `setup.cfg`, or `conftest.py` exist in the repository root or `backend/`.
- **Test Files**: 5 test modules located in `backend/tests/`:
  1. `backend/tests/test_fastapi_endpoints.py` (125 lines, 10 test functions): Tests REST endpoints (`/api/health`, `/api/rooms`, `/api/translate`, `/api/tts`, `/api/minutes`, `/api/glossary`, `/api/stt`, `DELETE /api/rooms/{id}`, empty payloads, 404 handler).
  2. `backend/tests/test_prosody_engine.py` (103 lines, 10 test functions): Tests spoken slang normalization (Telugu, Hindi, English), intent classification (interrogative, exclamatory, declarative), conversational enhancement, and phrase loop deduplication.
  3. `backend/tests/test_sockets.py` (448 lines, 11 test functions): Tests live Socket.IO events via ephemeral local server thread (`join_room`, `peer_connected`, `room_full` capacity rejection, multi-room isolation, rate-limiting spam guards, browser reconnection/refresh, explicit `leave_room`, WebRTC signaling relay, invalid room ID rejection, empty/null speech segment rejection, solo simulator loopback, and `ping_check` telemetry).
  4. `backend/tests/test_translator.py` (86 lines, 7 test functions): Tests `_sanitize_translation` (HTML unescaping, markdown removal, MyMemory quota warning filtering, legitimate phrase preservation), empty/identical language bypassing, locale code normalization, invalid language code fallback, network exception fallback, and malformed JSON upstream handling.
  5. `backend/tests/test_tts.py` (55 lines, 6 test functions): Tests `get_voice` lookup and fallback, empty input rejection, special character synthesis, unsupported language code fallback, long paragraph synthesis (>10KB audio), and gTTS catastrophic fallback when Edge-TTS is patched out.
- **Standalone Integration Test**:
  - `backend/test_e2e.py` (95 lines): End-to-end multi-client simulation script running a live Uvicorn instance, connecting two Socket.IO clients (`User_Telugu` and `User_Hindi`), emitting a Telugu sentence, asserting instant subtitle delivery, and asserting audio generation (>5000 chars base64). Not discovered by pytest by default as functions do not use `test_*` naming conventions.

#### B. Frontend Test Suite (Node Built-In Test Runner)
- **Framework**: Node.js built-in test runner (`node --test`).
- **Config / Scripts**: `frontend/package.json` line 10 defines `"test": "node --test tests/*.test.js"`.
- **Bundler**: Vite 6.4.5 (`npm run build`, `npm run dev`). No Vitest or Jest dependency is installed.
- **Test Files**: 7 test files located in `frontend/tests/`:
  1. `frontend/tests/backend_url.test.js` (123 lines, 9 test cases): Verifies `determineBackendUrl` across localhost, 127.0.0.1, LAN IPs (192.168.*, 10.*), FastAPI same-origin, `VITE_BACKEND_URL` overrides, and external production cloud hosts (Vercel, Render).
  2. `frontend/tests/deduplicator.test.js` (52 lines, 4 test cases): Verifies `deduplicateTokens`, `removePhraseLoops`, and `mergeStreamingTranscript` on consecutive words, phrase repetitions, streaming overlaps, and empty/null inputs.
  3. `frontend/tests/prosody.test.js` (57 lines, 5 test cases): Verifies client-side `normalizeSpokenSlang`, interrogative question detection and '?' appending, exclamations ('!'), statements ('.'), and prosody pitch/rate calculations (`getProsodyParams`).
  4. `frontend/tests/ptt.test.js` (83 lines, 6 test cases): Verifies dual-script PTT channel busy strings, button labels across all locales, Hold-to-Talk release thresholds (`evaluatePttRelease`, 200ms min hold, 500ms grace window), pointer cancel actions, and Spacebar keyboard triggers.
  5. `frontend/tests/rbac_enterprise.test.js` (98 lines, 8 test cases): Performs static AST/text assertions on `EnterpriseAuth.jsx`, `Navbar.jsx`, and `App.jsx` verifying elimination of public "Admin Fleet" links, enterprise SSO providers, demo credentials, guest joins, and role-based access checks (`currentUser?.role === 'Administrator'`).
  6. `frontend/tests/recorder.test.js` (43 lines, 3 test cases): Verifies `callRecorder` state lifecycle (start/stop), PCM chunk appending, and valid WAV Blob assembly and header export.
  7. `frontend/tests/translation.test.js` (83 lines, 13 test cases across 3 suites): Verifies `SUPPORTED_LANGUAGES` metadata and BCP-47 identifiers, `applyGlossaryProtection` and `restoreGlossaryTerms` across 6 domains, and basic guard clauses in `translateTextFast`.

---

### 1.2 Execution Commands & Verbatim Results

#### Command 1: Backend Test Suite from Workspace Root
```powershell
python -m pytest backend/tests -v
```
**Result**: 44 passed, 2 warnings in 13.58s (Exit code 0).
**Warnings**:
```text
C:\Users\indla\AppData\Roaming\Python\Python313\site-packages\fastapi\testclient.py:1: StarletteDeprecationWarning: Using `httpx` with `starlette.testclient` is deprecated; install `httpx2` instead.
backend/tests/test_fastapi_endpoints.py::test_stt_fallback_endpoint
  C:\Users\indla\AppData\Roaming\Python\Python313\site-packages\speech_recognition\__init__.py:7: DeprecationWarning: aifc was removed in Python 3.13. Please be aware that you are currently NOT using standard 'aifc', but instead a separately installed 'standard-aifc'.
```

#### Command 2: Frontend Unit Test Suite
```powershell
cd frontend
npm test
```
**Result**: 48 passed, 0 failed, 5 suites, duration 125.98ms (Exit code 0).

#### Command 3: Frontend Production Build
```powershell
cd frontend
npm run build
```
**Result**: Built in 2.78s cleanly (Exit code 0):
- `dist/index.html` (1.27 kB)
- `dist/assets/index-CatvEOLS.css` (60.05 kB)
- `dist/assets/index-DoUnMGZH.js` (379.27 kB)

#### Command 4: Standalone End-to-End Simulation
```powershell
python backend/test_e2e.py
```
**Result**: Success (Exit code 0):
- Stage 1: Telugu speech `నమస్కారం, మీరు బాగున్నారా?` -> instant subtitle `नमस्ते, आप कैसे हैं?` received.
- Stage 2: Accelerated neural audio received (23,616 chars base64).

#### Command 5: Pytest Executed from `backend/` Directory (Reproduced Failure)
```powershell
cd backend
python -m pytest tests
```
**Result**: Exit code 1 (Interrupted: 4 errors during collection):
```text
=================================== ERRORS ====================================
______________ ERROR collecting tests/test_fastapi_endpoints.py _______________
tests\test_fastapi_endpoints.py:3: in <module>
    from backend.main import app
E   ModuleNotFoundError: No module named 'backend'
___________________ ERROR collecting tests/test_sockets.py ____________________
tests\test_sockets.py:8: in <module>
    from backend.main import socket_app
E   ModuleNotFoundError: No module named 'backend'
__________________ ERROR collecting tests/test_translator.py __________________
tests\test_translator.py:4: in <module>
    from backend.services.translator import translate_text, _sanitize_translation, _TRANSLATION_CACHE
E   ModuleNotFoundError: No module named 'backend'
_____________________ ERROR collecting tests/test_tts.py ______________________
tests\test_tts.py:4: in <module>
    from backend.services.tts import synthesize_speech, get_voice, VOICE_MAP
E   ModuleNotFoundError: No module named 'backend'
```

#### Command 6: Pytest in Virtual Environments (`venv` and `backend/.venv`)
```powershell
& "backend\.venv\Scripts\python.exe" -m pytest --version
& "venv\Scripts\python.exe" -m pytest --version
```
**Result**:
- `backend\.venv\Scripts\python.exe: No module named pytest`
- `venv\Scripts\python.exe: No module named pytest`
- `backend\.venv` was created with `uv` (CPython 3.11) but does not have `pytest` or `pip` installed.

---

### 1.3 Live External Network Dependencies in Unit Tests
The backend test suite is not completely isolated; several tests make unmocked calls to external public web services:
1. `backend/tests/test_tts.py`:
   - `test_synthesize_speech_special_chars` (line 27) makes a live WebSocket connection to Microsoft Edge-TTS servers.
   - `test_synthesize_speech_unsupported_language` (line 34) makes a live call to Edge-TTS.
   - `test_synthesize_speech_long_text` (line 41) synthesizes an 8x paragraph over live Edge-TTS.
   - `test_synthesize_speech_gtts_fallback` (line 49) makes a live HTTP request to Google gTTS endpoints.
2. `backend/tests/test_translator.py`:
   - `test_translate_locale_normalization` (line 42) and `test_translate_invalid_or_none_language` (line 50) make live HTTP requests to Google Translate API (`translate.googleapis.com` and `clients5.google.com`).
3. If internet access is unavailable, firewalled, or Google/Microsoft endpoints rate-limit or fail, these unit tests will experience timeouts or failures.

---

### 1.4 Critical Codebase Areas Lacking Test Coverage
1. **Frontend React Components (0% Coverage)**:
   - 18 React components (~3,700 lines of code) have zero component unit tests, rendering tests, or DOM interaction tests:
     - `frontend/src/components/CallStudio/CallStudio.jsx` (921 LOC): Primary calling cockpit, handles peer state, audio streams, transcript rendering, and PTT dispatch.
     - `frontend/src/components/UserDashboard/UserDashboard.jsx` (458 LOC)
     - `frontend/src/components/AdminDashboard/AdminDashboard.jsx` (371 LOC)
     - `frontend/src/components/CallStage.jsx` (320 LOC)
     - `frontend/src/components/CallStudio/PreJoinLobby.jsx` (273 LOC)
     - `frontend/src/components/MinutesDrawer.jsx` (205 LOC)
     - `frontend/src/components/MonetizationModal.jsx` (291 LOC)
     - `frontend/src/components/GlossaryDrawer.jsx` (158 LOC)
     - `frontend/src/components/Navigation/Navbar.jsx` (338 LOC)
     - `frontend/src/App.jsx` (472 LOC)
   - Note: `rbac_enterprise.test.js` only checks source files via string matching (`fs.readFileSync`), not actual component rendering.
2. **Frontend React Custom Hooks (0% Coverage)**:
   - `frontend/src/hooks/useSpeechRecognition.js` (414 LOC): Web Speech API event listener lifecycle, interim recognition, fallback mobile timers, microphone ducking, and auto-restart loops.
   - `frontend/src/hooks/useSpeechSynthesis.js` (268 LOC): Browser SpeechSynthesis utterance queueing, pitch/rate modulation, and microphone mute synchronization.
   - `frontend/src/hooks/useWebRTC.js` (301 LOC): WebRTC peer connection instantiation, SDP negotiation, ICE candidate buffering, data channels, and track muting.
3. **Frontend Utilities Incomplete Coverage**:
   - `frontend/src/utils/translator.js`: Only empty string and identity inputs (`src === tgt`) are tested. The actual Tier 1 (GTX), Tier 2 (MyMemory), Tier 3 (FastAPI backend proxy), and timeout abort signals are never exercised in `translation.test.js`.
4. **Backend Services Gaps**:
   - `backend/services/glossary.py` (129 LOC): Missing a dedicated unit test suite (`backend/tests/test_glossary.py`). Direct functions `apply_glossary_protection`, `restore_glossary_terms`, and `get_domain_terms` have no direct backend tests (only tested indirectly via `/api/glossary` REST endpoint in `test_fastapi_endpoints.py`).
   - `backend/services/translator.py`: Option 3 (Gemini 2.5 Flash translation via `google-genai` SDK, lines 135-164) is never tested or mocked in unit tests.
   - `backend/socket_handlers.py`: Edge cases not tested:
     - Muted caller attempting to transmit audio (`if sender.get("isMuted"): return`).
     - Peer leaving mid-translation or mid-TTS generation (race condition lines 328, 376).
     - Domain glossary translation through the socket pipeline.
     - `synthesize_speech` failure handling (fallback emission of `peer_speech_ended`).

---

### 1.5 Documentation Drift in `README.md`
- `README.md` line 72: Claims `(All 29 tests pass with 100% success rate)`.
  - **Actual**: Pytest runs 44 tests (15 additional tests have been added since documentation was written).
- `README.md` line 79: Claims `(All 12 unit tests pass)`.
  - **Actual**: Node test runner runs 48 tests across 5 test suites.

---

## 2. Logic Chain

1. **Test Runner Mechanics**:
   - `python -m pytest backend/tests` executes from the repository root (`D:\Real Live Call Translator`). Python places the current working directory in `sys.path[0]`, allowing `import backend.main` and `import backend.services.*` to succeed.
   - When a developer or CI pipeline changes directory into `backend` (`cd backend`) and executes `pytest` or `python -m pytest tests`, `backend` becomes `sys.path[0]`.
   - In `backend/tests/test_fastapi_endpoints.py` (line 3), `test_sockets.py` (lines 8-9), `test_translator.py` (line 4), and `test_tts.py` (line 4), imports use absolute package syntax: `from backend.main import ...` and `from backend.services...`.
   - Because `backend` is not a subdirectory of `backend`, Python raises `ModuleNotFoundError: No module named 'backend'`.
   - Proof: `backend/tests/test_prosody_engine.py` (lines 2-15) already implemented a workaround:
     ```python
     try:
         from backend.services.prosody_engine import ...
     except ImportError:
         from services.prosody_engine import ...
     ```
     This proves the author recognized the import path ambiguity in `test_prosody_engine.py` but failed to apply it or a root configuration across the other 4 test modules.

2. **Virtual Environment Isolation**:
   - The workspace contains two virtual environments: `D:\Real Live Call Translator\venv` and `D:\Real Live Call Translator\backend\.venv`.
   - Neither virtual environment contains `pytest`. Only system Python (`C:\Program Files\Python313\python.exe`) contains `pytest 9.1.1`.
   - Furthermore, `backend/.venv` was created with `uv` and lacks `pip` entirely (`No module named pip`).
   - Anyone running commands in either virtual environment will fail with `No module named pytest`.

3. **External Network Reliance in Unit Tests**:
   - Observations in `backend/tests/test_tts.py` and `backend/tests/test_translator.py` show direct, unmocked invocations of `edge_tts.Communicate`, `gtts.gTTS`, and `aiohttp.ClientSession.get` pointing to external URLs.
   - While tests currently pass in an online environment with active internet connectivity, unit tests that rely on external cloud availability are inherently non-deterministic, subject to upstream rate limits, and fail in sandboxed or offline CI environments.

4. **Coverage Sufficiency Assessment**:
   - The frontend test suite relies primarily on pure utility unit tests (`backendUrl.js`, `pttHelper.js`, `prosodyEngine.js`, `transcriptDeduplicator.js`) and static text checks (`rbac_enterprise.test.js`).
   - The core user-facing application — representing ~5,000 lines of React code, hooks, and WebRTC signaling — has 0 automated UI/component tests. If any component regressions occur during development (e.g. state management errors in `CallStudio.jsx` or audio stream attachment failures), existing automated tests will not detect them.

---

## 3. Caveats

1. **Network Connectivity Assumption**:
   - Backend tests passed during this investigation because the host environment has active outbound internet access to Microsoft and Google translation/TTS servers. In an isolated CI container without external network access, `test_tts.py` and parts of `test_translator.py` will fail unless mocked.
2. **Browser Runtime Limitations**:
   - Node.js test runner does not provide a DOM or Web Speech API implementation. Testing React components and Web Speech hooks requires either jsdom, happy-dom, or Playwright/Puppeteer browser automation.
3. **Hardware Audio / MediaDevices**:
   - Testing real microphone streams (`navigator.mediaDevices.getUserMedia`) and WebRTC media tracks in automated tests requires synthetic mocks or browser flags (`--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream`).

---

## 4. Conclusion

The testing infrastructure is operational when invoked using the exact root-level commands specified in `CONSTRAINTS.md`, with 44 backend pytest tests passing, 48 frontend Node tests passing, and the frontend Vite production build succeeding. However, the test infrastructure exhibits several critical failure modes, architectural gaps, and maintainability risks:

1. **Path Inconsistency Failure**: Executing pytest from inside `backend/` crashes on 4 of 5 test suites with `ModuleNotFoundError: No module named 'backend'`.
   - **Remediation**: Add a root `conftest.py` or `pytest.ini` with `pythonpath = . backend`, or adopt the `try: from backend... except ImportError: from ...` import pattern established in `test_prosody_engine.py`.
2. **Virtual Environment Defect**: Neither `venv` nor `backend/.venv` has `pytest` installed, creating failures for developers activating those virtualenvs.
3. **Live Network Coupling**: `backend/tests/test_tts.py` and `backend/tests/test_translator.py` make real outbound network requests to Microsoft and Google services rather than using mocks.
4. **Substantial Frontend Blindspot**: Zero component tests exist for 18 React components (~3,700 LOC), and zero hook tests exist for Web Speech and WebRTC (~983 LOC).
5. **Documentation Drift**: `README.md` test counts (29 backend, 12 frontend) are obsolete and need updating to reflect the current 44 backend and 48 frontend tests.

---

## 5. Verification Method

To independently verify all findings in this report, execute the following commands in sequence:

### 1. Verify Standard Root Execution (Passes)
```powershell
python -m pytest backend/tests -v
# Expected: 44 passed, 2 warnings

cd frontend
npm test
# Expected: 48 tests passed, 0 failures

npm run build
# Expected: Clean Vite build into dist/
cd ..
```

### 2. Verify Standalone E2E Simulation (Passes)
```powershell
python backend/test_e2e.py
# Expected: STAGE 1 SUCCESS (instant text) and STAGE 2 SUCCESS (audio received)
```

### 3. Verify Backend Subdirectory Failure (Reproduces Bug)
```powershell
cd backend
python -m pytest tests
# Expected: Exit code 1, 4 ModuleNotFoundError collection errors
cd ..
```

### 4. Verify Virtual Environment Defect (Reproduces Bug)
```powershell
& "backend\.venv\Scripts\python.exe" -m pytest --version
& "venv\Scripts\python.exe" -m pytest --version
# Expected: "No module named pytest"
```

### 5. Inspect Test Files Directly
- `backend/tests/test_fastapi_endpoints.py:3` vs `backend/tests/test_prosody_engine.py:2-15`
- `README.md:72` (claims 29 tests) and `README.md:79` (claims 12 tests)
- `frontend/tests/rbac_enterprise.test.js:15-18` (verifies tests rely on `fs.readFileSync` rather than React component rendering)
