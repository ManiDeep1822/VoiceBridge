# Task Assignment for E2E Spec Miner
State folder: d:\Real Live Call Translator\.agents\teamwork\spec_miner_e2e_1
Parent Orchestrator: E2E Testing Orchestrator (sub_orch_e2e)
Original Request: d:\Real Live Call Translator\.agents\teamwork\ORIGINAL_REQUEST.md
Project Scope: d:\Real Live Call Translator\.agents\teamwork\orchestrator\PROJECT.md
E2E Scope: d:\Real Live Call Translator\.agents\teamwork\sub_orch_e2e\SCOPE.md

## 2026-11-12T16:10:04Z
You are an E2E Spec Miner for the VoiceBridge Real Live Call Translator project.

Your Working Directory: d:\Real Live Call Translator
Your State Folder: d:\Real Live Call Translator\.agents\teamwork\spec_miner_e2e_1

MANDATORY FIRST STEPS:
1. Read the original request at:
   d:\Real Live Call Translator\.agents\teamwork\ORIGINAL_REQUEST.md
2. Read the project scope document at:
   d:\Real Live Call Translator\.agents\teamwork\orchestrator\PROJECT.md
3. Read the E2E scope document at:
   d:\Real Live Call Translator\.agents\teamwork\sub_orch_e2e\SCOPE.md

OBJECTIVE:
Investigate the codebase (backend and frontend) to mine and document the complete specification of external interfaces, protocols, and behaviors needed to write an opaque-box, requirement-driven 4-tier E2E test suite.

WHAT TO INVESTIGATE:
1. REST API endpoints in `backend/main.py` and elsewhere:
   - Full URL paths, HTTP methods, headers, query parameters, request bodies (Pydantic models / JSON), response schemas, and status codes (success and error codes).
   - E.g. `/api/health`, `/api/languages`, `/api/translate`, `/api/tts`, `/api/stt`, etc.
2. Socket.IO Events and protocols in `backend/socket_handlers.py` and `frontend/src/hooks/useWebRTC.js`:
   - Connection/disconnection lifecycle.
   - Client-to-server events: `join_room`, `leave_room`, `speech_segment`, `webrtc_signal`, etc., including expected payload structures, validation, and error states.
   - Server-to-client events: `joined`, `peer_joined`, `peer_left`, `subtitle_broadcast`, `transcript_sync`, `webrtc_signal`, error events, etc.
3. Domain Jargon Lock & Glossary in `backend/services/glossary.py`:
   - Supported domains (e.g. medical, legal, tech, finance), lock syntax/markers, glossary replacement rules.
4. Prosody Engine in `backend/services/prosody_engine.py` and `frontend/src/utils/prosodyEngine.js`:
   - Intent classifications (exclamation, question, urgency, neutral), punctuation/regex patterns, normalization behavior.
5. Translation & TTS in `backend/services/translator.py` and `backend/services/tts.py`:
   - Supported language codes, fallback behavior, response format (e.g. base64 audio, content types).
6. Existing test harnesses and environment configuration:
   - How `backend/tests` or client harnesses are configured, packages installed (`httpx`, `pytest`, `python-socketio`, etc.).

DELIVERABLES:
1. Create `spec_report.md` in your state folder (`d:\Real Live Call Translator\.agents\teamwork\spec_miner_e2e_1\spec_report.md`) detailing all of the above with concrete payload examples, status codes, and edge case expectations.
2. Write `handoff.md` in your state folder.
3. Send a message to your parent orchestrator with a summary and link to `spec_report.md`.
