/**
 * Client contract mirrored from the final shape of `src/ble/types.ts`, which
 * lands separately once the Web Bluetooth implementation is in place. Kept
 * local (not editing `src/ble/*`) so the UI and demo client have a concrete,
 * typed surface to build against now. Once the real module merges with this
 * shape, importers can switch straight over.
 */

import type { Alarm, DeviceInfo, DeviceSettings, SensorData } from '../protocol/types';

export type ConnectionState = 'disconnected' | 'connecting' | 'authenticating' | 'connected';

export interface DeviceRef {
  id: string;
  name: string | null;
}

export class BleUnsupportedError extends Error {}
export class AuthRejectedError extends Error {}
export class CommandError extends Error {}
export class ConnectionLostError extends Error {}

export type FrameDirection = 'tx' | 'rx';

export interface QingpingClient {
  requestDevice(): Promise<DeviceRef>;
  connect(token: Uint8Array): Promise<void>;
  disconnect(): Promise<void>;

  readonly device: DeviceRef | null;

  onConnectionStateChange(listener: (state: ConnectionState) => void): () => void;
  onSensorData(listener: (data: SensorData) => void): () => void;
  onFrame(
    listener: (dir: FrameDirection, characteristic: string, bytes: Uint8Array) => void,
  ): () => void;

  readSettings(): Promise<DeviceSettings>;
  writeSettings(settings: DeviceSettings): Promise<void>;

  readAlarms(): Promise<Alarm[]>;
  writeAlarm(slot: number, alarm: Alarm): Promise<void>;
  deleteAlarm(slot: number): Promise<void>;

  syncTime(): Promise<void>;
  setBrightness(level: number): Promise<void>;
  previewBeep(volume?: number): Promise<void>;

  readFirmware(): Promise<DeviceInfo>;
  readBattery(): Promise<number>;

  uploadRingtone(
    pcm: Uint8Array,
    signature: Uint8Array,
    onProgress?: (sent: number, total: number) => void,
  ): Promise<void>;
}
