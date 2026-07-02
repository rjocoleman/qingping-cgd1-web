/** Actions that wrap the client and keep the signals store in sync. */

import { CUSTOM_SLOT_A, CUSTOM_SLOT_B } from '../protocol/ringtone';
import type { Alarm, DeviceSettings } from '../protocol/types';
import { emptyAlarm, isAlarmEmpty } from '../protocol/types';
import { getClient } from './client';
import { fromHex, isValidTokenHex, toHex } from './hex';
import { getAutoSyncTime } from './prefs';
import {
  AuthRejectedError,
  BleUnsupportedError,
  CommandError,
  ConnectionLostError,
  type DeviceRef,
  type QingpingClient,
} from './qingpingClient';
import {
  type ErrorBannerState,
  alarms,
  battery,
  connectionState,
  device,
  errorBanner,
  firmware,
  isBusy,
  pairingAuthRejected,
  pairingBusy,
  pairingDevice,
  pairingError,
  pushFrameLog,
  sensor,
  setBusy,
  settings,
  showPairingWizard,
} from './store';
import * as tokenStore from './tokenStore';

let listenersReady = false;

function initClientListeners(): void {
  if (listenersReady) return;
  listenersReady = true;
  const client = getClient();
  client.onConnectionStateChange((state) => {
    connectionState.value = state;
    if (state === 'connected') errorBanner.value = null;
  });
  client.onSensorData((data) => {
    sensor.value = data;
    if (data.battery !== null) battery.value = data.battery;
  });
  client.onFrame((dir, characteristic, bytes) => {
    pushFrameLog(dir, characteristic, toHex(bytes));
  });
}

function isChooserCancelled(err: unknown): boolean {
  return (
    err instanceof DOMException && (err.name === 'NotFoundError' || err.name === 'SecurityError')
  );
}

const AUTH_REJECTED_COPY =
  'This clock is bound to another app or token. Reset it: hold the button on top until the Bluetooth icon flashes, then pair again.';

function describeError(err: unknown, retry?: () => void): ErrorBannerState {
  if (err instanceof BleUnsupportedError) return { message: err.message, kind: 'generic', retry };
  if (err instanceof ConnectionLostError) {
    return { message: 'Lost the connection to the clock.', kind: 'lost', retry };
  }
  if (err instanceof AuthRejectedError) return { message: AUTH_REJECTED_COPY, kind: 'auth', retry };
  if (err instanceof CommandError) {
    return {
      message: err.message || 'The clock did not respond as expected.',
      kind: 'command',
      retry,
    };
  }
  const message = err instanceof Error ? err.message : 'Something went wrong.';
  return { message, kind: 'generic', retry };
}

async function refreshAll(client: QingpingClient): Promise<void> {
  const [settingsResult, alarmsResult, fw, batt] = await Promise.all([
    client.readSettings(),
    client.readAlarms(),
    client.readFirmware(),
    client.readBattery(),
  ]);
  settings.value = settingsResult;
  alarms.value = alarmsResult;
  firmware.value = fw.firmware;
  battery.value = batt;
}

async function finishConnect(
  client: QingpingClient,
  dev: DeviceRef,
  token: Uint8Array,
  tokenHex: string,
): Promise<void> {
  await client.connect(token);
  tokenStore.setToken(dev.id, tokenHex, dev.name);
  if (getAutoSyncTime()) {
    try {
      await client.syncTime();
    } catch {
      // time sync is a courtesy on connect, not worth surfacing a banner for
    }
  }
  await refreshAll(client);
}

export async function connectFlow(): Promise<void> {
  initClientListeners();
  errorBanner.value = null;
  const client = getClient();
  setBusy('connect', true);
  try {
    const dev = await client.requestDevice();
    device.value = dev;
    const storedHex = tokenStore.getToken(dev.id);
    const storedToken = storedHex ? fromHex(storedHex) : null;
    if (storedHex && storedToken) {
      await finishConnect(client, dev, storedToken, storedHex);
      return;
    }
    pairingDevice.value = dev;
    pairingAuthRejected.value = false;
    pairingError.value = null;
    showPairingWizard.value = true;
  } catch (err) {
    if (isChooserCancelled(err)) {
      // user closed the device picker; nothing to report
    } else if (err instanceof AuthRejectedError) {
      pairingDevice.value = device.value;
      pairingAuthRejected.value = true;
      pairingError.value = AUTH_REJECTED_COPY;
      showPairingWizard.value = true;
    } else {
      errorBanner.value = describeError(err, connectFlow);
    }
  } finally {
    setBusy('connect', false);
  }
}

export async function disconnectFlow(): Promise<void> {
  await getClient().disconnect();
  connectionState.value = 'disconnected';
}

export async function pairAsFreshClock(): Promise<void> {
  const dev = pairingDevice.value;
  if (!dev) return;
  const tokenHex = tokenStore.generateAndStoreToken(dev.id, dev.name);
  const token = fromHex(tokenHex);
  if (!token) return;
  pairingBusy.value = true;
  pairingError.value = null;
  try {
    await finishConnect(getClient(), dev, token, tokenHex);
    showPairingWizard.value = false;
  } catch (err) {
    if (err instanceof AuthRejectedError) {
      pairingAuthRejected.value = true;
      pairingError.value = AUTH_REJECTED_COPY;
    } else {
      pairingError.value = describeError(err).message;
    }
  } finally {
    pairingBusy.value = false;
  }
}

