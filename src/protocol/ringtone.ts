/**
 * Ringtone upload framing.
 *
 * Not covered by the Python library (deferred to v2 there); this comes from
 * clOwOck's README plus its Kotlin implementation, which resolves an
 * ambiguity in the README: every packet carries the `81 08` header, not just
 * the first.
 */

import { CMD_AUDIO_INIT, CMD_AUDIO_PACKET } from './const';

const PACKET_PAYLOAD_LEN = 128;
const PACKETS_PER_BLOCK = 4;
const PADDING_BYTE = 0xff;

/** Build the `08 10 [size 3B LE] [signature 4B]` init packet. */
export function buildAudioInit(sizeBytes: number, signature: Uint8Array): Uint8Array {
  if (signature.length !== 4)
    throw new Error(`ringtone signature must be 4 bytes, got ${signature.length}`);
  const out = new Uint8Array(CMD_AUDIO_INIT.length + 3 + 4);
  out.set(CMD_AUDIO_INIT, 0);
  out[2] = sizeBytes & 0xff;
  out[3] = (sizeBytes >> 8) & 0xff;
  out[4] = (sizeBytes >> 16) & 0xff;
  out.set(signature, 5);
  return out;
}

function buildPacket(chunk: Uint8Array): Uint8Array {
  const payload = new Uint8Array(PACKET_PAYLOAD_LEN).fill(PADDING_BYTE);
  payload.set(chunk, 0);
  const out = new Uint8Array(CMD_AUDIO_PACKET.length + PACKET_PAYLOAD_LEN);
  out.set(CMD_AUDIO_PACKET, 0);
  out.set(payload, CMD_AUDIO_PACKET.length);
  return out;
}

/**
 * Split raw PCM into `81 08`-framed packets, grouped into blocks of four.
 *
 * The final packet is padded to 128 bytes with 0xff. The caller waits for
 * the init ACK (`04 ff 10 00 [00|09]`) before sending packets, then a block
 * ACK (`04 ff 08 ...`) after every fourth packet and after the last one,
 * whether or not that last block is full.
 */
export function chunkAudio(pcm: Uint8Array): Uint8Array[][] {
  const packets: Uint8Array[] = [];
  for (let offset = 0; offset < pcm.length; offset += PACKET_PAYLOAD_LEN) {
    packets.push(buildPacket(pcm.slice(offset, offset + PACKET_PAYLOAD_LEN)));
  }
  const blocks: Uint8Array[][] = [];
  for (let i = 0; i < packets.length; i += PACKETS_PER_BLOCK) {
    blocks.push(packets.slice(i, i + PACKETS_PER_BLOCK));
  }
  return blocks;
}

function sig(hex: string): Uint8Array {
  const bytes = hex.match(/.{2}/g) ?? [];
  return Uint8Array.from(bytes.map((b) => Number.parseInt(b, 16)));
}

/** The nine ringtone signatures built into the clock's firmware. */
export const OFFICIAL_RINGTONES: Record<string, Uint8Array> = {
  Beep: sig('fdc366a5'),
  'Digital Ringtone': sig('0961bb77'),
  'Digital Ringtone 2': sig('ba2c2c8c'),
  Cuckoo: sig('ea2d4c02'),
  Telephone: sig('791bacb3'),
  'Exotic Guitar': sig('1d019fd6'),
  'Lively Piano': sig('6e70b659'),
  'Story Piano': sig('8f004886'),
  'Forest Piano': sig('26522519'),
};

// A custom upload must not target the signature the clock currently has
// active, or the device rejects it. Uploads alternate between these two
// slots so the next upload never collides with the last one activated.
export const CUSTOM_SLOT_A = sig('deaddead');
export const CUSTOM_SLOT_B = sig('beefbeef');
