"""Tier 1: Core Feature Happy Path Test Suite.

Contains 60 comprehensive, opaque-box E2E test cases validating Features F1 through F12
in isolation with >= 5 tests per feature.

All tests interact with the system under test strictly through external network interfaces
(HTTP REST endpoints and Socket.IO real-time channels) with zero internal coupling.
"""

import asyncio
import base64
import uuid
import pytest
from tests.e2e.harness import (
    create_synthetic_wav,
    generate_base64_audio,
)


# ==============================================================================
# Feature 1: System Health & Info (F1) - 5 Tests
# ==============================================================================

class TestTier1F1SystemHealth:
    """Feature 1: System Health, Readiness, and Room Telemetry Endpoints."""

    async def test_t1_f1_01_root_health_status(self, http_client):
        """GET /api/health responds with HTTP 200 and healthy service status."""
        resp = await http_client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") == "healthy"
        assert "Speech Translation" in data.get("service", "")

    async def test_t1_f1_02_health_supported_languages_list(self, http_client):
        """GET /api/health includes a non-empty supported_languages list."""
        resp = await http_client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        languages = data.get("supported_languages")
        assert isinstance(languages, list)
        assert len(languages) >= 9
        for code in ["en", "te", "hi"]:
            assert code in languages

    async def test_t1_f1_03_active_room_count_initial(self, http_client):
        """GET /api/rooms returns valid room fleet telemetry structure."""
        resp = await http_client.get("/api/rooms")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data.get("total_rooms"), int)
        assert isinstance(data.get("rooms"), dict)
        assert data["total_rooms"] == len(data["rooms"])

    async def test_t1_f1_04_direct_rooms_snapshot_with_active_room(self, http_client, socket_client_factory):
        """GET /api/rooms accurately reflects a newly joined active room and participant metadata."""
        room_id = f"f1-room-{uuid.uuid4().hex[:8]}"
        user_id = f"user_{uuid.uuid4().hex[:6]}"
        client = socket_client_factory()

        await client.connect()
        await client.emit("join_room", {
            "roomId": room_id,
            "userId": user_id,
            "userName": "Telemetry Caller",
            "language": "en",
            "voiceGender": "female",
        })
        await client.wait_for_event("waiting_for_peer", timeout=5.0)

        try:
            resp = await http_client.get("/api/rooms")
            assert resp.status_code == 200
            data = resp.json()
            assert room_id in data["rooms"]
            participants = data["rooms"][room_id]
            assert len(participants) == 1
            p = participants[0]
            assert p["userId"] == user_id
            assert p["userName"] == "Telemetry Caller"
            assert p["language"] == "en"
            assert p["voiceGender"] == "female"
            assert p["isMuted"] is False
            assert "sid" in p
        finally:
            await client.emit("leave_room")
            await client.disconnect()

    async def test_t1_f1_05_static_file_root_spa_clean(self, http_client):
        """GET / serves root SPA index or clean HTML fallback without 500 error."""
        resp = await http_client.get("/")
        assert resp.status_code == 200
        content_type = resp.headers.get("content-type", "")
        assert "text/html" in content_type
        assert ("<!DOCTYPE html>" in resp.text or "<html" in resp.text)


# ==============================================================================
# Feature 2: Language Registry & Catalog (F2) - 5 Tests
# ==============================================================================

class TestTier1F2LanguageRegistry:
    """Feature 2: Language Registry, Regional Catalogs, and Domain Schemas."""

    async def test_t1_f2_01_health_catalog_contains_expected_codes(self, http_client):
        """Language catalog in health check contains standard ISO codes."""
        resp = await http_client.get("/api/health")
        assert resp.status_code == 200
        langs = resp.json().get("supported_languages", [])
        for code in ["en", "te", "hi", "ta", "es", "fr"]:
            assert code in langs

    async def test_t1_f2_02_indian_languages_catalog_present(self, http_client):
        """Language catalog includes all 9 primary Indian languages."""
        resp = await http_client.get("/api/health")
        assert resp.status_code == 200
        langs = resp.json().get("supported_languages", [])
        indian_langs = ["hi", "te", "ta", "kn", "ml", "mr", "bn", "gu", "pa"]
        for lang in indian_langs:
            assert lang in langs

    async def test_t1_f2_03_global_languages_catalog_present(self, http_client):
        """Language catalog includes major global languages."""
        resp = await http_client.get("/api/health")
        assert resp.status_code == 200
        langs = resp.json().get("supported_languages", [])
        global_langs = ["es", "fr", "de", "ja", "zh", "ar", "ru"]
        for lang in global_langs:
            assert lang in langs

    async def test_t1_f2_04_get_glossary_all_domain_schemas(self, http_client):
        """GET /api/glossary returns all 6 enterprise domain schema descriptors."""
        resp = await http_client.get("/api/glossary")
        assert resp.status_code == 200
        data = resp.json()
        assert "domains" in data
        domains = data["domains"]
        assert isinstance(domains, list)
        assert len(domains) >= 6

        domain_ids = [d["id"] for d in domains]
        for expected in ["general", "medical", "legal", "fintech", "defense", "engineering"]:
            assert expected in domain_ids

        for d in domains:
            assert "id" in d and "name" in d and "description" in d and "termsCount" in d

    async def test_t1_f2_05_post_glossary_domain_details(self, http_client):
        """POST /api/glossary returns terms count and sample terms for a domain."""
        resp = await http_client.post("/api/glossary", json={"domain": "medical"})
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("domain") == "medical"
        assert data.get("status") == "active"
        assert data.get("protection_mode") == "strict_preservation"
        assert isinstance(data.get("terms_count"), int)
        assert data["terms_count"] > 0
        sample_terms = data.get("sample_terms")
        assert isinstance(sample_terms, list)
        assert len(sample_terms) > 0
        assert any("myocardial" in t.lower() or "tachycardia" in t.lower() for t in sample_terms)


