"""Pytest fixtures and configuration for VoiceBridge E2E test suite.

Features:
- Ephemeral live FastAPI + Socket.IO server running in a dedicated background process.
- Automatic health polling until /api/health responds with HTTP 200 before test execution.
- Clean process termination on test teardown.
- Asynchronous HTTP client fixtures (httpx.AsyncClient / BoundAsyncHttpClient).
- Socket.IO client fixtures and factories with event queue tracking and automatic disconnect.
- Transparent async test execution hook supporting coroutine test functions.
"""

import asyncio
import inspect
import sys
import os
from typing import Any, Callable, Generator, List

import pytest
import httpx

# Ensure project root and backend are in sys.path
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
backend_dir = os.path.join(root_dir, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from tests.e2e.harness import (
    LiveServerProcess,
    AsyncTestSocketClient,
    create_synthetic_wav,
    generate_base64_audio,
    create_corrupt_base64_audio,
)

# Registry to track active clients within each test for guaranteed teardown cleanup
_ACTIVE_TEST_RESOURCES: List[Any] = []


def register_resource_for_cleanup(resource: Any):
    """Register an HTTP or Socket.IO client for automated post-test cleanup."""
    _ACTIVE_TEST_RESOURCES.append(resource)


class BoundAsyncHttpClient:
    """Async HTTP client wrapper bound to the active test event loop."""

    def __init__(self, base_url: str, timeout: float = 15.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._client: httpx.AsyncClient = None

    async def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=self.timeout,
                follow_redirects=True,
            )
        return self._client

    @property
    def is_closed(self) -> bool:
        return self._client is None or self._client.is_closed

    async def get(self, url: str, **kwargs):
        c = await self._ensure_client()
        return await c.get(url, **kwargs)

    async def post(self, url: str, **kwargs):
        c = await self._ensure_client()
        return await c.post(url, **kwargs)

    async def delete(self, url: str, **kwargs):
        c = await self._ensure_client()
        return await c.delete(url, **kwargs)

    async def put(self, url: str, **kwargs):
        c = await self._ensure_client()
        return await c.put(url, **kwargs)

    async def patch(self, url: str, **kwargs):
        c = await self._ensure_client()
        return await c.patch(url, **kwargs)

    async def request(self, method: str, url: str, **kwargs):
        c = await self._ensure_client()
        return await c.request(method, url, **kwargs)

    async def aclose(self):
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()

    async def __aenter__(self):
        return await self._ensure_client()

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.aclose()


def pytest_pyfunc_call(pyfuncitem):
    """Execute async def test functions cleanly in their own event loop with automatic teardown."""
    if asyncio.iscoroutinefunction(pyfuncitem.obj):
        _ACTIVE_TEST_RESOURCES.clear()
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            # Resolve arguments from fixtures
            sig = inspect.signature(pyfuncitem.obj)
            kwargs = {
                param: pyfuncitem.funcargs[param]
                for param in sig.parameters
                if param in pyfuncitem.funcargs
            }
            loop.run_until_complete(pyfuncitem.obj(**kwargs))
        finally:
            # Clean up all registered resources inside the same event loop
            for res in list(_ACTIVE_TEST_RESOURCES):
                try:
                    if isinstance(res, AsyncTestSocketClient) and res.connected:
                        loop.run_until_complete(res.disconnect())
                    elif hasattr(res, "connected") and getattr(res, "connected", False):
                        if hasattr(res, "disconnect"):
                            loop.run_until_complete(res.disconnect())
                    elif isinstance(res, (BoundAsyncHttpClient, httpx.AsyncClient)):
                        if hasattr(res, "is_closed") and not res.is_closed:
                            loop.run_until_complete(res.aclose())
                except Exception:
                    pass
            _ACTIVE_TEST_RESOURCES.clear()

            # Drain any remaining pending tasks
            pending = asyncio.all_tasks(loop)
            for task in pending:
                task.cancel()
            if pending:
                loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
            loop.close()
            asyncio.set_event_loop(None)
        return True


@pytest.fixture(scope="session")
def anyio_backend():
    """Specify asyncio as the default anyio backend."""
    return "asyncio"


@pytest.fixture(scope="session")
def live_server() -> Generator[LiveServerProcess, None, None]:
    """Session-scoped fixture starting the live FastAPI + Socket.IO server on an ephemeral port.

    Health-polls /api/health until HTTP 200 is confirmed before yielding.
    Cleanly terminates the server process on session completion.
    """
    server = LiveServerProcess()
    server.start(timeout=15.0)
    try:
        yield server
    finally:
        server.stop()


@pytest.fixture(scope="session")
def server_base_url(live_server: LiveServerProcess) -> str:
    """Return the base URL of the live running server."""
    return live_server.base_url


@pytest.fixture(scope="session")
def server_port(live_server: LiveServerProcess) -> int:
    """Return the ephemeral port of the live running server."""
    return live_server.port


@pytest.fixture
def http_client(server_base_url: str) -> BoundAsyncHttpClient:
    """Provide an asynchronous HTTP client pointed at the live server base URL."""
    client = BoundAsyncHttpClient(server_base_url)
    register_resource_for_cleanup(client)
    return client


@pytest.fixture
def async_http_client_factory(server_base_url: str) -> Callable[..., httpx.AsyncClient]:
    """Provide a factory function creating new httpx.AsyncClient instances with auto-cleanup."""
    def _create(**kwargs) -> httpx.AsyncClient:
        client = httpx.AsyncClient(base_url=server_base_url, timeout=15.0, **kwargs)
        register_resource_for_cleanup(client)
        return client

    return _create


@pytest.fixture
def socket_client_factory(server_base_url: str) -> Callable[..., AsyncTestSocketClient]:
    """Provide a factory function to create AsyncTestSocketClient instances with auto-cleanup."""
    def _create() -> AsyncTestSocketClient:
        client = AsyncTestSocketClient(server_base_url)
        register_resource_for_cleanup(client)
        return client

    return _create


@pytest.fixture
def socket_client(socket_client_factory) -> AsyncTestSocketClient:
    """Provide a single pre-instantiated AsyncTestSocketClient."""
    return socket_client_factory()


@pytest.fixture
def raw_socketio_factory() -> Callable[..., Any]:
    """Provide a factory function creating raw socketio.AsyncClient instances with auto-cleanup."""
    import socketio

    def _create(**kwargs) -> socketio.AsyncClient:
        client = socketio.AsyncClient(**kwargs)
        register_resource_for_cleanup(client)
        return client

    return _create


@pytest.fixture
def sample_wav_bytes() -> bytes:
    """Provide valid 16-bit mono PCM WAV bytes."""
    return create_synthetic_wav(duration_ms=500, sample_rate=16000)


@pytest.fixture
def sample_wav_b64() -> str:
    """Provide a valid Base64-encoded WAV audio string."""
    return generate_base64_audio(duration_ms=500, sample_rate=16000)


@pytest.fixture
def corrupt_audio_b64() -> str:
    """Provide an invalid / corrupt Base64 audio payload for error handling tests."""
    return create_corrupt_base64_audio()
