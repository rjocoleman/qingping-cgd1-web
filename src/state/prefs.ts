/** Small local UI preferences, persisted separately from device tokens. */

const AUTO_SYNC_KEY = 'qingping.autoSyncTime.v1';

function storage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export function getAutoSyncTime(): boolean {
  const raw = storage()?.getItem(AUTO_SYNC_KEY);
  return raw === null || raw === undefined ? true : raw === '1';
}

export function setAutoSyncTime(enabled: boolean): void {
  storage()?.setItem(AUTO_SYNC_KEY, enabled ? '1' : '0');
}

export function isDemoMode(): boolean {
  if (typeof location === 'undefined') return false;
  return new URLSearchParams(location.search).has('demo');
}

export function isBluetoothSupported(): boolean {
  if (isDemoMode()) return true;
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

const NIGHT_WINDOW_KEY = 'qingping.nightWindow.v1';

export interface NightWindow {
  start: { hour: number; minute: number };
  end: { hour: number; minute: number };
}

export function getStoredNightWindow(): NightWindow | null {
  const raw = storage()?.getItem(NIGHT_WINDOW_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as NightWindow;
  } catch {
    return null;
  }
}

export function setStoredNightWindow(window: NightWindow): void {
  storage()?.setItem(NIGHT_WINDOW_KEY, JSON.stringify(window));
}
