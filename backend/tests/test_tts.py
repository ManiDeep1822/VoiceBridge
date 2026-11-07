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
