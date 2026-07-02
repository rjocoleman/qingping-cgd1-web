import { describe, expect, it } from 'vitest';
import { fromHex, generateTokenHex, groupHex, isValidTokenHex, toHex } from './hex';

describe('toHex / fromHex', () => {
  it('round-trips bytes through hex', () => {
    const bytes = Uint8Array.of(0x00, 0xff, 0x1a, 0xb2);
    expect(toHex(bytes)).toBe('00ff1ab2');
    expect(fromHex('00ff1ab2')).toEqual(bytes);
  });

  it('ignores whitespace when decoding', () => {
    expect(fromHex('00 ff 1a b2')).toEqual(Uint8Array.of(0x00, 0xff, 0x1a, 0xb2));
  });

  it('rejects odd-length or non-hex input', () => {
    expect(fromHex('abc')).toBeNull();
    expect(fromHex('zzzz')).toBeNull();
    expect(fromHex('')).toBeNull();
  });
});

describe('isValidTokenHex', () => {
  it('accepts exactly 32 hex characters', () => {
    expect(isValidTokenHex('a'.repeat(32))).toBe(true);
  });

  it('rejects the wrong length', () => {
    expect(isValidTokenHex('a'.repeat(30))).toBe(false);
    expect(isValidTokenHex('a'.repeat(34))).toBe(false);
  });

  it('rejects non-hex characters', () => {
    expect(isValidTokenHex(`${'a'.repeat(31)}z`)).toBe(false);
  });

  it('ignores whitespace grouping', () => {
    expect(isValidTokenHex(`${'ab'.repeat(8)} ${'cd'.repeat(8)}`)).toBe(true);
  });
});

describe('groupHex', () => {
  it('groups into uppercase 4-byte chunks separated by spaces', () => {
    expect(groupHex('deaddeadbeefbeef00112233')).toBe('DEADDEAD BEEFBEEF 00112233');
  });

  it('leaves a trailing partial group as-is', () => {
    expect(groupHex('aabbccddee')).toBe('AABBCCDD EE');
  });
});

describe('generateTokenHex', () => {
  it('produces 32 hex characters', () => {
    const hex = generateTokenHex();
    expect(isValidTokenHex(hex)).toBe(true);
  });

  it('is not deterministic across calls', () => {
    expect(generateTokenHex()).not.toBe(generateTokenHex());
  });
});
