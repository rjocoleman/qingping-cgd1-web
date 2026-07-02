/**
 * The async surface the UI consumes. This is a contract only - the Web
 * Bluetooth implementation lands separately once the GATT service UUIDs are
 * confirmed.
 */

import type { Alarm, DeviceInfo, DeviceSettings, SensorData } from '../protocol/types';

export type ConnectionState = 'disconnected' | 'connecting' | 'authenticating' | 'connected';

export interface QingpingClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  onConnectionStateChange(listener: (state: ConnectionState) => void): () => void;
  onSensorData(listener: (data: SensorData) => void): () => void;

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
