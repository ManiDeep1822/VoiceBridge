# Milestone 1 Focus Area 1: Backend Infrastructure, Dependencies & Test Configuration Report

## 1. Observation

### 1.1 Existing Test Discovery & Pytest Execution Failure
- **Root Directory Inspection**:
  - `pytest.ini`, `setup.cfg`, and `pyproject.toml` are completely absent from the project root (`d:\Real Live Call Translator`).
  - No configuration file exists in `backend/` either.
- **Direct Pytest Invocation from Project Root**:
  Command executed: `pytest`
  Result: Exit code 1 (Interrupted: 4 collection errors out of 44 tests).
  Verbatim output:
  ```
  collected 10 items / 4 errors

  =================================== ERRORS ====================================
  __________ ERROR collecting backend/tests/test_fastapi_endpoints.py ___________
  ImportError while importing test module 'D:\Real Live Call Translator\backend\tests\test_fastapi_endpoints.py'.
  Traceback:
  backend\tests\test_fastapi_endpoints.py:3: in <module>
      from backend.main import app
  E   ModuleNotFoundError: No module named 'backend'
  _______________ ERROR collecting backend/tests/test_sockets.py ________________
  ImportError while importing test module 'D:\Real Live Call Translator\backend\tests\test_sockets.py'.
  Traceback:
  backend\tests\test_sockets.py:8: in <module>
      from backend.main import socket_app
  E   ModuleNotFoundError: No module named 'backend'
  ______________ ERROR collecting backend/tests/test_translator.py ______________
  ImportError while importing test module 'D:\Real Live Call Translator\backend\tests\test_translator.py'.
  Traceback:
  backend\tests\test_translator.py:4: in <module>
      from backend.services.translator import translate_text, _sanitize_translation, _TRANSLATION_CACHE
  E   ModuleNotFoundError: No module named 'backend'
  _________________ ERROR collecting backend/tests/test_tts.py __________________
  ImportError while importing test module 'D:\Real Live Call Translator\backend\tests\test_tts.py'.
  Traceback:
  backend\tests\test_tts.py:4: in <module>
      from backend.services.tts import synthesize_speech, get_voice, VOICE_MAP
  E   ModuleNotFoundError: No module named 'backend'
  ```
- **Direct Pytest Invocation from `backend/`**:
  Command executed: `cd backend; pytest; cd ..`
  Result: Exit code 1 (Same 4 collection errors).
  Verbatim output:
  ```
  collected 10 items / 4 errors
  ERROR tests/test_fastapi_endpoints.py - ModuleNotFoundError: No module named 'backend'
  ERROR tests/test_sockets.py - ModuleNotFoundError: No module named 'backend'
  ERROR tests/test_translator.py - ModuleNotFoundError: No module named 'backend'
  ERROR tests/test_tts.py - ModuleNotFoundError: No module named 'backend'
  ```
- **Import Statements in Existing Tests**:
  - `backend/tests/test_fastapi_endpoints.py:3`: `from backend.main import app`
  - `backend/tests/test_sockets.py:8-9`:
    ```python
    from backend.main import socket_app
    from backend.socket_handlers import rooms, sid_to_room, socket_activity
    ```
  - `backend/tests/test_translator.py:4`:
    ```python
    from backend.services.translator import translate_text, _sanitize_translation, _TRANSLATION_CACHE
    ```
  - `backend/tests/test_tts.py:4`:
    ```python
    from backend.services.tts import synthesize_speech, get_voice, VOICE_MAP
    ```
  - `backend/tests/test_prosody_engine.py:2-15`:
    Uses defensive try/except:
    ```python
    try:
        from backend.services.prosody_engine import (...)
    except ImportError:
        from services.prosody_engine import (...)
    ```
    (This is why `test_prosody_engine.py` was the sole test module that did not throw a collection error when `backend` was missing).

### 1.2 Package Structure & Missing `backend/__init__.py`
- Tool check: `Test-Path .\backend\__init__.py` returned `False`.
- Tool check: `Test-Path .\backend\services\__init__.py` returned `True` (file length: 19 bytes).
- Tool check: `Test-Path .\backend\tests\__init__.py` returned `False`.
- `backend/` currently functions only as a PEP 420 implicit namespace directory rather than a traditional Python package.

### 1.3 `backend/requirements.txt` Inspection & Python 3.13 Compatibility
- **Current File Contents** (`backend/requirements.txt` lines 1-9):
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
- **Codebase Dependency Usages**:
  1. `backend/main.py:239`: `import speech_recognition as sr` in `handle_stt()`.
  2. `backend/tests/test_fastapi_endpoints.py:68-75`: calls `/api/stt` endpoint exercising `handle_stt()`.
  3. `backend/tests/test_fastapi_endpoints.py:2`: `from fastapi.testclient import TestClient` (requires `httpx`).
  4. All test suites in `backend/tests/`: require `pytest`.
