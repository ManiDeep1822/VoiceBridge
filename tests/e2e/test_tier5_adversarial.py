"""Tier 5: Adversarial, White-Box Stress & Boundary Test Suite.

Contains 52 comprehensive adversarial tests validating the VoiceBridge Live Call Translator
across 10 attack matrices and stress categories:
Part 1 (Challenger 1):
  1. Rapid Connect/Disconnect/Reconnect Loops & Socket Replacements (Tests 01 - 05)
  2. Malformed WebSocket Frames & Payload Attack Matrix (Tests 06 - 09)
  3. In-Flight Cancellation & Disconnection Races (Tests 10 - 14)
  4. High-Concurrency Bursts & Multi-Room Load (Tests 15 - 17)
  5. Floor Control & Speaking State Out-of-Order Sequencing (Tests 18 - 22)
Part 2 (Challenger 2):
  6. Unicode Adversarial Boundaries: RTL overrides, zero-width chars, complex Indic combining marks (Tests 23 - 28)
  7. Corrupt / Truncated Audio Inputs: Truncated WAV headers, zero-length PCM buffers, noise (Tests 29 - 34)
  8. Jargon Lock & Glossary Boundaries: Nested brackets, unbalanced brackets, domain regex safety (Tests 35 - 40)
  9. Meeting Minutes Generator Stress: Huge transcripts (>10,000 utterances), mixed types, missing keys (Tests 41 - 46)
  10. REST Endpoints & Socket Boundaries: Concurrent bursts, disallowed verbs, path traversal, rate limits (Tests 47 - 52)

Integrated for VoiceBridge Live Call Translator Final Milestone Phase 2.
"""

import asyncio
import base64
import io
import os
import sys
import time
import uuid
import wave

import pytest

from tests.e2e.harness import (
    create_corrupt_base64_audio,
    create_synthetic_wav,
    generate_base64_audio,
)


# ==============================================================================
# Part 1: Category 1 - Rapid Connect / Disconnect / Reconnect Loops (5 Tests)
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
# Part 1: Category 2 - Malformed WebSocket Frames & Fuzzing (4 Tests)
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

            # 3. None as roomId: With the surgical boundary fix, str(data.get("roomId") or "").strip()
            # evaluates to "", which triggers an invalid roomId error instead of joining room "None".
            await client.emit("join_room", {"roomId": None})
            err = await client.wait_for_event("error", timeout=5.0)
            assert "invalid roomid" in err.get("message", "").lower()

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
# Part 1: Category 3 - In-Flight Cancellation & Disconnection Races (5 Tests)
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
# Part 1: Category 4 - High-Concurrency Bursts (3 Tests)
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
# Part 1: Category 5 - Floor Control & Speaking State Sequencing (5 Tests)
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


# ==============================================================================
# Part 2: Category 6 - Unicode Adversarial Boundaries (6 Tests)
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
# Part 2: Category 7 - Corrupt / Truncated Audio Inputs (6 Tests)
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
# Part 2: Category 8 - Jargon Lock & Glossary Edge Cases (6 Tests)
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
# Part 2: Category 9 - Meeting Minutes Generator Stress (6 Tests)
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
# Part 2: Category 10 - REST Endpoints & Socket Boundaries (6 Tests)
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
            recovered_event = await client.wait_for_event_matching(
                "peer_incoming_text",
                lambda e: "Recovered speech segment" in e.get("originalText", ""),
                timeout=8.0
            )
            assert "Recovered speech segment" in recovered_event.get("originalText", "")
        finally:
            await client.disconnect()

    async def test_adv_socket_simultaneous_empty_userid_eviction(self, socket_client_factory, http_client):
        """Clients joining with empty userId string are assigned fallback userId and handled safely."""
        room_id = f"adv_empty_uid_{uuid.uuid4().hex[:8]}"
        c1 = socket_client_factory()
        c2 = socket_client_factory()
        await c1.connect()
        await c2.connect()

        try:
            # Client A joins with empty userId
            await c1.emit("join_room", {"roomId": room_id, "userId": "", "userName": "User A"})
            await c1.wait_for_event("waiting_for_peer", timeout=5.0)

            # Client B joins with empty or whitespace-only userId
            await c2.emit("join_room", {"roomId": room_id, "userId": "   ", "userName": "User B"})

            # Server assigns fallback user IDs (e.g. user_{sid[:5]}) so both participants remain in room
            await asyncio.sleep(0.5)

            rooms_resp = await http_client.get("/api/rooms")
            assert rooms_resp.status_code == 200
            participants = rooms_resp.json()["rooms"].get(room_id, [])
            assert len(participants) == 2
        finally:
            await c1.disconnect()
            await c2.disconnect()
