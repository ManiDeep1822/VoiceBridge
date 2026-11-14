# Milestone 2: Frontend Logic & Audio Pipeline Investigation Report

**Author**: `explorer_m2_1`  
**Date**: 2026-11-12  
**Target Milestone**: Milestone 2 — Frontend Logic, Audio Pipeline & UI Remediation  
**Status**: Complete  

---

## Executive Summary

This investigation analyzed three critical frontend logic and audio pipeline bugs in the VoiceBridge application:
1. **Hindi Urgency/Exclamation Regex Defect** (`frontend/src/utils/prosodyEngine.js:68`): A stray whitespace character ` ` precedes the `/i` closing flag delimiter (`(?:[\s,.:;!?]|$) /i`), forcing the compiled regular expression to mandate a literal trailing space character. Because trimmed text (like single words `"जल्दी"` or utterance-ending words) has no trailing space, all Hindi urgency/exclamation phrases fail matching and incorrectly collapse into declarative `statement` intent.
2. **WebSocket Domain Jargon Lock Parameter Drop** (`frontend/src/hooks/useWebRTC.js:298-306` & `frontend/src/App.jsx:248`): The `emitSpeechSegment` callback fails to accept or forward the `activeDomain` parameter into the `speech_segment` WebSocket payload as `domain`. Consequently, the backend socket handler (`backend/socket_handlers.py:307-308`) always defaults to `"general"`, bypassing enterprise domain glossary protections for WebSocket translations.
3. **Fallback TTS Language Mismatch** (`frontend/src/App.jsx:305, 311`): In `handleRemoteAudioReceived`, fallback Web Speech synthesis (`speak`) calls erroneously supply `localLanguage` (the local operator's microphone language) instead of `data.targetLang || localLanguage` (the translated text's actual language). When neural base64 audio fails or is absent (and particularly in Solo Simulator mode or across language boundaries), the browser synthesizes translated foreign text using the local user's voice model, leading to unintelligible pronunciation or silent failure.

---

## 1. Hindi Exclamation / Urgency Regex Bug (`prosodyEngine.js:68`)

### 1.1 Direct Observation
In `frontend/src/utils/prosodyEngine.js`, lines 65-70:
```javascript
export const EXCLAMATION_PATTERNS = {
  en: [/\b(?:urgent|hurry|alert|danger|help|stop|emergency|look out|beware|wow|amazing|congratulations)\b/i],
  te: [/(?:^|[\s,.:;!?])(?:త్వరగా|వెంటనే|ఆగండి|సహాయం|జాగ్రత్త|అత్యవసరం|అద్భుతం|అయ్యో|బాబోయ్)(?:[\s,.:;!?]|$)/i],
  hi: [/(?:^|[\s,.:;!?])(?:जल्दी|तुरंत|रुको|बचाओ|सावधान|मदद|अरे वाह|अरे यार|शाबाश)(?:[\s,.:;!?]|$) /i],
  ta: [/(?:^|[\s,.:;!?])(?:சீக்கிரம்|உடனே|நில்லுங்கள்|காப்பாத்துங்க|ஆபத்து|அடடே)(?:[\s,.:;!?]|$)/i]
};
```
Note line 68:
```javascript
hi: [/(?:^|[\s,.:;!?])(?:जल्दी|तुरंत|रुको|बचाओ|सावधान|मदद|अरे वाह|अरे यार|शाबाश)(?:[\s,.:;!?]|$) /i],
```
There is a literal whitespace character `' '` between `(?:[\s,.:;!?]|$)` and `/i`.

### 1.2 Mechanism of Failure
In JavaScript regex literal syntax `/pattern/flags`, any character before the terminating `/` is parsed as part of the regular expression pattern.
Therefore, the pattern compiled by V8 is:
```regexp
(?:^|[\s,.:;!?])(?:जल्दी|तुरंत|रुको|बचाओ|सावधान|मदद|अरे वाह|अरे यार|शाबाश)(?:[\s,.:;!?]|$) 
```
The trailing space ` ` is a required character in the pattern.

