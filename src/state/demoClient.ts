/**
 * Fake QingpingClient with plausible data, for exercising and screenshotting
 * the UI without hardware. Activated by `?demo` in the URL. Emits the same
 * frame-log traffic shape a real connection would, built from the real
 * protocol codec so the Advanced tab's log reads like a real capture.
 */

import { encodeAlarm, encodeSettings, encodeTime } from '../protocol/codec';
import {
  ACK_HEADER,
  AUTH_STEP1,
  AUTH_STEP2,
  BATTERY_UUID,
  CMD_AUDIO_INIT,
  CMD_BEEP_PREVIEW_VOLUME,
  CMD_BRIGHTNESS,
  CMD_READ_ALARMS,
  CMD_READ_FIRMWARE,
  CMD_READ_SETTINGS,
  CMD_SET_ALARM,
  CMD_SET_SETTINGS,
  CMD_TIME_SYNC,
  DATA_NOTIFY_UUID,
  DATA_WRITE_UUID,
} from '../protocol/const';
import { chunkAudio } from '../protocol/ringtone';
import type { Alarm, DeviceSettings, SensorData } from '../protocol/types';
import { Weekday, emptyAlarm } from '../protocol/types';
import { fromHex, toHex } from './hex';
import type { ConnectionState, DeviceRef, FrameDirection, QingpingClient } from '../ble/types';
import { AuthRejectedError, CommandError } from '../ble/types';

const DEMO_DEVICE: DeviceRef = { id: 'demo-device-1', name: 'Qingping CGD1' };
const DEMO_FIRMWARE = '1.4.2';
const SENSOR_TICK_MS = 2000;
const SHORT_DELAY_MS = 90;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function demoSettings(): DeviceSettings {
  return {
    volume: 3,
    language: 'en',
    timeFormat24h: true,
    unitCelsius: true,
    alarmsEnabled: true,
    tzOffsetMinutes: -new Date().getTimezoneOffset(),
    screenLightSeconds: 8,
    dayBrightness: 80,
    nightBrightness: 20,
    nightStart: { hour: 22, minute: 0 },
    nightEnd: { hour: 6, minute: 30 },
    nightMode: true,
    ringtoneSignature: fromHex('fdc366a5') as Uint8Array,
    rawReserved: Uint8Array.of(0, 0, 0),
  };
}

function demoAlarms(): Alarm[] {
  const slots = Array.from({ length: 16 }, () => emptyAlarm());
  slots[2] = {
    enabled: true,
    hour: 6,
    minute: 45,
    days: new Set([
      Weekday.Monday,
      Weekday.Tuesday,
      Weekday.Wednesday,
      Weekday.Thursday,
      Weekday.Friday,
    ]),
    snooze: true,
  };
  slots[5] = {
    enabled: true,
    hour: 8,
    minute: 30,
    days: new Set([Weekday.Saturday, Weekday.Sunday]),
    snooze: true,
  };
  slots[9] = {
    enabled: false,
    hour: 13,
    minute: 0,
    days: new Set(),
    snooze: false,
  };
  return slots;
}

export function createDemoClient(): QingpingClient {
  return new DemoClient();
}

class DemoClient implements QingpingClient {
  private deviceRef: DeviceRef | null = null;
  private boundTokenHex: string | null = null;
  private settings: DeviceSettings = demoSettings();
  private alarms: Alarm[] = demoAlarms();
  private battery = 82;
  private sensor: SensorData = { temperature: 21.4, humidity: 46, battery: this.battery };
  private sensorTimer: ReturnType<typeof setInterval> | null = null;
  private sensorTicks = 0;

  private connectionListeners = new Set<(state: ConnectionState) => void>();
  private sensorListeners = new Set<(data: SensorData) => void>();
  private frameListeners = new Set<
    (dir: FrameDirection, characteristic: string, bytes: Uint8Array) => void
  >();

  get device(): DeviceRef | null {
    return this.deviceRef;
  }

  private setConnectionState(state: ConnectionState): void {
    for (const listener of this.connectionListeners) listener(state);
  }

  private emitFrame(dir: FrameDirection, characteristic: string, bytes: Uint8Array): void {
    for (const listener of this.frameListeners) listener(dir, characteristic, bytes);
  }

  private emitSensor(): void {
    for (const listener of this.sensorListeners) listener(this.sensor);
  }

