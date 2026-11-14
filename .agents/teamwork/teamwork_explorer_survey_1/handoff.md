# Comprehensive Investigation & Survey Report: Build, Tooling, Dependencies, and Import Integrity

- **Agent**: Explorer 1 (Codebase Build and Dependency Investigator)
- **Role**: Codebase Build and Dependency Investigator
- **Workspace**: `d:\Real Live Call Translator`
- **Date**: 2026-11-12
- **Integrity Mode**: Development

---

## 1. Observation

### 1.1 Project Structure, Languages, Frameworks, and Manifests

1. **Languages & Runtimes**:
   - **Backend**: Python 3.11 / Python 3.13 (Asynchronous FastAPI + Python-SocketIO ASGI engine).
   - **Frontend**: JavaScript ES2022+ / React 18.3.1 (JSX syntax). No TypeScript (`.ts`/`.tsx`) code is present.
   - **Styling**: Tailwind CSS 3.4.17 with PostCSS 8.4.49 & Autoprefixer 10.4.20.
   - **Node.js Environment**: Node v24.15.0, npm 11.12.1.
   - **Python Environments**: System Python 3.13.10; root virtualenv `.\venv` (Python 3.13.10); local virtualenv `.\backend\.venv` (Python 3.11.15).

2. **Configuration Files and Manifests Identified**:
   - `frontend/package.json`: Frontend package manifest and script declarations.
   - `frontend/package-lock.json`: Frontend exact dependency lockfile.
   - `frontend/vite.config.js`: Vite dev server configuration (port 3000, proxies `/api` and `/socket.io` to `http://localhost:8000`).
   - `frontend/tailwind.config.js`: Tailwind CSS theme configuration (custom colors, animations, slate shades).
   - `frontend/postcss.config.js`: PostCSS plugin configuration (`tailwindcss`, `autoprefixer`).
   - `frontend/vercel.json`: Vercel SPA rewrite configuration (`/(.*)` -> `/index.html`).
   - `vercel.json` (root): Vercel rewrite configuration for frontend hosting + Render backend proxying.
   - `render.yaml` (root): Render infrastructure-as-code spec (`voicebridge-backend`, Python 3.11.0 runtime, `pip install -r requirements.txt`, start command `uvicorn main:socket_app --host 0.0.0.0 --port $PORT`).
   - `backend/render.yaml`: Subfolder copy of Render service specification.
   - `backend/Procfile`: Deployment start command (`web: uvicorn main:socket_app --host 0.0.0.0 --port $PORT`).
   - `backend/requirements.txt`: Python package manifest.
   - `backend/.env.example`: Backend environment variable template (`PORT`, `GEMINI_API_KEY`).
   - `main.py` (root): Top-level launcher delegating to `backend/main.py`.
   - `run.bat` & `run.ps1` (root): Windows batch and PowerShell launchers.
   - `CONSTRAINTS.md` & `README.md`: Architectural specification and quick start documentation.

---

### 1.2 Build, Test, Lint, and Typecheck Commands

1. **Defined Project Scripts**:
   - **Frontend (`frontend/package.json`)**:
     - `"dev": "vite"` (Vite development server on port 3000)
     - `"build": "vite build"` (Vite production bundle into `frontend/dist`)
     - `"preview": "vite preview"` (Vite production preview server)
     - `"test": "node --test tests/*.test.js"` (Node 18+ native test runner executing 7 test files)
   - **Backend (`CONSTRAINTS.md` & `README.md`)**:
     - `python -m pytest backend/tests` (Full Pytest suite from root)
     - `python backend/test_e2e.py` (Stand-alone live Socket.IO end-to-end integration test)

2. **Missing Scripts and Configurations**:
   - **No Lint Command**: `npm run lint` is NOT defined in `frontend/package.json`. No ESLint configuration file (`.eslintrc`, `eslint.config.js`) exists in the repository. Neither `flake8`, `ruff`, nor `pylint` is configured for the backend.
   - **No Typecheck Command**: `npm run typecheck` is NOT defined in `frontend/package.json`. No `tsconfig.json` or `jsconfig.json` exists in `frontend/`. Neither `mypy` nor `pyright` is configured for the backend.
   - **No Format Command**: `npm run format` is NOT defined in `frontend/package.json`. No Prettier config exists in the repository root or frontend root.

---

### 1.3 Execution and Test Audit Results