When `classifyAndPunctuateIntent(text, 'hi')` runs:
```javascript
const clean = text.trim();
const cleanNoDot = clean.endsWith('.') ? clean.slice(0, -1).trim() : clean;
const exclaimRules = EXCLAMATION_PATTERNS[cleanLang] || EXCLAMATION_PATTERNS.en;
const isExclamation = exclaimRules.some(re => re.test(cleanNoDot));
```
Because `cleanNoDot` is trimmed:
1. **Single-word / utterance-final Hindi keywords** (e.g., `"जल्दी"`, `"तुरंत"`, `"रुको"`):
   - `(?:^|[\s,.:;!?])` matches the start of the string `^`.
   - `(?:जल्दी|...)` matches `"जल्दी"`.
   - `(?:[\s,.:;!?]|$)` matches the end of the string `$`.
   - The trailing space ` ` attempts to match the next character after `$`. Since nothing can exist after the end of string `$`, the regex **fails unconditionally**.
2. **Multi-word phrases** (e.g., `"जल्दी आओ"`):
   - `(?:^|[\s,.:;!?])` matches `^`.
   - `(?:जल्दी|...)` matches `"जल्दी"`.
   - `(?:[\s,.:;!?]|$)` matches the single space `' '` between `"जल्दी"` and `"आओ"`.
   - The trailing space ` ` in the pattern now requires a *second* space `' '`. Since the next character in `"जल्दी आओ"` is `'आ'`, the regex **fails**.

### 1.3 Concrete Reproduction
Execution via Node.js in the terminal confirms:
```bash
node -e "import('./frontend/src/utils/prosodyEngine.js').then(m => {
  console.log('Hindi jaldi:', m.classifyAndPunctuateIntent('जल्दी', 'hi'));
  console.log('Hindi jaldi aao:', m.classifyAndPunctuateIntent('जल्दी आओ', 'hi'));
  console.log('Hindi ruko:', m.classifyAndPunctuateIntent('रुको', 'hi'));
})"
```
**Actual Output**:
```json
Hindi jaldi: { punctuatedText: 'जल्दी.', intent: 'statement' }
Hindi jaldi aao: { punctuatedText: 'जल्दी आओ.', intent: 'statement' }
Hindi ruko: { punctuatedText: 'रुको.', intent: 'statement' }
```
All urgent and exclamatory Hindi phrases incorrectly fall back to declarative `statement` with a trailing period `.` instead of exclamation mark `!`.

In contrast, Telugu and Tamil (which have no trailing space) work properly:
```bash
Telugu tvaraga: { punctuatedText: 'త్వరగా!', intent: 'exclamation' }
Tamil seekkiram: { punctuatedText: 'சீக்கிரம்!', intent: 'exclamation' }
```

### 1.4 Exclamation/Urgency Detection Across Languages in `prosodyEngine.js`
- **English (`en`)**: Uses word boundary assertions `\b` with keywords: `urgent|hurry|alert|danger|help|stop|emergency|look out|beware|wow|amazing|congratulations`.
- **Telugu (`te`)**: Uses boundary `(?:^|[\s,.:;!?])` and keywords: `త్వరగా|వెంటనే|ఆగండి|సహాయం|జాగ్రత్త|అత్యవసరం|అద్భుతం|అయ్యో|బాబోయ్`.
- **Tamil (`ta`)**: Uses boundary `(?:^|[\s,.:;!?])` and keywords: `சீக்கிரம்|உடனே|நில்லுங்கள்|காப்பாத்துங்க|ஆபத்து|அடடே`.
- **Hindi (`hi`)**: Designed to use boundary `(?:^|[\s,.:;!?])` and keywords: `जल्दी|तुरंत|रुको|बचाओ|सावधान|मदद|अरे वाह|अरे यार|शाबाश`.
- **Backend Reference (`backend/services/prosody_engine.py:77`)**:
  ```python
  "hi": [r'(?:^|[\s,.:;!?])(?:जल्दी|तुरंत|रुको|बचाओ|सावधान|मदद|अरे वाह|अरे यार|शाबाश)(?:[\s,.:;!?]|$)']
  ```
  The backend implementation has no trailing space.

### 1.5 Proposed Code Fix
In `frontend/src/utils/prosodyEngine.js:68`:
```diff
-  hi: [/(?:^|[\s,.:;!?])(?:जल्दी|तुरंत|रुको|बचाओ|सावधान|मदद|अरे वाह|अरे यार|शाबाश)(?:[\s,.:;!?]|$) /i],
+  hi: [/(?:^|[\s,.:;!?])(?:जल्दी|तुरंत|रुको|बचाओ|सावधान|मदद|अरे वाह|अरे यार|शाबाश)(?:[\s,.:;!?]|$)/i],
```

