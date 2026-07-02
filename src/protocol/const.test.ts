import { describe, expect, it } from 'vitest';
import * as C from './const';

describe('const', () => {
  it('sets the alarm slot count', () => {
    expect(C.ALARM_SLOT_COUNT).toBe(16);
  });

  it('expands 16-bit shorts onto the standard base UUID', () => {
    expect(C.AUTH_WRITE_UUID).toBe('00000001-0000-1000-8000-00805f9b34fb');
    expect(C.DATA_WRITE_UUID).toBe('0000000b-0000-1000-8000-00805f9b34fb');
    expect(C.DATA_NOTIFY_UUID).toBe('0000000c-0000-1000-8000-00805f9b34fb');
    expect(C.SENSOR_NOTIFY_UUID).toBe('00000100-0000-1000-8000-00805f9b34fb');
    expect(C.BATTERY_UUID).toBe('00002a19-0000-1000-8000-00805f9b34fb');
  });

  it('carries the advertised service UUID', () => {
    expect(C.SERVICE_UUID).toBe('22210000-554a-4546-5542-46534450464d');
  });

  it('sets command prefixes', () => {
    expect(C.CMD_READ_SETTINGS).toEqual(Uint8Array.of(0x01, 0x02));
    expect(C.CMD_READ_ALARMS).toEqual(Uint8Array.of(0x01, 0x06));
    expect(C.CMD_READ_FIRMWARE).toEqual(Uint8Array.of(0x01, 0x0d));
    expect(C.CMD_SET_ALARM).toEqual(Uint8Array.of(0x07, 0x05));
    expect(C.CMD_SET_SETTINGS).toEqual(Uint8Array.of(0x13, 0x01));
    expect(C.CMD_BRIGHTNESS).toEqual(Uint8Array.of(0x02, 0x03));
    expect(C.CMD_TIME_SYNC).toEqual(Uint8Array.of(0x05, 0x09));
    expect(C.AUTH_STEP1).toEqual(Uint8Array.of(0x11, 0x01));
    expect(C.AUTH_STEP2).toEqual(Uint8Array.of(0x11, 0x02));
  });
});
