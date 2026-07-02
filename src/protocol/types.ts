/** A day of the week; the value is the bit used in the alarm days bitmask. */
export enum Weekday {
  Monday = 0x01,
  Tuesday = 0x02,
  Wednesday = 0x04,
  Thursday = 0x08,
  Friday = 0x10,
  Saturday = 0x20,
  Sunday = 0x40,
}

/** Display language reported in the settings flag byte. */
export type Language = 'zh' | 'en';

/** A single alarm slot. Empty `days` means a one-shot alarm. */
export interface Alarm {
  enabled: boolean;
  hour: number;
  minute: number;
  days: Set<Weekday>;
  snooze: boolean;
}

// 255 is never a real hour or minute, so it doubles as the unused-slot marker
// that mirrors the device's all-0xff empty alarm record.
const EMPTY_MARKER = 0xff;

export function emptyAlarm(): Alarm {
  return {
    enabled: false,
    hour: EMPTY_MARKER,
    minute: EMPTY_MARKER,
    days: new Set(),
    snooze: false,
  };
}

export function isAlarmEmpty(alarm: Alarm): boolean {
  return alarm.hour === EMPTY_MARKER && alarm.minute === EMPTY_MARKER;
}

/** The full 20-byte settings blob, decoded. */
export interface DeviceSettings {
  volume: number;
  language: Language;
  timeFormat24h: boolean;
  unitCelsius: boolean;
  alarmsEnabled: boolean;
  /** Signed, always a multiple of 6 (the device's storage step). */
  tzOffsetMinutes: number;
  screenLightSeconds: number;
  dayBrightness: number;
  nightBrightness: number;
  nightStart: { hour: number; minute: number };
  nightEnd: { hour: number; minute: number };
  nightMode: boolean;
  ringtoneSignature: Uint8Array;
  /** Bytes at indices 3, 4, 15 - purpose unknown, echoed back unchanged. */
  rawReserved: Uint8Array;
}

/** A temperature/humidity/battery reading. Any field may be missing. */
export interface SensorData {
  temperature: number | null;
  humidity: number | null;
  battery: number | null;
}

/** Static device metadata. */
export interface DeviceInfo {
  firmware: string;
}
