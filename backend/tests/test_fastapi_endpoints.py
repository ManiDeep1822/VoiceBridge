import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "service" in data
    assert "te" in data["supported_languages"]

def test_get_rooms_initially_empty():
    response = client.get("/api/rooms")
    assert response.status_code == 200
    data = response.json()
    assert "total_rooms" in data
    assert isinstance(data["rooms"], dict)

def test_translate_endpoint():
    # Valid request
    res = client.post("/api/translate", json={"text": "Hello", "source_lang": "en", "target_lang": "hi"})
    assert res.status_code == 200
    data = res.json()
    assert "translated" in data
    assert len(data["translated"]) > 0

    # Empty text validation
    empty_res = client.post("/api/translate", json={"text": "   ", "source_lang": "en", "target_lang": "hi"})
    assert empty_res.status_code == 400

def test_tts_endpoint():
    res = client.post("/api/tts", json={"text": "Hello", "target_lang": "en", "gender": "female"})
    assert res.status_code == 200
    data = res.json()
    assert "audio_base64" in data
    assert data["format"] == "mp3"
    assert len(data["audio_base64"]) > 100

    # Empty text validation
    empty_res = client.post("/api/tts", json={"text": "", "target_lang": "en"})
    assert empty_res.status_code == 400

def test_minutes_endpoint():
    payload = {
        "transcript": [
            {"speaker": "Op1", "originalText": "Hello", "translatedText": "Hola"}
        ],
        "tier": "pro"
    }
    res = client.post("/api/minutes", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert "decisions" in data
    assert len(data["decisions"]) > 0
    assert "action_items" in data

def test_glossary_endpoint():
    res = client.post("/api/glossary", json={"domain": "medical"})
    assert res.status_code == 200
    data = res.json()
    assert data["domain"] == "medical"
    assert data["status"] == "active"

def test_api_unknown_returns_404_json_not_html():
    res = client.get("/api/nonexistent_endpoint")
    assert res.status_code == 404
    assert res.headers.get("content-type", "").startswith("application/json")
    data = res.json()
    assert "detail" in data