- **Python 3.13 `aifc` Removal (PEP 594)**:
  - Runtime environment: Python 3.13.10 on Windows (`C:\Program Files\Python313\python.exe`).
  - In Python 3.13, PEP 594 ("Removing dead batteries from the standard library") permanently eliminated the built-in `aifc` module.
  - `SpeechRecognition` (`speech_recognition/__init__.py:7`) contains the unconditional import `import aifc`.
  - When running tests on Python 3.13 with `standard-aifc` installed, pytest emits:
    ```
    DeprecationWarning: aifc was removed in Python 3.13. Please be aware that you are currently NOT using standard 'aifc', but instead a separately installed 'standard-aifc'.
      import aifc
    ```
  - Without `standard-aifc>=3.13.0` installed in the Python environment, importing `speech_recognition` on Python 3.13 immediately raises:
    `ModuleNotFoundError: No module named 'aifc'`.
  - Neither `SpeechRecognition`, `standard-aifc`, `pytest`, nor `httpx` is currently declared in `backend/requirements.txt`.

### 1.4 Socket Handlers Standalone Import Defect
- Command executed: `python -c "import backend.socket_handlers"`
- Result: Exit code 1.
- Verbatim traceback:
  ```
  Traceback (most recent call last):
    File "<string>", line 1, in <module>
      import backend.socket_handlers
    File "D:\Real Live Call Translator\backend\socket_handlers.py", line 6, in <module>
      from services.translator import translate_text
  ModuleNotFoundError: No module named 'services'
  ```
- Line numbers in `backend/socket_handlers.py:6-8`:
  ```python
  from services.translator import translate_text
  from services.tts import synthesize_speech
  from services.prosody_engine import enhance_conversational_text, classify_and_punctuate_intent, deduplicate_phrase_loops
  ```

---

## 2. Logic Chain

1. **Observation 1.1 → Root Cause of Pytest Failure**:
   `backend/tests/test_fastapi_endpoints.py`, `test_sockets.py`, `test_translator.py`, and `test_tts.py` all import modules using `from backend.main import ...` and `from backend.services...`.
   When `pytest` is invoked directly from the CLI without arguments or configuration:
   - Pytest does NOT place the current working directory onto `sys.path`.
   - In Python's import system, `backend` is a subfolder of the workspace root.
   - Because neither the workspace root nor `backend` is on `sys.path`, Python fails to find top-level module `backend`, causing `ModuleNotFoundError: No module named 'backend'` during test collection.

2. **Observation 1.1 → Root Cause of `cd backend; pytest` Failure**:
   When pytest is invoked from inside `backend/`:
   - If cwd is `backend/`, the parent folder (which contains `backend`) is definitely NOT on `sys.path`.
   - Therefore, any statement `from backend.xxx import yyy` fails because Python expects a directory named `backend` inside one of the `sys.path` entries.

3. **Pytest Behavior with `pytest.ini`**:
   Creating `pytest.ini` at the project root with:
   ```ini
   [pytest]
   pythonpath = . backend
   testpaths = backend/tests
   ```
   resolves both execution patterns:
   - When run from project root (`pytest`):
     - `rootdir` is set to the project root.
     - `pythonpath = . backend` adds both `.` (workspace root) and `backend` (`workspace_root/backend`) to `sys.path`.
     - `testpaths = backend/tests` ensures only the backend test suite is targeted.
     - `from backend.main import ...` succeeds because `.` is on `sys.path`.
     - Any bare `from services...` import also succeeds because `backend` is on `sys.path`.
   - When run from inside `backend/` (`cd backend; pytest`):
     - Pytest automatically traverses parent directories searching for a configuration file, discovering `..\pytest.ini`.
     - Pytest anchors `rootdir` to `d:\Real Live Call Translator`.
     - Pytest resolves `pythonpath = . backend` relative to `rootdir`, adding workspace root and `backend/` to `sys.path`.
     - Pytest evaluates `testpaths = backend/tests` relative to `rootdir`.
     - Result: Tested via `-o pythonpath=". backend"` and passed all 44 tests cleanly (exit code 0).

4. **Observation 1.2 → Package Integrity**:
   Creating `backend/__init__.py` explicitly converts `backend` into a standard Python package. This eliminates ambiguity for IDEs, typecheckers, linters, and packaging scripts, ensuring `backend` is consistently treated as a package regardless of PEP 420 namespace traversal rules.

5. **Observation 1.3 → Missing Requirements & Python 3.13 STT Vulnerability**:
   - `SpeechRecognition>=3.10.0` is required for `/api/stt` (`handle_stt()` in `backend/main.py:239`).
   - On Python 3.13, standard library `aifc` was removed under PEP 594. `speech_recognition` contains an unconditional `import aifc` at line 7 of its `__init__.py`. Without `standard-aifc>=3.13.0`, any environment initialized with Python 3.13 will crash upon attempting to import `speech_recognition`.
   - `pytest>=8.0.0` is required for running the backend test suite and supports `pythonpath` config.
   - `httpx>=0.27.0` is required for `fastapi.testclient.TestClient`.
   - Declaring all 4 packages in `backend/requirements.txt` guarantees reproducible installs across any fresh clone or deployment target.

