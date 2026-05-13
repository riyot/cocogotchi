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

const POLL_MS = 2000;
const SCAN_TTL_MS = 60_000;
const MAX_NETWORKS = 80;

type RemoteStatus = {
  name?: string;
  uptimeSec?: number;
  ip?: string;
  rssi?: number;
  nets?: number;
  scanAge?: number;
  firmware?: string;
};

type RemoteNetwork = {
  ssid: string;
  bssid: string;
  rssi: number;
  ch: number;
  ageSec: number;
};

const initialStatus = (): EspStatus => ({
  mood: 'awake',
  face: 'AWAKE' as FaceName,
  saying: 'http: waiting for esp...',
  uptimeSec: 0,
  channel: 0,
  scanning: false,
  counters: { networksSeen: 0, handshakesCaught: 0, deauthsSent: 0, peersSeen: 0 },
});

export class HttpEspService implements EspService {
  private baseUrl: string;
  private status: EspStatus = initialStatus();
  private networks = new Map<string, Network>();
  private handshakes: Handshake[] = [];
  private listeners = new Set<(e: EspEvent) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private failureStreak = 0;
  private firstScanSeen = false;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
    this.firstScanSeen = false;
  }

  getStatus(): EspStatus {
    return this.status;
  }

  getNetworks(): Network[] {
    return Array.from(this.networks.values()).sort((a, b) => b.seenAt - a.seenAt);
  }

  getHandshakes(): Handshake[] {
    return [...this.handshakes];
  }

  subscribe(listener: (event: EspEvent) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    if (this.timer) return;
    this.poll();
    this.timer = setInterval(() => this.poll(), POLL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private emit(event: EspEvent) {
    for (const l of this.listeners) l(event);
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`http ${res.status}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(t);
    }
  }

  private async poll() {
    try {
      const [remote, nets] = await Promise.all([
        this.fetchJson<RemoteStatus>('/status'),
        this.fetchJson<RemoteNetwork[]>('/scan'),
      ]);
      this.failureStreak = 0;
      this.mergeStatus(remote, nets.length);
      this.mergeNetworks(nets);
      this.emit({ type: 'tick', at: Date.now(), status: this.status });
    } catch (err) {
      this.failureStreak++;
      this.status = {
        ...this.status,
        scanning: false,
        saying:
          this.failureStreak < 3
            ? 'http: retrying...'
            : `http: lost ${this.baseUrl} (${this.failureStreak} fails)`,
      };
      this.emit({ type: 'tick', at: Date.now(), status: this.status });
    }
  }

  private mergeStatus(remote: RemoteStatus, scanCount: number) {
    const ageSec = remote.scanAge ?? 0;
    const mood: Mood =
      scanCount === 0 ? 'lonely' : ageSec < 10 ? 'excited' : 'looking';
    const face: FaceName =
      mood === 'lonely' ? 'LONELY' : mood === 'excited' ? 'EXCITED' : 'LOOK_R';
    this.status = {
      mood,
      face,
      saying: `${remote.firmware ?? 'esp'} · up ${remote.uptimeSec ?? 0}s · rssi ${remote.rssi ?? 0}`,
      uptimeSec: remote.uptimeSec ?? this.status.uptimeSec,
      channel: 0,
      scanning: true,
      counters: {
        ...this.status.counters,
        networksSeen: Math.max(this.status.counters.networksSeen, scanCount),
      },
    };
  }

  private mergeNetworks(remote: RemoteNetwork[]) {
    const now = Date.now();
    const seen = new Set<string>();
    for (const r of remote) {
      seen.add(r.bssid);
      const existed = this.networks.has(r.bssid);
      const seenAt = now - r.ageSec * 1000;
      const net: Network = {
        ssid: r.ssid,
        bssid: r.bssid,
        rssi: r.rssi,
        channel: r.ch,
        seenAt,
      };
      this.networks.set(r.bssid, net);
      if (!existed && this.firstScanSeen) {
        this.emit({ type: 'network', at: now, network: net });
      }
    }
    // evict stale entries
    for (const [bssid, net] of this.networks) {
      if (!seen.has(bssid) && now - net.seenAt > SCAN_TTL_MS) {
        this.networks.delete(bssid);
      }
    }
    // cap size
    if (this.networks.size > MAX_NETWORKS) {
      const sorted = Array.from(this.networks.entries()).sort(
        (a, b) => a[1].seenAt - b[1].seenAt
      );
      for (let i = 0; i < this.networks.size - MAX_NETWORKS; i++) {
        this.networks.delete(sorted[i][0]);
      }
    }
    this.firstScanSeen = true;
  }
}
