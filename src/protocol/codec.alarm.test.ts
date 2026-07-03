import { describe, expect, it } from 'vitest';
import { decodeAlarm, encodeAlarm } from './codec';
import type { Alarm } from './types';
import { emptyAlarm, Weekday } from './types';

function hex(s: string): Uint8Array {
  return Uint8Array.from(s.match(/.{2}/g)?.map((b) => Number.parseInt(b, 16)) ?? []);
}

// A weekday alarm: enabled, 07:30, Mon+Wed+Fri (0x01|0x04|0x10 = 0x15), no snooze.
const WEEKDAY_ALARM: Alarm = {
  enabled: true,
  hour: 7,
  minute: 30,
  days: new Set([Weekday.Monday, Weekday.Wednesday, Weekday.Friday]),
  snooze: false,
};
const WEEKDAY_RECORD = hex('01071e1500');

describe('encodeAlarm', () => {
  it('prefixes opcode and slot', () => {
    const out = encodeAlarm(3, WEEKDAY_ALARM);
    expect(out.slice(0, 3)).toEqual(Uint8Array.of(0x07, 0x05, 0x03));
    expect(out.slice(3)).toEqual(WEEKDAY_RECORD);
  });

  it('encodes an empty alarm as all 0xff', () => {
    expect(encodeAlarm(9, emptyAlarm()).slice(3)).toEqual(hex('ffffffffff'));
  });
});

describe('decodeAlarm', () => {
  it('decodes a weekday record', () => {
    expect(decodeAlarm(WEEKDAY_RECORD)).toEqual(WEEKDAY_ALARM);
  });

  it('decodes an all-0xff record as empty', () => {
    expect(decodeAlarm(hex('ffffffffff')).enabled).toBe(false);
  });

  it('rejects the wrong length', () => {
    expect(() => decodeAlarm(hex('010203'))).toThrow();
  });
});

describe('alarm round-trip', () => {
  const cases: Alarm[] = [
    WEEKDAY_ALARM,
    { enabled: false, hour: 0, minute: 0, days: new Set(), snooze: true },
    {
      enabled: true,
      hour: 23,
      minute: 59,
      days: new Set([
        Weekday.Monday,
        Weekday.Tuesday,
        Weekday.Wednesday,
        Weekday.Thursday,
        Weekday.Friday,
        Weekday.Saturday,
        Weekday.Sunday,
      ]),
      snooze: true,
    },
    emptyAlarm(),
  ];

  it.each(cases)('round-trips %#', (alarm) => {
    expect(decodeAlarm(encodeAlarm(0, alarm).slice(3))).toEqual(alarm);
  });
});
