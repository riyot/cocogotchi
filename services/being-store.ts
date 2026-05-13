import AsyncStorage from '@react-native-async-storage/async-storage';

import { writeEntry } from './diary-writer';
import {
  DIARY_MAX_ENTRIES,
  type Being,
  type DiaryEntry,
  type Friend,
  type Personality,
} from './being-types';
import type { EspEvent } from './esp';
import { loadEspConfig } from './esp-config';
import { espService } from './esp-router';

const STORAGE_KEY = '@pwnagotchi/being/v1';
const TICK_INTERVAL_MS = 60_000; // 1 minute
const HUNGER_PER_TICK = 1;
const ENERGY_PER_TICK = -0.5;
const HEALTH_LOSS_WHEN_STARVING = 1;
const COMA_THRESHOLD = 10; // health <= 10 → coma
const WAKE_HEALTH = 40;
const BIRTHDAY_INTERVAL_MS = 7 * 24 * 3600 * 1000;
const SAVE_DEBOUNCE_MS = 500;

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

type Listener = (being: Being) => void;

class BeingStore {
  private being: Being | null = null;
  private listeners = new Set<Listener>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private espUnsub: (() => void) | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private inComa = false;
  private lastBirthdayAck = 0;
  private hungerStage: 'fed' | 'hungry' | 'starving' = 'fed';

