"""
Empirical Challenger 1 Stress Test Harness for Milestone 3:
Reproduction Tests & Documentation Synchronization.

Validates:
1. TTS get_voice permutations, casing variants, unknown languages, malformed types, and fallback voice safety.
2. WebSocket speech_segment domain handling (case-insensitivity, whitespace, concurrent spam / rate-limiting, empty text payloads).
3. Package import isolation with purged environment (-E -s), sibling imports without PYTHONPATH, and root main guard.
"""

import sys
import os
import time
import socket
import threading
import subprocess
import asyncio
import socketio
import uvicorn

# Ensure repository root is in sys.path for direct harness execution
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from backend.services.tts import get_voice, VOICE_MAP
from backend.services.glossary import INDUSTRY_DOMAINS, DOMAIN_GLOSSARY_MAP
from backend.main import socket_app
from backend.socket_handlers import rooms, sid_to_room, socket_activity


def get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


# ==============================================================================
# SECTION 1: TTS `get_voice` Stress Testing
# ==============================================================================
def test_tts_locale_casing_permutations():
    print("[CHALLENGE 1.1] Testing TTS get_voice locale casing and delimiter permutations...")
    test_cases = [
        # (input_lang, gender, expected_voice)
        ("HI-in", "female", "hi-IN-SwaraNeural"),
        ("HI-in", "male", "hi-IN-MadhurNeural"),
        ("hi-in", "female", "hi-IN-SwaraNeural"),
        ("HI_IN", "female", "hi-IN-SwaraNeural"),
        ("hi_IN", "male", "hi-IN-MadhurNeural"),
        ("en_us", "female", "en-IN-NeerjaNeural"),
        ("EN_US", "male", "en-IN-PrabhatNeural"),
        ("en-us", "female", "en-IN-NeerjaNeural"),
        ("EN-US", "male", "en-IN-PrabhatNeural"),
        ("ES_mx", "female", "es-ES-ElviraNeural"),
        ("es_mx", "male", "es-ES-AlvaroNeural"),
        ("ES-MX", "female", "es-ES-ElviraNeural"),
        ("ZH_tw", "female", "zh-CN-XiaoxiaoNeural"),
        ("zh_tw", "male", "zh-CN-YunjianNeural"),
        ("ZH-TW", "female", "zh-CN-XiaoxiaoNeural"),
        ("  fr_FR  ", "female", "fr-FR-DeniseNeural"),
        ("\tde-DE\n", "male", "de-DE-KillianNeural"),
        ("Pt_BR", "female", "pt-BR-FranciscaNeural"),
        ("pt_br", "male", "pt-BR-AntonioNeural"),
        ("JA-jp", "female", "ja-JP-NanamiNeural"),
        ("KO-kr", "male", "ko-KR-InJoonNeural"),
        ("AR-sa", "female", "ar-SA-ZariyahNeural"),
        ("RU-ru", "male", "ru-RU-DmitryNeural"),
        ("TE-in", "female", "te-IN-ShrutiNeural"),
        ("ta_IN", "male", "ta-IN-ValluvarNeural"),
        ("BN-in", "female", "bn-IN-TanishaaNeural"),
    ]

    for lang_input, gender, expected in test_cases:
        res = get_voice(lang_input, gender)
        assert res == expected, f"Failed for lang={lang_input!r}, gender={gender!r}: got {res!r}, expected {expected!r}"
        assert res.endswith("Neural"), f"Voice {res!r} does not end with 'Neural'"
    print(f"  --> PASSED: {len(test_cases)} locale casing and delimiter permutations verified.")


