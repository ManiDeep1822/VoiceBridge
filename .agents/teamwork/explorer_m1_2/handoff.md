# Handoff Report: Backend Infrastructure, Imports & SPA Fallback Analysis

**Agent**: Explorer 2 (`explorer_m1_2`)  
**Milestone**: Milestone 1 — Backend Infrastructure, Dependencies & Test Configuration  
**Date**: 2026-11-12  
**Handoff Type**: Hard (Investigation complete)

---

## 1. Observation

Direct observations and evidence gathered during the codebase investigation:

### 1.1 `backend/socket_handlers.py` Import Failures
- **File**: `backend/socket_handlers.py` (lines 6–8)
  ```python
  6: from services.translator import translate_text
  7: from services.tts import synthesize_speech
  8: from services.prosody_engine import enhance_conversational_text, classify_and_punctuate_intent, deduplicate_phrase_loops
  ```
- **File**: `backend/socket_handlers.py` (line 306)
  ```python
  305:             try:
  306:                 from services.glossary import apply_glossary_protection, restore_glossary_terms
  307:                 domain = str(data.get("domain") or "general").strip().lower()
  ...
  311:             except Exception:
  312:                 translated_text = await translate_text(enhanced_original, source_lang, target_lang)
  ```
- **Execution Test Command**:
  ```bash
  python -c "import backend.socket_handlers"
  ```
- **Verbatim Error Output**:
  ```
  Traceback (most recent call last):
    File "<string>", line 1, in <module>
      import backend.socket_handlers
    File "D:\Real Live Call Translator\backend\socket_handlers.py", line 6, in <module>
      from services.translator import translate_text
  ModuleNotFoundError: No module named 'services'
  ```
- **Consequence on Runtime / Glossary**:
  If imported directly as `backend.socket_handlers` without prior mutation of `sys.path` by `backend/main.py`:
  - Module import crashes immediately.
  - Furthermore, on line 306, `from services.glossary import ...` inside `speech_segment` raises `ModuleNotFoundError`, which is swallowed by `except Exception:` on line 311, silently disabling domain glossary protection during live calls.

---

### 1.2 Root `main.py` Unprotected Top-Level Execution
- **File**: `main.py` (lines 9–31)
  ```python
  9:  if sys.platform == "win32":
  10:     try:
  11:         sys.stdout.reconfigure(encoding="utf-8")
  12:         sys.stderr.reconfigure(encoding="utf-8")
  13:     except Exception:
  14:         pass
  15: 
  16: backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "backend"))
  17: venv_python = os.path.join(backend_dir, ".venv", "Scripts", "python.exe")
  18: 
  19: if os.path.exists(venv_python) and sys.executable.lower() != venv_python.lower():
  20:     # Relaunch using the backend virtualenv python
  21:     result = subprocess.run([venv_python, os.path.join(backend_dir, "main.py")] + sys.argv[1:])
  22:     sys.exit(result.returncode)
  23: else:
  24:     sys.path.insert(0, backend_dir)
  25:     os.chdir(backend_dir)
  26:     import uvicorn
  27:     from main import socket_app
  28: 
  29:     port = int(os.getenv("PORT", 8000))
  30:     print(f"Starting Speech Translation Server on http://0.0.0.0:{port}")
  31:     uvicorn.run(socket_app, host="0.0.0.0", port=port)
  ```
- **Execution Test Command**:
  ```bash
  python -c "import main"
  ```
- **Verbatim Tool Result**:
  Spawns Uvicorn server immediately and hangs the calling process:
  ```
  INFO:     Started server process [15640]
  INFO:     Waiting for application startup.
  INFO:     Application startup complete.
  INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
  ```
  Process did not terminate until forcefully killed via `manage_task`.
- **Consequence**:
  Any tooling, packaging system, linter, or test runner that imports `main` triggers side-effects (directory change via `os.chdir`, launching subprocess, calling `sys.exit`, or running blocking server loop).

---

