import os
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_default_ice_servers():
    res = client.get("/api/ice-servers")
    assert res.status_code == 200
    data = res.json()
    assert "iceServers" in data
    ice_servers = data["iceServers"]
    assert len(ice_servers) >= 2

    # Check STUN entry
    stun_entry = ice_servers[0]
    assert "urls" in stun_entry
    assert any("stun.l.google.com:19302" in u for u in stun_entry["urls"])

    # Check TURN entry
    turn_entry = ice_servers[1]
    assert "urls" in turn_entry
    assert turn_entry.get("username") == "openrelayproject"
    assert turn_entry.get("credential") == "openrelayproject"

    turn_urls = turn_entry["urls"]
    # Verify OpenRelay ports 80, 443, 3478 over both UDP and TCP
    assert any("openrelay.metered.ca:80" in u for u in turn_urls)
    assert any("openrelay.metered.ca:80?transport=tcp" in u for u in turn_urls)
    assert any("openrelay.metered.ca:443" in u for u in turn_urls)
    assert any("openrelay.metered.ca:443?transport=tcp" in u for u in turn_urls)
    assert any("openrelay.metered.ca:3478" in u for u in turn_urls)
    assert any("openrelay.metered.ca:3478?transport=tcp" in u for u in turn_urls)

def test_ice_servers_env_overrides(monkeypatch):
    monkeypatch.setenv("STUN_SERVER_URLS", "stun:custom.stun.corp:3478")
    monkeypatch.setenv("TURN_SERVER_URLS", "turn:custom.turn.corp:3478,turn:custom.turn.corp:443?transport=tcp")
    monkeypatch.setenv("TURN_USERNAME", "custom_corp_user")
    monkeypatch.setenv("TURN_CREDENTIAL", "custom_corp_pass")

    res = client.get("/api/ice-servers")
    assert res.status_code == 200
    data = res.json()
    ice_servers = data["iceServers"]

    assert ice_servers[0]["urls"] == ["stun:custom.stun.corp:3478"]
    assert "turn:custom.turn.corp:3478" in ice_servers[1]["urls"]
    assert ice_servers[1]["username"] == "custom_corp_user"
    assert ice_servers[1]["credential"] == "custom_corp_pass"
