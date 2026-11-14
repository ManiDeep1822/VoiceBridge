# Test Infrastructure Specification: VoiceBridge Opaque-Box E2E Test Suite

**Document Version**: 1.0.0  
**Status**: ACTIVE  
**Scope**: End-to-End (E2E) Test Framework, Harness, and 4-Tier Test Architecture  
**Author**: E2E Test Writer (`test_writer_e2e_m1`)  
**Target Environment**: Python 3.13+, FastAPI, python-socketio, uvicorn, pytest, Windows / POSIX  

---

## 1. Test Philosophy

The VoiceBridge E2E test suite adheres to strict **opaque-box testing principles**:

1. **Zero Internal Coupling**:
   - Tests have zero dependency on internal implementation classes, functions, or in-memory globals (e.g. `rooms`, `sid_to_room`, `_TRANSLATION_CACHE`, `translate_text`, `synthesize_speech`).
   - The system under test (SUT) is treated exclusively as an external black-box network service accessible via HTTP REST endpoints (`http://127.0.0.1:{port}/api/...`) and Socket.IO WebSocket transport (`ws://127.0.0.1:{port}/socket.io/...`).
2. **Requirement-Driven Expectations**:
   - All expected outputs and validation assertions are derived from documented specifications in `PROJECT.md`, `SCOPE.md`, `spec_report.md`, and `ORIGINAL_REQUEST.md`.
   - Facade tests, dummy mocks of system endpoints, or tests designed to match arbitrary bug artifacts are strictly prohibited.
3. **Complete Test Isolation & Concurrency Safety**:
   - The test server runs on an OS-allocated ephemeral port (`port=0`), eliminating port conflict across test runs or concurrent services.
   - Each test scenario uses cryptographically unique room identifiers (e.g. `room_{uuid4().hex[:8]}`) and unique client identities, ensuring zero state leakage across test cases.
4. **Deterministic Asynchronous Coordination**:
   - No hardcoded `time.sleep()` calls for event awaiting.
   - All event expectations utilize asynchronous event queues with deterministic timeout guards (`wait_for_event(event_name, timeout)`), ensuring rapid execution when conditions are met and actionable error messages upon timeout.

---

## 2. Test Methodology

The test suite systematically applies four complementary software testing methodologies:

### 2.1 Category-Partition Method
Input spaces across all REST payloads and Socket.IO events are decomposed into functional categories and equivalence partitions:
- **String Inputs**: Valid strings, empty strings (`""`), whitespace-only (`"   "`), overlong strings ($>1000$ characters), special characters (`<>&"'/`), Indic Unicode scripts (Telugu, Hindi, Tamil), emoji symbols.
- **Identifiers**: Conforming regex (`^[a-zA-Z0-9_-]{3,32}$`), non-conforming short ($<3$ chars), non-conforming long ($>32$ chars), illegal characters (spaces, punctuation, `@`, `$`).
- **Language Codes**: Valid ISO-639-1 (`"en"`, `"te"`, `"hi"`), valid BCP-47 (`"en-US"`, `"te-IN"`), unsupported codes (`"xx"`, `"klingon"`), None/missing.
- **Audio Payloads**: Valid 16-bit mono 16kHz PCM WAV, corrupt Base64 strings, empty Base64 payloads.

### 2.2 Boundary Value Analysis (BVA)
Tests probe exact operational thresholds:
- **Room Capacity**: Exactly 1 caller (Solo / Waiting), exactly 2 callers (Paired WebRTC / P2P), 3rd caller (Rejection: `room_full`).
- **Text Length**: 0 chars (HTTP 400), 1 char, 999 chars, 1000 chars (processed), 1001 chars (surgically capped to 1000).
- **Room ID Regex**: 2 chars (rejected), 3 chars (accepted), 32 chars (accepted), 33 chars (rejected).
- **Rate Limiting**: $\le 5$ speech segments per 3-second sliding window (processed), 6th speech segment within 3 seconds (rejected with `speech_error`).

### 2.3 Pairwise Combinatorial Testing
Tests combinations of key system parameters to uncover multi-dimensional edge cases:
- Source Language $\times$ Target Language $\times$ Domain $\times$ Voice Gender $\times$ Speaker Intent.
- Caller Mute State $\times$ Speaking State $\times$ Room Capacity $\times$ Disconnect Sequence.