### 1.3 `backend/main.py` Static Files & SPA Route Handling
- **File**: `backend/main.py` (lines 313–330)
  ```python
  313: # Mount static frontend build if present
  314: import os
  315: from fastapi.staticfiles import StaticFiles
  316: from fastapi.responses import FileResponse
  317: 
  318: frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
  319: if os.path.exists(frontend_dist):
  320:     app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")
  321: 
  322:     @app.get("/{full_path:path}")
  323:     async def serve_spa(full_path: str):
  324:         if full_path.startswith("api/") or full_path == "api":
  325:             raise HTTPException(status_code=404, detail="API endpoint not found")
  326:         file_path = os.path.abspath(os.path.join(frontend_dist, full_path))
  327:         if full_path and os.path.commonpath([frontend_dist, file_path]) == frontend_dist and os.path.isfile(file_path):
  328:             return FileResponse(file_path)
  329:         return FileResponse(os.path.join(frontend_dist, "index.html"))
  ```
- **Crash Bug in Starlette StaticFiles**:
  Tested in Python:
  ```python
  StaticFiles(directory='non_existent_dir')
  # Raises RuntimeError: Directory 'non_existent_dir' does not exist
  ```
  If `frontend/dist` exists (e.g. from `mkdir dist`) but `frontend/dist/assets` does not yet exist, line 320 unconditionally mounts `os.path.join(frontend_dist, "assets")`, which crashes the server with `RuntimeError` at startup.
- **Missing Build Behavior**:
  If `frontend_dist` does not exist:
  - Lines 319–329 are skipped completely.
  - The catch-all route `/{full_path:path}` is never registered.
  - Visiting `http://localhost:8000/` or client-side routes returns raw JSON: `{"detail":"Not Found"}` with HTTP status 404.
- **Contract with Existing Tests**:
  `backend/tests/test_fastapi_endpoints.py:120-125`:
  ```python
  def test_api_unknown_returns_404_json_not_html():
      res = client.get("/api/nonexistent_endpoint")
      assert res.status_code == 404
      assert res.headers.get("content-type", "").startswith("application/json")
      data = res.json()
      assert "detail" in data
  ```
  The fallback HTML response MUST NOT intercept routes starting with `api/` or `api`.

---

## 2. Logic Chain

1. **Import Resolution Chain**:
   - `backend/main.py` lines 6–8 modifies `sys.path` by inserting `backend_dir` at index 0.
   - When running via `python backend/main.py`, `services` is resolved because `backend_dir` is on `sys.path`.
   - However, when imported externally (e.g. `import backend.socket_handlers` from root or within test modules like `test_sockets.py`), `backend/main.py` has not run yet.
   - Therefore, `from services.translator import translate_text` in `backend/socket_handlers.py:6` looks in root for `services` and raises `ModuleNotFoundError`.
   - Adopting a dual-import fallback (`try: from services... except ImportError: from backend.services...`) mirrors `backend/tests/test_prosody_engine.py:2-15` and ensures compatibility whether `backend` is the working directory, in `sys.path`, or imported as a package from workspace root.
   - Promoting `services.glossary` to top-level try/except ensures glossary terminology protection is never silently lost due to import errors during live calls.

2. **Launcher Encapsulation Chain**:
   - In root `main.py`, executable launcher logic is located at module top-level (lines 9–31).
   - Python executes all module-level statements sequentially on import.
   - Wrapping lines 9–31 inside a dedicated `run()` function and guarding execution with `if __name__ == "__main__":` ensures that:
     - Direct CLI invocation (`python main.py`) triggers `run()`.
     - Library import (`import main`) loads definitions safely with zero side effects.

3. **SPA Fallback Chain**:
   - In `backend/main.py`, line 319 conditions the registration of `serve_spa` on `os.path.exists(frontend_dist)`.
   - Without `serve_spa`, requests to `/` have no matching endpoint, yielding FastAPI's default 404 JSON response.
   - When `serve_spa` is registered unconditionally (outside the `if os.path.exists`), it can inspect incoming requests:
     - Paths under `/api/*` raise `HTTPException(status_code=404, detail="API endpoint not found")`, preserving JSON 404 for APIs as required by `test_api_unknown_returns_404_json_not_html`.
     - If `frontend_dist/index.html` exists and is a file, it returns `FileResponse`.
     - If `frontend_dist` or `index.html` is absent, it returns `HTMLResponse` containing an informative developer dashboard.
   - Before mounting `/assets`, validating `os.path.isdir(assets_dir)` prevents Starlette `RuntimeError` crashes.

---

## 3. Caveats

