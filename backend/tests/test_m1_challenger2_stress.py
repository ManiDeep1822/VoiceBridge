import os
import re
import io
import pytest
import asyncio
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.main import app, frontend_dist, FALLBACK_HTML
from backend.services.tts import get_voice, VOICE_MAP, synthesize_speech

client = TestClient(app)

# ---------------------------------------------------------
# Extract Languages from frontend/src/utils/languages.js
# ---------------------------------------------------------
def get_frontend_languages():
    lang_js_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "src", "utils", "languages.js")
    with open(lang_js_path, "r", encoding="utf-8") as f:
        content = f.read()
    # Match code: 'xx' within SUPPORTED_LANGUAGES array
    codes = re.findall(r"code:\s*'([a-zA-Z0-9_\-]+)'", content)
    # Deduplicate while preserving order
    seen = set()
    unique_codes = []
    for c in codes:
        if c not in seen:
            seen.add(c)
            unique_codes.append(c)
    return unique_codes

# ---------------------------------------------------------
# Test Suite 1: Voice Map & TTS Stress Test
# ---------------------------------------------------------

def test_stress_voice_map_all_frontend_languages():
    frontend_langs = get_frontend_languages()
    assert len(frontend_langs) == 27, f"Expected 27 frontend languages, found {len(frontend_langs)}"

    for lang in frontend_langs:
        # Female voice lookup
        female_voice = get_voice(lang, "female")
        assert female_voice is not None, f"Voice was None for {lang} (female)"
        assert isinstance(female_voice, str), f"Voice not string for {lang} (female)"
        assert female_voice.endswith("Neural"), f"Voice '{female_voice}' does not end with Neural for {lang}"

        # Male voice lookup
        male_voice = get_voice(lang, "male")
        assert male_voice is not None, f"Voice was None for {lang} (male)"
        assert isinstance(male_voice, str), f"Voice not string for {lang} (male)"
        assert male_voice.endswith("Neural"), f"Voice '{male_voice}' does not end with Neural for {lang}"

        # Ensure female and male voices are distinct for authenticity
        assert female_voice != male_voice, f"Female and male voices identical for language {lang}: {female_voice}"

def test_stress_voice_map_casing_and_gender_variations():
    frontend_langs = get_frontend_languages()

    gender_test_cases = [
        ("MALE", "male"),
        ("Male", "male"),
        ("mAlE", "male"),
        ("  male  ", "male"),
        ("FEMALE", "female"),
        ("Female", "female"),
        ("fEmAlE", "female"),
        ("  female  ", "female"),
    ]

    for lang in frontend_langs:
        base_female = get_voice(lang, "female")
        base_male = get_voice(lang, "male")

        # Test upper casing of language code: e.g. "ES", "DE", "HI"
        assert get_voice(lang.upper(), "female") == base_female
        assert get_voice(lang.upper(), "male") == base_male

        # Test mixed gender casing
        for input_gender, expected_gender_type in gender_test_cases:
            res = get_voice(lang, input_gender)
            expected = base_male if expected_gender_type == "male" else base_female
            assert res == expected, f"Failed for {lang} with gender '{input_gender}'"

def test_stress_voice_map_delimiters():
    frontend_langs = get_frontend_languages()
    for lang in frontend_langs:
        base_female = get_voice(lang, "female")
        base_male = get_voice(lang, "male")

        # Delimiter variations
        delimiters = [
            f"{lang.upper()}_{lang.upper()}",
            f"{lang.lower()}_{lang.upper()}",
            f"{lang.lower()}-{lang.upper()}",
            f"{lang.lower()}-{lang.lower()}",
            f"  {lang.lower()}_{lang.upper()}  ",
        ]
        for delim in delimiters:
            res_female = get_voice(delim, "female")
            assert res_female == base_female, f"Delimiter test failed for '{delim}' (female)"
            res_male = get_voice(delim, "male")
            assert res_male == base_male, f"Delimiter test failed for '{delim}' (male)"

def test_stress_voice_map_garbage_and_invalid_inputs():
    garbage_inputs = [
        None,
        "",
        "   ",
        123,
        0,
        -1,
        3.14,
        True,
        False,
        [],
        {},
        "unknown-xyz",
        "???",
        "!!!@#$%",
        "invalid_locale_xyz_123",
        "\t\n\r",
    ]

    for garbage in garbage_inputs:
        # Must never raise an exception and must safely return a Neural fallback voice
        res = get_voice(garbage, "female")
        assert isinstance(res, str)
        assert res.endswith("Neural")
        assert res == "en-IN-NeerjaNeural", f"Garbage input {garbage!r} gave unexpected fallback: {res}"

        # Test garbage gender as well
        res_garbage_gender = get_voice(garbage, garbage)
        assert isinstance(res_garbage_gender, str)
        assert res_garbage_gender.endswith("Neural")
        assert res_garbage_gender == "en-IN-NeerjaNeural"