def test_tts_unknown_languages_and_edge_types():
    print("[CHALLENGE 1.2] Testing TTS get_voice with unknown languages, malformed inputs & non-strings...")
    edge_cases = [
        ("xx-YY", "female", "en-IN-NeerjaNeural"),
        ("klingon", "female", "en-IN-NeerjaNeural"),
        ("elvish", "male", "en-IN-NeerjaNeural"),  # Unknown lang defaults to fallback female voice
        ("unknown_lang_123", "female", "en-IN-NeerjaNeural"),
        (None, "female", "en-IN-NeerjaNeural"),
        (None, "male", "en-IN-PrabhatNeural"),     # None evaluates to base "en", resolving male voice
        ("", "female", "en-IN-NeerjaNeural"),
        ("", "male", "en-IN-PrabhatNeural"),       # Empty evaluates to base "en", resolving male voice
        ("   ", "female", "en-IN-NeerjaNeural"),
        ("   ", "male", "en-IN-PrabhatNeural"),
        (123, "female", "en-IN-NeerjaNeural"),
        (0, "female", "en-IN-NeerjaNeural"),       # 0 is falsy, defaults to "en"
        (0, "male", "en-IN-PrabhatNeural"),
        (False, "female", "en-IN-NeerjaNeural"),   # False is falsy, defaults to "en"
        (True, "female", "en-IN-NeerjaNeural"),    # "true" is unknown -> fallback
        ("!@#$%", "female", "en-IN-NeerjaNeural"),
        ("<script>", "female", "en-IN-NeerjaNeural"),
        ("../etc/passwd", "female", "en-IN-NeerjaNeural"),
    ]

    for lang_input, gender, expected in edge_cases:
        res = get_voice(lang_input, gender)
        assert res == expected, f"Failed for lang={lang_input!r}, gender={gender!r}: got {res!r}, expected {expected!r}"
        assert res.endswith("Neural"), f"Voice {res!r} does not end with 'Neural'"
    print(f"  --> PASSED: {len(edge_cases)} unknown/malformed language inputs handled safely.")


def test_tts_unknown_genders_and_gender_normalization():
    print("[CHALLENGE 1.3] Testing TTS get_voice with unknown genders and gender casing...")
    gender_cases = [
        # Valid language "te", test gender variants
        ("te", "other", "te-IN-ShrutiNeural"),       # Unknown gender falls back to female
        ("te", "robot", "te-IN-ShrutiNeural"),
        ("te", "alien", "te-IN-ShrutiNeural"),
        ("te", None, "te-IN-ShrutiNeural"),
        ("te", "", "te-IN-ShrutiNeural"),
        ("te", "   ", "te-IN-ShrutiNeural"),
        ("te", 123, "te-IN-ShrutiNeural"),
        ("te", False, "te-IN-ShrutiNeural"),
        ("te", "FEMALE", "te-IN-ShrutiNeural"),
        ("te", "MALE", "te-IN-MohanNeural"),
        ("te", "  Male  ", "te-IN-MohanNeural"),
        ("te", "  fEmAlE\n", "te-IN-ShrutiNeural"),
        # Valid language "hi"
        ("hi", "other", "hi-IN-SwaraNeural"),
        ("hi", "robot", "hi-IN-SwaraNeural"),
        ("hi", "MALE", "hi-IN-MadhurNeural"),
        # Valid language "es"
        ("es", "MALE", "es-ES-AlvaroNeural"),
        ("es", "unknown", "es-ES-ElviraNeural"),
    ]

    for lang_input, gender, expected in gender_cases:
        res = get_voice(lang_input, gender)
        assert res == expected, f"Failed for lang={lang_input!r}, gender={gender!r}: got {res!r}, expected {expected!r}"
    print(f"  --> PASSED: {len(gender_cases)} gender edge cases handled predictably.")