1. **Python Path in pytest**: Milestone 1 Explorer 1 is configuring `pytest.ini` with `pythonpath = . backend`. The proposed fallback import in `backend/socket_handlers.py` remains crucial because standalone scripts and direct python invocations (e.g. `python -c "import backend.socket_handlers"`) do not use `pytest.ini`.
2. **Assets Mount**: If `frontend/dist/assets` is created *after* the server has already started (i.e. developer runs `npm run build` while backend is running), static assets in `/assets` will not be mounted dynamically until server restart unless the reload watcher restarts the process. Since Uvicorn runs with `reload=True` during development, this is naturally handled.
3. **HTTP Status Code for Fallback**: The HTML fallback is served with HTTP 200 rather than 404 so browsers render the developer dashboard cleanly without showing browser-level network error overlays.

---

## 4. Conclusion & Recommended Code Changes

### 4.1 Changes for `backend/socket_handlers.py`

#### Target: `backend/socket_handlers.py` (lines 6–9 and line 306)

**Before (lines 6–9):**
```python
from services.translator import translate_text
from services.tts import synthesize_speech
from services.prosody_engine import enhance_conversational_text, classify_and_punctuate_intent, deduplicate_phrase_loops
```

**Recommended Replacement (lines 6–23):**
```python
try:
    from services.translator import translate_text
    from services.tts import synthesize_speech
    from services.prosody_engine import (
        enhance_conversational_text,
        classify_and_punctuate_intent,
        deduplicate_phrase_loops,
    )
    from services.glossary import apply_glossary_protection, restore_glossary_terms
except ImportError:
    from backend.services.translator import translate_text
    from backend.services.tts import synthesize_speech
    from backend.services.prosody_engine import (
        enhance_conversational_text,
        classify_and_punctuate_intent,
        deduplicate_phrase_loops,
    )
    from backend.services.glossary import apply_glossary_protection, restore_glossary_terms
```

**Before (line 306):**
```python
            # Stage 1: Fast translation (< 200ms) with glossary terminology protection
            try:
                from services.glossary import apply_glossary_protection, restore_glossary_terms
                domain = str(data.get("domain") or "general").strip().lower()
                protected_text, _ = apply_glossary_protection(enhanced_original, domain)
                translated_raw = await translate_text(protected_text, source_lang, target_lang)
                translated_text = restore_glossary_terms(translated_raw)
            except Exception:
                translated_text = await translate_text(enhanced_original, source_lang, target_lang)
```

**Recommended Replacement:**
```python
            # Stage 1: Fast translation (< 200ms) with glossary terminology protection
            try:
                domain = str(data.get("domain") or "general").strip().lower()
                protected_text, _ = apply_glossary_protection(enhanced_original, domain)
                translated_raw = await translate_text(protected_text, source_lang, target_lang)
                translated_text = restore_glossary_terms(translated_raw)
            except Exception as e:
                logger.warning(f"Glossary-protected translation failed, falling back: {e}")
                translated_text = await translate_text(enhanced_original, source_lang, target_lang)
```

---

### 4.2 Changes for Root `main.py`

#### Target: `main.py` (lines 9–31)

**Before (lines 9–31):**
```python
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "backend"))
venv_python = os.path.join(backend_dir, ".venv", "Scripts", "python.exe")

if os.path.exists(venv_python) and sys.executable.lower() != venv_python.lower():
    # Relaunch using the backend virtualenv python
    result = subprocess.run([venv_python, os.path.join(backend_dir, "main.py")] + sys.argv[1:])
    sys.exit(result.returncode)
else:
    sys.path.insert(0, backend_dir)
    os.chdir(backend_dir)
    import uvicorn
    from main import socket_app

    port = int(os.getenv("PORT", 8000))
    print(f"Starting Speech Translation Server on http://0.0.0.0:{port}")
    uvicorn.run(socket_app, host="0.0.0.0", port=port)
```

**Recommended Replacement:**
```python
def run():
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass

    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "backend"))
    venv_python = os.path.join(backend_dir, ".venv", "Scripts", "python.exe")

    if os.path.exists(venv_python) and sys.executable.lower() != venv_python.lower():
        # Relaunch using the backend virtualenv python
        result = subprocess.run([venv_python, os.path.join(backend_dir, "main.py")] + sys.argv[1:])
        sys.exit(result.returncode)
    else:
        sys.path.insert(0, backend_dir)
        os.chdir(backend_dir)
        import uvicorn
        from main import socket_app

        port = int(os.getenv("PORT", 8000))
        print(f"Starting Speech Translation Server on http://0.0.0.0:{port}")
        uvicorn.run(socket_app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    run()
```

---

### 4.3 Changes for `backend/main.py`

