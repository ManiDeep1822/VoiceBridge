# Implementation Directive: Milestone 1 — Backend Infrastructure, Dependencies & Test Configuration

Based on synthesized findings from Explorers 1, 2, and 3:

## Files Owned by Worker
1. `pytest.ini` (Create at project root)
2. `backend/__init__.py` (Create)
3. `backend/requirements.txt` (Update)
4. `backend/socket_handlers.py` (Update imports)
5. `main.py` (Root entrypoint guard)
6. `backend/main.py` (Static files & SPA fallback HTML)
7. `backend/services/tts.py` (Expand VOICE_MAP to 27 languages, refine get_voice, update gTTS whitelist)
8. `backend/tests/test_tts.py` (Update with tests for global languages and genders)

---

## Task Details

### 1. Create `pytest.ini` at project root (`pytest.ini`)
```ini
[pytest]
pythonpath = . backend
testpaths = backend/tests
```

### 2. Create `backend/__init__.py`
```python
"""VoiceBridge backend package."""
```

### 3. Update `backend/requirements.txt`
Append missing dependencies:
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

### 4. Update `backend/socket_handlers.py`
Replace bare imports at lines 6-8 and promote glossary import to top-level try/except:
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
At line ~306 inside `speech_segment`:
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

### 5. Wrap root `main.py`
Wrap lines 9-31 inside a `run()` function guarded by `if __name__ == "__main__":` so importing `main` has no side effects.

### 6. Update `backend/main.py` SPA Fallback
Ensure `assets_dir = os.path.join(frontend_dist, "assets")` is checked with `if os.path.isdir(assets_dir): app.mount("/assets", ...)` to avoid Starlette startup crash.
Implement `serve_spa` catch-all route with `FALLBACK_HTML` when `frontend_dist/index.html` is missing, but ensuring paths starting with `api/` or `api` return 404 JSON.

### 7. Expand `backend/services/tts.py`
- Populate `VOICE_MAP` with all 27 languages (9 Indian: `te`, `hi`, `en`, `ta`, `kn`, `ml`, `mr`, `bn`, `gu` + `pa` and 17 global: `es`, `de`, `fr`, `ja`, `zh`, `ar`, `ru`, `pt`, `it`, `ko`, `nl`, `tr`, `id`, `vi`, `th`, `pl`, `sv`), both `female` and `male`.
- Update `get_voice` to normalize `_` to `-` and check full BCP-47 tag before base code.
- In `_fallback_gtts`, change `if code not in ("te", ...): code = "en"` to `if code not in VOICE_MAP: code = "en"`.

### 8. Update `backend/tests/test_tts.py`
Add test cases for global languages, genders, and normalization.

---

## Mandatory Verification Commands
Worker MUST execute and document all passing results in `handoff.md`:
1. `pytest` from workspace root -> Exit code 0, all tests pass.
2. `cd backend; pytest; cd ..` -> Exit code 0, all tests pass.
3. `python -c "import backend.socket_handlers; print('OK')"` -> Exit code 0.
4. `python -c "import main; print('OK')"` -> Exit code 0, no server started.
5. `python backend/test_e2e.py` -> Exit code 0.
