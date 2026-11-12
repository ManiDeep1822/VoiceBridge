import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getLocaleStrings, LOCALE_STRINGS } from '../src/utils/languages.js';
import {
  MIN_PTT_HOLD_MS,
  PTT_RELEASE_GRACE_MS,
  evaluatePttRelease,
  evaluatePttCancel,
  evaluateSpaceKeyUp
} from '../src/utils/pttHelper.js';

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

    const en = getLocaleStrings('en');
    assert.strictEqual(en.tapToSpeak, 'Hold to Speak (Space)');
    assert.strictEqual(en.tapWhenDone, 'Release to Send');
  });

  it('determines pure Walkie-Talkie Hold-to-Talk release actions accurately', () => {
    assert.strictEqual(MIN_PTT_HOLD_MS, 200);
    assert.strictEqual(PTT_RELEASE_GRACE_MS, 500);

    // 1. Hold-to-Talk release after speaking >= 200ms (e.g. 200ms, 350ms, 1500ms, 5000ms)
    assert.deepStrictEqual(evaluatePttRelease(200), { action: 'FINALIZE', dispatch: true, waitMs: 500 });
    assert.deepStrictEqual(evaluatePttRelease(350), { action: 'FINALIZE', dispatch: true, waitMs: 500 });
    assert.deepStrictEqual(evaluatePttRelease(1500), { action: 'FINALIZE', dispatch: true, waitMs: 500 });
    assert.deepStrictEqual(evaluatePttRelease(5000), { action: 'FINALIZE', dispatch: true, waitMs: 500 });

    // 2. Accidental quick tap (< 200ms) cancels without dispatching and prompts tooltip
    assert.deepStrictEqual(evaluatePttRelease(0), { action: 'CANCEL', dispatch: false, tooltip: 'Hold while speaking' });
    assert.deepStrictEqual(evaluatePttRelease(50), { action: 'CANCEL', dispatch: false, tooltip: 'Hold while speaking' });
    assert.deepStrictEqual(evaluatePttRelease(120), { action: 'CANCEL', dispatch: false, tooltip: 'Hold while speaking' });
    assert.deepStrictEqual(evaluatePttRelease(199), { action: 'CANCEL', dispatch: false, tooltip: 'Hold while speaking' });
  });

  it('determines pointer cancel actions accurately', () => {
    // If finger slips or pointer cancels after user held >= 200ms, speech is finalized
    assert.deepStrictEqual(evaluatePttCancel(200), { action: 'FINALIZE', dispatch: true, waitMs: 500 });
    assert.deepStrictEqual(evaluatePttCancel(850), { action: 'FINALIZE', dispatch: true, waitMs: 500 });

    // If pointer cancels before 200ms threshold, speech is aborted without dispatch
    assert.deepStrictEqual(evaluatePttCancel(50), { action: 'CANCEL', dispatch: false });
    assert.deepStrictEqual(evaluatePttCancel(199), { action: 'CANCEL', dispatch: false });
  });

  it('determines Spacebar hotkey release actions accurately', () => {
    // Spacebar held >= 200ms dispatches finalized turn
    assert.deepStrictEqual(evaluateSpaceKeyUp(200), { action: 'FINALIZE', dispatch: true, waitMs: 500 });
    assert.deepStrictEqual(evaluateSpaceKeyUp(600), { action: 'FINALIZE', dispatch: true, waitMs: 500 });

    // Spacebar tap < 200ms cancels without dispatching
    assert.deepStrictEqual(evaluateSpaceKeyUp(80), { action: 'CANCEL', dispatch: false, tooltip: 'Hold while speaking' });
    assert.deepStrictEqual(evaluateSpaceKeyUp(190), { action: 'CANCEL', dispatch: false, tooltip: 'Hold while speaking' });
  });

  it('defines 500ms post-release trailing grace buffer constant', () => {
    assert.strictEqual(PTT_RELEASE_GRACE_MS, 500);
  });
});
