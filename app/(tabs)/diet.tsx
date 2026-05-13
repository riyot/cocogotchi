import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts } from '@/constants/theme';
import { useBeing } from '@/hooks/use-being';
import { espService } from '@/services/esp-router';
import type { Handshake } from '@/services/esp';

const HEARTS_TOTAL = 5;

export default function Diet() {
  const { being } = useBeing();
  const [handshakes, setHandshakes] = useState<Handshake[]>(() => espService.getHandshakes());

  useEffect(() => {
    const unsub = espService.subscribe((e) => {
      if (e.type === 'handshake') setHandshakes(espService.getHandshakes());
    });
    return unsub;
  }, []);

  if (!being) return null;

  const fillCells = Math.max(0, HEARTS_TOTAL - Math.ceil(being.hunger / 20));
  const sinceLastFed = Math.floor((Date.now() - being.lastFedAt) / 60_000);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title} allowFontScaling={false}>
          ✦ diet
        </Text>
      </View>

      <View style={styles.stomachBox}>
        <Text style={styles.stomachLabel} allowFontScaling={false}>
          STOMACH
        </Text>
        <Text style={styles.stomach} allowFontScaling={false}>
          <Text style={{ color: colors.accent }}>{'▓'.repeat(fillCells * 3)}</Text>
          <Text style={{ color: colors.border }}>{'░'.repeat((HEARTS_TOTAL - fillCells) * 3)}</Text>
        </Text>
        <Text style={styles.meta} allowFontScaling={false}>
          last meal: {sinceLastFed}m ago · lifetime: {being.totalHandshakes}
        </Text>
      </View>

      <Text style={styles.section} allowFontScaling={false}>
        ◢ recent meals
      </Text>
      <ScrollView contentContainerStyle={styles.list}>
        {handshakes.length === 0 ? (
          <Text style={styles.empty} allowFontScaling={false}>
            // fasting. nothing in the bowl.
          </Text>
        ) : (
          handshakes.map((h) => <Meal key={h.bssid + h.capturedAt} hs={h} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Meal({ hs }: { hs: Handshake }) {
  const sec = Math.floor((Date.now() - hs.capturedAt) / 1000);
  const when = sec < 60 ? `${sec}s` : sec < 3600 ? `${Math.floor(sec / 60)}m` : `${Math.floor(sec / 3600)}h`;
  return (
    <View style={styles.row}>
      <Text style={styles.mealTime} allowFontScaling={false}>
        {when}
      </Text>
      <Text style={styles.mealMain} numberOfLines={1} allowFontScaling={false}>
        ◆ {hs.ssid}
      </Text>
      <Text style={styles.mealBssid} allowFontScaling={false}>
        {hs.bssid.slice(-8)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.fg, fontFamily: fonts.mono, fontSize: 14, letterSpacing: 1 },
  stomachBox: { paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  stomachLabel: { color: colors.dim, fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1 },
  stomach: { fontFamily: fonts.mono, fontSize: 16, letterSpacing: 0, marginTop: 6 },
  meta: { color: colors.dim, fontFamily: fonts.mono, fontSize: 11, marginTop: 6 },
  section: {
    color: colors.dim,
    fontFamily: fonts.mono,
    fontSize: 11,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    letterSpacing: 1,
  },
  list: { paddingHorizontal: 16, paddingBottom: 12 },
  empty: { color: colors.dim, fontFamily: fonts.mono, fontSize: 12, textAlign: 'center', marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  mealTime: { color: colors.dim, fontFamily: fonts.mono, fontSize: 11, width: 36 },
  mealMain: { color: colors.accent, fontFamily: fonts.mono, fontSize: 13, flex: 1 },
  mealBssid: { color: colors.dim, fontFamily: fonts.mono, fontSize: 11 },
});
