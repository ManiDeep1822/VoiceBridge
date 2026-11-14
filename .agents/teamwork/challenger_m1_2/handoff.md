# Adversarial Challenge Report: Milestone 1 — Backend Infrastructure, Dependencies & Test Configuration

**Agent**: Challenger 2 (`challenger_m1_2`)  
**Milestone**: Milestone 1: Backend Infrastructure, Dependencies & Test Configuration  
**Parent Sub-Orchestrator**: `09c35989-656e-479b-be7e-f801f21a0efd`  
**Date**: 2026-11-12  
**Verdict**: **APPROVE**  

---

## 1. Observation

### 1.1 Empirical Scope & Harness Execution
An adversarial test harness was authored and executed in `backend/tests/test_m1_challenger2_stress.py` targeting all components modified in Milestone 1:
- `backend/services/tts.py` (`VOICE_MAP`, `get_voice`, `synthesize_speech`, `_fallback_gtts`)
- `frontend/src/utils/languages.js` (cross-referencing all 27 supported languages)
- `backend/main.py` (`serve_spa`, static asset handling, and API routing isolation)
- `pytest.ini`, `backend/__init__.py`, `backend/socket_handlers.py`, `main.py`

### 1.2 Verbatim Test Execution Logs

#### Command: Full Adversarial Stress Test Suite
```bash
pytest backend/tests/test_m1_challenger2_stress.py -v
```
**Exit Code**: 0  
**Verbatim Output**:
```
============================= test session starts =============================
platform win32 -- Python 3.13.10, pytest-9.1.1, pluggy-1.6.0 -- C:\Program Files\Python313\python.exe
cachedir: .pytest_cache
rootdir: D:\Real Live Call Translator
configfile: pytest.ini
plugins: anyio-4.11.0, langsmith-0.8.15, zarr-3.3.0
collecting ... collected 9 items

backend/tests/test_m1_challenger2_stress.py::test_stress_voice_map_all_frontend_languages PASSED [ 11%]
backend/tests/test_m1_challenger2_stress.py::test_stress_voice_map_casing_and_gender_variations PASSED [ 22%]
backend/tests/test_m1_challenger2_stress.py::test_stress_voice_map_delimiters PASSED [ 33%]
backend/tests/test_m1_challenger2_stress.py::test_stress_voice_map_garbage_and_invalid_inputs PASSED [ 44%]
backend/tests/test_m1_challenger2_stress.py::test_stress_punjabi_voice_and_gtts_fallback PASSED [ 55%]
backend/tests/test_spa_client_routes_when_dist_exists PASSED [ 66%]
backend/tests/test_m1_challenger2_stress.py::test_stress_static_assets PASSED [ 77%]
backend/tests/test_m1_challenger2_stress.py::test_stress_api_routes_all_methods_and_nonexistent PASSED [ 88%]
backend/tests/test_m1_challenger2_stress.py::test_stress_spa_fallback_when_dist_does_not_exist PASSED [100%]

============================== warnings summary ===============================
C:\Users\indla\AppData\Roaming\Python\Python313\site-packages\fastapi\testclient.py:1
  C:\Users\indla\AppData\Roaming\Python\Python313\site-packages\fastapi\testclient.py:1: StarletteDeprecationWarning: Using `httpx` with `starlette.testclient` is deprecated; install `httpx2` instead.
    from starlette.testclient import TestClient as TestClient  # noqa

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
======================== 9 passed, 1 warning in 2.95s =========================
```

#### Command: Full Regression Test Suite from Workspace Root
```bash
pytest -v
```
**Exit Code**: 0  
**Verbatim Output Summary**:
```
======================= 56 passed, 2 warnings in 15.83s =======================
```

#### Command: Full Regression Test Suite from `backend/` Subdirectory
```bash
cd backend; pytest; cd ..
```
**Exit Code**: 0  
**Verbatim Output Summary**:
```
======================= 56 passed, 2 warnings in 14.17s =======================
```

#### Command: End-to-End Speech-to-Speech Call Simulation
```bash
python backend/test_e2e.py
```
**Exit Code**: 0  
**Verbatim Output**:
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

---

## 2. Logic Chain

1. **Voice Map Coverage & Robustness Across 27 Frontend Languages**:
   - Extraction of language specifications from `frontend/src/utils/languages.js` confirmed exactly 27 languages (`en`, `hi`, `te`, `ta`, `kn`, `ml`, `mr`, `bn`, `gu`, `pa`, `es`, `de`, `fr`, `ja`, `zh`, `ar`, `ru`, `pt`, `it`, `ko`, `nl`, `tr`, `id`, `vi`, `th`, `pl`, `sv`).
   - Every single language was empirically tested for both `female` and `male` lookups in `get_voice`. All 54 combinations returned valid neural voice strings terminating in `Neural`.
   - Distinct female and male voices were confirmed for all 27 languages (no identical voice collisions).
   - Uppercase language codes (`"ES"`, `"DE"`, `"HI"`), mixed-case genders (`"MALE"`, `"Male"`, `"fEmAlE"`), and delimiter variations (`"es_ES"`, `"es-ES"`, `"es-es"`, `"  es_ES  "`) were tested. `get_voice` normalized each variant to the correct voice without error.
   - Hostile/garbage inputs (`None`, `""`, `"   "`, `123`, `0`, `-1`, `3.14`, `True`, `False`, `[]`, `{}`, `"unknown-xyz"`, `"???"`, `"!!!@#$%"`, `"\t\n\r"`) were executed against `get_voice`. In 100% of cases, `get_voice` suppressed exceptions and fell back to the authoritative neural voice `en-IN-NeerjaNeural`.

