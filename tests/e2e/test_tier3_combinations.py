"""Tier 3: Cross-Feature Combinations & Pipelines Test Suite.

Contains 14 comprehensive, opaque-box E2E test cases validating cross-feature
interactions, dual-channel coordination, and multi-service pipelines across:
- Speech Segment Pipeline + Domain Jargon Lock + Fallback Target Language
- WebRTC Signaling concurrent with active Speech Segment translation & TTS
- Mute Toggle state transition + Speech Segment Pipeline
- Prosody Intent detection (urgent/question) + Neural TTS synthesis
- STT Audio transcription piped into REST translation and Neural TTS
- Room Full rejection with zero impact on ongoing 2-caller active call
- In-call Language Update ('update_language') followed immediately by speech segment
- Domain Jargon Lock across multi-language pairs (English, Telugu, Hindi, Spanish)
- Solo Simulator Mode + Domain Jargon Lock + Executive Minutes generation
- Room departure + participant cleanup + second client reconnection
- Prosody stutter / phrase loop deduplication + punctuation + subtitle broadcast
- Admin DELETE /api/rooms/{room_id} executed while two callers are active
- Rapid dual-speaker cross-talk with non-interfering subtitle and audio delivery
- TTS Voice fallback chain with varied voice preferences during active call session
"""

import asyncio
import base64
import uuid
import pytest
from tests.e2e.harness import (
    create_synthetic_wav,
    generate_base64_audio,
)