export async function pairByAdoptingToken(hex: string): Promise<void> {
  const dev = pairingDevice.value;
  if (!dev) return;
  if (!isValidTokenHex(hex)) {
    pairingError.value = 'Enter the 32-character hex token (16 bytes).';
    return;
  }
  const token = fromHex(hex);
  if (!token) {
    pairingError.value = 'Enter the 32-character hex token (16 bytes).';
    return;
  }
  pairingBusy.value = true;
  pairingError.value = null;
  try {
    await finishConnect(getClient(), dev, token, toHex(token));
    showPairingWizard.value = false;
  } catch (err) {
    if (err instanceof AuthRejectedError) {
      pairingAuthRejected.value = true;
      pairingError.value = AUTH_REJECTED_COPY;
    } else {
      pairingError.value = describeError(err).message;
    }
  } finally {
    pairingBusy.value = false;
  }
}

export function cancelPairing(): void {
  showPairingWizard.value = false;
  pairingDevice.value = null;
  pairingAuthRejected.value = false;
  pairingError.value = null;
}

export async function syncTimeNow(): Promise<void> {
  setBusy('sync-time', true);
  try {
    await getClient().syncTime();
  } catch (err) {
    errorBanner.value = describeError(err, syncTimeNow);
  } finally {
    setBusy('sync-time', false);
  }
}

export async function previewBeep(volume?: number): Promise<void> {
  try {
    await getClient().previewBeep(volume);
  } catch (err) {
    errorBanner.value = describeError(err);
  }
}

/** Fires the clock's live brightness preview while a slider is being dragged. */
export async function previewBrightness(level: number): Promise<void> {
  try {
    await getClient().setBrightness(level);
  } catch {
    // best-effort live preview; a failed preview is not worth a banner
  }
}

export async function saveSettings(patch: Partial<DeviceSettings>): Promise<void> {
  const current = settings.value;
  if (!current) return;
  const merged: DeviceSettings = {
    ...current,
    ...patch,
    rawReserved: current.rawReserved,
  };
  setBusy('settings', true);
  try {
    await getClient().writeSettings(merged);
    settings.value = merged;
  } catch (err) {
    errorBanner.value = describeError(err, () => saveSettings(patch));
  } finally {
    setBusy('settings', false);
  }
}

export function firstEmptyAlarmSlot(): number | null {
  const idx = alarms.value.findIndex((alarm) => isAlarmEmpty(alarm));
  return idx === -1 ? null : idx;
}

export async function saveAlarm(slot: number, alarm: Alarm): Promise<void> {
  setBusy(`alarm-${slot}`, true);
  try {
    await getClient().writeAlarm(slot, alarm);
    const next = [...alarms.value];
    next[slot] = alarm;
    alarms.value = next;
  } catch (err) {
    errorBanner.value = describeError(err, () => saveAlarm(slot, alarm));
  } finally {
    setBusy(`alarm-${slot}`, false);
  }
}

export async function deleteAlarmSlot(slot: number): Promise<void> {
  setBusy(`alarm-${slot}`, true);
  try {
    await getClient().deleteAlarm(slot);
    const next = [...alarms.value];
    next[slot] = emptyAlarm();
    alarms.value = next;
  } catch (err) {
    errorBanner.value = describeError(err, () => deleteAlarmSlot(slot));
  } finally {
    setBusy(`alarm-${slot}`, false);
  }
}

export async function activateRingtone(signature: Uint8Array): Promise<void> {
  await saveSettings({ ringtoneSignature: signature });
}

/** Upload already-converted PCM (the caller converts once, for preview and upload alike). */
export async function uploadCustomRingtone(
  pcm: Uint8Array,
  onProgress: (sent: number, total: number) => void,
): Promise<void> {
  const dev = device.value;
  if (!dev) throw new Error('connect to a clock first');
  setBusy('ringtone-upload', true);
  try {
    const slot = tokenStore.nextCustomRingtoneSlot(dev.id);
    const signature = slot === 'a' ? CUSTOM_SLOT_A : CUSTOM_SLOT_B;
    await getClient().uploadRingtone(pcm, signature, onProgress);
    await activateRingtone(signature);
    tokenStore.setLastCustomRingtoneSlot(dev.id, slot);
  } catch (err) {
    errorBanner.value = describeError(err);
    throw err;
  } finally {
    setBusy('ringtone-upload', false);
  }
}

export function exportTokenHex(): string | null {
  const dev = device.value;
  return dev ? tokenStore.getToken(dev.id) : null;
}

export async function adoptTokenHex(hex: string): Promise<void> {
  const dev = device.value;
  if (!dev) throw new Error('connect to a clock first');
  if (!isValidTokenHex(hex)) throw new Error('enter the 32-character hex token (16 bytes)');
  const token = fromHex(hex);
  if (!token) throw new Error('enter the 32-character hex token (16 bytes)');
  setBusy('adopt-token', true);
  try {
    await getClient().connect(token);
    tokenStore.setToken(dev.id, toHex(token), dev.name);
    if (getAutoSyncTime()) {
      try {
        await getClient().syncTime();
      } catch {
        // non-fatal
      }
    }
    await refreshAll(getClient());
  } catch (err) {
    errorBanner.value = describeError(err);
    throw err;
  } finally {
    setBusy('adopt-token', false);
  }
}

export function generateNewToken(): string | null {
  const dev = device.value;
  return dev ? tokenStore.generateAndStoreToken(dev.id, dev.name) : null;
}

export { isBusy };
