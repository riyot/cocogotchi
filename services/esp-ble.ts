import { PermissionsAndroid, Platform } from 'react-native';
import {
  BleManager,
  type Device,
  State,
  type Subscription,
} from 'react-native-ble-plx';

import type { FaceName } from '@/constants/faces';

import type {
  EspEvent,
  EspService,
  EspStatus,
  Handshake,
  Mood,
  Network,
  Unsubscribe,
} from './esp';

const SERVICE_UUID = '0000bee5-0000-1000-8000-00805f9b34fb';
const STATUS_CHAR_UUID = '0000bee6-0000-1000-8000-00805f9b34fb';
const EVENT_CHAR_UUID = '0000bee7-0000-1000-8000-00805f9b34fb';
const CONTROL_CHAR_UUID = '0000bee8-0000-1000-8000-00805f9b34fb';

const DEVICE_PREFIX = 'pwn-';
const SCAN_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 2_000;

export const BLE_CMD = {
  SET_MODE: 0x01,
  SET_CHANNEL: 0x02,
  DEAUTH: 0x03,
  WIPE_HS: 0x06,
  REBOOT: 0xff,
} as const;

const initialStatus = (): EspStatus => ({
  mood: 'awake',
  face: 'AWAKE' as FaceName,
  saying: 'ble: idle',
  uptimeSec: 0,
  channel: 0,
  scanning: false,
  counters: { networksSeen: 0, handshakesCaught: 0, deauthsSent: 0, peersSeen: 0 },
});

function b64ToBytes(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return globalThis.btoa(s);
}

function bssidHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':');
}

function moodFromStatus(flags: number, hs: number, nets: number): Mood {
  if (flags & 0x02) return 'happy';
  if (hs > 10) return 'grateful';
  if (hs > 0) return 'cool';
  if (nets === 0) return 'lonely';
  return 'looking';
}

function faceFromMood(mood: Mood): FaceName {
  switch (mood) {
    case 'happy': return 'HAPPY';
    case 'excited': return 'EXCITED';
    case 'cool': return 'COOL';
    case 'grateful': return 'GRATEFUL';
    case 'looking': return 'LOOK_R';
    case 'lonely': return 'LONELY';
    case 'sleeping': return 'SLEEP';
    case 'intense': return 'INTENSE';
    default: return 'AWAKE';
  }
}

export class BleEspService implements EspService {
  private _manager: BleManager | null = null;
  private status: EspStatus = initialStatus();
  private networks: Network[] = [];
  private handshakes: Handshake[] = [];
  private listeners = new Set<(e: EspEvent) => void>();
  private device: Device | null = null;
  private statusSub: Subscription | null = null;
  private eventSub: Subscription | null = null;
  private disconnectSub: Subscription | null = null;
  private scanning = false;
  private wantsConnect = false;
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  private get manager(): BleManager {
    if (!this._manager) this._manager = new BleManager();
    return this._manager;
  }

  getStatus(): EspStatus { return this.status; }
  getNetworks(): Network[] { return this.networks; }
  getHandshakes(): Handshake[] { return [...this.handshakes]; }

  subscribe(listener: (event: EspEvent) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  start(): void {
    if (this.wantsConnect) return;
    this.wantsConnect = true;
    this.bootstrap().catch((err) => {
      this.setStatus({ saying: `ble: init failed (${err?.message ?? err})`, scanning: false });
    });
  }

  stop(): void {
    this.wantsConnect = false;
    this.clearTimers();
    this.stopScan();
    this.statusSub?.remove();
    this.eventSub?.remove();
    this.disconnectSub?.remove();
    this.statusSub = null;
    this.eventSub = null;
    this.disconnectSub = null;
    if (this.device) this.device.cancelConnection().catch(() => {});
    this.device = null;
    this.setStatus({ saying: 'ble: stopped', scanning: false });
  }

  async sendControl(cmd: number, payload: number[] = []): Promise<void> {
    if (!this.device) throw new Error('not connected');
    const bytes = new Uint8Array([cmd, ...payload]);
    await this.device.writeCharacteristicWithResponseForService(
      SERVICE_UUID,
      CONTROL_CHAR_UUID,
      bytesToB64(bytes)
    );
  }

  private async bootstrap() {
    const granted = await this.ensurePermissions();
    if (!granted) {
      this.setStatus({ saying: 'ble: permissions denied' });
      return;
    }
    await this.waitForPoweredOn();
    this.beginScan();
  }

  private async ensurePermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    const apiLevel =
      typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(String(Platform.Version), 10);
    const perms: string[] =
      apiLevel >= 31
        ? [
            'android.permission.BLUETOOTH_SCAN',
            'android.permission.BLUETOOTH_CONNECT',
          ]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const result = await PermissionsAndroid.requestMultiple(perms as never);
    return Object.values(result).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
  }

