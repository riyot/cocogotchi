export type Personality = 'curious' | 'fierce' | 'lazy' | 'lonely';

export type DiaryKind =
  | 'born'
  | 'first_handshake'
  | 'fed'
  | 'milestone'
  | 'hungry'
  | 'starving'
  | 'coma'
  | 'wake'
  | 'birthday'
  | 'peer_seen'
  | 'observation';

export type DiaryEntry = {
  id: string;
  at: number;
  kind: DiaryKind;
  text: string;
  meta?: Record<string, string | number>;
};

export type Friend = {
  bssid: string;
  ssid: string;
  nickname: string;
  encounters: number;
  firstSeen: number;
  lastSeen: number;
};

export type Being = {
  version: 1;
  name: string;
  personality: Personality;
  bornAt: number;
  // vitals 0..100
  health: number;
  hunger: number; // 0 = full, 100 = starving
  energy: number;
  // lifetime counters
  totalHandshakes: number;
  totalNetworks: number;
  totalDeauths: number;
  comaCount: number;
  // timestamps
  lastFedAt: number;
  lastInteractionAt: number;
  lastTickAt: number;
  // history
  diary: DiaryEntry[];
  friends: Record<string, Friend>;
};

export const DIARY_MAX_ENTRIES = 200;
