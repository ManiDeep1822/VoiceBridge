# Handoff Report: Milestone 3 — Backend Unit & Reproduction Tests Investigation

**Explorer**: Explorer 1 (Backend Test Explorer)  
**Parent Sub-Orchestrator**: Sub-Orchestrator M3 (`5f411e2f-276f-469b-a818-60f115f36cf9`)  
**Workspace**: `d:\Real Live Call Translator`  
**State Folder**: `d:\Real Live Call Translator\.agents\teamwork\explorer_m3_1`  
**Handoff Type**: Hard (Investigation complete, test gaps identified, reproduction test specifications ready for worker)  
**Status**: COMPLETE  

---

## 1. Observation

### 1.1 Current Test Inventory & Pytest Baseline
Execution of `pytest` from workspace root and `backend/` subdirectory yielded:
- **Workspace Root**: `pytest` -> **68 passed, 0 failed, 2 warnings** in 33.34s.
- **Subdirectory**: `cd backend; pytest` -> **68 passed, 0 failed, 2 warnings** in 23.33s.
- **Test File Distribution (68 total tests across 7 files)**:
  1. `backend/tests/test_fastapi_endpoints.py`: 10 tests
  2. `backend/tests/test_m1_challenger1_stress.py`: 12 tests
  3. `backend/tests/test_m1_challenger2_stress.py`: 9 tests
  4. `backend/tests/test_prosody_engine.py`: 10 tests
  5. `backend/tests/test_sockets.py`: 11 tests
  6. `backend/tests/test_translator.py`: 7 tests
  7. `backend/tests/test_tts.py`: 9 tests
- **Warnings Observed**:
  - `StarletteDeprecationWarning: Using 'httpx' with 'starlette.testclient' is deprecated; install 'httpx2' instead.` in `fastapi/testclient.py:1`.
  - `DeprecationWarning: aifc was removed in Python 3.13. Please be aware that you are currently NOT using standard 'aifc', but instead a separately installed 'standard-aifc'.` in `speech_recognition/__init__.py:7`.

---

### 1.2 Inspection of `backend/tests/test_tts.py`
Examined `backend/services/tts.py:10-122` (`VOICE_MAP`) vs `backend/tests/test_tts.py`:
- `VOICE_MAP` contains exactly **27 language codes**:
  - **10 Indian**: `te`, `hi`, `en`, `ta`, `kn`, `ml`, `mr`, `bn`, `gu`, `pa`
  - **17 Global**: `es`, `de`, `fr`, `ja`, `zh`, `ar`, `ru`, `pt`, `it`, `ko`, `nl`, `tr`, `id`, `vi`, `th`, `pl`, `sv`
- `backend/tests/test_tts.py`:
  - `test_get_voice()` (lines 6-19) tests: `te`, `hi`, `en-IN`, and fallback cases (`unsupported-lang`, `None`, `""`, invalid gender).
  - `test_get_voice_global_languages()` (lines 20-67) tests: `es`, `de`, `fr`, `ja`, `zh`, `ar`, `ru`, `pt`, `it`, `ko`, `nl`, `tr`, `id`, `vi`, `th`, `pl`, `sv`, and `pa`.
  - `test_voice_map_completeness()` (lines 68-75) asserts `len(VOICE_MAP) == 27` and dictionary values end in `Neural`.
  - `test_get_voice_normalization_and_casing()` (lines 76-81) tests 4 specific cases: `"FR_FR"`, `"de_de"`, `"JA-jp"`, `"  es-es  "`.
- **Direct Observations & Gaps**:
  - **6 Indian languages** (`ta`, `kn`, `ml`, `mr`, `bn`, `gu`) and base `en` are **NEVER called via `get_voice()`** in `test_tts.py`.
  - There is **no systematic parameterized test** in `test_tts.py` calling `get_voice(lang, "female")` and `get_voice(lang, "male")` across all 27 keys.
  - While `test_m1_challenger2_stress.py:35-54` loops through `languages.js`, canonical unit tests in `test_tts.py` remain incomplete on their own.
  - Locale normalization in `test_tts.py` does not test regional subtag fallback across languages (e.g., `hi-IN` -> `hi`, `te-IN` -> `te`, `en-US` -> `en`, `es-MX` -> `es`, `pt-BR` -> `pt`).

---

### 1.3 Inspection of `backend/tests/test_sockets.py`
Examined `backend/socket_handlers.py:320-325` vs `backend/tests/test_sockets.py`:
- In `backend/socket_handlers.py`:
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
- In `backend/tests/test_sockets.py`:
  - Searched for `"domain"`: **0 occurrences** across all 448 lines.
  - In `test_multi_room_isolation` (line 141): `{"originalText": "Secret Alpha Message", "sourceLang": "en"}` (no `domain`).
  - In `test_rate_limiting_guard` (line 176): `{"originalText": "Spam phrase", "sourceLang": "en"}` (no `domain`).
  - In `test_speech_segment_none_or_empty_text` (lines 379-383): (no `domain`).
  - In `test_solo_simulator_single_participant_utterance` (line 418): `{"originalText": "Hello this is a solo simulator test", "sourceLang": "en", "targetLang": "hi"}` (no `domain`).
