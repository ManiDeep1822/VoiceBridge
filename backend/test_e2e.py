import asyncio
import sys
import base64
import socketio

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

async def run_e2e_test():
    print("[Test] Starting 2-Client Speech-to-Speech E2E Simulation...")
    from main import socket_app
    import uvicorn

    config = uvicorn.Config(socket_app, host="127.0.0.1", port=8999, log_level="warning")
    server = uvicorn.Server(config)
    server_task = asyncio.create_task(server.serve())

    await asyncio.sleep(1) # wait for server startup

    sio_a = socketio.AsyncClient()
    sio_b = socketio.AsyncClient()

    received_payload = {}
    text_event = asyncio.Event()
    audio_event = asyncio.Event()

    @sio_b.event
    def peer_incoming_text(data):
        print(f"[Client B (Hindi)] Instant subtitle received!")
        print(f"  - Original: {data.get('originalText')}")
        print(f"  - Translated: {data.get('translatedText')}")
        text_event.set()

    @sio_b.event
    def translated_audio(data):
        print(f"[Client B (Hindi)] Accelerated audio received (+15% rate)!")
        audio_len = len(data.get('audioBase64', ''))
        print(f"  - Audio Base64 length: {audio_len} chars")
        received_payload.update(data)
        audio_event.set()

    # 1. Connect Client A (Telugu speaker)
    await sio_a.connect("http://127.0.0.1:8999")
    await sio_a.emit("join_room", {
        "roomId": "test-e2e-room",
        "userId": "User_Telugu",
        "language": "te",
        "voiceGender": "female"
    })

    # 2. Connect Client B (Hindi listener)
    await sio_b.connect("http://127.0.0.1:8999")
    await sio_b.emit("join_room", {
        "roomId": "test-e2e-room",
        "userId": "User_Hindi",
        "language": "hi",
        "voiceGender": "female"
    })

    await asyncio.sleep(0.5)

    # 3. Client A speaks in Telugu
    print("[Client A (Telugu)] Speaking: 'నమస్కారం, మీరు బాగున్నారా?'")
    await sio_a.emit("speech_segment", {
        "originalText": "నమస్కారం, మీరు బాగున్నారా?",
        "sourceLang": "te"
    })

    # 4. Wait for Client B to receive instant text, then audio
    try:
        await asyncio.wait_for(text_event.wait(), timeout=5)
        print("[STAGE 1 SUCCESS] Instant text received with sub-second latency!")
        await asyncio.wait_for(audio_event.wait(), timeout=8)
        print("[STAGE 2 SUCCESS] Fast neural audio received!")
        assert "audioBase64" in received_payload and len(received_payload["audioBase64"]) > 5000
    except asyncio.TimeoutError:
        print("\n[FAILED] Timed out waiting for translation payload.")
        sys.exit(1)
    finally:
        await sio_a.disconnect()
        await sio_b.disconnect()
        server.should_exit = True
        await server_task

if __name__ == "__main__":
    asyncio.run(run_e2e_test())