# ==============================================================================
# SECTION 2: WebSocket Domain Handling & Rate-Limit Concurrency Stress Testing
# ==============================================================================
async def run_websocket_stress_tests(server_port: int):
    server_url = f"http://127.0.0.1:{server_port}"
    print(f"[CHALLENGE 2] Connecting async WebSocket clients to {server_url}...")

    # --- Subtest 2.1: Domain Case-Insensitivity & Whitespace ---
    print("  [2.1] Stress-testing domain casing and whitespace normalization...")
    sio = socketio.AsyncClient()
    delivered_event = asyncio.Event()
    delivered_payload = {}

    @sio.event
    def speech_delivered(data):
        delivered_payload.clear()
        delivered_payload.update(data)
        delivered_event.set()

    await sio.connect(server_url)
    await sio.emit("join_room", {"roomId": "room-domain-stress", "userId": "Challenger_User", "language": "en"})
    await asyncio.sleep(0.3)

    domain_cases = [
        # (domain_input, text, expected_term_in_output, forbidden_term)
        ("MEDICAL", "The patient suffered a severe heart attack", "myocardial infarction", None),
        ("  FinTech  ", "We must optimize our operating profit", "ebitda margin", None),
        ("General", "The patient suffered a severe heart attack", "heart attack", "myocardial infarction"),
        ("LEGAL", "This is an unforeseen event beyond control", "force majeure", None),
        ("  defense  ", "The flight computer was calibrated", "avionics flight management system", None),
        ("engineering", "Ensure safe retry for API requests", "idempotent execution", None),
        ("   ", "The patient suffered a severe heart attack", "heart attack", "myocardial infarction"),
        (None, "The patient suffered a severe heart attack", "heart attack", "myocardial infarction"),
        ("unknown_domain_999", "The patient suffered a severe heart attack", "heart attack", "myocardial infarction"),
    ]

    for idx, (domain_val, text_input, expected_term, forbidden_term) in enumerate(domain_cases):
        # Respect rate limit window (max 5 per 3s): pause after every 4 requests
        if idx > 0 and idx % 4 == 0:
            await asyncio.sleep(3.2)

        delivered_event.clear()
        payload = {
            "originalText": text_input,
            "sourceLang": "en",
            "targetLang": "en",
        }
        if domain_val is not None:
            payload["domain"] = domain_val

        await sio.emit("speech_segment", payload)
        await asyncio.wait_for(delivered_event.wait(), timeout=6.0)

        output_text = delivered_payload.get("translatedText", "").lower()
        assert expected_term.lower() in output_text, (
            f"Failed domain={domain_val!r}: '{expected_term}' not found in output: '{output_text}'"
        )
        if forbidden_term:
            assert forbidden_term.lower() not in output_text, (
                f"Failed domain={domain_val!r}: '{forbidden_term}' unexpectedly found in output: '{output_text}'"
            )

    print(f"  --> PASSED: {len(domain_cases)} domain casing/whitespace/fallback test cases succeeded.")

    # --- Subtest 2.2: Empty & Whitespace Text with Domain Specified ---
    print("  [2.2] Stress-testing empty text and malformed payloads with domain specified...")
    empty_cases = [
        {"originalText": "", "domain": "medical", "sourceLang": "en", "targetLang": "en"},
        {"originalText": "   ", "domain": "fintech", "sourceLang": "en", "targetLang": "en"},
        {"originalText": None, "domain": "legal", "sourceLang": "en", "targetLang": "en"},
        {"originalText": "\t\n  ", "domain": "engineering", "sourceLang": "en", "targetLang": "en"},
    ]

    for empty_payload in empty_cases:
        delivered_event.clear()
        # Should return early without raising exceptions or triggering speech_delivered
        await sio.emit("speech_segment", empty_payload)
        await asyncio.sleep(0.3)
        assert not delivered_event.is_set(), f"Empty payload {empty_payload} unexpectedly emitted delivery!"

    # Malformed non-dict payload
    await sio.emit("speech_segment", "not-a-dict-string")
    await asyncio.sleep(0.2)

    print(f"  --> PASSED: {len(empty_cases)} empty/malformed text payloads safely handled.")

    # --- Subtest 2.3: Rapid Concurrent Emissions & Sliding Window Rate Limiting ---
    print("  [2.3] Stress-testing rapid concurrent speech_segment emissions and rate limit handling...")
    error_event = asyncio.Event()
    error_payload = {}

    @sio.event
    def speech_error(data):
        error_payload.clear()
        error_payload.update(data)
        error_event.set()

    # Sleep to allow any previous rate limit window (3.0s) to clear
    await asyncio.sleep(3.5)

    # Emit 8 rapid speech segments in tight loop (< 0.5s total)
    # The first 5 should succeed, segments 6, 7, 8 should trigger speech_error rate limit
    for i in range(8):
        await sio.emit("speech_segment", {
            "originalText": f"Rapid test statement number {i}",
            "sourceLang": "en",
            "targetLang": "en",
            "domain": "medical"
        })

    # Wait for rate limit error to fire
    await asyncio.wait_for(error_event.wait(), timeout=5.0)
    assert "Rate limit exceeded" in error_payload.get("error", ""), (
        f"Expected 'Rate limit exceeded', got: {error_payload}"
    )
    print("  --> Rate limit properly caught excess traffic without socket server degradation.")

    await sio.disconnect()

    # --- Subtest 2.4: Multi-Client Concurrent Isolation ---
    print("  [2.4] Stress-testing dual concurrent clients in separate rooms...")
    client_a = socketio.AsyncClient()
    client_b = socketio.AsyncClient()

    event_a = asyncio.Event()
    event_b = asyncio.Event()
    payload_a = {}
    payload_b = {}

    @client_a.event
    def speech_delivered(data):
        payload_a.clear()
        payload_a.update(data)
        event_a.set()

    @client_b.event
    def speech_delivered(data):
        payload_b.clear()
        payload_b.update(data)
        event_b.set()

    await client_a.connect(server_url)
    await client_b.connect(server_url)

    await client_a.emit("join_room", {"roomId": "room-concurrent-a", "userId": "UserA", "language": "en"})
    await client_b.emit("join_room", {"roomId": "room-concurrent-b", "userId": "UserB", "language": "en"})
    await asyncio.sleep(0.3)

    # Simultaneously emit from both clients with different domains
    t1 = client_a.emit("speech_segment", {
        "originalText": "The patient suffered a severe heart attack",
        "sourceLang": "en",
        "targetLang": "en",
        "domain": "medical"
    })
    t2 = client_b.emit("speech_segment", {
        "originalText": "We must optimize our operating profit",
        "sourceLang": "en",
        "targetLang": "en",
        "domain": "fintech"
    })
    await asyncio.gather(t1, t2)

    await asyncio.wait_for(asyncio.gather(event_a.wait(), event_b.wait()), timeout=7.0)

    assert "myocardial infarction" in payload_a.get("translatedText", "").lower()
    assert "ebitda margin" in payload_b.get("translatedText", "").lower()

    await client_a.disconnect()
    await client_b.disconnect()
    print("  --> PASSED: Concurrent multi-client emissions preserved independent domain glossary translations.")


