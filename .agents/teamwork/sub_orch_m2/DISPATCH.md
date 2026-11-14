# Dispatch History

## 2026-11-12T16:07:59Z
You are the Sub-Orchestrator for Milestone 2: Frontend Logic, Audio Pipeline & UI Remediation.
Your identity:
- Role: Sub-Orchestrator Milestone 2
- Working directory: d:\Real Live Call Translator
- State folder: d:\Real Live Call Translator\.agents\teamwork\sub_orch_m2
- Parent orchestrator conversation ID: de151cc5-bfef-411f-84f0-0486d3054afc

MANDATORY FIRST STEP:
Read the original request file at:
d:\Real Live Call Translator\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the project scope document at:
d:\Real Live Call Translator\.agents\teamwork\orchestrator\PROJECT.md

Scope of Milestone 2:
Remediate all frontend logic bugs, audio pipeline parameters, UI compatibility issues, and dead code:
1. In `frontend/src/utils/prosodyEngine.js:68`, fix the Hindi urgency regex by removing the stray space before the regex flags (`(?:[\s,.:;!?]|$)/i`), ensuring "जल्दी" matches exclamation intent.
2. In `frontend/src/hooks/useWebRTC.js:298-306` and `frontend/src/App.jsx:248`, update `emitSpeechSegment` to accept and transmit `activeDomain` as `domain` in the `speech_segment` WebSocket event payload, ensuring Jargon Lock operates during live calls.
3. In `frontend/src/App.jsx:305, 311`, ensure fallback Web Speech synthesis receives `data.targetLang || localLanguage` instead of `localLanguage`.
4. In `frontend/src/components/UserDashboard/UserDashboard.jsx:154` and `AdminDashboard.jsx:126`, append download anchor `a` to `document.body` before calling `a.click()` and remove it afterwards to fix file downloads in Firefox.
5. In `frontend/src/components/ErrorBoundary.jsx:15, 38`, replace stale "CineSync" brand name with "VoiceBridge".
6. In `frontend/package.json`, add standard scripts for `lint`, `format`, and `typecheck`.
7. Prune or archive the 7 orphaned legacy files in `frontend/src`: `CallStage.jsx`, `TacticalHeader.jsx`, `ToastContainer.jsx`, `TranscriptHUD.jsx`, `AdminLogin.jsx`, `UserLogin.jsx`, `fastTranslator.js`.

Workflow Instructions:
Follow the Project Pattern:
1. Write SCOPE.md in your state folder (`d:\Real Live Call Translator\.agents\teamwork\sub_orch_m2\SCOPE.md`).
2. Run the Iteration Loop (Explorer -> Worker -> Reviewers -> Challengers -> Forensic Auditor -> Gate).
   - In Worker dispatch, include the MANDATORY INTEGRITY WARNING verbatim:
     "DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected."
   - Worker owns frontend files exclusively: `frontend/src/*`, `frontend/package.json`.
   - Verify build and tests pass: `npm test` and `npm run build` in `frontend/`.
3. Write `handoff.md` in your state folder when complete and send a message back to the parent orchestrator (`de151cc5-bfef-411f-84f0-0486d3054afc`).
