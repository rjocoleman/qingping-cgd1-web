/**
 * The slim subset of the Web Bluetooth surface the client depends on.
 *
 * Real BluetoothDevice/BluetoothRemoteGATTServer/Service/Characteristic
 * objects satisfy these structurally, so no adapter is needed in production.
 * Tests implement them with a fake GATT layer instead of touching the
 * browser API.
 */

export interface BleCharacteristic {
  readonly value?: DataView;
  writeValueWithResponse(value: Uint8Array): Promise<void>;
  startNotifications(): Promise<BleCharacteristic>;
  readValue(): Promise<DataView>;
  addEventListener(type: 'characteristicvaluechanged', listener: () => void): void;
  removeEventListener(type: 'characteristicvaluechanged', listener: () => void): void;
}

export interface BleService {
  getCharacteristic(uuid: string): Promise<BleCharacteristic>;
}

export interface BleServer {
  readonly connected: boolean;
  connect(): Promise<BleServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<BleService>;
}

export interface BleDeviceHandle {
  readonly id: string;
  readonly name?: string;
  readonly gatt?: BleServer;
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void;
  removeEventListener(type: 'gattserverdisconnected', listener: () => void): void;
}

interface RequestDeviceFilter {
  services: string[];
}

interface RequestDeviceOptions {
  filters: RequestDeviceFilter[];
  optionalServices?: string[];
}

interface BluetoothNavigator {
  bluetooth?: {
    requestDevice(options: RequestDeviceOptions): Promise<BleDeviceHandle>;
  };
}

/** Web Bluetooth is not in the standard DOM lib, so this stays a narrow cast. */
export function getBluetooth(): BluetoothNavigator['bluetooth'] {
  return (navigator as unknown as BluetoothNavigator).bluetooth;
}