def test_stress_punjabi_voice_and_gtts_fallback():
    # 1. Verify get_voice for Punjabi returns valid neural voices
    pa_female = get_voice("pa", "female")
    pa_male = get_voice("pa", "male")
    assert pa_female == "pa-IN-OjasNeural"
    assert pa_male == "pa-IN-GurpreetNeural"

    # 2. Verify gTTS handles Punjabi ('pa') directly without crashing
    from gtts import gTTS
    punjabi_text = "ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ, ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?"
    tts = gTTS(text=punjabi_text, lang="pa")
    fp = io.BytesIO()
    tts.write_to_fp(fp)
    audio_bytes = fp.getvalue()
    assert isinstance(audio_bytes, bytes)
    assert len(audio_bytes) > 1000, f"gTTS audio bytes too short: {len(audio_bytes)}"

    # 3. Verify synthesize_speech with gTTS fallback for Punjabi
    async def _test_punjabi_fallback():
        # Simulate Edge-TTS failure
        with patch("edge_tts.Communicate", side_effect=Exception("Edge-TTS Punjabi model unavailable")):
            res = await synthesize_speech(punjabi_text, target_lang="pa")
            assert isinstance(res, bytes)
            assert len(res) > 500, f"synthesize_speech fallback audio too short: {len(res)}"
    asyncio.run(_test_punjabi_fallback())


# ---------------------------------------------------------
# Test Suite 2: SPA Fallback & API Routing Stress Test
# ---------------------------------------------------------

def test_stress_spa_client_routes_when_dist_exists():
    client_routes = [
        "/",
        "/call",
        "/call/",
        "/dashboard/settings",
        "/room/123/subpath",
        "/room/conference-room-99/audio",
        "/arbitrary/nested/client/route/test",
    ]

    for route in client_routes:
        res = client.get(route)
        assert res.status_code == 200, f"Route {route} returned {res.status_code}"
        content_type = res.headers.get("content-type", "")
        assert "text/html" in content_type, f"Route {route} returned non-HTML: {content_type}"
        # Either dist index.html or fallback HTML
        assert len(res.text) > 200

def test_stress_static_assets():
    # Verify static files in dist root
    res_favicon = client.get("/favicon.svg")
    assert res_favicon.status_code == 200
    assert "svg" in res_favicon.headers.get("content-type", "").lower()

    res_manifest = client.get("/manifest.json")
    assert res_manifest.status_code == 200
    assert "json" in res_manifest.headers.get("content-type", "").lower()

    # Nonexistent asset inside /assets directory must return 404 JSON, not HTML
    res_missing_asset = client.get("/assets/nonexistent_bundle_12345.js")
    assert res_missing_asset.status_code == 404
    assert res_missing_asset.headers.get("content-type", "").startswith("application/json")

def test_stress_api_routes_all_methods_and_nonexistent():
    # Valid endpoints return JSON
    res_health = client.get("/api/health")
    assert res_health.status_code == 200
    assert res_health.headers.get("content-type", "").startswith("application/json")
    assert res_health.json()["status"] == "healthy"

    res_rooms = client.get("/api/rooms")
    assert res_rooms.status_code == 200
    assert res_rooms.headers.get("content-type", "").startswith("application/json")

    # API endpoints that do not exist MUST return 404 JSON (or 405 JSON for non-GET), NEVER HTML
    api_404_routes = [
        "/api/nonexistent",
        "/api/nonexistent/",
        "/api/nonexistent/deep/nested/subroute",
        "/api/",
        "/api",
        "/api/v1/unknown",
        "/api/users/profile",
    ]

    for api_path in api_404_routes:
        # Test GET: must strictly return 404 JSON
        res_get = client.get(api_path)
        assert res_get.status_code == 404, f"Path {api_path} GET returned {res_get.status_code}"
        assert res_get.headers.get("content-type", "").startswith("application/json"), \
            f"Path {api_path} GET did not return JSON: {res_get.headers.get('content-type')}"
        data = res_get.json()
        assert "detail" in data

        # Test POST: must return JSON error (404 or 405), never HTML
        res_post = client.post(api_path, json={})
        assert res_post.status_code in (404, 405), f"Path {api_path} POST returned {res_post.status_code}"
        assert res_post.headers.get("content-type", "").startswith("application/json")

        # Test PUT: must return JSON error (404 or 405), never HTML
        res_put = client.put(api_path, json={})
        assert res_put.status_code in (404, 405), f"Path {api_path} PUT returned {res_put.status_code}"
        assert res_put.headers.get("content-type", "").startswith("application/json")

        # Test DELETE: must return JSON error (404 or 405), never HTML
        res_delete = client.delete(api_path)
        assert res_delete.status_code in (404, 405), f"Path {api_path} DELETE returned {res_delete.status_code}"
        assert res_delete.headers.get("content-type", "").startswith("application/json")

def test_stress_spa_fallback_when_dist_does_not_exist():
    # Simulate dist missing
    with patch("os.path.isdir", return_value=False):
        # 1. Root returns 200 HTML with VoiceBridge fallback content
        res_root = client.get("/")
        assert res_root.status_code == 200
        assert "text/html" in res_root.headers.get("content-type", "")
        assert "VoiceBridge" in res_root.text
        assert "FastAPI &amp; Socket.IO Server Operational" in res_root.text

        # 2. Client routes return 200 HTML fallback
        client_routes = [
            "/call",
            "/dashboard/settings",
            "/room/123/subpath",
        ]
        for route in client_routes:
            res = client.get(route)
            assert res.status_code == 200
            assert "text/html" in res.headers.get("content-type", "")
            assert "VoiceBridge" in res.text

        # 3. API routes STILL return 404 JSON (never HTML) even when dist is absent
        api_routes = [
            "/api/nonexistent",
            "/api/",
            "/api",
            "/api/deep/subpath",
        ]
        for api_path in api_routes:
            res_api = client.get(api_path)
            assert res_api.status_code == 404
            assert res_api.headers.get("content-type", "").startswith("application/json")
            assert "detail" in res_api.json()
