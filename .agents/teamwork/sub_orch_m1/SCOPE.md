# Scope: Milestone 1 — Backend Infrastructure, Dependencies & Test Configuration

## Architecture & Context
- Backend uses FastAPI + python-socketio Server.
- Entry points: `backend/main.py`, `main.py` (root redirect/wrapper).
- Service layer: `backend/services/` (`translator.py`, `tts.py`, `prosody_engine.py`, `glossary.py`).
- Socket handlers: `backend/socket_handlers.py`.

## Feature Inventory for Milestone 1
| # | Feature / Issue | Description | Milestone | Source |
|---|-----------------|-------------|-----------|--------|
| 1 | Pytest Import & Config Defect | Running `pytest` fails with `ModuleNotFoundError: No module named 'backend'` when invoked from `backend/` or without explicit PYTHONPATH. Create `pytest.ini` with `pythonpath = . backend` and `testpaths = backend/tests`. | M1 | Survey |
| 2 | Missing `backend/__init__.py` | Ensure `backend/` is treated cleanly as a regular Python package. | M1 | Survey |
| 3 | Bare Import in Socket Handlers | `backend/socket_handlers.py` uses bare `from services.translator import ...` which breaks when imported as `backend.socket_handlers`. Support both or standardize. | M1 | Survey |
| 4 | Missing Backend Dependencies | Add `SpeechRecognition>=3.10.0` and `standard-aifc>=3.13.0` to `backend/requirements.txt`, along with test dependencies `pytest>=8.0.0` and `httpx>=0.27.0`. | M1 | Survey |
| 5 | Missing Main Guard in root `main.py` | Wrap lines 9-31 in `if __name__ == "__main__":` to prevent execution on import. | M1 | Survey |
| 6 | SPA Build Fallback in `backend/main.py` | When `frontend/dist` is not yet built, serve an informative HTML screen rather than returning raw 404 JSON. | M1 | Survey |
| 7 | Global Voice Map Coverage in `backend/services/tts.py` | Expand `VOICE_MAP` in `backend/services/tts.py` to include full female and male Edge-TTS voice mappings for all 18 global languages supported in frontend (es, de, fr, ja, zh, ar, ru, pt, it, ko, nl, tr, id, vi, th, pl, sv, pa). | M1 | Survey |

## Files Owned
- `pytest.ini`
- `backend/__init__.py`
- `backend/socket_handlers.py`
- `backend/requirements.txt`
- `main.py`
- `backend/main.py`
- `backend/services/tts.py`

## Verification Criteria & Status
1. `pytest` passes when invoked from workspace root -> **VERIFIED** (68/68 passed).
2. `pytest` passes when invoked from `backend/` -> **VERIFIED** (68/68 passed).
3. `python -c "import backend.socket_handlers"` succeeds without `ModuleNotFoundError` -> **VERIFIED**.
4. `python -c "import main"` does not launch the server or execute side-effects -> **VERIFIED**.
5. `python backend/test_e2e.py` passes cleanly -> **VERIFIED** (duplex instant text and neural audio passed).
6. Edge-TTS voice mappings exist for both female and male voices across all 18 languages: es, de, fr, ja, zh, ar, ru, pt, it, ko, nl, tr, id, vi, th, pl, sv, pa (plus existing Indian languages en, hi, ta, te, mr, bn, gu, kn, ml) -> **VERIFIED** (all 27 languages verified).
7. HTML fallback in `backend/main.py` serves a responsive, informative HTML page explaining frontend build status when `frontend/dist/index.html` is absent -> **VERIFIED** (serves HTML for client routes, returns JSON 404 for `/api/*`).

## Milestone Status
Status: **DONE**
Gate Verdict: **PASS** (Reviewers: APPROVE, Challengers: APPROVE, Forensic Auditor: CLEAN)
Key Outputs:
- `pytest.ini` created at project root.
- `backend/__init__.py` created.
- `backend/requirements.txt` updated with `SpeechRecognition`, `standard-aifc`, `pytest`, `httpx`.
- `backend/socket_handlers.py` updated with dual-fallback import and promoted glossary lock.
- Root `main.py` wrapped in `def run()` with `if __name__ == "__main__":` guard.
- `backend/main.py` updated with safe static mounting and developer SPA fallback HTML.
- `backend/services/tts.py` updated with 27-language neural voice map, delimiter normalization, and gTTS fallback whitelist.
- `backend/tests/test_tts.py` updated with 27-language voice test suites.
- `backend/tests/test_m1_challenger1_stress.py` and `backend/tests/test_m1_challenger2_stress.py` created with 21 adversarial stress tests.