  private waitForPoweredOn(): Promise<void> {
    return new Promise((resolve) => {
      const sub = this.manager.onStateChange((s) => {
        if (s === State.PoweredOn) {
          sub.remove();
          resolve();
        }
      }, true);
    });
  }

  private beginScan() {
    if (this.scanning || !this.wantsConnect) return;
    this.scanning = true;
    this.setStatus({ saying: `ble: scanning for ${DEVICE_PREFIX}*...`, scanning: true });
    this.manager.startDeviceScan([SERVICE_UUID], null, (err, dev) => {
      if (err) {
        this.scanning = false;
        this.setStatus({ saying: `ble error: ${err.message}`, scanning: false });
        this.scheduleRetry();
        return;
      }
      if (!dev || !dev.name?.startsWith(DEVICE_PREFIX)) return;
      this.stopScan();
      this.connectTo(dev).catch((e) => {
        this.setStatus({ saying: `ble: connect failed (${e?.message ?? e})`, scanning: false });
        this.scheduleRetry();
      });
    });
    this.scanTimer = setTimeout(() => {
      if (this.scanning && !this.device) {
        this.stopScan();
        this.setStatus({ saying: `ble: no ${DEVICE_PREFIX}* found`, scanning: false });
        this.scheduleRetry();
      }
    }, SCAN_TIMEOUT_MS);
  }

  private stopScan() {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
    if (!this.scanning) return;
    this.scanning = false;
    this.manager.stopDeviceScan();
  }

  private scheduleRetry() {
    if (!this.wantsConnect) return;
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.beginScan();
    }, RETRY_DELAY_MS);
  }

  private clearTimers() {
    if (this.scanTimer) { clearTimeout(this.scanTimer); this.scanTimer = null; }
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
  }

  private async connectTo(dev: Device) {
    this.setStatus({ saying: `ble: connecting ${dev.name}...` });
    const connected = await dev.connect({ requestMTU: 64 });
    await connected.discoverAllServicesAndCharacteristics();
    this.device = connected;
    this.setStatus({ saying: `ble: connected ${dev.name}`, scanning: true });

    this.disconnectSub = connected.onDisconnected((_e, d) => {
      this.statusSub?.remove();
      this.eventSub?.remove();
      this.statusSub = null;
      this.eventSub = null;
      this.device = null;
      this.setStatus({
        saying: `ble: lost ${d?.name ?? ''}`,
        scanning: false,
      });
      if (this.wantsConnect) this.scheduleRetry();
    });

    this.statusSub = connected.monitorCharacteristicForService(
      SERVICE_UUID,
      STATUS_CHAR_UUID,
      (err, ch) => {
        if (err || !ch?.value) return;
        this.handleStatusFrame(b64ToBytes(ch.value));
      }
    );
    this.eventSub = connected.monitorCharacteristicForService(
      SERVICE_UUID,
      EVENT_CHAR_UUID,
      (err, ch) => {
        if (err || !ch?.value) return;
        this.handleEventFrame(b64ToBytes(ch.value));
      }
    );
  }

  private handleStatusFrame(bytes: Uint8Array) {
    if (bytes.length < 12) return;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const uptime = dv.getUint32(0, true);
    const hs = dv.getUint16(4, true);
    const nets = dv.getUint16(6, true);
    const ch = dv.getUint8(8);
    const _mode = dv.getUint8(9);
    const flags = dv.getUint8(10);
    const mood = moodFromStatus(flags, hs, nets);
    this.setStatus({
      mood,
      face: faceFromMood(mood),
      saying: `ble · up ${uptime}s · ch${ch} · nets ${nets} · hs ${hs}`,
      uptimeSec: uptime,
      channel: ch,
      scanning: true,
      counters: {
        networksSeen: nets,
        handshakesCaught: hs,
        deauthsSent: this.status.counters.deauthsSent,
        peersSeen: 0,
      },
    });
  }

  private handleEventFrame(bytes: Uint8Array) {
    if (bytes.length < 1) return;
    if (bytes[0] === 0x10 && bytes.length >= 7) {
      const bssid = bssidHex(bytes.slice(1, 7));
      const ssid = new TextDecoder().decode(bytes.slice(7));
      const handshake: Handshake = { ssid, bssid, capturedAt: Date.now() };
      this.handshakes.push(handshake);
      this.emit({ type: 'handshake', at: Date.now(), handshake });
    }
  }

  private setStatus(patch: Partial<EspStatus>) {
    this.status = { ...this.status, ...patch };
    this.emit({ type: 'tick', at: Date.now(), status: this.status });
  }

  private emit(e: EspEvent) {
    for (const l of this.listeners) l(e);
  }
}