# ==============================================================================
# Feature 3: REST Translation Endpoint (F3) - 5 Tests
# ==============================================================================

class TestTier1F3RestTranslation:
    """Feature 3: REST Translation API with multi-language and glossary support."""

    async def test_t1_f3_01_translate_en_to_es(self, http_client):
        """POST /api/translate translates English to Spanish successfully."""
        resp = await http_client.post("/api/translate", json={
            "text": "Good morning my friend",
            "source_lang": "en",
            "target_lang": "es",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("source_lang") == "en"
        assert data.get("target_lang") == "es"
        assert len(data.get("translated", "")) > 0
        # Should contain common Spanish translation elements
        trans_lower = data["translated"].lower()
        assert any(w in trans_lower for w in ["buen", "dia", "días", "amigo"])

    async def test_t1_f3_02_translate_en_to_te(self, http_client):
        """POST /api/translate translates English to Telugu containing Telugu script."""
        resp = await http_client.post("/api/translate", json={
            "text": "Good morning",
            "source_lang": "en",
            "target_lang": "te",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("target_lang") == "te"
        translated = data.get("translated", "")
        assert len(translated) > 0
        # Verify presence of Telugu Unicode characters (\u0c00 - \u0c7f)
        assert any("\u0c00" <= ch <= "\u0c7f" for ch in translated)

    async def test_t1_f3_03_translate_en_to_hi(self, http_client):
        """POST /api/translate translates English to Hindi containing Devanagari script."""
        resp = await http_client.post("/api/translate", json={
            "text": "Hello, how are you?",
            "source_lang": "en",
            "target_lang": "hi",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("target_lang") == "hi"
        translated = data.get("translated", "")
        assert len(translated) > 0
        # Verify presence of Devanagari Unicode characters (\u0900 - \u097f)
        assert any("\u0900" <= ch <= "\u097f" for ch in translated)

    async def test_t1_f3_04_translate_preserves_jargon_lock_tokens(self, http_client):
        """POST /api/translate preserves and unpacks domain terminology under medical glossary."""
        resp = await http_client.post("/api/translate", json={
            "text": "The doctor diagnosed a heart attack immediately.",
            "source_lang": "te",
            "target_lang": "en",
            "domain": "medical",
        })
        assert resp.status_code == 200
        data = resp.json()
        translated = data.get("translated", "")
        # "heart attack" is mapped to "myocardial infarction" in medical domain
        assert "myocardial infarction" in translated.lower()
        # Bracket tokens must be unpacked and clean
        assert "[[" not in translated and "]]" not in translated

    async def test_t1_f3_05_translate_defaults_and_auto(self, http_client):
        """POST /api/translate applies default languages when omitted."""
        resp = await http_client.post("/api/translate", json={
            "text": "Conference call started",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("source_lang") == "te"
        assert data.get("target_lang") == "hi"
        assert data.get("domain") == "general"
        assert len(data.get("translated", "")) > 0


# ==============================================================================
# Feature 4: REST Neural Speech Synthesis TTS (F4) - 5 Tests
# ==============================================================================

class TestTier1F4RestTTS:
    """Feature 4: REST Neural Speech Synthesis (Edge-TTS) Endpoint."""

    async def test_t1_f4_01_tts_english_base64_and_format(self, http_client):
        """POST /api/tts synthesizes English text into Base64 MP3 audio."""
        resp = await http_client.post("/api/tts", json={
            "text": "Hello, testing voice synthesis.",
            "target_lang": "en",
            "gender": "female",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("format") == "mp3"
        assert data.get("target_lang") == "en"
        assert data.get("gender") == "female"
        raw_audio = base64.b64decode(data.get("audio_base64", ""))
        assert len(raw_audio) > 500

    async def test_t1_f4_02_tts_hindi_audio(self, http_client):
        """POST /api/tts synthesizes Hindi text into valid audio payload."""
        resp = await http_client.post("/api/tts", json={
            "text": "नमस्ते, आप कैसे हैं?",
            "target_lang": "hi",
            "gender": "female",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("target_lang") == "hi"
        raw_audio = base64.b64decode(data.get("audio_base64", ""))
        assert len(raw_audio) > 500

    async def test_t1_f4_03_tts_telugu_audio(self, http_client):
        """POST /api/tts synthesizes Telugu text into valid audio payload."""
        resp = await http_client.post("/api/tts", json={
            "text": "నమస్కారం, మీరు బాగున్నారా?",
            "target_lang": "te",
            "gender": "female",
        })
        if resp.status_code == 502:
            # Resilient retry for transient cloud synthesis latency
            resp = await http_client.post("/api/tts", json={
                "text": "నమస్కారం",
                "target_lang": "te",
                "gender": "female",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("target_lang") == "te"
        raw_audio = base64.b64decode(data.get("audio_base64", ""))
        assert len(raw_audio) > 500

    async def test_t1_f4_04_tts_male_female_preference(self, http_client):
        """POST /api/tts respects male and female gender preference options."""
        resp_f = await http_client.post("/api/tts", json={
            "text": "Good morning",
            "target_lang": "en",
            "gender": "female",
        })
        resp_m = await http_client.post("/api/tts", json={
            "text": "Good morning",
            "target_lang": "en",
            "gender": "male",
        })
        assert resp_f.status_code == 200
        assert resp_m.status_code == 200
        assert resp_f.json().get("gender") == "female"
        assert resp_m.json().get("gender") == "male"
        assert len(base64.b64decode(resp_f.json().get("audio_base64", ""))) > 500
        assert len(base64.b64decode(resp_m.json().get("audio_base64", ""))) > 500

    async def test_t1_f4_05_tts_long_paragraph(self, http_client):
        """POST /api/tts synthesizes longer multi-sentence paragraph into substantial audio payload."""
        paragraph = (
            "Welcome to the VoiceBridge Real Live Call Translator platform. "
            "Our neural speech synthesis engine provides authentic human conversational tone "
            "and studio audio quality across global and regional languages."
        )
        resp = await http_client.post("/api/tts", json={
            "text": paragraph,
            "target_lang": "en",
            "gender": "female",
        })
        assert resp.status_code == 200
        raw_audio = base64.b64decode(resp.json().get("audio_base64", ""))
        assert len(raw_audio) > 2000


# ==============================================================================
# Feature 5: REST Speech-to-Text STT (F5) - 5 Tests
# ==============================================================================

class TestTier1F5RestSTT:
    """Feature 5: REST Speech-to-Text (STT) Audio Fallback Endpoint."""

    async def test_t1_f5_01_stt_valid_synthetic_wav(self, http_client):
        """POST /api/stt accepts valid Base64 WAV and returns expected response structure."""
        audio_b64 = generate_base64_audio(duration_ms=500, sample_rate=16000)
        resp = await http_client.post("/api/stt", json={
            "audio_base64": audio_b64,
            "language": "en",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "transcript" in data
        assert "language" in data
        assert "success" in data
        assert data["language"] == "en"
        assert isinstance(data["success"], bool)

    async def test_t1_f5_02_stt_english_language_code(self, http_client):
        """POST /api/stt processes audio under English language configuration."""
        audio_b64 = generate_base64_audio(duration_ms=400, sample_rate=16000)
        resp = await http_client.post("/api/stt", json={
            "audio_base64": audio_b64,
            "language": "en",
        })
        assert resp.status_code == 200
        assert resp.json().get("language") == "en"

    async def test_t1_f5_03_stt_hindi_language_code(self, http_client):
        """POST /api/stt processes audio under Hindi language configuration."""
        audio_b64 = generate_base64_audio(duration_ms=400, sample_rate=16000)
        resp = await http_client.post("/api/stt", json={
            "audio_base64": audio_b64,
            "language": "hi",
        })
        assert resp.status_code == 200
        assert resp.json().get("language") == "hi"

    async def test_t1_f5_04_stt_response_metadata_and_error_handling(self, http_client):
        """POST /api/stt returns structured response without 500 when audio contains no speech."""
        audio_b64 = generate_base64_audio(duration_ms=250, sample_rate=16000, frequency_hz=100.0)
        resp = await http_client.post("/api/stt", json={
            "audio_base64": audio_b64,
            "language": "en",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data.get("transcript"), str)
        assert data.get("language") == "en"
        assert isinstance(data.get("success"), bool)

    async def test_t1_f5_05_stt_different_sample_rates(self, http_client):
        """POST /api/stt handles WAV audio generated at standard 16kHz and 24kHz sample rates."""
        for s_rate in [16000, 24000]:
            wav_bytes = create_synthetic_wav(duration_ms=300, sample_rate=s_rate)
            b64_audio = base64.b64encode(wav_bytes).decode("ascii")
            resp = await http_client.post("/api/stt", json={
                "audio_base64": b64_audio,
                "language": "en",
            })
            assert resp.status_code == 200
            assert resp.json().get("language") == "en"


# ==============================================================================
# Feature 6: WebSocket Room Lifecycle (F6) - 5 Tests
# ==============================================================================

class TestTier1F6RoomLifecycle:
    """Feature 6: WebSocket Room Entry, Peer Pairing, Departure, and Termination."""

    async def test_t1_f6_01_single_client_waiting_for_peer(self, socket_client_factory):
        """Single client joining a room receives waiting_for_peer acknowledgment."""
        room_id = f"f6-room-{uuid.uuid4().hex[:8]}"
        user_id = f"user_{uuid.uuid4().hex[:6]}"
        client = socket_client_factory()

        await client.connect()
        await client.emit("join_room", {
            "roomId": room_id,
            "userId": user_id,
            "userName": "Alice",
            "language": "en",
            "voiceGender": "female",
        })
        event = await client.wait_for_event("waiting_for_peer", timeout=5.0)
        assert event is not None
        assert event.get("self", {}).get("userId") == user_id
        await client.disconnect()

    async def test_t1_f6_02_second_client_both_receive_peer_connected(self, socket_client_factory):
        """When a second client joins, both callers receive peer_connected event."""
        room_id = f"f6-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "user_a", "userName": "Alpha"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)

        await client_b.emit("join_room", {"roomId": room_id, "userId": "user_b", "userName": "Beta"})
        peer_a = await client_a.wait_for_event("peer_connected", timeout=5.0)
        peer_b = await client_b.wait_for_event("peer_connected", timeout=5.0)

        assert peer_a.get("peer", {}).get("userId") == "user_b"
        assert peer_b.get("peer", {}).get("userId") == "user_a"

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_t1_f6_03_initiator_flag_assignment(self, socket_client_factory):
        """First caller is designated isInitiator=True, second caller isInitiator=False."""
        room_id = f"f6-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "init_a", "userName": "Init A"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)

        await client_b.emit("join_room", {"roomId": room_id, "userId": "init_b", "userName": "Init B"})
        peer_a = await client_a.wait_for_event("peer_connected", timeout=5.0)
        peer_b = await client_b.wait_for_event("peer_connected", timeout=5.0)

        assert peer_a.get("isInitiator") is True
        assert peer_b.get("isInitiator") is False

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_t1_f6_04_client_leaves_peer_receives_disconnected(self, socket_client_factory):
        """When client emits leave_room, the remaining peer receives peer_disconnected."""
        room_id = f"f6-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "staying_user"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)

        await client_b.emit("join_room", {"roomId": room_id, "userId": "leaving_user"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        await client_b.emit("leave_room")
        disc_evt = await client_a.wait_for_event("peer_disconnected", timeout=5.0)
        assert disc_evt.get("peerId") == "leaving_user"

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_t1_f6_05_admin_delete_room_terminates_and_purges(self, http_client, socket_client_factory):
        """DELETE /api/rooms/{room_id} emits room_terminated and cleans up room state."""
        room_id = f"f6-room-{uuid.uuid4().hex[:8]}"
        client = socket_client_factory()

        await client.connect()
        await client.emit("join_room", {"roomId": room_id, "userId": "target_user"})
        await client.wait_for_event("waiting_for_peer", timeout=5.0)

        # Admin issues termination
        del_resp = await http_client.delete(f"/api/rooms/{room_id}")
        assert del_resp.status_code == 200
        assert del_resp.json().get("status") == "success"

        # Client receives room_terminated
        term_evt = await client.wait_for_event("room_terminated", timeout=5.0)
        assert term_evt is not None
        assert "terminated" in term_evt.get("message", "").lower()

        # Room is purged from snapshot
        rooms_resp = await http_client.get("/api/rooms")
        assert room_id not in rooms_resp.json().get("rooms", {})

        await client.disconnect()


# ==============================================================================
# Feature 7: WebRTC Signaling Relay (F7) - 5 Tests
# ==============================================================================

class TestTier1F7WebRTCSignaling:
    """Feature 7: WebRTC SDP and Candidate Relays across Connected Peers."""

    async def test_t1_f7_01_webrtc_offer_relayed(self, socket_client_factory):
        """webrtc_offer sent by Client A is transparently relayed to Client B."""
        room_id = f"f7-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "peer_a"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "peer_b"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        offer_payload = {"offer": {"type": "offer", "sdp": "v=0\r\no=alice 1000 2 IN IP4 127.0.0.1"}}
        await client_a.emit("webrtc_offer", offer_payload)

        relayed = await client_b.wait_for_event("webrtc_offer", timeout=5.0)
        assert relayed.get("offer", {}).get("sdp") == offer_payload["offer"]["sdp"]

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_t1_f7_02_webrtc_answer_relayed(self, socket_client_factory):
        """webrtc_answer sent by Client B is transparently relayed to Client A."""
        room_id = f"f7-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "peer_a"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "peer_b"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        answer_payload = {"answer": {"type": "answer", "sdp": "v=0\r\no=bob 2000 2 IN IP4 127.0.0.1"}}
        await client_b.emit("webrtc_answer", answer_payload)

        relayed = await client_a.wait_for_event("webrtc_answer", timeout=5.0)
        assert relayed.get("answer", {}).get("sdp") == answer_payload["answer"]["sdp"]

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_t1_f7_03_webrtc_ice_candidate_relayed(self, socket_client_factory):
        """webrtc_ice_candidate is relayed intact between room participants."""
        room_id = f"f7-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "peer_a"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "peer_b"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        cand_payload = {"candidate": {"candidate": "candidate:1 1 UDP 2130706431 127.0.0.1 5000 typ host", "sdpMid": "0"}}
        await client_a.emit("webrtc_ice_candidate", cand_payload)

        relayed = await client_b.wait_for_event("webrtc_ice_candidate", timeout=5.0)
        assert relayed.get("candidate", {}).get("candidate") == cand_payload["candidate"]["candidate"]

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_t1_f7_04_toggle_mute_relays_peer_mute_changed(self, socket_client_factory):
        """toggle_mute emits peer_mute_changed to the remote peer with updated mute state."""
        room_id = f"f7-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "mute_user_a"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "mute_user_b"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        # Mute client A
        await client_a.emit("toggle_mute", {"isMuted": True})
        mute_evt = await client_b.wait_for_event("peer_mute_changed", timeout=5.0)
        assert mute_evt.get("isMuted") is True

        # Unmute client A
        await client_a.emit("toggle_mute", {"isMuted": False})
        unmute_evt = await client_b.wait_for_event("peer_mute_changed", timeout=5.0)
        assert unmute_evt.get("isMuted") is False

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_t1_f7_05_speaking_state_relays_peer_speaking_state(self, socket_client_factory):
        """speaking_state emits peer_speaking_state to peer for HUD visualization."""
        room_id = f"f7-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "speaker_a"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "speaker_b"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        # Client A begins speaking
        await client_a.emit("speaking_state", {"isSpeaking": True})
        state_evt = await client_b.wait_for_event("peer_speaking_state", timeout=5.0)
        assert state_evt.get("isSpeaking") is True
        assert state_evt.get("speakerId") == "speaker_a"

        # Client A stops speaking
        await client_a.emit("speaking_state", {"isSpeaking": False})
        state_evt_off = await client_b.wait_for_event("peer_speaking_state", timeout=5.0)
        assert state_evt_off.get("isSpeaking") is False

        await client_a.disconnect()
        await client_b.disconnect()


# ==============================================================================
# Feature 8: Live Speech Segment Pipeline (F8) - 5 Tests
# ==============================================================================

class TestTier1F8SpeechPipeline:
    """Feature 8: Real-time Speech-to-Speech Translation Pipeline."""

    async def test_t1_f8_01_speech_segment_triggers_peer_incoming_text(self, socket_client_factory):
        """Emitting speech_segment delivers live peer_incoming_text subtitle to peer."""
        room_id = f"f8-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "talker_a", "language": "en"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "listener_b", "language": "es"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        await client_a.emit("speech_segment", {
            "originalText": "Hello my friend",
            "sourceLang": "en",
            "targetLang": "es",
        })

        subtitle = await client_b.wait_for_event("peer_incoming_text", timeout=8.0)
        assert subtitle is not None
        assert subtitle.get("originalText") == "Hello my friend"
        assert len(subtitle.get("translatedText", "")) > 0
        assert subtitle.get("speakerId") == "talker_a"
        assert subtitle.get("sourceLang") == "en"
        assert subtitle.get("targetLang") == "es"

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_t1_f8_02_speech_segment_triggers_speech_delivered(self, socket_client_factory):
        """Emitting speech_segment delivers speech_delivered acknowledgment to speaker."""
        room_id = f"f8-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "talker_a", "language": "en"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "listener_b", "language": "es"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        await client_a.emit("speech_segment", {
            "originalText": "Good morning to everyone",
            "sourceLang": "en",
            "targetLang": "es",
        })

        delivered = await client_a.wait_for_event("speech_delivered", timeout=8.0)
        assert delivered is not None
        assert delivered.get("originalText") == "Good morning to everyone"
        assert len(delivered.get("translatedText", "")) > 0
        assert delivered.get("isSolo") is False

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_t1_f8_03_speech_segment_triggers_translated_audio(self, socket_client_factory):
        """Emitting speech_segment delivers translated_audio neural MP3 to recipient."""
        room_id = f"f8-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "talker_a", "language": "en"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "listener_b", "language": "es"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        await client_a.emit("speech_segment", {
            "originalText": "We are ready to start",
            "sourceLang": "en",
            "targetLang": "es",
        })

        audio_evt = await client_b.wait_for_event("translated_audio", timeout=12.0)
        assert audio_evt is not None
        raw_bytes = base64.b64decode(audio_evt.get("audioBase64", ""))
        assert len(raw_bytes) > 500
        assert len(audio_evt.get("translatedText", "")) > 0

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_t1_f8_04_speech_segment_translation_matches_target_language(self, socket_client_factory):
        """Speech segment translation matches the requested target language."""
        room_id = f"f8-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "talker_a", "language": "en"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "listener_b", "language": "hi"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        await client_a.emit("speech_segment", {
            "originalText": "Hello my friend",
            "sourceLang": "en",
            "targetLang": "hi",
        })

        subtitle = await client_b.wait_for_event("peer_incoming_text", timeout=8.0)
        trans_text = subtitle.get("translatedText", "")
        # Hindi Devanagari script verification
        assert any("\u0900" <= ch <= "\u097f" for ch in trans_text)
        assert subtitle.get("targetLang") == "hi"

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_t1_f8_05_speech_segment_sequence_and_timing(self, socket_client_factory):
        """Speech segment triggers ordered pipeline events (incoming_speech before incoming_text)."""
        room_id = f"f8-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "talker_a", "language": "en"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "listener_b", "language": "es"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        await client_a.emit("speech_segment", {
            "originalText": "Stand by for transmission",
            "sourceLang": "en",
            "targetLang": "es",
        })

        speech_start = await client_b.wait_for_event("peer_incoming_speech", timeout=5.0)
        assert speech_start.get("speakerId") == "talker_a"

        subtitle = await client_b.wait_for_event("peer_incoming_text", timeout=8.0)
        assert subtitle is not None

        await client_a.disconnect()
        await client_b.disconnect()


# ==============================================================================
# Feature 9: Domain Jargon Lock (F9) - 5 Tests
# ==============================================================================

class TestTier1F9DomainJargonLock:
    """Feature 9: Domain Jargon Lock and Enterprise Glossary Terminology Protection."""

    async def test_t1_f9_01_medical_domain_preserves_terms(self, socket_client_factory):
        """Speech segment under medical domain locks and preserves clinical terms."""
        room_id = f"f9-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "dr_a", "language": "te"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "dr_b", "language": "en"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        await client_a.emit("speech_segment", {
            "originalText": "The patient suffered a heart attack yesterday.",
            "sourceLang": "te",
            "targetLang": "en",
            "domain": "medical",
        })

        subtitle = await client_b.wait_for_event("peer_incoming_text", timeout=8.0)
        trans_lower = subtitle.get("translatedText", "").lower()
        # "heart attack" in medical domain maps to "myocardial infarction"
        assert "myocardial infarction" in trans_lower

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_t1_f9_02_fintech_domain_preserves_terms(self, socket_client_factory):
        """Speech segment under fintech domain locks and preserves banking terms."""
        room_id = f"f9-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "trader_a", "language": "te"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "trader_b", "language": "en"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        await client_a.emit("speech_segment", {
            "originalText": "We must calculate the operating profit.",
            "sourceLang": "te",
            "targetLang": "en",
            "domain": "fintech",
        })

        subtitle = await client_b.wait_for_event("peer_incoming_text", timeout=8.0)
        trans_lower = subtitle.get("translatedText", "").lower()
        # "operating profit" maps to "EBITDA margin"
        assert "ebitda" in trans_lower

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_t1_f9_03_legal_domain_preserves_terms(self, socket_client_factory):
        """Speech segment under legal domain locks and preserves contract terms."""
        room_id = f"f9-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "counsel_a", "language": "te"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "counsel_b", "language": "en"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        await client_a.emit("speech_segment", {
            "originalText": "The agreement includes an unforeseen event clause.",
            "sourceLang": "te",
            "targetLang": "en",
            "domain": "legal",
        })

        subtitle = await client_b.wait_for_event("peer_incoming_text", timeout=8.0)
        trans_lower = subtitle.get("translatedText", "").lower()
        # "unforeseen event" maps to "force majeure"
        assert "force majeure" in trans_lower

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_t1_f9_04_engineering_domain_preserves_terms(self, socket_client_factory):
        """Speech segment under engineering domain locks distributed architecture terms."""
        room_id = f"f9-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "eng_a", "language": "te"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "eng_b", "language": "en"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        await client_a.emit("speech_segment", {
            "originalText": "We implemented a safe retry for data sync.",
            "sourceLang": "te",
            "targetLang": "en",
            "domain": "engineering",
        })

        subtitle = await client_b.wait_for_event("peer_incoming_text", timeout=8.0)
        trans_lower = subtitle.get("translatedText", "").lower()
        # "safe retry" maps to "idempotent execution"
        assert "idempotent execution" in trans_lower

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_t1_f9_05_defense_domain_preserves_terms(self, socket_client_factory):
        """Speech segment under defense domain locks aerospace and mission telemetry terms."""
        room_id = f"f9-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "pilot_a", "language": "te"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "ground_b", "language": "en"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        await client_a.emit("speech_segment", {
            "originalText": "The aircraft surpassed the speed of sound.",
            "sourceLang": "te",
            "targetLang": "en",
            "domain": "defense",
        })

        subtitle = await client_b.wait_for_event("peer_incoming_text", timeout=8.0)
        trans_lower = subtitle.get("translatedText", "").lower()
        # "speed of sound" maps to "Mach 1.0 transition"
        assert "mach 1.0 transition" in trans_lower

        await client_a.disconnect()
        await client_b.disconnect()