  private ack(subcmd: number, status = 0x00): Uint8Array {
    return Uint8Array.of(ACK_HEADER[0] as number, ACK_HEADER[1] as number, subcmd, 0x01, status);
  }

  async requestDevice(): Promise<DeviceRef> {
    await delay(SHORT_DELAY_MS);
    this.deviceRef = DEMO_DEVICE;
    return DEMO_DEVICE;
  }

  async connect(token: Uint8Array): Promise<void> {
    if (!this.deviceRef) throw new CommandError('call requestDevice() before connect()');
    this.setConnectionState('connecting');
    this.emitFrame('tx', DATA_WRITE_UUID, AUTH_STEP1);
    await delay(SHORT_DELAY_MS);
    this.emitFrame('rx', DATA_NOTIFY_UUID, this.ack(0x01, 0x02));

    this.setConnectionState('authenticating');
    const tokenHex = toHex(token);
    this.emitFrame('tx', DATA_WRITE_UUID, Uint8Array.of(...AUTH_STEP2, ...token));
    await delay(SHORT_DELAY_MS);

    if (this.boundTokenHex === null) {
      this.boundTokenHex = tokenHex;
    }
    if (tokenHex !== this.boundTokenHex) {
      this.emitFrame('rx', DATA_NOTIFY_UUID, this.ack(0x02, 0x01));
      this.setConnectionState('disconnected');
      throw new AuthRejectedError('this clock is bound to another token');
    }

    this.emitFrame('rx', DATA_NOTIFY_UUID, this.ack(0x02, 0x00));
    this.setConnectionState('connected');
    this.startSensorTicking();
  }

  async disconnect(): Promise<void> {
    this.stopSensorTicking();
    this.setConnectionState('disconnected');
  }

  onConnectionStateChange(listener: (state: ConnectionState) => void): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  onSensorData(listener: (data: SensorData) => void): () => void {
    this.sensorListeners.add(listener);
    return () => this.sensorListeners.delete(listener);
  }

  onFrame(
    listener: (dir: FrameDirection, characteristic: string, bytes: Uint8Array) => void,
  ): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  private startSensorTicking(): void {
    this.stopSensorTicking();
    this.sensorTimer = setInterval(() => {
      this.sensorTicks += 1;
      const tempDrift = (Math.random() - 0.5) * 0.3;
      const humDrift = (Math.random() - 0.5) * 1.2;
      const nextTemp = Math.round((this.sensor.temperature ?? 21) * 10 + tempDrift * 10) / 10;
      const nextHum = Math.round((this.sensor.humidity ?? 46) + humDrift);
      if (this.sensorTicks % 10 === 0 && this.battery > 5) this.battery -= 1;
      this.sensor = {
        temperature: Math.min(28, Math.max(16, nextTemp)),
        humidity: Math.min(70, Math.max(30, nextHum)),
        battery: this.battery,
      };
      this.emitFrame(
        'rx',
        '0100',
        Uint8Array.of(
          0x00,
          Math.round((this.sensor.temperature ?? 0) * 100) & 0xff,
          (Math.round((this.sensor.temperature ?? 0) * 100) >> 8) & 0xff,
          Math.round((this.sensor.humidity ?? 0) * 100) & 0xff,
          (Math.round((this.sensor.humidity ?? 0) * 100) >> 8) & 0xff,
        ),
      );
      this.emitSensor();
    }, SENSOR_TICK_MS);
  }

  private stopSensorTicking(): void {
    if (this.sensorTimer !== null) clearInterval(this.sensorTimer);
    this.sensorTimer = null;
  }

  async readSettings(): Promise<DeviceSettings> {
    this.emitFrame('tx', DATA_WRITE_UUID, CMD_READ_SETTINGS);
    await delay(SHORT_DELAY_MS);
    const blob = encodeSettings(this.settings);
    this.emitFrame('rx', DATA_NOTIFY_UUID, blob);
    return structuredClone(this.settings);
  }

  async writeSettings(settings: DeviceSettings): Promise<void> {
    const blob = encodeSettings(settings);
    this.emitFrame('tx', DATA_WRITE_UUID, blob);
    await delay(SHORT_DELAY_MS);
    this.emitFrame('rx', DATA_NOTIFY_UUID, this.ack(CMD_SET_SETTINGS[0] as number));
    this.settings = structuredClone(settings);
  }

