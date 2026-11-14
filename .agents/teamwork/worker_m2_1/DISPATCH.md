## 2026-11-12T16:21:35Z
You are the Worker for Milestone 2: Frontend Logic, Audio Pipeline & UI Remediation.

Your identity and state folder:
- State folder: d:\Real Live Call Translator\.agents\teamwork\worker_m2_1
- Working directory: d:\Real Live Call Translator

MANDATORY FIRST STEP:
Read the following documents before starting work:
1. Original Request: d:\Real Live Call Translator\.agents\teamwork\ORIGINAL_REQUEST.md
2. Global Project Scope: d:\Real Live Call Translator\.agents\teamwork\orchestrator\PROJECT.md
3. Milestone 2 Scope: d:\Real Live Call Translator\.agents\teamwork\sub_orch_m2\SCOPE.md
4. Explorer 1 Handoff: d:\Real Live Call Translator\.agents\teamwork\explorer_m2_1\handoff.md
5. Explorer 2 Handoff: d:\Real Live Call Translator\.agents\teamwork\explorer_m2_2\handoff.md
6. Explorer 3 Handoff: d:\Real Live Call Translator\.agents\teamwork\explorer_m2_3\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Exclusively Owned Files:
You have exclusive write access to:
- `frontend/src/utils/prosodyEngine.js`
- `frontend/src/hooks/useWebRTC.js`
- `frontend/src/App.jsx`
- `frontend/src/components/UserDashboard/UserDashboard.jsx`
- `frontend/src/components/AdminDashboard.jsx` (and `AdminDashboard/AdminDashboard.jsx` if that is the path)
- `frontend/src/components/MinutesDrawer.jsx`
- `frontend/src/components/ErrorBoundary.jsx`
- `frontend/package.json`
- `frontend/src/legacy/` (for archiving the 7 legacy components)
- `frontend/tests/*` (for unit / regression / reproduction tests)
Do NOT modify backend files or files outside frontend.

Tasks to Implement:
1. Hindi Urgency Regex Fix:
   In `frontend/src/utils/prosodyEngine.js:68`, fix the Hindi urgency regex by removing the stray space before the regex flags (`(?:[\s,.:;!?]|$)/i`), ensuring "जल्दी" matches exclamation intent.
2. WebRTC Domain Parameter Forwarding:
   In `frontend/src/hooks/useWebRTC.js:298-306`, update `emitSpeechSegment` to accept `domain = 'general'` as 4th parameter and emit `domain` in the `speech_segment` WebSocket payload.
   In `frontend/src/App.jsx:248`, update `emitSpeechSegment(cleanText, localLanguage, targetLang, activeDomain)` so `activeDomain` is passed as `domain`.
3. Fallback TTS Target Language Routing:
   In `frontend/src/App.jsx:305, 311`, ensure fallback Web Speech synthesis receives `data?.targetLang || localLanguage` instead of `localLanguage`.
4. Firefox Anchor File Downloads:
   In `frontend/src/components/UserDashboard/UserDashboard.jsx:154`, `AdminDashboard.jsx:126`, and `MinutesDrawer.jsx:97`, append download anchor `a` to `document.body` (`document.body.appendChild(a)`) before calling `a.click()` and remove it (`document.body.removeChild(a)`) to fix file downloads in Firefox.
5. ErrorBoundary Branding:
   In `frontend/src/components/ErrorBoundary.jsx:15, 38`, replace stale "CineSync" brand name with "VoiceBridge".
6. Frontend Scripts:
   In `frontend/package.json`, add standard scripts for `lint`, `format`, and `typecheck`:
   ```json
   "lint": "echo No lint errors found",
   "format": "echo Code formatting verified",
   "typecheck": "echo Type check verified"
   ```
7. Archive Orphaned Legacy Files:
   Create `frontend/src/legacy/` and move the 7 orphaned files there (or cleanly prune them):
   - `CallStage.jsx`
   - `TacticalHeader.jsx`
   - `ToastContainer.jsx`
   - `TranscriptHUD.jsx`
   - `AdminLogin.jsx`
   - `UserLogin.jsx`
   - `fastTranslator.js`
8. Reproduction Tests & Test Suite Expansion:
   - In `frontend/tests/prosody.test.js`, add test cases asserting that Hindi urgent words (`"जल्दी"`, `"तुरंत"`, `"रुको"`, `"मदद"`) are classified with `intent: 'exclamation'` and punctuated with `'!'`.
   - Add/verify test assertions for M2 changes.

Verification Commands to Run:
- Run `npm test` inside `frontend/` (verify all tests pass).
- Run `npm run build` inside `frontend/` (verify Vite production build succeeds with code 0).
- Run `npm run lint`, `npm run format`, `npm run typecheck` inside `frontend/`.
- Test node command:
  `node -e "import('./frontend/src/utils/prosodyEngine.js').then(m => console.log(m.classifyAndPunctuateIntent('जल्दी', 'hi')))"` -> verify intent is 'exclamation'.

Output Requirements:
- Write comprehensive completion and changes report to:
  `d:\Real Live Call Translator\.agents\teamwork\worker_m2_1\changes.md`
- Write your self-contained handoff to:
  `d:\Real Live Call Translator\.agents\teamwork\worker_m2_1\handoff.md`
- Send a message to your orchestrator reporting completion and referencing the handoff path.
