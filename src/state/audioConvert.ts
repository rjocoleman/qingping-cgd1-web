/**
 * Audio conversion, mirrored from the final shape of `src/audio/convert.ts`
 * (landing separately). Kept local (not editing `src/audio/*`) so the
 * ringtones tab has a working convert/preview path now; once the real module
 * merges with this shape, importers can switch straight over.
 */

const DEVICE_SAMPLE_RATE = 8000;

export interface ConvertedAudio {
  pcm: Uint8Array;
  durationSeconds: number;
}

export const MAX_RINGTONE_SECONDS = 30;

export async function convertToDevicePcm(
  data: ArrayBuffer,
  opts?: { startSeconds?: number; durationSeconds?: number },
): Promise<ConvertedAudio> {
  const decodeCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(data.slice(0));
  } finally {
    await decodeCtx.close();
  }

  const startSeconds = Math.max(0, opts?.startSeconds ?? 0);
  const available = Math.max(0, decoded.duration - startSeconds);
  const duration = Math.min(
    opts?.durationSeconds ?? MAX_RINGTONE_SECONDS,
    MAX_RINGTONE_SECONDS,
    available,
  );
  const frameCount = Math.max(1, Math.round(duration * DEVICE_SAMPLE_RATE));

  const offline = new OfflineAudioContext(1, frameCount, DEVICE_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0, startSeconds, duration);
  const rendered = await offline.startRendering();

  const channel = rendered.getChannelData(0);
  const pcm = new Uint8Array(channel.length);
  for (let i = 0; i < channel.length; i++) {
    const clamped = Math.max(-1, Math.min(1, channel[i] ?? 0));
    pcm[i] = Math.round((clamped + 1) * 127.5);
  }
  return { pcm, durationSeconds: duration };
}

export function playPcmPreview(pcm: Uint8Array): { stop(): void } {
  const ctx = new AudioContext();
  const buffer = ctx.createBuffer(1, Math.max(1, pcm.length), DEVICE_SAMPLE_RATE);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < pcm.length; i++) {
    channel[i] = (pcm[i] ?? 128) / 127.5 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
  let stopped = false;
  source.onended = () => {
    if (!stopped) void ctx.close();
  };
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      try {
        source.stop();
      } catch {
        // already stopped
      }
      void ctx.close();
    },
  };
}
