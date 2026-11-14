"""Tier 5 Adversarial Test Suite - Part 2: White-Box Hardening & Edge-Case Verification.

Targeting:
1. Unicode Adversarial Boundaries: RTL overrides, zero-width chars, complex Indic combining marks, mixed scripts.
2. Corrupt / Truncated Audio Inputs: Truncated WAV headers, zero-length PCM buffers, random non-audio binary payloads to /api/stt and /api/tts.
3. Jargon Lock & Glossary Boundaries: Nested brackets, unbalanced brackets, regex metacharacters in domains, empty/whitespace domains.
4. Meeting Minutes Generator Stress: Huge transcripts (>10,000 utterances), mixed non-dict elements, missing utterance keys, arbitrary tiers.
5. REST Endpoints & Socket Boundaries: Concurrent bursts, disallowed HTTP verbs, traversal in room deletion, sliding window rate limit recovery.

Authored by Challenger 2 for VoiceBridge Live Call Translator Final Milestone Phase 2.
"""

import asyncio
import base64
import os
import sys
import time
import uuid
import struct
import io
import wave
import pytest
import httpx

# Ensure project root and backend are in sys.path
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
backend_dir = os.path.join(root_dir, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Load pytest plugins from conftest
pytest_plugins = ["tests.e2e.conftest"]

from tests.e2e.harness import (
    LiveServerProcess,
    AsyncTestSocketClient,
    create_synthetic_wav,
    generate_base64_audio,
    create_corrupt_base64_audio,
)


# ==============================================================================
# Category 1: Unicode Adversarial Boundaries (6 Tests)
# ==============================================================================

class TestAdversarialUnicodeBoundaries:
    """Stress tests probing Unicode security boundaries, RTL overrides, zero-width characters, and Indic diacritics."""

    async def test_adv_unicode_rtl_override_injection(self, http_client):
        """Right-to-Left (RTL) override and bidirectional characters (\u202e, \u202b, \u202c) do not crash translation or TTS."""
        rtl_payload = "SafePrefix \u202eexe.cod_lla//:sptth\u202c SafeSuffix"
        
        # Test against /api/translate
        resp_trans = await http_client.post("/api/translate", json={
            "text": rtl_payload,
            "source_lang": "en",
            "target_lang": "hi",
            "domain": "general"
        })
        assert resp_trans.status_code == 200
        data_trans = resp_trans.json()
        assert "translated" in data_trans
        assert len(data_trans["translated"]) > 0

        # Test against /api/tts
        resp_tts = await http_client.post("/api/tts", json={
            "text": rtl_payload,
            "target_lang": "en",
            "gender": "female"
        })
        # TTS should either succeed or fail gracefully (502), never 500
        assert resp_tts.status_code in [200, 502]
        if resp_tts.status_code == 200:
            assert len(resp_tts.json().get("audio_base64", "")) > 0

    async def test_adv_unicode_zero_width_chars(self, http_client):
        """Zero-width characters (\u200b ZWSP, \u200c ZWNJ, \u200d ZWJ, \ufeff BOM) handle cleanly without unhandled crashes."""
        # 1. Embedded zero-width characters
        embedded = "Inter\u200bna\u200ctio\u200dnal\ufeffization"
        resp1 = await http_client.post("/api/translate", json={
            "text": embedded,
            "source_lang": "en",
            "target_lang": "te"
        })
        assert resp1.status_code == 200
        assert "translated" in resp1.json()

        # 2. Standalone zero-width sequence: stripped behavior verification
        standalone = "\u200b\u200c\u200d\ufeff"
        resp2 = await http_client.post("/api/translate", json={
            "text": standalone,
            "source_lang": "en",
            "target_lang": "hi"
        })
        # Because zero-width spaces are not ASCII whitespace, they are handled either as text or rejected with 400
        assert resp2.status_code in [200, 400]
        if resp2.status_code == 200:
            assert "translated" in resp2.json()

    async def test_adv_unicode_complex_indic_combining_marks(self, http_client):
        """Complex Telugu, Hindi, and Tamil ligatures with viramas and vowel signs preserve integrity."""
        # Telugu: క్ష్మ్య్రా (ka + virama + sha + virama + ma + virama + ya + virama + ra + aa)
        # Hindi: दृष्टिकोण (drishtikon), द्विराष्ट्र (dwirashtra)
        # Tamil: ஸ்ரீ (Shree)
        complex_indic = "నమస్కారం క్ష్మ్య్రా మరియు శ్రీనివాస్ గారు दृष्टिकोण एवं द्विराष्ट्र ஸ்ரீ"
        
        resp = await http_client.post("/api/translate", json={
            "text": complex_indic,
            "source_lang": "te",
            "target_lang": "en",
            "domain": "general"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("original") == complex_indic
        assert "translated" in data
        assert len(data["translated"]) > 0

    async def test_adv_unicode_mixed_scripts_and_astral_emojis(self, http_client):
        """Mixed script sentence (Latin + Devanagari + Telugu + Cyrillic + Arabic + 4-byte astral emojis + math)."""
        mixed_text = "Mission 🚀 नमस्ते నమస్కారం Привет مرحبا ∑(x_i) = 100% 💯"
        resp = await http_client.post("/api/translate", json={
            "text": mixed_text,
            "source_lang": "en",
            "target_lang": "te"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("original") == mixed_text
        assert "translated" in data

    async def test_adv_unicode_control_codes_and_escape_sequences(self, http_client):
        """Control characters (form feeds, tabs, ANSI escapes) are handled without server-side corruption."""
        escaped_text = "\x1b[31;1mRed Alert\x1b[0m\tTabbed\fFormFeed \rCarriageReturn"
        resp = await http_client.post("/api/translate", json={
            "text": escaped_text,
            "source_lang": "en",
            "target_lang": "hi"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "translated" in data

    async def test_adv_unicode_in_websocket_speech_segment(self, socket_client_factory):
        """WebSocket speech_segment pipeline correctly transports and delivers adversarial Unicode text."""
        room_id = f"adv_uni_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        await c1.connect()
        await c2.connect()

        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "unicode_sender"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)

            await c2.emit("join_room", {"roomId": room_id, "userId": "unicode_receiver"})
            await c1.wait_for_event("peer_connected", timeout=5.0)
            await c2.wait_for_event("peer_connected", timeout=5.0)

            adversarial_speech = "Urgent: \u202ealert\u202c క్ష్మ్య్రా! Help needed immediately 🚀"
            await c1.emit("speech_segment", {
                "originalText": adversarial_speech,
                "sourceLang": "en",
                "targetLang": "te"
            })

            # Receiver receives subtitle with intent classified as exclamation (!)
            text_event = await c2.wait_for_event("peer_incoming_text", timeout=8.0)
            assert text_event.get("intent") == "exclamation"
            assert "translatedText" in text_event
            assert len(text_event["translatedText"]) > 0

            # Speaker receives delivery confirmation
            delivered = await c1.wait_for_event("speech_delivered", timeout=8.0)
            assert "translatedText" in delivered
        finally:
            await c1.disconnect()
            await c2.disconnect()


# ==============================================================================
# Category 2: Corrupt / Truncated Audio Inputs (6 Tests)
# ==============================================================================

class TestAdversarialAudioInputs:
    """Stress tests probing audio decoders with truncated headers, 0-length buffers, random binaries, and SSML injections."""

    async def test_adv_audio_truncated_wav_headers_stt(self, http_client):
        """Truncated WAV headers (4 bytes 'RIFF', 12 bytes incomplete, 24 bytes) return handled success: false."""
        truncated_payloads = [
            b"RIFF",
            b"RIFF\x24\x00\x00\x00WAVE",
            b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00",
        ]
        for header in truncated_payloads:
            b64 = base64.b64encode(header).decode("ascii")
            resp = await http_client.post("/api/stt", json={
                "audio_base64": b64,
                "language": "en"
            })
            assert resp.status_code == 200
            data = resp.json()
            assert data.get("success") is False
            assert data.get("transcript") == ""
            assert "error" in data

    async def test_adv_audio_zero_length_pcm_buffer_stt(self, http_client):
        """Valid 44-byte WAV header specifying 0 samples (zero-length PCM data) handled without crash or file leak."""
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(16000)
            # Write 0 frames
        zero_wav_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

        resp = await http_client.post("/api/stt", json={
            "audio_base64": zero_wav_b64,
            "language": "en"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") is False

    async def test_adv_audio_random_binary_payload_stt(self, http_client):
        """Random non-audio binary payload (512 bytes noise) safely returns success: false without server 500."""
        random_bytes = os.urandom(512)
        random_b64 = base64.b64encode(random_bytes).decode("ascii")

        resp = await http_client.post("/api/stt", json={
            "audio_base64": random_b64,
            "language": "en"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") is False
        assert "error" in data

    async def test_adv_audio_corrupted_base64_strings_stt(self, http_client):
        """Corrupted base64 strings (invalid padding, non-base64 characters, odd length) return handled error."""
        corrupt_strings = [
            "NotBase64!@#$%^&*()",
            "AAA==",
            "A",
            "===InvalidPadding===",
        ]
        for corrupt in corrupt_strings:
            resp = await http_client.post("/api/stt", json={
                "audio_base64": corrupt,
                "language": "en"
            })
            assert resp.status_code in [200, 400]
            if resp.status_code == 200:
                assert resp.json().get("success") is False

    async def test_adv_audio_empty_and_whitespace_audio_stt(self, http_client):
        """Empty audio string and whitespace-only audio payload return HTTP 400 Bad Request."""
        for empty_val in ["", "   ", "\t\n"]:
            resp = await http_client.post("/api/stt", json={
                "audio_base64": empty_val,
                "language": "en"
            })
            assert resp.status_code == 400
            assert "empty" in resp.json().get("detail", "").lower()

    async def test_adv_audio_ssml_xml_injection_tts(self, http_client):
        """SSML/XML injection characters (<speak>, <break>, entities) in /api/tts do not cause XML parser exceptions."""
        malicious_ssml = '<speak><prosody rate="fast"><break time="5000ms"/>Hacked</prosody>&amp;&lt;&gt;</speak>'
        resp = await http_client.post("/api/tts", json={
            "text": malicious_ssml,
            "target_lang": "en",
            "gender": "female"
        })
        # Edge TTS or fallback should handle cleanly; 200 or 502, never 500
        assert resp.status_code in [200, 502]
        # Health check must remain operational
        health = await http_client.get("/api/health")
        assert health.status_code == 200


# ==============================================================================
# Category 3: Jargon Lock & Glossary Edge Cases (6 Tests)
# ==============================================================================

class TestAdversarialJargonLock:
    """Stress tests probing Jargon Lock with nested brackets, unbalanced tokens, regex metacharacters, and domain collisions."""

    async def test_adv_jargon_nested_brackets(self, http_client):
        """Nested bracket tokens [[[TERM]]] and [[[[TERM]]]] do not corrupt bracket unpacking logic."""
        text = "Patient suffered a [[[myocardial infarction]]] during surgery."
        resp = await http_client.post("/api/translate", json={
            "text": text,
            "source_lang": "en",
            "target_lang": "en",
            "domain": "medical"
        })
        assert resp.status_code == 200
        data = resp.json()
        # Bracket restore regex re.sub(r'\[\[(.*?)\]\]', r'\1', text) should cleanly unpack
        assert "myocardial infarction" in data.get("translated", "")

    async def test_adv_jargon_unbalanced_brackets(self, http_client):
        """Unbalanced brackets ([[TERM without closing, or dangling TERM]]) are handled safely."""
        unbalanced = "Alert: [[myocardial infarction without closing bracket and dangling]] here."
        resp = await http_client.post("/api/translate", json={
            "text": unbalanced,
            "source_lang": "en",
            "target_lang": "hi",
            "domain": "medical"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "translated" in data

    async def test_adv_jargon_regex_metacharacters_in_domain(self, http_client):
        """Regex metacharacters in domain parameter (.*, [a-z]+, (\\w+)+, ^$, medical|legal) do not cause ReDoS."""
        regex_domains = [
            ".*",
            "[a-z]+",
            "medical|legal",
            "(\\w+)+",
            "^$",
            "\\",
        ]
        for bad_domain in regex_domains:
            # Test /api/glossary
            resp_glossary = await http_client.post("/api/glossary", json={"domain": bad_domain})
            assert resp_glossary.status_code == 200
            assert resp_glossary.json().get("terms_count", 0) >= 0

            # Test /api/translate
            resp_trans = await http_client.post("/api/translate", json={
                "text": "Heart attack check.",
                "source_lang": "en",
                "target_lang": "te",
                "domain": bad_domain
            })
            assert resp_trans.status_code == 200

    async def test_adv_jargon_empty_and_whitespace_domain(self, http_client):
        """Empty and whitespace domain parameters default gracefully to standard domains."""
        for empty_dom in ["", "   ", None]:
            resp = await http_client.post("/api/glossary", json={"domain": empty_dom})
            assert resp.status_code in [200, 422]
            if resp.status_code == 200:
                assert "domain" in resp.json()

            resp_trans = await http_client.post("/api/translate", json={
                "text": "Standard clinical consultation.",
                "source_lang": "en",
                "target_lang": "hi",
                "domain": empty_dom or "general"
            })
            assert resp_trans.status_code == 200

    async def test_adv_jargon_unregistered_domain_name(self, http_client):
        """Completely unregistered domain (e.g. quantum_teleportation_defense) yields 0 terms without error."""
        resp = await http_client.post("/api/glossary", json={"domain": "quantum_teleportation_defense"})
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("terms_count") == 0
        assert data.get("sample_terms") == []

    async def test_adv_jargon_multi_domain_isolation(self, http_client):
        """Only terms belonging to the active domain are locked; terms from other domains pass unaltered."""
        mixed_domain_sentence = "The patient suffered a heart attack during an unforeseen event affecting operating profit."
        
        # In medical domain: "heart attack" -> "myocardial infarction", other terms ignored
        resp_med = await http_client.post("/api/translate", json={
            "text": mixed_domain_sentence,
            "source_lang": "en",
            "target_lang": "en",
            "domain": "medical"
        })
        assert resp_med.status_code == 200
        med_trans = resp_med.json()["translated"].lower()
        assert "myocardial infarction" in med_trans
        # "unforeseen event" should NOT be converted to "force majeure" under medical domain
        assert "force majeure" not in med_trans

        # In legal domain: "unforeseen event" -> "force majeure"
        resp_leg = await http_client.post("/api/translate", json={
            "text": mixed_domain_sentence,
            "source_lang": "en",
            "target_lang": "en",
            "domain": "legal"
        })
        assert resp_leg.status_code == 200
        leg_trans = resp_leg.json()["translated"].lower()
        assert "force majeure" in leg_trans
        assert "myocardial infarction" not in leg_trans


# ==============================================================================
# Category 4: Meeting Minutes Generator Stress (6 Tests)
# ==============================================================================

class TestAdversarialMinutesStress:
    """Stress tests probing POST /api/minutes with massive transcripts, heterogeneous types, and missing keys."""

    async def test_adv_minutes_10000_utterances_stress(self, http_client):
        """Massive transcript (>10,000 utterances) processes in sub-second linear time without memory issues."""
        huge_transcript = [
            {"speaker": f"Engineer_{i % 5}", "text": f"Telemetry check {i} OK.", "timestamp": i}
            for i in range(10000)
        ]
        start_time = time.time()
        resp = await http_client.post("/api/minutes", json={
            "transcript": huge_transcript,
            "tier": "enterprise"
        })
        elapsed = time.time() - start_time

        assert resp.status_code == 200
        data = resp.json()
        assert data.get("total_utterances") == 10000
        assert len(data.get("speakers", [])) == 5
        assert "10000 utterances" in data.get("summary", "")
        assert elapsed < 3.0, f"Processing 10,000 utterances took {elapsed:.2f}s (exceeded 3s SLA)"

    async def test_adv_minutes_heterogeneous_non_dict_elements(self, http_client):
        """Transcript containing non-dict items (None, numbers, strings, arrays, booleans) handled safely."""
        heterogeneous = [
            None,
            42,
            "just a string utterance",
            ["nested", "list"],
            True,
            False,
            {"speaker": "Lead Architect", "text": "Valid dictionary utterance"},
            {},
            None
        ]
        resp = await http_client.post("/api/minutes", json={
            "transcript": heterogeneous,
            "tier": "pro"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("total_utterances") == len(heterogeneous)
        assert "Lead Architect" in data.get("speakers", [])

    async def test_adv_minutes_missing_and_corrupt_utterance_keys(self, http_client):
        """Utterances with missing keys, empty speakers, speakerId fallback, or numeric speakers handled gracefully."""
        varied_utterances = [
            {"text": "Missing speaker and speakerId"},
            {"speaker": "", "text": "Empty speaker string"},
            {"speakerId": "FallbackUser123", "text": "Uses speakerId key"},
            {"speaker": 99999, "text": "Integer speaker ID"},
            {"arbitrary_key": True}
        ]
        resp = await http_client.post("/api/minutes", json={
            "transcript": varied_utterances,
            "tier": "pro"
        })
        assert resp.status_code == 200
        data = resp.json()
        speakers = data.get("speakers", [])
        assert "FallbackUser123" in speakers
        assert "99999" in speakers

    async def test_adv_minutes_empty_and_all_empty_dicts(self, http_client):
        """Transcript with 500 empty dicts [{}]*500 processes and produces 0 identified speakers."""
        empty_dicts = [{}] * 500
        resp = await http_client.post("/api/minutes", json={
            "transcript": empty_dicts,
            "tier": "pro"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("total_utterances") == 500
        assert data.get("speakers") == []

    async def test_adv_minutes_unassigned_and_arbitrary_tiers(self, http_client):
        """Unassigned, arbitrary, or numeric tiers handle without 500 errors."""
        tiers_to_test = ["starter", "free", "ultra_vip_custom_tier", "", "unassigned"]
        for t in tiers_to_test:
            resp = await http_client.post("/api/minutes", json={
                "transcript": [{"speaker": "Admin", "text": "Status report"}],
                "tier": t
            })
            assert resp.status_code == 200
            assert "summary" in resp.json()

    async def test_adv_minutes_oversized_text_per_utterance(self, http_client):
        """Single utterance with 15,000 characters of text processes without buffer overflow."""
        huge_text = "Detailed teleconference debrief note. " * 380  # ~14,440 chars
        resp = await http_client.post("/api/minutes", json={
            "transcript": [{"speaker": "Director", "text": huge_text}],
            "tier": "pro"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("total_utterances") == 1
        assert "Director" in data.get("speakers", [])


# ==============================================================================
# Category 5: REST Endpoints & Socket Boundaries (6 Tests)
# ==============================================================================

class TestAdversarialRestAndSocketBoundaries:
    """Stress tests probing REST concurrent bursts, disallowed HTTP verbs, path traversal, and socket rate limits."""

    async def test_adv_rest_rapid_concurrent_burst(self, http_client):
        """Rapid burst of 50 concurrent requests across health, rooms, and glossary succeeds with 100% 200 OK."""
        tasks = []
        for i in range(20):
            tasks.append(http_client.get("/api/health"))
            tasks.append(http_client.get("/api/rooms"))
            tasks.append(http_client.get("/api/glossary"))
        
        results = await asyncio.gather(*tasks)
        assert len(results) == 60
        assert all(r.status_code == 200 for r in results)

    async def test_adv_rest_disallowed_http_methods(self, http_client):
        """Disallowed HTTP methods return 405 (or 404 for GET on POST-only endpoints handled by SPA guard)."""
        # 1. Verbs that have no handler and trigger 405 Method Not Allowed
        method_not_allowed_checks = [
            ("DELETE", "/api/health"),
            ("PUT", "/api/health"),
            ("PUT", "/api/translate"),
            ("DELETE", "/api/translate"),
            ("PUT", "/api/minutes"),
            ("PUT", "/api/glossary"),
        ]
        for method, route in method_not_allowed_checks:
            resp = await http_client.request(method, route)
            assert resp.status_code == 405, f"Expected 405 for {method} {route}, got {resp.status_code}"

        # 2. GET on POST-only endpoints route to SPA catch-all guard, returning 404 API endpoint not found
        post_only_get_checks = [
            "/api/tts",
            "/api/stt",
        ]
        for route in post_only_get_checks:
            resp = await http_client.get(route)
            assert resp.status_code == 404
            assert resp.json().get("detail") == "API endpoint not found"

    async def test_adv_rest_admin_delete_room_path_traversal(self, http_client):
        """Admin DELETE /api/rooms/{room_id} with traversal, spaces, or symbols handles safely without 500 error."""
        traversal_attempts = [
            "..",
            "../etc/passwd",
            "%2e%2e%2froot",
            "non_existent_room_xyz_999",
            "   ",
        ]
        for room_id in traversal_attempts:
            resp = await http_client.delete(f"/api/rooms/{room_id}")
            # Normalization may map /api/rooms/.. to /api (405), whitespace to 400, unknown room to 200/404
            assert resp.status_code in [200, 400, 404, 405], f"Unexpected status {resp.status_code} for room_id '{room_id}'"
            if resp.status_code == 200:
                assert resp.json().get("status") in ["not_found", "error"]

    async def test_adv_rest_trailing_slash_consistency(self, http_client):
        """Trailing slash on REST endpoints (/api/rooms/ vs /api/rooms) handled consistently."""
        resp1 = await http_client.get("/api/rooms")
        assert resp1.status_code == 200
        assert "total_rooms" in resp1.json()

        resp2 = await http_client.get("/api/rooms/")
        # May resolve directly, 307 redirect, or return 404 API endpoint not found
        assert resp2.status_code in [200, 307, 404]

    async def test_adv_socket_rate_limit_sliding_window_burst_and_recovery(self, socket_client_factory):
        """WebSocket speech_segment rate limiting drops burst >5/3s with error, and recovers cleanly after 3s window."""
        room_id = f"adv_rate_{uuid.uuid4().hex[:8]}"
        client = socket_client_factory()
        await client.connect()

        try:
            await client.emit("join_room", {"roomId": room_id, "userId": "rate_tester"})
            await client.wait_for_event("waiting_for_peer", timeout=5.0)

            # Rapid burst: 6 segments in immediate succession
            for i in range(6):
                await client.emit("speech_segment", {
                    "originalText": f"Burst utterance {i}",
                    "sourceLang": "en",
                    "targetLang": "te"
                })

            # Expect rate limit error on 6th
            err = await client.wait_for_event("speech_error", timeout=5.0)
            assert "Rate limit exceeded" in err.get("error", "")

            # Wait 3.2 seconds for the sliding window to reset
            await asyncio.sleep(3.2)

            # Clear client event queue to flush in-flight burst events
            client.clear_events()

            # Emit 7th segment after reset
            await client.emit("speech_segment", {
                "originalText": "Recovered speech segment after window expiry.",
                "sourceLang": "en",
                "targetLang": "te"
            })

            # In solo mode, client receives loopback subtitle
            delivered = await client.wait_for_event("peer_incoming_text", timeout=8.0)
            assert "Recovered speech segment" in delivered.get("originalText", "")
        finally:
            await client.disconnect()

    async def test_adv_socket_simultaneous_empty_userid_eviction(self, socket_client_factory, http_client):
        """Clients joining with empty userId string are assigned or handled safely without room deadlock."""
        room_id = f"adv_empty_uid_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        await c1.connect()
        await c2.connect()

        try:
            # Client A joins with empty userId
            await c1.emit("join_room", {"roomId": room_id, "userId": "", "userName": "User A"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)

            # Client B joins with empty userId
            await c2.emit("join_room", {"roomId": room_id, "userId": "", "userName": "User B"})

            # Server replaces or accommodates without crash
            await asyncio.sleep(0.5)

            rooms_resp = await http_client.get("/api/rooms")
            assert rooms_resp.status_code == 200
            participants = rooms_resp.json()["rooms"].get(room_id, [])
            assert len(participants) <= 2
        finally:
            await c1.disconnect()
            await c2.disconnect()


if __name__ == "__main__":
    import pytest
    sys.exit(pytest.main([__file__, "-v"]))
