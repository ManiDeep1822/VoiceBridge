# Scope: E2E Testing Track

## Architecture
Opaque-box, requirement-driven E2E testing suite for VoiceBridge Real Live Call Translator:
- Testing Entry Points:
  - HTTP REST endpoints (`/api/health`, `/api/languages`, `/api/supported-languages`, `/api/translate`, `/api/tts`, `/api/stt`, etc.)
  - WebSocket signaling and real-time audio/text transport (`join_room`, `leave_room`, `speech_segment`, `webrtc_signal`, `subtitle_broadcast`, `transcript_sync`, etc.)
  - End-to-end data pipelines: Speech transcript -> Prosody intent -> Domain Jargon Lock -> Multi-tier Translation -> Neural Speech Synthesis (Edge-TTS)
  - Dashboard operations & export formats (JSON, TXT, CSV transcripts)
- Test Harness:
  - Python-based opaque-box runner using `pytest`, `httpx` (ASGI Lifespan or HTTP client), and `python-socketio` / `websockets` client to interact with the backend server as an external black box client.
  - Clear test isolation, zero dependency on internal implementation classes or private functions.

## Feature Inventory (E2E Test Scope)
| # | Feature Area | Description | Test Tier Focus |
|---|--------------|-------------|-----------------|
| F1 | System Health & Info | API health check, version, and server readiness | Tier 1, Tier 2 |
| F2 | Language Registry | Supported languages, source/target lang validation, regional voices | Tier 1, Tier 2 |
| F3 | REST Translation API | Multi-language translation, fallback engines, error handling | Tier 1, Tier 2, Tier 3 |
| F4 | REST TTS Audio API | Neural speech synthesis, global voice mapping, audio base64 payload | Tier 1, Tier 2, Tier 3 |
| F5 | REST STT Audio API | Audio transcription endpoint, supported audio encodings, edge formats | Tier 1, Tier 2 |
| F6 | WebSocket Room Lifecycle | Connect, `join_room`, room occupancy, `leave_room`, disconnect cleanup | Tier 1, Tier 2, Tier 4 |
| F7 | WebRTC Signaling | Offer, answer, ICE candidate relay across peers | Tier 1, Tier 2, Tier 4 |
| F8 | Live Speech Segment Pipeline | Ingestion of `speech_segment`, prosody classification, translation, TTS generation, client broadcast | Tier 1, Tier 2, Tier 3, Tier 4 |
| F9 | Domain Jargon Lock | Jargon glossary protection across domains (medical, legal, tech, finance) | Tier 1, Tier 2, Tier 3 |
| F10 | Prosody & Intent Analysis | Exclamation, question, urgency normalization and intent marking | Tier 1, Tier 2, Tier 3 |
| F11 | Fallback & Resilience | Missing audio fallback, invalid language fallback, corrupt audio handling | Tier 2, Tier 3 |
| F12 | Live Call Sessions & Call Simulator | Multi-user room call flow, solo simulator call, export transcript generation | Tier 4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E-M0 | Spec Mining & Discovery | Extract exact REST routes, Socket.IO events, payloads, schemas, and configurations from the codebase. | none | IN_PROGRESS |
| E2E-M1 | Test Infra & Runner Setup | Create `tests/e2e` directory, test runner config, client fixtures, and `TEST_INFRA.md`. | E2E-M0 | PLANNED |
| E2E-M2 | Tiers 1 & 2 Test Suite | Implement Tier 1 (Feature Coverage >= 5 per feature) and Tier 2 (Boundary & Corner Cases >= 5 per feature). | E2E-M1 | PLANNED |
| E2E-M3 | Tiers 3 & 4 Test Suite | Implement Tier 3 (Cross-Feature Combinations) and Tier 4 (Real-World Application Scenarios). | E2E-M2 | PLANNED |
| E2E-M4 | Test Suite Verification & Audit | Execute full suite, verify zero failures, generate `TEST_READY.md`, run Reviewer, Challenger, and Auditor gates. | E2E-M3 | PLANNED |
