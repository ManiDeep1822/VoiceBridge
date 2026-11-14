# Scope: Milestone 3 — Reproduction Tests & Documentation Synchronization

## Architecture & Context
Milestone 1 delivered backend infrastructure fixes (pytest config, requirements, `__init__.py`, import isolation, SPA fallback, global 27-language TTS voice map).
Milestone 2 delivered frontend logic, audio pipeline, and UI remediation (Hindi regex fix, domain socket parameter forwarding, fallback TTS target language routing, Firefox download anchor fix, branding cleanup, package tooling, legacy component archival).

Milestone 3 consolidates, validates, and synchronizes the reproduction and regression test suite across backend and frontend, and updates the repository documentation (`README.md`) to reflect exact current test counts and commands.

## Feature Inventory
| # | Feature / Work Item | Description | Target Files | Status | Source |
|---|---------------------|-------------|--------------|:------:|--------|
| 1 | Hindi intent & prosody reproduction tests | Comprehensive unit tests for Hindi intent detection ('जल्दी', etc.) and prosody rules. | `frontend/tests/prosody.test.js` | DONE | M2 defect / M3 spec |
| 2 | Global Edge-TTS 27-language voice test | Unit tests verifying all 27 languages (female/male) in `VOICE_MAP` and normalization logic. | `backend/tests/test_tts.py` | DONE | M1 defect / M3 spec |
| 3 | WebSocket speech_segment domain preservation test | Unit test verifying `domain` parameter in `speech_segment` is preserved and passed to glossary engine. | `backend/tests/test_sockets.py` | DONE | M2 defect / M3 spec |
| 4 | Direct package import test | Unit test asserting `import backend.socket_handlers`, `import backend.main`, and `import main` succeed cleanly. | `backend/tests/test_imports.py` | DONE | M1 defect / M3 spec |
| 5 | Documentation synchronization | Update `README.md` (specifically lines 72 & 79 and any other obsolete counts/commands) to exact current counts and execution instructions. | `README.md` | DONE | M3 spec / Survey #15 |
| 6 | Root & Subdirectory test portability | Verify tests pass 100% from root (`pytest`, `npm --prefix frontend test`) and from subdirectories (`cd backend; pytest`, `cd frontend; npm test`). | Entire repo / test suites | DONE | M3 spec |

## Interface Contracts & Constraints
- Backend test runner: `pytest` executed from root or `backend/` must run 100% green without warnings or failures. (VERIFIED: 77 passed)
- Frontend test runner: `node --test` / `npm test` executed from root or `frontend/` must run 100% green. (VERIFIED: 71 passed)
- `README.md` must accurately reflect actual test counts and exact working commands. (VERIFIED: 77 backend, 71 frontend)
- Karpathy principles: Surgical changes, no unnecessary modifications, zero flakiness. (VERIFIED)

## Milestones / Iteration Plan
- Iteration 1:
  - 3 Explorers: Explorer 1 (Backend tests), Explorer 2 (Frontend tests), Explorer 3 (Documentation & test counts) -> COMPLETE
  - Synthesis & Worker Dispatch -> COMPLETE
  - 2 Reviewers, 2 Challengers, 1 Forensic Auditor -> ALL APPROVE / CLEAN
  - Gate evaluation: **PASS**
