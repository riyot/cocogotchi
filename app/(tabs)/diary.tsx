import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts } from '@/constants/theme';
import { useBeing } from '@/hooks/use-being';
import type { DiaryEntry, DiaryKind } from '@/services/being-types';

const TAG: Record<DiaryKind, string> = {
  born: '$ ',
  first_handshake: '+ ',
  fed: '· ',
  milestone: '★ ',
  hungry: '? ',
  starving: '! ',
  coma: '✕ ',
  wake: '↑ ',
  birthday: '✦ ',
  peer_seen: '~ ',
  observation: '> ',
};

const TAG_COLOR: Record<DiaryKind, string> = {
  born: colors.accent,
  first_handshake: colors.accent,
  fed: colors.fg,
  milestone: colors.warn,
  hungry: colors.warn,
  starving: colors.danger,
  coma: colors.danger,
  wake: colors.accent,
  birthday: colors.warn,
  peer_seen: colors.accent,
  observation: colors.dim,
};

const formatRel = (at: number): string => {
  const sec = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
};

export default function Diary() {
  const { being } = useBeing();
  if (!being) return null;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title} allowFontScaling={false}>
          ▤ {being.name}.log
        </Text>
        <Text style={styles.count} allowFontScaling={false}>
          {being.diary.length} entries
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {being.diary.length === 0 ? (
          <Text style={styles.empty} allowFontScaling={false}>
            // log empty. live a little.
          </Text>
        ) : (
          being.diary.map((e) => <Entry key={e.id} entry={e} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Entry({ entry }: { entry: DiaryEntry }) {
  return (
    <View style={styles.entry}>
      <Text style={styles.entryHead} allowFontScaling={false}>
        <Text style={{ color: TAG_COLOR[entry.kind] }}>{TAG[entry.kind]}</Text>
        <Text style={styles.entryTime}>{formatRel(entry.at)} ago</Text>
      </Text>
      <Text style={styles.entryText} allowFontScaling={false}>
        {entry.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.fg, fontFamily: fonts.mono, fontSize: 14, letterSpacing: 1 },
  count: { color: colors.dim, fontFamily: fonts.mono, fontSize: 11 },
  list: { paddingHorizontal: 16, paddingVertical: 12 },
  empty: { color: colors.dim, fontFamily: fonts.mono, fontSize: 12, textAlign: 'center', marginTop: 32 },
  entry: { marginBottom: 14 },
  entryHead: { fontFamily: fonts.mono, fontSize: 11, marginBottom: 2 },
  entryTime: { color: colors.dim },
  entryText: { color: colors.fg, fontFamily: fonts.mono, fontSize: 13, lineHeight: 18 },
});
