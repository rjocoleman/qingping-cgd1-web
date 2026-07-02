/**
 * Audio conversion for ringtone upload: decode whatever the browser can
 * handle, resample to 8 kHz mono, map to 8-bit unsigned PCM - the exact
 * format the clock expects.
 */

import { DEVICE_SAMPLE_RATE, floatTo8BitUnsigned, resolveClipWindow, uint8ToFloat } from './pcm';

export const MAX_RINGTONE_SECONDS = 30;

export interface ConvertedAudio {
  pcm: Uint8Array;
  durationSeconds: number;
}

/** Decode and render the selected window of `data` to device-ready 8-bit unsigned PCM. */
export async function convertToDevicePcm(
  data: ArrayBuffer,
  opts?: { startSeconds?: number; durationSeconds?: number },
): Promise<ConvertedAudio> {
  // The decode context's own rate and length are irrelevant - only its
  // decodeAudioData is used here, and it decodes at the source file's rate.
  const probeContext = new OfflineAudioContext(1, 1, DEVICE_SAMPLE_RATE);
  let decoded: AudioBuffer;
  try {
    decoded = await probeContext.decodeAudioData(data.slice(0));
  } catch {
    throw new Error('could not decode this audio file - try a different file or format');
  }

  const { startSeconds, durationSeconds } = resolveClipWindow(
    decoded.duration,
    MAX_RINGTONE_SECONDS,
    opts,
  );
  const frameCount = Math.max(1, Math.round(durationSeconds * DEVICE_SAMPLE_RATE));
  const renderContext = new OfflineAudioContext(1, frameCount, DEVICE_SAMPLE_RATE);
  const source = renderContext.createBufferSource();
  source.buffer = decoded;
  source.connect(renderContext.destination);
  source.start(0, startSeconds, durationSeconds);

  const rendered = await renderContext.startRendering();
  return { pcm: floatTo8BitUnsigned(rendered.getChannelData(0)), durationSeconds };
}

/** Play back 8-bit unsigned PCM as the clock would receive it - quality loss included. */
export function playPcmPreview(pcm: Uint8Array): { stop(): void } {
  const context = new AudioContext();
  const buffer = context.createBuffer(1, pcm.length, DEVICE_SAMPLE_RATE);
  buffer.copyToChannel(uint8ToFloat(pcm), 0);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
  return {
    stop(): void {
      source.stop();
      void context.close();
    },
  };
}
