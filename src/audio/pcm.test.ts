import { describe, expect, it } from 'vitest';
import { floatTo8BitUnsigned, resolveClipWindow, uint8ToFloat } from './pcm';

describe('floatTo8BitUnsigned', () => {
  it('maps silence to 128', () => {
    expect(floatTo8BitUnsigned(Float32Array.of(0))).toEqual(Uint8Array.of(128));
  });

  it('maps -1 to 0 and 1 to 255', () => {
    expect(floatTo8BitUnsigned(Float32Array.of(-1, 1))).toEqual(Uint8Array.of(0, 255));
  });

  it('clamps values outside [-1, 1]', () => {
    expect(floatTo8BitUnsigned(Float32Array.of(-2, 2))).toEqual(Uint8Array.of(0, 255));
  });

  it('round-trips through uint8ToFloat within one 8-bit step', () => {
    const samples = Float32Array.of(-1, -0.5, 0, 0.5, 1);
    const pcm = floatTo8BitUnsigned(samples);
    const back = uint8ToFloat(pcm);
    for (let i = 0; i < samples.length; i++) {
      expect(Math.abs((back[i] as number) - (samples[i] as number))).toBeLessThan(1 / 127.5);
    }
  });
});

describe('uint8ToFloat', () => {
  it('maps 0 to -1, 255 to 1, and 128 to near silence', () => {
    const out = uint8ToFloat(Uint8Array.of(0, 128, 255));
    expect(out[0]).toBeCloseTo(-1, 5);
    expect(out[1]).toBeCloseTo(0, 2);
    expect(out[2]).toBeCloseTo(1, 5);
  });
});

describe('resolveClipWindow', () => {
  it('defaults to the whole clip when it is shorter than the cap', () => {
    expect(resolveClipWindow(10, 30)).toEqual({ startSeconds: 0, durationSeconds: 10 });
  });

  it('caps duration at maxSeconds for a clip longer than the cap', () => {
    expect(resolveClipWindow(60, 30)).toEqual({ startSeconds: 0, durationSeconds: 30 });
  });

  it('honours an explicit start and duration within range', () => {
    expect(resolveClipWindow(60, 30, { startSeconds: 5, durationSeconds: 10 })).toEqual({
      startSeconds: 5,
      durationSeconds: 10,
    });
  });

  it('clamps duration to what remains after start', () => {
    expect(resolveClipWindow(20, 30, { startSeconds: 15, durationSeconds: 10 })).toEqual({
      startSeconds: 15,
      durationSeconds: 5,
    });
  });

  it('clamps a start past the clip end to the clip end, leaving zero duration', () => {
    expect(resolveClipWindow(10, 30, { startSeconds: 50 })).toEqual({
      startSeconds: 10,
      durationSeconds: 0,
    });
  });

  it('clamps a negative start to zero', () => {
    expect(resolveClipWindow(10, 30, { startSeconds: -5 })).toEqual({
      startSeconds: 0,
      durationSeconds: 10,
    });
  });
});
