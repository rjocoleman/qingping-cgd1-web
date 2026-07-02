import { describe, expect, it } from 'vitest';
import { decodeSettings, encodeSettings } from './codec';
import type { DeviceSettings } from './types';

function hex(s: string): Uint8Array {
  return Uint8Array.from(s.match(/.{2}/g)?.map((b) => Number.parseInt(b, 16)) ?? []);
}

// 20-byte capture: volume 3, English, 24h, Celsius, alarms on, +720 min tz,
// 15s screen light, day 100 / night 50 brightness, night 22:00-07:00, night
// mode on, ringtone 01020304. Reserved bytes [3][4][15] are 58 02 00.
const BLOB = hex('130103580201780fa51600070001010001020304');
const SETTINGS: DeviceSettings = {
  volume: 3,
  language: 'en',
  timeFormat24h: true,
  unitCelsius: true,
  alarmsEnabled: true,
  tzOffsetMinutes: 720,
  screenLightSeconds: 15,
  dayBrightness: 100,
  nightBrightness: 50,
  nightStart: { hour: 22, minute: 0 },
  nightEnd: { hour: 7, minute: 0 },
  nightMode: true,
  ringtoneSignature: hex('01020304'),
  rawReserved: hex('580200'),
};

describe('decodeSettings', () => {
  it('decodes the reference blob', () => {
    expect(decodeSettings(BLOB)).toEqual(SETTINGS);
  });

  it('accepts read-reply header 13 02', () => {
    const reply = new Uint8Array(BLOB);
    reply[1] = 0x02;
    expect(decodeSettings(reply)).toEqual(SETTINGS);
  });

  it('decodes inverted flags: Chinese, 12h, Fahrenheit, alarms off', () => {
    const blob = new Uint8Array(BLOB);
    blob[5] = 0x16;
    const decoded = decodeSettings(blob);
    expect(decoded.language).toBe('zh');
    expect(decoded.timeFormat24h).toBe(false);
    expect(decoded.unitCelsius).toBe(false);
    expect(decoded.alarmsEnabled).toBe(false);
    expect(encodeSettings(decoded)[5]).toBe(0x16);
  });

  it('rejects the wrong length', () => {
    expect(() => decodeSettings(hex('130100'))).toThrow();
  });

  it('rejects an unexpected header', () => {
    const blob = new Uint8Array(BLOB);
    blob[0] = 0x99;
    expect(() => decodeSettings(blob)).toThrow();
  });
});

describe('encodeSettings', () => {
  it('encodes the reference settings', () => {
    expect(encodeSettings(SETTINGS)).toEqual(BLOB);
  });
});

it('round-trips settings', () => {
  expect(decodeSettings(encodeSettings(SETTINGS))).toEqual(SETTINGS);
});

describe('timezone sign and magnitude', () => {
  it.each([
    [720, 0x78, 0x01],
    [0, 0x00, 0x01],
    [-210, 0x23, 0x00],
  ])('offset %i -> byte6 %i, byte13 %i', (offsetMinutes, byte6, byte13) => {
    const settings = { ...SETTINGS, tzOffsetMinutes: offsetMinutes };
    const encoded = encodeSettings(settings);
    expect(encoded[6]).toBe(byte6);
    expect(encoded[13]).toBe(byte13);
    expect(decodeSettings(encoded).tzOffsetMinutes).toBe(offsetMinutes);
  });
});

it('packs brightness into nibbles', () => {
  const settings = { ...SETTINGS, dayBrightness: 0, nightBrightness: 100 };
  const encoded = encodeSettings(settings);
  expect(encoded[8]).toBe(0x0a);
  const decoded = decodeSettings(encoded);
  expect(decoded.dayBrightness).toBe(0);
  expect(decoded.nightBrightness).toBe(100);
});
