import pytest
import asyncio
import socket
import threading
import time
import socketio
import uvicorn
from backend.main import socket_app
from backend.socket_handlers import rooms, sid_to_room, socket_activity

def get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

@pytest.fixture(scope="module", autouse=True)
def live_server():
    port = get_free_port()
    config = uvicorn.Config(socket_app, host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    time.sleep(1.0) # Wait for server to bind and listen
    yield port
    server.should_exit = True
    thread.join(timeout=2.0)
    rooms.clear()
    sid_to_room.clear()
    socket_activity.clear()

def test_join_room_and_peer_connected(live_server):
    async def _run():
        server_url = f"http://127.0.0.1:{live_server}"
        sio1 = socketio.AsyncClient()
        sio2 = socketio.AsyncClient()

        waiting_event = asyncio.Event()
        peer_connected_event_1 = asyncio.Event()
        peer_connected_event_2 = asyncio.Event()

        @sio1.event
        def waiting_for_peer(data):
            waiting_event.set()

        @sio1.event
        def peer_connected(data):
            assert data["isInitiator"] is True
            assert data["peer"]["userId"] == "User_B"
            peer_connected_event_1.set()

        @sio2.event
        def peer_connected(data):
            assert data["isInitiator"] is False
            assert data["peer"]["userId"] == "User_A"
            peer_connected_event_2.set()

        await sio1.connect(server_url)
        await sio1.emit("join_room", {"roomId": "room-pair-1", "userId": "User_A", "language": "te"})
        await asyncio.wait_for(waiting_event.wait(), timeout=4.0)

        await sio2.connect(server_url)
        await sio2.emit("join_room", {"roomId": "room-pair-1", "userId": "User_B", "language": "hi"})
        await asyncio.wait_for(peer_connected_event_1.wait(), timeout=4.0)
        await asyncio.wait_for(peer_connected_event_2.wait(), timeout=4.0)

        await sio1.disconnect()
        await sio2.disconnect()
    asyncio.run(_run())

def test_maximum_capacity_rejection(live_server):
    async def _run():
        server_url = f"http://127.0.0.1:{live_server}"
        sio1 = socketio.AsyncClient()
        sio2 = socketio.AsyncClient()
        sio3 = socketio.AsyncClient()

        room_full_event = asyncio.Event()
        room_full_payload = {}

        @sio3.event
        def room_full(data):
            room_full_payload.update(data)
            room_full_event.set()

        await sio1.connect(server_url)
        await sio2.connect(server_url)
        await sio3.connect(server_url)

        await sio1.emit("join_room", {"roomId": "room-full-test", "userId": "User_1"})
        await sio2.emit("join_room", {"roomId": "room-full-test", "userId": "User_2"})
        await asyncio.sleep(0.4)

        # 3rd user tries to join the same room
        await sio3.emit("join_room", {"roomId": "room-full-test", "userId": "User_3"})
        await asyncio.wait_for(room_full_event.wait(), timeout=4.0)

        assert "maximum capacity" in room_full_payload.get("message", "").lower()

        await sio1.disconnect()
        await sio2.disconnect()
        await sio3.disconnect()
    asyncio.run(_run())

def test_multi_room_isolation(live_server):
    async def _run():
        server_url = f"http://127.0.0.1:{live_server}"
        # Room Alpha
        sio_a1 = socketio.AsyncClient()
        sio_a2 = socketio.AsyncClient()
        # Room Beta
        sio_b1 = socketio.AsyncClient()
        sio_b2 = socketio.AsyncClient()

        received_in_alpha = []
        received_in_beta = []
        alpha_event = asyncio.Event()

        @sio_a2.event
        def peer_incoming_text(data):
            received_in_alpha.append(data.get("originalText"))
            alpha_event.set()

        @sio_b2.event
        def peer_incoming_text(data):
            received_in_beta.append(data.get("originalText"))

        await sio_a1.connect(server_url)
        await sio_a2.connect(server_url)
        await sio_b1.connect(server_url)
        await sio_b2.connect(server_url)

        await sio_a1.emit("join_room", {"roomId": "room-alpha", "userId": "Alpha_1", "language": "en"})
        await sio_a2.emit("join_room", {"roomId": "room-alpha", "userId": "Alpha_2", "language": "hi"})

        await sio_b1.emit("join_room", {"roomId": "room-beta", "userId": "Beta_1", "language": "en"})
        await sio_b2.emit("join_room", {"roomId": "room-beta", "userId": "Beta_2", "language": "hi"})

        await asyncio.sleep(0.5)

        # Alpha 1 speaks
        await sio_a1.emit("speech_segment", {"originalText": "Secret Alpha Message", "sourceLang": "en"})
        await asyncio.wait_for(alpha_event.wait(), timeout=5.0)

        assert "Secret Alpha Message" in received_in_alpha
        # Crucial: Beta MUST NOT receive Alpha's message!
        assert "Secret Alpha Message" not in received_in_beta

        await sio_a1.disconnect()
        await sio_a2.disconnect()
        await sio_b1.disconnect()
        await sio_b2.disconnect()
    asyncio.run(_run())

def test_rate_limiting_guard(live_server):
    async def _run():
        server_url = f"http://127.0.0.1:{live_server}"
        sio1 = socketio.AsyncClient()
        sio2 = socketio.AsyncClient()

        error_event = asyncio.Event()

        @sio1.event
        def speech_error(data):
            if "rate limit" in data.get("error", "").lower():
                error_event.set()

        await sio1.connect(server_url)
        await sio2.connect(server_url)

        await sio1.emit("join_room", {"roomId": "room-rate-limit", "userId": "Spammer", "language": "en"})
        await sio2.emit("join_room", {"roomId": "room-rate-limit", "userId": "Receiver", "language": "hi"})
        await asyncio.sleep(0.4)

        # Rapid spam (6 segments in burst)
        for _ in range(6):
            await sio1.emit("speech_segment", {"originalText": "Spam phrase", "sourceLang": "en"})

        await asyncio.wait_for(error_event.wait(), timeout=4.0)

        await sio1.disconnect()
        await sio2.disconnect()
    asyncio.run(_run())

def test_reconnection_same_user_refreshes(live_server):
    async def _run():
        server_url = f"http://127.0.0.1:{live_server}"
        sio_stay = socketio.AsyncClient()
        sio_refresh_old = socketio.AsyncClient()
        sio_refresh_new = socketio.AsyncClient()

        connected_events = []

        @sio_stay.event
        def peer_connected(data):
            connected_events.append(data)

        await sio_stay.connect(server_url)
        await sio_refresh_old.connect(server_url)

        await sio_stay.emit("join_room", {"roomId": "room-refresh-test", "userId": "User_Stay", "language": "te"})
        await sio_refresh_old.emit("join_room", {"roomId": "room-refresh-test", "userId": "User_Refresher", "language": "hi"})
        await asyncio.sleep(0.5)

        assert len(connected_events) == 1

        # User_Refresher connects on a new socket (simulating page reload) without explicitly disconnecting old socket
        await sio_refresh_new.connect(server_url)
        await sio_refresh_new.emit("join_room", {"roomId": "room-refresh-test", "userId": "User_Refresher", "language": "hi"})
        await asyncio.sleep(0.5)

        # User_Stay should receive peer_connected again for the reconnected user
        assert len(connected_events) == 2
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{server_url}/api/rooms") as resp:
                data = await resp.json()
                assert len(data["rooms"].get("room-refresh-test", [])) == 2

        await sio_stay.disconnect()
        await sio_refresh_old.disconnect()
        await sio_refresh_new.disconnect()
    asyncio.run(_run())

def test_explicit_leave_room(live_server):
    async def _run():
        server_url = f"http://127.0.0.1:{live_server}"
        sio1 = socketio.AsyncClient()
        sio2 = socketio.AsyncClient()

        peer_disconnected_event = asyncio.Event()

        @sio1.event
        def peer_disconnected(data):
            peer_disconnected_event.set()

        await sio1.connect(server_url)
        await sio2.connect(server_url)

        await sio1.emit("join_room", {"roomId": "room-leave-test", "userId": "Leaver_Listener"})
        await sio2.emit("join_room", {"roomId": "room-leave-test", "userId": "Leaver_Actor"})
        await asyncio.sleep(0.4)

        # Sio2 explicitly leaves room
        await sio2.emit("leave_room")
        await asyncio.wait_for(peer_disconnected_event.wait(), timeout=4.0)

        # Room should now only have 1 participant
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{server_url}/api/rooms") as resp:
                data = await resp.json()
                assert len(data["rooms"].get("room-leave-test", [])) == 1

        await sio1.disconnect()
        await sio2.disconnect()
    asyncio.run(_run())

def test_webrtc_signaling_and_peer_controls(live_server):
    async def _run():
        server_url = f"http://127.0.0.1:{live_server}"
        sio1 = socketio.AsyncClient()
        sio2 = socketio.AsyncClient()

        offer_event = asyncio.Event()
        answer_event = asyncio.Event()
        ice_event = asyncio.Event()
        mute_event = asyncio.Event()
        lang_event = asyncio.Event()

        received_offer = {}
        received_answer = {}
        received_ice = {}
        received_mute = {}
        received_lang = {}

        @sio2.event
        def webrtc_offer(data):
            received_offer.update(data)
            offer_event.set()

        @sio1.event
        def webrtc_answer(data):
            received_answer.update(data)
            answer_event.set()

        @sio2.event
        def webrtc_ice_candidate(data):
            received_ice.update(data)
            ice_event.set()

        @sio2.event
        def peer_mute_changed(data):
            received_mute.update(data)
            mute_event.set()

        @sio2.event
        def peer_language_updated(data):
            received_lang.update(data)
            lang_event.set()

        await sio1.connect(server_url)
        await sio2.connect(server_url)

        await sio1.emit("join_room", {"roomId": "room-signaling-test", "userId": "Signaler_1", "language": "te", "voiceGender": "female"})
        await sio2.emit("join_room", {"roomId": "room-signaling-test", "userId": "Signaler_2", "language": "hi", "voiceGender": "female"})
        await asyncio.sleep(0.4)

        # 1. Offer
        await sio1.emit("webrtc_offer", {"sdp": "mock-sdp-offer", "type": "offer"})
        await asyncio.wait_for(offer_event.wait(), timeout=3.0)
        assert received_offer.get("sdp") == "mock-sdp-offer"

        # 2. Answer
        await sio2.emit("webrtc_answer", {"sdp": "mock-sdp-answer", "type": "answer"})
        await asyncio.wait_for(answer_event.wait(), timeout=3.0)
        assert received_answer.get("sdp") == "mock-sdp-answer"

        # 3. ICE Candidate
        await sio1.emit("webrtc_ice_candidate", {"candidate": "candidate:12345"})
        await asyncio.wait_for(ice_event.wait(), timeout=3.0)
        assert received_ice.get("candidate") == "candidate:12345"

        # 4. Mute toggle
        await sio1.emit("toggle_mute", {"isMuted": True})
        await asyncio.wait_for(mute_event.wait(), timeout=3.0)
        assert received_mute.get("isMuted") is True

        # 5. Language update
        await sio1.emit("update_language", {"language": "ta", "voiceGender": "male"})
        await asyncio.wait_for(lang_event.wait(), timeout=3.0)
        assert received_lang.get("peerLanguage") == "ta"
        assert received_lang.get("voiceGender") == "male"

        await sio1.disconnect()
        await sio2.disconnect()
    asyncio.run(_run())

def test_invalid_room_id_rejection(live_server):
    async def _run():
        server_url = f"http://127.0.0.1:{live_server}"
        sio = socketio.AsyncClient()
        error_event = asyncio.Event()
        error_payload = {}

        @sio.event
        def error(data):
            error_payload.update(data)
            error_event.set()

        await sio.connect(server_url)
        # Invalid roomId (too short, spaces, special chars)
        await sio.emit("join_room", {"roomId": "x!"})
        await asyncio.wait_for(error_event.wait(), timeout=3.0)
        assert "Invalid roomId" in error_payload.get("message", "")

        await sio.disconnect()
    asyncio.run(_run())

def test_speech_segment_none_or_empty_text(live_server):
    async def _run():
        server_url = f"http://127.0.0.1:{live_server}"
        sio1 = socketio.AsyncClient()
        sio2 = socketio.AsyncClient()

        received_events = []

        @sio2.event
        def peer_incoming_text(data):
            received_events.append(data)

        await sio1.connect(server_url)
        await sio2.connect(server_url)

        await sio1.emit("join_room", {"roomId": "room-empty-text", "userId": "Speaker", "language": "te"})
        await sio2.emit("join_room", {"roomId": "room-empty-text", "userId": "Listener", "language": "hi"})
        await asyncio.sleep(0.4)

        # None text
        await sio1.emit("speech_segment", {"originalText": None})
        # Empty text
        await sio1.emit("speech_segment", {"originalText": "   "})
        # Malformed non-dict
        await sio1.emit("speech_segment", "not a dict")
        await asyncio.sleep(0.6)

        # None of the empty segments should be delivered
        assert len(received_events) == 0

        await sio1.disconnect()
        await sio2.disconnect()
    asyncio.run(_run())

def test_solo_simulator_single_participant_utterance(live_server):
    async def _run():
        server_url = f"http://127.0.0.1:{live_server}"
        sio = socketio.AsyncClient()

        delivered_event = asyncio.Event()
        delivered_payload = {}
        incoming_event = asyncio.Event()
        incoming_payload = {}

        @sio.event
        def speech_delivered(data):
            delivered_payload.update(data)
            delivered_event.set()

        @sio.event
        def peer_incoming_text(data):
            incoming_payload.update(data)
            incoming_event.set()

        await sio.connect(server_url)
        await sio.emit("join_room", {"roomId": "room-solo-sim", "userId": "Solo_User", "language": "en"})
        await asyncio.sleep(0.4)

        # Single participant emits speech segment in solo room
        await sio.emit("speech_segment", {
            "originalText": "Hello this is a solo simulator test",
            "sourceLang": "en",
            "targetLang": "hi"
        })

        await asyncio.wait_for(delivered_event.wait(), timeout=5.0)
        assert delivered_payload.get("originalText") == "Hello this is a solo simulator test"
        assert "translatedText" in delivered_payload
        assert delivered_payload.get("isSolo") is True

        await asyncio.wait_for(incoming_event.wait(), timeout=5.0)
        assert incoming_payload.get("isSolo") is True
        assert incoming_payload.get("targetLang") == "hi"

        await sio.disconnect()
    asyncio.run(_run())

def test_ping_check_telemetry(live_server):
    async def _run():
        server_url = f"http://127.0.0.1:{live_server}"
        sio = socketio.AsyncClient()
        await sio.connect(server_url)

        res = await sio.call("ping_check", None, timeout=3.0)
        assert isinstance(res, dict)
        assert res.get("status") == "ok"
        assert "timestamp" in res

        await sio.disconnect()
    asyncio.run(_run())

def test_speech_segment_preserves_domain_and_applies_glossary(live_server):
    async def _run():
        server_url = f"http://127.0.0.1:{live_server}"
        sio = socketio.AsyncClient()

        delivered_event = asyncio.Event()
        delivered_payload = {}

        @sio.event
        def speech_delivered(data):
            delivered_payload.clear()
            delivered_payload.update(data)
            delivered_event.set()

        await sio.connect(server_url)
        await sio.emit("join_room", {"roomId": "room-domain-glossary", "userId": "Doctor_User", "language": "en"})
        await asyncio.sleep(0.4)

        # 1. Test medical domain: "heart attack" -> "myocardial infarction"
        delivered_event.clear()
        await sio.emit("speech_segment", {
            "originalText": "The patient suffered a severe heart attack",
            "sourceLang": "en",
            "targetLang": "en",
            "domain": "medical"
        })
        await asyncio.wait_for(delivered_event.wait(), timeout=5.0)
        assert "myocardial infarction" in delivered_payload.get("translatedText", "").lower()

        # 2. Test fintech domain: "operating profit" -> "EBITDA margin"
        delivered_event.clear()
        await sio.emit("speech_segment", {
            "originalText": "We must optimize our operating profit",
            "sourceLang": "en",
            "targetLang": "en",
            "domain": "fintech"
        })
        await asyncio.wait_for(delivered_event.wait(), timeout=5.0)
        assert "ebitda margin" in delivered_payload.get("translatedText", "").lower()

        await sio.disconnect()
    asyncio.run(_run())

def test_speech_segment_domain_default_and_fallback(live_server):
    async def _run():
        server_url = f"http://127.0.0.1:{live_server}"
        sio = socketio.AsyncClient()

        delivered_event = asyncio.Event()
        delivered_payload = {}

        @sio.event
        def speech_delivered(data):
            delivered_payload.clear()
            delivered_payload.update(data)
            delivered_event.set()

        await sio.connect(server_url)
        await sio.emit("join_room", {"roomId": "room-domain-fallback", "userId": "General_User", "language": "en"})
        await asyncio.sleep(0.4)

        # 1. Emit without domain (verifying default "general", no glossary replacement for medical term)
        delivered_event.clear()
        await sio.emit("speech_segment", {
            "originalText": "The patient suffered a heart attack",
            "sourceLang": "en",
            "targetLang": "en"
        })
        await asyncio.wait_for(delivered_event.wait(), timeout=5.0)
        translated_no_domain = delivered_payload.get("translatedText", "").lower()
        assert "heart attack" in translated_no_domain
        assert "myocardial infarction" not in translated_no_domain

        # 2. Emit with unknown domain (verifying graceful fallback to standard translation without dropping)
        delivered_event.clear()
        await sio.emit("speech_segment", {
            "originalText": "Standard operational report for review",
            "sourceLang": "en",
            "targetLang": "en",
            "domain": "unknown_domain_xyz"
        })
        await asyncio.wait_for(delivered_event.wait(), timeout=5.0)
        translated_fallback = delivered_payload.get("translatedText", "")
        assert "Standard operational report" in translated_fallback

        await sio.disconnect()
    asyncio.run(_run())
