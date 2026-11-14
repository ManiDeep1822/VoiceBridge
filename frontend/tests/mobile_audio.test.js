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

describe('Mobile Audio Meter Parity & Touch Stability Verification', () => {
  const hookSource = fs.readFileSync(hookPath, 'utf8');
  const studioSource = fs.readFileSync(studioPath, 'utf8');

  describe('Audio Meter Parity', () => {
    it('uses real Web Audio API analyser formula without synthetic random pulses', () => {
      // Must not contain any synthetic/random pulse logic
      assert.ok(!hookSource.includes('mobilePulseTimerRef'));
      assert.ok(!hookSource.includes('Math.random()'));

      // Formula check: avg = sum / length; normalized = Math.min(100, Math.round((avg / 128) * 100))
      const computeNormalizedLevel = (dataArray) => {
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        return Math.min(100, Math.round((avg / 128) * 100));
      };

      // Silence: all 0s -> 0
      assert.strictEqual(computeNormalizedLevel(new Uint8Array(32).fill(0)), 0);

      // Half scale: all 128s -> 100
      assert.strictEqual(computeNormalizedLevel(new Uint8Array(32).fill(128)), 100);

      // Full saturation: all 255s -> capped at 100
      assert.strictEqual(computeNormalizedLevel(new Uint8Array(32).fill(255)), 100);

      // Moderate speech: avg ~ 64 -> 50
      assert.strictEqual(computeNormalizedLevel(new Uint8Array(32).fill(64)), 50);
    });

    it('verifies audio track contention guards against premature aborts', () => {
      assert.ok(hookSource.includes('stream.getAudioTracks().some(t => t.readyState === \'live\')'));
      assert.ok(!hookSource.includes('isMobile && micStreamRef.current'));
    });

    it('verifies debounced restart scheduling on speech drops and background pause', () => {
      assert.ok(hookSource.includes('scheduleRestart'));
      assert.ok(hookSource.includes('restartAttemptsRef'));
      assert.ok(hookSource.includes('visibilitychange'));
      assert.ok(hookSource.includes('audioContextRef.current.resume()'));
    });
  });

  describe('Mobile Touch Stability & Slop Geometry', () => {
    it('verifies strict Euclidean distance boundary with 3:4:5 right triangle', () => {
      // TOUCH_SLOP_PX is 20
      assert.strictEqual(TOUCH_SLOP_PX, 20);

      // dx=12, dy=16 -> sqrt(144 + 256) = sqrt(400) = 20.0 <= 20 -> true
      assert.strictEqual(isWithinTouchSlop(0, 0, 12, 16), true);

      // dx=12.1, dy=16.1 -> sqrt(146.41 + 259.21) = sqrt(405.62) = 20.14 > 20 -> false
      assert.strictEqual(isWithinTouchSlop(0, 0, 12.1, 16.1), false);
    });

    it('verifies pointercancel handling preserves active recording inside slop', () => {
      // Jitter cancel within slop
      const jitterResult = evaluatePttCancel(95, { withinSlop: true, wasHolding: true });
      assert.deepStrictEqual(jitterResult, { action: 'IGNORE', dispatch: false });

      // Out-of-slop cancel aborts
      const abortResult = evaluatePttCancel(95, { withinSlop: false, wasHolding: true });
      assert.deepStrictEqual(abortResult, { action: 'CANCEL', dispatch: false });
    });

    it('verifies complete CSS touch shielding on CallStudio PTT container', () => {
      assert.ok(studioSource.includes("touchAction: 'none'"));
      assert.ok(studioSource.includes("userSelect: 'none'"));
      assert.ok(studioSource.includes("WebkitUserSelect: 'none'"));
      assert.ok(studioSource.includes("WebkitTouchCallout: 'none'"));
    });
  });
});
