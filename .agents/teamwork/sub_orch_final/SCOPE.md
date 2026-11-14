# Scope: Final Milestone — E2E Test Pass & Adversarial Hardening

## Architecture
- **Backend**: FastAPI + Socket.IO server (`backend/main.py`, `backend/socket_handlers.py`), services (`translator.py`, `tts.py`, `prosody_engine.py`, `glossary.py`).
- **Frontend**: React 18 + Vite (`frontend/src/App.jsx`, `frontend/src/components/*`, `frontend/src/hooks/*`, `frontend/src/utils/*`).
- **E2E Test Infrastructure**: `run_e2e.py`, `tests/e2e/harness.py`, `tests/e2e/conftest.py`, `tests/e2e/test_tier1_core.py`, `test_tier2_boundaries.py`, `test_tier3_combinations.py`, `test_tier4_scenarios.py`.

## Phases & Deliverables
### Phase 1: 100% E2E Test Suite Pass (Tiers 1-4)
- Verification of 146 E2E tests:
  - Infra: 6 tests
  - Tier 1 (Core): 60 tests
  - Tier 2 (Boundaries): 60 tests
  - Tier 3 (Combinations): 14 tests
  - Tier 4 (Scenarios): 6 tests
- Verification of 77 Backend Unit Tests (`pytest`).
- Verification of 71 Frontend Unit Tests (`npm --prefix frontend test`).
- Verification of Frontend Production Build (`npm --prefix frontend run build`).

### Phase 2: Adversarial Coverage Hardening (Tier 5)
- Spawn 2 Challengers (`teamwork_challenger`) to white-box audit the implementation and test suites:
  - Audit unexercised paths, race conditions, edge combinations (malformed websocket frames, invalid Unicode surrogates, rapid reconnect loops, audio truncation, concurrency bursts).
  - Produce Tier 5 adversarial tests (`tests/e2e/test_tier5_adversarial.py`).
- Spawn Worker (`teamwork_worker`) if fixes or integration are required.
- Spawn 2 Reviewers (`teamwork_reviewer`) to verify correctness, test passing, and code quality.
- Spawn Forensic Auditor (`teamwork_auditor`) to verify implementation integrity.
- Gate Check: Strict AND (Reviewers APPROVE, Challengers APPROVE, Auditor CLEAN).
- Sub-Orchestrator Handoff to parent.
