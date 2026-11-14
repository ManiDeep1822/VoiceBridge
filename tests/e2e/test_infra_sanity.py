"""Sanity tests verifying the E2E test infrastructure and harness.

Validates:
- Live background server starts on an ephemeral port.
- HTTP GET /api/health responds with HTTP 200 and expected schema.
- Socket.IO AsyncTestSocketClient connects, emits with ACK, receives events, and disconnects.
- Multi-client room entry, peer notification, and clean departure.
- Audio synthesis helpers produce valid WAV and Base64 payloads.
"""

import base64
import io
import wave
import pytest
from tests.e2e.harness import (
    create_synthetic_wav,
    generate_base64_audio,
    create_corrupt_base64_audio,
)


async def test_infra_live_server_http_health(http_client, server_base_url):
    """Sanity check: Server is live and /api/health responds with HTTP 200."""
    assert server_base_url.startswith("http://127.0.0.1:")

    resp = await http_client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()

    assert data.get("status") == "healthy"
    assert "Speech Translation" in data.get("service", "")
    assert isinstance(data.get("supported_languages"), list)
    assert len(data["supported_languages"]) >= 9
    assert "en" in data["supported_languages"]
    assert "te" in data["supported_languages"]
    assert "hi" in data["supported_languages"]


async def test_infra_socketio_client_ping(socket_client_factory):
    """Sanity check: Socket.IO client connects, executes ping_check ACK, and disconnects."""
    client = socket_client_factory()
    assert not client.connected

    await client.connect()
    assert client.connected
    assert client.sid is not None

    ack = await client.emit_with_ack("ping_check", timeout=5.0)
    assert isinstance(ack, dict)
    assert ack.get("status") == "ok"
    assert isinstance(ack.get("timestamp"), (int, float))
    assert ack["timestamp"] > 0

    await client.disconnect()
    assert not client.connected


async def test_infra_multi_client_room_lifecycle(socket_client_factory):
    """Sanity check: Two clients join the same room, pair up, and receive peer events."""
    room_id = "sanity-room-001"
    client_a = socket_client_factory()
    client_b = socket_client_factory()

    await client_a.connect()
    await client_b.connect()

    # Client A enters empty room -> awaits waiting_for_peer
    await client_a.emit("join_room", {
        "roomId": room_id,
        "userId": "User_Alpha",
        "userName": "Alpha",
        "language": "en",
        "voiceGender": "female"
    })

    waiting_evt = await client_a.wait_for_event("waiting_for_peer", timeout=5.0)
    assert waiting_evt is not None
    assert waiting_evt.get("self", {}).get("userId") == "User_Alpha"

    # Client B enters room -> both receive peer_connected
    await client_b.emit("join_room", {
        "roomId": room_id,
        "userId": "User_Beta",
        "userName": "Beta",
        "language": "hi",
        "voiceGender": "male"
    })

    peer_conn_a = await client_a.wait_for_event("peer_connected", timeout=5.0)
    peer_conn_b = await client_b.wait_for_event("peer_connected", timeout=5.0)

    assert peer_conn_a.get("isInitiator") is True
    assert peer_conn_a.get("peer", {}).get("userId") == "User_Beta"

    assert peer_conn_b.get("isInitiator") is False
    assert peer_conn_b.get("peer", {}).get("userId") == "User_Alpha"

    # Client B leaves -> Client A receives peer_disconnected
    await client_b.emit("leave_room")
    disc_evt = await client_a.wait_for_event("peer_disconnected", timeout=5.0)
    assert disc_evt.get("peerId") == "User_Beta"

    await client_a.disconnect()
    await client_b.disconnect()


def test_infra_audio_payload_generators():
    """Sanity check: Audio generators create well-formed WAV and Base64 structures."""
    wav_bytes = create_synthetic_wav(duration_ms=250, sample_rate=16000, frequency_hz=440.0)
    assert len(wav_bytes) > 44  # Standard WAV header size is 44 bytes

    # Verify WAV header structure using wave module
    with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
        assert wf.getnchannels() == 1
        assert wf.getsampwidth() == 2
        assert wf.getframerate() == 16000
        assert wf.getnframes() == int(16000 * 0.25)

    # Verify Base64 generation
    b64_str = generate_base64_audio(duration_ms=100)
    assert isinstance(b64_str, str)
    decoded = base64.b64decode(b64_str)
    assert decoded.startswith(b"RIFF")

    # Verify corrupt audio helper
    corrupt_str = create_corrupt_base64_audio()
    assert "CORRUPT" in corrupt_str


async def test_infra_socket_event_matching_and_history(socket_client):
    """Sanity check: Socket client helper methods (matching, history, clear) function as expected."""
    await socket_client.connect()

    # Emit join_room to generate waiting_for_peer event
    await socket_client.emit("join_room", {
        "roomId": "matching-test-room",
        "userId": "User_Matcher",
        "userName": "Matcher",
        "language": "en",
        "voiceGender": "female"
    })

    # Test wait_for_event_matching with a predicate
    matched_evt = await socket_client.wait_for_event_matching(
        "waiting_for_peer",
        lambda data: data.get("self", {}).get("userId") == "User_Matcher",
        timeout=5.0,
    )
    assert matched_evt is not None
    assert matched_evt["self"]["userName"] == "Matcher"

    # Test get_events and find_event
    all_events = socket_client.get_events()
    assert len(all_events) > 0

    found = socket_client.find_event(
        "waiting_for_peer",
        lambda d: d.get("self", {}).get("userId") == "User_Matcher"
    )
    assert found is not None

    # Test clear_events
    socket_client.clear_events()
    assert len(socket_client.get_events()) == 0

    await socket_client.disconnect()


async def test_infra_http_post_rest_endpoint(http_client):
    """Sanity check: Asynchronous HTTP client can execute POST requests against live REST endpoints."""
    resp = await http_client.post("/api/glossary", json={"domain": "medical"})
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("domain") == "medical"
    assert data.get("protection_mode") == "strict_preservation"
    assert "sample_terms" in data
    assert isinstance(data["sample_terms"], list)
    assert len(data["sample_terms"]) > 0