  async readAlarms(): Promise<Alarm[]> {
    this.emitFrame('tx', DATA_WRITE_UUID, CMD_READ_ALARMS);
    await delay(SHORT_DELAY_MS);
    this.alarms.forEach((alarm, slot) => {
      this.emitFrame('rx', DATA_NOTIFY_UUID, encodeAlarm(slot, alarm));
    });
    return structuredClone(this.alarms);
  }

  async writeAlarm(slot: number, alarm: Alarm): Promise<void> {
    const frame = encodeAlarm(slot, alarm);
    this.emitFrame('tx', DATA_WRITE_UUID, frame);
    await delay(SHORT_DELAY_MS);
    this.emitFrame('rx', DATA_NOTIFY_UUID, this.ack(CMD_SET_ALARM[0] as number));
    this.alarms[slot] = structuredClone(alarm);
  }

  async deleteAlarm(slot: number): Promise<void> {
    await this.writeAlarm(slot, emptyAlarm());
  }

  async syncTime(): Promise<void> {
    const frame = encodeTime(Math.floor(Date.now() / 1000));
    this.emitFrame('tx', DATA_WRITE_UUID, frame);
    await delay(SHORT_DELAY_MS);
    this.emitFrame('rx', DATA_NOTIFY_UUID, this.ack(CMD_TIME_SYNC[0] as number));
  }

  async setBrightness(level: number): Promise<void> {
    const frame = Uint8Array.of(...CMD_BRIGHTNESS, level);
    this.emitFrame('tx', DATA_WRITE_UUID, frame);
    await delay(SHORT_DELAY_MS);
    this.emitFrame('rx', DATA_NOTIFY_UUID, this.ack(CMD_BRIGHTNESS[0] as number));
  }

  async previewBeep(volume?: number): Promise<void> {
    const frame = Uint8Array.of(...CMD_BEEP_PREVIEW_VOLUME, volume ?? this.settings.volume);
    this.emitFrame('tx', DATA_WRITE_UUID, frame);
    await delay(SHORT_DELAY_MS);
    this.emitFrame('rx', DATA_NOTIFY_UUID, this.ack(CMD_BEEP_PREVIEW_VOLUME[0] as number));
  }

  async readFirmware(): Promise<{ firmware: string }> {
    this.emitFrame('tx', DATA_WRITE_UUID, CMD_READ_FIRMWARE);
    await delay(SHORT_DELAY_MS);
    const ascii = new TextEncoder().encode(DEMO_FIRMWARE);
    this.emitFrame('rx', DATA_NOTIFY_UUID, Uint8Array.of(0x0b, ascii.length, ...ascii));
    return { firmware: DEMO_FIRMWARE };
  }

  async readBattery(): Promise<number> {
    this.emitFrame('tx', BATTERY_UUID, Uint8Array.of());
    await delay(SHORT_DELAY_MS);
    this.emitFrame('rx', BATTERY_UUID, Uint8Array.of(this.battery));
    return this.battery;
  }

  async uploadRingtone(
    pcm: Uint8Array,
    signature: Uint8Array,
    onProgress?: (sent: number, total: number) => void,
  ): Promise<void> {
    const blocks = chunkAudio(pcm);
    const totalPackets = blocks.reduce((sum, block) => sum + block.length, 0);
    const init = Uint8Array.of(...CMD_AUDIO_INIT, ...toBytes3LE(pcm.length), ...signature);
    this.emitFrame('tx', DATA_WRITE_UUID, init);
    await delay(SHORT_DELAY_MS);
    this.emitFrame('rx', DATA_NOTIFY_UUID, this.ack(0x10));

    let sent = 0;
    const totalMs = 1900;
    const perPacketMs = Math.max(4, Math.floor(totalMs / Math.max(1, totalPackets)));
    for (const block of blocks) {
      for (const packet of block) {
        this.emitFrame('tx', DATA_WRITE_UUID, packet);
        await delay(perPacketMs);
        sent += 1;
        onProgress?.(sent, totalPackets);
      }
      this.emitFrame('rx', DATA_NOTIFY_UUID, this.ack(0x08));
    }
  }
}

function toBytes3LE(value: number): [number, number, number] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff];
}