### 2.4 Workload & Scenario Testing
Tests realistic multi-step user journeys:
- Two-user bilingual teleconference from room entry, WebRTC negotiation, bidirectional dialogue, speaking state visualizers, to call departure.
- Solo Simulator mode verifying loopback speech-to-speech translation for single-user rehearsals.
- Call history generation, meeting minutes synthesis (`POST /api/minutes`), and transcript export validation (JSON, CSV, Markdown, WAV).

---

## 3. Feature Inventory (F1 – F12)

| Feature ID | Feature Name | Primary Endpoint / Interface | Description |
|------------|--------------|------------------------------|-------------|
| **F1** | System Health & Info | `GET /api/health` | Service liveness, status string, and active supported languages list. |
| **F2** | Language Registry | `GET /api/health`, frontend map | Language coverage (27 languages), code normalization, regional voices. |
| **F3** | REST Translation API | `POST /api/translate` | Multi-language translation, fallback engines, 1000-char truncation, same-lang bypass. |
| **F4** | REST Neural TTS Audio API | `POST /api/tts` | Edge-TTS neural speech synthesis, gender mapping, MP3 Base64 payload, error fallback. |
| **F5** | REST STT Audio API | `POST /api/stt` | Server-side Speech-to-Text fallback, Base64 WAV decoding, error response format. |
| **F6** | WebSocket Room Lifecycle | `join_room`, `leave_room`, `disconnect`, `DELETE /api/rooms/{id}`, `GET /api/rooms` | Room capacity (max 2), regex validation, state cleanup, admin deletion. |
| **F7** | WebRTC Signaling Relays | `webrtc_offer`, `webrtc_answer`, `webrtc_ice_candidate` | Transparent SDP and ICE candidate relaying between paired room peers. |
| **F8** | Live Speech Segment Pipeline | `speech_segment` | Ingestion of speech text, slang normalization, intent classification, jargon lock, translation, neural audio synthesis, and broadcast. |
| **F9** | Domain Jargon Lock | `POST /api/glossary`, `GET /api/glossary`, glossary engine | Enterprise terminology protection (`[[TERM]]`) across 6 domains (medical, legal, fintech, defense, engineering, general). |
| **F10** | Prosody & Intent Analysis | Prosody Engine, `toggle_mute`, `speaking_state` | Conversational slang normalization, loop deduplication, intent punctuation (`?`, `!`, `.`), mute floor control. |
| **F11** | Fallback & Resilience | Rate limiter, TTS fallback, translation fallback, corrupt audio handling | Resilience under rate bursts (>5/3s), engine timeouts, missing audio fallbacks, malformed payloads. |
| **F12** | Live Call Sessions & Call Simulator | Multi-user calls, Solo Simulator, `POST /api/minutes`, export logs | Full bilingual call dialogues, single-user simulator loopback, meeting minutes synthesis, transcript export formats. |

---

## 4. Test Architecture & Harness

### 4.1 Component Directory Structure
```
tests/e2e/
├── __init__.py                # Package declaration
├── conftest.py                # Pytest fixtures, live server lifecycle, HTTP/Socket clients
├── harness.py                 # LiveServerProcess, AsyncTestSocketClient, audio generators
├── test_infra_sanity.py       # Infrastructure & harness self-verification tests
├── test_tier1_core.py         # Tier 1: Core Feature Happy Paths (M2)
├── test_tier2_boundaries.py   # Tier 2: Boundaries, Edge Cases & Resilience (M2)
├── test_tier3_combinations.py # Tier 3: Cross-Feature Interactions & Pipelines (M3)
└── test_tier4_scenarios.py    # Tier 4: Real-World Scenarios & Workloads (M3)
```

### 4.2 Test Runner: `run_e2e.py`
Located at the workspace root, `run_e2e.py` provides single-command execution with formatted tier summaries:
```bash
# Execute entire E2E test suite
python run_e2e.py

# Execute specific tiers
python run_e2e.py --tier 1
python run_e2e.py --tier 2
python run_e2e.py --tier 3
python run_e2e.py --tier 4

# Run with keyword filter or verbosity
python run_e2e.py -k "health" -v

# Standard pytest invocation also supported
pytest tests/e2e -v
```

### 4.3 Pass / Fail Semantics
- **Exit Code `0`**: 100% of collected tests passed cleanly.
- **Exit Code Non-Zero**: At least one test failure, assertion error, timeout, or uncaught exception.
- Structured execution summary is printed to stdout detailing test counts and status per tier.