# ==============================================================================
# SECTION 3: Package Import Isolation & Subprocess Stress Testing
# ==============================================================================
def test_subprocess_import_isolation():
    print("[CHALLENGE 3] Testing package import isolation with purged environment (-E and -E -s)...")

    # Clean minimal environment without PYTHONPATH or PYTHONHOME
    # On Windows, SYSTEMROOT, PATH, and APPDATA (for user-site dependencies) are needed by the OS/Python
    isolated_env = {
        "SYSTEMROOT": os.environ.get("SYSTEMROOT", "C:\\Windows"),
        "PATH": os.environ.get("PATH", ""),
        "WINDIR": os.environ.get("WINDIR", "C:\\Windows"),
        "APPDATA": os.environ.get("APPDATA", ""),
    }
    # Explicitly ensure PYTHONPATH and PYTHONHOME are omitted
    assert "PYTHONPATH" not in isolated_env
    assert "PYTHONHOME" not in isolated_env

    # 3.1: Strict standard-library module isolation with python -E -s (no PYTHONPATH, no user-site)
    # Verifies pure backend services (glossary, prosody) have zero external dependencies and import under -E -s
    cmd_1 = [
        sys.executable, "-E", "-s", "-c",
        "import backend.services.glossary; import backend.services.prosody_engine; print('STRICT_ISOLATION_OK')"
    ]
    proc_1 = subprocess.run(cmd_1, cwd=ROOT_DIR, env=isolated_env, capture_output=True, text=True)
    assert proc_1.returncode == 0, f"Subprocess 3.1 failed (code {proc_1.returncode}):\n{proc_1.stderr}"
    assert "STRICT_ISOLATION_OK" in proc_1.stdout
    print("  --> [3.1] Pure backend services import with python -E -s (zero external deps): OK")

    # 3.2: Subprocess execution with purged PYTHONPATH (-E) for full application modules from root
    cmd_2 = [
        sys.executable, "-E", "-c",
        "import backend.socket_handlers; import backend.main; import backend.services.tts; import backend.services.translator; print('PACKAGE_ISOLATION_OK')"
    ]
    proc_2 = subprocess.run(cmd_2, cwd=ROOT_DIR, env=isolated_env, capture_output=True, text=True)
    assert proc_2.returncode == 0, f"Subprocess 3.2 failed (code {proc_2.returncode}):\n{proc_2.stderr}"
    assert "PACKAGE_ISOLATION_OK" in proc_2.stdout
    print("  --> [3.2] Full application modules import with python -E (no PYTHONPATH) from root: OK")

    # 3.3: Sibling module import without PYTHONPATH from backend/ directory
    cmd_3 = [
        sys.executable, "-E", "-c",
        "import socket_handlers; import main; import services.tts; import services.glossary; print('SIBLING_OK')"
    ]
    proc_3 = subprocess.run(cmd_3, cwd=BACKEND_DIR, env=isolated_env, capture_output=True, text=True)
    assert proc_3.returncode == 0, f"Subprocess 3.3 failed (code {proc_3.returncode}):\n{proc_3.stderr}"
    assert "SIBLING_OK" in proc_3.stdout
    print("  --> [3.3] Sibling module imports with python -E from backend/ directory: OK")

    # 3.4: Root main execution guard (verify import does NOT run server or block)
    cmd_4 = [
        sys.executable, "-E", "-c",
        "import main; assert callable(main.run); print('ROOT_MAIN_GUARD_OK')"
    ]
    proc_4 = subprocess.run(cmd_4, cwd=ROOT_DIR, env=isolated_env, capture_output=True, text=True, timeout=5)
    assert proc_4.returncode == 0, f"Subprocess 3.4 failed (code {proc_4.returncode}):\n{proc_4.stderr}"
    assert "ROOT_MAIN_GUARD_OK" in proc_4.stdout
    print("  --> [3.4] Root main.py guard check: OK")

    # 3.5: Cross-package call execution under isolated environment
    cmd_5 = [
        sys.executable, "-E", "-c",
        "from backend.services.tts import get_voice; voice = get_voice('HI-in', 'female'); assert voice == 'hi-IN-SwaraNeural'; print(f'VOICE_OK:{voice}')"
    ]
    proc_5 = subprocess.run(cmd_5, cwd=ROOT_DIR, env=isolated_env, capture_output=True, text=True)
    assert proc_5.returncode == 0, f"Subprocess 3.5 failed (code {proc_5.returncode}):\n{proc_5.stderr}"
    assert "VOICE_OK:hi-IN-SwaraNeural" in proc_5.stdout
    print("  --> [3.5] Isolated functional call execution: OK")


