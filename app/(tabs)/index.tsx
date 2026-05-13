import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventLog } from '@/components/event-log';
import { PwnagotchiFace } from '@/components/pwnagotchi-face';
import { StatusBar } from '@/components/status-bar';
import { Vitals } from '@/components/vitals';
import { colors, fonts } from '@/constants/theme';
import { useBeing } from '@/hooks/use-being';
import { useEsp } from '@/hooks/use-esp';

const DAY_MS = 24 * 3600 * 1000;

export default function Home() {
  const { status, recentEvents } = useEsp();
  const { being, touch } = useBeing();
  const router = useRouter();

  useEffect(() => {
    if (!being) router.replace('/birth');
  }, [being, router]);

  useEffect(() => {
    touch();
  }, [touch]);

  if (!being) return null;

  const ageDays = Math.floor((Date.now() - being.bornAt) / DAY_MS);
  const level = Math.floor(being.totalHandshakes / 25) + 1;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.name} allowFontScaling={false}>
          {being.name}
        </Text>
        <Text style={styles.stamp} allowFontScaling={false}>
          lv.{level} · {ageDays}d · ch{status.channel}
        </Text>
      </View>

      <PwnagotchiFace mood={status.mood} defaultSaying={status.saying} />

      <Vitals hunger={being.hunger} energy={being.energy} health={being.health} />

      <StatusBar status={status} />

      <EventLog events={recentEvents} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  name: { color: colors.fg, fontFamily: fonts.mono, fontSize: 16, letterSpacing: 2 },
  stamp: { color: colors.dim, fontFamily: fonts.mono, fontSize: 11 },
});