6. **Observation 1.4 → Robust Socket Handlers Import**:
   `backend/socket_handlers.py:6-8` uses bare imports (`from services.translator import ...`). When imported in a package context (`from backend.socket_handlers import ...`) without `backend` on `sys.path`, it crashes with `ModuleNotFoundError: No module named 'services'`. Implementing a fallback pattern matching `test_prosody_engine.py`:
   ```python
   try:
       from backend.services.translator import translate_text
       from backend.services.tts import synthesize_speech
       from backend.services.prosody_engine import enhance_conversational_text, classify_and_punctuate_intent, deduplicate_phrase_loops
   except ImportError:
       from services.translator import translate_text
       from services.tts import synthesize_speech
       from services.prosody_engine import enhance_conversational_text, classify_and_punctuate_intent, deduplicate_phrase_loops
   ```
   allows `backend.socket_handlers` to be imported cleanly both as a top-level package member and from within `backend/`.

---

## 3. Caveats

1. **Virtual Environments Status**:
   - A virtual environment exists at `.\venv`, but packages (`SpeechRecognition`, `httpx`) have not been installed into it yet.
   - A folder `.\backend\.venv` exists, but its Python executable lacks `pip`.
   - The active development machine uses Python 3.13.10 installed in `C:\Program Files\Python313\`, where `SpeechRecognition 3.14.3`, `standard-aifc 3.13.0`, `pytest 9.1.1`, and `httpx 0.28.1` are currently present in user site-packages.
   - Any new virtual environment created will require running `pip install -r backend/requirements.txt`.
2. **Out of Scope for Explorer 1**:
   - Global voice map expansion (`backend/services/tts.py`) and SPA fallback page (`backend/main.py`) are allocated under other focus tracks of Milestone 1.

---

## 4. Conclusion

The test discovery failure, package structure gap, and dependency omissions can be completely remediated with surgical changes across 3 files:

### 4.1 Create `pytest.ini` at Project Root (`d:\Real Live Call Translator\pytest.ini`)
Exact contents:
```ini
[pytest]
pythonpath = . backend
testpaths = backend/tests
```

### 4.2 Create `backend/__init__.py` (`d:\Real Live Call Translator\backend\__init__.py`)
Exact contents:
```python
"""VoiceBridge backend package."""
```

### 4.3 Update `backend/requirements.txt` (`d:\Real Live Call Translator\backend\requirements.txt`)
Exact contents:
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
SpeechRecognition>=3.10.0
standard-aifc>=3.13.0
pytest>=8.0.0
httpx>=0.27.0
```

### 4.4 Update `backend/socket_handlers.py` Lines 6-8
Update bare imports to dual fallback pattern:
```python
try:
    from backend.services.translator import translate_text
    from backend.services.tts import synthesize_speech
    from backend.services.prosody_engine import enhance_conversational_text, classify_and_punctuate_intent, deduplicate_phrase_loops
except ImportError:
    from services.translator import translate_text
    from services.tts import synthesize_speech
    from services.prosody_engine import enhance_conversational_text, classify_and_punctuate_intent, deduplicate_phrase_loops
```

---

## 5. Verification Method

To independently verify these conclusions and validate the remediations once implemented:

### Command 1: Pytest from Project Root
```powershell
pytest
```
- **Expected Result**: Exit code 0, 44 passed tests collected from `backend/tests/`.
- **Invalidation Condition**: Any collection error or `ModuleNotFoundError: No module named 'backend'`.

### Command 2: Pytest from `backend/` Subdirectory
```powershell
cd backend
pytest
cd ..
```
- **Expected Result**: Exit code 0, 44 passed tests collected from `backend/tests/`.
- **Invalidation Condition**: Any collection error or failure to locate `pytest.ini`.

### Command 3: Package Structure Verification
```powershell
python -c "import backend; print(backend.__file__)"
```
- **Expected Result**: Outputs path ending with `backend\__init__.py` without error.

### Command 4: Direct Import of Socket Handlers
```powershell
python -c "import backend.socket_handlers; print('Socket handlers imported successfully')"
```
- **Expected Result**: Prints `Socket handlers imported successfully` without `ModuleNotFoundError: No module named 'services'`.

### Command 5: SpeechRecognition & Python 3.13 Compatibility Verification
```powershell
python -c "import speech_recognition as sr, aifc; print('STT & aifc compatibility ready')"
```
- **Expected Result**: Prints `STT & aifc compatibility ready` without `ModuleNotFoundError: No module named 'aifc'`.
