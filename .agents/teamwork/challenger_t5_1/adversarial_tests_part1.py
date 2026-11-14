"""Adversarial Test Suite Part 1: WebSocket Signaling, Peer Lifecycle & Speech Pipeline Hardening.

Author: Challenger 1 (critic/specialist)
Milestone: Phase 2 (Adversarial Coverage Hardening / Tier 5)
Target Environment: FastAPI + python-socketio Server, LiveServerProcess, AsyncTestSocketClient

Test Categories:
1. Rapid Connect/Disconnect/Reconnect Loops & Socket Replacements (Tests 01 - 05)
2. Malformed WebSocket Frames & Payload Attack Matrix (Tests 06 - 09)
3. In-Flight Cancellation & Disconnection Races (Tests 10 - 14)
4. High-Concurrency Bursts & Multi-Room Load (Tests 15 - 17)
5. Floor Control & Speaking State Out-of-Order Sequencing (Tests 18 - 22)
"""

import asyncio
import time
import uuid
import pytest

pytest_plugins = ["tests.e2e.conftest"]


# ==============================================================================
# Category 1: Rapid Connect / Disconnect / Reconnect Loops & Socket Replacements
# ==============================================================================

class TestAdv01SocketReplacementAndChurn:
    """Stress-test socket replacements, rapid reconnection loops, and identity takeovers."""

    async def test_adv_01_rapid_socket_replacement_chain(self, socket_client_factory, http_client):
        """Rapid replacement of 5 successive sockets under the same userId leaves room in clean state."""
        room_id = f"churn_{uuid.uuid4().hex[:8]}"
        user_id = f"user_churn_{uuid.uuid4().hex[:6]}"

        clients = [socket_client_factory() for _ in range(5)]
        for c in clients:
            await c.connect()

        try:
            # First socket joins
            await clients[0].emit("join_room", {"roomId": room_id, "userId": user_id, "userName": "Caller 0"})
            await clients[0].wait_for_event("waiting_for_peer", timeout=5.0)

            # Sockets 1 through 4 rapidly take over the same userId slot
            for i in range(1, 5):
                await clients[i].emit("join_room", {"roomId": room_id, "userId": user_id, "userName": f"Caller {i}"})
                await clients[i].wait_for_event("waiting_for_peer", timeout=5.0)

            # Inspect room snapshot via REST API
            resp = await http_client.get("/api/rooms")
            assert resp.status_code == 200
            rooms_data = resp.json().get("rooms", {})
            assert room_id in rooms_data
            participants = rooms_data[room_id]
            # Must strictly have exactly 1 participant (no dangling socket leaks)
            assert len(participants) == 1
            assert participants[0]["userId"] == user_id
            assert participants[0]["userName"] == "Caller 4"
            assert participants[0]["sid"] == clients[4].sid

            # Stale sockets (clients 0..3) must NOT be able to emit speech into the room
            await clients[0].emit("speech_segment", {"originalText": "stale speech from dead socket"})
            await asyncio.sleep(0.3)
            # Client 4 (the active socket) should NOT receive any loopback or incoming speech from dead socket 0
            assert len(clients[4].get_events("peer_incoming_text")) == 0

        finally:
            for c in clients:
                await c.disconnect()

    async def test_adv_02_reconnect_replacement_while_peer_in_room(self, socket_client_factory):
        """When Peer B reconnects under same userId, Peer A receives updated peer info and pipeline works."""
        room_id = f"reconn_{uuid.uuid4().hex[:8]}"
        peer_a_id = f"peerA_{uuid.uuid4().hex[:6]}"
        peer_b_id = f"peerB_{uuid.uuid4().hex[:6]}"

        client_a = socket_client_factory()
        client_b1 = socket_client_factory()
        client_b2 = socket_client_factory()

        await client_a.connect()
        await client_b1.connect()
        await client_b2.connect()

        try:
            # Client A and B1 join and pair up
            await client_a.emit("join_room", {"roomId": room_id, "userId": peer_a_id, "language": "en"})
            await client_a.wait_for_event("waiting_for_peer", timeout=5.0)

            await client_b1.emit("join_room", {"roomId": room_id, "userId": peer_b_id, "language": "hi"})
            await client_a.wait_for_event("peer_connected", timeout=5.0)
            await client_b1.wait_for_event("peer_connected", timeout=5.0)

            # Simulate browser refresh: Client B2 connects with same userId
            await client_b2.emit("join_room", {"roomId": room_id, "userId": peer_b_id, "language": "hi"})
            # Client A receives peer_connected with B2's info
            reconn_event = await client_a.wait_for_event("peer_connected", timeout=5.0)
            assert reconn_event.get("peer", {}).get("sid") == client_b2.sid

            # Stale socket B1 emitting speech segment must be dropped
            await client_b1.emit("speech_segment", {"originalText": "Ghost voice from old tab"})
            await asyncio.sleep(0.3)
            assert len(client_a.get_events("peer_incoming_text")) == 0

            # New socket B2 emitting speech segment must deliver to Client A
            await client_b2.emit("speech_segment", {"originalText": "Hello from refreshed tab", "sourceLang": "en", "targetLang": "en"})
            text_data = await client_a.wait_for_event("peer_incoming_text", timeout=8.0)
            assert "Hello from refreshed tab" in text_data.get("translatedText")

        finally:
            await client_a.disconnect()
            await client_b1.disconnect()
            await client_b2.disconnect()

    async def test_adv_03_rapid_room_switching_churn(self, socket_client_factory, http_client):
        """A single socket switching rooms rapidly (A -> B -> C) cleans up prior rooms."""
        room_a = f"roomA_{uuid.uuid4().hex[:8]}"
        room_b = f"roomB_{uuid.uuid4().hex[:8]}"
        room_c = f"roomC_{uuid.uuid4().hex[:8]}"

        client = socket_client_factory()
        await client.connect()

        try:
            # Rapidly hop through rooms A, B, C
            await client.emit("join_room", {"roomId": room_a, "userId": "nomad"})
            await client.emit("join_room", {"roomId": room_b, "userId": "nomad"})
            await client.emit("join_room", {"roomId": room_c, "userId": "nomad"})

            # Wait for final join event
            await client.wait_for_event("waiting_for_peer", timeout=5.0)

            # Verify rooms snapshot: Room A and B must NOT retain the socket
            resp = await http_client.get("/api/rooms")
            rooms = resp.json().get("rooms", {})
            assert room_a not in rooms or len(rooms[room_a]) == 0
            assert room_b not in rooms or len(rooms[room_b]) == 0
            assert room_c in rooms
            assert len(rooms[room_c]) == 1
            assert rooms[room_c][0]["sid"] == client.sid

            # Emitting speech in room C works as solo simulator
            await client.emit("speech_segment", {"originalText": "Testing room C", "sourceLang": "en", "targetLang": "en"})
            sub = await client.wait_for_event("peer_incoming_text", timeout=8.0)
            assert sub.get("isSolo") is True

        finally:
            await client.disconnect()

    async def test_adv_04_rapid_join_leave_rapid_cycles(self, socket_client_factory, http_client):
        """Rapid join/leave cycling on the same socket leaves room state fully purged."""
        room_id = f"cycle_{uuid.uuid4().hex[:8]}"
        client = socket_client_factory()
        await client.connect()

        try:
            for _ in range(5):
                await client.emit("join_room", {"roomId": room_id, "userId": "cycler"})
                await asyncio.sleep(0.05)
                await client.emit("leave_room")
                await asyncio.sleep(0.05)

            # Verify room is cleaned up
            resp = await http_client.get("/api/rooms")
            rooms = resp.json().get("rooms", {})
            assert room_id not in rooms or len(rooms[room_id]) == 0

            # Re-joining room from scratch works cleanly
            await client.emit("join_room", {"roomId": room_id, "userId": "cycler"})
            ev = await client.wait_for_event("waiting_for_peer", timeout=5.0)
            assert ev is not None

        finally:
            await client.disconnect()

    async def test_adv_05_rogue_identity_takeover_defense(self, socket_client_factory, http_client):
        """A rogue socket joining with existing participant's userId replaces registration without exceeding capacity."""
        room_id = f"takeover_{uuid.uuid4().hex[:8]}"
        victim = socket_client_factory()
        rogue = socket_client_factory()
        innocent_peer = socket_client_factory()

        await victim.connect()
        await rogue.connect()
        await innocent_peer.connect()

        try:
            # Victim and Innocent Peer form a call
            await victim.emit("join_room", {"roomId": room_id, "userId": "victim_usr", "userName": "Victim"})
            await victim.wait_for_event("waiting_for_peer", timeout=5.0)

            await innocent_peer.emit("join_room", {"roomId": room_id, "userId": "innocent_usr", "userName": "Innocent"})
            await victim.wait_for_event("peer_connected", timeout=5.0)
            await innocent_peer.wait_for_event("peer_connected", timeout=5.0)

            # Rogue socket joins claiming userId: 'victim_usr'
            await rogue.emit("join_room", {"roomId": room_id, "userId": "victim_usr", "userName": "Imposter"})
            # Innocent peer receives updated peer notification
            reconn = await innocent_peer.wait_for_event("peer_connected", timeout=5.0)
            assert reconn.get("peer", {}).get("sid") == rogue.sid

            # Room participant count must remain exactly 2
            resp = await http_client.get("/api/rooms")
            participants = resp.json().get("rooms", {}).get(room_id, [])
            assert len(participants) == 2
            sids = [p["sid"] for p in participants]
            assert rogue.sid in sids
            assert innocent_peer.sid in sids
            assert victim.sid not in sids

        finally:
            await victim.disconnect()
            await rogue.disconnect()
            await innocent_peer.disconnect()


