# Handoff Report: Explorer M1-3 — Backend TTS Neural Voice Map & Edge Case Analysis

## 1. Observation

### 1.1 Current State of `backend/services/tts.py`
- In `backend/services/tts.py:10-47`, `VOICE_MAP` contains exactly 9 language keys:
  ```python
  VOICE_MAP = {
      "te": {"female": "te-IN-ShrutiNeural", "male": "te-IN-MohanNeural"},
      "hi": {"female": "hi-IN-SwaraNeural", "male": "hi-IN-MadhurNeural"},
      "en": {"female": "en-IN-NeerjaNeural", "male": "en-IN-PrabhatNeural"},
      "ta": {"female": "ta-IN-PallaviNeural", "male": "ta-IN-ValluvarNeural"},
      "kn": {"female": "kn-IN-SapnaNeural", "male": "kn-IN-GaganNeural"},
      "ml": {"female": "ml-IN-SobhanaNeural", "male": "ml-IN-MidhunNeural"},
      "mr": {"female": "mr-IN-AarohiNeural", "male": "mr-IN-ManoharNeural"},
      "bn": {"female": "bn-IN-TanishaaNeural", "male": "bn-IN-BashkarNeural"},
      "gu": {"female": "gu-IN-DhwaniNeural", "male": "gu-IN-NiranjanNeural"},
  }
  ```
- In `backend/services/tts.py:52-58`:
  ```python
  def get_voice(lang: str, gender: str = "female") -> str:
      clean_lang = (str(lang).split("-")[0].strip().lower() if lang else "") or "en"
      clean_gender = str(gender).strip().lower() if gender else "female"
      gender_key = clean_gender if clean_gender in ("female", "male") else "female"
      if clean_lang in VOICE_MAP:
          return VOICE_MAP[clean_lang].get(gender_key, VOICE_MAP[clean_lang]["female"])
      return "en-IN-NeerjaNeural"
  ```
- In `backend/services/tts.py:123-125` (gTTS Catastrophic Fallback):
  ```python
  code = (str(target_lang).split("-")[0].strip().lower() if target_lang else "") or "en"
  if code not in ("te", "hi", "en", "ta", "kn", "ml", "mr", "bn", "gu"):
      code = "en"
  ```
- Command result from invoking `python -c "from backend.services.tts import get_voice; print(get_voice('es', 'female'), get_voice('fr', 'male'), get_voice('ja', 'female'))"`:
  ```
  en-IN-NeerjaNeural en-IN-NeerjaNeural en-IN-NeerjaNeural
  ```
  All 18 global languages supported in frontend (`es`, `de`, `fr`, `ja`, `zh`, `ar`, `ru`, `pt`, `it`, `ko`, `nl`, `tr`, `id`, `vi`, `th`, `pl`, `sv`, `pa`) silently fall back to Indian English female neural voice `en-IN-NeerjaNeural`.

### 1.2 Frontend Language Registry
- In `frontend/src/utils/languages.js:4-32`, `SUPPORTED_LANGUAGES` defines 27 languages:
  - 9 Indian languages: `en`, `hi`, `te`, `ta`, `kn`, `ml`, `mr`, `bn`, `gu`
  - 18 Global & regional languages: `pa`, `es`, `de`, `fr`, `ja`, `zh`, `ar`, `ru`, `pt`, `it`, `ko`, `nl`, `tr`, `id`, `vi`, `th`, `pl`, `sv`

