import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getLocaleStrings, LOCALE_STRINGS } from '../src/utils/languages.js';
import {
  MIN_PTT_HOLD_MS,
  PTT_RELEASE_GRACE_MS,
  TOUCH_SLOP_PX,
  isWithinTouchSlop,
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

  it('calculates touch-slop buffer accurately for mobile touchscreens', () => {
    assert.strictEqual(TOUCH_SLOP_PX, 20);

    // Exact center hold (0px movement)
    assert.strictEqual(isWithinTouchSlop(100, 100, 100, 100), true);

    // Minor finger jitter/roll (10px, 14.14px, 20px)
    assert.strictEqual(isWithinTouchSlop(100, 100, 100, 110), true);
    assert.strictEqual(isWithinTouchSlop(0, 0, 10, 10), true);
    assert.strictEqual(isWithinTouchSlop(50, 50, 70, 50), true);

    // Movement exceeding touch slop threshold (> 20px)
    assert.strictEqual(isWithinTouchSlop(0, 0, 21, 0), false);
    assert.strictEqual(isWithinTouchSlop(50, 50, 75, 50), false);
    assert.strictEqual(isWithinTouchSlop(0, 0, 20, 20), false); // ~28.28px

    // Safe fallback for null/undefined coordinates
    assert.strictEqual(isWithinTouchSlop(null, undefined, 5, 5), true);
  });

  it('prevents accidental pointercancel drops when within touch-slop buffer', () => {
    // Within touch-slop buffer during hold: ignore accidental touch cancel
    assert.deepStrictEqual(
      evaluatePttCancel(120, { withinSlop: true, wasHolding: true }),
      { action: 'IGNORE', dispatch: false }
    );
    assert.deepStrictEqual(
      evaluatePttCancel(50, { withinSlop: true, wasHolding: true }),
      { action: 'IGNORE', dispatch: false }
    );

    // Beyond touch-slop buffer: abort recording cleanly
    assert.deepStrictEqual(
      evaluatePttCancel(120, { withinSlop: false, wasHolding: true }),
      { action: 'CANCEL', dispatch: false }
    );

    // Held >= 200ms: always finalizes regardless of slop
    assert.deepStrictEqual(
      evaluatePttCancel(250, { withinSlop: true, wasHolding: true }),
      { action: 'FINALIZE', dispatch: true, waitMs: 500 }
    );
  });

  it('supports seamless single-tap and hold-to-talk parity', () => {
    // 1. Single-tap to talk (< 200ms) when not listening: keeps mic active
    assert.deepStrictEqual(
      evaluatePttRelease(80, { tapToTalk: true, isListening: false }),
      { action: 'KEEP_LISTENING', dispatch: false }
    );

    // 2. Single-tap to finish (< 200ms) when already listening: finalizes and sends
    assert.deepStrictEqual(
      evaluatePttRelease(80, { tapToTalk: true, isListening: true }),
      { action: 'FINALIZE', dispatch: true, waitMs: 500 }
    );

    // 3. Hold-to-Talk (>= 200ms): finalizes and dispatches after trailing grace period
    assert.deepStrictEqual(
      evaluatePttRelease(350, { tapToTalk: true, isListening: false }),
      { action: 'FINALIZE', dispatch: true, waitMs: 500 }
    );
    assert.deepStrictEqual(
      evaluatePttRelease(1200, { tapToTalk: true, isListening: false }),
      { action: 'FINALIZE', dispatch: true, waitMs: 500 }
    );

    // 4. Keyboard Spacebar single-tap parity
    assert.deepStrictEqual(
      evaluateSpaceKeyUp(90, { tapToTalk: true, isListening: false }),
      { action: 'KEEP_LISTENING', dispatch: false }
    );
    assert.deepStrictEqual(
      evaluateSpaceKeyUp(90, { tapToTalk: true, isListening: true }),
      { action: 'FINALIZE', dispatch: true, waitMs: 500 }
    );
  });
});