# ==============================================================================
# MAIN TEST HARNESS RUNNER
# ==============================================================================
def main():
    print("=" * 80)
    print("MILESTONE 3: EMPIRICAL CHALLENGER 1 STRESS HARNESS")
    print("=" * 80)

    start_time = time.time()

    # Part 1: TTS Stress Tests
    test_tts_locale_casing_permutations()
    test_tts_unknown_languages_and_edge_types()
    test_tts_unknown_genders_and_gender_normalization()

    # Part 2: WebSocket Stress Tests
    port = get_free_port()
    config = uvicorn.Config(socket_app, host="127.0.0.1", port=port, log_level="error")
    server = uvicorn.Server(config)
    server_thread = threading.Thread(target=server.run, daemon=True)
    server_thread.start()
    time.sleep(1.2)  # Allow server to bind

    try:
        asyncio.run(run_websocket_stress_tests(port))
    finally:
        server.should_exit = True
        server_thread.join(timeout=2.0)
        rooms.clear()
        sid_to_room.clear()
        socket_activity.clear()

    # Part 3: Package Import Isolation Stress Tests
    test_subprocess_import_isolation()

    duration = time.time() - start_time
    print("=" * 80)
    print(f"ALL EMPIRICAL CHALLENGER STRESS TESTS PASSED IN {duration:.2f}s!")
    print("VERDICT: ZERO FAILURES / ZERO VULNERABILITIES DETECTED.")
    print("=" * 80)


if __name__ == "__main__":
    main()
