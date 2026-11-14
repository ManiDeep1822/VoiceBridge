## 2026-11-12T16:39:47Z
You are an E2E Test Writer implementing Milestone E2E-M2A: Tier 1 Feature Coverage Test Suite.

Your Working Directory: d:\Real Live Call Translator
Your State Folder: d:\Real Live Call Translator\.agents\teamwork\test_writer_tier1
Your Exclusively Owned File: tests/e2e/test_tier1_core.py

MANDATORY FIRST STEPS:
1. Read the original request at:
   d:\Real Live Call Translator\.agents\teamwork\ORIGINAL_REQUEST.md
2. Read the project scope document at:
   d:\Real Live Call Translator\.agents\teamwork\orchestrator\PROJECT.md
3. Read the E2E scope document at:
   d:\Real Live Call Translator\.agents\teamwork\sub_orch_e2e\SCOPE.md
4. Read the test infrastructure blueprint at:
   d:\Real Live Call Translator\TEST_INFRA.md
5. Read the specification report at:
   d:\Real Live Call Translator\.agents\teamwork\spec_miner_e2e_1\spec_report.md
6. Inspect `tests/e2e/conftest.py`, `tests/e2e/harness.py`, and `tests/e2e/test_infra_sanity.py` to understand the live server fixtures and `AsyncTestSocketClient`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

IMPORTANT OPERATIONAL RULE:
Update your state folder's `progress.md` after EVERY completed step with a `Last visited: [timestamp]` header so the orchestrator knows you are active and progressing.

OBJECTIVE:
Create `tests/e2e/test_tier1_core.py` containing 60 comprehensive, opaque-box test cases that verify every feature (F1 through F12) in isolation with >= 5 tests per feature.

FEATURE COVERAGE REQUIREMENTS (5 tests per feature = 60 tests total):
- Feature 1: System Health & Info (F1) - 5 tests
  * Root health check returns status healthy & service name
  * Supported languages list in health check is populated
  * Active room count is reported accurately
  * Direct GET /api/rooms returns list of active rooms
  * Static file route handles root / SPA requests cleanly
- Feature 2: Language Registry & Catalog (F2) - 5 tests
  * Language codes in health catalog match expected codes (en, te, hi, ta, es, fr, etc.)
  * Indian languages catalog present (hi, te, ta, kn, ml, mr, bn, gu, pa)
  * Global European/Asian languages catalog present (es, fr, de, it, ja, zh, etc.)
  * GET /api/glossary returns all 6 domain schema definitions
  * POST /api/glossary returns terms count and sample terms for specified domain
- Feature 3: REST Translation Endpoint (F3) - 5 tests
  * English to Spanish translation succeeds and returns expected schema
  * English to Telugu translation succeeds
  * English to Hindi translation succeeds
  * Translation preserves domain jargon lock tokens [[TERM]]
  * Auto-detection or specified source language translation works as expected
- Feature 4: REST Neural Speech Synthesis TTS (F4) - 5 tests
  * English text synthesis returns valid base64 MP3 audio and audio_duration_estimate
  * Hindi text synthesis returns audio payload
  * Telugu text synthesis returns audio payload
  * Synthesis with male/female gender preference succeeds
  * Synthesis of long multi-sentence paragraph returns valid non-empty audio
- Feature 5: REST Speech-to-Text STT (F5) - 5 tests
  * Valid synthetic WAV base64 payload returns transcript and language
  * English audio transcription returns success flag
  * Hindi audio transcription returns success flag
  * STT response includes timing/duration metadata
  * Audio transcription handles various standard sample rates (16kHz, 24kHz)
- Feature 6: WebSocket Room Lifecycle (F6) - 5 tests
  * Single client connects, joins room, receives 'waiting_for_peer'
  * Second client joins room, both receive 'peer_connected'
  * Initiator flag is correctly assigned (first client is initiator, second is not)
  * Client leaves room, peer receives 'peer_disconnected' / 'peer_left'
  * DELETE /api/rooms/{room_id} emits 'room_terminated' and purges room state
- Feature 7: WebRTC Signaling Relay (F7) - 5 tests
  * 'webrtc_offer' sent by Client A is relayed to Client B with offer SDP
  * 'webrtc_answer' sent by Client B is relayed to Client A with answer SDP
  * 'webrtc_ice_candidate' is relayed between peers
  * 'toggle_mute' emits 'peer_mute_changed' with updated mute state
  * 'speaking_state' emits 'peer_speaking_state' to peer
- Feature 8: Live Speech Segment Pipeline (F8) - 5 tests
  * Client A emits 'speech_segment', Client B receives 'peer_incoming_text' (instant subtitle)
  * Client A receives 'speech_delivered' confirmation
  * Client B receives 'translated_audio' with neural Base64 MP3 audio
  * Translated text matches target language requested in speech_segment
  * Rapid speech segment delivery triggers 'peer_speech_ended' or segment sequence
- Feature 9: Domain Jargon Lock (F9) - 5 tests
  * Speech segment with medical domain protects medical terms (e.g. myocardial infarction)
  * Speech segment with fintech domain protects financial terms (e.g. EBITDA, arbitrage)
  * Speech segment with legal domain protects legal terms (e.g. affidavit, habeas corpus)
  * Speech segment with engineering domain protects technical terms (e.g. microservice, idempotent)
  * Speech segment with defense domain protects defense terms (e.g. radar, payload)
- Feature 10: Prosody & Intent Analysis (F10) - 5 tests
  * Interrogative phrase (e.g. "where are you going") detected with intent "question" and '?' added
  * Exclamatory phrase (e.g. "hurry up", "run fast") detected with intent "exclamation" and '!' added
  * Statement phrase detected with intent "statement" and '.' added
  * Telugu spoken slang normalization (e.g. "enti bro" -> normalized)
  * Hindi spoken slang normalization (e.g. "kya yaar" -> normalized)
- Feature 11: Fallback Resilience & Graceful Degradation (F11) - 5 tests
  * Translation engine fallback chain gracefully delivers translated text
  * Speech segment without domain defaults to 'general' domain
  * Edge-TTS synthesis fallback succeeds when network or voice mapping is varied
  * Update language event ('update_language') updates peer state and notifies peer
  * Ping-check WebSocket event returns pong ACK with timestamp
- Feature 12: Call Simulator & Transcript Operations (F12) - 5 tests
  * Solo Simulator call: single client in room sends speech segment and receives loopback translation
  * Solo Simulator call: single client receives loopback neural audio
  * POST /api/minutes generates structured minutes, key decisions, and action items
  * DELETE /api/rooms/{room_id} for active simulator room cleanly removes room
  * Room session transcript accumulation: multiple speech segments appear in room transcript

EXECUTION & VERIFICATION:
1. Run `python -m pytest tests/e2e/test_tier1_core.py -v`
2. Run `python run_e2e.py --tier 1 -v`
3. Verify that all 60 tests pass cleanly.
4. Write `handoff.md` in your state folder with execution commands, passing test outputs, and clear documentation.
5. Notify the parent orchestrator via `send_message`.
