## 2026-11-12T16:51:41Z
You are the Worker for Milestone 3: Reproduction Tests & Documentation Synchronization.

MANDATORY FIRST STEP:
Read the original request file at:
d:\Real Live Call Translator\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the project scope document at:
d:\Real Live Call Translator\.agents\teamwork\orchestrator\PROJECT.md
Also read Milestone 3 scope at:
d:\Real Live Call Translator\.agents\teamwork\sub_orch_m3\SCOPE.md
Also read Explorer handoff reports at:
d:\Real Live Call Translator\.agents\teamwork\explorer_m3_1\handoff.md
d:\Real Live Call Translator\.agents\teamwork\explorer_m3_2\handoff.md
d:\Real Live Call Translator\.agents\teamwork\explorer_m3_3\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Identity & Folders:
- Role: Reproduction Test Worker
- Working directory: d:\Real Live Call Translator
- State folder: d:\Real Live Call Translator\.agents\teamwork\worker_m3_1

File Ownership (You exclusively own these files):
- `backend/tests/test_tts.py`
- `backend/tests/test_sockets.py`
- `backend/tests/test_imports.py` (new)
- `backend/tests/test_prosody_engine.py`
- `frontend/tests/prosody.test.js`
- `README.md`

Tasks to Implement:
1. `backend/tests/test_tts.py`:
   - Add `test_get_voice_all_27_languages_both_genders`: Loop through all 27 language keys in `VOICE_MAP`. Assert `get_voice(lang, "female")` and `get_voice(lang, "male")` return Azure neural voices ending with `"Neural"`, and `female != male`.
   - Add `test_get_voice_regional_bcp47_fallback`: Test regional BCP-47 locale tags that fall back to 2-letter base (`"hi-IN" -> "hi"`, `"te-IN" -> "te"`, `"ta-IN" -> "ta"`, `"bn-IN" -> "bn"`, `"en-US" -> "en"`, `"es-MX" -> "es"`, `"fr-CA" -> "fr"`, `"pt-BR" -> "pt"`, `"de-AT" -> "de"`, `"zh-TW" -> "zh"`), testing casing variations and delimiters (`_` vs `-`).
2. `backend/tests/test_sockets.py`:
   - Add `test_speech_segment_preserves_domain_and_applies_glossary(live_server)`: Emit `speech_segment` with `domain: "medical"` and medical term ("heart attack" -> "myocardial infarction"), and `domain: "fintech"` ("operating profit" -> "EBITDA margin"). Verify received `translatedText` reflects locked domain jargon.
   - Add `test_speech_segment_domain_default_and_fallback(live_server)`: Emit without `domain` (verifying default `"general"`), and with unknown domain (verifying graceful fallback to standard translation without dropping).
3. `backend/tests/test_imports.py` (create new test file):
   - `test_import_backend_socket_handlers`: in-process and subprocess isolated `python -E -c "import backend.socket_handlers; print('OK')"`
   - `test_import_backend_main`: in-process and subprocess isolated `python -E -c "import backend.main; assert hasattr(backend.main, 'app'); print('OK')"`
   - `test_import_root_main_no_side_effects`: subprocess isolated `python -E -c "import main; assert callable(main.run); print('OK')"`
   - `test_import_sibling_from_backend_cwd`: subprocess with `cwd="backend"` running `python -E -c "import socket_handlers; import main; print('OK')"`
4. `backend/tests/test_prosody_engine.py`:
   - Add `test_classify_and_punctuate_hindi_exclamations`: Test Hindi urgency keywords ("जल्दी", "तुरंत", "रुको", "बचाओ", "मदद", "शाबाश") verifying `intent == "exclamation"` and terminal `"!"`.
5. `frontend/tests/prosody.test.js`:
   - Add test cases verifying Hindi urgency detection with BCP-47 locale `'hi-IN'` and sentence-embedded urgent terms (e.g. `'कृपया जल्दी आइए'`).
6. Run tests to determine exact counts:
   - Run `pytest` and `cd backend; pytest`
   - Run `npm --prefix frontend test` and `cd frontend; npm test`
   - Note exact test counts passing!
7. Update `README.md` lines 65-86:
   - Modernize the Verification & Test Suite section following Explorer 3's blueprint (`explorer_m3_3/handoff.md § 4.2`).
   - Reflect the EXACT verified test counts for both backend and frontend.
   - Provide both root commands (`pytest`, `npm --prefix frontend test`, `npm --prefix frontend run build`, tooling scripts) and subdirectory commands (`cd backend; pytest`, etc.).
8. Verify everything:
   - Run `pytest`
   - Run `npm --prefix frontend test`
   - Run `npm --prefix frontend run build`

Deliverable:
Write a comprehensive handoff report to `d:\Real Live Call Translator\.agents\teamwork\worker_m3_1\handoff.md` detailing:
- All modified and created files
- Exact test commands run and exact test counts
- Verification results
Then send a completion message to your orchestrator.


## 2026-11-12T17:01:18Z
**Context**: Milestone 3 Worker Progress
**Content**: Heartbeat check. Please provide a brief status update on your progress through Tasks 1-7 (test expansions in backend/frontend, test runs, and README.md synchronization).
**Action**: Reply with your current task status or complete your handoff report in `worker_m3_1/handoff.md`.