### 1.3 Edge-TTS Voice Verification
- Queried `edge_tts.list_voices()` via Python:
  - Total voices in Edge-TTS catalog: 322 voices across 142 locales.
  - Tested 17 global languages with live audio streaming synthesis for both Female and Male voices:
    - `es` (Spanish): `es-ES-ElviraNeural` (Female), `es-ES-AlvaroNeural` (Male)
    - `de` (German): `de-DE-KatjaNeural` (Female), `de-DE-KillianNeural` (Male)
    - `fr` (French): `fr-FR-DeniseNeural` (Female), `fr-FR-HenriNeural` (Male)
    - `ja` (Japanese): `ja-JP-NanamiNeural` (Female), `ja-JP-KeitaNeural` (Male)
    - `zh` (Chinese): `zh-CN-XiaoxiaoNeural` (Female), `zh-CN-YunjianNeural` (Male)
    - `ar` (Arabic): `ar-SA-ZariyahNeural` (Female), `ar-SA-HamedNeural` (Male)
    - `ru` (Russian): `ru-RU-SvetlanaNeural` (Female), `ru-RU-DmitryNeural` (Male)
    - `pt` (Portuguese): `pt-BR-FranciscaNeural` (Female), `pt-BR-AntonioNeural` (Male)
    - `it` (Italian): `it-IT-ElsaNeural` (Female), `it-IT-DiegoNeural` (Male)
    - `ko` (Korean): `ko-KR-SunHiNeural` (Female), `ko-KR-InJoonNeural` (Male)
    - `nl` (Dutch): `nl-NL-ColetteNeural` (Female), `nl-NL-MaartenNeural` (Male)
    - `tr` (Turkish): `tr-TR-EmelNeural` (Female), `tr-TR-AhmetNeural` (Male)
    - `id` (Indonesian): `id-ID-GadisNeural` (Female), `id-ID-ArdiNeural` (Male)
    - `vi` (Vietnamese): `vi-VN-HoaiMyNeural` (Female), `vi-VN-NamMinhNeural` (Male)
    - `th` (Thai): `th-TH-PremwadeeNeural` (Female), `th-TH-NiwatNeural` (Male)
    - `pl` (Polish): `pl-PL-ZofiaNeural` (Female), `pl-PL-MarekNeural` (Male)
    - `sv` (Swedish): `sv-SE-SofieNeural` (Female), `sv-SE-MattiasNeural` (Male)
  - Result: All 34 voice streams returned audio chunks with >0 bytes without error.
  - Edge-TTS Punjabi (`pa`) anomaly:
    - Edge-TTS catalog contains zero Punjabi locales (no `pa-IN`, `pa-PK`).
    - Testing `edge_tts.Communicate("ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ", voice="pa-IN-GurpreetNeural")` raises:
      `edge_tts.exceptions.NoAudioReceived: No audio was received. Please verify that your parameters are correct.`
    - Testing Gurmukhi text with `hi-IN-SwaraNeural` or `en-IN-NeerjaNeural` also raises `NoAudioReceived` because characters outside the voice's script set are rejected.
    - Testing Google `gTTS` with `gTTS(text="ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ", lang="pa")` succeeds and generates 14,400 bytes of authentic Punjabi audio.
    - All 27 languages are confirmed supported in `gtts.lang.tts_langs()`.

### 1.4 Test Suite Status
- `backend/tests/test_tts.py`:
  - 6 unit tests covering `get_voice` (only `te`, `hi`, `en-IN`, unsupported, None, invalid gender) and `synthesize_speech`.
  - Zero tests for any of the 18 global languages or male voices.
- `backend/test_e2e.py`:
  - Tests 2-client live call flow: Telugu (`te`, female) to Hindi (`hi`, female) with subtitle + base64 audio assertion.
- `backend/tests/test_fastapi_endpoints.py`:
  - `test_tts_endpoint()` tests `POST /api/tts` with `{"text": "Hello", "target_lang": "en", "gender": "female"}`.

---

## 2. Logic Chain

