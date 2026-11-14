## 2026-11-12T16:55:23Z
You are an E2E Test Writer implementing Milestone E2E-M2B: Tier 2 Boundary & Corner Cases Test Suite.

Your Working Directory: d:\Real Live Call Translator
Your State Folder: d:\Real Live Call Translator\.agents\teamwork\test_writer_tier2
Your Exclusively Owned File: tests/e2e/test_tier2_boundaries.py

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
6. Inspect `tests/e2e/conftest.py`, `tests/e2e/harness.py`, and `tests/e2e/test_tier1_core.py` to follow established test conventions.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

IMPORTANT OPERATIONAL RULE:
Update your state folder's `progress.md` after EVERY completed step with a `Last visited: [timestamp]` header so the orchestrator knows you are active and progressing.

OBJECTIVE:
Create `tests/e2e/test_tier2_boundaries.py` containing 60 comprehensive, boundary, corner-case, and negative test cases covering Features F1 through F12 (5 tests per feature).

BOUNDARY & CORNER CASE REQUIREMENTS (5 tests per feature = 60 tests total):
- Feature 1 Boundaries (F1 - System Health):
  * POST to /api/health returns 405 Method Not Allowed
  * Trailing slash handling (/api/health/ vs /api/health)
  * Non-existent endpoint under /api/ returns 404 with {"detail": "API endpoint not found"}
  * Corrupted / malformed payload to /api/health
  * Rapid burst of 20 back-to-back health checks succeeds without 500
- Feature 2 Boundaries (F2 - Language Registry):
  * Query with uppercase or mixed-case language codes handles gracefully
  * Query with unknown / invalid language code returns fallback or handled error
  * POST /api/glossary with empty domain string or non-existent domain returns empty list/fallback
  * POST /api/glossary with excessively long domain string (>100 chars)
  * Non-string types in language parameter (handled gracefully)
- Feature 3 Boundaries (F3 - REST Translation):
  * Empty text string "" returns 400 Bad Request
  * Oversized text (>1000 characters) is truncated or rejected cleanly
  * Unicode emojis, math symbols, and mixed scripts preserved
  * Translation with identical source and target language (e.g. en->en) returns original text
  * Missing required fields in POST /api/translate returns 422 Unprocessable Entity
- Feature 4 Boundaries (F4 - REST Neural TTS):
  * Empty text string "" returns 400 Bad Request
  * Massive text (>2500 characters) synthesizes or fails gracefully without server crash
  * Invalid/unsupported language code falls back to default voice
  * Unknown gender parameter (e.g. "alien") falls back to default gender
  * Text consisting solely of punctuation characters (e.g. "???...!!!")
- Feature 5 Boundaries (F5 - REST STT):
  * Empty base64 string "" returns 400 Bad Request
  * Corrupt / invalid base64 string returns 400 Bad Request
  * Valid base64 encoding of non-audio random bytes returns 200 with success: false or 400
  * Audio with zero bytes / empty WAV header
  * Unsupported audio sample rate or unknown language code
- Feature 6 Boundaries (F6 - WebSocket Room Lifecycle):
  * Room ID with invalid characters (e.g. "<script>", spaces, "$#@!") rejected with 'error' event
  * Room ID shorter than 3 chars or longer than 32 chars rejected with 'error' event
  * Room capacity limit: 3rd client attempting to join full room receives 'room_full' event
  * Duplicate join_room event from same socket connection
  * DELETE /api/rooms/non_existent_room returns 200 with not_found status
- Feature 7 Boundaries (F7 - WebRTC Signaling):
  * Signaling event (webrtc_offer) sent before joining room dropped safely without crashing
  * Signaling sent when no peer is connected dropped safely
  * Signaling payload with missing or malformed SDP structure
  * Huge SDP payload (>10KB) relayed without truncation or crash
  * toggle_mute sent before join_room handled safely
- Feature 8 Boundaries (F8 - Speech Segment Pipeline):
  * Speech segment sent when caller is muted (isMuted: true) is dropped silently
  * Rate limiting: sending >5 speech segments within 3 seconds triggers 'speech_error'
  * Speech segment with text exceeding 1000 chars is capped to 1000 chars
  * Speech segment with empty text "" dropped or rejected
  * Speech segment sent after peer disconnects routes safely (or falls back to simulator)
- Feature 9 Boundaries (F9 - Domain Jargon Lock):
  * Non-existent domain (e.g. "astronomy") falls back to "general" domain
  * Text already containing double bracket tokens [[existing]] preserved without double-escaping
  * Multiple different domain terms in single sentence all preserved correctly
  * Case variation of domain terms (e.g. "ebitda" vs "EBITDA") matches and protects
  * Sentence where domain term is part of another word (boundary word matching)
- Feature 10 Boundaries (F10 - Prosody & Intent):
  * Consecutive identical words deduplicated (e.g. "stop stop stop stop" -> deduplicated)
  * Multi-word phrase loop deduplicated (e.g. "thank you thank you thank you" -> deduplicated)
  * Interrogative phrase without question mark receives '?' and intent "question"
  * Exclamatory phrase without exclamation mark receives '!' and intent "exclamation"
  * Pure whitespace or symbol-only utterances handled without crash
- Feature 11 Boundaries (F11 - Fallback Resilience):
  * Language with no primary neural voice falls back to secondary neural or gTTS
  * Rapid language updates ('update_language') in quick succession
  * Client disconnect mid-pipeline does not leave dangling socket tasks
  * Ping check sent with null or malformed data receives ACK
  * Disconnect and reconnect under the same userId replaces stale socket cleanly
- Feature 12 Boundaries (F12 - Call Simulator):
  * Solo simulator: speech segment with isMuted: true is dropped silently
  * Solo simulator: speech segment rate limiting triggers 'speech_error' on 6th rapid segment
  * POST /api/minutes with empty transcript [] returns valid empty/minimal minutes structure
  * POST /api/minutes with invalid tier defaults cleanly
  * Room deletion of active simulator room terminates room and clears state

EXECUTION & VERIFICATION:
1. Run `python -m pytest tests/e2e/test_tier2_boundaries.py -v`
2. Run `python run_e2e.py --tier 2 -v`
3. Verify that all 60 tests pass cleanly.
4. Write `handoff.md` in your state folder with execution commands, passing test outputs, and clear documentation.
5. Notify the parent orchestrator via `send_message`.