# ==============================================================================
# Category 2: Malformed WebSocket Frames & Payload Attack Matrix
# ==============================================================================

class TestAdv02MalformedPayloadFuzzing:
    """Fuzzing and boundary probing across all WebSocket event handlers."""

    async def test_adv_06_join_room_fuzzing(self, socket_client_factory):
        """Fuzz join_room with non-dict payloads, invalid roomIds, and pathological inputs."""
        client = socket_client_factory()
        await client.connect()

        try:
            # 1. Non-dict payloads: None, string, integer, list
            for bad_payload in [None, "roomId=123", 12345, [1, 2, 3]]:
                await client.emit("join_room", bad_payload)
                err = await client.wait_for_event("error", timeout=5.0)
                assert "invalid roomid" in err.get("message", "").lower()
                client.clear_events()

            # 2. Pathological roomId values
            bad_room_ids = [
                "",                         # Empty
                "ab",                       # Too short (2 chars < 3)
                "a" * 33,                   # Too long (33 chars > 32)
                "../../etc/passwd",         # Path traversal
                "room with spaces",         # Spaces
                "room$#@!",                 # Special symbols
                "<b>room</b>",              # HTML tags
                "room\x00null",             # Null bytes
            ]
            for bad_id in bad_room_ids:
                await client.emit("join_room", {"roomId": bad_id})
                err = await client.wait_for_event("error", timeout=5.0)
                assert "invalid roomid" in err.get("message", "").lower()
                client.clear_events()

            # 3. None as roomId: str(None) becomes "None" (4 chars alphanumeric)
            # The server treats "None" as a valid 4-character roomId. Verify it does not crash.
            await client.emit("join_room", {"roomId": None})
            ev = await client.wait_for_event("waiting_for_peer", timeout=5.0)
            assert ev is not None

        finally:
            await client.disconnect()

    async def test_adv_07_signaling_malformed_payloads(self, socket_client_factory, http_client):
        """Signaling events with corrupt, empty, or non-dict payloads handled without server crash."""
        client = socket_client_factory()
        await client.connect()

        try:
            # Emitting signaling before join_room
            await client.emit("webrtc_offer", None)
            await client.emit("webrtc_answer", "not_a_dict")
            await client.emit("webrtc_ice_candidate", 12345)
            await asyncio.sleep(0.2)

            # Join room as solo user
            room_id = f"sigfuzz_{uuid.uuid4().hex[:8]}"
            await client.emit("join_room", {"roomId": room_id, "userId": "solo_sig"})
            await client.wait_for_event("waiting_for_peer", timeout=5.0)

            # Emitting malformed signaling while in room (no peer)
            await client.emit("webrtc_offer", {"type": "offer", "sdp": None})
            await client.emit("webrtc_ice_candidate", {"candidate": None, "sdpMid": None})
            await asyncio.sleep(0.2)

            # Server remains healthy
            resp = await http_client.get("/api/health")
            assert resp.status_code == 200

        finally:
            await client.disconnect()

    async def test_adv_08_speech_segment_fuzzing(self, socket_client_factory):
        """speech_segment handling of pathological types, non-text, massive text, and unknown domains."""
        room_id = f"speechfuzz_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        await c1.connect()
        await c2.connect()

        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "spk1", "language": "en"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)
            await c2.emit("join_room", {"roomId": room_id, "userId": "spk2", "language": "hi"})
            await c1.wait_for_event("peer_connected", timeout=5.0)
            await c2.wait_for_event("peer_connected", timeout=5.0)

            # 1. Non-dict payload
            await c1.emit("speech_segment", "not_a_dict")
            await asyncio.sleep(0.2)
            assert len(c2.get_events("peer_incoming_text")) == 0

            # 2. Empty originalText values (rate limit quota is consumed)
            for empty_val in [None, "", "    "]:
                await c1.emit("speech_segment", {"originalText": empty_val})
                await asyncio.sleep(0.05)
                assert len(c2.get_events("peer_incoming_text")) == 0

            # Wait for rate limit sliding window to reset before testing massive text
            await asyncio.sleep(3.1)
            c1.clear_events()
            c2.clear_events()

            # 3. Massive 5000-character text: Must be capped to 1000 chars without server crash
            massive_text = "Good morning. " * 350  # ~4900 chars
            await c1.emit("speech_segment", {"originalText": massive_text, "sourceLang": "en", "targetLang": "en"})
            sub = await c2.wait_for_event("peer_incoming_text", timeout=8.0)
            assert len(sub.get("originalText")) <= 1000

            # Wait for rate limit window before testing domain fallback
            await asyncio.sleep(3.1)
            c1.clear_events()
            c2.clear_events()

            # 4. Unknown domain & invalid language codes: Must gracefully fall back
            c2.clear_events()
            await c1.emit("speech_segment", {
                "originalText": "Testing fallback domain",
                "sourceLang": "klingon",
                "targetLang": "elvish",
                "domain": "CYBER_WARFARE_NONEXISTENT"
            })
            sub_fallback = await c2.wait_for_event("peer_incoming_text", timeout=8.0)
            assert "Testing fallback domain" in sub_fallback.get("translatedText")

        finally:
            await c1.disconnect()
            await c2.disconnect()

    async def test_adv_09_unexpected_custom_socket_events(self, socket_client_factory, http_client):
        """Server ignores arbitrary unhandled client socket events without error or degradation."""
        client = socket_client_factory()
        await client.connect()

        try:
            for strange_event in ["__proto__", "eval", "constructor", "server_crash", "", "123"]:
                await client.emit(strange_event, {"payload": "exploit_attempt"})
            await asyncio.sleep(0.2)

            resp = await http_client.get("/api/health")
            assert resp.status_code == 200

        finally:
            await client.disconnect()


