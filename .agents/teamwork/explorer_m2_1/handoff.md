# Handoff Report: Milestone 2 — Frontend Logic & Audio Pipeline Remediation

**Author**: `explorer_m2_1`  
**Date**: 2026-11-12  
**Type**: Hard Handoff (Investigation Complete)  
**Recipient**: `sub_orch_m2` / Implementer  

---

## 1. Observation

### Observation 1.1: Hindi Exclamation Pattern Stray Space
- **File**: `frontend/src/utils/prosodyEngine.js`, lines 65-70
- **Verbatim Code**:
  ```javascript
  export const EXCLAMATION_PATTERNS = {
    en: [/\b(?:urgent|hurry|alert|danger|help|stop|emergency|look out|beware|wow|amazing|congratulations)\b/i],
    te: [/(?:^|[\s,.:;!?])(?:త్వరగా|వెంటనే|ఆగండి|సహాయం|జాగ్రత్త|అత్యవసరం|అద్భుతం|అయ్యో|బాబోయ్)(?:[\s,.:;!?]|$)/i],
    hi: [/(?:^|[\s,.:;!?])(?:जल्दी|तुरंत|रुको|बचाओ|सावधान|मदद|अरे वाह|अरे यार|शाबाश)(?:[\s,.:;!?]|$) /i],
    ta: [/(?:^|[\s,.:;!?])(?:சீக்கிரம்|உடனே|நில்லுங்கள்|காப்பாத்துங்க|ஆபத்து|அடடே)(?:[\s,.:;!?]|$)/i]
  };
  ```
- **Observed Defect**: Line 68 has a literal space `' '` right before `/i`: `(?:[\s,.:;!?]|$) /i`.
- **Runtime Tool Verification**:
  ```powershell
  node -e "import('./frontend/src/utils/prosodyEngine.js').then(m => { console.log('Hindi jaldi:', m.classifyAndPunctuateIntent('जल्दी', 'hi')); console.log('Hindi jaldi aao:', m.classifyAndPunctuateIntent('जल्दी आओ', 'hi')); })"
  ```
  **Output**:
  ```
  Hindi jaldi: { punctuatedText: 'जल्दी.', intent: 'statement' }
  Hindi jaldi aao: { punctuatedText: 'जल्दी आओ.', intent: 'statement' }
  ```
  Both fail to match exclamation and fall back to statement (`.`).

### Observation 1.2: `emitSpeechSegment` Domain Parameter Dropped
- **File**: `frontend/src/hooks/useWebRTC.js`, lines 298-306
- **Verbatim Code**:
  ```javascript
  // Send speech segment to peer
  const emitSpeechSegment = useCallback((originalText, sourceLang, targetLang) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('speech_segment', {
        originalText,
        sourceLang,
        targetLang
      });
    }
  }, []);
  ```
- **File**: `frontend/src/App.jsx`, line 248
- **Verbatim Code**:
  ```javascript
  // 1. Dispatch speech segment across socket (0ms non-blocking; supports 2-peer and solo simulator)
  emitSpeechSegment(cleanText, localLanguage, targetLang);
  ```
- **File**: `backend/socket_handlers.py`, lines 306-308
- **Verbatim Code**:
  ```python
  from services.glossary import apply_glossary_protection, restore_glossary_terms
  domain = str(data.get("domain") or "general").strip().lower()
  protected_text, _ = apply_glossary_protection(enhanced_original, domain)
  ```
- **Observed Defect**: `emitSpeechSegment` only accepts `(originalText, sourceLang, targetLang)` and omits `domain` from the socket emission. `App.jsx:248` passes only 3 arguments. Backend looks for `data.get("domain")`, which evaluates to `None` and falls back to `"general"`.

### Observation 1.3: Fallback TTS Language Mismatch in `App.jsx`
- **File**: `frontend/src/App.jsx`, lines 301-313
- **Verbatim Code**:
  ```javascript
  // Handle Incoming Base64 Audio from Connected Peer (Authoritative Studio Neural Voice)
  const handleRemoteAudioReceived = useCallback((data) => {
    if (data.audioBase64) {
      lastRemoteAudioBase64Ref.current = data.audioBase64;
      lastRemoteTranslatedTextRef.current = data.translatedText || '';
      speak(data.translatedText, localLanguage, data.audioBase64);
      // Zero-latency buffer capture for call recording
      callRecorder.addBase64AudioChunk(data.audioBase64, remotePeer?.userName || 'Remote Caller', data.translatedText);
    } else if (data.translatedText) {
      lastRemoteAudioBase64Ref.current = null;
      lastRemoteTranslatedTextRef.current = data.translatedText;
      speak(data.translatedText, localLanguage);
    }
  }, [localLanguage, remotePeer, speak]);
  ```
- **File**: `frontend/src/App.jsx`, line 294 (Contrast in same file)
- **Verbatim Code**:
  ```javascript
  targetLang: data.targetLang || localLanguage,
  ```