---

## 2. WebSocket Domain Jargon Lock Forwarding (`useWebRTC.js:298-306` & `App.jsx:248`)

### 2.1 Direct Observation
In `frontend/src/hooks/useWebRTC.js`, lines 298-306:
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
In `frontend/src/App.jsx`, line 248:
```javascript
    // 1. Dispatch speech segment across socket (0ms non-blocking; supports 2-peer and solo simulator)
    emitSpeechSegment(cleanText, localLanguage, targetLang);
```
In `backend/socket_handlers.py`, lines 305-310:
```python
            # Stage 1: Fast translation (< 200ms) with glossary terminology protection
            try:
                from services.glossary import apply_glossary_protection, restore_glossary_terms
                domain = str(data.get("domain") or "general").strip().lower()
                protected_text, _ = apply_glossary_protection(enhanced_original, domain)
                translated_raw = await translate_text(protected_text, source_lang, target_lang)
                translated_text = restore_glossary_terms(translated_raw)
            except Exception:
                translated_text = await translate_text(enhanced_original, source_lang, target_lang)
```

### 2.2 Mechanism of Failure
1. `App.jsx:47` maintains `activeDomain` in state: `const [activeDomain, setActiveDomain] = useState('general');`.
2. Users select an enterprise domain (e.g. `'medical'`, `'legal'`, `'tech'`, `'finance'`) through `GlossaryDrawer` (`App.jsx:504-514`).
3. For local translation preview, `App.jsx:251` calls `translateTextFast(cleanText, localLanguage, targetLang, activeDomain, backendUrl)`, correctly supplying `activeDomain`.
4. However, `emitSpeechSegment` in `useWebRTC.js` only takes three parameters `(originalText, sourceLang, targetLang)`. It does not accept or emit `domain`.
5. On the backend, `data.get("domain")` is `None`, so `domain` defaults to `"general"`.
6. As a result, domain-specific terminology rules (such as locking medical acronyms "ECG", "CT Scan", legal terms "subpoena", etc.) are never activated during live WebSocket call translation.

### 2.3 Proposed Code Fix
**File 1**: `frontend/src/hooks/useWebRTC.js:298-306`
```diff
-  const emitSpeechSegment = useCallback((originalText, sourceLang, targetLang) => {
+  const emitSpeechSegment = useCallback((originalText, sourceLang, targetLang, domain = 'general') => {
     if (socketRef.current && socketRef.current.connected) {
       socketRef.current.emit('speech_segment', {
         originalText,
         sourceLang,
-        targetLang
+        targetLang,
+        domain
       });
     }
   }, []);
```

**File 2**: `frontend/src/App.jsx:248`
```diff
     // 1. Dispatch speech segment across socket (0ms non-blocking; supports 2-peer and solo simulator)
-    emitSpeechSegment(cleanText, localLanguage, targetLang);
+    emitSpeechSegment(cleanText, localLanguage, targetLang, activeDomain);
```

Note: `activeDomain` is already included in the `useCallback` dependency array of `handleDispatchUtterance` at `App.jsx:270`:
`[activeDomain, backendUrl, emitSpeechSegment, localLanguage, remoteLanguage, remotePeer, unlockAudio, userName]`. No dependency update is needed.

---

## 3. Fallback Web Speech Synthesis Language Mismatch (`App.jsx:305, 311`)

### 3.1 Direct Observation
In `frontend/src/App.jsx`, lines 301-313:
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
In `frontend/src/hooks/useSpeechSynthesis.js`, lines 203-242:
```javascript
  const speak = useCallback(async (text, targetLang, backendAudioBase64 = null, options = {}) => {
    ...
    // If backend Edge-TTS base64 is supplied, attempt neural playback
    if (backendAudioBase64) {
      const ok = await playBase64Audio(backendAudioBase64);
      if (ok) return;
    }

    // Robust Hybrid TTS Fallback:
    // If backend base64 is absent or failed, reliably speak via browser Web Speech API
    speakTextLocal(cleanText, targetLang);
  }, [initAudioGain, playBase64Audio, speakTextLocal, stopSpeech]);
```
And in `speakTextLocal` (`useSpeechSynthesis.js:145-155`):
```javascript
    const { punctuatedText } = classifyAndPunctuateIntent(dedupedText, targetLang);
    const utterance = new SpeechSynthesisUtterance(punctuatedText);
    const voice = findBestVoice(targetLang);
    if (voice) {
      utterance.voice = voice;
      setActiveVoiceName(voice.name);
    }
    const meta = getLanguageMeta(targetLang);
    utterance.lang = meta.stt;
```

