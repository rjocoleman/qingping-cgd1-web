/** Pure encode/decode for the CGD1 wire protocol. No BLE, no async. */

import { CMD_SET_ALARM, CMD_SET_SETTINGS, CMD_TIME_SYNC } from './const';
import type { Alarm, DeviceSettings, SensorData } from './types';
import { Weekday, emptyAlarm, isAlarmEmpty } from './types';

const RECORD_LENGTH = 5;
const EMPTY_RECORD = Uint8Array.of(0xff, 0xff, 0xff, 0xff, 0xff);

const SETTINGS_LEN = 20;

// Flag byte (index 5) bits. Several are inverted - a clear bit is the "on"
// state - because that is how the device reports its defaults (Chinese,
// 24-hour, Celsius, alarms enabled all decode from a zero byte).
const FLAG_ENGLISH = 0x01;
const FLAG_12H = 0x02;
const FLAG_FAHRENHEIT = 0x04;
const FLAG_ALARMS_OFF = 0x10;

// Timezone offset is stored as whole 6-minute steps plus a separate sign
// flag, rather than a signed byte, presumably to keep the magnitude byte
// small while covering the full +-14h range.
const TZ_STEP_MINUTES = 6;
const TZ_SIGN_POSITIVE = 1;

const BRIGHTNESS_STEP = 10;

// Wire layout of a 0x0100 sensor notify, sent while connected: `00 [temp LE
// int16] [hum LE int16]`, both scaled by /100. The advertisement path (fdcd
// service data, /10 scale) is deliberately not ported here - Web Bluetooth
// cannot see advertisements from a page, so there is nothing to parse.
const CONNECTED_MIN_LEN = 5;
const CONNECTED_SCALE = 100;

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return a.every((byte, i) => byte === b[i]);
}

function encodeAlarmRecord(alarm: Alarm): Uint8Array {
  if (isAlarmEmpty(alarm)) return EMPTY_RECORD;
  let daysMask = 0;
  for (const day of alarm.days) daysMask |= day;
  return Uint8Array.of(
    alarm.enabled ? 1 : 0,
    alarm.hour,
    alarm.minute,
    daysMask,
    alarm.snooze ? 1 : 0,
  );
}

/** Build a set-alarm command for one slot. */
export function encodeAlarm(slot: number, alarm: Alarm): Uint8Array {
  const record = encodeAlarmRecord(alarm);
  const out = new Uint8Array(CMD_SET_ALARM.length + 1 + record.length);
  out.set(CMD_SET_ALARM, 0);
  out[CMD_SET_ALARM.length] = slot;
  out.set(record, CMD_SET_ALARM.length + 1);
  return out;
}

/**
 * Decode one 5-byte alarm record.
 *
 * An all-0xff record is always treated as an empty slot, even if the raw
 * enabled byte would otherwise say true - the device never reports an unused
 * slot as active.
 */
export function decodeAlarm(record: Uint8Array): Alarm {
  if (record.length !== RECORD_LENGTH) {
    throw new Error(`alarm record must be ${RECORD_LENGTH} bytes, got ${record.length}`);
  }
  if (bytesEqual(record, EMPTY_RECORD)) return emptyAlarm();
  const [enabled, hour, minute, daysMask, snooze] = record as unknown as [
    number,
    number,
    number,
    number,
    number,
  ];
  const days = new Set<Weekday>();
  for (const day of [
    Weekday.Monday,
    Weekday.Tuesday,
    Weekday.Wednesday,
    Weekday.Thursday,
    Weekday.Friday,
    Weekday.Saturday,
    Weekday.Sunday,
  ]) {
    if (daysMask & day) days.add(day);
  }
  return { enabled: Boolean(enabled), hour, minute, days, snooze: Boolean(snooze) };
}

function encodeFlags(settings: DeviceSettings): number {
  let flags = 0;
  if (settings.language === 'en') flags |= FLAG_ENGLISH;
  if (!settings.timeFormat24h) flags |= FLAG_12H;
  if (!settings.unitCelsius) flags |= FLAG_FAHRENHEIT;
  if (!settings.alarmsEnabled) flags |= FLAG_ALARMS_OFF;
  return flags;
}

