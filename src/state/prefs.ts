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
