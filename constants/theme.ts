import { Platform } from 'react-native';

export const colors = {
  bg: '#0a0a0a',
  fg: '#e8e8e8',
  dim: '#8a8a8a',
  accent: '#7df57d',
  warn: '#f5d97d',
  danger: '#f57d7d',
  border: '#262626',
} as const;

export const fonts = Platform.select({
  ios: { mono: 'Menlo' },
  android: { mono: 'monospace' },
  default: { mono: 'monospace' },
})!;
