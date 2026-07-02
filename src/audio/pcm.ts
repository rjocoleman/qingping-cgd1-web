/** Pure float/PCM mapping and clip-window maths - no browser APIs, fully unit-testable. */

export const DEVICE_SAMPLE_RATE = 8000;

/** Map float32 samples in [-1, 1] to 8-bit unsigned PCM (0-255, 128 = silence). */
export function floatTo8BitUnsigned(samples: Float32Array): Uint8Array {
  const out = new Uint8Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    out[i] = Math.round((clamped + 1) * 127.5);
  }
  return out;
}

/** Inverse of floatTo8BitUnsigned, so a preview plays back exactly what the device receives. */
export function uint8ToFloat(pcm: Uint8Array): Float32Array<ArrayBuffer> {
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    out[i] = (pcm[i] as number) / 127.5 - 1;
  }
  return out;
}

export interface ClipWindow {
  startSeconds: number;
  durationSeconds: number;
}

/**
 * Resolve the [start, start+duration] window to render, clamped to the clip's
 * own length and the ringtone cap. `startSeconds` defaults to 0 and
 * `durationSeconds` defaults to whatever remains of the clip after `start`,
 * both bounded so the window never runs past the source audio.
 */
export function resolveClipWindow(
  clipDurationSeconds: number,
  maxSeconds: number,
  opts?: { startSeconds?: number; durationSeconds?: number },
): ClipWindow {
  const startSeconds = Math.max(0, Math.min(opts?.startSeconds ?? 0, clipDurationSeconds));
  const available = Math.max(0, clipDurationSeconds - startSeconds);
  const durationSeconds = Math.min(opts?.durationSeconds ?? available, maxSeconds, available);
  return { startSeconds, durationSeconds };
}
