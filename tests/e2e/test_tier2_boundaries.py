"""Tier 2: Boundary, Edge Cases, and Resilience Test Suite.

Contains 60 comprehensive, opaque-box E2E test cases validating Features F1 through F12
under boundary, corner-case, negative, and stress conditions (5 tests per feature).

All tests interact with the system under test strictly through external network interfaces
(HTTP REST endpoints and Socket.IO real-time channels) with zero internal coupling.
"""

import asyncio
import base64
import time
import uuid
import pytest
from tests.e2e.harness import (
    create_synthetic_wav,
    generate_base64_audio,
    create_corrupt_base64_audio,
)


# ==============================================================================
# Feature 1: System Health Boundaries (F1) - 5 Tests
# ==============================================================================

class TestTier2F1SystemHealthBoundaries:
    """Feature 1 Boundaries: HTTP method restrictions, routing edge cases, malformed queries, bursts."""

    async def test_t2_f1_01_post_health_method_not_allowed(self, http_client):
        """POST to /api/health returns 405 Method Not Allowed."""
        resp = await http_client.post("/api/health")
        assert resp.status_code == 405

    async def test_t2_f1_02_trailing_slash_handling(self, http_client):
        """Trailing slash handling (/api/health/ vs /api/health) resolves cleanly."""
        resp_norm = await http_client.get("/api/health")
        assert resp_norm.status_code == 200
        assert resp_norm.json().get("status") == "healthy"

        resp_slash = await http_client.get("/api/health/")
        assert resp_slash.status_code in [200, 307, 404]
        if resp_slash.status_code == 404:
            assert resp_slash.json().get("detail") == "API endpoint not found"

    async def test_t2_f1_03_nonexistent_api_endpoint_404_json(self, http_client):
        """Non-existent endpoint under /api/ returns 404 with {"detail": "API endpoint not found"}."""
        resp = await http_client.get("/api/nonexistent_route_boundary_test")
        assert resp.status_code == 404
        data = resp.json()
        assert data.get("detail") == "API endpoint not found"

    async def test_t2_f1_04_corrupted_malformed_payload_health(self, http_client):
        """Corrupted/malformed payload or unusual query parameters to /api/health succeed with 200."""
        resp = await http_client.get("/api/health?param=<script>alert(1)</script>&corrupt=%%20%%99")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") == "healthy"

    async def test_t2_f1_05_rapid_burst_health_checks(self, http_client):
        """Rapid burst of 20 back-to-back health checks succeeds without 500 errors."""
        tasks = [http_client.get("/api/health") for _ in range(20)]
        results = await asyncio.gather(*tasks)
        assert all(r.status_code == 200 for r in results)
        assert all(r.json().get("status") == "healthy" for r in results)


# ==============================================================================
# Feature 2: Language Registry Boundaries (F2) - 5 Tests
# ==============================================================================