  async load(): Promise<Being | null> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Being;
      if (parsed.version !== 1) return null;
      this.being = parsed;
      this.lastBirthdayAck = parsed.bornAt;
      return parsed;
    } catch {
      return null;
    }
  }

  async birth(name: string, personality: Personality): Promise<Being> {
    const now = Date.now();
    const fresh: Being = {
      version: 1,
      name,
      personality,
      bornAt: now,
      health: 100,
      hunger: 20,
      energy: 100,
      totalHandshakes: 0,
      totalNetworks: 0,
      totalDeauths: 0,
      comaCount: 0,
      lastFedAt: now,
      lastInteractionAt: now,
      lastTickAt: now,
      diary: [],
      friends: {},
    };
    fresh.diary = [writeEntry('born', fresh)];
    this.being = fresh;
    this.lastBirthdayAck = now;
    await this.persist(true);
    this.notify();
    return fresh;
  }

  current(): Being | null {
    return this.being;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
    this.espUnsub = espService.subscribe((evt) => this.onEsp(evt));
    loadEspConfig()
      .then((cfg) => espService.applyConfig(cfg))
      .finally(() => espService.start());
    // catch up time elapsed since last save
    this.catchUp();
  }

  stop(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
    this.espUnsub?.();
    this.espUnsub = null;
  }

  touch(): void {
    if (!this.being) return;
    this.being = { ...this.being, lastInteractionAt: Date.now() };
    this.queueSave();
    this.notify();
  }

  async reset(): Promise<void> {
    this.being = null;
    this.inComa = false;
    this.hungerStage = 'fed';
    await AsyncStorage.removeItem(STORAGE_KEY);
    this.notify();
  }

  private catchUp() {
    if (!this.being) return;
    const elapsed = Date.now() - this.being.lastTickAt;
    const ticks = Math.floor(elapsed / TICK_INTERVAL_MS);
    if (ticks <= 0) return;
    for (let i = 0; i < Math.min(ticks, 720); i++) this.applyTick(false);
    this.persistEntry();
  }

  private tick() {
    this.applyTick(true);
    this.persistEntry();
  }

  private applyTick(emitEntries: boolean) {
    if (!this.being) return;
    const b = { ...this.being };
    b.lastTickAt = Date.now();
    b.hunger = clamp(b.hunger + HUNGER_PER_TICK);
    b.energy = clamp(b.energy + ENERGY_PER_TICK);
    if (b.hunger >= 95) b.health = clamp(b.health - HEALTH_LOSS_WHEN_STARVING);

    // birthday detection
    const ageDays = Math.floor((b.lastTickAt - b.bornAt) / BIRTHDAY_INTERVAL_MS);
    const ackDays = Math.floor((this.lastBirthdayAck - b.bornAt) / BIRTHDAY_INTERVAL_MS);
    if (emitEntries && ageDays > ackDays) {
      b.diary = appendDiary(b.diary, writeEntry('birthday', b, { days: ageDays * 7 }));
      this.lastBirthdayAck = b.lastTickAt;
    }

    // hunger stage transitions
    const prevStage = this.hungerStage;
    const newStage: typeof prevStage = b.hunger >= 90 ? 'starving' : b.hunger >= 70 ? 'hungry' : 'fed';
    if (emitEntries && newStage !== prevStage) {
      if (newStage === 'hungry') {
        const hrs = Math.round((b.lastTickAt - b.lastFedAt) / 3_600_000);
        b.diary = appendDiary(b.diary, writeEntry('hungry', b, { hours: hrs }));
      }
      if (newStage === 'starving') b.diary = appendDiary(b.diary, writeEntry('starving', b));
    }
    this.hungerStage = newStage;

    // coma transitions
    if (b.health <= COMA_THRESHOLD && !this.inComa) {
      this.inComa = true;
      b.comaCount += 1;
      if (emitEntries) b.diary = appendDiary(b.diary, writeEntry('coma', b));
    } else if (b.health >= WAKE_HEALTH && this.inComa) {
      this.inComa = false;
      if (emitEntries) b.diary = appendDiary(b.diary, writeEntry('wake', b));
    }

    // rare random observation
    if (emitEntries && !this.inComa && Math.random() < 0.05) {
      b.diary = appendDiary(b.diary, writeEntry('observation', b, { channel: Math.ceil(Math.random() * 13) }));
    }

    this.being = b;
    this.notify();
  }

  private onEsp(evt: EspEvent) {
    if (!this.being) return;
    if (evt.type === 'handshake') {
      this.feed(evt.handshake.ssid, evt.handshake.bssid);
    } else if (evt.type === 'network') {
      this.observeNetwork(evt.network.ssid, evt.network.bssid);
    }
  }

  private feed(ssid: string, bssid: string) {
    if (!this.being) return;
    const b = { ...this.being };
    const wasFirst = b.totalHandshakes === 0;
    b.totalHandshakes += 1;
    b.totalDeauths += 1;
    b.hunger = clamp(b.hunger - 25);
    b.energy = clamp(b.energy - 4);
    b.health = clamp(b.health + 3);
    b.lastFedAt = Date.now();

    const entries: DiaryEntry[] = [];
    if (wasFirst) entries.push(writeEntry('first_handshake', b, { ssid, channel: 0 }));
    else if (b.totalHandshakes % 10 === 0)
      entries.push(writeEntry('milestone', b, { count: b.totalHandshakes }));
    else if (Math.random() < 0.4) entries.push(writeEntry('fed', b, { ssid }));

    if (entries.length) b.diary = appendDiary(b.diary, ...entries);
    this.being = b;
    this.queueSave();
    this.notify();
  }

  private observeNetwork(ssid: string, bssid: string) {
    if (!this.being) return;
    const b = { ...this.being };
    b.totalNetworks += 1;
    const friend: Friend = b.friends[bssid] ?? {
      bssid,
      ssid,
      nickname: nicknameFor(ssid),
      encounters: 0,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    };
    friend.encounters += 1;
    friend.lastSeen = Date.now();
    b.friends = { ...b.friends, [bssid]: friend };
    this.being = b;
    this.queueSave();
    this.notify();
  }

  private queueSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persistEntry(), SAVE_DEBOUNCE_MS);
  }

  private persistEntry() {
    this.persist(false).catch(() => {});
  }

  private async persist(force: boolean) {
    if (!this.being) return;
    if (!force) {
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.being));
  }

  private notify() {
    if (!this.being) return;
    const snapshot = this.being;
    for (const l of this.listeners) l(snapshot);
  }
}

function appendDiary(diary: DiaryEntry[], ...entries: DiaryEntry[]): DiaryEntry[] {
  const merged = [...entries, ...diary];
  if (merged.length > DIARY_MAX_ENTRIES) merged.length = DIARY_MAX_ENTRIES;
  return merged;
}

const NICKNAME_PREFIXES = ['neon', 'echo', 'ghost', 'static', 'ion', 'glitch', 'flux', 'noise'];
function nicknameFor(ssid: string): string {
  const prefix = NICKNAME_PREFIXES[Math.abs(hash(ssid)) % NICKNAME_PREFIXES.length];
  return `${prefix}-${(Math.abs(hash(ssid)) % 100).toString().padStart(2, '0')}`;
}
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h | 0;
}

export const beingStore = new BeingStore();