#### Target: `backend/main.py` (lines 313–330)

**Before (lines 313–330):**
```python
# Mount static frontend build if present
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404, detail="API endpoint not found")
        file_path = os.path.abspath(os.path.join(frontend_dist, full_path))
        if full_path and os.path.commonpath([frontend_dist, file_path]) == frontend_dist and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
```

**Recommended Replacement:**
```python
# Mount static frontend build or fallback HTML if absent
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse

frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
assets_dir = os.path.join(frontend_dist, "assets")

if os.path.isdir(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

FALLBACK_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VoiceBridge — Backend Active</title>
    <style>
        :root {
            --bg: #090d16;
            --surface: #0f172a;
            --surface-border: #1e293b;
            --primary: #6366f1;
            --primary-glow: rgba(99, 102, 241, 0.2);
            --cyan: #06b6d4;
            --emerald: #10b981;
            --amber: #f59e0b;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --code-bg: #030712;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: var(--bg);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
        }
        .container {
            width: 100%;
            max-width: 720px;
            background: var(--surface);
            border: 1px solid var(--surface-border);
            border-radius: 1rem;
            padding: 2.25rem;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 40px var(--primary-glow);
        }
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1.5rem;
            padding-bottom: 1.25rem;
            border-bottom: 1px solid var(--surface-border);
        }
        .brand {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        .logo-icon {
            width: 36px;
            height: 36px;
            border-radius: 8px;
            background: linear-gradient(135deg, var(--primary), var(--cyan));
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 1.1rem;
        }
        .brand-title {
            font-size: 1.25rem;
            font-weight: 700;
            letter-spacing: -0.02em;
        }
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.35rem 0.85rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            background: rgba(16, 185, 129, 0.1);
            color: var(--emerald);
            border: 1px solid rgba(16, 185, 129, 0.25);
        }
        .pulse-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--emerald);
            box-shadow: 0 0 10px var(--emerald);
            animation: pulse 2s infinite ease-in-out;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.85); }
        }
        .hero {
            margin-bottom: 1.75rem;
        }
        .hero h1 {
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            color: #ffffff;
        }
        .hero p {
            color: var(--text-muted);
            line-height: 1.5;
            font-size: 0.925rem;
        }
        .notice-box {
            background: rgba(245, 158, 11, 0.08);
            border: 1px solid rgba(245, 158, 11, 0.25);
            border-radius: 0.75rem;
            padding: 1rem 1.25rem;
            margin-bottom: 1.75rem;
        }
        .notice-title {
            color: var(--amber);
            font-weight: 600;
            font-size: 0.85rem;
            margin-bottom: 0.35rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .notice-body {
            color: var(--text-muted);
            font-size: 0.85rem;
            line-height: 1.4;
        }
        .section-title {
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--cyan);
            margin-bottom: 0.75rem;
        }
        .code-block {
            background: var(--code-bg);
            border: 1px solid var(--surface-border);
            border-radius: 0.5rem;
            padding: 0.9rem 1.1rem;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 0.825rem;
            color: #38bdf8;
            margin-bottom: 1.5rem;
            overflow-x: auto;
            line-height: 1.6;
        }
        .code-comment {
            color: #64748b;
        }
        .api-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 0.75rem;
            margin-bottom: 1.75rem;
        }
        .api-card {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--surface-border);
            border-radius: 0.5rem;
            padding: 0.75rem 1rem;
            text-decoration: none;
            color: var(--text-main);
            transition: all 0.2s ease;
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
        }
        .api-card:hover {
            border-color: var(--primary);
            background: rgba(99, 102, 241, 0.05);
            transform: translateY(-2px);
        }
        .api-name {
            font-weight: 600;
            font-size: 0.85rem;
            color: #ffffff;
        }
        .api-desc {
            font-size: 0.75rem;
            color: var(--text-muted);
        }
        .footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-top: 1.25rem;
            border-top: 1px solid var(--surface-border);
            font-size: 0.8rem;
            color: var(--text-muted);
        }
        .btn-reload {
            background: var(--primary);
            color: #ffffff;
            border: none;
            padding: 0.45rem 1rem;
            border-radius: 0.375rem;
            font-weight: 500;
            font-size: 0.8rem;
            cursor: pointer;
            transition: opacity 0.2s ease;
        }
        .btn-reload:hover { opacity: 0.9; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="brand">
                <div class="logo-icon">VB</div>
                <div class="brand-title">VoiceBridge Call Translator</div>
            </div>
            <div class="status-badge">
                <span class="pulse-dot"></span>
                Backend Online
            </div>
        </div>

        <div class="hero">
            <h1>FastAPI &amp; Socket.IO Server Operational</h1>
            <p>The backend translation engine and duplex audio signaling are running. However, the production SPA client was not found in <code>frontend/dist/index.html</code>.</p>
        </div>

        <div class="notice-box">
            <div class="notice-title">Frontend Build Pending</div>
            <div class="notice-body">To view the full VoiceBridge call interface, compile the React SPA bundle or launch the Vite development server.</div>
        </div>

        <div class="section-title">Build Frontend Bundle</div>
        <div class="code-block">
            <span class="code-comment"># In a new terminal:</span><br>
            cd frontend<br>
            npm install<br>
            npm run build
        </div>

        <div class="section-title">Developer Resources &amp; APIs</div>
        <div class="api-grid">
            <a href="/docs" class="api-card">
                <span class="api-name">Swagger UI &rarr;</span>
                <span class="api-desc">Interactive REST documentation (/docs)</span>
            </a>
            <a href="/redoc" class="api-card">
                <span class="api-name">ReDoc &rarr;</span>
                <span class="api-desc">OpenAPI endpoint specifications (/redoc)</span>
            </a>
            <a href="/api/health" class="api-card">
                <span class="api-name">Health Endpoint &rarr;</span>
                <span class="api-desc">Engine status &amp; supported voice locales</span>
            </a>
            <a href="/api/rooms" class="api-card">
                <span class="api-name">Active Rooms &rarr;</span>
                <span class="api-desc">Real-time socket room participant counts</span>
            </a>
        </div>

        <div class="footer">
            <span>VoiceBridge Engine v1.0.0</span>
            <button class="btn-reload" onclick="window.location.reload()">Recheck Build</button>
        </div>
    </div>
</body>
</html>
"""

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path.startswith("api/") or full_path == "api":
        raise HTTPException(status_code=404, detail="API endpoint not found")
    
    if os.path.isdir(frontend_dist):
        try:
            file_path = os.path.abspath(os.path.join(frontend_dist, full_path))
            if full_path and os.path.commonpath([frontend_dist, file_path]) == frontend_dist and os.path.isfile(file_path):
                return FileResponse(file_path)
            index_path = os.path.join(frontend_dist, "index.html")
            if os.path.isfile(index_path):
                return FileResponse(index_path)
        except Exception:
            pass

    return HTMLResponse(content=FALLBACK_HTML, status_code=200)
```

