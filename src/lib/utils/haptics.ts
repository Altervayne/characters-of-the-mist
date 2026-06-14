/**
 * Fires a short haptic vibration for touch feedback, when the device supports it.
 *
 * Wraps `navigator.vibrate` behind a capability check so callers can request
 * haptic feedback unconditionally without guarding for unsupported environments
 * (desktop browsers, iOS Safari) where the Vibration API is absent. Centralizing
 * the call keeps the mobile gesture set's feedback coherent: the same pulse the
 * long-press emits is reused for flip, enter-reorder, and toolbelt-open.
 *
 * @param durationMs - Vibration length in milliseconds (default 50, matching the long-press pulse).
 */
export function triggerHaptic(durationMs: number = 50): void {
	if ('vibrate' in navigator) {
		navigator.vibrate(durationMs);
	}
}
