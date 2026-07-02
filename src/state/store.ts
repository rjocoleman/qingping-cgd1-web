/** Central signals store: connection state, device data, and UI-only flags. */

import { signal } from '@preact/signals';
import { ALARM_SLOT_COUNT } from '../protocol/const';
import type { Alarm, DeviceSettings, SensorData } from '../protocol/types';
import { emptyAlarm } from '../protocol/types';
import type { ConnectionState, DeviceRef, FrameDirection } from '../ble/types';

export type ErrorKind = 'auth' | 'command' | 'lost' | 'generic';

export interface ErrorBannerState {
  message: string;
  kind: ErrorKind;
  retry?: () => void;
}

export interface FrameLogEntry {
  id: number;
  ts: number;
  dir: FrameDirection;
  characteristic: string;
  hex: string;
}

const FRAME_LOG_CAPACITY = 200;
let frameLogSeq = 0;

export const connectionState = signal<ConnectionState>('disconnected');
export const device = signal<DeviceRef | null>(null);
export const settings = signal<DeviceSettings | null>(null);
export const alarms = signal<Alarm[]>(Array.from({ length: ALARM_SLOT_COUNT }, () => emptyAlarm()));
export const sensor = signal<SensorData>({ temperature: null, humidity: null, battery: null });
export const battery = signal<number | null>(null);
export const firmware = signal<string | null>(null);
export const busy = signal<Record<string, boolean>>({});
export const errorBanner = signal<ErrorBannerState | null>(null);
export const frameLog = signal<FrameLogEntry[]>([]);

export const showPairingWizard = signal(false);
export const pairingDevice = signal<DeviceRef | null>(null);
export const pairingAuthRejected = signal(false);
export const pairingBusy = signal(false);
export const pairingError = signal<string | null>(null);

export function setBusy(key: string, value: boolean): void {
  const next = { ...busy.value };
  if (value) next[key] = true;
  else delete next[key];
  busy.value = next;
}

export function isBusy(key: string): boolean {
  return Boolean(busy.value[key]);
}

export function pushFrameLog(dir: FrameDirection, characteristic: string, hex: string): void {
  const entry: FrameLogEntry = { id: frameLogSeq++, ts: Date.now(), dir, characteristic, hex };
  const next = [...frameLog.value, entry];
  frameLog.value =
    next.length > FRAME_LOG_CAPACITY ? next.slice(next.length - FRAME_LOG_CAPACITY) : next;
}

export function clearFrameLog(): void {
  frameLog.value = [];
}

export function resetDeviceState(): void {
  settings.value = null;
  alarms.value = Array.from({ length: ALARM_SLOT_COUNT }, () => emptyAlarm());
  sensor.value = { temperature: null, humidity: null, battery: null };
  battery.value = null;
  firmware.value = null;
}
