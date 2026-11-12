/**
 * Pure Walkie-Talkie Push-to-Talk (PTT) Logic & Thresholds
 * Eliminates rapid start/stop/cancel loops and accidental tap thrashing.
 */

export const MIN_PTT_HOLD_MS = 200;
export const PTT_RELEASE_GRACE_MS = 500;

/**
 * Evaluates pointer release after a hold-to-talk press.
 * If held >= 200ms, turn is finalized and dispatched after trailing grace period.
 * If held < 200ms (accidental quick tap), recording is cancelled without dispatching
 * and a tooltip prompt ('Hold while speaking') is returned.
 */
export function evaluatePttRelease(durationMs) {
  const d = Number(durationMs) || 0;
  if (d >= MIN_PTT_HOLD_MS) {
    return { action: 'FINALIZE', dispatch: true, waitMs: PTT_RELEASE_GRACE_MS };
  }
  return { action: 'CANCEL', dispatch: false, tooltip: 'Hold while speaking' };
}

/**
 * Evaluates pointer cancellation (e.g. finger slip, touch lost, window blur).
 * If held >= 200ms, turn is finalized and dispatched after trailing grace period.
 * If < 200ms, recording is aborted without dispatch.
 */
export function evaluatePttCancel(durationMs) {
  const d = Number(durationMs) || 0;
  if (d >= MIN_PTT_HOLD_MS) {
    return { action: 'FINALIZE', dispatch: true, waitMs: PTT_RELEASE_GRACE_MS };
  }
  return { action: 'CANCEL', dispatch: false };
}

/**
 * Evaluates keyboard hotkey release (Spacebar).
 * If held >= 200ms, turn is finalized and dispatched after trailing grace period.
 * If < 200ms, speech is cancelled without dispatching.
 */
export function evaluateSpaceKeyUp(durationMs) {
  const d = Number(durationMs) || 0;
  if (d >= MIN_PTT_HOLD_MS) {
    return { action: 'FINALIZE', dispatch: true, waitMs: PTT_RELEASE_GRACE_MS };
  }
  return { action: 'CANCEL', dispatch: false, tooltip: 'Hold while speaking' };
}
