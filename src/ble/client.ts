/** Web Bluetooth client for the CGD1. Mirrors qingping_cgd1/client.py's state machine. */

import { ACK_STATUS_SUCCESS, parseAck } from '../protocol/ack';
import {
  decodeAlarm,
  decodeSettings,
  encodeAlarm,
  encodeSettings,
  encodeTime,
  parseConnectedSensor,
  parseFirmware,
} from '../protocol/codec';
import {
  ADVERT_SERVICE_DATA_UUID,
  ALARM_SLOT_COUNT,
  AUTH_NOTIFY_UUID,
  AUTH_STEP1,
  AUTH_STEP2,
  AUTH_WRITE_UUID,
  BATTERY_SERVICE_UUID,
  BATTERY_UUID,
  CMD_BEEP_PREVIEW,
  CMD_BEEP_PREVIEW_VOLUME,
  CMD_BRIGHTNESS,
  CMD_READ_ALARMS,
  CMD_READ_FIRMWARE,
  CMD_READ_SETTINGS,
  DATA_NOTIFY_UUID,
  DATA_WRITE_UUID,
  SENSOR_NOTIFY_UUID,
  SERVICE_UUID,
} from '../protocol/const';
import { PACKET_PAYLOAD_LEN, buildAudioInit, chunkAudio } from '../protocol/ringtone';
import type { Alarm, DeviceInfo, DeviceSettings, SensorData } from '../protocol/types';
import { emptyAlarm } from '../protocol/types';
import {
  type BleCharacteristic,
  type BleDeviceHandle,
  type BleServer,
  getBluetooth,
} from './transport';
import {
  AuthRejectedError,
  BleUnsupportedError,
  CommandError,
  ConnectionLostError,
  type ConnectionState,
  type DeviceRef,
  type FrameDirection,
  type QingpingClient,
} from './types';

const COMMAND_TIMEOUT_MS = 10_000;
const INIT_ACK_TIMEOUT_MS = 10_000;
const BLOCK_ACK_TIMEOUT_MS = 5_000;
// Short on purpose: a missing auth ACK is tolerated, so this only bounds how
// long the handshake waits before moving on to the settings-read proof.
const AUTH_ACK_TIMEOUT_MS = 3_000;
const BLOCK_ACK_SUBCMD = 0x08;

interface PendingFuture<T> {
  resolve(value: T): void;
  reject(err: Error): void;
}

interface ConnectedCharacteristics {
  authWrite: BleCharacteristic;
  authNotify: BleCharacteristic;
  dataWrite: BleCharacteristic;
  dataNotify: BleCharacteristic;
  sensorNotify: BleCharacteristic;
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function toBytes(view: DataView): Uint8Array {
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}

function hexHeader(payload: Uint8Array): string {
  return Array.from(payload.slice(0, 2))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}

class QingpingClientImpl implements QingpingClient {
  private deviceHandle: BleDeviceHandle | null = null;
  private deviceRef: DeviceRef | null = null;
  private server: BleServer | null = null;
  private chars: ConnectedCharacteristics | null = null;

  private mutex: Promise<void> = Promise.resolve();
  private listenerCleanups: Array<() => void> = [];

  private ackFutures = new Map<number, PendingFuture<number>>();
  private settingsFuture: PendingFuture<Uint8Array> | null = null;
  private firmwareFuture: PendingFuture<Uint8Array> | null = null;
  private alarmFuture: PendingFuture<Alarm[]> | null = null;
  private alarmSlots: (Alarm | null)[] = new Array(ALARM_SLOT_COUNT).fill(null);

  private stateListeners = new Set<(state: ConnectionState) => void>();
  private sensorListeners = new Set<(data: SensorData) => void>();
  private frameListeners = new Set<
    (dir: FrameDirection, characteristic: string, bytes: Uint8Array) => void
  >();

  constructor(private readonly deviceOverride?: BleDeviceHandle) {}

  get device(): DeviceRef | null {
    return this.deviceRef;
  }