### 4.4 Live Server Fixture (`conftest.py` & `harness.py`)
- **`LiveServerProcess`**: Spawns FastAPI + Socket.IO in a dedicated background `multiprocessing.Process` on an ephemeral localhost port.
- **Health Polling**: Before yielding to tests, polls `http://127.0.0.1:{port}/api/health` with a 15-second deadline until HTTP 200 is received.
- **Teardown**: Sends `terminate()`, waits up to 3.0s, and issues `kill()` if necessary, preventing orphaned processes.
- **Auto-Resource Cleanup**: `conftest.py` maintains an active registry of all opened HTTP clients and Socket.IO connections, automatically disconnecting and closing them inside the test loop before teardown.

### 4.5 Socket.IO Test Client (`AsyncTestSocketClient`)
- Wraps `socketio.AsyncClient` with dedicated `asyncio.Queue` event dispatchers.
- Listens for all known server events (`waiting_for_peer`, `peer_connected`, `peer_disconnected`, `peer_incoming_text`, `translated_audio`, `speech_delivered`, `speech_error`, `error`, `room_full`, `room_terminated`, etc.).
- Exposes async awaiting methods:
  - `await client.wait_for_event(event_name, timeout=5.0)`
  - `await client.wait_for_event_matching(event_name, predicate, timeout=5.0)`
  - `await client.emit_with_ack(event, data, timeout=5.0)`
- Tracks full event history: `client.get_events(event_name)`.

### 4.6 Audio Generation Helpers
- `create_synthetic_wav(duration_ms, sample_rate, frequency_hz)`: Generates valid 16-bit mono PCM WAV bytes.
- `generate_base64_audio(duration_ms)`: Generates Base64-encoded valid WAV audio.
- `create_corrupt_base64_audio()`: Generates invalid Base64 payload for testing decoder resilience.

---

## 5. Coverage Thresholds & Target Test Allocations

| Tier | Category | Minimum Required | Planned Target | Feature Allocation |
|------|----------|------------------|----------------|-------------------|
| **Tier 1** | Core Feature Happy Paths | $\ge 5$ per feature | **60 tests** | F1: 5, F2: 5, F3: 5, F4: 5, F5: 5, F6: 5, F7: 5, F8: 5, F9: 5, F10: 5, F11: 5, F12: 5 |
| **Tier 2** | Boundaries, Corners & Resilience | $\ge 5$ per feature | **60 tests** | F1: 5, F2: 5, F3: 5, F4: 5, F5: 5, F6: 5, F7: 5, F8: 5, F9: 5, F10: 5, F11: 5, F12: 5 |
| **Tier 3** | Cross-Feature Interactions | $\ge 12$ tests | **12 tests** | Combinatorial pipelines: Slang + Jargon + Translation + TTS; Dynamic Lang Update; Rate Limits; Admin Termination |
| **Tier 4** | Real-World Application Scenarios | $\ge 6$ tests | **6 tests** | Full 2-Party Dialogue; Solo Simulator; Meeting Minutes; JSON/CSV/MD Export Pipelines |
| **Total** | **Full E2E Suite** | **$\ge 138$ tests** | **138 tests** | Comprehensive 4-tier opaque-box test coverage |

---

## 6. Tier 1: Core Feature Happy Paths ($\ge 60$ Tests)

Each feature F1 through F12 has at least 5 dedicated happy path test cases:

- **F1: System Health & Info (5 tests)**
  - `test_t1_f1_health_status_200`: `GET /api/health` returns status code 200.
  - `test_t1_f1_health_payload_schema`: Response contains `"status": "healthy"` and `"service"`.
  - `test_t1_f1_health_supported_languages_list`: Response contains non-empty `"supported_languages"` array.
  - `test_t1_f1_health_contains_core_languages`: Array includes `"en"`, `"te"`, `"hi"`.
  - `test_t1_f1_rooms_endpoint_initial_state`: `GET /api/rooms` returns status 200 with integer `"total_rooms"` and dict `"rooms"`.

- **F2: Language Registry & Voices (5 tests)**
  - `test_t1_f2_global_languages_present`: Supported languages list contains at least 9 Indian languages.
  - `test_t1_f2_global_tier_languages_present`: Supported languages includes global languages (es, fr, de, ja, zh, ar).
  - `test_t1_f2_bcp47_and_iso_codes_accepted`: Language parameters accept both ISO codes (`"te"`) and BCP-47 (`"te-IN"`).
  - `test_t1_f2_glossary_registry_contains_domains`: `GET /api/glossary` returns list of domain descriptors.
  - `test_t1_f2_glossary_domain_fields`: Domain descriptors contain `id`, `name`, `description`, `termsCount`.