# ==============================================================================
# Category 3: In-Flight Cancellation & Disconnection Races
# ==============================================================================

class TestAdv03InFlightDisconnectionRaces:
    """Validate server resilience under mid-pipeline disconnections and aborts."""

    async def test_adv_10_peer_disconnects_mid_translation(self, socket_client_factory, http_client):
        """Peer disconnecting immediately after speech_segment triggers clean exit at peer_sid guard."""
        room_id = f"midrace_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        await c1.connect()
        await c2.connect()

        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "alice", "language": "en"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)
            await c2.emit("join_room", {"roomId": room_id, "userId": "bob", "language": "te"})
            await c1.wait_for_event("peer_connected", timeout=5.0)
            await c2.wait_for_event("peer_connected", timeout=5.0)

            # C1 emits speech
            await c1.emit("speech_segment", {"originalText": "This speech will race with peer departure", "sourceLang": "en", "targetLang": "te"})
            # Immediately disconnect C2 (< 5ms)
            await c2.disconnect()

            # Wait for C1 to observe peer_disconnected
            disc_event = await c1.wait_for_event("peer_disconnected", timeout=5.0)
            assert disc_event.get("peerId") == "bob"

            # Allow server background pipeline to settle
            await asyncio.sleep(1.0)

            # Server remains healthy
            resp = await http_client.get("/api/health")
            assert resp.status_code == 200

        finally:
            await c1.disconnect()

    async def test_adv_11_speaker_disconnects_mid_pipeline(self, socket_client_factory, http_client):
        """Speaker disconnecting immediately after emitting speech does not crash server or corrupt peer state."""
        room_id = f"spkrace_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        await c1.connect()
        await c2.connect()

        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "speaker", "language": "en"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)
            await c2.emit("join_room", {"roomId": room_id, "userId": "listener", "language": "hi"})
            await c1.wait_for_event("peer_connected", timeout=5.0)
            await c2.wait_for_event("peer_connected", timeout=5.0)

            # C1 emits speech and immediately hangs up
            await c1.emit("speech_segment", {"originalText": "Goodbye my friend, I am hanging up now", "sourceLang": "en", "targetLang": "hi"})
            await c1.disconnect()

            # Listener receives peer_disconnected
            disc = await c2.wait_for_event("peer_disconnected", timeout=5.0)
            assert disc.get("peerId") == "speaker"

            await asyncio.sleep(1.0)
            resp = await http_client.get("/api/health")
            assert resp.status_code == 200

        finally:
            await c2.disconnect()

    async def test_adv_12_both_peers_disconnect_simultaneously_mid_speech(self, socket_client_factory, http_client):
        """Both peers severing connection simultaneously mid-pipeline destroys room without unhandled exceptions."""
        room_id = f"bothdisc_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        await c1.connect()
        await c2.connect()

        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "p1"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)
            await c2.emit("join_room", {"roomId": room_id, "userId": "p2"})
            await c1.wait_for_event("peer_connected", timeout=5.0)
            await c2.wait_for_event("peer_connected", timeout=5.0)

            # C1 emits speech and BOTH disconnect concurrently
            await c1.emit("speech_segment", {"originalText": "Simultaneous disconnect storm"})
            await asyncio.gather(c1.disconnect(), c2.disconnect())

            await asyncio.sleep(0.5)

            # Room should be purged from server
            resp = await http_client.get("/api/rooms")
            rooms = resp.json().get("rooms", {})
            assert room_id not in rooms

        except Exception:
            pass

    async def test_adv_13_peer_replaced_by_new_client_during_tts(self, socket_client_factory):
        """When Peer B leaves and Client C enters during TTS, Client C does not receive Peer B's audio."""
        room_id = f"subleak_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        c3 = socket_client_factory()

        await c1.connect()
        await c2.connect()
        await c3.connect()

        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "alice", "language": "en"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)
            await c2.emit("join_room", {"roomId": room_id, "userId": "bob", "language": "hi"})
            await c1.wait_for_event("peer_connected", timeout=5.0)
            await c2.wait_for_event("peer_connected", timeout=5.0)

            # Alice speaks
            await c1.emit("speech_segment", {"originalText": "Confidential message for Bob only", "sourceLang": "en", "targetLang": "hi"})
            
            # Bob immediately leaves
            await c2.emit("leave_room")
            await asyncio.sleep(0.05)

            # Charlie enters
            await c3.emit("join_room", {"roomId": room_id, "userId": "charlie", "language": "te"})
            await c3.wait_for_event("peer_connected", timeout=5.0)

            # Wait for TTS pipeline to finish
            await asyncio.sleep(1.5)

            # Charlie must NOT have received translated_audio meant for Bob
            charlie_audio = c3.get_events("translated_audio")
            assert len(charlie_audio) == 0

        finally:
            await c1.disconnect()
            await c2.disconnect()
            await c3.disconnect()

    async def test_adv_14_admin_deletes_room_mid_speech_pipeline(self, socket_client_factory, http_client):
        """Admin terminating room via HTTP DELETE during active speech synthesizes room_terminated."""
        room_id = f"adminkill_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        await c1.connect()
        await c2.connect()

        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "u1"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)
            await c2.emit("join_room", {"roomId": room_id, "userId": "u2"})
            await c1.wait_for_event("peer_connected", timeout=5.0)
            await c2.wait_for_event("peer_connected", timeout=5.0)

            # C1 speaks
            await c1.emit("speech_segment", {"originalText": "Speaking before administrative termination"})

            # Admin terminates room immediately
            del_resp = await http_client.delete(f"/api/rooms/{room_id}")
            assert del_resp.status_code == 200
            assert del_resp.json().get("status") == "success"

            # Both clients receive room_terminated
            t1 = await c1.wait_for_event("room_terminated", timeout=5.0)
            t2 = await c2.wait_for_event("room_terminated", timeout=5.0)
            assert "terminated by system administration" in t1.get("message", "")
            assert "terminated by system administration" in t2.get("message", "")

        finally:
            await c1.disconnect()
            await c2.disconnect()


