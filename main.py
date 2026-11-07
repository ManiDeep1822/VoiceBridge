"""
VoiceBridge Unified Root Launcher
Delegates execution to backend/main.py while maintaining correct paths.
"""
import sys
import os
import subprocess

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "backend"))
venv_python = os.path.join(backend_dir, ".venv", "Scripts", "python.exe")

if os.path.exists(venv_python) and sys.executable.lower() != venv_python.lower():
    # Relaunch using the backend virtualenv python
    result = subprocess.run([venv_python, os.path.join(backend_dir, "main.py")] + sys.argv[1:])
    sys.exit(result.returncode)
else:
    sys.path.insert(0, backend_dir)
    os.chdir(backend_dir)
    import uvicorn
    from main import socket_app

    port = int(os.getenv("PORT", 8000))
    print(f"Starting Speech Translation Server on http://0.0.0.0:{port}")
    uvicorn.run(socket_app, host="0.0.0.0", port=port)
