import os
import sys
import subprocess
import pytest

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def test_import_backend_socket_handlers():
    """Verify backend.socket_handlers can be imported in-process and in isolated subprocess."""
    # In-process import
    import backend.socket_handlers
    assert hasattr(backend.socket_handlers, "register_socket_events")

    # Subprocess isolated import ignoring PYTHONPATH
    cmd = [sys.executable, "-E", "-c", "import backend.socket_handlers; print('OK')"]
    proc = subprocess.run(cmd, cwd=ROOT_DIR, capture_output=True, text=True)
    assert proc.returncode == 0, f"Subprocess import failed: {proc.stderr}"
    assert "OK" in proc.stdout

def test_import_backend_main():
    """Verify backend.main can be imported in-process and in isolated subprocess."""
    # In-process import
    import backend.main
    assert hasattr(backend.main, "app")
    assert hasattr(backend.main, "socket_app")

    # Subprocess isolated import ignoring PYTHONPATH
    cmd = [sys.executable, "-E", "-c", "import backend.main; assert hasattr(backend.main, 'app'); print('OK')"]
    proc = subprocess.run(cmd, cwd=ROOT_DIR, capture_output=True, text=True)
    assert proc.returncode == 0, f"Subprocess import failed: {proc.stderr}"
    assert "OK" in proc.stdout

def test_import_root_main_no_side_effects():
    """Verify importing root main.py has no side effects and exposes callable run."""
    cmd = [sys.executable, "-E", "-c", "import main; assert callable(main.run); print('OK')"]
    proc = subprocess.run(cmd, cwd=ROOT_DIR, capture_output=True, text=True)
    assert proc.returncode == 0, f"Subprocess import of root main failed: {proc.stderr}"
    assert "OK" in proc.stdout

def test_import_sibling_from_backend_cwd():
    """Verify sibling module imports succeed directly when cwd is backend/."""
    cmd = [sys.executable, "-E", "-c", "import socket_handlers; import main; print('OK')"]
    proc = subprocess.run(cmd, cwd=BACKEND_DIR, capture_output=True, text=True)
    assert proc.returncode == 0, f"Subprocess sibling import failed: {proc.stderr}"
    assert "OK" in proc.stdout
