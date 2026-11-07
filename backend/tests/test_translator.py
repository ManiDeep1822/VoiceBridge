import pytest
import asyncio
from unittest.mock import patch
from backend.services.translator import translate_text, _sanitize_translation, _TRANSLATION_CACHE

def test_sanitize_translation():
    assert _sanitize_translation("") == ""
    assert _sanitize_translation(None) == ""
    assert _sanitize_translation("&quot;Hello&quot;") == "Hello"
    assert _sanitize_translation('"Hello World"') == "Hello World"
    assert _sanitize_translation("'Single Quoted'") == "Single Quoted"
    assert _sanitize_translation("**Bold Translation**") == "Bold Translation"
    assert _sanitize_translation("Translation: 'Hello'") == "Hello"
    assert _sanitize_translation("Translated text: Namaste") == "Namaste"
    assert _sanitize_translation("Output: Dhanyavaad") == "Dhanyavaad"
    assert _sanitize_translation("MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS") == ""
    assert _sanitize_translation("QUERY LENGTH LIMIT EXCEEDED") == ""
    assert _sanitize_translation("INVALID LANGUAGE PAIR") == ""

def test_sanitize_translation_preserves_legitimate_phrases():
    # Legitimate phrases containing common words must NOT be nuked
    assert _sanitize_translation("The doctor is not available today.") == "The doctor is not available today."
    assert _sanitize_translation("Please enter a valid password.") == "Please enter a valid password."
    assert _sanitize_translation("`Single backtick code`") == "Single backtick code"
    assert _sanitize_translation("*Italic text*") == "Italic text"
    assert _sanitize_translation("“Smart double quotes”") == "Smart double quotes"
    assert _sanitize_translation("‘Smart single quotes’") == "Smart single quotes"
    assert _sanitize_translation("«Guillemets quotes»") == "Guillemets quotes"

    # Actual API warnings must be rejected
    assert _sanitize_translation("MYMEMORY WARNING: SPECIFIED PAIR IS NOT AVAILABLE") == ""
    assert _sanitize_translation("PLEASE ENTER A VALID TEXT TO TRANSLATE") == ""

def test_translate_empty_or_same_language():
    async def _run():
        assert await translate_text("", "te", "hi") == ""
        assert await translate_text("   ", "te", "hi") == ""
        assert await translate_text("Hello", "en", "en") == "Hello"
        assert await translate_text("నమస్కారం", "te-IN", "te-IN") == "నమస్కారం"
    asyncio.run(_run())

def test_translate_locale_normalization():
    async def _run():
        res = await translate_text("నమస్కారం", "te-IN", "hi-IN")
        assert isinstance(res, str)
        assert len(res) > 0
        assert res in _TRANSLATION_CACHE.values() or res == "నమస్కారం"
    asyncio.run(_run())

def test_translate_invalid_or_none_language():
    async def _run():
        res = await translate_text("Hello", None, None)
        assert isinstance(res, str)
        assert len(res) > 0

        res2 = await translate_text("Hello", "  ", "  ")
        assert isinstance(res2, str)
        assert len(res2) > 0
    asyncio.run(_run())

def test_translate_fallback_when_engines_fail():
    async def _run():
        with patch("aiohttp.ClientSession.get", side_effect=Exception("Network failure")):
            with patch("backend.services.translator.GEMINI_API_KEY", None):
                res = await translate_text("Fallback Test String", "en", "hi")
                assert res == "Fallback Test String"
    asyncio.run(_run())

def test_translate_malformed_upstream_json():
    async def _run():
        class MockMalformedResponse:
            status = 200
            async def text(self):
                return "{not valid json: true"
            async def json(self, content_type=None):
                raise ValueError("Malformed JSON")
            async def __aenter__(self):
                return self
            async def __aexit__(self, exc_type, exc_val, exc_tb):
                pass

        with patch("aiohttp.ClientSession.get", return_value=MockMalformedResponse()):
            with patch("backend.services.translator.GEMINI_API_KEY", None):
                res = await translate_text("Malformed JSON fallback test", "en", "hi")
                assert res == "Malformed JSON fallback test"
    asyncio.run(_run())
