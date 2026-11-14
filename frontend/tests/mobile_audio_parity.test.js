import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MIN_PTT_HOLD_MS,
  PTT_RELEASE_GRACE_MS,
  TOUCH_SLOP_PX,
  isWithinTouchSlop,
  evaluatePttRelease,
  evaluatePttCancel,
  evaluateSpaceKeyUp
} from '../src/utils/pttHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const hookPath = path.resolve(__dirname, '../src/hooks/useSpeechRecognition.js');
const studioPath = path.resolve(__dirname, '../src/components/CallStudio/CallStudio.jsx');

describe('Mobile Microphone Parity & Resilient Audio Capture', () => {
  const hookSource = fs.readFileSync(hookPath, 'utf8');
  const studioSource = fs.readFileSync(studioPath, 'utf8');

  it('eliminates artificial random pulse audio meter and unifies Web Audio API across all platforms', () => {
    // Assert 0 occurrences of mobile artificial pulse timer or random number generator
    assert.ok(
      !hookSource.includes('mobilePulseTimerRef'),
      'mobilePulseTimerRef must be completely removed from useSpeechRecognition'
    );
    assert.ok(
      !hookSource.includes('Math.floor(35 + Math.random() * 45)'),
      'Artificial random audio pulse must be eliminated'
    );

    // Assert real Web Audio API is unified
    assert.ok(hookSource.includes('createMediaStreamSource'), 'Must use createMediaStreamSource for audio metering');
    assert.ok(hookSource.includes('createAnalyser'), 'Must use AnalyserNode for audio metering');
    assert.ok(hookSource.includes('getByteFrequencyData'), 'Must compute real dB audio level from frequency bin data');
  });

  it('guards against audio track contention by reusing live hardware streams without premature aborts', () => {
    // Check hardware stream reuse logic
    assert.ok(
      hookSource.includes('stream.getAudioTracks().some'),
      'Must check existing micStreamRef tracks for live status before requesting new hardware track'
    );
    assert.ok(
      !hookSource.includes('isMobile && micStreamRef.current'),
      'Must not destroy micStreamRef tracks on startListening on mobile'
    );

    // Ensure stopAudioMeter does not abort hardware tracks
    assert.ok(
      hookSource.includes('const stopAudioMeter = useCallback(() => {'),
      'stopAudioMeter must cancel animation frame without stopping hardware tracks'
    );
  });

  it('implements resilient debounced auto-reconnection for mobile SpeechRecognition drops', () => {
    // Check debounced scheduleRestart implementation
    assert.ok(hookSource.includes('scheduleRestart'), 'Must provide scheduleRestart helper for resilient recovery');
    assert.ok(
      hookSource.includes('restartAttemptsRef'),
      'Must track restart attempts with backoff'
    );

    // Check no-speech error auto-recovery
    assert.ok(
      hookSource.includes("event.error === 'no-speech'"),
      'Must catch no-speech error and schedule restart'
    );

    // Check onend auto-reconnection while shouldBeListening is active
    assert.ok(
      hookSource.includes('shouldBeListeningRef.current && !isDuckedRef.current'),
      'Must auto-reconnect onend if shouldBeListening is true'
    );

    // Check tab visibility / focus change recovery
    assert.ok(
      hookSource.includes("document.addEventListener('visibilitychange'"),
      'Must register visibilitychange listener to recover paused speech recognition'
    );
    assert.ok(
      hookSource.includes("window.addEventListener('focus'"),
      'Must register focus listener to resume suspended AudioContext'
    );
  });

  it('handles microphone permission state changes and provides clean recovery', () => {
    // Permission observer
    assert.ok(
      hookSource.includes("navigator.permissions.query({ name: 'microphone' })"),
      'Must monitor microphone permission query'
    );
    assert.ok(
      hookSource.includes("status.state === 'granted'"),
      'Must automatically recover when permission transitions to granted'
    );
    assert.ok(
      hookSource.includes("setMicPermission('denied')"),
      'Must cleanly set denied state on permission rejection'
    );
  });

  it('enforces strict touch shielding on PTT button and bottom dock container', () => {
    // Strict touch action, user select, and callout prevention
    assert.ok(studioSource.includes("touchAction: 'none'"), 'Must declare touchAction: none in styles');
    assert.ok(studioSource.includes("userSelect: 'none'"), 'Must declare userSelect: none in styles');
    assert.ok(studioSource.includes("WebkitTouchCallout: 'none'"), 'Must declare WebkitTouchCallout: none in styles');
    assert.ok(studioSource.includes("onContextMenu={(e) => e.preventDefault()}"), 'Must prevent touch context menus');
  });

  it('implements touchscreen touch-slop buffer preventing accidental pointercancel drops', () => {
    // Touch slop threshold
    assert.strictEqual(TOUCH_SLOP_PX, 20);

    // Minor finger jitter is preserved
    assert.strictEqual(isWithinTouchSlop(50, 50, 60, 60), true);
    assert.strictEqual(isWithinTouchSlop(50, 50, 70, 50), true);

    // Large movement outside slop is recognized as intentional drag
    assert.strictEqual(isWithinTouchSlop(50, 50, 90, 50), false);

    // Pointer cancel with withinSlop=true ignores jitter and maintains active session
    const jitterCancel = evaluatePttCancel(100, { withinSlop: true, wasHolding: true });
    assert.deepStrictEqual(jitterCancel, { action: 'IGNORE', dispatch: false });

    // Pointer cancel outside slop cancels recording
    const dragCancel = evaluatePttCancel(100, { withinSlop: false, wasHolding: true });
    assert.deepStrictEqual(dragCancel, { action: 'CANCEL', dispatch: false });
  });

  it('supports seamless single-tap and hold-to-talk parity across mobile and laptop', () => {
    // Single-tap when mic is off -> keeps listening
    const startTap = evaluatePttRelease(90, { tapToTalk: true, isListening: false });
    assert.deepStrictEqual(startTap, { action: 'KEEP_LISTENING', dispatch: false });

    // Single-tap when mic is active -> finalizes and dispatches
    const endTap = evaluatePttRelease(90, { tapToTalk: true, isListening: true });
    assert.deepStrictEqual(endTap, { action: 'FINALIZE', dispatch: true, waitMs: PTT_RELEASE_GRACE_MS });

    // Hold-to-Talk (press, speak, release) -> finalizes and dispatches
    const holdRelease = evaluatePttRelease(600, { tapToTalk: true, isListening: false });
    assert.deepStrictEqual(holdRelease, { action: 'FINALIZE', dispatch: true, waitMs: PTT_RELEASE_GRACE_MS });

    // CallStudio wireup: handles pointermove and touch-slop
    assert.ok(studioSource.includes('onPointerMove={handlePttPointerMove}'), 'PTT button must bind pointermove');
    assert.ok(studioSource.includes('isWithinTouchSlop'), 'CallStudio must use isWithinTouchSlop');
  });
});