class TestTier3Combinations:
    """Tier 3: Cross-Feature Interactions & Combinatorial Pipelines."""

    # --------------------------------------------------------------------------
    # 1. Speech Segment Pipeline + Domain Jargon Lock + Fallback Target Language
    # --------------------------------------------------------------------------
    async def test_t3_01_speech_segment_jargon_lock_and_fallback_target_language(
        self, socket_client_factory
    ):
        """Pairwise interaction: Speech Segment Pipeline + Domain Jargon Lock + Fallback Target Language.

        Validates that a speech segment containing medical domain colloquialisms
        ('heart attack') correctly locks into formal jargon ('[[myocardial infarction]]'),
        translates into the recipient's target language preserving the terminology,
        synthesizes neural TTS audio, and acknowledges to the speaker.
        """
        room_id = f"t3-room1-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        # Client A speaks Hindi, Client B listens in English
        await client_a.emit("join_room", {
            "roomId": room_id,
            "userId": "doctor_a",
            "userName": "Dr. Alice",
            "language": "hi",
            "voiceGender": "female",
        })
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)

        await client_b.emit("join_room", {
            "roomId": room_id,
            "userId": "patient_b",
            "userName": "Patient Bob",
            "language": "en",
            "voiceGender": "male",
        })
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        # Emit speech segment with medical domain terminology omitting targetLang
        # to verify fallback target language resolution (defaults to peer's registered 'en')
        await client_a.emit("speech_segment", {
            "originalText": "The patient suffered a sudden heart attack.",
            "sourceLang": "hi",
            "domain": "medical",
        })

        # Verify Client B receives incoming text with preserved jargon
        subtitle = await client_b.wait_for_event("peer_incoming_text", timeout=10.0)
        assert subtitle is not None
        assert subtitle.get("originalText") == "The patient suffered a sudden heart attack."
        assert subtitle.get("targetLang") == "en"
        assert subtitle.get("speakerId") == "doctor_a"
        trans_text = subtitle.get("translatedText", "")
        assert len(trans_text) > 0
        # The jargon term 'myocardial infarction' should be preserved and unbracketed
        assert "myocardial infarction" in trans_text.lower()
        assert "[[" not in trans_text and "]]" not in trans_text

        # Verify Client B receives synthesized neural audio
        audio_evt = await client_b.wait_for_event("translated_audio", timeout=10.0)
        assert audio_evt is not None
        assert audio_evt.get("audioBase64") is not None
        assert len(audio_evt["audioBase64"]) > 500

        # Verify Client A receives delivery confirmation
        delivered = await client_a.wait_for_event("speech_delivered", timeout=5.0)
        assert delivered is not None
        assert delivered.get("originalText") == "The patient suffered a sudden heart attack."

        await client_a.disconnect()
        await client_b.disconnect()

    # --------------------------------------------------------------------------
    # 2. WebRTC Signaling Concurrent with Active Speech Segment Translation & TTS
    # --------------------------------------------------------------------------
    async def test_t3_02_webrtc_signaling_concurrent_with_speech_segment_and_tts(
        self, socket_client_factory
    ):
        """Pairwise interaction: WebRTC Signaling (offer/answer/ice) concurrent with active Speech Segment translation & TTS.

        Verifies that simultaneous signaling exchanges and heavy TTS/translation pipelines
        do not drop packets, deadlock the socket, or corrupt state.
        """
        room_id = f"t3-room2-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "caller_a", "language": "en"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "caller_b", "language": "te"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        # Concurrently emit WebRTC signaling and speech segment
        offer_payload = {"offer": {"type": "offer", "sdp": "v=0\r\no=alice 1000 2 IN IP4 127.0.0.1"}}
        ice_payload = {"candidate": {"candidate": "candidate:1 1 UDP 2130706431 127.0.0.1 5000 typ host"}}

        # Start signaling and speech concurrently
        await asyncio.gather(
            client_a.emit("webrtc_offer", offer_payload),
            client_a.emit("webrtc_ice_candidate", ice_payload),
            client_a.emit("speech_segment", {
                "originalText": "Establishing secure WebRTC channel now",
                "sourceLang": "en",
                "targetLang": "te",
            }),
        )

        # Client B must receive the relayed offer and ICE candidate
        relayed_offer = await client_b.wait_for_event("webrtc_offer", timeout=5.0)
        assert relayed_offer.get("offer", {}).get("sdp") == offer_payload["offer"]["sdp"]

        relayed_ice = await client_b.wait_for_event("webrtc_ice_candidate", timeout=5.0)
        assert relayed_ice.get("candidate", {}).get("candidate") == ice_payload["candidate"]["candidate"]

        # Client B responds with WebRTC answer
        answer_payload = {"answer": {"type": "answer", "sdp": "v=0\r\no=bob 2000 2 IN IP4 127.0.0.1"}}
        await client_b.emit("webrtc_answer", answer_payload)
        relayed_answer = await client_a.wait_for_event("webrtc_answer", timeout=5.0)
        assert relayed_answer.get("answer", {}).get("sdp") == answer_payload["answer"]["sdp"]

        # Verify speech segment also arrived intact on Client B
        subtitle = await client_b.wait_for_event("peer_incoming_text", timeout=10.0)
        assert subtitle is not None
        assert "Establishing secure WebRTC" in subtitle.get("originalText", "")
        assert len(subtitle.get("translatedText", "")) > 0

        audio_evt = await client_b.wait_for_event("translated_audio", timeout=10.0)
        assert audio_evt is not None
        assert len(audio_evt.get("audioBase64", "")) > 100

        await client_a.disconnect()
        await client_b.disconnect()

    # --------------------------------------------------------------------------
    # 3. Mute Toggle State Transition + Speech Segment Pipeline
    # --------------------------------------------------------------------------
    async def test_t3_03_mute_toggle_state_transition_drops_and_resumes_speech(
        self, socket_client_factory
    ):
        """Pairwise interaction: Mute Toggle state transition + Speech Segment Pipeline.

        Verifies that:
        1. Emitting toggle_mute: true notifies peer via peer_mute_changed.
        2. Speech segment emitted while muted is silently discarded (no subtitle/audio).
        3. Emitting toggle_mute: false notifies peer.
        4. Speech segment emitted after unmute is processed and delivered normally.
        """
        room_id = f"t3-room3-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "user_a", "language": "en"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "user_b", "language": "es"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        # 1. Client A mutes microphone
        await client_a.emit("toggle_mute", {"isMuted": True})
        mute_evt = await client_b.wait_for_event("peer_mute_changed", timeout=5.0)
        assert mute_evt.get("isMuted") is True

        # 2. Client A emits speech while muted
        await client_a.emit("speech_segment", {
            "originalText": "This secret message should be dropped because I am muted",
            "sourceLang": "en",
            "targetLang": "es",
        })

        # Confirm nothing is delivered to Client B
        with pytest.raises(asyncio.TimeoutError):
            await client_b.wait_for_event("peer_incoming_text", timeout=1.5)

        # 3. Client A unmutes microphone
        await client_a.emit("toggle_mute", {"isMuted": False})
        unmute_evt = await client_b.wait_for_event("peer_mute_changed", timeout=5.0)
        assert unmute_evt.get("isMuted") is False

        # 4. Client A speaks while unmuted
        await client_a.emit("speech_segment", {
            "originalText": "Now I am unmuted and speaking clearly",
            "sourceLang": "en",
            "targetLang": "es",
        })

        # Client B must receive subtitle and audio
        subtitle = await client_b.wait_for_event("peer_incoming_text", timeout=10.0)
        assert subtitle is not None
        assert "Now I am unmuted" in subtitle.get("originalText", "")

        audio = await client_b.wait_for_event("translated_audio", timeout=10.0)
        assert audio is not None
        assert len(audio.get("audioBase64", "")) > 100

        await client_a.disconnect()
        await client_b.disconnect()

    # --------------------------------------------------------------------------
    # 4. Prosody Intent Detection + Neural TTS Speech Synthesis
    # --------------------------------------------------------------------------
    async def test_t3_04_prosody_intent_detection_with_neural_tts_and_punctuation(
        self, socket_client_factory
    ):
        """Pairwise interaction: Prosody Intent detection (urgent/question) + Neural TTS speech synthesis with expressive punctuation.

        Verifies that questions without terminal punctuation are detected as
        intent='question', assigned a trailing '?', and rendered into neural audio.
        Also validates that urgent exclamations get intent='exclamation' with trailing '!'.
        """
        room_id = f"t3-room4-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "speaker_a", "language": "en"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "listener_b", "language": "hi"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        # 1. Question without terminal '?'
        await client_a.emit("speech_segment", {
            "originalText": "Where are you going today",
            "sourceLang": "en",
            "targetLang": "hi",
        })

        sub_q = await client_b.wait_for_event("peer_incoming_text", timeout=10.0)
        assert sub_q.get("intent") == "question"
        assert sub_q.get("translatedText", "").endswith("?")

        audio_q = await client_b.wait_for_event("translated_audio", timeout=10.0)
        assert audio_q.get("translatedText", "").endswith("?")
        assert len(audio_q.get("audioBase64", "")) > 500

        # 2. Urgent exclamation
        await client_a.emit("speech_segment", {
            "originalText": "Help me immediately",
            "sourceLang": "en",
            "targetLang": "hi",
        })

        sub_ex = await client_b.wait_for_event("peer_incoming_text", timeout=10.0)
        assert sub_ex.get("intent") == "exclamation"
        assert sub_ex.get("translatedText", "").endswith("!")

        audio_ex = await client_b.wait_for_event("translated_audio", timeout=10.0)
        assert audio_ex.get("translatedText", "").endswith("!")

        await client_a.disconnect()
        await client_b.disconnect()

    # --------------------------------------------------------------------------
    # 5. STT Audio Transcription Output Piped into REST Translation & Neural TTS
    # --------------------------------------------------------------------------
    async def test_t3_05_stt_transcription_piped_into_rest_translation_and_neural_tts(
        self, http_client
    ):
        """Pairwise interaction: STT Audio transcription output piped into REST translation and Neural TTS.

        Verifies the full REST multi-tier media chain:
        POST /api/stt -> transcript -> POST /api/translate -> translated -> POST /api/tts -> audio_base64.
        """
        # Step 1: Synthesize valid audio and send to /api/stt
        b64_audio = generate_base64_audio(duration_ms=600, sample_rate=16000)
        stt_resp = await http_client.post("/api/stt", json={
            "audio_base64": b64_audio,
            "language": "en",
        })
        assert stt_resp.status_code == 200
        stt_data = stt_resp.json()
        assert "transcript" in stt_data

        # Feed transcript (or verified fallback phrase) into translation
        transcript_text = stt_data["transcript"] if stt_data["transcript"] else "Deploy the security patch today"

        # Step 2: Translate via /api/translate with fintech domain
        trans_resp = await http_client.post("/api/translate", json={
            "text": transcript_text,
            "source_lang": "en",
            "target_lang": "es",
            "domain": "fintech",
        })
        assert trans_resp.status_code == 200
        trans_data = trans_resp.json()
        translated_text = trans_data.get("translated")
        assert translated_text is not None and len(translated_text) > 0
        assert trans_data.get("target_lang") == "es"

        # Step 3: Synthesize translated text via /api/tts
        tts_resp = await http_client.post("/api/tts", json={
            "text": translated_text,
            "target_lang": "es",
            "gender": "female",
        })
        assert tts_resp.status_code == 200
        tts_data = tts_resp.json()
        assert tts_data.get("format") == "mp3"
        assert tts_data.get("target_lang") == "es"
        assert len(tts_data.get("audio_base64", "")) > 500

    # --------------------------------------------------------------------------
    # 6. Room Full Rejection with Zero Impact on Ongoing 2-Caller Active Call
    # --------------------------------------------------------------------------
    async def test_t3_06_room_full_rejection_isolated_from_active_two_caller_call(
        self, http_client, socket_client_factory
    ):
        """Pairwise interaction: Room Full rejection (3rd client rejected) with zero impact / complete isolation for ongoing 2-caller active call.

        Verifies that when a 3rd participant attempts to enter an active 2-party room:
        1. 3rd client receives 'room_full'.
        2. 3rd client is not added to room state.
        3. Active call between Client A and Client B continues completely unaffected.
        """
        room_id = f"t3-room6-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()
        client_c = socket_client_factory()

        await client_a.connect()
        await client_b.connect()
        await client_c.connect()

        # Clients A and B establish 2-caller room
        await client_a.emit("join_room", {"roomId": room_id, "userId": "caller_1", "language": "en"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "caller_2", "language": "hi"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        # Client C attempts entry
        await client_c.emit("join_room", {"roomId": room_id, "userId": "intruder_3", "language": "te"})
        full_evt = await client_c.wait_for_event("room_full", timeout=5.0)
        assert full_evt is not None
        assert "maximum capacity" in full_evt.get("message", "").lower()

        # Verify room fleet telemetry still has exactly 2 participants
        rooms_resp = await http_client.get("/api/rooms")
        assert rooms_resp.status_code == 200
        active_rooms = rooms_resp.json().get("rooms", {})
        assert room_id in active_rooms
        assert len(active_rooms[room_id]) == 2
        user_ids = [p["userId"] for p in active_rooms[room_id]]
        assert "intruder_3" not in user_ids

        # Client A continues speaking to Client B seamlessly
        await client_a.emit("speech_segment", {
            "originalText": "Our private conference remains completely secure",
            "sourceLang": "en",
            "targetLang": "hi",
        })

        # Client B receives subtitle and audio
        sub = await client_b.wait_for_event("peer_incoming_text", timeout=10.0)
        assert sub is not None
        assert "private conference" in sub.get("originalText", "")

        audio = await client_b.wait_for_event("translated_audio", timeout=10.0)
        assert audio is not None
        assert len(audio.get("audioBase64", "")) > 500

        # Client C receives nothing
        with pytest.raises(asyncio.TimeoutError):
            await client_c.wait_for_event("peer_incoming_text", timeout=1.5)

        await client_a.disconnect()
        await client_b.disconnect()
        await client_c.disconnect()

    # --------------------------------------------------------------------------
    # 7. In-Call Language Update Followed Immediately by Speech Segment
    # --------------------------------------------------------------------------
    async def test_t3_07_in_call_language_update_instant_translation(
        self, socket_client_factory
    ):
        """Pairwise interaction: In-call Language Update ('update_language') followed immediately by speech segment.

        Verifies that when a caller dynamically updates their listening language mid-call,
        subsequent speech segments automatically translate into the newly specified language.
        """
        room_id = f"t3-room7-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        # Client A speaks English, Client B initially listens in Hindi
        await client_a.emit("join_room", {"roomId": room_id, "userId": "host_a", "language": "en"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "guest_b", "language": "hi"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        # Client B updates language mid-call from Hindi to Telugu ('te')
        await client_b.emit("update_language", {
            "language": "te",
            "voiceGender": "female",
            "userName": "Guest Telugu",
        })

        # Client A receives peer_language_updated notification
        lang_update = await client_a.wait_for_event("peer_language_updated", timeout=5.0)
        assert lang_update.get("peerLanguage") == "te"
        assert lang_update.get("userName") == "Guest Telugu"

        # Client A emits speech without specifying targetLang (server uses peer's new language)
        await client_a.emit("speech_segment", {
            "originalText": "Welcome to our meeting today",
            "sourceLang": "en",
        })

        # Client B receives subtitle translated to Telugu
        sub = await client_b.wait_for_event("peer_incoming_text", timeout=10.0)
        assert sub is not None
        assert sub.get("targetLang") == "te"
        translated_text = sub.get("translatedText", "")
        assert len(translated_text) > 0
        # Check presence of Telugu Unicode chars
        assert any("\u0c00" <= ch <= "\u0c7f" for ch in translated_text)

        # Client B receives Telugu neural audio
        audio = await client_b.wait_for_event("translated_audio", timeout=10.0)
        assert audio is not None
        assert audio.get("targetLang") == "te"
        assert len(audio.get("audioBase64", "")) > 500

        await client_a.disconnect()
        await client_b.disconnect()

    # --------------------------------------------------------------------------
    # 8. Domain Jargon Lock Across Multi-Language Pairs (en, te, hi, es)
    # --------------------------------------------------------------------------
    async def test_t3_08_domain_jargon_lock_across_multi_language_pairs(
        self, http_client
    ):
        """Pairwise interaction: Domain Jargon Lock across multi-language pairs (English, Telugu, Hindi, Spanish).

        Tests enterprise jargon preservation across 4 distinct domain and language combinations:
        - Medical: en -> hi ('heart attack' -> 'myocardial infarction')
        - FinTech: en -> te ('operating profit' -> 'EBITDA margin')
        - Legal: en -> es ('unforeseen event' -> 'force majeure')
        - Engineering: en -> en ('safe retry' -> 'idempotent execution')
        """
        cases = [
            ("medical", "The doctor diagnosed a heart attack immediately.", "te", "en", "myocardial infarction"),
            ("fintech", "We must increase our operating profit this quarter.", "hi", "en", "ebitda margin"),
            ("legal", "This clause covers any unforeseen event.", "es", "en", "force majeure"),
            ("engineering", "Ensure each worker implements a safe retry strategy.", "en", "en", "idempotent execution"),
        ]

        for domain, text, src, tgt, expected_term in cases:
            resp = await http_client.post("/api/translate", json={
                "text": text,
                "source_lang": src,
                "target_lang": tgt,
                "domain": domain,
            })
            assert resp.status_code == 200, f"Failed for domain {domain}"
            data = resp.json()
            translated = data.get("translated", "").lower()
            assert expected_term in translated, f"Term '{expected_term}' missing in {domain} ({src}->{tgt}): '{translated}'"
            assert "[[" not in translated and "]]" not in translated

    # --------------------------------------------------------------------------
    # 9. Solo Simulator Mode + Domain Jargon Lock + Executive Minutes Generation
    # --------------------------------------------------------------------------
    async def test_t3_09_solo_simulator_jargon_lock_and_executive_minutes(
        self, http_client, socket_client_factory
    ):
        """Pairwise interaction: Solo Simulator Mode + Domain Jargon Lock + Executive Minutes generation.

        Verifies that:
        1. Single user in room operates in Solo Simulator mode (loopback).
        2. Domain terminology ('circuit breaker pattern') is locked and preserved.
        3. Resulting transcript utterances are compiled and submitted to POST /api/minutes,
           producing structured executive minutes.
        """
        room_id = f"t3-room9-{uuid.uuid4().hex[:8]}"
        client = socket_client_factory()

        await client.connect()
        await client.emit("join_room", {
            "roomId": room_id,
            "userId": "solo_trainee",
            "userName": "Alex Solo",
            "language": "en",
            "voiceGender": "male",
        })
        await client.wait_for_event("waiting_for_peer", timeout=5.0)

        # Emit solo utterance with engineering jargon translating to English
        await client.emit("speech_segment", {
            "originalText": "We must configure the load cut-off immediately.",
            "sourceLang": "hi",
            "targetLang": "en",
            "domain": "engineering",
        })

        # Solo tester receives loopback subtitle
        sub = await client.wait_for_event("peer_incoming_text", timeout=10.0)
        assert sub.get("isSolo") is True
        assert "circuit breaker pattern" in sub.get("translatedText", "").lower()
        assert sub.get("speakerId") == "Simulator (en)"

        # Solo tester receives loopback audio
        audio = await client.wait_for_event("translated_audio", timeout=10.0)
        assert audio.get("isSolo") is True
        assert len(audio.get("audioBase64", "")) > 500

        # Compile transcript and submit to /api/minutes
        transcript = [
            {
                "speaker": "Alex Solo",
                "originalText": "We must configure the load cut-off immediately.",
                "translatedText": sub.get("translatedText", ""),
            },
            {
                "speaker": "Simulator (hi)",
                "originalText": "Circuit breaker pattern configured successfully.",
                "translatedText": "सर्किट ब्रेकर पैटर्न सफलतापूर्वक कॉन्फ़िगर किया गया।",
            },
        ]

        min_resp = await http_client.post("/api/minutes", json={
            "transcript": transcript,
            "tier": "enterprise",
        })
        assert min_resp.status_code == 200
        min_data = min_resp.json()
        assert min_data.get("total_utterances") == 2
        assert "Alex Solo" in min_data.get("speakers", [])
        assert len(min_data.get("decisions", [])) > 0
        assert len(min_data.get("action_items", [])) > 0
        assert "sentiment" in min_data

        await client.disconnect()

    # --------------------------------------------------------------------------
    # 10. Room Departure + Participant Cleanup + Second Client Reconnection
    # --------------------------------------------------------------------------
    async def test_t3_10_room_departure_cleanup_and_reconnection(
        self, http_client, socket_client_factory
    ):
        """Pairwise interaction: Room departure + participant cleanup + second client reconnection under fresh or prior role.

        Verifies that:
        1. When Client B leaves via leave_room, Client A receives peer_disconnected.
        2. Room state drops to 1 participant.
        3. A reconnecting client can re-join the room, restoring peer_connected on both ends.
        4. Bidirectional speech translation functions normally after reconnection.
        """
        room_id = f"t3-room10-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()
        client_b2 = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        # Step 1: Initial pairing
        await client_a.emit("join_room", {"roomId": room_id, "userId": "anchor_a", "language": "en"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "temp_b", "language": "te"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        # Step 2: Client B explicitly leaves
        await client_b.emit("leave_room")
        disc_evt = await client_a.wait_for_event("peer_disconnected", timeout=5.0)
        assert disc_evt.get("peerId") == "temp_b"

        # Check telemetry reflects 1 participant
        resp = await http_client.get("/api/rooms")
        assert len(resp.json()["rooms"][room_id]) == 1

        # Step 3: Reconnecting client joins the room
        await client_b2.connect()
        await client_b2.emit("join_room", {"roomId": room_id, "userId": "reconnected_b", "language": "hi"})
        conn_a = await client_a.wait_for_event("peer_connected", timeout=5.0)
        conn_b2 = await client_b2.wait_for_event("peer_connected", timeout=5.0)
        assert conn_a.get("peer", {}).get("userId") == "reconnected_b"
        assert conn_b2.get("peer", {}).get("userId") == "anchor_a"

        # Step 4: Verify speech works across reconnected pair
        await client_a.emit("speech_segment", {
            "originalText": "Glad you could reconnect to the call",
            "sourceLang": "en",
            "targetLang": "hi",
        })
        sub = await client_b2.wait_for_event("peer_incoming_text", timeout=10.0)
        assert sub is not None
        assert "Glad you could reconnect" in sub.get("originalText", "")

        await client_a.disconnect()
        await client_b.disconnect()
        await client_b2.disconnect()

    # --------------------------------------------------------------------------
    # 11. Prosody Stutter / Phrase Loop Deduplication + Punctuation + Subtitle
    # --------------------------------------------------------------------------
    async def test_t3_11_prosody_phrase_loop_deduplication_and_punctuation_broadcast(
        self, socket_client_factory
    ):
        """Pairwise interaction: Prosody stutter / phrase loop deduplication + sentence punctuation + instant subtitle broadcast.

        Validates that repetitive stutters like 'hello hello hello are you there are you there'
        are deduplicated into 'hello are you there?', categorized as a question,
        and delivered as clean punctuated subtitles and neural audio.
        """
        room_id = f"t3-room11-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "stutter_user", "language": "en"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "listener_user", "language": "es"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        # Emit repetitive phrase loop stutter
        await client_a.emit("speech_segment", {
            "originalText": "hello hello hello where are you where are you",
            "sourceLang": "en",
            "targetLang": "es",
        })

        sub = await client_b.wait_for_event("peer_incoming_text", timeout=10.0)
        assert sub is not None
        # Enhanced text should deduplicate repeating single words and multi-word loops
        enhanced = sub.get("enhancedOriginal", "")
        assert "hello hello hello" not in enhanced
        assert "where are you where are you" not in enhanced
        assert sub.get("intent") == "question"
        assert sub.get("translatedText", "").endswith("?")

        audio = await client_b.wait_for_event("translated_audio", timeout=10.0)
        assert audio is not None
        assert len(audio.get("audioBase64", "")) > 500

        await client_a.disconnect()
        await client_b.disconnect()

    # --------------------------------------------------------------------------
    # 12. Admin DELETE /api/rooms/{room_id} During Active Call
    # --------------------------------------------------------------------------
    async def test_t3_12_admin_delete_room_during_active_call_broadcasts_terminated(
        self, http_client, socket_client_factory
    ):
        """Pairwise interaction: Admin DELETE /api/rooms/{room_id} executed while two callers are active.

        Verifies that:
        1. Calling DELETE /api/rooms/{room_id} terminates an active 2-party call.
        2. Both callers receive 'room_terminated' broadcast with administrative message.
        3. Room is completely purged from GET /api/rooms telemetry.
        """
        room_id = f"t3-room12-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "conf_a", "language": "en"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "conf_b", "language": "te"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        # Admin terminates room via REST API
        del_resp = await http_client.delete(f"/api/rooms/{room_id}")
        assert del_resp.status_code == 200
        del_data = del_resp.json()
        assert del_data.get("status") == "success"

        # Both participants receive room_terminated
        term_a = await client_a.wait_for_event("room_terminated", timeout=5.0)
        term_b = await client_b.wait_for_event("room_terminated", timeout=5.0)
        assert term_a is not None and "terminated" in term_a.get("message", "").lower()
        assert term_b is not None and "terminated" in term_b.get("message", "").lower()

        # Check telemetry confirms room is cleared
        rooms_resp = await http_client.get("/api/rooms")
        assert room_id not in rooms_resp.json().get("rooms", {})

        await client_a.disconnect()
        await client_b.disconnect()

    # --------------------------------------------------------------------------
    # 13. Rapid Dual-Speaker Cross-Talk with Non-Interfering Delivery
    # --------------------------------------------------------------------------
    async def test_t3_13_rapid_dual_speaker_cross_talk_non_interference(
        self, socket_client_factory
    ):
        """Pairwise interaction: Rapid dual-speaker cross-talk (Client A and Client B speak almost simultaneously).

        Verifies that when both participants speak at the exact same moment:
        1. Both segments are processed concurrently.
        2. Client A receives Client B's subtitle and audio.
        3. Client B receives Client A's subtitle and audio without mutual interference.
        """
        room_id = f"t3-room13-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        await client_a.emit("join_room", {"roomId": room_id, "userId": "debater_a", "language": "en"})
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
        await client_b.emit("join_room", {"roomId": room_id, "userId": "debater_b", "language": "es"})
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        # Both clients speak concurrently
        await asyncio.gather(
            client_a.emit("speech_segment", {
                "originalText": "I think we should proceed with option A",
                "sourceLang": "en",
                "targetLang": "es",
            }),
            client_b.emit("speech_segment", {
                "originalText": "No we must consider option B first",
                "sourceLang": "es",
                "targetLang": "en",
            }),
        )

        # Client A receives Client B's message
        sub_for_a = await client_a.wait_for_event("peer_incoming_text", timeout=12.0)
        assert sub_for_a.get("speakerId") == "debater_b"
        assert len(sub_for_a.get("translatedText", "")) > 0

        # Client B receives Client A's message
        sub_for_b = await client_b.wait_for_event("peer_incoming_text", timeout=12.0)
        assert sub_for_b.get("speakerId") == "debater_a"
        assert len(sub_for_b.get("translatedText", "")) > 0

        # Both receive audio
        audio_for_a = await client_a.wait_for_event("translated_audio", timeout=12.0)
        audio_for_b = await client_b.wait_for_event("translated_audio", timeout=12.0)
        assert len(audio_for_a.get("audioBase64", "")) > 100
        assert len(audio_for_b.get("audioBase64", "")) > 100

        await client_a.disconnect()
        await client_b.disconnect()

    # --------------------------------------------------------------------------
    # 14. TTS Voice Fallback Chain with Varied Voice Preferences
    # --------------------------------------------------------------------------
    async def test_t3_14_tts_voice_fallback_chain_with_varied_voice_preferences(
        self, socket_client_factory
    ):
        """Pairwise interaction: TTS Voice fallback chain with varied voice preferences during active call session.

        Verifies that changing voice persona (female vs male, or languages with regional voice maps)
        mid-call synthesizes speech reliably through the neural voice fallback chain.
        """
        room_id = f"t3-room14-{uuid.uuid4().hex[:8]}"
        client_a = socket_client_factory()
        client_b = socket_client_factory()

        await client_a.connect()
        await client_b.connect()

        # Client A joins with male voice preference
        await client_a.emit("join_room", {
            "roomId": room_id,
            "userId": "persona_a",
            "language": "en",
            "voiceGender": "male",
        })
        await client_a.wait_for_event("waiting_for_peer", timeout=5.0)

        # Client B joins with female voice preference
        await client_b.emit("join_room", {
            "roomId": room_id,
            "userId": "persona_b",
            "language": "te",
            "voiceGender": "female",
        })
        await client_a.wait_for_event("peer_connected", timeout=5.0)
        await client_b.wait_for_event("peer_connected", timeout=5.0)

        # First turn: Male voice synthesis
        await client_a.emit("speech_segment", {
            "originalText": "Speaking with male voice profile",
            "sourceLang": "en",
            "targetLang": "te",
        })
        audio_male = await client_b.wait_for_event("translated_audio", timeout=10.0)
        assert audio_male is not None
        assert len(audio_male.get("audioBase64", "")) > 500

        # Client A updates voice profile to female
        await client_a.emit("update_language", {
            "language": "en",
            "voiceGender": "female",
            "userName": "Persona A Female",
        })
        await client_b.wait_for_event("peer_language_updated", timeout=5.0)

        # Second turn: Female voice synthesis
        await client_a.emit("speech_segment", {
            "originalText": "Now speaking with female voice profile",
            "sourceLang": "en",
            "targetLang": "te",
        })
        audio_female = await client_b.wait_for_event("translated_audio", timeout=10.0)
        assert audio_female is not None
        assert len(audio_female.get("audioBase64", "")) > 500

        await client_a.disconnect()
        await client_b.disconnect()
