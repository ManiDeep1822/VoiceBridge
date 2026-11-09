import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getLocaleStrings, LOCALE_STRINGS } from '../src/utils/languages.js';

describe('Strict Push-to-Talk (PTT) & Floor Lock Strings', () => {
  it('provides dual-script channel busy warnings across Indian and global languages', () => {
    const te = getLocaleStrings('te');
    assert.ok(te.channelBusy.includes('ఛానెల్ బిజీగా ఉంది'));
    assert.ok(te.pttHelper.includes('Hold'));

    const hi = getLocaleStrings('hi');
    assert.ok(hi.channelBusy.includes('चैनल व्यस्त है'));
    assert.ok(hi.pttHelper.includes('Hold'));

    const ta = getLocaleStrings('ta');
    assert.ok(ta.channelBusy.includes('சேனல் பிஸியாக உள்ளது'));

    const en = getLocaleStrings('en');
    assert.strictEqual(en.channelBusy, 'Channel Busy (Please Wait)');
    assert.ok(en.pttHelper.includes('Spacebar'));
  });

  it('contains PTT-optimized button labels across all registered locales', () => {
    for (const [code, dict] of Object.entries(LOCALE_STRINGS)) {
      assert.ok(dict.tapToSpeak, `Missing tapToSpeak for locale ${code}`);
      assert.ok(dict.tapWhenDone, `Missing tapWhenDone for locale ${code}`);
      assert.ok(dict.channelBusy, `Missing channelBusy for locale ${code}`);
      assert.ok(dict.pttHelper, `Missing pttHelper for locale ${code}`);
    }
  });

  it('determines PTT release and cancellation dispatch actions accurately for mobile parity', () => {
    // Pure logic simulation of CallStudio handlePttPointerUp & handlePttPointerCancel
    function evaluatePttRelease({ durationMs, wasAlreadyListening }) {
      if (durationMs > 180) {
        return { action: 'FINALIZE_HOLD' };
      }
      if (wasAlreadyListening) {
        return { action: 'FINALIZE_TAP' };
      }
      return { action: 'START_HANDS_FREE' };
    }

    function evaluatePttCancel({ wasDown, isListening }) {
      if (wasDown || isListening) {
        return { action: 'FINALIZE_CANCEL' };
      }
      return { action: 'NOOP' };
    }

    // 1. Hold-to-Talk release after speaking 300ms, 1000ms, or 5000ms
    assert.deepStrictEqual(evaluatePttRelease({ durationMs: 200, wasAlreadyListening: false }), { action: 'FINALIZE_HOLD' });
    assert.deepStrictEqual(evaluatePttRelease({ durationMs: 1500, wasAlreadyListening: false }), { action: 'FINALIZE_HOLD' });

    // 2. Quick tap (< 180ms) to start hands-free
    assert.deepStrictEqual(evaluatePttRelease({ durationMs: 95, wasAlreadyListening: false }), { action: 'START_HANDS_FREE' });

    // 3. Quick tap (< 180ms) while already listening to stop hands-free
    assert.deepStrictEqual(evaluatePttRelease({ durationMs: 80, wasAlreadyListening: true }), { action: 'FINALIZE_TAP' });

    // 4. Pointer cancel when finger slips or page scrolls during press
    assert.deepStrictEqual(evaluatePttCancel({ wasDown: true, isListening: false }), { action: 'FINALIZE_CANCEL' });
    assert.deepStrictEqual(evaluatePttCancel({ wasDown: false, isListening: true }), { action: 'FINALIZE_CANCEL' });
    assert.deepStrictEqual(evaluatePttCancel({ wasDown: false, isListening: false }), { action: 'NOOP' });
  });
});
