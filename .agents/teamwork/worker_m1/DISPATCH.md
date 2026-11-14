## 2026-11-12T16:19:23Z

You are the Worker for Milestone 1: Backend Infrastructure, Dependencies & Test Configuration.

Working directory: d:\Real Live Call Translator
State folder: d:\Real Live Call Translator\.agents\teamwork\worker_m1

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY FIRST STEP:
Read the following files:
1. d:\Real Live Call Translator\.agents\teamwork\ORIGINAL_REQUEST.md
2. d:\Real Live Call Translator\.agents\teamwork\orchestrator\PROJECT.md
3. d:\Real Live Call Translator\.agents\teamwork\sub_orch_m1\SCOPE.md
4. d:\Real Live Call Translator\.agents\teamwork\sub_orch_m1\WORKER_DIRECTIVE.md
5. Explorer handoffs:
   - d:\Real Live Call Translator\.agents\teamwork\explorer_m1_1\handoff.md
   - d:\Real Live Call Translator\.agents\teamwork\explorer_m1_2\handoff.md
   - d:\Real Live Call Translator\.agents\teamwork\explorer_m1_3\handoff.md

Files You Own Exclusively:
- `pytest.ini` (project root)
- `backend/__init__.py`
- `backend/requirements.txt`
- `backend/socket_handlers.py`
- `main.py` (project root)
- `backend/main.py`
- `backend/services/tts.py`
- `backend/tests/test_tts.py`

Tasks to Implement:
1. Create `pytest.ini` at project root with:
   [pytest]
   pythonpath = . backend
   testpaths = backend/tests
2. Create `backend/__init__.py`.
3. In `backend/requirements.txt`, append missing dependencies `SpeechRecognition>=3.10.0`, `standard-aifc>=3.13.0`, `pytest>=8.0.0`, and `httpx>=0.27.0`.
4. In `backend/socket_handlers.py`, replace bare imports at lines 6-8 with the robust fallback pattern (importing from `services.*` or `backend.services.*`), and promote `glossary` imports so live calls don't drop glossary protection.
5. In root `main.py`, encapsulate top-level execution inside a `run()` function guarded by `if __name__ == "__main__":` to prevent execution on import.
6. In `backend/main.py`:
   - Safely mount `/assets` only if `frontend/dist/assets` is a directory.
   - Serve a responsive, styled developer fallback HTML page when `frontend/dist/index.html` is not present, while ensuring `/api/*` requests still return 404 JSON.
7. In `backend/services/tts.py`:
   - Expand `VOICE_MAP` to include all 27 languages (18 global + 9 Indian), with female and male voices.
   - Enhance `get_voice` to handle delimiter normalization (`_` to `-`) and full BCP-47 tag matching.
   - Update `_fallback_gtts` so that `code` is checked against `VOICE_MAP` instead of the old 9-language tuple.
8. In `backend/tests/test_tts.py`:
   - Add unit test coverage for global languages, male voices, underscore normalization, and case insensitivity.

Mandatory Verification:
You MUST run the following commands and include full command output in your handoff report:
1. `pytest` from workspace root (must collect and pass all tests, exit code 0).
2. `pytest` from `backend/` directory (must pass all tests, exit code 0).
3. `python -c "import backend.socket_handlers; print('OK')"`
4. `python -c "import main; print('OK')"`
5. `python backend/test_e2e.py` (must pass exit code 0).

Output:
Write a comprehensive 5-component `handoff.md` in `d:\Real Live Call Translator\.agents\teamwork\worker_m1\handoff.md`.
Send a completion message via send_message to the parent sub-orchestrator.