- **F3: REST Translation API (5 tests)**
  - `test_t1_f3_translate_en_to_hi`: English to Hindi translation returns status 200 and translated text.
  - `test_t1_f3_translate_te_to_en`: Telugu to English translation returns status 200 and translated text.
  - `test_t1_f3_translate_response_fields`: Response JSON contains `original`, `translated`, `source_lang`, `target_lang`, `domain`.
  - `test_t1_f3_translate_same_language_bypass`: Translating with `source_lang == target_lang` returns original text cleanly.
  - `test_t1_f3_translate_with_domain`: Translating with valid domain (e.g. `"medical"`) executes successfully.

- **F4: REST Neural TTS Audio API (5 tests)**
  - `test_t1_f4_tts_hindi_female`: `POST /api/tts` with Hindi female returns Base64 MP3 audio.
  - `test_t1_f4_tts_english_male`: `POST /api/tts` with English male returns Base64 MP3 audio.
  - `test_t1_f4_tts_telugu_female`: `POST /api/tts` with Telugu female returns Base64 MP3 audio.
  - `test_t1_f4_tts_response_structure`: Response JSON contains `audio_base64`, `format`: `"mp3"`, `target_lang`, `gender`.
  - `test_t1_f4_tts_audio_valid_bytes`: Decoded `audio_base64` is non-empty binary audio data ($>1000$ bytes).

- **F5: REST STT Audio API (5 tests)**
  - `test_t1_f5_stt_valid_audio_response_200`: `POST /api/stt` with valid WAV Base64 returns status 200.
  - `test_t1_f5_stt_response_schema`: Response JSON contains `transcript`, `language`, `success`.
  - `test_t1_f5_stt_english_language_code`: `language: "en"` maps to English transcription.
  - `test_t1_f5_stt_telugu_language_code`: `language: "te"` maps to Telugu transcription.
  - `test_t1_f5_stt_tempfile_cleanup`: STT execution does not leave orphaned files in working directory.

- **F6: WebSocket Room Lifecycle (5 tests)**
  - `test_t1_f6_join_room_waiting_for_peer`: First client to join receives `waiting_for_peer`.
  - `test_t1_f6_join_room_peer_connected`: Second client to join triggers `peer_connected` on both clients.
  - `test_t1_f6_initiator_flag_assignment`: First client receives `isInitiator: true`, second receives `isInitiator: false`.
  - `test_t1_f6_leave_room_peer_disconnected`: Client emitting `leave_room` causes other client to receive `peer_disconnected`.
  - `test_t1_f6_disconnect_cleanup`: Client severing WebSocket connection triggers `peer_disconnected` on remaining peer.

- **F7: WebRTC Signaling Relays (5 tests)**
  - `test_t1_f7_relay_webrtc_offer`: Client A emits `webrtc_offer`; Client B receives identical payload.
  - `test_t1_f7_relay_webrtc_answer`: Client B emits `webrtc_answer`; Client A receives identical payload.
  - `test_t1_f7_relay_webrtc_ice_candidate`: Client A emits `webrtc_ice_candidate`; Client B receives candidate.
  - `test_t1_f7_relay_preserves_sdp_integrity`: SDP string inside offer/answer is relayed without corruption.
  - `test_t1_f7_multiple_candidates_streamed`: Sequential ICE candidates are relayed in arrival order.

- **F8: Live Speech Segment Pipeline (5 tests)**
  - `test_t1_f8_speech_segment_triggers_incoming_speech`: Peer receives `peer_incoming_speech` notification.
  - `test_t1_f8_speech_segment_delivers_subtitles`: Peer receives `peer_incoming_text` with translated subtitles.
  - `test_t1_f8_speech_segment_delivers_delivery_receipt`: Speaker receives `speech_delivered` confirmation.
  - `test_t1_f8_speech_segment_delivers_neural_audio`: Peer receives `translated_audio` with Base64 audio payload.
  - `test_t1_f8_speech_segment_bilingual_translation`: Telugu speech segment produces Hindi text and audio for Hindi peer.

