# Scope: Milestone 2 — Frontend Logic, Audio Pipeline & UI Remediation

## Architecture
- Frontend React 18 / Vite application located in `frontend/`.
- Utils: `frontend/src/utils/prosodyEngine.js` (text normalization and prosodic intent detection).
- Hooks: `frontend/src/hooks/useWebRTC.js` (WebRTC signaling, Socket.IO speech_segment emission).
- Components: `frontend/src/App.jsx`, `frontend/src/components/UserDashboard/UserDashboard.jsx`, `frontend/src/components/AdminDashboard.jsx`, `frontend/src/components/MinutesDrawer.jsx`, `frontend/src/components/ErrorBoundary.jsx`.
- Tooling: `frontend/package.json`.
- Legacy files archived: `frontend/src/legacy/` (`CallStage.jsx`, `TacticalHeader.jsx`, `ToastContainer.jsx`, `TranscriptHUD.jsx`, `AdminLogin.jsx`, `UserLogin.jsx`, `fastTranslator.js`).

## Feature Inventory
| # | Feature / Issue | Description | Milestone | Source |
|---|-----------------|-------------|-----------|--------|
| 7 | Hindi Exclamation Regex Bug | Stray space before regex flags in `frontend/src/utils/prosodyEngine.js:68` prevents Hindi urgent phrases (e.g., "जल्दी") from matching exclamation intent. | M2 | PROJECT.md |
| 8 | Domain Jargon Lock WebSocket Bypass | `activeDomain` not passed in `speech_segment` from `App.jsx:248` & `useWebRTC.js:298`, causing backend Jargon Lock to always default to general. | M2 | PROJECT.md |
| 9 | Fallback TTS Language Mismatch | `frontend/src/App.jsx:305, 311` passes `localLanguage` instead of `targetLang` to fallback Web Speech synthesis. | M2 | PROJECT.md |
| 10 | Dashboard Export Anchor Bug | `UserDashboard.jsx:154` and `AdminDashboard.jsx:126` trigger `a.click()` without `document.body.appendChild(a)`, breaking file downloads in Firefox. | M2 | PROJECT.md |
| 11 | Outdated Branding Artifact | Stale "CineSync" brand name in `frontend/src/components/ErrorBoundary.jsx:15, 38` instead of "VoiceBridge". | M2 | PROJECT.md |
| 12 | Frontend Tooling Scripts | Missing `lint`, `format`, and `typecheck` script declarations in `frontend/package.json`. | M2 | PROJECT.md |
| 13 | Orphaned Legacy Components | 7 dead, unimported components in `frontend/src` totaling ~1,250 LOC (`CallStage.jsx`, `TacticalHeader.jsx`, `ToastContainer.jsx`, `TranscriptHUD.jsx`, `AdminLogin.jsx`, `UserLogin.jsx`, `fastTranslator.js`). | M2 | PROJECT.md |

## Milestones / Work Items
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M2.1 | Frontend Logic & UI Remediation | Fix regex, socket domain, fallback TTS, Firefox anchor downloads, ErrorBoundary branding, package scripts, and archive legacy dead files. | none | DONE |

## Interface Contracts
### Frontend (`useWebRTC.js`) ↔ Backend (`backend/socket_handlers.py`)
- Event: `speech_segment`
- Payload:
  ```json
  {
    "originalText": "string",
    "sourceLang": "string",
    "targetLang": "string",
    "domain": "string (optional, defaults to 'general')"
  }
  ```
- `emitSpeechSegment` signature in `useWebRTC.js`: `(originalText, sourceLang, targetLang, domain = 'general')` and emits `domain`. `App.jsx:248` passes `activeDomain`.

### Frontend (`App.jsx`) ↔ Fallback TTS (`speak`)
- `speak(text, lang, audioBase64)` receives `data?.targetLang || localLanguage`.

## Code Layout
- Remediated files:
  - `frontend/src/utils/prosodyEngine.js`
  - `frontend/src/hooks/useWebRTC.js`
  - `frontend/src/App.jsx`
  - `frontend/src/components/UserDashboard/UserDashboard.jsx`
  - `frontend/src/components/AdminDashboard/AdminDashboard.jsx`
  - `frontend/src/components/MinutesDrawer.jsx`
  - `frontend/src/components/ErrorBoundary.jsx`
  - `frontend/package.json`
  - `frontend/src/legacy/`
  - `frontend/tests/prosody.test.js`
  - `frontend/tests/m2_verification.test.js`