/** Serialise settings into the 20-byte write blob (header 13 01). */
export function encodeSettings(settings: DeviceSettings): Uint8Array {
  const blob = new Uint8Array(SETTINGS_LEN);
  blob.set(CMD_SET_SETTINGS, 0);
  blob[2] = settings.volume;
  blob[3] = settings.rawReserved[0] ?? 0;
  blob[4] = settings.rawReserved[1] ?? 0;
  blob[5] = encodeFlags(settings);
  blob[6] = Math.floor(Math.abs(settings.tzOffsetMinutes) / TZ_STEP_MINUTES);
  blob[7] = settings.screenLightSeconds;
  const dayNibble = settings.dayBrightness / BRIGHTNESS_STEP;
  const nightNibble = settings.nightBrightness / BRIGHTNESS_STEP;
  blob[8] = (dayNibble << 4) | nightNibble;
  blob[9] = settings.nightStart.hour;
  blob[10] = settings.nightStart.minute;
  blob[11] = settings.nightEnd.hour;
  blob[12] = settings.nightEnd.minute;
  blob[13] = settings.tzOffsetMinutes >= 0 ? TZ_SIGN_POSITIVE : 0;
  blob[14] = settings.nightMode ? 1 : 0;
  blob[15] = settings.rawReserved[2] ?? 0;
  blob.set(settings.ringtoneSignature, 16);
  return blob;
}

/** Parse a 20-byte settings blob from a read reply (13 01 or 13 02) or write. */
export function decodeSettings(data: Uint8Array): DeviceSettings {
  if (data.length !== SETTINGS_LEN) {
    throw new Error(`settings blob must be ${SETTINGS_LEN} bytes, got ${data.length}`);
  }
  const header1 = data[1] as number;
  if (data[0] !== CMD_SET_SETTINGS[0] || (header1 !== 0x01 && header1 !== 0x02)) {
    throw new Error(
      `unexpected settings header ${(data[0] ?? 0).toString(16)} ${header1.toString(16)}`,
    );
  }
  const flags = data[5] as number;
  const magnitude = (data[6] as number) * TZ_STEP_MINUTES;
  const sign = data[13] === TZ_SIGN_POSITIVE ? 1 : -1;
  const brightnessByte = data[8] as number;
  return {
    volume: data[2] as number,
    language: flags & FLAG_ENGLISH ? 'en' : 'zh',
    timeFormat24h: !(flags & FLAG_12H),
    unitCelsius: !(flags & FLAG_FAHRENHEIT),
    alarmsEnabled: !(flags & FLAG_ALARMS_OFF),
    tzOffsetMinutes: sign * magnitude,
    screenLightSeconds: data[7] as number,
    dayBrightness: (brightnessByte >> 4) * BRIGHTNESS_STEP,
    nightBrightness: (brightnessByte & 0x0f) * BRIGHTNESS_STEP,
    nightStart: { hour: data[9] as number, minute: data[10] as number },
    nightEnd: { hour: data[11] as number, minute: data[12] as number },
    nightMode: Boolean(data[14]),
    ringtoneSignature: data.slice(16, 20),
    rawReserved: Uint8Array.of(data[3] as number, data[4] as number, data[15] as number),
  };
}

/** Build the time-sync packet: opcode then epoch seconds, little-endian. */
export function encodeTime(epochSeconds: number): Uint8Array {
  const out = new Uint8Array(CMD_TIME_SYNC.length + 4);
  out.set(CMD_TIME_SYNC, 0);
  new DataView(out.buffer).setUint32(CMD_TIME_SYNC.length, epochSeconds, true);
  return out;
}

/**
 * Parse a connected 0x0100 sensor notify (temperature/humidity, /100 scale).
 *
 * The connected stream scales temperature and humidity by /100, unlike the
 * passive advertisement, which uses /10. That path is not ported here at
 * all: Web Bluetooth cannot see advertisements from a page, so there is
 * nothing to guard against by keeping the two divisors side by side, as the
 * Python library does. Battery is not carried in this frame, so it is
 * always null here; it comes from a separate GATT read on the standard
 * battery characteristic instead.
 */
export function parseConnectedSensor(data: Uint8Array): SensorData {
  if (data.length < CONNECTED_MIN_LEN || data[0] !== 0x00) {
    throw new Error('connected sensor frame must start 0x00 and be at least 5 bytes');
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const temperature = view.getInt16(1, true) / CONNECTED_SCALE;
  const humidity = view.getInt16(3, true) / CONNECTED_SCALE;
  return { temperature, humidity, battery: null };
}

/** Parse a `01 0d` firmware read reply: `0b [len] [ASCII]`. */
export function parseFirmware(data: Uint8Array): string {
  const len = data[1] ?? 0;
  return new TextDecoder('ascii').decode(data.slice(2, 2 + len));
}
