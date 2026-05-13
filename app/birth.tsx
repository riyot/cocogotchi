import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts } from '@/constants/theme';
import { useBeing } from '@/hooks/use-being';
import type { Personality } from '@/services/being-types';

const PERSONALITIES: { id: Personality; label: string; desc: string }[] = [
  { id: 'curious', label: 'curious', desc: 'sniffs everything · loud diary' },
  { id: 'fierce', label: 'fierce', desc: 'aggressive deauth · short fuse' },
  { id: 'lazy', label: 'lazy', desc: 'long naps · low energy drain' },
  { id: 'lonely', label: 'lonely', desc: 'craves peers · clingy' },
];

const DEFAULT_NAME = 'cocogotchi';

export default function Birth() {
  const router = useRouter();
  const { birth } = useBeing();
  const [name, setName] = useState('');
  const [personality, setPersonality] = useState<Personality>('curious');
  const [busy, setBusy] = useState(false);

  const handleInit = async () => {
    if (busy) return;
    const finalName = name.trim() || DEFAULT_NAME;
    setBusy(true);
    await birth(finalName, personality);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.boot}>
          <BootLine text="[boot] init pwnagotchi v1" />
          <BootLine text="[ ok ] mem_check 4.0MB" />
          <BootLine text="[ ok ] radio.wifi.cold" />
          <BootLine text="[ ok ] radio.ble.cold" />
          <BootLine text="[wait] awaiting callsign..." color={colors.warn} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label} allowFontScaling={false}>
            ▸ callsign
          </Text>
          <TextInput
            style={styles.input}
            placeholder={`${DEFAULT_NAME} (default)`}
            placeholderTextColor={colors.dim}
            value={name}
            onChangeText={setName}
            maxLength={16}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            allowFontScaling={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label} allowFontScaling={false}>
            ▸ personality
          </Text>
          <View style={styles.grid}>
            {PERSONALITIES.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.option, personality === p.id && styles.optionActive]}
                onPress={() => setPersonality(p.id)}
              >
                <Text style={styles.optionLabel} allowFontScaling={false}>
                  {personality === p.id ? '[x]' : '[ ]'} {p.label}
                </Text>
                <Text style={styles.optionDesc} allowFontScaling={false}>
                  {p.desc}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable style={styles.initBtn} onPress={handleInit} disabled={busy}>
          <Text style={styles.initBtnText} allowFontScaling={false}>
            {busy ? '> spawning...' : '> init()'}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BootLine({ text, color = colors.dim }: { text: string; color?: string }) {
  return (
    <Text style={[styles.bootLine, { color }]} allowFontScaling={false}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  boot: { marginBottom: 32 },
  bootLine: { fontFamily: fonts.mono, fontSize: 12, marginBottom: 2 },
  field: { marginBottom: 24 },
  label: {
    color: colors.accent,
    fontFamily: fonts.mono,
    fontSize: 12,
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    color: colors.fg,
    fontFamily: fonts.mono,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    backgroundColor: '#111',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    width: '48%',
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#111',
  },
  optionActive: { borderColor: colors.accent, backgroundColor: '#0d1a0d' },
  optionLabel: { color: colors.fg, fontFamily: fonts.mono, fontSize: 13 },
  optionDesc: { color: colors.dim, fontFamily: fonts.mono, fontSize: 10, marginTop: 4 },
  initBtn: {
    marginTop: 'auto',
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: '#0d1a0d',
    alignItems: 'center',
  },
  initBtnText: { color: colors.accent, fontFamily: fonts.mono, fontSize: 16, letterSpacing: 2 },
});
