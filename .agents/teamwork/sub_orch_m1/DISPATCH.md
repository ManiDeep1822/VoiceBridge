## 2026-11-12T16:07:46Z
You are the Sub-Orchestrator for Milestone 1: Backend Infrastructure, Dependencies & Test Configuration.
Your identity:
- Role: Sub-Orchestrator Milestone 1
- Working directory: d:\Real Live Call Translator
- State folder: d:\Real Live Call Translator\.agents\teamwork\sub_orch_m1
- Parent orchestrator conversation ID: de151cc5-bfef-411f-84f0-0486d3054afc

MANDATORY FIRST STEP:
Read the original request file at:
d:\Real Live Call Translator\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the project scope document at:
d:\Real Live Call Translator\.agents\teamwork\orchestrator\PROJECT.md

Scope of Milestone 1:
Remediate all backend configuration, dependency manifests, import paths, and TTS voice maps:
1. Create `pytest.ini` at project root with `pythonpath = . backend` and `testpaths = backend/tests` so running `pytest` works cleanly both from root and from `backend/`.
2. Create `backend/__init__.py`.
3. In `backend/socket_handlers.py`, ensure imports of `services.*` are robust whether imported as a top-level module or as `backend.socket_handlers`.
4. In `backend/requirements.txt`, add missing production dependencies `SpeechRecognition>=3.10.0` and `standard-aifc>=3.13.0` (required for `/api/stt` on Python 3.13), as well as test dependencies `pytest>=8.0.0` and `httpx>=0.27.0`.
5. In root `main.py`, wrap lines 9-31 inside `if __name__ == "__main__":` to prevent execution on import.
6. In `backend/main.py:318-330`, provide an informative HTML fallback screen when `frontend/dist` is not yet built instead of raw 404 JSON.
7. In `backend/services/tts.py:10-47`, expand `VOICE_MAP` to include full female and male Edge-TTS voice mappings for all 18 global languages supported in frontend (es, de, fr, ja, zh, ar, ru, pt, it, ko, nl, tr, id, vi, th, pl, sv, pa).

Workflow Instructions:
Follow the Project Pattern:
1. Write SCOPE.md in your state folder (`d:\Real Live Call Translator\.agents\teamwork\sub_orch_m1\SCOPE.md`).
2. Run the Iteration Loop (Explorer -> Worker -> Reviewers -> Challengers -> Forensic Auditor -> Gate).
   - In Worker dispatch, include the MANDATORY INTEGRITY WARNING verbatim:
     "DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected."
   - Worker owns backend files: `pytest.ini`, `backend/__init__.py`, `backend/socket_handlers.py`, `backend/requirements.txt`, `main.py`, `backend/main.py`, `backend/services/tts.py`.
   - Verify build and tests pass: `pytest` and `python backend/test_e2e.py`.
3. Write `handoff.md` in your state folder when complete and send a message back to the parent orchestrator (`de151cc5-bfef-411f-84f0-0486d3054afc`).
