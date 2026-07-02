import { describe, expect, it } from 'vitest';
import { parseAck } from './ack';

describe('parseAck', () => {
  it('parses subcmd and status', () => {
    expect(parseAck(Uint8Array.of(0x04, 0xff, 0x05, 0x00, 0x00))).toEqual({
      subcmd: 0x05,
      status: 0x00,
    });
  });

  it('parses the auth-step-1 continue status', () => {
    expect(parseAck(Uint8Array.of(0x04, 0xff, 0x01, 0x00, 0x02))).toEqual({
      subcmd: 0x01,
      status: 0x02,
    });
  });

  it('returns null for a frame that is too short', () => {
    expect(parseAck(Uint8Array.of(0x04, 0xff, 0x05))).toBeNull();
  });

  it('returns null for a non-ACK header', () => {
    expect(parseAck(Uint8Array.of(0x01, 0x02, 0x05, 0x00, 0x00))).toBeNull();
  });
});
