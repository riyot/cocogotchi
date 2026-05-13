import type { EspEvent, EspService, EspStatus, Handshake, Network, Unsubscribe } from './esp';
import type { EspConfig } from './esp-config';
import { HttpEspService } from './esp-http';
import { MockEspService } from './esp-mock';

function loadBleService(): EspService {
  try {
    // Lazy require so the BLE native module is only touched when the user
    // explicitly picks 'ble' mode — keeps Expo Go (mock/http) safe.
    const { BleEspService } = require('./esp-ble') as typeof import('./esp-ble');
    return new BleEspService();
  } catch (err) {
    return new BrokenBleService(err instanceof Error ? err.message : String(err));
  }
}

class BrokenBleService implements EspService {
  private status: EspStatus;
  constructor(reason: string) {
    this.status = {
      mood: 'sad',
      face: 'SAD',
      saying: `ble unavailable: ${reason}`,
      uptimeSec: 0,
      channel: 0,
      scanning: false,
      counters: { networksSeen: 0, handshakesCaught: 0, deauthsSent: 0, peersSeen: 0 },
    };
  }
  getStatus(): EspStatus { return this.status; }
  getNetworks(): Network[] { return []; }
  getHandshakes(): Handshake[] { return []; }
  subscribe(_l: (e: EspEvent) => void): Unsubscribe { return () => {}; }
  start(): void {}
  stop(): void {}
}

class EspRouter implements EspService {
  private inner: EspService;
  private innerUnsub: Unsubscribe | null = null;
  private listeners = new Set<(e: EspEvent) => void>();
  private started = false;
  private config: EspConfig = { mode: 'mock', baseUrl: 'http://pwn-esp32.local' };

  constructor() {
    this.inner = new MockEspService();
    this.attach();
  }

  applyConfig(cfg: EspConfig) {
    const changed =
      cfg.mode !== this.config.mode ||
      (cfg.mode === 'http' && cfg.baseUrl !== this.config.baseUrl);
    this.config = cfg;
    if (!changed) return;
    this.swapInner(this.buildInner(cfg));
  }

  private buildInner(cfg: EspConfig): EspService {
    switch (cfg.mode) {
      case 'http': return new HttpEspService(cfg.baseUrl);
      case 'ble': return loadBleService();
      default: return new MockEspService();
    }
  }

  currentConfig(): EspConfig {
    return this.config;
  }

  private swapInner(next: EspService) {
    this.inner.stop();
    this.innerUnsub?.();
    this.inner = next;
    this.attach();
    if (this.started) this.inner.start();
  }

  private attach() {
    this.innerUnsub = this.inner.subscribe((e) => {
      for (const l of this.listeners) l(e);
    });
  }

  // EspService methods
  getStatus(): EspStatus {
    return this.inner.getStatus();
  }
  getNetworks(): Network[] {
    return this.inner.getNetworks();
  }
  getHandshakes(): Handshake[] {
    return this.inner.getHandshakes();
  }
  subscribe(listener: (event: EspEvent) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  start(): void {
    this.started = true;
    this.inner.start();
  }
  stop(): void {
    this.started = false;
    this.inner.stop();
  }
}

export const espService: EspService & {
  applyConfig: (cfg: EspConfig) => void;
  currentConfig: () => EspConfig;
} = new EspRouter();
