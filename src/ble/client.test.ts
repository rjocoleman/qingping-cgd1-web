import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeAlarm } from '../protocol/codec';
import type { Alarm } from '../protocol/types';
import { emptyAlarm } from '../protocol/types';
import { createQingpingClientWithDevice } from './client';
import type { BleCharacteristic, BleDeviceHandle, BleServer, BleService } from './transport';
import { AuthRejectedError, CommandError, ConnectionLostError } from './types';

const TOKEN = new Uint8Array(16).fill(0x42);

/** A single fake characteristic: tracks writes, lets the test push notify values in. */
class FakeCharacteristic implements BleCharacteristic {
  value?: DataView;
  writes: Uint8Array[] = [];
  private listeners = new Set<() => void>();
  writeImpl: ((value: Uint8Array) => Promise<void>) | null = null;

  async writeValueWithResponse(value: Uint8Array): Promise<void> {
    this.writes.push(value.slice());
    if (this.writeImpl) await this.writeImpl(value);
  }

  async startNotifications(): Promise<BleCharacteristic> {
    return this;
  }

  async readValue(): Promise<DataView> {
    if (!this.value) throw new Error('no value set');
    return this.value;
  }

  addEventListener(_type: 'characteristicvaluechanged', listener: () => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'characteristicvaluechanged', listener: () => void): void {
    this.listeners.delete(listener);
  }

  /** Test helper: push a notify frame and fire listeners. */
  notify(bytes: Uint8Array): void {
    this.value = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (const listener of this.listeners) listener();
  }
}

class FakeService implements BleService {
  chars = new Map<string, FakeCharacteristic>();

  char(uuid: string): FakeCharacteristic {
    let c = this.chars.get(uuid);
    if (!c) {
      c = new FakeCharacteristic();
      this.chars.set(uuid, c);
    }
    return c;
  }

  async getCharacteristic(uuid: string): Promise<BleCharacteristic> {
    return this.char(uuid);
  }
}

class FakeServer implements BleServer {
  connected = false;
  services = new Map<string, FakeService>();

  service(uuid: string): FakeService {
    let s = this.services.get(uuid);
    if (!s) {
      s = new FakeService();
      this.services.set(uuid, s);
    }
    return s;
  }

  async connect(): Promise<BleServer> {
    this.connected = true;
    return this;
  }

  disconnect(): void {
    this.connected = false;
    for (const listener of this.disconnectListeners) listener();
  }

  disconnectListeners = new Set<() => void>();

  async getPrimaryService(uuid: string): Promise<BleService> {
    return this.service(uuid);
  }
}

class FakeDevice implements BleDeviceHandle {
  id = 'fake-device-1';
  name = 'CGD1-Fake';
  gatt = new FakeServer();
  private listeners = new Set<() => void>();

  addEventListener(_type: 'gattserverdisconnected', listener: () => void): void {
    this.listeners.add(listener);
    this.gatt.disconnectListeners.add(listener);
  }

  removeEventListener(_type: 'gattserverdisconnected', listener: () => void): void {
    this.listeners.delete(listener);
    this.gatt.disconnectListeners.delete(listener);
  }
}

const SERVICE_UUID = '22210000-554a-4546-5542-46534450464d';
const AUTH_WRITE_UUID = '00000001-0000-1000-8000-00805f9b34fb';
const AUTH_NOTIFY_UUID = '00000002-0000-1000-8000-00805f9b34fb';
const DATA_WRITE_UUID = '0000000b-0000-1000-8000-00805f9b34fb';
const DATA_NOTIFY_UUID = '0000000c-0000-1000-8000-00805f9b34fb';

function ackFrame(subcmd: number, status: number): Uint8Array {
  return Uint8Array.of(0x04, 0xff, subcmd, 0x00, status);
}