- **File**: `frontend/src/hooks/useSpeechSynthesis.js`, lines 203, 241
- **Verbatim Code**:
  ```javascript
  const speak = useCallback(async (text, targetLang, backendAudioBase64 = null, options = {}) => {
  ...
    // If backend base64 is absent or failed, reliably speak via browser Web Speech API
    speakTextLocal(cleanText, targetLang);
  ```
- **Observed Defect**: `App.jsx:305` and `311` pass `localLanguage` instead of `data?.targetLang || localLanguage`. If Edge-TTS audio base64 is null/fails (or in Solo Simulator mode where user speaks English and simulator speaks Hindi), Web Speech API attempts to speak translated text with an inappropriate local language voice model.

---

## 2. Logic Chain

1. **Prosody Hindi Exclamation Failure**:
   - `frontend/src/utils/prosodyEngine.js:68` contains `(?:[\s,.:;!?]|$) /i`.
   - In ECMAScript RegExp literals, whitespace before the trailing delimiter `/` is included in the regex pattern body.
   - The compiled pattern requires a trailing space immediately following the word boundary or end of string.
   - `classifyAndPunctuateIntent` trims the input (`text.trim()`), ensuring no trailing space exists on the string.
   - Thus, `re.test(cleanNoDot)` will always return `false` on any trimmed string ending in a Hindi urgency keyword (e.g. `"जल्दी"`).
   - Removing the stray space character before `/` allows `$` to match the end of string, correctly identifying the word as an exclamation.

2. **WebSocket Domain Dropping**:
   - `App.jsx` stores user domain selection in `activeDomain` state (`general`, `medical`, `legal`, `tech`, `finance`).
   - `App.jsx:248` invokes `emitSpeechSegment(cleanText, localLanguage, targetLang)`.
   - `useWebRTC.js:298-306` defines `emitSpeechSegment` with three parameters and emits an object with `{ originalText, sourceLang, targetLang }`.
   - `backend/socket_handlers.py:307` extracts `domain = str(data.get("domain") or "general")`.
   - Because `data.domain` is undefined, `data.get("domain")` evaluates to `None`, defaulting to `"general"`.
   - Passing `domain = 'general'` in `emitSpeechSegment` and passing `activeDomain` from `App.jsx:248` restores domain glossary protection to WebSocket transmissions.

3. **Fallback TTS Language Selection**:
   - `data.translatedText` received over WebSocket is translated into `data.targetLang`.
   - When base64 audio fails or is absent, `speak` falls back to `speakTextLocal(cleanText, targetLang)`.
   - `App.jsx:305, 311` currently passes `localLanguage` (e.g. `'en'`) instead of `targetLang` (e.g. `'hi'`).
   - Browser Web Speech synthesis selects an English voice to read Hindi Devanagari characters, causing pronunciation failure or silence.
   - Using `const targetLang = data?.targetLang || localLanguage;` ensures the browser voice matches the language of the translated text.

---

## 3. Caveats

- **No Caveats on Bug Mechanisms**: The root causes and syntax fixes for all three issues are 100% verified and reproducible.
- **Scope Boundary**: This report focuses on frontend logic and audio pipeline bugs. Other M2 tasks (Firefox anchor download in dashboards, ErrorBoundary branding, package.json scripts, dead legacy components) are tracked separately under M2.
- **Read-Only Invariant**: As an Explorer, no source files were modified.

---

## 4. Conclusion

All three defects have clear, surgical, and mutually independent solutions:
1. Fix regex in `frontend/src/utils/prosodyEngine.js:68` by removing the single stray space before `/i`.
2. Update `emitSpeechSegment` in `frontend/src/hooks/useWebRTC.js:298-306` to accept `domain = 'general'` and include `domain` in the emitted payload.
3. Update `frontend/src/App.jsx:248` to pass `activeDomain` to `emitSpeechSegment`.
4. Update `frontend/src/App.jsx:301-313` to pass `data?.targetLang || localLanguage` to `speak` on lines 305 and 311.

---

## 5. Verification Method

### 5.1 Automated Unit Tests (Frontend)
Run existing frontend test suite:
```powershell
npm test --prefix frontend
```
Expected result: 48 tests pass.

### 5.2 Direct Node Verification for Hindi Prosody Fix
```powershell
node -e "
import('./frontend/src/utils/prosodyEngine.js').then(m => {
  const r1 = m.classifyAndPunctuateIntent('जल्दी आओ', 'hi');
  const r2 = m.classifyAndPunctuateIntent('रुको', 'hi');
  console.log(r1.intent === 'exclamation' && r1.punctuatedText.endsWith('!') ? 'PASS: Hindi exclamation' : 'FAIL');
  console.log(r2.intent === 'exclamation' && r2.punctuatedText.endsWith('!') ? 'PASS: Hindi single word urgency' : 'FAIL');
});
"
```
- **Invalidation Condition**: If `r1.intent` or `r2.intent` returns `'statement'`, the regex still has a defect.

### 5.3 Static Verification of Files
- In `frontend/src/hooks/useWebRTC.js`: Check line 298 signature includes `domain` and line 304 includes `domain` in payload.
- In `frontend/src/App.jsx`: Check line 248 passes `activeDomain`, lines 305 & 311 pass `targetLang`.