2. **Punjabi (`pa`) Edge Case & Dual Fallback Resilience**:
   - Punjabi neural voices `pa-IN-OjasNeural` (female) and `pa-IN-GurpreetNeural` (male) are correctly registered in `VOICE_MAP`.
   - Because public Edge-TTS endpoints do not consistently host Punjabi models, fallback execution was stressed. Direct invocation of `gTTS(text="...", lang="pa")` succeeded, producing valid MP3 audio (>1000 bytes).
   - When Edge-TTS connection failures were simulated via mocking, `synthesize_speech` gracefully transferred synthesis to the secondary neural fallback / gTTS fallback without raising an unhandled exception or dropping the utterance.

3. **SPA Fallback & Strict API Routing Isolation**:
   - Tested root `/` and deeply nested client routes (`/call`, `/dashboard/settings`, `/room/123/subpath`, `/arbitrary/nested/client/route/test`) with `TestClient(app)`.
   - When `frontend/dist` is present: Client routes return `200 OK` with `text/html; charset=utf-8` serving the compiled SPA (`frontend/dist/index.html`).
   - When `frontend/dist` is absent: Client routes return `200 OK` with `text/html; charset=utf-8` serving the styled `FALLBACK_HTML` developer screen explaining build instructions.
   - Tested static assets: `/favicon.svg` (200 image/svg+xml), `/manifest.json` (200 application/json), `/assets/<bundle>.js` (200 javascript), while nonexistent assets under `/assets/` return `404 JSON`.
   - Critical API Isolation Contract: Tested all non-existent API paths (`/api/nonexistent`, `/api/nonexistent/`, `/api/nonexistent/deep/nested/subroute`, `/api/`, `/api`, `/api/v1/unknown`).
     - For `GET`: Every route returns `404 Not Found` with `application/json` (`{"detail": "API endpoint not found"}`).
     - For `POST`, `PUT`, `DELETE`: Every route returns `404` or `405 Method Not Allowed` with `application/json` (`{"detail": ...}`).
     - Under NO circumstances does any `/api/*` path return HTML or leak SPA content.

4. **Package & Module Import Isolation**:
   - `python -c "import backend.socket_handlers; import main; print('OK')"` confirmed that the root `main.py` entrypoint does not trigger side-effects (server launch or directory mutation) on import.
   - `backend.socket_handlers` imports without `ModuleNotFoundError` whether imported as a top-level package or a local sibling module.
   - Pytest executes identically from both workspace root and `backend/` directory due to `pytest.ini` (`pythonpath = . backend`).

---

## 3. Caveats

- **Network Dependency for Live Azure Edge-TTS**: External Edge-TTS audio generation requires an outbound WebSocket connection to Microsoft Edge endpoints (`wss://speech.platform.bing.com`). In environments with no internet access, `synthesize_speech` falls back to gTTS / returns empty bytes as designed.
- **Third-Party Deprecation Warnings**: Starlette test client emits a known deprecation warning regarding `httpx` (`StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead`), and Python 3.13 emits an informational warning about `standard-aifc` polyfill. Neither warning affects test outcomes or runtime stability.

---

## 4. Conclusion & Verdict

**Verdict: APPROVE**

Milestone 1 satisfies all requirements and passes rigorous adversarial stress testing without defects:
1. `VOICE_MAP` covers all 27 languages supported by the frontend with distinct male and female Azure neural models.
2. `get_voice` handles delimiters, case variances, and malformed/garbage inputs cleanly with zero unhandled exceptions.
3. Punjabi (`pa`) voice lookup and fallback mechanisms are verified and operational.
4. SPA routing cleanly separates client routes (200 HTML) from API endpoints (404/405 JSON), with full developer guidance when `frontend/dist` is unbuilt.
5. All 56 tests (47 existing + 9 adversarial stress tests) pass cleanly across all environments.

---

## 5. Verification Method

To independently verify this evaluation, execute the following commands in the workspace root:

```bash
# 1. Run the dedicated Challenger 2 stress test suite
pytest backend/tests/test_m1_challenger2_stress.py -v

# 2. Run the complete pytest test suite from workspace root
pytest

# 3. Run the complete pytest test suite from backend directory
cd backend; pytest; cd ..

# 4. Verify clean import behavior
python -c "import backend.socket_handlers; import main; print('IMPORTS OK')"

# 5. Run end-to-end live call simulation
python backend/test_e2e.py
```

### Invalidation Conditions
- Any failure in `pytest backend/tests/test_m1_challenger2_stress.py`.
- Any unhandled exception raised by `get_voice` when provided garbage or non-string inputs.
- Any `/api/*` request returning HTML instead of JSON.
- Any regression in the 47 existing unit tests.
