import os
import sys
import base64
import socketio

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from services.translator import translate_text
from services.tts import synthesize_speech, VOICE_MAP
from socket_handlers import register_socket_events

load_dotenv()

# Setup Socket.IO Server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    ping_timeout=60,
    ping_interval=25
)

# Register socket room events
register_socket_events(sio)

# Setup FastAPI App
app = FastAPI(title="Real-Time Speech Translation Call Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models for REST testing endpoints
class TranslateRequest(BaseModel):
    text: str
    source_lang: str = "te"
    target_lang: str = "hi"

class TTSRequest(BaseModel):
    text: str
    target_lang: str = "hi"
    gender: str = "female"

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Speech Translation Call Backend",
        "supported_languages": list(VOICE_MAP.keys())
    }

@app.get("/api/rooms")
async def get_rooms():
    from socket_handlers import rooms
    return {
        "total_rooms": len(rooms),
        "rooms": {r_id: list(participants.values()) for r_id, participants in rooms.items()}
    }

@app.post("/api/translate")
async def handle_translate(req: TranslateRequest):
    clean_text = req.text.strip()[:1000]
    if not clean_text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    translated = await translate_text(clean_text, req.source_lang, req.target_lang)
    return {
        "original": clean_text,
        "translated": translated,
        "source_lang": req.source_lang,
        "target_lang": req.target_lang
    }

@app.post("/api/tts")
async def handle_tts(req: TTSRequest):
    clean_text = req.text.strip()[:1000]
    if not clean_text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    audio_bytes = await synthesize_speech(clean_text, req.target_lang, req.gender)
    if not audio_bytes:
        raise HTTPException(status_code=500, detail="Failed to synthesize speech")
    return {
        "audio_base64": base64.b64encode(audio_bytes).decode("utf-8"),
        "format": "mp3",
        "target_lang": req.target_lang,
        "gender": req.gender
    }

# Mount static frontend build if present
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404, detail="API endpoint not found")
        file_path = os.path.abspath(os.path.join(frontend_dist, full_path))
        if full_path and os.path.commonpath([frontend_dist, file_path]) == frontend_dist and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))

# Combine Socket.io with FastAPI
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

if __name__ == "__main__":
    import uvicorn
    import socket

    port = int(os.getenv("PORT", 8000))

    def is_port_available(p: int) -> bool:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("0.0.0.0", p))
                return True
            except OSError:
                return False

    if not is_port_available(port):
        for candidate in [8080, 8001, 8002, 5000]:
            if is_port_available(candidate):
                print(f"[Notice] Port {port} is busy or restricted. Using fallback port http://localhost:{candidate}")
                port = candidate
                break

    print(f"Starting Speech Translation Server on http://0.0.0.0:{port}")
    uvicorn.run("main:socket_app", host="0.0.0.0", port=port, reload=True)
