/** Hex encode/decode helpers for tokens and the raw settings dump. */

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Parse a hex string into bytes, or null if it is not valid hex of even length. */
export function fromHex(hex: string): Uint8Array | null {
  const cleaned = hex.replace(/\s+/g, '');
  if (cleaned.length === 0 || cleaned.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(cleaned)) {
    return null;
  }
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

const TOKEN_HEX_LENGTH = 32;

/** A pairing token is exactly 16 bytes, written as 32 hex characters. */
export function isValidTokenHex(hex: string): boolean {
  const cleaned = hex.replace(/\s+/g, '');
  return cleaned.length === TOKEN_HEX_LENGTH && /^[0-9a-fA-F]+$/.test(cleaned);
}

const GROUP_HEX_CHARS = 8; // 4 bytes per group

/** Display hex in 4-byte groups, uppercase, for the advanced-tab token view. */
export function groupHex(hex: string): string {
  const cleaned = hex.replace(/\s+/g, '').toUpperCase();
  const groups: string[] = [];
  for (let i = 0; i < cleaned.length; i += GROUP_HEX_CHARS) {
    groups.push(cleaned.slice(i, i + GROUP_HEX_CHARS));
  }
  return groups.join(' ');
}

export function generateTokenHex(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}
