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

const SSIDS = [
  'FreeWifi_secure',
  'Livebox-A4F2',
  'iPhone de Marie',
  'Bbox-X7K1',
  'FREEBOX_FCEA',
  'SFR-A8B9',
  'NETGEAR_3000',
  'ASUS_X10',
  'Cafe_Guest',
  'CampusEDU',
  'Pwnagotchi_peer',
  'Pixel_AP',
];

const SAYINGS: Record<Mood, string[]> = {
  awake: ['Hi, I am Pwnagotchi!', 'Scanning the spectrum...', 'AI ready.'],
  looking: ['Sniffing...', 'Looking for friends...', 'Channel hopping !'],
  happy: ['Got a new handshake !', 'Yes ! Another one !', 'CRC32 looks clean.'],
  excited: ['New AP spotted !', 'Oh interesting...', 'A wild SSID appeared !'],
  cool: ['Streaks on streaks.', "I'm on fire 🔥", 'Just sniffing chads.'],
  intense: ['Deauth incoming...', '*pew pew*', 'Disconnect them all !'],
  bored: ['Nothing on the wire.', 'zzz...', 'Where are you all ?'],
  lonely: ['No one around :(', 'It is so quiet here.', 'I miss the chatter.'],
  sad: ['Today was rough.', 'No handshakes :(', "I'll do better tomorrow."],
  angry: ['Attack failed.', "I can't EAPOL today.", 'Stupid client.'],
  grateful: ['So many handshakes today !', 'Thank you wifi gods !', 'A good day.'],
  sleeping: ['zzz...', 'Dreaming of WPA3.', '*snores in IEEE 802.11*'],
};

const FACE_BY_MOOD: Record<Mood, FaceName[]> = {
  awake: ['AWAKE'],
  looking: ['LOOK_R', 'LOOK_L', 'LOOK_R_HAPPY', 'LOOK_L_HAPPY'],
  happy: ['HAPPY'],
  excited: ['EXCITED'],
  cool: ['COOL'],
  intense: ['INTENSE'],
  bored: ['BORED'],
  lonely: ['LONELY'],
  sad: ['SAD'],
  angry: ['ANGRY'],
  grateful: ['GRATEFUL'],
  sleeping: ['SLEEP', 'SLEEP2'],
};

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

const randomBssid = (): string =>
  Array.from({ length: 6 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0')
  ).join(':');

export class MockEspService implements EspService {
  private status: EspStatus;
  private networks = new Map<string, Network>();
  private handshakes: Handshake[] = [];
  private listeners = new Set<(e: EspEvent) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private startedAt = 0;
  private ticksSinceMoodChange = 0;
  private ticksSinceHandshake = 0;
  private ticksSinceNetwork = 0;

  constructor() {
    this.status = {
      mood: 'awake',
      face: 'AWAKE',
      saying: pick(SAYINGS.awake),
      uptimeSec: 0,
      channel: 1,
      scanning: true,
      counters: { networksSeen: 0, handshakesCaught: 0, deauthsSent: 0, peersSeen: 0 },
    };
  }

  getStatus(): EspStatus {
    return this.status;
  }

  getNetworks(): Network[] {
    return Array.from(this.networks.values()).sort((a, b) => b.seenAt - a.seenAt);
  }

  getHandshakes(): Handshake[] {
    return [...this.handshakes].sort((a, b) => b.capturedAt - a.capturedAt);
  }

  subscribe(listener: (event: EspEvent) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    if (this.timer) return;
    this.startedAt = Date.now();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private emit(event: EspEvent) {
    for (const l of this.listeners) l(event);
  }

  private setMood(mood: Mood, reason: string) {
    if (this.status.mood === mood) return;
    this.status = { ...this.status, mood, face: pick(FACE_BY_MOOD[mood]), saying: pick(SAYINGS[mood]) };
    this.ticksSinceMoodChange = 0;
    this.emit({ type: 'mood', at: Date.now(), mood, reason });
  }

  private tick() {
    const now = Date.now();
    this.ticksSinceMoodChange++;
    this.ticksSinceHandshake++;
    this.ticksSinceNetwork++;

    // Channel hop every 5s
    if (this.status.uptimeSec % 5 === 0) {
      this.status = { ...this.status, channel: Math.floor(Math.random() * 13) + 1 };
    }

    // Refresh face occasionally so "looking" alternates eyes etc.
    if (this.ticksSinceMoodChange % 3 === 0) {
      this.status = {
        ...this.status,
        face: pick(FACE_BY_MOOD[this.status.mood]),
      };
    }

    // Random network discovery
    if (Math.random() < 0.25) {
      const ssid = pick(SSIDS);
      const network: Network = {
        ssid,
        bssid: randomBssid(),
        rssi: -30 - Math.floor(Math.random() * 60),
        channel: this.status.channel,
        seenAt: now,
      };
      this.networks.set(network.bssid, network);
      this.status = {
        ...this.status,
        counters: { ...this.status.counters, networksSeen: this.status.counters.networksSeen + 1 },
      };
      this.ticksSinceNetwork = 0;
      this.emit({ type: 'network', at: now, network });
      if (this.status.mood !== 'intense' && this.status.mood !== 'happy') {
        this.setMood('excited', `new AP ${ssid}`);
      }
    }

    // Random handshake capture (~1 every 25s on average)
    if (Math.random() < 0.04 && this.networks.size > 0) {
      const net = pick(Array.from(this.networks.values()));
      const handshake: Handshake = {
        ssid: net.ssid,
        bssid: net.bssid,
        capturedAt: now,
      };
      this.handshakes.push(handshake);
      this.status = {
        ...this.status,
        counters: {
          ...this.status.counters,
          handshakesCaught: this.status.counters.handshakesCaught + 1,
          deauthsSent: this.status.counters.deauthsSent + 1,
        },
      };
      this.ticksSinceHandshake = 0;
      this.emit({ type: 'handshake', at: now, handshake });
      const totalHs = this.status.counters.handshakesCaught;
      if (totalHs >= 10) this.setMood('grateful', `${totalHs} handshakes`);
      else if (totalHs >= 5) this.setMood('cool', `${totalHs} handshakes`);
      else this.setMood('happy', `caught ${net.ssid}`);
    }

    // Mood drift from inactivity
    if (this.ticksSinceHandshake > 45 && this.ticksSinceMoodChange > 8) {
      if (this.networks.size === 0) this.setMood('lonely', 'no APs around');
      else if (this.ticksSinceMoodChange > 15) this.setMood('bored', 'nothing to catch');
    }

    // Back to looking if nothing specific
    if (this.status.mood !== 'looking' && this.ticksSinceMoodChange > 10 && Math.random() < 0.15) {
      this.setMood('looking', 'back to scanning');
    }

    // Advance uptime + always emit a tick so consumers can refresh
    this.status = { ...this.status, uptimeSec: this.status.uptimeSec + 1 };
    this.emit({ type: 'tick', at: now, status: this.status });
  }
}

