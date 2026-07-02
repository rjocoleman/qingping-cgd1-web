/**
 * GATT identifiers and wire-protocol constants for the Qingping CGD1.
 *
 * Sourced from clOwOck's reverse-engineering notes. There are no checksums,
 * and the byte layouts are fixed.
 */

export const ALARM_SLOT_COUNT = 16;

/** Expand a 16-bit GATT short id onto the standard Bluetooth base UUID. */
export function uuid16(value: number): string {
  return `0000${value.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb`;
}

export const AUTH_WRITE_UUID = uuid16(0x0001);
export const AUTH_NOTIFY_UUID = uuid16(0x0002);
export const DATA_WRITE_UUID = uuid16(0x000b);
export const DATA_NOTIFY_UUID = uuid16(0x000c);
// Connected sensor-notify stream and the standard GATT battery characteristic.
export const SENSOR_NOTIFY_UUID = uuid16(0x0100);
export const BATTERY_UUID = uuid16(0x2a19);
export const BATTERY_SERVICE_UUID = uuid16(0x180f);

export const SERVICE_UUID = '22210000-554a-4546-5542-46534450464d';

export const AUTH_STEP1 = Uint8Array.of(0x11, 0x01);
export const AUTH_STEP2 = Uint8Array.of(0x11, 0x02);

export const CMD_READ_SETTINGS = Uint8Array.of(0x01, 0x02);
export const CMD_READ_ALARMS = Uint8Array.of(0x01, 0x06);
export const CMD_READ_FIRMWARE = Uint8Array.of(0x01, 0x0d);
export const CMD_SET_ALARM = Uint8Array.of(0x07, 0x05);
export const CMD_SET_SETTINGS = Uint8Array.of(0x13, 0x01);
export const CMD_BRIGHTNESS = Uint8Array.of(0x02, 0x03);
export const CMD_BEEP_PREVIEW = Uint8Array.of(0x01, 0x04);
export const CMD_BEEP_PREVIEW_VOLUME = Uint8Array.of(0x02, 0x04);
export const CMD_TIME_SYNC = Uint8Array.of(0x05, 0x09);
export const CMD_AUDIO_INIT = Uint8Array.of(0x08, 0x10);
export const CMD_AUDIO_PACKET = Uint8Array.of(0x81, 0x08);

// `04 ff [subcmd] [len] [status]`. Status 0x00 and 0x09 are success, 0x02 is
// continue (seen after auth step 1).
export const ACK_HEADER = Uint8Array.of(0x04, 0xff);
