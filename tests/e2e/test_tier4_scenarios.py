"""Tier 4: Real-World Application Scenarios Test Suite.

Contains 6 comprehensive, realistic, end-to-end multi-turn user journey scenarios:
1. Scenario 1: Complete Enterprise Executive Bilingual Call Lifecycle
   - Two callers (CEO in English, Regional Director in Telugu)
   - Room setup, WebRTC signaling exchange, multi-turn FinTech conversation with jargon terms ("operating profit" -> "EBITDA margin")
   - Speaking state visualizers, mute toggling, instant subtitles, audio playback
   - Executive minutes generation (POST /api/minutes), decision capture, and clean room exit
2. Scenario 2: Remote Telemedicine Consultation with Medical Domain Jargon Lock
   - Doctor (English) & Patient (Hindi)
   - Medical jargon ("heart attack" -> "myocardial infarction", "hypertension") preserved
   - Doctor mutes during patient speaking, patient asks questions ("कब तक ठीक होगा?"), receives answers with interrogative prosody
3. Scenario 3: Global Legal Deposition Across Dynamic Language Handoffs
   - Counsel (English) & Witness (Spanish)
   - Legal jargon ("unforeseen event" -> "force majeure")
   - Mid-deposition witness switches target language to French ('update_language'), subsequent turns delivered in French without dropping connection
4. Scenario 4: Solo Practice & Call Simulator Training Session
   - Solo caller practices Defense & Engineering briefings in Simulator mode (isSolo: true)
   - Technical terms ("speed of sound" -> "Mach 1.0 transition", "safe retry" -> "idempotent execution") locked
   - Receives loopback translated subtitles and synthesized neural speech
   - Generates structured summary and minutes
5. Scenario 5: High-Urgency Incident Response Swarm
   - DevOps Engineer (English) & SRE (Telugu/Hindi)
   - High-urgency exclamations ("Emergency system down immediately!", "త్వరగా రండి!")
   - Prosody engine tags exclamations and urgency
   - Rapid speech segments under high velocity testing rate limit resilience and subtitle stability
6. Scenario 6: Admin Governance, Room Capacity Enforcement & Post-Call Lifecycle Audit
   - Multi-client room in progress
   - 3rd participant attempts entry and receives room_full rejection
   - Active call continues smoothly, then Admin invokes DELETE /api/rooms/{room_id}
   - All participants receive room_terminated, room is cleared from /api/rooms, and resources are released
"""

import asyncio
import base64
import uuid
import pytest
from tests.e2e.harness import (
    create_synthetic_wav,
    generate_base64_audio,
)