describe('QingpingClient auth', () => {
  let device: FakeDevice;
  let service: FakeService;

  beforeEach(() => {
    device = new FakeDevice();
    service = device.gatt.service(SERVICE_UUID);
  });

  it('authenticates on the continue-then-success ACK sequence', async () => {
    const authWrite = service.char(AUTH_WRITE_UUID);
    const authNotify = service.char(AUTH_NOTIFY_UUID);
    authWrite.writeImpl = async (value) => {
      const subcmd = value[1] as number;
      if (subcmd === 0x01) authNotify.notify(ackFrame(0x01, 0x02));
      if (subcmd === 0x02) authNotify.notify(ackFrame(0x02, 0x00));
    };

    const client = createQingpingClientWithDevice(device);
    await client.requestDevice();
    await expect(client.connect(TOKEN)).resolves.toBeUndefined();

    expect(authWrite.writes).toHaveLength(2);
    expect(authWrite.writes[0]?.slice(0, 2)).toEqual(Uint8Array.of(0x11, 0x01));
    expect(authWrite.writes[1]?.slice(0, 2)).toEqual(Uint8Array.of(0x11, 0x02));
  });

  it('rejects when step 1 comes back with status 0x01', async () => {
    const authWrite = service.char(AUTH_WRITE_UUID);
    const authNotify = service.char(AUTH_NOTIFY_UUID);
    authWrite.writeImpl = async (value) => {
      const subcmd = value[1] as number;
      if (subcmd === 0x01) authNotify.notify(ackFrame(0x01, 0x01));
    };

    const client = createQingpingClientWithDevice(device);
    await client.requestDevice();
    await expect(client.connect(TOKEN)).rejects.toThrow(AuthRejectedError);
  });

  it('rejects when step 2 comes back with status 0x01', async () => {
    const authWrite = service.char(AUTH_WRITE_UUID);
    const authNotify = service.char(AUTH_NOTIFY_UUID);
    authWrite.writeImpl = async (value) => {
      const subcmd = value[1] as number;
      if (subcmd === 0x01) authNotify.notify(ackFrame(0x01, 0x02));
      if (subcmd === 0x02) authNotify.notify(ackFrame(0x02, 0x01));
    };

    const client = createQingpingClientWithDevice(device);
    await client.requestDevice();
    await expect(client.connect(TOKEN)).rejects.toThrow(AuthRejectedError);
  });

  it('times out when no ACK ever arrives', async () => {
    vi.useFakeTimers();
    try {
      const client = createQingpingClientWithDevice(device);
      await client.requestDevice();
      const connecting = client.connect(TOKEN);
      const assertion = expect(connecting).rejects.toThrow(CommandError);
      await vi.advanceTimersByTimeAsync(10_001);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});

async function authenticate(
  client: ReturnType<typeof createQingpingClientWithDevice>,
  service: FakeService,
) {
  const authWrite = service.char(AUTH_WRITE_UUID);
  const authNotify = service.char(AUTH_NOTIFY_UUID);
  authWrite.writeImpl = async (value) => {
    const subcmd = value[1] as number;
    if (subcmd === 0x01) authNotify.notify(ackFrame(0x01, 0x02));
    if (subcmd === 0x02) authNotify.notify(ackFrame(0x02, 0x00));
  };
  await client.requestDevice();
  await client.connect(TOKEN);
}

describe('QingpingClient commands after auth', () => {
  let device: FakeDevice;
  let service: FakeService;
  let client: ReturnType<typeof createQingpingClientWithDevice>;

  beforeEach(async () => {
    device = new FakeDevice();
    service = device.gatt.service(SERVICE_UUID);
    client = createQingpingClientWithDevice(device);
    await authenticate(client, service);
  });

  it('accumulates alarm slots split across multiple notify frames and resolves once all 16 arrive', async () => {
    const dataWrite = service.char(DATA_WRITE_UUID);
    const dataNotify = service.char(DATA_NOTIFY_UUID);
    dataWrite.writeImpl = async () => {
      const alarms: Alarm[] = Array.from({ length: 16 }, (_, i) =>
        i === 3
          ? { enabled: true, hour: 7, minute: 30, days: new Set(), snooze: false }
          : emptyAlarm(),
      );
      const records = alarms.map((a) =>
        a.hour === 255 ? Uint8Array.of(0xff, 0xff, 0xff, 0xff, 0xff) : encodeAlarm(0, a).slice(3),
      );
      // Split into four notify frames of four slots each, as the device does.
      for (let base = 0; base < 16; base += 4) {
        const body = new Uint8Array(1 + 4 * 5);
        body[0] = base;
        for (let i = 0; i < 4; i++) body.set(records[base + i] as Uint8Array, 1 + i * 5);
        const frame = new Uint8Array(2 + body.length);
        frame.set(Uint8Array.of(0x11, 0x06), 0);
        frame.set(body, 2);
        dataNotify.notify(frame);
      }
    };

    const alarms = await client.readAlarms();
    expect(alarms).toHaveLength(16);
    expect(alarms[3]).toMatchObject({ enabled: true, hour: 7, minute: 30 });
    expect(alarms[0]).toMatchObject({ hour: 255, minute: 255 });
  });

  it('sequences per-block ACKs during ringtone upload, including a final partial block', async () => {
    const dataWrite = service.char(DATA_WRITE_UUID);
    const dataNotify = service.char(DATA_NOTIFY_UUID);
    const blockSizes: number[] = [];
    let packetsSinceAck = 0;
    dataWrite.writeImpl = async (value) => {
      const header = value.slice(0, 2);
      if (header[0] === 0x08 && header[1] === 0x10) {
        dataNotify.notify(ackFrame(0x10, 0x00));
        return;
      }
      if (header[0] === 0x81 && header[1] === 0x08) {
        packetsSinceAck += 1;
        if (packetsSinceAck === 4) {
          blockSizes.push(packetsSinceAck);
          packetsSinceAck = 0;
          dataNotify.notify(ackFrame(0x08, 0x00));
        }
      }
    };

    // 5 packets: one full block of 4, one partial block of 1.
    const pcm = new Uint8Array(4 * 128 + 50).map((_, i) => i % 256);
    const progress: Array<[number, number]> = [];

    // The partial final block's ACK does not naturally fire from the
    // packetsSinceAck===4 check above, so patch it in once the last packet lands.
    let sentPackets = 0;
    const totalPackets = Math.ceil(pcm.length / 128);
    const originalImpl = dataWrite.writeImpl;
    dataWrite.writeImpl = async (value) => {
      const header = value.slice(0, 2);
      if (header[0] === 0x81 && header[1] === 0x08) sentPackets += 1;
      await originalImpl(value);
      if (
        header[0] === 0x81 &&
        header[1] === 0x08 &&
        sentPackets === totalPackets &&
        packetsSinceAck !== 0
      ) {
        packetsSinceAck = 0;
        dataNotify.notify(ackFrame(0x08, 0x00));
      }
    };

    await client.uploadRingtone(pcm, Uint8Array.of(0xde, 0xad, 0xde, 0xad), (sent, total) => {
      progress.push([sent, total]);
    });

    expect(progress).toEqual([
      [512, pcm.length],
      [pcm.length, pcm.length],
    ]);
  });

  it('rejects pending commands with ConnectionLostError on gattserverdisconnected', async () => {
    const dataWrite = service.char(DATA_WRITE_UUID);
    dataWrite.writeImpl = async () => {
      // never ACK - the disconnect below should reject the pending read.
    };

    const pending = client.readSettings();
    device.gatt.disconnect();

    await expect(pending).rejects.toThrow(ConnectionLostError);
  });

  it('reads settings decoded from a 0x13 notify frame', async () => {
    const dataWrite = service.char(DATA_WRITE_UUID);
    const dataNotify = service.char(DATA_NOTIFY_UUID);
    dataWrite.writeImpl = async () => {
      const blob = new Uint8Array(20);
      blob[0] = 0x13;
      blob[1] = 0x01;
      blob[2] = 50;
      dataNotify.notify(blob);
    };

    const settings = await client.readSettings();
    expect(settings.volume).toBe(50);
  });
});