- **F9: Domain Jargon Lock (5 tests)**
  - `test_t1_f9_glossary_inspection_endpoint`: `POST /api/glossary` with domain returns terms snapshot.
  - `test_t1_f9_glossary_medical_sample_terms`: Medical domain includes `"myocardial infarction"`, `"tachycardia"`.
  - `test_t1_f9_glossary_legal_sample_terms`: Legal domain includes `"force majeure"`, `"indemnification"`.
  - `test_t1_f9_glossary_fintech_sample_terms`: FinTech domain includes `"EBITDA"`, `"liquidity pool"`.
  - `test_t1_f9_glossary_engineering_sample_terms`: Engineering domain includes `"circuit breaker pattern"`.

- **F10: Prosody & Intent Analysis (5 tests)**
  - `test_t1_f10_question_intent_detection`: English question receives terminal `?` and `intent: "question"`.
  - `test_t1_f10_exclamation_intent_detection`: Urgent phrase receives terminal `!` and `intent: "exclamation"`.
  - `test_t1_f10_statement_intent_default`: Regular declarative sentence receives terminal `.` and `intent: "statement"`.
  - `test_t1_f10_speaking_state_broadcast`: Emitting `speaking_state` broadcasts `peer_speaking_state` to peer.
  - `test_t1_f10_mute_toggle_broadcast`: Emitting `toggle_mute` broadcasts `peer_mute_changed` to peer.

- **F11: Fallback & Resilience (5 tests)**
  - `test_t1_f11_ping_check_ack`: Telemetry `ping_check` receives valid ACK dictionary.
  - `test_t1_f11_unsupported_voice_fallback`: TTS with unsupported voice code falls back to default voice.
  - `test_t1_f11_tts_invalid_gender_fallback`: TTS with unrecognized gender falls back to `"female"`.
  - `test_t1_f11_empty_minutes_transcript_graceful`: `POST /api/minutes` with empty transcript returns 200 default summary.
  - `test_t1_f11_admin_delete_nonexistent_room`: `DELETE /api/rooms/{id}` for missing room returns `{"status": "not_found"}`.

- **F12: Live Call Sessions & Call Simulator (5 tests)**
  - `test_t1_f12_solo_simulator_mode`: Single user in room emits `speech_segment` and receives loopback subtitle.
  - `test_t1_f12_solo_simulator_audio_loopback`: Single user receives `translated_audio` with `isSolo: true`.
  - `test_t1_f12_solo_simulator_speaker_id`: Solo subtitle has speakerId `"Simulator ({target_lang})"`.
  - `test_t1_f12_minutes_generation_pro_tier`: `POST /api/minutes` produces executive minutes structure.
  - `test_t1_f12_minutes_action_items_and_decisions`: Executive minutes include `decisions` and `action_items` arrays.

---

## 7. Tier 2: Boundaries, Edge Cases & Resilience ($\ge 60$ Tests)

- **F1: System Health Boundaries (5 tests)**
  - `test_t2_f1_head_request_health`: `HEAD /api/health` returns status 200 without body.
  - `test_t2_f1_unsupported_http_method`: `POST /api/health` returns HTTP 405 Method Not Allowed.
  - `test_t2_f1_rooms_snapshot_after_calls`: `GET /api/rooms` accurately reflects active and vacated rooms.
  - `test_t2_f1_api_nonexistent_route_404_json`: `GET /api/nonexistent` returns HTTP 404 JSON, NOT index HTML.
  - `test_t2_f1_api_languages_discrepancy_handled`: Requesting `GET /api/languages` handled gracefully as 404.

- **F2: Language Registry Boundaries (5 tests)**
  - `test_t2_f2_whitespace_language_code`: Translation with language code `"  "` falls back safely.
  - `test_t2_f2_uppercase_language_code`: Language code `"EN"` or `"TE-in"` normalizes without error.
  - `test_t2_f2_unsupported_language_passthrough`: Unsupported language code (e.g. `"xx"`) handled gracefully.
  - `test_t2_f2_null_language_field`: Omitted language field defaults safely to `"te"` / `"hi"`.
  - `test_t2_f2_glossary_invalid_domain_name`: Requesting unknown domain snapshot returns default dictionary.