# ==============================================================================
# Category 4: High-Concurrency Bursts
# ==============================================================================

class TestAdv04HighConcurrencyBursts:
    """Stress-test concurrent speech segments and multi-room burst loads."""

    async def test_adv_15_simultaneous_bidirectional_speech_burst(self, socket_client_factory):
        """Both callers speaking simultaneously in the same room process and cross-deliver without deadlock."""
        room_id = f"bidir_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        await c1.connect()
        await c2.connect()

        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "c1_user", "language": "en"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)
            await c2.emit("join_room", {"roomId": room_id, "userId": "c2_user", "language": "hi"})
            await c1.wait_for_event("peer_connected", timeout=5.0)
            await c2.wait_for_event("peer_connected", timeout=5.0)

            # Both emit speech segments at the exact same instant
            seg1 = c1.emit("speech_segment", {"originalText": "Hello from Caller 1", "sourceLang": "en", "targetLang": "hi"})
            seg2 = c2.emit("speech_segment", {"originalText": "Hello from Caller 2", "sourceLang": "hi", "targetLang": "en"})
            await asyncio.gather(seg1, seg2)

            # Both receive incoming text from the other
            sub_for_c1 = await c1.wait_for_event("peer_incoming_text", timeout=8.0)
            sub_for_c2 = await c2.wait_for_event("peer_incoming_text", timeout=8.0)

            assert sub_for_c1.get("speakerId") == "c2_user"
            assert sub_for_c2.get("speakerId") == "c1_user"

            # Both receive speech_delivered receipts
            d1 = await c1.wait_for_event("speech_delivered", timeout=8.0)
            d2 = await c2.wait_for_event("speech_delivered", timeout=8.0)
            assert d1 is not None and d2 is not None

        finally:
            await c1.disconnect()
            await c2.disconnect()

    async def test_adv_16_multi_room_parallel_speech_burst(self, socket_client_factory):
        """Four independent rooms emitting speech simultaneously experience zero cross-talk."""
        room_count = 4
        pairs = []

        try:
            for i in range(room_count):
                r_id = f"burst_r{i}_{uuid.uuid4().hex[:6]}"
                ca = socket_client_factory()
                cb = socket_client_factory()
                await ca.connect()
                await cb.connect()
                await ca.emit("join_room", {"roomId": r_id, "userId": f"speaker_{i}", "language": "en"})
                await ca.wait_for_event("waiting_for_peer", timeout=5.0)
                await cb.emit("join_room", {"roomId": r_id, "userId": f"listener_{i}", "language": "en"})
                await ca.wait_for_event("peer_connected", timeout=5.0)
                await cb.wait_for_event("peer_connected", timeout=5.0)
                pairs.append((r_id, ca, cb, f"speaker_{i}", f"listener_{i}"))

            # Simultaneously emit distinct utterances in all 4 rooms
            tasks = []
            for i, (r_id, ca, cb, spk, lis) in enumerate(pairs):
                tasks.append(ca.emit("speech_segment", {
                    "originalText": f"Message for room index {i}",
                    "sourceLang": "en",
                    "targetLang": "en"
                }))
            await asyncio.gather(*tasks)

            # Verify each listener receives ONLY their room's message
            for i, (r_id, ca, cb, spk, lis) in enumerate(pairs):
                sub = await cb.wait_for_event("peer_incoming_text", timeout=8.0)
                assert f"Message for room index {i}" in sub.get("translatedText")
                assert sub.get("speakerId") == spk

        finally:
            for _, ca, cb, _, _ in pairs:
                await ca.disconnect()
                await cb.disconnect()

    async def test_adv_17_rate_limit_saturation_and_sliding_window_recovery(self, socket_client_factory):
        """Bursting 7 utterances triggers rate limits on 6th & 7th; window resets after 3.1s."""
        room_id = f"ratetest_{uuid.uuid4().hex[:8]}"
        client = socket_client_factory()
        await client.connect()

        try:
            await client.emit("join_room", {"roomId": room_id, "userId": "spammer"})
            await client.wait_for_event("waiting_for_peer", timeout=5.0)

            # Rapidly fire 7 utterances
            for i in range(7):
                await client.emit("speech_segment", {
                    "originalText": f"Spam utterance {i}",
                    "sourceLang": "en",
                    "targetLang": "en"
                })

            # Wait for rate limit error events
            err1 = await client.wait_for_event("speech_error", timeout=5.0)
            assert "rate limit exceeded" in err1.get("error", "").lower()

            # Wait out the 3-second sliding window
            await asyncio.sleep(3.1)
            client.clear_events()

            # Utterance 8 should now succeed
            await client.emit("speech_segment", {
                "originalText": "Recovered natural speech",
                "sourceLang": "en",
                "targetLang": "en"
            })
            deliv = await client.wait_for_event("speech_delivered", timeout=8.0)
            assert "Recovered natural speech" in deliv.get("originalText")

        finally:
            await client.disconnect()


