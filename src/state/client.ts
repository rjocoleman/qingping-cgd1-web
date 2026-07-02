/**
 * Client factory. `?demo` in the URL selects the in-memory demo client so the
 * UI can be exercised without hardware; otherwise the real Web Bluetooth
 * client is used.
 */

import { createQingpingClient } from '../ble/client';
import type { QingpingClient } from '../ble/types';
import { createDemoClient } from './demoClient';
import { isDemoMode } from './prefs';

let instance: QingpingClient | null = null;

export function getClient(): QingpingClient {
  instance ??= isDemoMode() ? createDemoClient() : createQingpingClient();
  return instance;
}