---

## 5. Verification Method

Once implemented by the builder agent, execute the following commands to verify:

1. **Verify Package Import of Socket Handlers**:
   ```bash
   python -c "import backend.socket_handlers; print('SUCCESS: backend.socket_handlers imported cleanly')"
   ```
   *Expected outcome*: Exits with code 0 and prints success message without `ModuleNotFoundError`.

2. **Verify Module Import of Root Launcher**:
   ```bash
   python -c "import main; print('SUCCESS: main imported with zero side-effects')"
   ```
   *Expected outcome*: Exits with code 0 immediately without starting Uvicorn server or calling `sys.exit`.

3. **Verify SPA Fallback & API JSON 404 Contract**:
   ```bash
   python -c "
   from fastapi.testclient import TestClient
   from backend.main import app
   client = TestClient(app)
   res_root = client.get('/')
   assert res_root.status_code == 200
   res_api_unknown = client.get('/api/does_not_exist')
   assert res_api_unknown.status_code == 404
   assert res_api_unknown.headers.get('content-type', '').startswith('application/json')
   print('SUCCESS: SPA fallback and API 404 contracts validated')
   "
   ```
   *Expected outcome*: Exits with code 0 and confirms `/` serves HTML while `/api/*` returns JSON 404.

4. **Verify Existing Test Suites**:
   ```bash
   pytest backend/tests/test_fastapi_endpoints.py backend/tests/test_sockets.py
   ```
   *Expected outcome*: All tests pass without regressions.

---
**Invalidation Conditions**:
- If `pytest.ini` is modified to remove `pythonpath = . backend`, direct imports must continue to resolve via the `try/except ImportError` mechanism.
- If `frontend/dist` is deleted or rebuilt, the backend must transition automatically between serving the fallback HTML and the compiled SPA without restarting.