class TestTier2F2LanguageRegistryBoundaries:
    """Feature 2 Boundaries: Language code normalization, invalid codes, domain length limits."""

    async def test_t2_f2_01_uppercase_or_mixed_case_languages(self, http_client):
        """Query with uppercase or mixed-case language codes normalizes and handles gracefully."""
        resp = await http_client.post("/api/translate", json={
            "text": "Good morning",
            "source_lang": "EN-us",
            "target_lang": "TE-in",
            "domain": "general"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "translated" in data
        assert data["source_lang"].lower() in ["en-us", "en"]

    async def test_t2_f2_02_unknown_or_invalid_language_code(self, http_client):
        """Query with unknown / invalid language code returns fallback or handled response without 500."""
        resp = await http_client.post("/api/translate", json={
            "text": "System boundary test phrase",
            "source_lang": "klingon",
            "target_lang": "elvish",
            "domain": "general"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("translated") is not None
        assert len(data["translated"]) > 0

    async def test_t2_f2_03_glossary_empty_or_nonexistent_domain(self, http_client):
        """POST /api/glossary with empty domain string or non-existent domain returns snapshot cleanly."""
        resp_empty = await http_client.post("/api/glossary", json={"domain": ""})
        assert resp_empty.status_code == 200
        data_empty = resp_empty.json()
        assert "domain" in data_empty

        resp_nonexistent = await http_client.post("/api/glossary", json={"domain": "astronomy"})
        assert resp_nonexistent.status_code == 200
        data_nonexistent = resp_nonexistent.json()
        assert data_nonexistent.get("domain") == "astronomy"
        assert data_nonexistent.get("terms_count", 0) >= 0

    async def test_t2_f2_04_glossary_excessively_long_domain(self, http_client):
        """POST /api/glossary with excessively long domain string (>100 chars) handles without 500."""
        huge_domain = "engineering_" + ("x" * 120)
        resp = await http_client.post("/api/glossary", json={"domain": huge_domain})
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("domain") == huge_domain

    async def test_t2_f2_05_non_string_types_in_language(self, http_client):
        """Non-string or invalid structured types in language parameters are handled gracefully."""
        resp = await http_client.post("/api/translate", json={
            "text": "Hello boundary",
            "source_lang": 12345,
            "target_lang": ["invalid_array_code"]
        })
        # Pydantic validation rejects array with 422 Unprocessable Entity
        assert resp.status_code in [200, 422]
        if resp.status_code == 422:
            assert "detail" in resp.json()


# ==============================================================================
# Feature 3: REST Translation Boundaries (F3) - 5 Tests
# ==============================================================================

class TestTier2F3TranslationBoundaries:
    """Feature 3 Boundaries: Empty strings, payload slicing, Unicode preservation, 422 validation."""

    async def test_t2_f3_01_empty_text_returns_400(self, http_client):
        """Empty text string "" and whitespace-only text return HTTP 400 Bad Request."""
        resp1 = await http_client.post("/api/translate", json={"text": "", "source_lang": "en", "target_lang": "hi"})
        assert resp1.status_code == 400
        assert "empty" in resp1.json().get("detail", "").lower()

        resp2 = await http_client.post("/api/translate", json={"text": "    ", "source_lang": "en", "target_lang": "hi"})
        assert resp2.status_code == 400
        assert "empty" in resp2.json().get("detail", "").lower()

    async def test_t2_f3_02_oversized_text_truncated_or_capped(self, http_client):
        """Oversized text (>1000 characters) is capped to 1000 characters cleanly."""
        long_text = "Teleconference boundary verification string. " * 35  # ~1575 chars
        resp = await http_client.post("/api/translate", json={
            "text": long_text,
            "source_lang": "en",
            "target_lang": "hi"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert len(data.get("original", "")) <= 1000

    async def test_t2_f3_03_unicode_emojis_math_and_mixed_scripts(self, http_client):
        """Unicode emojis, math symbols, and mixed scripts are preserved without corruption."""
        complex_text = "Mission Control 🚀 ∑(x_i) = 100% నమస్కారం नमस्ते"
        resp = await http_client.post("/api/translate", json={
            "text": complex_text,
            "source_lang": "en",
            "target_lang": "te"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("original") == complex_text
        assert "translated" in data
        assert len(data["translated"]) > 0

    async def test_t2_f3_04_identical_source_and_target_language(self, http_client):
        """Translation with identical source and target language returns original text."""
        original = "Immediate loopback verification without translation engine."
        resp = await http_client.post("/api/translate", json={
            "text": original,
            "source_lang": "en",
            "target_lang": "en"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("translated") == original

    async def test_t2_f3_05_missing_required_fields_translate_returns_422(self, http_client):
        """Missing or malformed required fields in POST /api/translate returns 400 or 422."""
        # Missing text field defaults to empty string, returning 400 Bad Request
        resp_missing = await http_client.post("/api/translate", json={
            "source_lang": "en",
            "target_lang": "hi"
        })
        assert resp_missing.status_code in [400, 422]

        # Malformed type for required text field triggers Pydantic 422 Unprocessable Entity
        resp_malformed = await http_client.post("/api/translate", json={
            "text": ["invalid_nested_array"],
            "source_lang": "en",
            "target_lang": "hi"
        })
        assert resp_malformed.status_code == 422
        data = resp_malformed.json()
        assert "detail" in data


# ==============================================================================
# Feature 4: REST Neural TTS Boundaries (F4) - 5 Tests
# ==============================================================================

class TestTier2F4NeuralTTSBoundaries:
    """Feature 4 Boundaries: Empty text, massive text payloads, voice fallbacks, gender fallbacks."""

    async def test_t2_f4_01_empty_text_returns_400(self, http_client):
        """Empty text string "" and whitespace-only text return HTTP 400 Bad Request."""
        resp1 = await http_client.post("/api/tts", json={"text": "", "target_lang": "en", "gender": "female"})
        assert resp1.status_code == 400
        assert "empty" in resp1.json().get("detail", "").lower()

        resp2 = await http_client.post("/api/tts", json={"text": "   ", "target_lang": "en", "gender": "female"})
        assert resp2.status_code == 400
        assert "empty" in resp2.json().get("detail", "").lower()

    async def test_t2_f4_02_massive_text_over_2500_chars(self, http_client):
        """Massive text (>2500 characters) synthesizes or fails gracefully without server crash."""
        massive_text = "This is a long synthetic speech sentence designed to test buffer boundary limits. " * 40
        resp = await http_client.post("/api/tts", json={
            "text": massive_text,
            "target_lang": "en",
            "gender": "female"
        })
        # Server truncates to 1000 and either succeeds or returns 502, never 500
        assert resp.status_code in [200, 502]
        # Confirm server remains healthy
        health = await http_client.get("/api/health")
        assert health.status_code == 200

    async def test_t2_f4_03_invalid_unsupported_language_fallback(self, http_client):
        """Invalid/unsupported language code falls back to default voice."""
        resp = await http_client.post("/api/tts", json={
            "text": "Testing unsupported voice fallback mechanism.",
            "target_lang": "klingon-99",
            "gender": "female"
        })
        assert resp.status_code in [200, 502]
        if resp.status_code == 200:
            data = resp.json()
            assert "audio_base64" in data
            assert len(data["audio_base64"]) > 0

    async def test_t2_f4_04_unknown_gender_fallback(self, http_client):
        """Unknown gender parameter (e.g. 'alien') falls back to default female gender."""
        resp = await http_client.post("/api/tts", json={
            "text": "Gender normalization verification utterance.",
            "target_lang": "en",
            "gender": "alien"
        })
        assert resp.status_code in [200, 502]
        if resp.status_code == 200:
            data = resp.json()
            assert data.get("gender") == "female"
            assert "audio_base64" in data

    async def test_t2_f4_05_punctuation_only_text(self, http_client):
        """Text consisting solely of punctuation characters (e.g. '???...!!!') handles without crash."""
        resp = await http_client.post("/api/tts", json={
            "text": "???...!!!",
            "target_lang": "en",
            "gender": "female"
        })
        assert resp.status_code in [200, 400, 502]
        health = await http_client.get("/api/health")
        assert health.status_code == 200


# ==============================================================================
# Feature 5: REST STT Audio Boundaries (F5) - 5 Tests
# ==============================================================================

class TestTier2F5STTAudioBoundaries:
    """Feature 5 Boundaries: Empty audio, corrupt base64, random non-audio bytes, empty WAVs."""

    async def test_t2_f5_01_empty_base64_returns_400(self, http_client):
        """Empty base64 string "" returns HTTP 400 Bad Request."""
        resp = await http_client.post("/api/stt", json={"audio_base64": "", "language": "en"})
        assert resp.status_code == 400
        assert "empty" in resp.json().get("detail", "").lower()

        resp_ws = await http_client.post("/api/stt", json={"audio_base64": "   ", "language": "en"})
        assert resp_ws.status_code == 400

    async def test_t2_f5_02_corrupt_invalid_base64_returns_handled(self, http_client):
        """Corrupt / invalid base64 string returns HTTP 200 with success: false or 400."""
        resp = await http_client.post("/api/stt", json={
            "audio_base64": "corrupt_non_base64_string_%%%^^^",
            "language": "en"
        })
        assert resp.status_code in [200, 400]
        if resp.status_code == 200:
            data = resp.json()
            assert data.get("success") is False
            assert "error" in data

    async def test_t2_f5_03_non_audio_random_bytes_b64(self, http_client):
        """Valid base64 encoding of non-audio random bytes returns 200 with success: false."""
        random_payload = base64.b64encode(b"THIS_IS_DEFINITELY_NOT_WAV_AUDIO_DATA_AT_ALL").decode("utf-8")
        resp = await http_client.post("/api/stt", json={
            "audio_base64": random_payload,
            "language": "en"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") is False

    async def test_t2_f5_04_zero_bytes_or_empty_wav_header(self, http_client):
        """Audio with zero bytes / empty WAV header returns 200 with success: false."""
        empty_wav_header = b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
        header_b64 = base64.b64encode(empty_wav_header).decode("utf-8")
        resp = await http_client.post("/api/stt", json={
            "audio_base64": header_b64,
            "language": "en"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") is False

    async def test_t2_f5_05_unsupported_sample_rate_or_unknown_language(self, http_client):
        """Unsupported audio sample rate or unknown language code returns 200 with success: false."""
        valid_b64 = generate_base64_audio(duration_ms=200, sample_rate=8000)
        resp = await http_client.post("/api/stt", json={
            "audio_base64": valid_b64,
            "language": "klingon-XX"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") is False


# ==============================================================================
# Feature 6: WebSocket Room Lifecycle Boundaries (F6) - 5 Tests
# ==============================================================================

class TestTier2F6WebSocketRoomBoundaries:
    """Feature 6 Boundaries: Regex validation, capacity rejection, duplicate joins, missing room 404."""

    async def test_t2_f6_01_room_id_invalid_characters(self, socket_client_factory):
        """Room ID with invalid characters (spaces, html tags, symbols) rejected with 'error' event."""
        client = socket_client_factory()
        await client.connect()
        try:
            await client.emit("join_room", {
                "roomId": "<script>alert('xss')</script>",
                "userId": "user_invalid_char"
            })
            error_data = await client.wait_for_event("error", timeout=5.0)
            assert "Invalid roomId" in error_data.get("message", "")
        finally:
            await client.disconnect()

    async def test_t2_f6_02_room_id_too_short_or_too_long(self, socket_client_factory):
        """Room ID shorter than 3 chars or longer than 32 chars rejected with 'error' event."""
        client = socket_client_factory()
        await client.connect()
        try:
            # 2 chars: too short
            await client.emit("join_room", {"roomId": "ab", "userId": "user_short"})
            err_short = await client.wait_for_event("error", timeout=5.0)
            assert "Invalid roomId" in err_short.get("message", "")

            # 33 chars: too long
            await client.emit("join_room", {"roomId": "a" * 33, "userId": "user_long"})
            err_long = await client.wait_for_event("error", timeout=5.0)
            assert "Invalid roomId" in err_long.get("message", "")
        finally:
            await client.disconnect()

    async def test_t2_f6_03_room_capacity_third_client_rejected(self, socket_client_factory):
        """Room capacity limit: 3rd client attempting to join full room receives 'room_full' event."""
        room_id = f"cap_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        c3 = socket_client_factory()

        await c1.connect()
        await c2.connect()
        await c3.connect()

        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "u1", "userName": "Caller 1"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)

            await c2.emit("join_room", {"roomId": room_id, "userId": "u2", "userName": "Caller 2"})
            await c2.wait_for_event("peer_connected", timeout=5.0)

            # 3rd client attempts entry
            await c3.emit("join_room", {"roomId": room_id, "userId": "u3", "userName": "Caller 3"})
            full_data = await c3.wait_for_event("room_full", timeout=5.0)
            assert "maximum capacity" in full_data.get("message", "").lower()
        finally:
            await c1.disconnect()
            await c2.disconnect()
            await c3.disconnect()

    async def test_t2_f6_04_duplicate_join_room_same_connection(self, socket_client_factory):
        """Duplicate join_room event from same socket connection maintains clean room state."""
        room_id = f"dup_{uuid.uuid4().hex[:8]}"
        client = socket_client_factory()
        await client.connect()

        try:
            await client.emit("join_room", {"roomId": room_id, "userId": "user_dup", "userName": "Initial"})
            await client.wait_for_event("waiting_for_peer", timeout=5.0)

            # Re-emit join_room on the same socket
            await client.emit("join_room", {"roomId": room_id, "userId": "user_dup", "userName": "Updated"})
            await asyncio.sleep(0.3)

            # No room_full or unhandled error event emitted
            full_events = client.get_events("room_full")
            assert len(full_events) == 0
        finally:
            await client.disconnect()

    async def test_t2_f6_05_delete_nonexistent_room(self, http_client):
        """DELETE /api/rooms/non_existent_room returns 200 with not_found status."""
        resp = await http_client.delete("/api/rooms/room_non_existent_12345")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") == "not_found"
        assert "not found" in data.get("message", "").lower()


# ==============================================================================
# Feature 7: WebRTC Signaling Boundaries (F7) - 5 Tests
# ==============================================================================

class TestTier2F7WebRTCSignalingBoundaries:
    """Feature 7 Boundaries: Signaling before join, solo signaling, malformed SDP, large SDP, mute toggle."""

    async def test_t2_f7_01_webrtc_offer_before_join_room_dropped(self, socket_client_factory, http_client):
        """Signaling event (webrtc_offer) sent before joining room dropped safely without crashing."""
        client = socket_client_factory()
        await client.connect()
        try:
            await client.emit("webrtc_offer", {"type": "offer", "sdp": "v=0\r\no=alice..."})
            await asyncio.sleep(0.3)

            # Server remains healthy
            resp = await http_client.get("/api/health")
            assert resp.status_code == 200
        finally:
            await client.disconnect()

    async def test_t2_f7_02_signaling_when_no_peer_connected(self, socket_client_factory):
        """Signaling sent when no peer is connected (solo in room) dropped safely."""
        room_id = f"sig_{uuid.uuid4().hex[:8]}"
        client = socket_client_factory()
        await client.connect()
        try:
            await client.emit("join_room", {"roomId": room_id, "userId": "solo_caller"})
            await client.wait_for_event("waiting_for_peer", timeout=5.0)

            await client.emit("webrtc_offer", {"type": "offer", "sdp": "v=0..."})
            await client.emit("webrtc_answer", {"type": "answer", "sdp": "v=0..."})
            await client.emit("webrtc_ice_candidate", {"candidate": "candidate:1 1 UDP..."})
            await asyncio.sleep(0.3)

            # No errors received
            assert len(client.get_events("error")) == 0
        finally:
            await client.disconnect()

    async def test_t2_f7_03_signaling_malformed_sdp_payload(self, socket_client_factory):
        """Signaling payload with missing or malformed SDP structure relays or drops safely."""
        room_id = f"mal_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        await c1.connect()
        await c2.connect()

        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "peer1"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)

            await c2.emit("join_room", {"roomId": room_id, "userId": "peer2"})
            await c1.wait_for_event("peer_connected", timeout=5.0)
            await c2.wait_for_event("peer_connected", timeout=5.0)

            # Emit empty dict and non-standard structure
            await c1.emit("webrtc_offer", {})
            event_data = await c2.wait_for_event("webrtc_offer", timeout=5.0)
            assert isinstance(event_data, dict)
        finally:
            await c1.disconnect()
            await c2.disconnect()

    async def test_t2_f7_04_huge_sdp_payload_relayed(self, socket_client_factory):
        """Huge SDP payload (>10KB) relayed without truncation or crash."""
        room_id = f"huge_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        await c1.connect()
        await c2.connect()

        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "peerA"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)

            await c2.emit("join_room", {"roomId": room_id, "userId": "peerB"})
            await c1.wait_for_event("peer_connected", timeout=5.0)
            await c2.wait_for_event("peer_connected", timeout=5.0)

            huge_sdp = "v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\ns=-\r\n" + ("a=candidate:boundary " * 800)
            assert len(huge_sdp) > 10000

            await c1.emit("webrtc_offer", {"type": "offer", "sdp": huge_sdp})
            received = await c2.wait_for_event("webrtc_offer", timeout=5.0)
            assert received.get("sdp") == huge_sdp
        finally:
            await c1.disconnect()
            await c2.disconnect()

    async def test_t2_f7_05_toggle_mute_before_join_room(self, socket_client_factory, http_client):
        """toggle_mute sent before join_room handled safely without server crash."""
        client = socket_client_factory()
        await client.connect()
        try:
            await client.emit("toggle_mute", {"isMuted": True})
            await asyncio.sleep(0.3)

            resp = await http_client.get("/api/health")
            assert resp.status_code == 200
        finally:
            await client.disconnect()


# ==============================================================================
# Feature 8: Speech Pipeline Boundaries (F8) - 5 Tests
# ==============================================================================

class TestTier2F8SpeechPipelineBoundaries:
    """Feature 8 Boundaries: Muted caller, rate limit bursts, text truncation, empty text, post-disconnect."""

    async def test_t2_f8_01_speech_segment_when_muted_dropped(self, socket_client_factory):
        """Speech segment sent when caller is muted (isMuted: true) is dropped silently."""
        room_id = f"mute_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        await c1.connect()
        await c2.connect()

        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "caller_mute"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)

            await c2.emit("join_room", {"roomId": room_id, "userId": "receiver_mute"})
            await c1.wait_for_event("peer_connected", timeout=5.0)
            await c2.wait_for_event("peer_connected", timeout=5.0)

            # Mute caller
            await c1.emit("toggle_mute", {"isMuted": True})
            await c2.wait_for_event("peer_mute_changed", timeout=5.0)

            # Speak while muted
            await c1.emit("speech_segment", {
                "originalText": "This speech must be dropped silently.",
                "sourceLang": "en",
                "targetLang": "hi"
            })

            # Expect timeout — no speech or text should arrive
            with pytest.raises(asyncio.TimeoutError):
                await c2.wait_for_event("peer_incoming_text", timeout=1.5)
        finally:
            await c1.disconnect()
            await c2.disconnect()

    async def test_t2_f8_02_rate_limiting_exceeded(self, socket_client_factory):
        """Rate limiting: sending >5 speech segments within 3 seconds triggers 'speech_error'."""
        room_id = f"rate_{uuid.uuid4().hex[:8]}"
        client = socket_client_factory()
        await client.connect()

        try:
            await client.emit("join_room", {"roomId": room_id, "userId": "burst_user"})
            await client.wait_for_event("waiting_for_peer", timeout=5.0)

            # Emit 6 segments in rapid burst
            for i in range(6):
                await client.emit("speech_segment", {
                    "originalText": f"Burst utterance {i}",
                    "sourceLang": "en",
                    "targetLang": "te"
                })

            error_data = await client.wait_for_event("speech_error", timeout=5.0)
            assert "Rate limit exceeded" in error_data.get("error", "")
        finally:
            await client.disconnect()

    async def test_t2_f8_03_speech_segment_over_1000_chars_capped(self, socket_client_factory):
        """Speech segment with text exceeding 1000 chars is capped to 1000 chars."""
        room_id = f"cap_txt_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        await c1.connect()
        await c2.connect()

        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "sender_1000"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)

            await c2.emit("join_room", {"roomId": room_id, "userId": "receiver_1000"})
            await c1.wait_for_event("peer_connected", timeout=5.0)
            await c2.wait_for_event("peer_connected", timeout=5.0)

            long_utterance = "Boundary test for maximum speech segment payload length. " * 30
            assert len(long_utterance) > 1000

            await c1.emit("speech_segment", {
                "originalText": long_utterance,
                "sourceLang": "en",
                "targetLang": "en"
            })

            text_event = await c2.wait_for_event("peer_incoming_text", timeout=8.0)
            assert len(text_event.get("originalText", "")) <= 1000
        finally:
            await c1.disconnect()
            await c2.disconnect()

    async def test_t2_f8_04_empty_speech_segment_dropped(self, socket_client_factory):
        """Speech segment with empty text "" dropped or rejected without generating subtitles."""
        room_id = f"empty_sp_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        await c1.connect()
        await c2.connect()

        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "speaker_empty"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)

            await c2.emit("join_room", {"roomId": room_id, "userId": "listener_empty"})
            await c1.wait_for_event("peer_connected", timeout=5.0)
            await c2.wait_for_event("peer_connected", timeout=5.0)

            await c1.emit("speech_segment", {
                "originalText": "   ",
                "sourceLang": "en",
                "targetLang": "hi"
            })

            with pytest.raises(asyncio.TimeoutError):
                await c2.wait_for_event("peer_incoming_text", timeout=1.5)
        finally:
            await c1.disconnect()
            await c2.disconnect()

    async def test_t2_f8_05_speech_segment_after_peer_disconnects(self, socket_client_factory):
        """Speech segment sent after peer disconnects routes safely (falls back to simulator)."""
        room_id = f"post_dc_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        await c1.connect()
        await c2.connect()

        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "remaining_caller"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)

            await c2.emit("join_room", {"roomId": room_id, "userId": "departing_caller"})
            await c1.wait_for_event("peer_connected", timeout=5.0)
            await c2.wait_for_event("peer_connected", timeout=5.0)

            # Peer departs
            await c2.emit("leave_room")
            await c1.wait_for_event("peer_disconnected", timeout=5.0)

            # Remaining caller speaks in room now operating in Solo mode
            await c1.emit("speech_segment", {
                "originalText": "Is anyone still here?",
                "sourceLang": "en",
                "targetLang": "hi"
            })

            # Receives solo simulator subtitle
            solo_subtitle = await c1.wait_for_event("peer_incoming_text", timeout=8.0)
            assert solo_subtitle.get("isSolo") is True
            assert "Simulator" in solo_subtitle.get("speakerId", "")
        finally:
            await c1.disconnect()
            await c2.disconnect()


# ==============================================================================
# Feature 9: Domain Jargon Lock Boundaries (F9) - 5 Tests
# ==============================================================================

class TestTier2F9DomainJargonLockBoundaries:
    """Feature 9 Boundaries: Non-existent domains, existing brackets, multi-terms, case variation, word boundaries."""

    async def test_t2_f9_01_nonexistent_domain_fallback(self, http_client):
        """Non-existent domain (e.g. 'astronomy') falls back to 'general' domain cleanly."""
        resp = await http_client.post("/api/translate", json={
            "text": "The mission was successful.",
            "source_lang": "en",
            "target_lang": "hi",
            "domain": "astronomy"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "translated" in data
        assert "[[" not in data["translated"]

    async def test_t2_f9_02_existing_double_brackets_preserved(self, http_client):
        """Text already containing double bracket tokens [[existing]] preserved without double-escaping."""
        resp = await http_client.post("/api/translate", json={
            "text": "Verify token [[existing_token]] intact.",
            "source_lang": "en",
            "target_lang": "en",
            "domain": "medical"
        })
        assert resp.status_code == 200
        data = resp.json()
        # Should unpack cleanly without [[[[existing_token]]]]
        assert "[[[[" not in data["translated"]
        assert "existing_token" in data["translated"]

    async def test_t2_f9_03_multiple_domain_terms_single_sentence(self, http_client):
        """Multiple different domain terms in single sentence all preserved correctly."""
        resp = await http_client.post("/api/translate", json={
            "text": "Patient suffered a heart attack and fast heartbeat during surgery.",
            "source_lang": "en",
            "target_lang": "en",
            "domain": "medical"
        })
        assert resp.status_code == 200
        data = resp.json()
        translated = data["translated"].lower()
        # In medical glossary: 'heart attack' -> 'myocardial infarction', 'fast heartbeat' -> 'tachycardia'
        assert "myocardial infarction" in translated
        assert "tachycardia" in translated

    async def test_t2_f9_04_case_variation_domain_terms(self, http_client):
        """Case variation of domain terms (e.g. 'operating profit' vs 'OPERATING PROFIT') matches and protects."""
        resp1 = await http_client.post("/api/translate", json={
            "text": "Our operating profit was high.",
            "source_lang": "en",
            "target_lang": "en",
            "domain": "fintech"
        })
        assert resp1.status_code == 200
        assert "ebitda margin" in resp1.json()["translated"].lower()

        resp2 = await http_client.post("/api/translate", json={
            "text": "Our OPERATING PROFIT was high.",
            "source_lang": "en",
            "target_lang": "en",
            "domain": "fintech"
        })
        assert resp2.status_code == 200
        assert "ebitda margin" in resp2.json()["translated"].lower()

    async def test_t2_f9_05_boundary_word_matching(self, http_client):
        """Sentence where domain term is part of another word does not falsely match."""
        # 'attack' alone must not match 'heart attack'
        resp = await http_client.post("/api/translate", json={
            "text": "The cybersecurity attack was prevented.",
            "source_lang": "en",
            "target_lang": "en",
            "domain": "medical"
        })
        assert resp.status_code == 200
        translated = resp.json()["translated"].lower()
        assert "myocardial infarction" not in translated
        assert "attack" in translated


# ==============================================================================
# Feature 10: Prosody & Intent Boundaries (F10) - 5 Tests
# ==============================================================================

class TestTier2F10ProsodyIntentBoundaries:
    """Feature 10 Boundaries: Word deduplication, phrase loops, question intent, exclamation, symbols."""

    async def test_t2_f10_01_consecutive_identical_words_deduplicated(self, socket_client_factory):
        """Consecutive identical words deduplicated (e.g. 'stop stop stop stop' -> 'stop')."""
        room_id = f"dedup_w_{uuid.uuid4().hex[:8]}"
        client = socket_client_factory()
        await client.connect()

        try:
            await client.emit("join_room", {"roomId": room_id, "userId": "dedup_tester"})
            await client.wait_for_event("waiting_for_peer", timeout=5.0)

            await client.emit("speech_segment", {
                "originalText": "stop stop stop stop",
                "sourceLang": "en",
                "targetLang": "en"
            })

            text_event = await client.wait_for_event("peer_incoming_text", timeout=8.0)
            enhanced = text_event.get("enhancedOriginal", "").lower()
            assert "stop stop" not in enhanced
            assert "stop" in enhanced
        finally:
            await client.disconnect()

    async def test_t2_f10_02_multi_word_phrase_loop_deduplicated(self, socket_client_factory):
        """Multi-word phrase loop deduplicated (e.g. 'thank you thank you thank you' -> 'thank you')."""
        room_id = f"dedup_p_{uuid.uuid4().hex[:8]}"
        client = socket_client_factory()
        await client.connect()

        try:
            await client.emit("join_room", {"roomId": room_id, "userId": "loop_tester"})
            await client.wait_for_event("waiting_for_peer", timeout=5.0)

            await client.emit("speech_segment", {
                "originalText": "thank you thank you thank you",
                "sourceLang": "en",
                "targetLang": "en"
            })

            text_event = await client.wait_for_event("peer_incoming_text", timeout=8.0)
            enhanced = text_event.get("enhancedOriginal", "").lower()
            assert "thank you thank you" not in enhanced
            assert "thank you" in enhanced
        finally:
            await client.disconnect()

    async def test_t2_f10_03_interrogative_phrase_without_question_mark(self, socket_client_factory):
        """Interrogative phrase without question mark receives '?' and intent 'question'."""
        room_id = f"q_intent_{uuid.uuid4().hex[:8]}"
        client = socket_client_factory()
        await client.connect()

        try:
            await client.emit("join_room", {"roomId": room_id, "userId": "q_tester"})
            await client.wait_for_event("waiting_for_peer", timeout=5.0)

            await client.emit("speech_segment", {
                "originalText": "where are you going right now",
                "sourceLang": "en",
                "targetLang": "en"
            })

            text_event = await client.wait_for_event("peer_incoming_text", timeout=8.0)
            assert text_event.get("intent") == "question"
            assert text_event.get("translatedText", "").endswith("?")
        finally:
            await client.disconnect()

    async def test_t2_f10_04_exclamatory_phrase_without_exclamation(self, socket_client_factory):
        """Exclamatory phrase without exclamation mark receives '!' and intent 'exclamation'."""
        room_id = f"excl_{uuid.uuid4().hex[:8]}"
        client = socket_client_factory()
        await client.connect()

        try:
            await client.emit("join_room", {"roomId": room_id, "userId": "excl_tester"})
            await client.wait_for_event("waiting_for_peer", timeout=5.0)

            await client.emit("speech_segment", {
                "originalText": "help me immediately",
                "sourceLang": "en",
                "targetLang": "en"
            })

            text_event = await client.wait_for_event("peer_incoming_text", timeout=8.0)
            assert text_event.get("intent") == "exclamation"
            assert text_event.get("translatedText", "").endswith("!")
        finally:
            await client.disconnect()

    async def test_t2_f10_05_whitespace_or_symbol_only_utterances(self, socket_client_factory, http_client):
        """Pure whitespace or symbol-only utterances handled without crash."""
        resp = await http_client.post("/api/translate", json={
            "text": "...,,,---",
            "source_lang": "en",
            "target_lang": "hi"
        })
        assert resp.status_code == 200
        assert "translated" in resp.json()

        # Speech segment with pure whitespace dropped cleanly
        client = socket_client_factory()
        await client.connect()
        try:
            await client.emit("join_room", {"roomId": f"sym_{uuid.uuid4().hex[:8]}", "userId": "sym_tester"})
            await client.wait_for_event("waiting_for_peer", timeout=5.0)
            await client.emit("speech_segment", {"originalText": "    ", "sourceLang": "en"})
            await asyncio.sleep(0.3)
            assert len(client.get_events("error")) == 0
        finally:
            await client.disconnect()


# ==============================================================================
# Feature 11: Fallback Resilience Boundaries (F11) - 5 Tests
# ==============================================================================

class TestTier2F11FallbackResilienceBoundaries:
    """Feature 11 Boundaries: Neural voice fallback, rapid language updates, mid-pipeline disconnect, ping ACK, reconnect."""

    async def test_t2_f11_01_language_no_primary_neural_voice_fallback(self, http_client):
        """Language with no primary neural voice falls back to secondary neural or default voice."""
        resp = await http_client.post("/api/tts", json={
            "text": "Testing fallback neural voice mapping.",
            "target_lang": "zz-invalid-dialect",
            "gender": "male"
        })
        assert resp.status_code in [200, 502]
        if resp.status_code == 200:
            assert "audio_base64" in resp.json()

    async def test_t2_f11_02_rapid_language_updates(self, socket_client_factory, http_client):
        """Rapid language updates ('update_language') in quick succession update caller state cleanly."""
        room_id = f"rapid_lang_{uuid.uuid4().hex[:8]}"
        client = socket_client_factory()
        await client.connect()

        try:
            await client.emit("join_room", {"roomId": room_id, "userId": "lang_shifter"})
            await client.wait_for_event("waiting_for_peer", timeout=5.0)

            # Rapidly shift languages
            for lang in ["te", "hi", "ta", "kn", "es", "fr"]:
                await client.emit("update_language", {"language": lang, "voiceGender": "female"})

            await asyncio.sleep(0.3)

            # Check snapshot in /api/rooms
            resp = await http_client.get("/api/rooms")
            assert resp.status_code == 200
            rooms_data = resp.json()["rooms"]
            assert room_id in rooms_data
            assert rooms_data[room_id][0]["language"] == "fr"
        finally:
            await client.disconnect()

    async def test_t2_f11_03_client_disconnect_mid_pipeline(self, socket_client_factory, http_client):
        """Client disconnect mid-pipeline does not leave dangling socket tasks or crash server."""
        room_id = f"mid_pipe_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        await c1.connect()
        await c2.connect()

        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "speaker_active"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)

            await c2.emit("join_room", {"roomId": room_id, "userId": "listener_disconnecting"})
            await c1.wait_for_event("peer_connected", timeout=5.0)
            await c2.wait_for_event("peer_connected", timeout=5.0)

            # Speaker begins speech
            await c1.emit("speech_segment", {
                "originalText": "This speech occurs right as peer disconnects.",
                "sourceLang": "en",
                "targetLang": "hi"
            })

            # Peer immediately disconnects
            await c2.disconnect()
            await asyncio.sleep(0.5)

            # Health remains 200
            resp = await http_client.get("/api/health")
            assert resp.status_code == 200
        finally:
            await c1.disconnect()

    async def test_t2_f11_04_ping_check_with_null_or_malformed(self, socket_client_factory):
        """Ping check sent with null or malformed data receives ACK."""
        client = socket_client_factory()
        await client.connect()

        try:
            ack_none = await client.emit_with_ack("ping_check", None, timeout=5.0)
            assert ack_none.get("status") == "ok"
            assert "timestamp" in ack_none

            ack_malformed = await client.emit_with_ack("ping_check", {"corrupt": True, "num": [1, 2]}, timeout=5.0)
            assert ack_malformed.get("status") == "ok"
            assert "timestamp" in ack_malformed
        finally:
            await client.disconnect()

    async def test_t2_f11_05_reconnect_same_userid_replaces_stale_socket(self, socket_client_factory, http_client):
        """Disconnect and reconnect under the same userId replaces stale socket cleanly."""
        room_id = f"reconn_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()

        await c1.connect()
        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "stable_user_id", "userName": "Socket 1"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)

            # New socket connects with same userId
            await c2.connect()
            await c2.emit("join_room", {"roomId": room_id, "userId": "stable_user_id", "userName": "Socket 2"})
            await c2.wait_for_event("waiting_for_peer", timeout=5.0)

            # Verify in /api/rooms that room still contains exactly 1 participant (not 2)
            resp = await http_client.get("/api/rooms")
            assert resp.status_code == 200
            participants = resp.json()["rooms"][room_id]
            assert len(participants) == 1
            assert participants[0]["userName"] == "Socket 2"
        finally:
            await c1.disconnect()
            await c2.disconnect()


# ==============================================================================
# Feature 12: Call Simulator Boundaries (F12) - 5 Tests
# ==============================================================================

class TestTier2F12CallSimulatorBoundaries:
    """Feature 12 Boundaries: Solo muted drop, solo rate limit, empty minutes, invalid tier, admin cleanup."""

    async def test_t2_f12_01_solo_simulator_muted_speech_dropped(self, socket_client_factory):
        """Solo simulator: speech segment with isMuted: true is dropped silently."""
        room_id = f"solo_mute_{uuid.uuid4().hex[:8]}"
        client = socket_client_factory()
        await client.connect()

        try:
            await client.emit("join_room", {"roomId": room_id, "userId": "solo_muted_user"})
            await client.wait_for_event("waiting_for_peer", timeout=5.0)

            # Mute self in solo mode
            await client.emit("toggle_mute", {"isMuted": True})
            await asyncio.sleep(0.2)

            # Speak while muted
            await client.emit("speech_segment", {
                "originalText": "Testing solo simulator while muted.",
                "sourceLang": "en",
                "targetLang": "hi"
            })

            # Subtitle or audio must not be received
            with pytest.raises(asyncio.TimeoutError):
                await client.wait_for_event("peer_incoming_text", timeout=1.5)
        finally:
            await client.disconnect()

    async def test_t2_f12_02_solo_simulator_rate_limiting(self, socket_client_factory):
        """Solo simulator: speech segment rate limiting triggers 'speech_error' on 6th rapid segment."""
        room_id = f"solo_rate_{uuid.uuid4().hex[:8]}"
        client = socket_client_factory()
        await client.connect()

        try:
            await client.emit("join_room", {"roomId": room_id, "userId": "solo_burst_user"})
            await client.wait_for_event("waiting_for_peer", timeout=5.0)

            for i in range(6):
                await client.emit("speech_segment", {
                    "originalText": f"Rapid solo segment {i}",
                    "sourceLang": "en",
                    "targetLang": "te"
                })

            err = await client.wait_for_event("speech_error", timeout=5.0)
            assert "Rate limit exceeded" in err.get("error", "")
        finally:
            await client.disconnect()

    async def test_t2_f12_03_minutes_empty_transcript(self, http_client):
        """POST /api/minutes with empty transcript [] returns valid empty/minimal minutes structure."""
        resp = await http_client.post("/api/minutes", json={
            "transcript": [],
            "tier": "pro"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("total_utterances") == 0
        assert "summary" in data
        assert "decisions" in data
        assert "action_items" in data
        assert isinstance(data["speakers"], list)

    async def test_t2_f12_04_minutes_invalid_tier_defaults_cleanly(self, http_client):
        """POST /api/minutes with invalid tier defaults cleanly."""
        resp = await http_client.post("/api/minutes", json={
            "transcript": [{"speaker": "Lead Engineer", "text": "Deploying update"}],
            "tier": "invalid_tier_super_vip_9000"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("total_utterances") == 1
        assert "Lead Engineer" in data.get("speakers", [])
        assert "summary" in data

    async def test_t2_f12_05_room_deletion_clears_active_simulator_room(self, socket_client_factory, http_client):
        """Room deletion of active simulator room terminates room and clears state."""
        room_id = f"sim_del_{uuid.uuid4().hex[:8]}"
        client = socket_client_factory()
        await client.connect()

        try:
            await client.emit("join_room", {"roomId": room_id, "userId": "solo_to_delete"})
            await client.wait_for_event("waiting_for_peer", timeout=5.0)

            # Confirm room exists
            rooms_resp1 = await http_client.get("/api/rooms")
            assert room_id in rooms_resp1.json()["rooms"]

            # Admin terminates room
            del_resp = await http_client.delete(f"/api/rooms/{room_id}")
            assert del_resp.status_code == 200
            assert del_resp.json().get("status") == "success"

            # Client receives room_terminated event
            term_event = await client.wait_for_event("room_terminated", timeout=5.0)
            assert "terminated" in term_event.get("message", "").lower()

            # Confirm room purged from /api/rooms
            rooms_resp2 = await http_client.get("/api/rooms")
            assert room_id not in rooms_resp2.json()["rooms"]
        finally:
            await client.disconnect()