- **F3: REST Translation Boundaries (5 tests)**
  - `test_t2_f3_empty_string_rejected`: `POST /api/translate` with `text: ""` returns HTTP 400.
  - `test_t2_f3_whitespace_only_rejected`: `POST /api/translate` with `text: "   "` returns HTTP 400.
  - `test_t2_f3_1000_char_boundary_accepted`: Text with exactly 1000 characters succeeds.
  - `test_t2_f3_over_1000_char_truncated`: Text with 1200 characters is sliced to 1000 characters.
  - `test_t2_f3_special_characters_and_html`: Text with `<script>alert('xss')</script> & <html>` translates safely without HTML corruption.

- **F4: REST Neural TTS Boundaries (5 tests)**
  - `test_t2_f4_empty_text_rejected`: `POST /api/tts` with `text: ""` returns HTTP 400.
  - `test_t2_f4_whitespace_only_rejected`: `POST /api/tts` with `text: "   "` returns HTTP 400.
  - `test_t2_f4_emoji_only_text`: `POST /api/tts` with emojis `"😊🎉🔥"` does not crash XML/SSML synthesis.
  - `test_t2_f4_long_text_synthesis`: Text near 1000 characters synthesizes within dynamic timeout limit.
  - `test_t2_f4_xml_metacharacters`: Text containing `&`, `<`, `>`, `"`, `'` synthesizes without XML parse error.

- **F5: REST STT Audio Boundaries (5 tests)**
  - `test_t2_f5_empty_audio_rejected`: `POST /api/stt` with `audio_base64: ""` returns HTTP 400.
  - `test_t2_f5_whitespace_audio_rejected`: `POST /api/stt` with `audio_base64: "   "` returns HTTP 400.
  - `test_t2_f5_corrupt_base64_payload`: Corrupt Base64 returns `{"success": false, "transcript": ""}` with status 200.
  - `test_t2_f5_non_wav_binary_payload`: Base64-encoded arbitrary non-audio binary returns `success: false`.
  - `test_t2_f5_unsupported_stt_language`: Unsupported STT language code returns `success: false` without 500 error.

