"""
Empirical Challenger 1 Stress Test Harness for Milestone 1:
- Subprocess isolation (-E, isolated PYTHONPATH)
- Working directory independence
- Root launcher side-effect prevention
- Python 3.13 SpeechRecognition & standard-aifc compatibility
- /api/stt endpoint error recovery and temporary file leak audit
"""

import os
import sys
import subprocess
import tempfile
import base64
import io
import wave
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from backend.main import app
import backend.socket_handlers

client = TestClient(app)
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


# =====================================================================
# SUITE 1: Subprocess Environment & Import Isolation
# =====================================================================

def test_subprocess_import_socket_handlers_from_root():
    """Verify backend.socket_handlers can be imported from root in an isolated process ignoring PYTHONPATH."""
    cmd = [sys.executable, "-E", "-c", "import backend.socket_handlers; print('OK')"]
    proc = subprocess.run(cmd, cwd=ROOT_DIR, capture_output=True, text=True)
    assert proc.returncode == 0, f"Failed: {proc.stderr}"
    assert "OK" in proc.stdout


def test_subprocess_import_socket_handlers_from_backend_dir():
    """Verify socket_handlers can be imported directly when working directory is backend/."""
    cmd = [sys.executable, "-E", "-c", "import socket_handlers; print('OK')"]
    proc = subprocess.run(cmd, cwd=BACKEND_DIR, capture_output=True, text=True)
    assert proc.returncode == 0, f"Failed: {proc.stderr}"
    assert "OK" in proc.stdout


def test_subprocess_import_from_temp_directory():
    """Verify backend.socket_handlers imports cleanly from an unrelated directory when root is in sys.path."""
    temp_dir = tempfile.gettempdir()
    script = (
        f"import sys; sys.path.insert(0, r'{ROOT_DIR}'); "
        f"import backend.socket_handlers; print('OK')"
    )
    cmd = [sys.executable, "-E", "-c", script]
    proc = subprocess.run(cmd, cwd=temp_dir, capture_output=True, text=True)
    assert proc.returncode == 0, f"Failed: {proc.stderr}"
    assert "OK" in proc.stdout


def test_subprocess_import_root_main_no_side_effects():
    """Verify importing root main.py has zero side-effects, does not block, and does not alter cwd."""
    script = (
        "import os, sys, main; "
        "print('CWD:', os.getcwd()); "
        "assert callable(main.run); "
        "print('OK')"
    )
    cmd = [sys.executable, "-E", "-c", script]
    proc = subprocess.run(cmd, cwd=ROOT_DIR, capture_output=True, text=True)
    assert proc.returncode == 0, f"Failed: {proc.stderr}"
    assert "OK" in proc.stdout
    assert f"CWD: {ROOT_DIR}" in proc.stdout


def test_backend_is_regular_python_package():
    """Verify backend/__init__.py exists and defines a genuine Python package."""
    import backend
    assert hasattr(backend, "__file__")
    assert hasattr(backend, "__path__")
    init_path = os.path.join(BACKEND_DIR, "__init__.py")
    assert os.path.isfile(init_path), "backend/__init__.py does not exist!"


# =====================================================================
# SUITE 2: Python 3.13 SpeechRecognition & standard-aifc Compatibility
# =====================================================================

def test_python_313_aifc_resolution():
    """Verify standard-aifc satisfies aifc requirement on Python 3.13."""
    import aifc
    assert hasattr(aifc, "open")
    import speech_recognition as sr
    assert hasattr(sr, "Recognizer")
    assert hasattr(sr, "AudioFile")
    recognizer = sr.Recognizer()
    assert recognizer is not None


# =====================================================================
# SUITE 3: /api/stt Endpoint Error Recovery & Validation
# =====================================================================

def _create_dummy_wav(duration_sec=0.2, sample_rate=16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(b"\x00\x00" * int(sample_rate * duration_sec))
    return buf.getvalue()


def test_stt_empty_and_whitespace_payload():
    """Verify /api/stt rejects empty and whitespace-only payloads with 400 Bad Request."""
    res_empty = client.post("/api/stt", json={"audio_base64": ""})
    assert res_empty.status_code == 400
    assert "Audio cannot be empty" in res_empty.json().get("detail", "")

    res_ws = client.post("/api/stt", json={"audio_base64": "    \t\n  "})
    assert res_ws.status_code == 400
    assert "Audio cannot be empty" in res_ws.json().get("detail", "")


def test_stt_null_payload_returns_422():
    """Verify /api/stt rejects null audio_base64 with standard 422 Unprocessable Entity."""
    res = client.post("/api/stt", json={"audio_base64": None})
    assert res.status_code == 422


def test_stt_invalid_base64_string():
    """Verify /api/stt handles malformed base64 strings gracefully without 500 crash."""
    res = client.post("/api/stt", json={"audio_base64": "!!!NOT_VALID_BASE64&&&"})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is False
    assert "error" in data


def test_stt_corrupt_audio_bytes():
    """Verify /api/stt handles valid base64 with non-audio garbage gracefully without 500 crash."""
    corrupt_b64 = base64.b64encode(b"THIS_IS_DEFINITELY_NOT_A_VALID_WAV_HEADER").decode("utf-8")
    res = client.post("/api/stt", json={"audio_base64": corrupt_b64, "language": "en"})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is False
    assert "error" in data


def test_stt_valid_wav_silent_audio():
    """Verify /api/stt accepts valid PCM WAV audio without unhandled exception."""
    valid_wav = _create_dummy_wav(0.3)
    valid_b64 = base64.b64encode(valid_wav).decode("utf-8")
    res = client.post("/api/stt", json={"audio_base64": valid_b64, "language": "en"})
    assert res.status_code == 200
    data = res.json()
    assert "transcript" in data
    assert "language" in data
    assert data["language"] == "en"


def test_stt_temporary_file_leak_audit():
    """Verify that /api/stt cleans up all temporary .wav files from disk on both success and failure."""
    valid_wav = _create_dummy_wav(0.2)
    valid_b64 = base64.b64encode(valid_wav).decode("utf-8")
    corrupt_b64 = base64.b64encode(b"corrupt-data").decode("utf-8")

    created_temp_files = []
    original_named_temp = tempfile.NamedTemporaryFile

    def tracking_temp_file(*args, **kwargs):
        f = original_named_temp(*args, **kwargs)
        created_temp_files.append(f.name)
        return f

    with patch("tempfile.NamedTemporaryFile", side_effect=tracking_temp_file):
        # 1. Successful valid audio request
        client.post("/api/stt", json={"audio_base64": valid_b64, "language": "en"})
        # 2. Corrupted audio request
        client.post("/api/stt", json={"audio_base64": corrupt_b64, "language": "en"})
        # 3. Invalid base64 request (fails before tempfile creation)
        client.post("/api/stt", json={"audio_base64": "invalid_b64"})

    assert len(created_temp_files) >= 2, "Expected temp files to be recorded"
    for file_path in created_temp_files:
        assert not os.path.exists(file_path), f"TEMP FILE LEAK DETECTED: {file_path} still exists on disk!"