### 3.2 Mechanism of Failure
1. In `handleRemoteAudioReceived`, `data.translatedText` is the translated utterance in the target language (`data.targetLang`).
2. Why was `localLanguage` used?
   In a symmetric 2-person call, the receiving user expects incoming translation to be in their own language (`localLanguage`). The original developer assumed `localLanguage == data.targetLang`.
3. Why this assumption breaks:
   - **Solo Simulator Mode**: When a user tests alone, `App.jsx` connects to the simulator. A user with `localLanguage = 'en'` speaks in English; the simulator translates to `targetLang = 'hi'`. If `audioBase64` fails or is not returned, `speak(data.translatedText, localLanguage)` calls Web Speech API passing Hindi text (`"आप कहाँ जा रहे हैं?"`) with `targetLang = 'en'`. The English browser voice attempts to read Devanagari text, which either completely mutes/fails on Chrome or pronounces gibberish phonemes.
   - **Neural Audio Playback Failure**: In line 305, `data.audioBase64` is passed. But if `playBase64Audio` fails (e.g. mobile audio autoplay policy restriction, network decoding glitch, unsupported audio codec), `useSpeechSynthesis.js:241` falls back to `speakTextLocal(cleanText, targetLang)`. At that moment, `targetLang` was passed as `localLanguage`.
   - **In-flight Language Switches**: If the local user switches their language or receives an utterance targeted to a different language, `localLanguage` is wrong.
   - **Inconsistency with Subtitle Handling**: In `handleRemoteTextReceived` (`App.jsx:294`), the author already correctly wrote:
     ```javascript
     targetLang: data.targetLang || localLanguage,
     ```
     `handleRemoteAudioReceived` missed this exact pattern and hardcoded `localLanguage`.

### 3.3 Proposed Code Fix
In `frontend/src/App.jsx:301-313`:
```diff
   // Handle Incoming Base64 Audio from Connected Peer (Authoritative Studio Neural Voice)
   const handleRemoteAudioReceived = useCallback((data) => {
+    const targetLang = data?.targetLang || localLanguage;
     if (data.audioBase64) {
       lastRemoteAudioBase64Ref.current = data.audioBase64;
       lastRemoteTranslatedTextRef.current = data.translatedText || '';
-      speak(data.translatedText, localLanguage, data.audioBase64);
+      speak(data.translatedText, targetLang, data.audioBase64);
       // Zero-latency buffer capture for call recording
       callRecorder.addBase64AudioChunk(data.audioBase64, remotePeer?.userName || 'Remote Caller', data.translatedText);
     } else if (data.translatedText) {
       lastRemoteAudioBase64Ref.current = null;
       lastRemoteTranslatedTextRef.current = data.translatedText;
-      speak(data.translatedText, localLanguage);
+      speak(data.translatedText, targetLang);
     }
   }, [localLanguage, remotePeer, speak]);
```

---

## 4. Summary of Proposed Changes for Implementer

| Target File | Line(s) | Change Description |
|-------------|---------|--------------------|
| `frontend/src/utils/prosodyEngine.js` | 68 | Remove trailing space before `/i` in `EXCLAMATION_PATTERNS.hi` |
| `frontend/src/hooks/useWebRTC.js` | 298, 304 | Add `domain = 'general'` parameter to `emitSpeechSegment` and emit `domain` property |
| `frontend/src/App.jsx` | 248 | Pass `activeDomain` as 4th argument to `emitSpeechSegment` |
| `frontend/src/App.jsx` | 301-313 | Define `targetLang = data?.targetLang || localLanguage` and pass to `speak()` calls |

All proposed changes are strictly surgical, backward-compatible, and satisfy all project interface contracts.