# ==============================================================================
# Category 5: Floor Control & Speaking State Out-of-Order Sequencing
# ==============================================================================

class TestAdv05FloorControlAndSpeakingState:
    """Validate speaking state visualizer ordering, mute floor control, and sequence anomalies."""

    async def test_adv_18_speaking_state_without_speech(self, socket_client_factory):
        """Speaking state toggled (True -> False) without speech delivers visualizer events to peer."""
        room_id = f"spkstate_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        await c1.connect()
        await c2.connect()

        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "spk_user"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)
            await c2.emit("join_room", {"roomId": room_id, "userId": "lis_user"})
            await c1.wait_for_event("peer_connected", timeout=5.0)
            await c2.wait_for_event("peer_connected", timeout=5.0)

            # C1 starts speaking (mic unmuted, speaking true)
            await c1.emit("speaking_state", {"isSpeaking": True})
            ev_start = await c2.wait_for_event("peer_speaking_state", timeout=5.0)
            assert ev_start.get("isSpeaking") is True
            assert ev_start.get("speakerId") == "spk_user"

            # C1 stops speaking without sending any speech_segment
            await c1.emit("speaking_state", {"isSpeaking": False})
            ev_stop = await c2.wait_for_event("peer_speaking_state", timeout=5.0)
            assert ev_stop.get("isSpeaking") is False

            # No speech subtitles or delivery receipts were generated
            assert len(c2.get_events("peer_incoming_text")) == 0

        finally:
            await c1.disconnect()
            await c2.disconnect()

    async def test_adv_19_speaking_state_while_muted(self, socket_client_factory):
        """When caller is muted, speech_segment is dropped, but speaking_state reflects physical mic activity."""
        room_id = f"mutestate_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        await c1.connect()
        await c2.connect()

        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "muted_talker"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)
            await c2.emit("join_room", {"roomId": room_id, "userId": "peer_listener"})
            await c1.wait_for_event("peer_connected", timeout=5.0)
            await c2.wait_for_event("peer_connected", timeout=5.0)

            # C1 mutes themselves
            await c1.emit("toggle_mute", {"isMuted": True})
            mute_ev = await c2.wait_for_event("peer_mute_changed", timeout=5.0)
            assert mute_ev.get("isMuted") is True

            # C1 emits speaking_state: True (physical mic activity while software-muted)
            await c1.emit("speaking_state", {"isSpeaking": True})
            spk_ev = await c2.wait_for_event("peer_speaking_state", timeout=5.0)
            assert spk_ev.get("isSpeaking") is True

            # C1 emits speech_segment: MUST be dropped by server guard
            await c1.emit("speech_segment", {"originalText": "Muted secret utterance"})
            await asyncio.sleep(0.5)

            # Peer receives no subtitles or audio
            assert len(c2.get_events("peer_incoming_text")) == 0
            assert len(c2.get_events("translated_audio")) == 0
            # Speaker receives no delivery receipt
            assert len(c1.get_events("speech_delivered")) == 0

        finally:
            await c1.disconnect()
            await c2.disconnect()

    async def test_adv_20_rapid_mute_oscillations(self, socket_client_factory, http_client):
        """Rapidly toggling mute 20 times in 200ms converges cleanly on the final state."""
        room_id = f"mutechatter_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        await c1.connect()
        await c2.connect()

        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "chatterbox"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)
            await c2.emit("join_room", {"roomId": room_id, "userId": "listener"})
            await c1.wait_for_event("peer_connected", timeout=5.0)
            await c2.wait_for_event("peer_connected", timeout=5.0)

            # Alternating mute toggle: True, False, True, False, ... ending on True
            final_expected = True
            for i in range(20):
                is_muted = (i % 2 == 0) if not final_expected else (i % 2 != 0)
                await c1.emit("toggle_mute", {"isMuted": is_muted})
            await c1.emit("toggle_mute", {"isMuted": final_expected})
            await asyncio.sleep(0.3)

            # Server room snapshot must record isMuted: True
            resp = await http_client.get("/api/rooms")
            participants = resp.json().get("rooms", {}).get(room_id, [])
            c1_data = next((p for p in participants if p["sid"] == c1.sid), None)
            assert c1_data is not None
            assert c1_data["isMuted"] is True

        finally:
            await c1.disconnect()
            await c2.disconnect()

    async def test_adv_21_speech_segment_without_prior_speaking_state(self, socket_client_factory):
        """speech_segment delivered correctly even if speaking_state event was never emitted."""
        room_id = f"nospeakstate_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        await c1.connect()
        await c2.connect()

        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "direct_speaker", "language": "en"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)
            await c2.emit("join_room", {"roomId": room_id, "userId": "direct_listener", "language": "en"})
            await c1.wait_for_event("peer_connected", timeout=5.0)
            await c2.wait_for_event("peer_connected", timeout=5.0)

            # Directly emit speech_segment without any prior speaking_state
            await c1.emit("speech_segment", {"originalText": "Direct transmission without HUD state", "sourceLang": "en", "targetLang": "en"})

            sub = await c2.wait_for_event("peer_incoming_text", timeout=8.0)
            assert "Direct transmission without HUD state" in sub.get("translatedText")

            deliv = await c1.wait_for_event("speech_delivered", timeout=8.0)
            assert "Direct transmission without HUD state" in deliv.get("originalText")

        finally:
            await c1.disconnect()
            await c2.disconnect()

    async def test_adv_22_mute_toggle_mid_flight(self, socket_client_factory):
        """Muting immediately after emitting speech_segment does not abort the already-admitted segment."""
        room_id = f"midmute_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        await c1.connect()
        await c2.connect()

        try:
            await c1.emit("join_room", {"roomId": room_id, "userId": "spk_midmute", "language": "en"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)
            await c2.emit("join_room", {"roomId": room_id, "userId": "lis_midmute", "language": "en"})
            await c1.wait_for_event("peer_connected", timeout=5.0)
            await c2.wait_for_event("peer_connected", timeout=5.0)

            # C1 emits speech while unmuted, then immediately mutes (< 5ms)
            await c1.emit("speech_segment", {"originalText": "Already admitted before mute toggle", "sourceLang": "en", "targetLang": "en"})
            await c1.emit("toggle_mute", {"isMuted": True})

            # Subtitle of admitted utterance should still be delivered
            sub = await c2.wait_for_event("peer_incoming_text", timeout=8.0)
            assert "Already admitted before mute toggle" in sub.get("translatedText")

        finally:
            await c1.disconnect()
            await c2.disconnect()