  async requestDevice(opts?: { allDevices?: boolean }): Promise<DeviceRef> {
    if (this.deviceOverride) {
      this.deviceHandle = this.deviceOverride;
    } else {
      const bluetooth = getBluetooth();
      if (!bluetooth) throw new BleUnsupportedError('this browser does not support Web Bluetooth');
      const optionalServices = [SERVICE_UUID, BATTERY_SERVICE_UUID];
      if (opts?.allDevices) {
        this.deviceHandle = await bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices,
        });
      } else {
        // The chooser only lists devices whose ADVERTISEMENT matches a
        // filter, and the CGD1 does not reliably advertise its vendor
        // service UUID - it mainly broadcasts fdcd service data (the HA
        // integration needs both matchers for the same reason). Filters OR
        // together, so cast the net wide.
        const filters = [
          { services: [SERVICE_UUID] },
          { serviceData: [{ service: ADVERT_SERVICE_DATA_UUID }] },
          { namePrefix: 'Qingping' },
        ];
        try {
          this.deviceHandle = await bluetooth.requestDevice({ filters, optionalServices });
        } catch (err) {
          // Older Chrome rejects the serviceData filter outright; retry
          // without it rather than failing the whole chooser.
          if (!(err instanceof TypeError)) throw err;
          this.deviceHandle = await bluetooth.requestDevice({
            filters: filters.filter((f) => !('serviceData' in f)),
            optionalServices,
          });
        }
      }
    }
    this.deviceRef = { id: this.deviceHandle.id, name: this.deviceHandle.name ?? null };
    return this.deviceRef;
  }

  async connect(token: Uint8Array): Promise<void> {
    return this.withLock(async () => {
      const deviceHandle = this.deviceHandle;
      if (!deviceHandle) throw new Error('call requestDevice() before connect()');
      this.setState('connecting');
      try {
        const server = await deviceHandle.gatt?.connect();
        if (!server) throw new Error('device has no GATT server');
        this.server = server;

        const service = await server.getPrimaryService(SERVICE_UUID);
        const authWrite = await service.getCharacteristic(AUTH_WRITE_UUID);
        const authNotify = await service.getCharacteristic(AUTH_NOTIFY_UUID);
        const dataWrite = await service.getCharacteristic(DATA_WRITE_UUID);
        const dataNotify = await service.getCharacteristic(DATA_NOTIFY_UUID);
        const sensorNotify = await service.getCharacteristic(SENSOR_NOTIFY_UUID);
        this.chars = { authWrite, authNotify, dataWrite, dataNotify, sensorNotify };

        await authNotify.startNotifications();
        this.addTrackedListener(authNotify, this.onProtocolNotify('auth-notify', authNotify));
        await dataNotify.startNotifications();
        this.addTrackedListener(dataNotify, this.onProtocolNotify('data-notify', dataNotify));
        await sensorNotify.startNotifications();
        this.addTrackedListener(sensorNotify, this.onSensorNotify(sensorNotify));

        deviceHandle.addEventListener('gattserverdisconnected', this.onGattDisconnected);
        this.listenerCleanups.push(() =>
          deviceHandle.removeEventListener('gattserverdisconnected', this.onGattDisconnected),
        );

        this.setState('authenticating');
        await this.authStep(authWrite, concatBytes(AUTH_STEP1, token));
        await this.authStep(authWrite, concatBytes(AUTH_STEP2, token));

        // The device ACKs even a wrong token, so prove the pairing with a
        // privileged read; a bad token surfaces as a timeout or disconnect.
        try {
          await this.requestSettings();
        } catch (err) {
          if (err instanceof AuthRejectedError) throw err;
          throw new AuthRejectedError('the clock did not accept this pairing code');
        }

        this.setState('connected');
      } catch (err) {
        this.teardownConnection(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    });
  }

  async disconnect(): Promise<void> {
    const server = this.server;
    if (server?.connected) server.disconnect();
    this.teardownConnection(new ConnectionLostError('disconnected'));
  }

  onConnectionStateChange(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
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

  async readSettings(): Promise<DeviceSettings> {
    return this.withLock(async () => decodeSettings(await this.requestSettings()));
  }

  async writeSettings(settings: DeviceSettings): Promise<void> {
    return this.withLock(async () => {
      await this.writeWithAck(this.requireDataWrite(), encodeSettings(settings), 'data-write');
    });
  }

  async readAlarms(): Promise<Alarm[]> {
    return this.withLock(() => this.requestAlarms());
  }

  async writeAlarm(slot: number, alarm: Alarm): Promise<void> {
    return this.withLock(async () => {
      await this.writeWithAck(this.requireDataWrite(), encodeAlarm(slot, alarm), 'data-write');
    });
  }

  async deleteAlarm(slot: number): Promise<void> {
    return this.writeAlarm(slot, emptyAlarm());
  }

  async syncTime(): Promise<void> {
    return this.withLock(async () => {
      const payload = encodeTime(Math.floor(Date.now() / 1000));
      await this.writeWithAck(this.requireAuthWrite(), payload, 'auth-write');
    });
  }

  async setBrightness(level: number): Promise<void> {
    if (level < 0 || level > 100) throw new Error(`brightness must be 0-100, got ${level}`);
    return this.withLock(async () => {
      const payload = Uint8Array.of(...CMD_BRIGHTNESS, Math.floor(level / 10));
      await this.writeWithAck(this.requireDataWrite(), payload, 'data-write');
    });
  }

  async previewBeep(volume?: number): Promise<void> {
    return this.withLock(async () => {
      const payload =
        volume === undefined ? CMD_BEEP_PREVIEW : Uint8Array.of(...CMD_BEEP_PREVIEW_VOLUME, volume);
      await this.writeWithAck(this.requireDataWrite(), payload, 'data-write');
    });
  }

  async readFirmware(): Promise<DeviceInfo> {
    return this.withLock(async () => ({ firmware: parseFirmware(await this.requestFirmware()) }));
  }

  async readBattery(): Promise<number> {
    return this.withLock(async () => {
      const server = this.server;
      if (!server) throw new ConnectionLostError('not connected');
      const service = await server.getPrimaryService(BATTERY_SERVICE_UUID);
      const char = await service.getCharacteristic(BATTERY_UUID);
      const view = await char.readValue();
      this.emitFrame('rx', 'battery', toBytes(view));
      return view.getUint8(0);
    });
  }

  async uploadRingtone(
    pcm: Uint8Array,
    signature: Uint8Array,
    onProgress?: (sent: number, total: number) => void,
  ): Promise<void> {
    return this.withLock(async () => {
      const dataWrite = this.requireDataWrite();
      const total = pcm.length;

      await this.writeWithAck(
        dataWrite,
        buildAudioInit(total, signature),
        'data-write',
        INIT_ACK_TIMEOUT_MS,
      );

      const blocks = chunkAudio(pcm);
      let sent = 0;
      for (const [index, block] of blocks.entries()) {
        const blockAck = this.registerAck(BLOCK_ACK_SUBCMD, BLOCK_ACK_TIMEOUT_MS);
        for (const packet of block) {
          await this.writeRaw(dataWrite, packet, 'data-write');
          sent = Math.min(sent + PACKET_PAYLOAD_LEN, total);
        }
        let status: number;
        try {
          status = await blockAck;
        } catch (err) {
          throw err instanceof CommandError
            ? new CommandError(`ringtone block ${index} failed: ${err.message}`)
            : err;
        }
        if (!ACK_STATUS_SUCCESS.has(status)) {
          throw new CommandError(
            `ringtone block ${index} failed with status 0x${status.toString(16)}`,
          );
        }
        onProgress?.(sent, total);
      }
    });
  }

  // -- connection lifecycle -------------------------------------------------

  private setState(state: ConnectionState): void {
    for (const listener of this.stateListeners) listener(state);
  }

  private onGattDisconnected = (): void => {
    this.teardownConnection(new ConnectionLostError('the device disconnected'));
  };

  // Listeners are added per-connection but the device handle outlives them,
  // so each one is tracked and removed on teardown. Without this, every
  // reconnect stacks another handler and one physical disconnect fans out
  // into several 'disconnected' events.
  private addTrackedListener(char: BleCharacteristic, handler: () => void): void {
    char.addEventListener('characteristicvaluechanged', handler);
    this.listenerCleanups.push(() =>
      char.removeEventListener('characteristicvaluechanged', handler),
    );
  }

  private teardownConnection(err: Error): void {
    for (const cleanup of this.listenerCleanups) cleanup();
    this.listenerCleanups = [];
    for (const fut of this.ackFutures.values()) fut.reject(err);
    this.ackFutures.clear();
    this.settingsFuture?.reject(err);
    this.settingsFuture = null;
    this.firmwareFuture?.reject(err);
    this.firmwareFuture = null;
    this.alarmFuture?.reject(err);
    this.alarmFuture = null;
    this.server = null;
    this.chars = null;
    this.setState('disconnected');
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.mutex.then(fn, fn);
    this.mutex = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private requireDataWrite(): BleCharacteristic {
    if (!this.chars) throw new ConnectionLostError('not connected');
    return this.chars.dataWrite;
  }

  private requireAuthWrite(): BleCharacteristic {
    if (!this.chars) throw new ConnectionLostError('not connected');
    return this.chars.authWrite;
  }

  // -- writes and ACKs -------------------------------------------------------

  private async writeRaw(
    char: BleCharacteristic,
    payload: Uint8Array,
    frameName: string,
  ): Promise<void> {
    this.emitFrame('tx', frameName, payload);
    await char.writeValueWithResponse(payload);
  }

  private registerAck(subcmd: number, timeoutMs: number): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.ackFutures.delete(subcmd);
        reject(new CommandError(`timed out waiting for ack 0x${subcmd.toString(16)}`));
      }, timeoutMs);
      this.ackFutures.set(subcmd, {
        resolve: (status) => {
          clearTimeout(timer);
          this.ackFutures.delete(subcmd);
          resolve(status);
        },
        reject: (err) => {
          clearTimeout(timer);
          this.ackFutures.delete(subcmd);
          reject(err);
        },
      });
    });
  }

  private resolveAck(subcmd: number, status: number): void {
    this.ackFutures.get(subcmd)?.resolve(status);
  }

  private async writeWithAck(
    char: BleCharacteristic,
    payload: Uint8Array,
    frameName: string,
    timeoutMs = COMMAND_TIMEOUT_MS,
  ): Promise<void> {
    const subcmd = payload[1] ?? 0;
    const ack = this.registerAck(subcmd, timeoutMs);
    await this.writeRaw(char, payload, frameName);
    const status = await ack;
    if (!ACK_STATUS_SUCCESS.has(status)) {
      throw new CommandError(
        `command ${hexHeader(payload)} failed with status 0x${status.toString(16)}`,
      );
    }
  }

  // Auth ACK statuses are advisory. Hardware only pins down 0x01 = rejected
  // (bound to a different token); the Python client never checks auth ACKs
  // at all and proves auth with a privileged read instead. So: reject fast
  // on 0x01, tolerate any other status or a missing ACK, and let the
  // settings-read proof in connect() be the real gate. Being stricter here
  // broke first-time binding on real firmware.
  private async authStep(char: BleCharacteristic, payload: Uint8Array): Promise<void> {
    const subcmd = payload[1] as number;
    const ack = this.registerAck(subcmd, AUTH_ACK_TIMEOUT_MS);
    await this.writeRaw(char, payload, 'auth-write');
    let status: number;
    try {
      status = await ack;
    } catch (err) {
      if (err instanceof ConnectionLostError) throw err;
      return;
    }
    if (status === 0x01) throw new AuthRejectedError('the clock is bound to a different token');
  }

  // -- notify-backed reads ---------------------------------------------------

  private requestNotifyResponse<T>(
    write: () => Promise<void>,
    setFuture: (future: PendingFuture<T> | null) => void,
    timeoutMessage: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        setFuture(null);
        reject(new CommandError(timeoutMessage));
      }, COMMAND_TIMEOUT_MS);
      setFuture({
        resolve: (value) => {
          clearTimeout(timer);
          setFuture(null);
          resolve(value);
        },
        reject: (err) => {
          clearTimeout(timer);
          setFuture(null);
          reject(err);
        },
      });
      write().catch((err) => {
        clearTimeout(timer);
        setFuture(null);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }

  private requestSettings(): Promise<Uint8Array> {
    return this.requestNotifyResponse<Uint8Array>(
      () => this.writeRaw(this.requireDataWrite(), CMD_READ_SETTINGS, 'data-write'),
      (f) => {
        this.settingsFuture = f;
      },
      'timed out waiting for settings',
    );
  }

  private requestFirmware(): Promise<Uint8Array> {
    return this.requestNotifyResponse<Uint8Array>(
      () => this.writeRaw(this.requireAuthWrite(), CMD_READ_FIRMWARE, 'auth-write'),
      (f) => {
        this.firmwareFuture = f;
      },
      'timed out waiting for firmware',
    );
  }

  private requestAlarms(): Promise<Alarm[]> {
    this.alarmSlots = new Array(ALARM_SLOT_COUNT).fill(null);
    return this.requestNotifyResponse<Alarm[]>(
      () => this.writeRaw(this.requireDataWrite(), CMD_READ_ALARMS, 'data-write'),
      (f) => {
        this.alarmFuture = f;
      },
      'timed out waiting for alarms',
    );
  }

  // -- notification dispatch --------------------------------------------------

  private onProtocolNotify(frameName: string, char: BleCharacteristic): () => void {
    return () => {
      const view = char.value;
      if (!view) return;
      const bytes = toBytes(view);
      this.emitFrame('rx', frameName, bytes);
      this.dispatchProtocolFrame(bytes);
    };
  }

  private dispatchProtocolFrame(bytes: Uint8Array): void {
    const ack = parseAck(bytes);
    if (ack) {
      this.resolveAck(ack.subcmd, ack.status);
      return;
    }
    if (bytes[0] === 0x13) {
      this.settingsFuture?.resolve(bytes);
      return;
    }
    if (bytes[0] === 0x11 && bytes[1] === 0x06) {
      this.handleAlarmFrame(bytes);
      return;
    }
    if (bytes[0] === 0x0b) {
      this.firmwareFuture?.resolve(bytes);
    }
  }

  private handleAlarmFrame(bytes: Uint8Array): void {
    const base = bytes[2] as number;
    const body = bytes.slice(3);
    for (let offset = 0; offset + 5 <= body.length; offset += 5) {
      const slot = base + offset / 5;
      if (slot >= 0 && slot < ALARM_SLOT_COUNT) {
        this.alarmSlots[slot] = decodeAlarm(body.slice(offset, offset + 5));
      }
    }
    if (this.alarmFuture && this.alarmSlots.every((slot) => slot !== null)) {
      this.alarmFuture.resolve(this.alarmSlots as Alarm[]);
    }
  }

  private onSensorNotify(char: BleCharacteristic): () => void {
    return () => {
      const view = char.value;
      if (!view) return;
      const bytes = toBytes(view);
      this.emitFrame('rx', 'sensor-notify', bytes);
      // Skip frames the parser would reject; a throw here would escape into
      // the DOM event loop as an uncaught error.
      if (bytes[0] !== 0x00 || bytes.length < 5) return;
      const data = parseConnectedSensor(bytes);
      for (const listener of this.sensorListeners) listener(data);
    };
  }

  private emitFrame(dir: FrameDirection, characteristic: string, bytes: Uint8Array): void {
    for (const listener of this.frameListeners) listener(dir, characteristic, bytes);
  }
}

export function createQingpingClient(): QingpingClient {
  return new QingpingClientImpl();
}

/** Test-only escape hatch: inject a fake device so the real GATT flow can be exercised. */
export function createQingpingClientWithDevice(device: BleDeviceHandle): QingpingClient {
  return new QingpingClientImpl(device);
}