- **Direct Observations & Gaps**:
  - `backend/tests/test_sockets.py` does **NOT** test that `domain` passed in `speech_segment` is preserved.
  - It does **NOT** verify that `apply_glossary_protection` receives `domain`.
  - It does **NOT** verify that domain terms (e.g., medical, legal, fintech) are protected and restored during websocket calls.
  - It does **NOT** verify that omitting `domain` defaults to `"general"`.

---

### 1.4 Inspection of Direct Package Import Capability
Examined import tests in `backend/tests/test_m1_challenger1_stress.py` vs requirements:
- Existing tests:
  - `test_subprocess_import_socket_handlers_from_root` (line 33): tests `python -E -c "import backend.socket_handlers; print('OK')"`.
  - `test_subprocess_import_socket_handlers_from_backend_dir` (line 41): tests `python -E -c "import socket_handlers; print('OK')"`.
  - `test_subprocess_import_root_main_no_side_effects` (line 62): tests `python -E -c "import os, sys, main; assert callable(main.run); print('OK')"`.
- **Direct Observations & Gaps**:
  - `import backend.main` is **NOT tested in an isolated subprocess**.
  - There is **no dedicated test file `backend/tests/test_imports.py`** as scoped in `SCOPE.md` line 15.
  - Currently, import tests are buried inside a stress-testing challenger file (`test_m1_challenger1_stress.py`) rather than being an explicit, standard unit test suite.

---

### 1.5 Inspection of `backend/tests/test_prosody_engine.py` (Hindi Exclamation Intent)
Examined `backend/services/prosody_engine.py:77` vs `backend/tests/test_prosody_engine.py:76-84`:
- In `backend/services/prosody_engine.py`:
  - `EXCLAMATION_KEYWORDS["hi"] = [r'(?:^|[\s,.:;!?])(?:जल्दी|तुरंत|रुको|बचाओ|सावधान|मदद|अरे वाह|अरे यार|शाबाश)(?:[\s,.:;!?]|$)']`
- In `backend/tests/test_prosody_engine.py`:
  - `test_classify_and_punctuate_exclamations()` tests English ("Help me immediately") and Telugu ("త్వరగా రండి").
  - **Hindi exclamations are completely missing from the unit test suite**.

---

## 2. Logic Chain

1. **Premise**: Milestone 3's objective is 100% regression prevention through comprehensive reproduction and unit tests for all remediated defects.
2. **Defect #6 (Global Voice Map & TTS Normalization)**:
   - Observation: 6 of 10 Indian languages (`ta`, `kn`, `ml`, `mr`, `bn`, `gu`) and base `en` have zero direct `assert get_voice(lang, gender)` calls in `test_tts.py`.
   - Logic: If someone altered the voice mapping or key naming for Tamil or Bengali in `tts.py`, `test_tts.py` would still pass because it only tests dictionary presence and length, not the lookup logic. Adding a parameterized loop over all 27 languages and checking female/male return values guarantees complete voice map integrity.
   - Logic: Testing regional tags (`hi-IN`, `ta-IN`, `en-US`, `es-MX`, `fr-CA`, `zh-TW`) ensures the 2-letter fallback split (`raw_lang.split("-")[0]`) continues functioning without regressions.
3. **Defect #8 (Domain Jargon Lock WebSocket Forwarding)**:
   - Observation: Milestone 2 fixed the frontend to emit `activeDomain` in `speech_segment`. In `backend/socket_handlers.py:321`, `domain` is extracted and passed to `apply_glossary_protection`.
   - Logic: No test in `backend/tests/test_sockets.py` ever passes `domain` in `speech_segment`. If line 321 in `socket_handlers.py` were accidentally removed or changed to hardcoded `"general"`, every test in `test_sockets.py` would still pass 100%. Therefore, a test asserting domain preservation and glossary term protection in `speech_segment` is strictly required.
4. **Defect #3 & #4 (Direct Package Import & Main Guard)**:
   - Observation: While `backend.socket_handlers` and `main` have subprocess tests in `test_m1_challenger1_stress.py`, `backend.main` lacks an isolated subprocess test, and there is no standalone `test_imports.py` module.
   - Logic: Creating `backend/tests/test_imports.py` that explicitly tests `import backend.socket_handlers`, `import backend.main`, and `import main` in both in-process and isolated subprocesses (`python -E`) satisfies `SCOPE.md` Item 4 and ensures clear, dedicated regression coverage.
5. **Defect #7 (Hindi Prosody Intent Detection)**:
   - Observation: `backend/tests/test_prosody_engine.py` only tests English and Telugu exclamations.
   - Logic: Adding Hindi urgent phrases ("जल्दी", "तुरंत", "रुको", "बचाओ", "मदद") to `test_prosody_engine.py` validates that the backend classifier tags them as `"exclamation"` with terminal `"!"`, mirroring the frontend prosody fix.

---

## 3. Caveats

