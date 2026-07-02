/** ACK frame parsing: `04 ff [subcmd] [len] [status]`. */

import { ACK_HEADER } from './const';

export interface Ack {
  subcmd: number;
  status: number;
}

/** Statuses that mean success; 0x02 means "continue" (auth step 1 only). */
export const ACK_STATUS_SUCCESS = new Set([0x00, 0x09]);
export const ACK_STATUS_CONTINUE = 0x02;

export function parseAck(frame: Uint8Array): Ack | null {
  if (frame.length < 5 || frame[0] !== ACK_HEADER[0] || frame[1] !== ACK_HEADER[1]) return null;
  return { subcmd: frame[2] as number, status: frame[4] as number };
}
