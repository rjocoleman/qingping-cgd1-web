/**
 * Client factory. `?demo` in the URL selects the in-memory demo client so the
 * UI can be exercised and screenshotted without hardware; otherwise this
 * should hand back the real Web Bluetooth client once `src/ble/*` lands with
 * the agreed contract (`createQingpingClient()` in `src/ble/types.ts`'s final
 * shape). Until that merges, non-demo mode gets a stub that fails clearly
 * rather than importing a module that does not exist yet.
 */

import { createDemoClient } from './demoClient';
import { isDemoMode } from './prefs';
import { BleUnsupportedError } from './qingpingClient';
import type { ConnectionState, DeviceRef, FrameDirection, QingpingClient } from './qingpingClient';

let instance: QingpingClient | null = null;

export function getClient(): QingpingClient {
  instance ??= isDemoMode() ? createDemoClient() : createUnavailableClient();
  return instance;
}

/** Placeholder used until the real Web Bluetooth client is wired in. */
function createUnavailableClient(): QingpingClient {
  const notWired = () =>
    new BleUnsupportedError(
      'The Bluetooth client is not wired into this build yet. Open this app with ?demo to preview it.',
    );
  return {
    device: null,
    requestDevice(): Promise<DeviceRef> {
      return Promise.reject(notWired());
    },
    connect(): Promise<void> {
      return Promise.reject(notWired());
    },
    disconnect(): Promise<void> {
      return Promise.resolve();
    },
    onConnectionStateChange(_listener: (state: ConnectionState) => void) {
      return () => {};
    },
    onSensorData() {
      return () => {};
    },
    onFrame(_listener: (dir: FrameDirection, characteristic: string, bytes: Uint8Array) => void) {
      return () => {};
    },
    readSettings: () => Promise.reject(notWired()),
    writeSettings: () => Promise.reject(notWired()),
    readAlarms: () => Promise.reject(notWired()),
    writeAlarm: () => Promise.reject(notWired()),
    deleteAlarm: () => Promise.reject(notWired()),
    syncTime: () => Promise.reject(notWired()),
    setBrightness: () => Promise.reject(notWired()),
    previewBeep: () => Promise.reject(notWired()),
    readFirmware: () => Promise.reject(notWired()),
    readBattery: () => Promise.reject(notWired()),
    uploadRingtone: () => Promise.reject(notWired()),
  };
}