1. **Python 3.13 Library Deprecations**: The two warnings emitted during `pytest` (`StarletteDeprecationWarning` regarding httpx and `DeprecationWarning` regarding `standard-aifc`) are benign upstream library notices that do not cause test failures or indicate bugs in VoiceBridge.
2. **Punjabi Model Hosting**: Microsoft Edge-TTS public endpoints do not currently host `pa-IN` neural models. The system properly falls back to Google gTTS for Punjabi audio synthesis, as verified in `test_m1_challenger2_stress.py`.
3. **Read-Only Compliance**: In accordance with the explorer role, no test or production code was modified during this investigation. All recommendations below provide exact code blueprints for the Worker agent.

---

## 4. Conclusion & Actionable Implementation Plan

The current test suite is completely functional (68/68 passing), but has 4 specific regression coverage gaps. To achieve 100% regression prevention in Milestone 3, the following tasks must be implemented by the Worker:

### Task 1: Expand `backend/tests/test_tts.py`
Add comprehensive test functions to `backend/tests/test_tts.py`:
1. `test_get_voice_all_27_languages_both_genders()`:
   - Loop over all 27 keys in `VOICE_MAP`.
   - Assert `get_voice(lang, "female")` returns the exact female neural voice and ends with `"Neural"`.
   - Assert `get_voice(lang, "male")` returns the exact male neural voice and ends with `"Neural"`.
   - Assert `female != male` for every language.
2. `test_get_voice_regional_bcp47_fallback()`:
   - Test regional locale codes that fall back to 2-letter base:
     `"hi-IN" -> "hi"`, `"te-IN" -> "te"`, `"ta-IN" -> "ta"`, `"bn-IN" -> "bn"`,
     `"en-US" -> "en"`, `"es-MX" -> "es"`, `"fr-CA" -> "fr"`, `"pt-PT" -> "pt"`,
     `"zh-TW" -> "zh"`, `"de-AT" -> "de"`.
   - Test delimiter variation (`_` vs `-`) and casing on all regional variants (e.g. `"HI_IN"`, `"es_mx"`, `"EN_us"`).

### Task 2: Add Domain Jargon Lock WebSocket Tests to `backend/tests/test_sockets.py`
Add tests for `speech_segment` domain handling:
1. `test_speech_segment_preserves_domain_and_applies_glossary(live_server)`:
   - Emit `speech_segment` with `domain: "medical"`, `originalText: "The patient had a heart attack"`:
     - Verify received `translatedText` reflects translated medical jargon (e.g. `myocardial infarction`).
   - Emit `speech_segment` with `domain: "fintech"`, `originalText: "Check the operating profit"`:
     - Verify received `translatedText` reflects `EBITDA margin`.
2. `test_speech_segment_domain_default_and_fallback(live_server)`:
   - Emit without `domain` parameter -> verify defaults safely to `"general"`.
   - Emit with invalid domain (e.g. `"nonexistent_domain"`) -> verify graceful fallback to normal translation without dropping message.

### Task 3: Create Dedicated `backend/tests/test_imports.py`
Create `backend/tests/test_imports.py` with 4 explicit tests:
1. `test_import_backend_socket_handlers()`: In-process and subprocess isolated (`python -E -c "import backend.socket_handlers; print('OK')"`).
2. `test_import_backend_main()`: In-process and subprocess isolated (`python -E -c "import backend.main; assert hasattr(backend.main, 'app'); print('OK')"`).
3. `test_import_root_main_no_side_effects()`: In-process and subprocess isolated (`python -E -c "import main; assert callable(main.run); print('OK')"`).
4. `test_import_sibling_from_backend_cwd()`: Subprocess with `cwd=backend` (`python -E -c "import socket_handlers; import main; print('OK')"`).

### Task 4: Add Hindi Exclamation Intent Tests to `backend/tests/test_prosody_engine.py`
Add `test_classify_and_punctuate_hindi_exclamations()`:
- Test Hindi urgency keywords:
  - `"जल्दी आओ"` -> `intent == "exclamation"`, ends with `"!"`
  - `"तुरंत मदद करो"` -> `intent == "exclamation"`, ends with `"!"`
  - `"रुको"` -> `intent == "exclamation"`, ends with `"!"`
  - `"बचाओ"` -> `intent == "exclamation"`, ends with `"!"`
  - `"शाबाश"` -> `intent == "exclamation"`, ends with `"!"`

---

## 5. Verification Method

### How to Independently Verify Current Baseline
1. Run root pytest:
   ```powershell
   pytest
   ```
   *Expected outcome*: 68 passed, 2 warnings in ~30s.

2. Run subdirectory pytest:
   ```powershell
   cd backend; pytest
   ```
   *Expected outcome*: 68 passed, 0 failed in ~20s.

3. Verify import capability directly in PowerShell:
   ```powershell
   python -E -c "import backend.socket_handlers; import backend.main; import main; print('ALL IMPORTS CLEAN')"
   ```
   *Expected outcome*: Prints `ALL IMPORTS CLEAN` without starting Uvicorn server or raising errors.

### Invalidation Conditions
- Any test fails or raises an unhandled exception.
- Adding tests causes import failures when pytest is invoked from root vs `backend/`.
- Test execution time increases significantly due to blocking network calls (mocking external translation/Edge-TTS where appropriate prevents latency regressions).
