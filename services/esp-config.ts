import AsyncStorage from '@react-native-async-storage/async-storage';

export type EspMode = 'mock' | 'http';

export type EspConfig = {
  mode: EspMode;
  baseUrl: string;
};

const KEY = '@pwnagotchi/esp-config/v1';

export const DEFAULT_CONFIG: EspConfig = {
  mode: 'mock',
  baseUrl: 'http://pwn-esp32.local',
};

export async function loadEspConfig(): Promise<EspConfig> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<EspConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveEspConfig(cfg: EspConfig): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(cfg));
}