- **F6: WebSocket Room Boundaries (5 tests)**
  - `test_t2_f6_room_id_too_short`: `roomId` of 2 chars (`"ab"`) triggers `error` event; client not added.
  - `test_t2_f6_room_id_too_long`: `roomId` of 33 chars triggers `error` event; client not added.
  - `test_t2_f6_room_id_invalid_characters`: `roomId` containing spaces (`"room 123"`) or symbols (`"room#$"` triggers `error`.
  - `test_t2_f6_room_capacity_third_caller_rejected`: 3rd client entering room receives `room_full` event.
  - `test_t2_f6_same_user_reconnection`: Same `userId` reconnecting with new socket ID replaces old socket cleanly.

- **F7: WebRTC Signaling Boundaries (5 tests)**
  - `test_t2_f7_signal_without_peer_silently_dropped`: Client emitting `webrtc_offer` in 1-person room does not crash server.
  - `test_t2_f7_signal_after_peer_leaves`: Emitting answer after peer disconnects is dropped cleanly.
  - `test_t2_f7_malformed_sdp_payload`: Empty or non-dict `webrtc_offer` payload handled safely.
  - `test_t2_f7_cross_room_signal_isolation`: Signal emitted in Room A is never received by peers in Room B.
  - `test_t2_f7_ice_candidate_null_handling`: End-of-candidates null signal relays cleanly without exception.

- **F8: Speech Pipeline Boundaries (5 tests)**
  - `test_t2_f8_muted_speaker_speech_dropped`: When `isMuted: true`, `speech_segment` is silently discarded.
  - `test_t2_f8_empty_speech_text_dropped`: `speech_segment` with empty or whitespace text generates no subtitles or audio.
  - `test_t2_f8_rate_limit_exceeded_error`: Emitting $>5$ segments within 3s triggers `speech_error` ("Rate limit exceeded").
  - `test_t2_f8_peer_leaves_during_pipeline`: Peer disconnecting while TTS is synthesizing does not leak socket tasks.
  - `test_t2_f8_repetitive_stt_loops_deduplicated`: `"hello hello hello"` is deduplicated to `"hello"` before broadcast.

- **F9: Domain Jargon Lock Boundaries (5 tests)**
  - `test_t2_f9_jargon_lock_general_domain_passthrough`: In `"general"` domain, terms are translated without bracket locking.
  - `test_t2_f9_jargon_lock_case_insensitivity`: `"Heart Attack"`, `"HEART ATTACK"`, `"heart attack"` all lock to `[[myocardial infarction]]`.
  - `test_t2_f9_jargon_lock_word_boundary_precision`: `"attack"` alone is not locked as `"heart attack"`.
  - `test_t2_f9_jargon_lock_unmatched_domain_terms`: Ordinary words in specialized domain pass through unaltered.
  - `test_t2_f9_jargon_unpacking_restores_brackets`: Translated output never retains raw `[[` or `]]` bracket tokens.

- **F10: Prosody Boundaries & Slang (5 tests)**
  - `test_t2_f10_telugu_spoken_slang_normalization`: Spoken Telugu slang (`"వస్తన్నా"`) normalizes to conversational grammar (`"వస్తున్నాను"`).
  - `test_t2_f10_hindi_spoken_slang_normalization`: Hindi colloquial (`"जा रिया"`) normalizes to standard (`"जा रहे"`).
  - `test_t2_f10_english_spoken_slang_normalization`: English slang (`"gonna"`, `"wanna"`) normalizes to (`"going to"`, `"want to"`).
  - `test_t2_f10_indic_combining_marks_integrity`: Telugu/Hindi Unicode combining marks are preserved during regex matching.
  - `test_t2_f10_multiple_question_marks_cleaned`: Consecutive punctuation (`"????"`) cleaned to single `?`.

- **F11: System Resilience Boundaries (5 tests)**
  - `test_t2_f11_delete_room_empty_id_rejected`: `DELETE /api/rooms/ ` returns HTTP 400.
  - `test_t2_f11_admin_room_termination_broadcast`: Admin `DELETE /api/rooms/{id}` emits `room_terminated` to room participants.
  - `test_t2_f11_rapid_join_leave_cycles`: Client rapidly cycling join and leave events leaves room state consistent.
  - `test_t2_f11_simultaneous_room_switch`: Client switching from Room A to Room B cleans up Room A registration.
  - `test_t2_f11_tts_failure_falls_back_to_subtitles`: If neural audio synthesis fails, `peer_speech_ended` signals end of speech.

- **F12: Call Sessions Boundaries (5 tests)**
  - `test_t2_f12_solo_mode_repetitive_utterances`: Single user emitting rapid solo utterances receives ordered loopback subtitles.
  - `test_t2_f12_solo_mode_to_p2p_transition`: Room operating in Solo mode transitions seamlessly to P2P when peer connects.
  - `test_t2_f12_p2p_to_solo_mode_transition`: Room operating in P2P mode transitions to Solo loopback when peer departs.
  - `test_t2_f12_minutes_malformed_utterance_objects`: `POST /api/minutes` with missing utterance keys handles missing fields gracefully.
  - `test_t2_f12_minutes_enterprise_tier`: `POST /api/minutes` with `tier: "enterprise"` generates enterprise briefing.

---

## 8. Tier 3: Cross-Feature Combinations ($\ge 12$ Tests)

Combinatorial tests verifying seamless interoperability across multiple sub-systems:

- `test_t3_01_slang_jargon_translate_tts_pipeline`: Spoken slang Telugu utterance containing medical term undergoes slang normalization $\rightarrow$ domain jargon lock $\rightarrow$ translation $\rightarrow$ Edge-TTS $\rightarrow$ broadcast.
- `test_t3_02_dynamic_language_update_active_call`: Peer A updates language mid-call; Peer B receives `peer_language_updated`; subsequent `speech_segment` translates into newly chosen language.
- `test_t3_03_same_language_bypass_with_tts`: When both peers speak English, translation engine is bypassed (0ms passthrough) while neural audio is synthesized and broadcast.
- `test_t3_04_admin_room_termination_disconnects_active_call`: Active 2-person call is terminated by Admin HTTP DELETE; both clients receive `room_terminated` and room is purged from `GET /api/rooms`.
- `test_t3_05_rate_limit_resets_after_window`: Burst of 6 utterances triggers `speech_error` on 6th; waiting 3.1s allows 7th utterance to process successfully.
- `test_t3_06_speaking_state_and_speech_segment_coordination`: Emitting `speaking_state: true`, followed by `speech_segment`, followed by `speaking_state: false` produces ordered HUD visualizer events.
- `test_t3_07_mute_state_prevents_subtitles_and_audio`: Emitting `toggle_mute: true` completely blocks subtitles, delivery receipts, and audio for subsequent utterances until unmuted.
- `test_t3_08_webrtc_renegotiation_after_language_change`: Updating language mid-call does not disrupt ongoing WebRTC signaling relays.
- `test_t3_09_multi_room_cross_talk_isolation`: Two separate rooms running concurrent translations with identical user names do not leak subtitles or audio across rooms.
- `test_t3_10_jargon_lock_across_all_five_enterprise_domains`: Parallel translations across legal, fintech, defense, engineering, and medical domains simultaneously preserve domain tokens.
- `test_t3_11_stt_transcription_piped_into_speech_segment`: Audio uploaded to `POST /api/stt` yields transcript that is fed into WebSocket `speech_segment` producing verified translated audio.
- `test_t3_12_solo_simulator_with_domain_and_prosody`: Solo simulator utterance with urgent slang and fintech terminology exercises full loopback pipeline.

---

## 9. Tier 4: Real-World Workloads & Scenarios ($\ge 6$ Tests)

Comprehensive end-to-end user journeys mirroring production teleconference operations:

- `test_t4_01_full_bilingual_call_session`:
  - Client A (Telugu) and Client B (Hindi) join room `vox-call-scenario-1`.
  - Client A receives `waiting_for_peer`; Client B triggers `peer_connected` on both.
  - WebRTC offer, answer, and ICE candidate exchange completes.
  - Client A speaks in Telugu: *"నమస్కారం, మీరు బాగున్నారా?"*.
  - Client B receives instant Hindi subtitle: *"नमस्ते, क्या आप ठीक हैं?"* and neural MP3 audio.
  - Client B replies in Hindi: *"हाँ, मैं ठीक हूँ। धन्यवाद।"*.
  - Client A receives Telugu subtitle: *"అవును, నేను బాగున్నాను. ధన్యవాదాలు."* and neural MP3 audio.
  - Both clients cleanly leave room and verify room termination.
- `test_t4_02_solo_simulator_practice_session`:
  - Solo user enters call simulator room to test speech translation.
  - Speaks sequential utterances in English.
  - Receives instant loopback subtitles and accelerated audio with `isSolo: true`.
  - Verifies simulated dialogue flow and audio playback markers.
- `test_t4_03_teleconference_meeting_minutes_pipeline`:
  - Generates multi-turn bilingual conversation between two participants.
  - Compiles transcript log into structured JSON payload.
  - Submits transcript to `POST /api/minutes`.
  - Verifies generated executive briefing: total utterances, identified speakers, executive summary, decisions, action items with priorities, and sentiment score.
- `test_t4_04_transcript_export_formats_validation`:
  - Simulates active teleconference session accumulating transcript history.
  - Validates JSON export structure (`voxsynapse-call-log-{ts}.json` schema).
  - Validates CSV export generation (`VoiceBridge_Call_History_{ts}.csv` schema).
  - Validates Markdown export structure (`voxsynapse-call-{ts}.md` format).
- `test_t4_05_reconnection_and_peer_recovery_scenario`:
  - Two users are in an active teleconference call.
  - User B simulates a browser page refresh (disconnects socket and reconnects with new socket ID under the same `userId`).
  - System evicts stale socket, pairs User B back with User A without exceeding capacity, and resumes bidirectional translation dialogue.
- `test_t4_06_high_density_conversational_burst_scenario`:
  - Two callers conduct rapid conversational exchange with alternating PTT bursts.
  - Verifies pipeline delivers all in-pace subtitles and audio payloads without dropped packets or corrupted speech ordering.

---

## 10. Verification & Quality Gates

The test infrastructure and subsequent test tiers are validated through the following independent commands:

1. **Self-Verification of Test Infrastructure**:
   ```bash
   pytest tests/e2e/test_infra_sanity.py -v
   ```
   *Pass Criteria*: All 4 sanity tests pass cleanly in $<5$ seconds.
2. **Unified E2E Runner Verification**:
   ```bash
   python run_e2e.py
   ```
   *Pass Criteria*: Runner streams live output, prints structured tier summary table, and exits with return code `0`.
3. **Backend Non-Regression Gate**:
   ```bash
   pytest backend/tests
   ```
   *Pass Criteria*: Existing backend unit tests pass without regression.
4. **Invalidation Conditions**:
   - Modifying REST route URLs or request/response models without synchronizing `spec_report.md` and `TEST_INFRA.md`.
   - Modifying `ROOM_ID_REGEX` or room capacity rules in `backend/socket_handlers.py`.
   - Altering the payload format for Socket.IO events (`speech_segment`, `peer_incoming_text`, `translated_audio`).
