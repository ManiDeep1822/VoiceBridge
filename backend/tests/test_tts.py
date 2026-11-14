import pytest
import asyncio
from unittest.mock import patch
from backend.services.tts import synthesize_speech, get_voice, VOICE_MAP

def test_get_voice():
    # Standard lookup
    assert get_voice("te", "female") == "te-IN-ShrutiNeural"
    assert get_voice("te", "male") == "te-IN-MohanNeural"
    assert get_voice("hi", "female") == "hi-IN-SwaraNeural"
    assert get_voice("hi", "male") == "hi-IN-MadhurNeural"
    assert get_voice("en-IN", "female") == "en-IN-NeerjaNeural"

    # Unsupported or none should fallback safely
    assert get_voice("unsupported-lang", "female") == "en-IN-NeerjaNeural"
    assert get_voice(None, None) == "en-IN-NeerjaNeural"
    assert get_voice("", "unknown_gender") == "en-IN-NeerjaNeural"
    assert get_voice("te", "invalid_gender") == "te-IN-ShrutiNeural"

def test_get_voice_global_languages():
    # Spanish
    assert get_voice("es", "female") == "es-ES-ElviraNeural"
    assert get_voice("es", "male") == "es-ES-AlvaroNeural"
    assert get_voice("es-ES", "female") == "es-ES-ElviraNeural"
    assert get_voice("es_ES", "female") == "es-ES-ElviraNeural"
    assert get_voice("ES", "MALE") == "es-ES-AlvaroNeural"

    # German, French, Japanese, Chinese, Arabic, Russian
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
    assert get_voice("ru", "female") == "ru-RU-SvetlanaNeural"
    assert get_voice("ru", "male") == "ru-RU-DmitryNeural"

    # Portuguese, Italian, Korean, Dutch, Turkish, Indonesian
    assert get_voice("pt", "female") == "pt-BR-FranciscaNeural"
    assert get_voice("pt", "male") == "pt-BR-AntonioNeural"
    assert get_voice("it", "female") == "it-IT-ElsaNeural"
    assert get_voice("it", "male") == "it-IT-DiegoNeural"
    assert get_voice("ko", "female") == "ko-KR-SunHiNeural"
    assert get_voice("ko", "male") == "ko-KR-InJoonNeural"
    assert get_voice("nl", "female") == "nl-NL-ColetteNeural"
    assert get_voice("nl", "male") == "nl-NL-MaartenNeural"
    assert get_voice("tr", "female") == "tr-TR-EmelNeural"
    assert get_voice("tr", "male") == "tr-TR-AhmetNeural"
    assert get_voice("id", "female") == "id-ID-GadisNeural"
    assert get_voice("id", "male") == "id-ID-ArdiNeural"

    # Vietnamese, Thai, Polish, Swedish, Punjabi
    assert get_voice("vi", "female") == "vi-VN-HoaiMyNeural"
    assert get_voice("vi", "male") == "vi-VN-NamMinhNeural"
    assert get_voice("th", "female") == "th-TH-PremwadeeNeural"
    assert get_voice("th", "male") == "th-TH-NiwatNeural"
    assert get_voice("pl", "female") == "pl-PL-ZofiaNeural"
    assert get_voice("pl", "male") == "pl-PL-MarekNeural"
    assert get_voice("sv", "female") == "sv-SE-SofieNeural"
    assert get_voice("sv", "male") == "sv-SE-MattiasNeural"
    assert get_voice("pa", "female") == "pa-IN-OjasNeural"
    assert get_voice("pa", "male") == "pa-IN-GurpreetNeural"

def test_voice_map_completeness():
    assert len(VOICE_MAP) == 27
    for lang, genders in VOICE_MAP.items():
        assert "female" in genders
        assert "male" in genders
        assert genders["female"].endswith("Neural")
        assert genders["male"].endswith("Neural")

def test_get_voice_normalization_and_casing():
    assert get_voice("FR_FR", "MALE") == "fr-FR-HenriNeural"
    assert get_voice("de_de", "FEMALE") == "de-DE-KatjaNeural"
    assert get_voice("JA-jp", "female") == "ja-JP-NanamiNeural"
    assert get_voice("  es-es  ", " male ") == "es-ES-AlvaroNeural"

def test_get_voice_all_27_languages_both_genders():
    assert len(VOICE_MAP) == 27
    for lang in VOICE_MAP:
        female_voice = get_voice(lang, "female")
        male_voice = get_voice(lang, "male")
        assert female_voice.endswith("Neural"), f"Expected Neural voice for {lang} female, got {female_voice}"
        assert male_voice.endswith("Neural"), f"Expected Neural voice for {lang} male, got {male_voice}"
        assert female_voice != male_voice, f"Expected distinct voices for {lang}, got {female_voice} == {male_voice}"
        assert female_voice == VOICE_MAP[lang]["female"]
        assert male_voice == VOICE_MAP[lang]["male"]

def test_get_voice_regional_bcp47_fallback():
    regional_pairs = [
        ("hi-IN", "hi"),
        ("te-IN", "te"),
        ("ta-IN", "ta"),
        ("bn-IN", "bn"),
        ("en-US", "en"),
        ("es-MX", "es"),
        ("fr-CA", "fr"),
        ("pt-BR", "pt"),
        ("de-AT", "de"),
        ("zh-TW", "zh"),
    ]
    for regional_tag, base_lang in regional_pairs:
        assert get_voice(regional_tag, "female") == VOICE_MAP[base_lang]["female"]
        assert get_voice(regional_tag, "male") == VOICE_MAP[base_lang]["male"]

        underscore_tag = regional_tag.replace("-", "_")
        assert get_voice(underscore_tag, "female") == VOICE_MAP[base_lang]["female"]
        assert get_voice(underscore_tag, "male") == VOICE_MAP[base_lang]["male"]

        assert get_voice(regional_tag.upper(), "female") == VOICE_MAP[base_lang]["female"]
        assert get_voice(underscore_tag.upper(), "male") == VOICE_MAP[base_lang]["male"]

        assert get_voice(regional_tag.lower(), "female") == VOICE_MAP[base_lang]["female"]
        assert get_voice(underscore_tag.lower(), "male") == VOICE_MAP[base_lang]["male"]

def test_synthesize_speech_empty():
    async def _run():
        assert await synthesize_speech("", "te") == b""
        assert await synthesize_speech("   ", "te") == b""
        assert await synthesize_speech(None, "te") == b""
    asyncio.run(_run())

def test_synthesize_speech_special_chars():
    async def _run():
        res = await synthesize_speech("Hello <world> & friends! 😊🙏", "en")
        assert isinstance(res, bytes)
        assert len(res) > 1000
    asyncio.run(_run())

def test_synthesize_speech_unsupported_language():
    async def _run():
        res = await synthesize_speech("Testing unsupported language code", "xx-YY")
        assert isinstance(res, bytes)
        assert len(res) > 1000
    asyncio.run(_run())

def test_synthesize_speech_long_text():
    async def _run():
        long_text = "This is a comprehensive stress test of synthesized voice translation audio. " * 8
        res = await synthesize_speech(long_text, "en")
        assert isinstance(res, bytes)
        assert len(res) > 10000
    asyncio.run(_run())

def test_synthesize_speech_gtts_fallback():
    async def _run():
        with patch("edge_tts.Communicate", side_effect=Exception("Edge-TTS connection down")):
            res = await synthesize_speech("Testing gTTS fallback synthesis", "en")
            assert isinstance(res, bytes)
            assert len(res) > 1000
    asyncio.run(_run())