1. **Observation 1.1 & 1.2**: `frontend/src/utils/languages.js` supports 27 languages, but `backend/services/tts.py:VOICE_MAP` maps only 9 Indian languages.
2. **Logic Step**: When users choose any of the 18 global languages in the frontend, the backend fails `clean_lang in VOICE_MAP` at `tts.py:56` and returns `"en-IN-NeerjaNeural"`. A German speaker listening to German translations hears an Indian English voice pronouncing German text phonetically incorrectly.
3. **Observation 1.3**: 17 of the 18 global languages have verified Microsoft Neural voices in Edge-TTS for both female and male genders that successfully synthesize audio.
4. **Logic Step**: Adding explicit entries for all 17 global languages directly resolves the missing voice issue for the entire international language suite.
5. **Observation 1.3 (Punjabi Edge Case)**: Edge-TTS public endpoints do not expose `pa-IN-OjasNeural` or `pa-IN-GurpreetNeural`. Calling them triggers `NoAudioReceived`. When Edge-TTS fails, `synthesize_speech` falls through to gTTS.
6. **Observation 1.1 (gTTS Whitelist Bug)**: `tts.py:124` contains a hardcoded check `if code not in ("te", "hi", "en", "ta", "kn", "ml", "mr", "bn", "gu"): code = "en"`. Because `pa` and all 17 global languages are excluded from this tuple, catastrophic fallback forces `code = "en"`, destroying speech synthesis for all international languages and Punjabi.
7. **Logic Step**: Updating `VOICE_MAP` with `pa` (mapping to `pa-IN-OjasNeural` / `pa-IN-GurpreetNeural` for consistency with Azure Speech and frontend `languages.js:14`) AND expanding the gTTS whitelist in `tts.py:124` to include `pa` and all 27 languages guarantees authentic Punjabi pronunciation via gTTS fallback.
8. **Observation 1.1 (`get_voice` Language Code Normalization)**:
   - `clean_lang = (str(lang).split("-")[0].strip().lower() if lang else "") or "en"`
   - If an input uses an underscore delimiter (e.g. `es_ES`, standard in POSIX/Android/iOS locales), `split("-")[0]` produces `"es_es"`, which fails `clean_lang in VOICE_MAP` and falls back to `en-IN-NeerjaNeural`.
   - Normalizing delimiters by replacing `_` with `-` prevents this failure mode.
   - Checking for an exact BCP-47 tag in `VOICE_MAP` (e.g. `en-US` vs `en-IN`, or `zh-CN` vs `zh-TW`) before falling back to the 2-letter base prefix (`en`, `zh`) enables regional precision without breaking backwards compatibility.

---

## 3. Caveats

1. **Punjabi Edge-TTS vs Azure Speech**:
   Microsoft Edge-TTS is a free service endpoint based on Edge browser's read-aloud feature. As of 2026, it does not host `pa-IN` neural voices, unlike the commercial Azure Cognitive Services Speech API. Mapping `"pa"` in `VOICE_MAP` to `{"female": "pa-IN-OjasNeural", "male": "pa-IN-GurpreetNeural"}` maintains specification parity with the frontend and Azure Speech, but callers will rely on the gTTS fallback for audio synthesis until Microsoft adds `pa-IN` to Edge-TTS.
2. **Network Dependency for Edge-TTS and gTTS**:
   Both Edge-TTS and gTTS require an outbound internet connection to Microsoft and Google endpoints respectively. Offline mode falls back to empty bytes `b""`, which client handles via browser Web Speech fallback.
3. **No Project Source Modifications**:
   In strict accordance with the explorer role, no project source code was modified. All recommendations below are actionable specifications for the implementer agent.

---

## 4. Conclusion

### 4.1 Recommended `VOICE_MAP` Dictionary Entries

The complete, authoritative `VOICE_MAP` for `backend/services/tts.py` covering all 27 languages:

```python
# High-fidelity Microsoft Azure Neural Voices (Authentic Human Tone)
VOICE_MAP = {
    # --- Indian Languages ---
    "te": {
        "female": "te-IN-ShrutiNeural",
        "male": "te-IN-MohanNeural",
    },
    "hi": {
        "female": "hi-IN-SwaraNeural",
        "male": "hi-IN-MadhurNeural",
    },
    "en": {
        "female": "en-IN-NeerjaNeural",
        "male": "en-IN-PrabhatNeural",
    },
    "ta": {
        "female": "ta-IN-PallaviNeural",
        "male": "ta-IN-ValluvarNeural",
    },
    "kn": {
        "female": "kn-IN-SapnaNeural",
        "male": "kn-IN-GaganNeural",
    },
    "ml": {
        "female": "ml-IN-SobhanaNeural",
        "male": "ml-IN-MidhunNeural",
    },
    "mr": {
        "female": "mr-IN-AarohiNeural",
        "male": "mr-IN-ManoharNeural",
    },
    "bn": {
        "female": "bn-IN-TanishaaNeural",
        "male": "bn-IN-BashkarNeural",
    },
    "gu": {
        "female": "gu-IN-DhwaniNeural",
        "male": "gu-IN-NiranjanNeural",
    },
    "pa": {
        "female": "pa-IN-OjasNeural",
        "male": "pa-IN-GurpreetNeural",
    },

    # --- Global Languages ---
    "es": {
        "female": "es-ES-ElviraNeural",
        "male": "es-ES-AlvaroNeural",
    },
    "de": {
        "female": "de-DE-KatjaNeural",
        "male": "de-DE-KillianNeural",
    },
    "fr": {
        "female": "fr-FR-DeniseNeural",
        "male": "fr-FR-HenriNeural",
    },
    "ja": {
        "female": "ja-JP-NanamiNeural",
        "male": "ja-JP-KeitaNeural",
    },
    "zh": {
        "female": "zh-CN-XiaoxiaoNeural",
        "male": "zh-CN-YunjianNeural",
    },
    "ar": {
        "female": "ar-SA-ZariyahNeural",
        "male": "ar-SA-HamedNeural",
    },
    "ru": {
        "female": "ru-RU-SvetlanaNeural",
        "male": "ru-RU-DmitryNeural",
    },
    "pt": {
        "female": "pt-BR-FranciscaNeural",
        "male": "pt-BR-AntonioNeural",
    },
    "it": {
        "female": "it-IT-ElsaNeural",
        "male": "it-IT-DiegoNeural",
    },
    "ko": {
        "female": "ko-KR-SunHiNeural",
        "male": "ko-KR-InJoonNeural",
    },
    "nl": {
        "female": "nl-NL-ColetteNeural",
        "male": "nl-NL-MaartenNeural",
    },
    "tr": {
        "female": "tr-TR-EmelNeural",
        "male": "tr-TR-AhmetNeural",
    },
    "id": {
        "female": "id-ID-GadisNeural",
        "male": "id-ID-ArdiNeural",
    },
    "vi": {
        "female": "vi-VN-HoaiMyNeural",
        "male": "vi-VN-NamMinhNeural",
    },
    "th": {
        "female": "th-TH-PremwadeeNeural",
        "male": "th-TH-NiwatNeural",
    },
    "pl": {
        "female": "pl-PL-ZofiaNeural",
        "male": "pl-PL-MarekNeural",
    },
    "sv": {
        "female": "sv-SE-SofieNeural",
        "male": "sv-SE-MattiasNeural",
    },
}
```

### 4.2 Recommended Refinements to `backend/services/tts.py`

#### A. Enhanced `get_voice` function (handling underscores and BCP-47):
```python
def get_voice(lang: str, gender: str = "female") -> str:
    raw_lang = (str(lang).strip().replace("_", "-").lower() if lang else "") or "en"
    clean_lang = raw_lang.split("-")[0]
    clean_gender = str(gender).strip().lower() if gender else "female"
    gender_key = clean_gender if clean_gender in ("female", "male") else "female"

    # 1. Exact match on full BCP-47 tag (e.g., "en-us") if defined
    if raw_lang in VOICE_MAP:
        return VOICE_MAP[raw_lang].get(gender_key, VOICE_MAP[raw_lang]["female"])

    # 2. Base 2-letter language code lookup (e.g., "es", "de", "hi")
    if clean_lang in VOICE_MAP:
        return VOICE_MAP[clean_lang].get(gender_key, VOICE_MAP[clean_lang]["female"])

    # 3. Default fallback to authoritative Indian English female neural voice
    return "en-IN-NeerjaNeural"
```