# ==============================================================================
# Feature 10: Prosody & Intent Analysis (F10) - 5 Tests
# ==============================================================================

class TestTier1F10ProsodyIntent:
    """Feature 10: Prosody Enhancement, Intent Classification, and Slang Normalization."""

    async def test_t1_f10_01_interrogative_intent_question_mark(self, socket_client_factory):
        """Prosody engine identifies question intent and attaches terminal question mark."""
        room_id = f"f10-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "asker_a", "language": "en"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "answerer_b", "language": "es"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        await client_a.emit("speech_segment", {
            "originalText": "where are you going",
            "sourceLang": "en",
            "targetLang": "es",
        })

        subtitle = await client_b.wait_for_event("peer_incoming_text", timeout=8.0)
        assert subtitle.get("intent") == "question"
        assert subtitle.get("enhancedOriginal", "").endswith("?")
        assert subtitle.get("translatedText", "").endswith("?")

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_t1_f10_02_exclamatory_intent_exclamation_mark(self, socket_client_factory):
        """Prosody engine identifies exclamatory intent and attaches terminal exclamation mark."""
        room_id = f"f10-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "urgent_a", "language": "en"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "urgent_b", "language": "es"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        await client_a.emit("speech_segment", {
            "originalText": "help me immediately",
            "sourceLang": "en",
            "targetLang": "es",
        })

        subtitle = await client_b.wait_for_event("peer_incoming_text", timeout=8.0)
        assert subtitle.get("intent") == "exclamation"
        assert subtitle.get("enhancedOriginal", "").endswith("!")
        assert subtitle.get("translatedText", "").endswith("!")

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_t1_f10_03_statement_intent_period(self, socket_client_factory):
        """Prosody engine classifies declarative sentence as statement with period."""
        room_id = f"f10-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "speaker_a", "language": "en"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "speaker_b", "language": "es"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        await client_a.emit("speech_segment", {
            "originalText": "I am ready for the meeting",
            "sourceLang": "en",
            "targetLang": "es",
        })

        subtitle = await client_b.wait_for_event("peer_incoming_text", timeout=8.0)
        assert subtitle.get("intent") == "statement"
        assert subtitle.get("enhancedOriginal", "").endswith(".")
        assert subtitle.get("translatedText", "").endswith(".")

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_t1_f10_04_telugu_spoken_slang_normalization(self, socket_client_factory):
        """Prosody engine normalizes colloquial spoken Telugu slang to standard conversational forms."""
        room_id = f"f10-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "te_a", "language": "te"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "te_b", "language": "en"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        # "వస్తన్నా" normalizes to "వస్తున్నాను"
        await client_a.emit("speech_segment", {
            "originalText": "నేను రేపు వస్తన్నా",
            "sourceLang": "te",
            "targetLang": "en",
        })

        subtitle = await client_b.wait_for_event("peer_incoming_text", timeout=8.0)
        enhanced = subtitle.get("enhancedOriginal", "")
        assert "వస్తున్నాను" in enhanced

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_t1_f10_05_hindi_spoken_slang_normalization(self, socket_client_factory):
        """Prosody engine normalizes colloquial spoken Hindi slang to standard forms."""
        room_id = f"f10-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "hi_a", "language": "hi"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "hi_b", "language": "en"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        # "जा रिया" normalizes to "जा रहे"
        await client_a.emit("speech_segment", {
            "originalText": "हम घर जा रिया",
            "sourceLang": "hi",
            "targetLang": "en",
        })

        subtitle = await client_b.wait_for_event("peer_incoming_text", timeout=8.0)
        enhanced = subtitle.get("enhancedOriginal", "")
        assert "जा रहे" in enhanced

        await client_a.disconnect()
        await client_b.disconnect()


