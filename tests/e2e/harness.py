"""Test harness utilities for VoiceBridge E2E test suite.

Provides:
- LiveServerProcess: Manages background FastAPI + Socket.IO server on an ephemeral port.
- AsyncTestSocketClient: Socket.IO client wrapper with event queuing, waiting, and history.
- Audio payload generators: Synthetic valid WAV and corrupt base64 audio.
"""

import asyncio
from collections import defaultdict
import io
import math
import multiprocessing
import os
import socket
import struct
import sys
import time
from typing import Any, Callable, Dict, List, Optional, Tuple
import urllib.error
import urllib.request
import wave
import base64

import httpx
import socketio


def get_free_port() -> int:
    """Find and return an ephemeral open port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _run_uvicorn_server(port: int, host: str = "127.0.0.1"):
    """Target function executed in the background process to run uvicorn."""
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    if root_dir not in sys.path:
        sys.path.insert(0, root_dir)
    backend_dir = os.path.join(root_dir, "backend")
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    import uvicorn
    from backend.main import socket_app

    # Run uvicorn server synchronously in child process
    uvicorn.run(socket_app, host=host, port=port, log_level="warning")


class LiveServerProcess:
    """Controls the lifecycle of a live background FastAPI + Socket.IO server process."""

    def __init__(self, host: str = "127.0.0.1", port: Optional[int] = None):
        self.host = host
        self.port = port or get_free_port()
        self.base_url = f"http://{self.host}:{self.port}"
        self.process: Optional[multiprocessing.Process] = None

    def start(self, timeout: float = 15.0):
        """Start the live server and poll /api/health until it responds with HTTP 200."""
        if self.process is not None and self.process.is_alive():
            return

        try:
            if sys.platform == "win32":
                multiprocessing.set_start_method("spawn", force=True)
        except RuntimeError:
            pass

        self.process = multiprocessing.Process(
            target=_run_uvicorn_server,
            args=(self.port, self.host),
            daemon=True,
        )
        self.process.start()

        # Health polling
        health_url = f"{self.base_url}/api/health"
        deadline = time.time() + timeout
        last_error = None

        while time.time() < deadline:
            if not self.process.is_alive():
                raise RuntimeError(
                    f"Live server process exited prematurely with code {self.process.exitcode}"
                )
            try:
                req = urllib.request.Request(health_url)
                with urllib.request.urlopen(req, timeout=1.0) as resp:
                    if resp.status == 200:
                        return
            except (urllib.error.URLError, ConnectionRefusedError, OSError) as exc:
                last_error = exc
                time.sleep(0.1)

        self.stop()
        raise TimeoutError(
            f"Live server at {self.base_url} failed to become healthy within {timeout}s: {last_error}"
        )

    def stop(self):
        """Cleanly terminate the server process."""
        if self.process is not None:
            if self.process.is_alive():
                self.process.terminate()
                self.process.join(timeout=3.0)
                if self.process.is_alive():
                    self.process.kill()
                    self.process.join(timeout=1.0)
            self.process = None

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop()


# Comprehensive list of documented server-to-client events
KNOWN_SOCKET_EVENTS = [
    "connect",
    "disconnect",
    "connect_error",
    "error",
    "room_full",
    "waiting_for_peer",
    "peer_connected",
    "peer_disconnected",
    "peer_incoming_speech",
    "peer_incoming_text",
    "speech_delivered",
    "translated_audio",
    "peer_speech_ended",
    "speech_error",
    "peer_language_updated",
    "peer_mute_changed",
    "peer_speaking_state",
    "room_terminated",
    "webrtc_offer",
    "webrtc_answer",
    "webrtc_ice_candidate",
]


class AsyncTestSocketClient:
    """Wrapper around socketio.AsyncClient providing event queues, awaiting, and history tracking."""

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.sio = socketio.AsyncClient()
        self.received_events: List[Tuple[str, Any]] = []
        self._event_queues: Dict[str, asyncio.Queue] = defaultdict(asyncio.Queue)
        self._register_event_handlers()

    def _register_event_handlers(self):
        """Register listeners for all known events to capture payloads into queues and history."""
        for event_name in KNOWN_SOCKET_EVENTS:
            # Bind closure capturing event_name
            self._bind_handler(event_name)

        # Catch-all handler for arbitrary events if supported
        try:
            @self.sio.on("*")
            def _any_event(event, data=None):
                if event not in KNOWN_SOCKET_EVENTS:
                    self.received_events.append((event, data))
                    self._event_queues[event].put_nowait(data)
        except Exception:
            pass

    def _bind_handler(self, event_name: str):
        def _handler(*args):
            data = args[0] if len(args) == 1 else (args if len(args) > 1 else None)
            self.received_events.append((event_name, data))
            self._event_queues[event_name].put_nowait(data)

        self.sio.on(event_name, _handler)

    @property
    def connected(self) -> bool:
        """Return True if the underlying socket is connected."""
        return self.sio.connected

    @property
    def sid(self) -> Optional[str]:
        """Return current socket session ID or None."""
        return self.sio.get_sid()

    async def connect(
        self,
        base_url: Optional[str] = None,
        headers: Optional[dict] = None,
        auth: Optional[dict] = None,
        timeout: float = 5.0,
    ):
        """Connect to the Socket.IO server and wait for connection confirmation."""
        target_url = base_url or self.base_url
        connect_future = asyncio.get_running_loop().create_future()

        def _on_conn():
            if not connect_future.done():
                connect_future.set_result(True)

        def _on_conn_err(err):
            if not connect_future.done():
                connect_future.set_exception(
                    ConnectionError(f"Socket.IO connection failed: {err}")
                )

        # One-shot hooks for connect/error
        self.sio.on("connect", _on_conn)
        self.sio.on("connect_error", _on_conn_err)

        await self.sio.connect(
            target_url,
            headers=headers,
            auth=auth,
            transports=["websocket", "polling"],
            wait_timeout=timeout,
        )

        try:
            await asyncio.wait_for(connect_future, timeout=timeout)
        except (asyncio.TimeoutError, Exception):
            # If already connected, succeed
            if not self.sio.connected:
                raise

    async def disconnect(self):
        """Cleanly disconnect from the server."""
        if self.sio.connected:
            await self.sio.disconnect()

    async def emit(self, event: str, data: Any = None, callback: Optional[Callable] = None):
        """Emit an event to the server."""
        await self.sio.emit(event, data, callback=callback)

    async def emit_with_ack(self, event: str, data: Any = None, timeout: float = 5.0) -> Any:
        """Emit an event expecting an acknowledgment callback response."""
        fut = asyncio.get_running_loop().create_future()

        def _ack(*args):
            if not fut.done():
                fut.set_result(args[0] if len(args) == 1 else args)

        await self.sio.emit(event, data, callback=_ack)
        return await asyncio.wait_for(fut, timeout=timeout)

    async def wait_for_event(self, event_name: str, timeout: float = 5.0) -> Any:
        """Wait for the next event payload of the given event name."""
        queue = self._event_queues[event_name]
        return await asyncio.wait_for(queue.get(), timeout=timeout)

    async def wait_for_event_matching(
        self,
        event_name: str,
        predicate: Callable[[Any], bool],
        timeout: float = 5.0,
    ) -> Any:
        """Wait for an event of the given name whose payload satisfies the predicate."""
        queue = self._event_queues[event_name]
        deadline = time.time() + timeout

        while True:
            remaining = deadline - time.time()
            if remaining <= 0:
                raise asyncio.TimeoutError(
                    f"Timed out waiting for matching event '{event_name}'"
                )
            data = await asyncio.wait_for(queue.get(), timeout=remaining)
            if predicate(data):
                return data

    def get_events(self, event_name: Optional[str] = None) -> List[Any]:
        """Return captured event payloads, filtered by event_name if provided."""
        if event_name is None:
            return list(self.received_events)
        return [payload for (name, payload) in self.received_events if name == event_name]

    def find_event(self, event_name: str, predicate: Optional[Callable[[Any], bool]] = None) -> Optional[Any]:
        """Find the first received event payload matching event_name and optional predicate, or None."""
        for name, data in self.received_events:
            if name == event_name:
                if predicate is None or predicate(data):
                    return data
        return None

    def clear_events(self):
        """Clear received event history and empty all event queues."""
        self.received_events.clear()
        for q in self._event_queues.values():
            while not q.empty():
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    break


def create_synthetic_wav(
    duration_ms: int = 500,
    sample_rate: int = 16000,
    frequency_hz: float = 440.0,
) -> bytes:
    """Generate a valid, minimal 16-bit mono PCM WAV byte stream."""
    num_samples = int(sample_rate * (duration_ms / 1000.0))
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        wav_file.setnchannels(1)  # mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        for i in range(num_samples):
            value = int(32767.0 * 0.5 * math.sin(2.0 * math.pi * frequency_hz * i / sample_rate))
            wav_file.writeframes(struct.pack("<h", value))
    return buf.getvalue()


def generate_base64_audio(
    duration_ms: int = 500,
    sample_rate: int = 16000,
    frequency_hz: float = 440.0,
) -> str:
    """Generate a valid Base64-encoded WAV audio string."""
    wav_bytes = create_synthetic_wav(
        duration_ms=duration_ms,
        sample_rate=sample_rate,
        frequency_hz=frequency_hz,
    )
    return base64.b64encode(wav_bytes).decode("ascii")


def create_corrupt_base64_audio() -> str:
    """Return an invalid Base64 audio payload for corruption and error testing."""
    return "NOT_VALID_AUDIO_HEADER_DATA_CORRUPT=="
