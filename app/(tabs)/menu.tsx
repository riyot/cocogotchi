import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts } from '@/constants/theme';
import { useBeing } from '@/hooks/use-being';
import { type EspConfig, type EspMode, loadEspConfig, saveEspConfig } from '@/services/esp-config';
import { espService } from '@/services/esp-router';

const DAY_MS = 24 * 3600 * 1000;

export default function Menu() {
  const { being, reset } = useBeing();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<EspConfig | null>(null);
  const [urlDraft, setUrlDraft] = useState('');

  useEffect(() => {
    loadEspConfig().then((cfg) => {
      setConfig(cfg);
      setUrlDraft(cfg.baseUrl);
    });
  }, []);

  if (!being || !config) return null;

  const ageDays = Math.floor((Date.now() - being.bornAt) / DAY_MS);
  const level = Math.floor(being.totalHandshakes / 25) + 1;
  const bornDate = new Date(being.bornAt);

  const applyMode = async (mode: EspMode) => {
    const next: EspConfig = { mode, baseUrl: urlDraft.trim() || config.baseUrl };
    setConfig(next);
    espService.applyConfig(next);
    await saveEspConfig(next);
  };

  const applyUrl = async () => {
    const url = urlDraft.trim();
    if (!url) return;
    const next: EspConfig = { ...config, baseUrl: url };
    setConfig(next);
    if (config.mode === 'http') espService.applyConfig(next);
    await saveEspConfig(next);
  };

  const confirmReset = () => {
    Alert.alert(
      'reset()',
      `${being.name} will be archived to /dev/null. all memory gone. confirm ?`,
      [
        { text: 'cancel', style: 'cancel' },
        {
          text: 'kill',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            await reset();
            router.replace('/birth');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title} allowFontScaling={false}>
          ☰ menu
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Section title="esp link">
          <View style={styles.modeRow}>
            <Pressable
              style={[styles.modeBtn, config.mode === 'mock' && styles.modeBtnActive]}
              onPress={() => applyMode('mock')}
            >
              <Text style={[styles.modeBtnText, config.mode === 'mock' && styles.modeBtnTextActive]} allowFontScaling={false}>
                mock
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeBtn, config.mode === 'http' && styles.modeBtnActive]}
              onPress={() => applyMode('http')}
            >
              <Text style={[styles.modeBtnText, config.mode === 'http' && styles.modeBtnTextActive]} allowFontScaling={false}>
                http
              </Text>
            </Pressable>
          </View>
          <Text style={styles.smallLabel} allowFontScaling={false}>
            esp32 base url
          </Text>
          <TextInput
            value={urlDraft}
            onChangeText={setUrlDraft}
            onSubmitEditing={applyUrl}
            placeholder="http://pwn-esp32.local"
            placeholderTextColor={colors.dim}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.urlInput}
            allowFontScaling={false}
          />
          <Pressable style={styles.urlSave} onPress={applyUrl}>
            <Text style={styles.urlSaveText} allowFontScaling={false}>
              save url
            </Text>
          </Pressable>
        </Section>

        <Section title="identity">
          <Row k="callsign" v={being.name} />
          <Row k="personality" v={being.personality} />
          <Row k="born" v={bornDate.toISOString().slice(0, 16).replace('T', ' ')} />
          <Row k="age" v={`${ageDays}d`} />
          <Row k="level" v={`${level}`} accent />
        </Section>

        <Section title="lifetime">
          <Row k="handshakes" v={`${being.totalHandshakes}`} accent />
          <Row k="networks" v={`${being.totalNetworks}`} />
          <Row k="deauths" v={`${being.totalDeauths}`} />
          <Row k="comas" v={`${being.comaCount}`} danger={being.comaCount > 0} />
        </Section>

        <Section title="vitals">
          <Row k="health" v={`${Math.round(being.health)}%`} danger={being.health < 30} />
          <Row k="hunger" v={`${Math.round(being.hunger)}%`} />
          <Row k="energy" v={`${Math.round(being.energy)}%`} />
        </Section>

        <Pressable style={styles.dangerBtn} onPress={confirmReset} disabled={busy}>
          <Text style={styles.dangerBtnText} allowFontScaling={false}>
            ! reset (permadeath)
          </Text>
        </Pressable>

        <Text style={styles.footer} allowFontScaling={false}>
          pwnagotchi.mobile v0.1 · {config.mode} mode
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} allowFontScaling={false}>
        ◢ {title}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ k, v, accent, danger }: { k: string; v: string; accent?: boolean; danger?: boolean }) {
  const color = danger ? colors.danger : accent ? colors.accent : colors.fg;
  return (
    <View style={styles.rowEntry}>
      <Text style={styles.rowKey} allowFontScaling={false}>
        {k}
      </Text>
      <Text style={[styles.rowVal, { color }]} allowFontScaling={false}>
        {v}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.fg, fontFamily: fonts.mono, fontSize: 14, letterSpacing: 1 },
  body: { padding: 16, paddingBottom: 32 },
  section: { marginBottom: 20 },
  sectionTitle: {
    color: colors.dim,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 6,
  },
  sectionBody: { borderWidth: 1, borderColor: colors.border, padding: 10 },
  rowEntry: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rowKey: { color: colors.dim, fontFamily: fonts.mono, fontSize: 12 },
  rowVal: { fontFamily: fonts.mono, fontSize: 12 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modeBtnActive: { borderColor: colors.accent, backgroundColor: '#0d1a0d' },
  modeBtnText: { color: colors.dim, fontFamily: fonts.mono, fontSize: 13 },
  modeBtnTextActive: { color: colors.accent },
  smallLabel: { color: colors.dim, fontFamily: fonts.mono, fontSize: 10, marginTop: 4 },
  urlInput: {
    color: colors.fg,
    fontFamily: fonts.mono,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    marginTop: 6,
    backgroundColor: '#111',
  },
  urlSave: {
    marginTop: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  urlSaveText: { color: colors.fg, fontFamily: fonts.mono, fontSize: 11 },
  dangerBtn: {
    marginTop: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
  },
  dangerBtnText: { color: colors.danger, fontFamily: fonts.mono, fontSize: 13, letterSpacing: 1 },
  footer: {
    color: colors.dim,
    fontFamily: fonts.mono,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 24,
  },
});
