/**
 * Per-device token storage. Web Bluetooth has no MAC address, so tokens are
 * keyed on `BluetoothDevice.id`, an opaque per-origin identifier, alongside
 * the device name for display and the last custom ringtone slot used (the
 * clock rejects an upload that targets its currently active signature, so
 * uploads alternate between the two custom slots).
 */

import { generateTokenHex } from './hex';

const STORAGE_KEY = 'qingping.tokens.v1';

export type CustomRingtoneSlot = 'a' | 'b';

interface TokenRecord {
  token: string;
  deviceName: string | null;
  lastCustomRingtoneSlot: CustomRingtoneSlot;
}

type TokenStoreShape = Record<string, TokenRecord>;

/** In-memory fallback so this module works outside a browser (tests, SSR). */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
    key: (index) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size;
    },
  };
}

let fallback: Storage | null = null;

function storage(): Storage {
  if (typeof localStorage !== 'undefined') return localStorage;
  fallback ??= memoryStorage();
  return fallback;
}

function readStore(): TokenStoreShape {
  const raw = storage().getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as TokenStoreShape;
  } catch {
    return {};
  }
}

function writeStore(store: TokenStoreShape): void {
  storage().setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getToken(deviceId: string): string | null {
  return readStore()[deviceId]?.token ?? null;
}

export function setToken(deviceId: string, tokenHex: string, deviceName: string | null): void {
  const store = readStore();
  const existing = store[deviceId];
  store[deviceId] = {
    token: tokenHex,
    deviceName,
    lastCustomRingtoneSlot: existing?.lastCustomRingtoneSlot ?? 'a',
  };
  writeStore(store);
}

export function getLastCustomRingtoneSlot(deviceId: string): CustomRingtoneSlot {
  return readStore()[deviceId]?.lastCustomRingtoneSlot ?? 'a';
}

export function setLastCustomRingtoneSlot(deviceId: string, slot: CustomRingtoneSlot): void {
  const store = readStore();
  const existing = store[deviceId];
  if (!existing) return;
  store[deviceId] = { ...existing, lastCustomRingtoneSlot: slot };
  writeStore(store);
}

/** The slot the next custom upload should target: the one not currently active. */
export function nextCustomRingtoneSlot(deviceId: string): CustomRingtoneSlot {
  return getLastCustomRingtoneSlot(deviceId) === 'a' ? 'b' : 'a';
}

export function generateAndStoreToken(deviceId: string, deviceName: string | null): string {
  const hex = generateTokenHex();
  setToken(deviceId, hex, deviceName);
  return hex;
}

export function forgetDevice(deviceId: string): void {
  const store = readStore();
  delete store[deviceId];
  writeStore(store);
}