1. **Frontend Production Build (`cd frontend && npm run build`)**:
   - Executed: `cd frontend; npm run build`
   - Result: **SUCCESS (Exit Code 0)**
   - Output:
     ```
     vite v6.4.5 building for production...
     transforming...
     ✓ 2122 modules transformed.
     rendering chunks...
     computing gzip size...
     dist/index.html                   1.27 kB │ gzip:   0.64 kB
     dist/assets/index-CatvEOLS.css   60.05 kB │ gzip:  10.22 kB
     dist/assets/index-DoUnMGZH.js   379.27 kB │ gzip: 106.84 kB
     ✓ built in 2.43s
     ```

2. **Frontend Unit Test Runner (`cd frontend && npm test`)**:
   - Executed: `cd frontend; npm test` (`node --test tests/*.test.js`)
   - Result: **SUCCESS (Exit Code 0)**
   - Output:
     ```
     ℹ tests 48
     ℹ suites 5
     ℹ pass 48
     ℹ fail 0
     ℹ duration_ms 153.4236
     ```
   - Test suites passed:
     - `backend_url.test.js`: 9/9 passed
     - `deduplicator.test.js`: 4/4 passed
     - `prosody.test.js`: 5/5 passed
     - `ptt.test.js`: 6/6 passed
     - `rbac_enterprise.test.js`: 8/8 passed
     - `recorder.test.js`: 3/3 passed
     - `translation.test.js`: 13/13 passed

3. **Backend Test Suite from Root (`python -m pytest backend/tests -v`)**:
   - Executed: `python -m pytest backend/tests -v`
   - Result: **SUCCESS (Exit Code 0)**
   - Output: `44 passed, 2 warnings in 14.22s`
     - `backend/tests/test_fastapi_endpoints.py`: 10 passed
     - `backend/tests/test_prosody_engine.py`: 10 passed
     - `backend/tests/test_sockets.py`: 11 passed
     - `backend/tests/test_translator.py`: 7 passed
     - `backend/tests/test_tts.py`: 6 passed

4. **Backend Test Suite from `backend/` Directory (`cd backend; python -m pytest tests`)**:
   - Executed: `cd backend; python -m pytest tests`
   - Result: **FAILURE (Exit Code 1, 4 Collection Errors)**
   - Verbatim Output:
     ```
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
     =========================== short test summary info ===========================
     ERROR tests/test_fastapi_endpoints.py
     ERROR tests/test_sockets.py
     ERROR tests/test_translator.py
     ERROR tests/test_tts.py
     !!!!!!!!!!!!!!!!!!! Interrupted: 4 errors during collection !!!!!!!!!!!!!!!!!!!
     ======================== 1 warning, 4 errors in 0.74s =========================
     ```

5. **Backend Stand-Alone E2E Test (`python backend/test_e2e.py`)**:
   - Executed: `python backend/test_e2e.py`
   - Result: **SUCCESS (Exit Code 0)**
   - Output:
     ```
     [Test] Starting 2-Client Speech-to-Speech E2E Simulation...
     [Client A (Telugu)] Speaking: 'నమస్కారం, మీరు బాగున్నారా?'
     [Client B (Hindi)] Instant subtitle received!
       - Original: నమస్కారం, మీరు బాగున్నారా?
       - Translated: नमस्ते, आप कैसे हैं?
     [STAGE 1 SUCCESS] Instant text received with sub-second latency!
     [Client B (Hindi)] Accelerated audio received (+15% rate)!
       - Audio Base64 length: 23616 chars
     [STAGE 2 SUCCESS] Fast neural audio received!
     ```

6. **AST Syntax Parse of all Project Files**:
   - **Python**: `python -m py_compile` compiled every `.py` file across root and backend with 0 syntax errors.
   - **Frontend**: `@babel/parser` parsed all 32 `.js` and `.jsx` files in `frontend/src` and 7 files in `frontend/tests` with 0 syntax errors.

---

### 1.4 Broken Imports, Dependency Health & Path Resolution Findings

#### Finding 1: Test Import Broken when Executing Pytest from `backend/`
- **Files**:
  - `backend/tests/test_fastapi_endpoints.py:3`: `from backend.main import app`
  - `backend/tests/test_sockets.py:8-9`: `from backend.main import socket_app`, `from backend.socket_handlers import rooms, ...`
  - `backend/tests/test_translator.py:4`: `from backend.services.translator import translate_text, ...`
  - `backend/tests/test_tts.py:4`: `from backend.services.tts import synthesize_speech, ...`
- **Observation**:
  `test_prosody_engine.py:2-15` uses defensive fallback:
  ```python
  try:
      from backend.services.prosody_engine import ...
  except ImportError:
      from services.prosody_engine import ...
  ```
  The other 4 test files lack this fallback, causing `ModuleNotFoundError: No module named 'backend'` when pytest is invoked from within `backend/`. Furthermore, there is no `pytest.ini` or `conftest.py` in the workspace to unify `sys.path`.