# ==============================================================================
# Feature 11: Fallback Resilience & Graceful Degradation (F11) - 5 Tests
# ==============================================================================

class TestTier1F11FallbackResilience:
    """Feature 11: System Fallback Chains, Default Domain, and Telemetry Ack."""

    async def test_t1_f11_01_translation_fallback_chain(self, http_client):
        """Translation endpoint gracefully handles requests and returns status 200."""
        resp = await http_client.post("/api/translate", json={
            "text": "Fallback engine verification",
            "source_lang": "en",
            "target_lang": "fr",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert len(data.get("translated", "")) > 0

    async def test_t1_f11_02_speech_segment_without_domain_defaults_to_general(self, socket_client_factory):
        """Speech segment without domain attribute cleanly defaults to general domain."""
        room_id = f"f11-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "speaker_a", "language": "en"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "speaker_b", "language": "es"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        # Emit without domain key
        await client_a.emit("speech_segment", {
            "originalText": "Operational status is nominal",
            "sourceLang": "en",
            "targetLang": "es",
        })

        subtitle = await client_b.wait_for_event("peer_incoming_text", timeout=8.0)
        assert subtitle is not None
        assert len(subtitle.get("translatedText", "")) > 0

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_t1_f11_03_edge_tts_unsupported_voice_fallback(self, http_client):
        """Edge-TTS endpoint falls back gracefully to default voice when language code is unsupported."""
        resp = await http_client.post("/api/tts", json={
            "text": "Fallback speech synthesis",
            "target_lang": "unsupported_xyz",
            "gender": "female",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert len(base64.b64decode(data.get("audio_base64", ""))) > 500

    async def test_t1_f11_04_update_language_updates_peer_state(self, socket_client_factory):
        """Emitting update_language notifies peer of updated language and voice settings."""
        room_id = f"f11-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "user_a", "language": "en"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "user_b", "language": "es"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        # Client A updates to French male
        await client_a.emit("update_language", {
            "language": "fr",
            "voiceGender": "male",
            "userName": "Alpha French",
        })

        update_evt = await client_b.wait_for_event("peer_language_updated", timeout=5.0)
        assert update_evt.get("peerLanguage") == "fr"
        assert update_evt.get("voiceGender") == "male"
        assert update_evt.get("userName") == "Alpha French"

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_t1_f11_05_ping_check_ack(self, socket_client_factory):
        """ping_check Socket.IO event returns acknowledgment with timestamp."""
        client = socket_client_factory()
        await client.connect()

        ack = await client.emit_with_ack("ping_check", timeout=5.0)
        assert isinstance(ack, dict)
        assert ack.get("status") == "ok"
        assert isinstance(ack.get("timestamp"), (int, float))
        assert ack["timestamp"] > 0

        await client.disconnect()


# ==============================================================================
# Feature 12: Call Simulator & Transcript Operations (F12) - 5 Tests
# ==============================================================================

class TestTier1F12CallSimulator:
    """Feature 12: Solo Call Simulator, Meeting Minutes, and Transcript Flow."""

    async def test_t1_f12_01_solo_simulator_loopback_subtitle(self, socket_client_factory):
        """Single user in room receives loopback subtitle in Solo Simulator mode."""
        room_id = f"f12-room-{uuid.uuid4().hex[:8]}"
        client = socket_client_factory()

        await client.connect()
        await client.emit("join_room", {
            "roomId": room_id,
            "userId": "solo_tester",
            "userName": "Solo Pilot",
            "language": "en",
        })
        await client.wait_for_event("waiting_for_peer", timeout=5.0)

        await client.emit("speech_segment", {
            "originalText": "Testing solo simulator translation",
            "sourceLang": "en",
            "targetLang": "es",
        })

        subtitle = await client.wait_for_event("peer_incoming_text", timeout=8.0)
        assert subtitle is not None
        assert subtitle.get("isSolo") is True
        assert subtitle.get("speakerId") == "Simulator (es)"
        assert len(subtitle.get("translatedText", "")) > 0

        await client.disconnect()

    async def test_t1_f12_02_solo_simulator_loopback_neural_audio(self, socket_client_factory):
        """Single user receives loopback neural audio with isSolo=True in Simulator mode."""
        room_id = f"f12-room-{uuid.uuid4().hex[:8]}"
        client = socket_client_factory()

        await client.connect()
        await client.emit("join_room", {
            "roomId": room_id,
            "userId": "solo_tester",
            "userName": "Solo Pilot",
            "language": "en",
        })
        await client.wait_for_event("waiting_for_peer", timeout=5.0)

        await client.emit("speech_segment", {
            "originalText": "Testing simulated neural speech",
            "sourceLang": "en",
            "targetLang": "es",
        })

        audio_evt = await client.wait_for_event("translated_audio", timeout=12.0)
        assert audio_evt is not None
        assert audio_evt.get("isSolo") is True
        raw_audio = base64.b64decode(audio_evt.get("audioBase64", ""))
        assert len(raw_audio) > 500

        await client.disconnect()

    async def test_t1_f12_03_post_minutes_structured_output(self, http_client):
        """POST /api/minutes produces structured meeting briefing, decisions, and action items."""
        transcript_sample = [
            {
                "speaker": "Alice",
                "originalText": "We must finalize the translation relays by Friday.",
                "translatedText": "हमें शुक्रवार तक अनुवाद रिले को अंतिम रूप देना होगा।",
            },
            {
                "speaker": "Bob",
                "originalText": "Agreed, the edge deployment is underway.",
                "translatedText": "सहमत, बढ़त की तैनाती जारी है।",
            },
        ]
        resp = await http_client.post("/api/minutes", json={
            "transcript": transcript_sample,
            "tier": "pro",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("title") == "EXECUTIVE BILINGUAL CONVERSATION BRIEFING"
        assert data.get("total_utterances") == 2
        assert "Alice" in data.get("speakers", [])
        assert "Bob" in data.get("speakers", [])
        assert len(data.get("summary", "")) > 0
        assert isinstance(data.get("decisions"), list) and len(data["decisions"]) > 0
        assert isinstance(data.get("action_items"), list) and len(data["action_items"]) > 0
        assert "sentiment" in data

    async def test_t1_f12_04_delete_active_simulator_room(self, http_client, socket_client_factory):
        """DELETE /api/rooms/{id} cleans up an active simulator room cleanly."""
        room_id = f"f12-room-{uuid.uuid4().hex[:8]}"
        client = socket_client_factory()

        await client.connect()
        await client.emit("join_room", {"roomId": room_id, "userId": "solo_pilot"})
        await client.wait_for_event("waiting_for_peer", timeout=5.0)

        # Terminate simulator room
        del_resp = await http_client.delete(f"/api/rooms/{room_id}")
        assert del_resp.status_code == 200
        assert del_resp.json().get("status") == "success"

        # Client receives room_terminated
        term_evt = await client.wait_for_event("room_terminated", timeout=5.0)
        assert term_evt is not None

        # Verify room purged
        rooms_resp = await http_client.get("/api/rooms")
        assert room_id not in rooms_resp.json().get("rooms", {})

        await client.disconnect()

    async def test_t1_f12_05_room_session_transcript_accumulation(self, socket_client_factory):
        """Multiple utterances in a call session deliver in-order subtitles and confirmations."""
        room_id = f"f12-room-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "user_a", "language": "en"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "user_b", "language": "es"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        # Turn 1: Client A speaks
        await client_a.emit("speech_segment", {
            "originalText": "Turn one transmission",
            "sourceLang": "en",
            "targetLang": "es",
        })
        sub_1 = await client_b.wait_for_event("peer_incoming_text", timeout=8.0)
        del_1 = await client_a.wait_for_event("speech_delivered", timeout=8.0)
        assert sub_1.get("originalText") == "Turn one transmission"
        assert del_1.get("originalText") == "Turn one transmission"

        # Turn 2: Client B speaks back
        await client_b.emit("speech_segment", {
            "originalText": "Turn two confirmation",
            "sourceLang": "es",
            "targetLang": "en",
        })
        sub_2 = await client_a.wait_for_event("peer_incoming_text", timeout=8.0)
        del_2 = await client_b.wait_for_event("speech_delivered", timeout=8.0)
        assert sub_2.get("originalText") == "Turn two confirmation"
        assert del_2.get("originalText") == "Turn two confirmation"

        await client_a.disconnect()
        await client_b.disconnect()
