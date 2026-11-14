/**
 * Pure Walkie-Talkie Push-to-Talk (PTT) Logic & Thresholds
 * Eliminates rapid start/stop/cancel loops, touchscreen slips, and accidental tap thrashing.
 */

export const MIN_PTT_HOLD_MS = 200;
export const PTT_RELEASE_GRACE_MS = 500;
export const TOUCH_SLOP_PX = 20;

/**
 * Calculates Euclidean distance between touch start and current point,
 * returning whether the movement is within the allowable touch-slop buffer.
 */
export function isWithinTouchSlop(startX, startY, currentX, currentY, maxSlop = TOUCH_SLOP_PX) {
  const dx = (Number(currentX) || 0) - (Number(startX) || 0);
  const dy = (Number(currentY) || 0) - (Number(startY) || 0);
  return Math.hypot(dx, dy) <= maxSlop;
}

/**
 * Evaluates pointer release after a hold-to-talk press or single tap.
 * If held >= 200ms, turn is finalized and dispatched after trailing grace period.
 * If held < 200ms in tap-to-talk mode, toggles or keeps listening.
 * If held < 200ms in pure hold mode, recording is cancelled without dispatching
 * and a tooltip prompt ('Hold while speaking') is returned.
 */
export function evaluatePttRelease(durationMs, { tapToTalk = false, isListening = false } = {}) {
  const d = Number(durationMs) || 0;
  if (d >= MIN_PTT_HOLD_MS) {
    return { action: 'FINALIZE', dispatch: true, waitMs: PTT_RELEASE_GRACE_MS };
  }
  if (tapToTalk) {
    if (isListening) {
      return { action: 'FINALIZE', dispatch: true, waitMs: PTT_RELEASE_GRACE_MS };
    }
    return { action: 'KEEP_LISTENING', dispatch: false };
  }
  return { action: 'CANCEL', dispatch: false, tooltip: 'Hold while speaking' };
}

/**
 * Evaluates pointer cancellation (e.g. finger slip, touch lost, window blur).
 * If held >= 200ms, turn is finalized and dispatched after trailing grace period.
 * If < 200ms and within the touch-slop buffer during an active hold session,
 * slight finger movements do not abort active speech.
 * If < 200ms and outside slop, recording is aborted without dispatch.
 */
export function evaluatePttCancel(durationMs, { withinSlop = false, wasHolding = false } = {}) {
  const d = Number(durationMs) || 0;
  if (d >= MIN_PTT_HOLD_MS) {
    return { action: 'FINALIZE', dispatch: true, waitMs: PTT_RELEASE_GRACE_MS };
  }
  if (withinSlop && wasHolding) {
    return { action: 'IGNORE', dispatch: false };
  }
  return { action: 'CANCEL', dispatch: false };
}

/**
 * Evaluates keyboard hotkey release (Spacebar).
 * If held >= 200ms, turn is finalized and dispatched after trailing grace period.
 * If < 200ms in tap-to-talk mode, keeps listening.
 * If < 200ms in pure hold mode, speech is cancelled without dispatching.
 */
export function evaluateSpaceKeyUp(durationMs, { tapToTalk = false, isListening = false } = {}) {
  const d = Number(durationMs) || 0;
  if (d >= MIN_PTT_HOLD_MS) {
    return { action: 'FINALIZE', dispatch: true, waitMs: PTT_RELEASE_GRACE_MS };
  }
  if (tapToTalk) {
    if (isListening) {
      return { action: 'FINALIZE', dispatch: true, waitMs: PTT_RELEASE_GRACE_MS };
    }
    return { action: 'KEEP_LISTENING', dispatch: false };
  }
  return { action: 'CANCEL', dispatch: false, tooltip: 'Hold while speaking' };
}