#### Finding 2: Missing Production Dependency in `backend/requirements.txt` (`SpeechRecognition`)
- **Files**: `backend/requirements.txt`, `backend/main.py:239`, `render.yaml:8`
- **Observation**:
  `backend/main.py` lines 239, 248, 249 define:
  ```python
  import speech_recognition as sr
  recognizer = sr.Recognizer()
  with sr.AudioFile(temp_path) as source:
      audio = recognizer.record(source)
      text = recognizer.recognize_google(audio, language=stt_lang)
  ```
  `backend/requirements.txt` lists:
  ```
  fastapi>=0.115.0
  uvicorn[standard]>=0.30.0
  python-socketio>=5.11.0
  edge-tts>=7.3.1
  gTTS>=2.5.0
  google-genai>=0.1.0
  python-dotenv>=1.0.0
  pydantic>=2.8.0
  aiohttp>=3.9.0
  ```
  `SpeechRecognition` is NOT in `backend/requirements.txt`.
  In any fresh environment or cloud host (Render `buildCommand: pip install -r requirements.txt`), `speech_recognition` will not be installed, causing `/api/stt` to return `500/error` due to `ModuleNotFoundError: No module named 'speech_recognition'`.

#### Finding 3: Missing Test Runner Dependencies in Python Manifest
- **Files**: `backend/requirements.txt` (or missing `requirements-dev.txt`)
- **Observation**: `pytest` and `httpx` (used by FastAPI's `TestClient` in `backend/tests/test_fastapi_endpoints.py:2`) are omitted from `requirements.txt`. On a clean install of `requirements.txt`, neither `pytest` nor `httpx` is available.

#### Finding 4: Incomplete / Corrupted Virtual Environment in `backend/.venv`
- **Files**: `backend/.venv/`, `main.py:17-22`, `run.bat:9-10`, `run.ps1:20-22`
- **Observation**:
  - `backend/.venv` is an existing virtual environment with Python 3.11.15.
  - Verification command:
    `.\backend\.venv\Scripts\python.exe -c "import gtts, speech_recognition"`
    Result: `ModuleNotFoundError: No module named 'gtts'` and `No module named 'speech_recognition'`.
  - Also: `.\backend\.venv\Scripts\python.exe -m pip list` output: `No module named pip`.
  - In `main.py` (root) lines 19-22:
    ```python
    if os.path.exists(venv_python) and sys.executable.lower() != venv_python.lower():
        result = subprocess.run([venv_python, os.path.join(backend_dir, "main.py")] + sys.argv[1:])
        sys.exit(result.returncode)
    ```
  - In `run.bat` lines 9-10:
    ```batch
    if exist .venv\Scripts\python.exe (
        .venv\Scripts\python.exe main.py
    )
    ```
  - In `run.ps1` lines 20-22:
    ```powershell
    if (Test-Path ".\.venv\Scripts\python.exe") {
        & ".\.venv\Scripts\python.exe" "main.py"
    }
    ```
  All three launcher scripts detect and launch `backend\.venv\Scripts\python.exe`. When launched with this interpreter, the server crashes if gTTS fallback is reached or `/api/stt` is called.

#### Finding 5: Missing `if __name__ == "__main__":` Guard in Root `main.py`
- **Files**: `main.py:9-31`
- **Observation**:
  Lines 9-31 of `main.py` sit directly in the global module scope without an `if __name__ == "__main__":` block. If any external tool, test discovery runner, or script imports `main.py`, it executes `subprocess.run` or binds `uvicorn.run(socket_app, host="0.0.0.0", port=port)` immediately.

#### Finding 6: Seven Unreachable / Orphaned Files in `frontend/src`
- **Files**:
  1. `frontend/src/components/Auth/AdminLogin.jsx` (207 lines)
  2. `frontend/src/components/Auth/UserLogin.jsx` (187 lines)
  3. `frontend/src/components/CallStage.jsx` (422 lines)
  4. `frontend/src/components/TacticalHeader.jsx` (197 lines)
  5. `frontend/src/components/ToastContainer.jsx` (47 lines)
  6. `frontend/src/components/TranscriptHUD.jsx` (192 lines)
  7. `frontend/src/utils/fastTranslator.js` (6 lines)
- **Observation**:
  A breadth-first reachability traversal from `frontend/src/main.jsx` confirmed that out of 33 source files in `frontend/src`, 26 are reachable and 7 are never imported by any active component or test. They represent ~1,250 lines of dead code that were replaced during architectural iterations (e.g. `AdminLogin` and `UserLogin` were replaced by `EnterpriseAuth.jsx`; `CallStage` and `TranscriptHUD` were integrated into `CallStudio.jsx`; `TacticalHeader` was replaced by `Navbar.jsx`).

#### Finding 7: FastAPI Root Route 404 when `frontend/dist` is Unbuilt
- **Files**: `backend/main.py:318-330`
- **Observation**:
  `backend/main.py` conditionally mounts SPA static files:
  ```python
  frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
  if os.path.exists(frontend_dist):
      app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")
      @app.get("/{full_path:path}")
      async def serve_spa(full_path: str): ...
  ```
  Since `frontend/dist` is in `.gitignore`, on a fresh checkout prior to `npm run build`, navigating to `http://localhost:8000` returns an unhandled 404 JSON response (`{"detail":"Not Found"}`) rather than an informative error screen explaining that the frontend build artifact is missing.

---

## 2. Logic Chain

1. **Premise 1 (Module Search Paths in Python)**:
   - When a Python script or pytest is executed from a working directory `D:\Real Live Call Translator\backend`, Python inserts `D:\Real Live Call Translator\backend` into `sys.path[0]`.
   - The statement `from backend.main import app` requires a directory named `backend` containing `main.py` located on `sys.path`.
   - In `D:\Real Live Call Translator\backend`, the subdirectories are `services`, `tests`, `__pycache__`, etc. There is no subdirectory named `backend`.
   - Therefore, `from backend.main import app` in `test_fastapi_endpoints.py:3`, `test_sockets.py:8`, `test_translator.py:4`, and `test_tts.py:4` produces `ModuleNotFoundError: No module named 'backend'` whenever pytest is executed from `backend/`.

2. **Premise 2 (Production Cloud Builds & Dependencies)**:
   - `render.yaml` specifies `buildCommand: pip install -r requirements.txt`.
   - `backend/main.py:239` executes `import speech_recognition as sr`.
   - `SpeechRecognition` is absent from `backend/requirements.txt`.
   - Therefore, any automated cloud deployment adhering to `render.yaml` will fail to resolve `speech_recognition` when `/api/stt` is requested.

3. **Premise 3 (Launcher Delegation to Broken Virtual Environment)**:
   - `main.py`, `run.bat`, and `run.ps1` check for `backend\.venv\Scripts\python.exe`.
   - If that binary exists, all three launchers unconditionally dispatch execution to `backend\.venv\Scripts\python.exe`.
   - `backend\.venv` has an incomplete set of installed packages (`gTTS` and `speech_recognition` are absent).
   - Therefore, starting the unified server via `main.py`, `run.bat`, or `run.ps1` invokes a compromised runtime environment that fails on fallback TTS and STT operations.

4. **Premise 4 (Dead Code Accumulation)**:
   - `main.jsx` mounts `App.jsx`.
   - `App.jsx` imports `EnterpriseAuth`, `CallStudio`, `PreJoinLobby`, `Navbar`, `AdminDashboard`, `UserDashboard`, etc.
   - `AdminLogin.jsx`, `UserLogin.jsx`, `CallStage.jsx`, `TacticalHeader.jsx`, `ToastContainer.jsx`, `TranscriptHUD.jsx`, and `fastTranslator.js` are not imported by `App.jsx`, any child component, or any test in `frontend/tests`.
   - Therefore, these 7 files are dead code that contribute to repository entropy and maintenance overhead without functional utility.

---

## 3. Caveats

- **No Caveats**: The entire repository was audited across all directories. Both Python environments (system and virtualenvs) and Node environments were directly inspected and exercised with live executions.
- **External Network Dependency**: Live neural TTS (Microsoft Edge TTS) and translation (Google GTX) depend on outbound Internet connectivity. In offline environments, the local fallback chain (client Web Speech API, local browser TTS, in-memory LRU cache) activates as designed.

---

## 4. Conclusion

The codebase core functionality is robust, with 100% test pass rates when executed with specific root-level flags (44/44 backend pytest tests, 48/48 frontend node tests, and live 2-client E2E simulation). However, there are **8 specific defects and architectural omissions** in the build, dependency, and configuration setup:

| # | Category | Affected File(s) | Impact | Recommended Fix Strategy |
|---|----------|------------------|--------|--------------------------|
| 1 | **Test Import Path Resolution** | `backend/tests/test_fastapi_endpoints.py:3`<br>`backend/tests/test_sockets.py:8-9`<br>`backend/tests/test_translator.py:4`<br>`backend/tests/test_tts.py:4` | `cd backend; pytest` fails with 4 `ModuleNotFoundError: No module named 'backend'` errors. | Apply `try ... except ImportError` pattern (as in `test_prosody_engine.py`) or create `pytest.ini` with `pythonpath = . ..` so tests pass identically whether run from root or `backend/`. |
| 2 | **Missing Production Dependency** | `backend/requirements.txt`<br>`backend/main.py:239` | `/api/stt` fails on Render or clean installs (`No module named 'speech_recognition'`). | Add `SpeechRecognition>=3.10.0` (and `standard-aifc>=3.13.0` for Python 3.13) to `backend/requirements.txt`. |
| 3 | **Missing Dev / Test Dependencies** | `backend/requirements.txt` (or `requirements-dev.txt`) | Clean installs cannot execute `pytest` or `TestClient` without manually installing packages. | Add `pytest>=8.0.0` and `httpx>=0.27.0` to requirements manifest. |
| 4 | **Compromised Virtual Environment** | `backend/.venv`<br>`main.py:17-22`<br>`run.bat:9-10`<br>`run.ps1:20-22` | Launchers prioritize broken `backend/.venv` (missing `gtts`, `speech_recognition`, `pip`), leading to runtime crashes. | Cleanly install missing dependencies into `backend/.venv` or update launcher scripts to validate module availability before delegating. |
| 5 | **Missing Main Guard** | `main.py:9-31` | Importing root `main.py` immediately launches uvicorn or subprocess. | Wrap lines 9-31 inside `if __name__ == "__main__":`. |
| 6 | **Orphaned Dead Code** | `frontend/src/components/Auth/AdminLogin.jsx`<br>`frontend/src/components/Auth/UserLogin.jsx`<br>`frontend/src/components/CallStage.jsx`<br>`frontend/src/components/TacticalHeader.jsx`<br>`frontend/src/components/ToastContainer.jsx`<br>`frontend/src/components/TranscriptHUD.jsx`<br>`frontend/src/utils/fastTranslator.js` | ~1,250 lines of unmaintained legacy code. | Safely prune or archive the 7 orphaned files. |
| 7 | **Missing SPA Build Fallback** | `backend/main.py:318-330` | Visiting `http://localhost:8000` returns raw 404 JSON if `frontend/dist` has not yet been built. | Provide an informative HTML fallback page directing developer to run `npm run build`. |
| 8 | **Missing Tooling Scripts** | `frontend/package.json` | No `lint`, `format`, or `typecheck` scripts defined for CI/CD gates. | Add standard script declarations to `package.json`. |

---

## 5. Verification Method

To independently verify these findings, execute the following commands from the repository root:

1. **Verify Backend Test Failure from `backend/` Directory**:
   ```powershell
   cd backend
   python -m pytest tests
   cd ..
   ```
   *Expected Output*: Fails with 4 `ModuleNotFoundError: No module named 'backend'` collection errors.

2. **Verify Missing `SpeechRecognition` in `backend/requirements.txt`**:
   ```powershell
   Select-String -Path backend\requirements.txt -Pattern "SpeechRecognition|speech_recognition"
   ```
   *Expected Output*: No matches found.

3. **Verify Broken `backend/.venv` State**:
   ```powershell
   .\backend\.venv\Scripts\python.exe -c "import gtts, speech_recognition"
   ```
   *Expected Output*: Fails with `ModuleNotFoundError: No module named 'gtts'`.

4. **Verify Root `main.py` Top-Level Execution on Import**:
   ```powershell
   python -c "import ast; tree = ast.parse(open('main.py').read()); print([n for n in tree.body if isinstance(n, ast.If) and getattr(getattr(n.test, 'left', None), 'id', None) == '__name__'])"
   ```
   *Expected Output*: Prints `[]` (empty list confirming no `if __name__ == '__main__':` block exists).

5. **Verify Orphaned Files in `frontend/src`**:
   ```powershell
   node .\.agents\teamwork\teamwork_explorer_survey_1\find_dead_files.js
   ```
   *Expected Output*: Prints the 7 unreachable files list.

6. **Verify Frontend Build & Unit Test Health**:
   ```powershell
   cd frontend
   npm test
   npm run build
   cd ..
   ```
   *Expected Output*: 48 passed tests, build completes in < 3s with 0 errors.

7. **Invalidation Conditions**:
   - If `pytest.ini` is added and `cd backend; python -m pytest tests` passes all 44 tests, Finding 1 is invalidated.
   - If `SpeechRecognition` is present in `backend/requirements.txt`, Finding 2 is invalidated.