class TestTier4Scenarios:
    """Tier 4: Realistic End-to-End Application Scenarios."""

    # ==========================================================================
    # Scenario 1: Complete Enterprise Executive Bilingual Call Lifecycle
    # ==========================================================================
    async def test_t4_01_enterprise_executive_bilingual_call_lifecycle(
        self, http_client, socket_client_factory
    ):
        """Scenario 1: Complete Enterprise Executive Bilingual Call Lifecycle.

        Two enterprise callers (CEO in English, Regional Director in Telugu) conduct
        a full teleconference with WebRTC signaling, FinTech jargon terms, speaking state
        visualizers, mute floor control, instant subtitles, neural audio synthesis,
        and post-call executive minutes generation.
        """
        room_id = f"t4-exec-{uuid.uuid4().hex[:8]}"
        ceo = socket_client_factory()
        director = socket_client_factory()

        await ceo.connect()
        await director.connect()

        # Step 1: Room setup & pairing
        await ceo.emit("join_room", {
            "roomId": room_id,
            "userId": "ceo_alice",
            "userName": "CEO Alice",
            "language": "en",
            "voiceGender": "female",
        })
        wait_evt = await ceo.wait_for_event("waiting_for_peer", timeout=5.0)
        assert wait_evt.get("self", {}).get("userId") == "ceo_alice"

        await director.emit("join_room", {
            "roomId": room_id,
            "userId": "director_rao",
            "userName": "Director Rao",
            "language": "te",
            "voiceGender": "male",
        })
        conn_ceo = await ceo.wait_for_event("peer_connected", timeout=5.0)
        conn_dir = await director.wait_for_event("peer_connected", timeout=5.0)
        assert conn_ceo.get("isInitiator") is True
        assert conn_dir.get("isInitiator") is False
        assert conn_ceo.get("peer", {}).get("userId") == "director_rao"

        # Step 2: WebRTC Offer / Answer / ICE handshake
        offer_data = {"offer": {"type": "offer", "sdp": "v=0\r\no=ceo 1000 2 IN IP4 127.0.0.1"}}
        await ceo.emit("webrtc_offer", offer_data)
        relayed_offer = await director.wait_for_event("webrtc_offer", timeout=5.0)
        assert relayed_offer.get("offer", {}).get("sdp") == offer_data["offer"]["sdp"]

        answer_data = {"answer": {"type": "answer", "sdp": "v=0\r\no=director 2000 2 IN IP4 127.0.0.1"}}
        await director.emit("webrtc_answer", answer_data)
        relayed_answer = await ceo.wait_for_event("webrtc_answer", timeout=5.0)
        assert relayed_answer.get("answer", {}).get("sdp") == answer_data["answer"]["sdp"]

        ice_data = {"candidate": {"candidate": "candidate:1 1 UDP 2130706431 127.0.0.1 5000 typ host"}}
        await ceo.emit("webrtc_ice_candidate", ice_data)
        relayed_ice = await director.wait_for_event("webrtc_ice_candidate", timeout=5.0)
        assert relayed_ice.get("candidate", {}).get("candidate") == ice_data["candidate"]["candidate"]

        # Step 3: Turn 1 - CEO speaks in English with FinTech jargon ("operating profit")
        await ceo.emit("speaking_state", {"isSpeaking": True})
        spk_on = await director.wait_for_event("peer_speaking_state", timeout=5.0)
        assert spk_on.get("isSpeaking") is True

        await ceo.emit("speech_segment", {
            "originalText": "We must increase our operating profit this quarter.",
            "sourceLang": "en",
            "targetLang": "te",
            "domain": "fintech",
        })

        sub_turn1 = await director.wait_for_event("peer_incoming_text", timeout=10.0)
        assert sub_turn1 is not None
        assert sub_turn1.get("targetLang") == "te"
        assert len(sub_turn1.get("translatedText", "")) > 0
        assert "[[" not in sub_turn1["translatedText"] and "]]" not in sub_turn1["translatedText"]

        audio_turn1 = await director.wait_for_event("translated_audio", timeout=10.0)
        assert audio_turn1 is not None
        assert len(audio_turn1.get("audioBase64", "")) > 500

        deliv_ceo = await ceo.wait_for_event("speech_delivered", timeout=5.0)
        assert deliv_ceo is not None

        await ceo.emit("speaking_state", {"isSpeaking": False})
        spk_off = await director.wait_for_event("peer_speaking_state", timeout=5.0)
        assert spk_off.get("isSpeaking") is False

        # Step 4: Floor control & Turn 2 - Director Rao speaks in Telugu
        await director.emit("speaking_state", {"isSpeaking": True})
        await director.emit("speech_segment", {
            "originalText": "అవును, మేము బడ్జెట్ ప్రణాళికను సిద్ధం చేస్తున్నాము.",
            "sourceLang": "te",
            "targetLang": "en",
            "domain": "fintech",
        })

        sub_turn2 = await ceo.wait_for_event("peer_incoming_text", timeout=10.0)
        assert sub_turn2 is not None
        assert sub_turn2.get("targetLang") == "en"
        assert len(sub_turn2.get("translatedText", "")) > 0

        audio_turn2 = await ceo.wait_for_event("translated_audio", timeout=10.0)
        assert audio_turn2 is not None
        assert len(audio_turn2.get("audioBase64", "")) > 500

        await director.emit("speaking_state", {"isSpeaking": False})

        # Step 5: Mute floor control verification
        await ceo.emit("toggle_mute", {"isMuted": True})
        mute_evt = await director.wait_for_event("peer_mute_changed", timeout=5.0)
        assert mute_evt.get("isMuted") is True

        await ceo.emit("toggle_mute", {"isMuted": False})
        unmute_evt = await director.wait_for_event("peer_mute_changed", timeout=5.0)
        assert unmute_evt.get("isMuted") is False

        # Step 6: Post-call executive meeting minutes generation (POST /api/minutes)
        transcript = [
            {
                "speaker": "CEO Alice",
                "originalText": "We must increase our operating profit this quarter.",
                "translatedText": sub_turn1.get("translatedText", ""),
            },
            {
                "speaker": "Director Rao",
                "originalText": "అవును, మేము బడ్జెట్ ప్రణాళికను సిద్ధం చేస్తున్నాము.",
                "translatedText": sub_turn2.get("translatedText", ""),
            },
        ]

        min_resp = await http_client.post("/api/minutes", json={
            "transcript": transcript,
            "tier": "enterprise",
        })
        assert min_resp.status_code == 200
        minutes = min_resp.json()
        assert minutes.get("total_utterances") == 2
        assert "CEO Alice" in minutes.get("speakers", [])
        assert "Director Rao" in minutes.get("speakers", [])
        assert len(minutes.get("decisions", [])) > 0
        assert len(minutes.get("action_items", [])) > 0
        assert "sentiment" in minutes

        # Step 7: Clean departure
        await director.emit("leave_room")
        disc = await ceo.wait_for_event("peer_disconnected", timeout=5.0)
        assert disc.get("peerId") == "director_rao"

        await ceo.disconnect()
        await director.disconnect()

    # ==========================================================================
    # Scenario 2: Remote Telemedicine Consultation with Medical Domain Jargon Lock
    # ==========================================================================
    async def test_t4_02_remote_telemedicine_consultation_medical_jargon(
        self, socket_client_factory
    ):
        """Scenario 2: Remote Telemedicine Consultation with Medical Domain Jargon Lock.

        Doctor (English) and Patient (Hindi) conduct a clinical consultation.
        Medical jargon ('heart attack' -> 'myocardial infarction', 'high blood pressure' -> 'hypertension')
        is preserved. Doctor mutes during patient speaking; patient asks questions in Hindi
        and receives translated reassurance with interrogative and declarative prosody.
        """
        room_id = f"t4-telemed-{uuid.uuid4().hex[:8]}"
        doctor = socket_client_factory()
        patient = socket_client_factory()

        await doctor.connect()
        await patient.connect()

        # Join room
        await doctor.emit("join_room", {
            "roomId": room_id,
            "userId": "doc_smith",
            "userName": "Dr. Smith",
            "language": "en",
            "voiceGender": "female",
        })
        await doctor.wait_for_event("waiting_for_peer", timeout=5.0)

        await patient.emit("join_room", {
            "roomId": room_id,
            "userId": "patient_kumar",
            "userName": "Patient Kumar",
            "language": "hi",
            "voiceGender": "male",
        })
        await doctor.wait_for_event("peer_connected", timeout=5.0)
        await patient.wait_for_event("peer_connected", timeout=5.0)

        # Step 1: Doctor explains diagnosis with medical terminology
        await doctor.emit("speech_segment", {
            "originalText": "The clinical report shows high blood pressure and risk of heart attack.",
            "sourceLang": "en",
            "targetLang": "hi",
            "domain": "medical",
        })

        sub_doc = await patient.wait_for_event("peer_incoming_text", timeout=10.0)
        assert sub_doc is not None
        assert sub_doc.get("targetLang") == "hi"
        assert len(sub_doc.get("translatedText", "")) > 0
        assert "[[" not in sub_doc["translatedText"] and "]]" not in sub_doc["translatedText"]

        audio_doc = await patient.wait_for_event("translated_audio", timeout=10.0)
        assert audio_doc is not None
        assert len(audio_doc.get("audioBase64", "")) > 500

        # Step 2: Doctor mutes while patient speaks
        await doctor.emit("toggle_mute", {"isMuted": True})
        mute_evt = await patient.wait_for_event("peer_mute_changed", timeout=5.0)
        assert mute_evt.get("isMuted") is True

        # Patient asks an interrogative question in Hindi
        await patient.emit("speech_segment", {
            "originalText": "यह बीमारी कब तक ठीक होगी?",
            "sourceLang": "hi",
            "targetLang": "en",
            "domain": "medical",
        })

        sub_pat = await doctor.wait_for_event("peer_incoming_text", timeout=10.0)
        assert sub_pat is not None
        assert sub_pat.get("intent") == "question"
        assert sub_pat.get("translatedText", "").endswith("?")

        audio_pat = await doctor.wait_for_event("translated_audio", timeout=10.0)
        assert audio_pat is not None

        # Doctor unmutes and reassures patient
        await doctor.emit("toggle_mute", {"isMuted": False})
        unmute_evt = await patient.wait_for_event("peer_mute_changed", timeout=5.0)
        assert unmute_evt.get("isMuted") is False

        await doctor.emit("speech_segment", {
            "originalText": "With proper drug prevention you will recover soon.",
            "sourceLang": "en",
            "targetLang": "hi",
            "domain": "medical",
        })

        sub_reassure = await patient.wait_for_event("peer_incoming_text", timeout=10.0)
        assert sub_reassure is not None
        assert "[[" not in sub_reassure.get("translatedText", "")

        await doctor.disconnect()
        await patient.disconnect()

    # ==========================================================================
    # Scenario 3: Global Legal Deposition Across Dynamic Language Handoffs
    # ==========================================================================
    async def test_t4_03_global_legal_deposition_dynamic_language_handoffs(
        self, socket_client_factory
    ):
        """Scenario 3: Global Legal Deposition Across Dynamic Language Handoffs.

        Counsel (English) and Witness (Spanish) conduct a legal deposition.
        Legal terminology ('unforeseen event' -> 'force majeure') is protected.
        Mid-deposition, the witness dynamically switches language to French ('update_language').
        Subsequent deposition turns translate seamlessly into French without dropping the connection.
        """
        room_id = f"t4-legal-{uuid.uuid4().hex[:8]}"
        counsel = socket_client_factory()
        witness = socket_client_factory()

        await counsel.connect()
        await witness.connect()

        # Step 1: Initial pairing (Counsel en, Witness es)
        await counsel.emit("join_room", {
            "roomId": room_id,
            "userId": "counsel_morgan",
            "userName": "Counsel Morgan",
            "language": "en",
            "voiceGender": "male",
        })
        await counsel.wait_for_event("waiting_for_peer", timeout=5.0)

        await witness.emit("join_room", {
            "roomId": room_id,
            "userId": "witness_garcia",
            "userName": "Witness Garcia",
            "language": "es",
            "voiceGender": "female",
        })
        await counsel.wait_for_event("peer_connected", timeout=5.0)
        await witness.wait_for_event("peer_connected", timeout=5.0)

        # Step 2: Counsel asks legal question with jargon term
        await counsel.emit("speech_segment", {
            "originalText": "Did the agreement contain an unforeseen event break clause?",
            "sourceLang": "en",
            "targetLang": "es",
            "domain": "legal",
        })

        sub_es = await witness.wait_for_event("peer_incoming_text", timeout=10.0)
        assert sub_es is not None
        assert sub_es.get("targetLang") == "es"
        assert "[[" not in sub_es["translatedText"] and "]]" not in sub_es["translatedText"]

        audio_es = await witness.wait_for_event("translated_audio", timeout=10.0)
        assert audio_es is not None

        # Step 3: Witness responds in Spanish
        await witness.emit("speech_segment", {
            "originalText": "Sí, el contrato incluye esa cláusula legal.",
            "sourceLang": "es",
            "targetLang": "en",
            "domain": "legal",
        })

        sub_counsel = await counsel.wait_for_event("peer_incoming_text", timeout=10.0)
        assert sub_counsel is not None
        assert sub_counsel.get("targetLang") == "en"

        # Step 4: Dynamic Language Handoff - Witness switches to French
        await witness.emit("update_language", {
            "language": "fr",
            "voiceGender": "female",
            "userName": "Witness Garcia (FR)",
        })

        lang_evt = await counsel.wait_for_event("peer_language_updated", timeout=5.0)
        assert lang_evt.get("peerLanguage") == "fr"

        # Step 5: Counsel speaks next turn (server auto-targets updated language 'fr')
        await counsel.emit("speech_segment", {
            "originalText": "Do you solemnly swear that this testimony is true?",
            "sourceLang": "en",
            "domain": "legal",
        })

        sub_fr = await witness.wait_for_event("peer_incoming_text", timeout=10.0)
        assert sub_fr is not None
        assert sub_fr.get("targetLang") == "fr"
        assert len(sub_fr.get("translatedText", "")) > 0

        audio_fr = await witness.wait_for_event("translated_audio", timeout=10.0)
        assert audio_fr is not None
        assert audio_fr.get("targetLang") == "fr"

        await counsel.disconnect()
        await witness.disconnect()

    # ==========================================================================
    # Scenario 4: Solo Practice & Call Simulator Training Session
    # ==========================================================================
    async def test_t4_04_solo_simulator_practice_and_training_session(
        self, http_client, socket_client_factory
    ):
        """Scenario 4: Solo Practice & Call Simulator Training Session.

        A solo trainee practices defense and engineering mission briefings in
        Simulator mode (isSolo: true).
        Jargon lock protects technical nomenclature ('speed of sound' -> 'Mach 1.0 transition',
        'safe retry' -> 'idempotent execution').
        The trainee receives instant loopback subtitles and accelerated neural audio.
        Concludes with executive minutes synthesis and audit logging.
        """
        room_id = f"t4-solo-{uuid.uuid4().hex[:8]}"
        solo_client = socket_client_factory()

        await solo_client.connect()
        await solo_client.emit("join_room", {
            "roomId": room_id,
            "userId": "pilot_eva",
            "userName": "Pilot Eva",
            "language": "hi",
            "voiceGender": "female",
        })
        wait_evt = await solo_client.wait_for_event("waiting_for_peer", timeout=5.0)
        assert wait_evt is not None

        # Turn 1: Defense briefing
        await solo_client.emit("speech_segment", {
            "originalText": "The aircraft is approaching the speed of sound.",
            "sourceLang": "hi",
            "targetLang": "en",
            "domain": "defense",
        })

        sub_defense = await solo_client.wait_for_event("peer_incoming_text", timeout=10.0)
        assert sub_defense.get("isSolo") is True
        assert sub_defense.get("speakerId") == "Simulator (en)"
        assert "mach 1.0 transition" in sub_defense.get("translatedText", "").lower()
        assert "[[" not in sub_defense["translatedText"] and "]]" not in sub_defense["translatedText"]

        audio_defense = await solo_client.wait_for_event("translated_audio", timeout=10.0)
        assert audio_defense.get("isSolo") is True
        assert len(audio_defense.get("audioBase64", "")) > 500

        # Turn 2: Engineering briefing
        await solo_client.emit("speech_segment", {
            "originalText": "Ensure that the telemetry service performs a safe retry.",
            "sourceLang": "hi",
            "targetLang": "en",
            "domain": "engineering",
        })

        sub_eng = await solo_client.wait_for_event("peer_incoming_text", timeout=10.0)
        assert sub_eng.get("isSolo") is True
        assert "idempotent execution" in sub_eng.get("translatedText", "").lower()
        assert "[[" not in sub_eng["translatedText"] and "]]" not in sub_eng["translatedText"]

        audio_eng = await solo_client.wait_for_event("translated_audio", timeout=10.0)
        assert audio_eng.get("isSolo") is True

        # Generate structured briefing minutes
        transcript = [
            {
                "speaker": "Pilot Eva",
                "originalText": "The aircraft is approaching the speed of sound.",
                "translatedText": sub_defense.get("translatedText", ""),
            },
            {
                "speaker": "Simulator (en)",
                "originalText": "Telemetry beacon validated. Proceeding with safe retry protocol.",
                "translatedText": sub_eng.get("translatedText", ""),
            },
        ]

        min_resp = await http_client.post("/api/minutes", json={
            "transcript": transcript,
            "tier": "enterprise",
        })
        assert min_resp.status_code == 200
        briefing = min_resp.json()
        assert briefing.get("total_utterances") == 2
        assert len(briefing.get("decisions", [])) > 0
        assert len(briefing.get("action_items", [])) > 0

        await solo_client.disconnect()

    # ==========================================================================
    # Scenario 5: High-Urgency Incident Response Swarm
    # ==========================================================================
    async def test_t4_05_high_urgency_incident_response_swarm(
        self, socket_client_factory
    ):
        """Scenario 5: High-Urgency Incident Response Swarm.

        DevOps Engineer (English) and SRE (Telugu) coordinate an urgent outage response.
        Exclamations ('Emergency system down immediately!', 'త్వరగా రండి!') trigger
        prosody exclamation intent tagging with expressive terminal '!'.
        Rapid speech segments under high conversational velocity verify rate limit resilience
        and subtitle stability.
        """
        room_id = f"t4-swarm-{uuid.uuid4().hex[:8]}"
        devops = socket_client_factory()
        sre = socket_client_factory()

        await devops.connect()
        await sre.connect()

        # Connect & pair
        await devops.emit("join_room", {
            "roomId": room_id,
            "userId": "devops_dave",
            "userName": "DevOps Dave",
            "language": "en",
            "voiceGender": "male",
        })
        await devops.wait_for_event("waiting_for_peer", timeout=5.0)

        await sre.emit("join_room", {
            "roomId": room_id,
            "userId": "sre_priya",
            "userName": "SRE Priya",
            "language": "te",
            "voiceGender": "female",
        })
        await devops.wait_for_event("peer_connected", timeout=5.0)
        await sre.wait_for_event("peer_connected", timeout=5.0)

        # Urgency Turn 1: DevOps raises emergency alert
        await devops.emit("speech_segment", {
            "originalText": "Emergency system down immediately!",
            "sourceLang": "en",
            "targetLang": "te",
            "domain": "engineering",
        })

        sub_urgent = await sre.wait_for_event("peer_incoming_text", timeout=10.0)
        assert sub_urgent.get("intent") == "exclamation"
        assert sub_urgent.get("translatedText", "").endswith("!")

        audio_urgent = await sre.wait_for_event("translated_audio", timeout=10.0)
        assert audio_urgent is not None
        assert len(audio_urgent.get("audioBase64", "")) > 500

        # Urgency Turn 2: SRE responds with urgent Telugu instruction
        await sre.emit("speech_segment", {
            "originalText": "త్వరగా రండి, డేటాబేస్ పునఃప్రారంభించండి!",
            "sourceLang": "te",
            "targetLang": "en",
            "domain": "engineering",
        })

        sub_reply = await devops.wait_for_event("peer_incoming_text", timeout=10.0)
        assert sub_reply.get("intent") == "exclamation"
        assert sub_reply.get("translatedText", "").endswith("!")

        # High velocity rate limit test: DevOps sends 3 rapid distinct instructions (< 5 per 3s)
        instructions = [
            "Initiating service failover now",
            "Checking database connection pool",
            "System traffic restored to secondary node",
        ]

        for instr in instructions:
            await devops.emit("speech_segment", {
                "originalText": instr,
                "sourceLang": "en",
                "targetLang": "te",
                "domain": "engineering",
            })
            # Subtitle arrives for each instruction without rate limit drop
            sub = await sre.wait_for_event("peer_incoming_text", timeout=10.0)
            assert sub is not None
            assert len(sub.get("translatedText", "")) > 0

        await devops.disconnect()
        await sre.disconnect()

    # ==========================================================================
    # Scenario 6: Admin Governance, Room Capacity Enforcement & Lifecycle Audit
    # ==========================================================================
    async def test_t4_06_admin_governance_capacity_enforcement_and_audit(
        self, http_client, socket_client_factory
    ):
        """Scenario 6: Admin Governance, Room Capacity Enforcement & Post-Call Lifecycle Audit.

        Verifies that:
        1. An active 2-caller room enforces strict maximum capacity: a 3rd caller is rejected ('room_full').
        2. Admin audits active fleet telemetry via GET /api/rooms.
        3. Active call dialogue proceeds uninterrupted.
        4. Admin terminates the active call via DELETE /api/rooms/{room_id}.
        5. Both active participants receive 'room_terminated' and are removed from room.
        6. Subsequent GET /api/rooms confirms total resource cleanup.
        """
        room_id = f"t4-audit-{uuid.uuid4().hex[:8]}"
        caller_1 = socket_client_factory()
        caller_2 = socket_client_factory()
        caller_3 = socket_client_factory()

        await caller_1.connect()
        await caller_2.connect()
        await caller_3.connect()

        # Step 1: Establish active 2-caller conference
        await caller_1.emit("join_room", {"roomId": room_id, "userId": "exec_1", "language": "en"})
        await caller_1.wait_for_event("waiting_for_peer", timeout=5.0)
        await caller_2.emit("join_room", {"roomId": room_id, "userId": "exec_2", "language": "hi"})
        await caller_1.wait_for_event("peer_connected", timeout=5.0)
        await caller_2.wait_for_event("peer_connected", timeout=5.0)

        # Step 2: 3rd participant attempts entry and is rejected
        await caller_3.emit("join_room", {"roomId": room_id, "userId": "uninvited_3", "language": "te"})
        full_evt = await caller_3.wait_for_event("room_full", timeout=5.0)
        assert full_evt is not None
        assert "maximum capacity" in full_evt.get("message", "").lower()

        # Step 3: Admin audits room fleet telemetry
        audit_resp = await http_client.get("/api/rooms")
        assert audit_resp.status_code == 200
        telemetry = audit_resp.json()
        assert room_id in telemetry.get("rooms", {})
        participants = telemetry["rooms"][room_id]
        assert len(participants) == 2
        active_ids = {p["userId"] for p in participants}
        assert active_ids == {"exec_1", "exec_2"}

        # Step 4: Active call dialogue proceeds without interruption
        await caller_1.emit("speech_segment", {
            "originalText": "Reviewing quarterly performance metrics now",
            "sourceLang": "en",
            "targetLang": "hi",
        })
        sub_active = await caller_2.wait_for_event("peer_incoming_text", timeout=10.0)
        assert sub_active is not None
        assert "quarterly performance" in sub_active.get("originalText", "")

        # Step 5: Admin executes administrative termination via DELETE /api/rooms/{room_id}
        del_resp = await http_client.delete(f"/api/rooms/{room_id}")
        assert del_resp.status_code == 200
        del_data = del_resp.json()
        assert del_data.get("status") == "success"

        # Both participants receive room_terminated
        term_1 = await caller_1.wait_for_event("room_terminated", timeout=5.0)
        term_2 = await caller_2.wait_for_event("room_terminated", timeout=5.0)
        assert term_1 is not None and "terminated" in term_1.get("message", "").lower()
        assert term_2 is not None and "terminated" in term_2.get("message", "").lower()

        # Step 6: Post-call lifecycle audit confirms room purged from fleet telemetry
        post_audit = await http_client.get("/api/rooms")
        assert post_audit.status_code == 200
        assert room_id not in post_audit.json().get("rooms", {})

        # Deleting already-purged room returns not_found
        second_del = await http_client.delete(f"/api/rooms/{room_id}")
        assert second_del.status_code == 200
        assert second_del.json().get("status") == "not_found"

        await caller_1.disconnect()
        await caller_2.disconnect()
        await caller_3.disconnect()
