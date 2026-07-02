import { beforeEach, describe, expect, it } from 'vitest';
import { isValidTokenHex } from './hex';
import {
  forgetDevice,
  generateAndStoreToken,
  getLastCustomRingtoneSlot,
  getToken,
  nextCustomRingtoneSlot,
  setLastCustomRingtoneSlot,
  setToken,
} from './tokenStore';

beforeEach(() => {
  localStorage.clear();
});

describe('token storage', () => {
  it('returns null for an unknown device', () => {
    expect(getToken('unknown')).toBeNull();
  });

  it('stores and retrieves a token by device id', () => {
    setToken('device-1', 'a'.repeat(32), 'Qingping CGD1');
    expect(getToken('device-1')).toBe('a'.repeat(32));
  });

  it('keeps separate devices independent', () => {
    setToken('device-1', 'a'.repeat(32), 'Bedroom');
    setToken('device-2', 'b'.repeat(32), 'Study');
    expect(getToken('device-1')).toBe('a'.repeat(32));
    expect(getToken('device-2')).toBe('b'.repeat(32));
  });

  it('forgets a device', () => {
    setToken('device-1', 'a'.repeat(32), 'Bedroom');
    forgetDevice('device-1');
    expect(getToken('device-1')).toBeNull();
  });

  it('generates a valid token and stores it', () => {
    const hex = generateAndStoreToken('device-1', 'Bedroom');
    expect(isValidTokenHex(hex)).toBe(true);
    expect(getToken('device-1')).toBe(hex);
  });
});

describe('custom ringtone slot alternation', () => {
  it('defaults to slot a', () => {
    expect(getLastCustomRingtoneSlot('device-1')).toBe('a');
  });

  it('alternates the next slot away from the last used one', () => {
    setToken('device-1', 'a'.repeat(32), 'Bedroom');
    expect(nextCustomRingtoneSlot('device-1')).toBe('b');
    setLastCustomRingtoneSlot('device-1', 'b');
    expect(nextCustomRingtoneSlot('device-1')).toBe('a');
  });

  it('does nothing when setting a slot for a device with no token yet', () => {
    setLastCustomRingtoneSlot('device-1', 'b');
    expect(getLastCustomRingtoneSlot('device-1')).toBe('a');
  });
});