#### B. Fixing the Catastrophic gTTS Fallback Whitelist (`backend/services/tts.py:123-126`):
```python
    try:
        from gtts import gTTS
        code = (str(target_lang).replace("_", "-").split("-")[0].strip().lower() if target_lang else "") or "en"
        # Support all 27 languages in gTTS fallback (all verified supported in gtts.lang.tts_langs())
        if code not in VOICE_MAP:
            code = "en"

        def _gtts_task():
            tts = gTTS(text=clean_text, lang=code)
            fp = io.BytesIO()
            tts.write_to_fp(fp)
            return fp.getvalue()
```
Changing `if code not in ("te", "hi", "en", "ta", "kn", "ml", "mr", "bn", "gu"): code = "en"` to `if code not in VOICE_MAP: code = "en"` allows gTTS to accurately speak Spanish, French, German, Japanese, and Punjabi during network interruptions.

### 4.3 Recommended Additions to `backend/tests/test_tts.py`
Add explicit test assertions for global languages, male voices, underscore handling, and case insensitivity:
```python
def test_get_voice_global_languages():
    # Spanish
    assert get_voice("es", "female") == "es-ES-ElviraNeural"
    assert get_voice("es", "male") == "es-ES-AlvaroNeural"
    assert get_voice("es-ES", "female") == "es-ES-ElviraNeural"
    assert get_voice("es_ES", "female") == "es-ES-ElviraNeural"
    assert get_voice("ES", "MALE") == "es-ES-AlvaroNeural"

    # German, French, Japanese, Chinese, Arabic
    assert get_voice("de", "female") == "de-DE-KatjaNeural"
    assert get_voice("de", "male") == "de-DE-KillianNeural"
    assert get_voice("fr", "female") == "fr-FR-DeniseNeural"
    assert get_voice("fr", "male") == "fr-FR-HenriNeural"
    assert get_voice("ja", "female") == "ja-JP-NanamiNeural"
    assert get_voice("ja", "male") == "ja-JP-KeitaNeural"
    assert get_voice("zh", "female") == "zh-CN-XiaoxiaoNeural"
    assert get_voice("zh", "male") == "zh-CN-YunjianNeural"
    assert get_voice("ar", "female") == "ar-SA-ZariyahNeural"
    assert get_voice("ar", "male") == "ar-SA-HamedNeural"

    # Backward compatibility with existing tests
    assert get_voice("te", "female") == "te-IN-ShrutiNeural"
    assert get_voice("hi", "male") == "hi-IN-MadhurNeural"
    assert get_voice("en-IN", "female") == "en-IN-NeerjaNeural"
    assert get_voice("unknown-code", "female") == "en-IN-NeerjaNeural"
```

---

## 5. Verification Method

### 5.1 Command Line Verification
Run these commands after applying the recommendations:

1. **Verify all 27 languages exist in `VOICE_MAP`**:
   ```bash
   python -c "import sys; sys.path.insert(0, '.'); from backend.services.tts import VOICE_MAP, get_voice; assert len(VOICE_MAP) >= 27; print(f'VOICE_MAP verified with {len(VOICE_MAP)} languages')"
   ```

2. **Verify voice lookups for all 27 languages (both female and male)**:
   ```bash
   python -c "import sys; sys.path.insert(0, '.'); from backend.services.tts import get_voice, VOICE_MAP; [assert get_voice(lang, 'female') != 'en-IN-NeerjaNeural' or lang == 'en' for lang in VOICE_MAP]; print('All language female lookups valid!')"
   ```

3. **Verify underscore normalization**:
   ```bash
   python -c "import sys; sys.path.insert(0, '.'); from backend.services.tts import get_voice; assert get_voice('es_ES', 'female') == 'es-ES-ElviraNeural'; assert get_voice('fr_FR', 'male') == 'fr-FR-HenriNeural'; print('Underscore locale parsing verified!')"
   ```

4. **Verify unit tests**:
   ```bash
   pytest backend/tests/test_tts.py
   ```

5. **Verify end-to-end simulation**:
   ```bash
   python backend/test_e2e.py
   ```

### 5.2 Invalidation Conditions
This analysis will be invalidated if:
- Microsoft Edge-TTS deprecates or renames any of the 34 verified neural voice models (e.g. `es-ES-ElviraNeural`).
- A breaking change is made to `get_voice` signature or default fallback voice `en-IN-NeerjaNeural`.
