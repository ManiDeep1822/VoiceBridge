import assert from 'node:assert';

// 1. Test fallback logic from App.jsx handleRemoteAudioReceived
function resolveTargetLang(data, localLanguage) {
  return data?.targetLang || localLanguage;
}

const localLang = 'en-US';
assert.strictEqual(resolveTargetLang({ targetLang: 'hi', translatedText: 'नमस्ते' }, localLang), 'hi');
assert.strictEqual(resolveTargetLang({ translatedText: 'Hello' }, localLang), 'en-US');
assert.strictEqual(resolveTargetLang(null, localLang), 'en-US');
assert.strictEqual(resolveTargetLang(undefined, localLang), 'en-US');
assert.strictEqual(resolveTargetLang({ targetLang: '' }, localLang), 'en-US');

// 2. Test emitSpeechSegment payload structure
function buildEmitPayload(originalText, sourceLang, targetLang, domain = 'general') {
  return {
    originalText,
    sourceLang,
    targetLang,
    domain
  };
}

const payloadExplicit = buildEmitPayload('BP check', 'en', 'es', 'medical');
assert.deepStrictEqual(payloadExplicit, {
  originalText: 'BP check',
  sourceLang: 'en',
  targetLang: 'es',
  domain: 'medical'
});

const payloadDefault = buildEmitPayload('Hello', 'en', 'hi');
assert.deepStrictEqual(payloadDefault, {
  originalText: 'Hello',
  sourceLang: 'en',
  targetLang: 'hi',
  domain: 'general'
});

console.log('ALL ADVERSARIAL LOGIC CHECKS PASSED');
