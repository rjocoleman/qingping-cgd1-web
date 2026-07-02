import { describe, expect, it } from 'vitest';
import type { DeviceSettings } from '../protocol/types';
import { isNightModeOff } from './actions';

function settingsWith(overrides: Partial<DeviceSettings>): DeviceSettings {
  return {
    volume: 3,
    language: 'en',
    timeFormat24h: true,
    unitCelsius: true,
    alarmsEnabled: true,
    tzOffsetMinutes: 720,
    screenLightSeconds: 15,
    dayBrightness: 80,
    nightBrightness: 20,
    nightStart: { hour: 22, minute: 0 },
    nightEnd: { hour: 7, minute: 0 },
    nightMode: true,
    ringtoneSignature: new Uint8Array([0xfd, 0xc3, 0x66, 0xa5]),
    rawReserved: new Uint8Array([0x58, 0x02, 0x00]),
    ...overrides,
  };
}

describe('isNightModeOff', () => {
  it('is on for a real window with the flag set', () => {
    expect(isNightModeOff(settingsWith({}))).toBe(false);
  });

  it('is off when the flag is clear', () => {
    expect(isNightModeOff(settingsWith({ nightMode: false }))).toBe(true);
  });

  it('treats the 00:00-00:01 window as off even with the flag set', () => {
    // The firmware has no true off switch; the official app writes this
    // 1-minute window instead, so a clock configured by it must read as off.
    const s = settingsWith({
      nightStart: { hour: 0, minute: 0 },
      nightEnd: { hour: 0, minute: 1 },
    });
    expect(isNightModeOff(s)).toBe(true);
  });
});
