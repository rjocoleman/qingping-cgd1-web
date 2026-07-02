import { describe, expect, it } from 'vitest';
import { encodeTime } from './codec';

describe('encodeTime', () => {
  it('lays out opcode plus little-endian epoch', () => {
    // 2026-07-01T00:00:00Z == 1782864000 == 0x6a445880.
    const out = encodeTime(1782864000);
    expect(out.slice(0, 2)).toEqual(Uint8Array.of(0x05, 0x09));
    expect(out).toEqual(Uint8Array.of(0x05, 0x09, 0x80, 0x58, 0x44, 0x6a));
  });

  it('handles epoch zero', () => {
    expect(encodeTime(0)).toEqual(Uint8Array.of(0x05, 0x09, 0x00, 0x00, 0x00, 0x00));
  });
});
