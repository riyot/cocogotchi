import type { FaceName } from '@/constants/faces';

export type Mood =
  | 'awake'
  | 'looking'
  | 'happy'
  | 'excited'
  | 'cool'
  | 'intense'
  | 'bored'
  | 'lonely'
  | 'sad'
  | 'angry'
  | 'grateful'
  | 'sleeping';

export type EspStatus = {
  mood: Mood;
  face: FaceName;
  saying: string;
  uptimeSec: number;
  channel: number;
  scanning: boolean;
  counters: {
    networksSeen: number;
    handshakesCaught: number;
    deauthsSent: number;
    peersSeen: number;
  };
};

export type Network = {
  ssid: string;
  bssid: string;
  rssi: number;
  channel: number;
  seenAt: number;
};

export type Handshake = {
  ssid: string;
  bssid: string;
  capturedAt: number;
};

export type EspEvent =
  | { type: 'tick'; at: number; status: EspStatus }
  | { type: 'network'; at: number; network: Network }
  | { type: 'handshake'; at: number; handshake: Handshake }
  | { type: 'mood'; at: number; mood: Mood; reason: string };

export type Unsubscribe = () => void;

export interface EspService {
  getStatus(): EspStatus;
  getNetworks(): Network[];
  getHandshakes(): Handshake[];
  subscribe(listener: (event: EspEvent) => void): Unsubscribe;
  start(): void;
  stop(): void;
}
