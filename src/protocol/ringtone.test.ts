import { describe, expect, it } from 'vitest';
import {
  CUSTOM_SLOT_A,
  CUSTOM_SLOT_B,
  OFFICIAL_RINGTONES,
  buildAudioInit,
  chunkAudio,
} from './ringtone';

describe('buildAudioInit', () => {
  it('lays out opcode, 3-byte LE size, and 4-byte signature', () => {
    const signature = Uint8Array.of(0xde, 0xad, 0xde, 0xad);
    const out = buildAudioInit(0x010203, signature);
    expect(out).toEqual(Uint8Array.of(0x08, 0x10, 0x03, 0x02, 0x01, 0xde, 0xad, 0xde, 0xad));
  });

  it('rejects a signature that is not 4 bytes', () => {
    expect(() => buildAudioInit(10, Uint8Array.of(1, 2, 3))).toThrow();
  });
});

describe('chunkAudio', () => {
  it('produces one padded packet for a tiny buffer', () => {
    const pcm = Uint8Array.of(1, 2, 3);
    const blocks = chunkAudio(pcm);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toHaveLength(1);
    const packet = blocks[0]?.[0] as Uint8Array;
    expect(packet.length).toBe(2 + 128);
    expect(packet.slice(0, 2)).toEqual(Uint8Array.of(0x81, 0x08));
    expect(packet.slice(2, 5)).toEqual(pcm);
    expect(packet.slice(5)).toEqual(new Uint8Array(125).fill(0xff));
  });

  it('pads the final packet and groups into blocks of four', () => {
    // 5 packets' worth: 4 full (512 bytes) plus 100 bytes needing padding.
    const pcm = new Uint8Array(4 * 128 + 100).map((_, i) => i % 256);
    const blocks = chunkAudio(pcm);
    const allPackets = blocks.flat();
    expect(allPackets).toHaveLength(5);
    expect(blocks[0]).toHaveLength(4);
    expect(blocks[1]).toHaveLength(1);

    const lastPacket = allPackets[4] as Uint8Array;
    const lastPayload = lastPacket.slice(2);
    expect(lastPayload.slice(0, 100)).toEqual(pcm.slice(4 * 128));
    expect(lastPayload.slice(100)).toEqual(new Uint8Array(28).fill(0xff));
  });

  it('produces no blocks for an empty buffer', () => {
    expect(chunkAudio(new Uint8Array(0))).toEqual([]);
  });
});

describe('OFFICIAL_RINGTONES', () => {
  it('has the nine named signatures', () => {
    expect(Object.keys(OFFICIAL_RINGTONES)).toHaveLength(9);
    expect(OFFICIAL_RINGTONES.Beep).toEqual(Uint8Array.of(0xfd, 0xc3, 0x66, 0xa5));
    expect(OFFICIAL_RINGTONES['Forest Piano']).toEqual(Uint8Array.of(0x26, 0x52, 0x25, 0x19));
  });
});

describe('custom slot signatures', () => {
  it('are the alternating de-ad / be-ef markers', () => {
    expect(CUSTOM_SLOT_A).toEqual(Uint8Array.of(0xde, 0xad, 0xde, 0xad));
    expect(CUSTOM_SLOT_B).toEqual(Uint8Array.of(0xbe, 0xef, 0xbe, 0xef));
  });
});
