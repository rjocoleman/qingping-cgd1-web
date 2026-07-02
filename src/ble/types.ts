/**
 * The async surface the UI consumes. This is a contract only - the Web
 * Bluetooth implementation lives in client.ts.
 */

import type { Alarm, DeviceInfo, DeviceSettings, SensorData } from '../protocol/types';

export type ConnectionState = 'disconnected' | 'connecting' | 'authenticating' | 'connected';

export type FrameDirection = 'tx' | 'rx';

/** A chosen device. `id` is the opaque per-origin id; there is no MAC over Web Bluetooth. */
export interface DeviceRef {
  id: string;
  name: string | null;
}

/** navigator.bluetooth is missing - unsupported browser. */
export class BleUnsupportedError extends Error {}

/** Auth step 2 came back status 0x01 - the clock is bound to another token. */
export class AuthRejectedError extends Error {}

/** A write got a non-success ACK, or no ACK arrived before the timeout. */
export class CommandError extends Error {}

/** gattserverdisconnected fired while a command was pending. */
export class ConnectionLostError extends Error {}

export interface QingpingClient {
  // allDevices lifts the advertisement filters for clocks whose adverts
  // match none of them; the chooser then lists everything in range.
  requestDevice(opts?: { allDevices?: boolean }): Promise<DeviceRef>;
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
