import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts } from '@/constants/theme';
import { useBeing } from '@/hooks/use-being';
import type { Friend } from '@/services/being-types';

export default function Friends() {
  const { being } = useBeing();
  if (!being) return null;

  const friends = Object.values(being.friends).sort((a, b) => b.encounters - a.encounters);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title} allowFontScaling={false}>
          ◉ friends
        </Text>
        <Text style={styles.count} allowFontScaling={false}>
          {friends.length} known
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {friends.length === 0 ? (
          <Text style={styles.empty} allowFontScaling={false}>
            // nobody yet. scan more.
          </Text>
        ) : (
          friends.map((f) => <FriendRow key={f.bssid} friend={f} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FriendRow({ friend }: { friend: Friend }) {
  const bond = friend.encounters >= 20 ? '★★★' : friend.encounters >= 10 ? '★★' : friend.encounters >= 3 ? '★' : '·';
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.nick} allowFontScaling={false}>
          {friend.nickname}
        </Text>
        <Text style={styles.ssid} numberOfLines={1} allowFontScaling={false}>
          {friend.ssid}
        </Text>
        <Text style={styles.bssid} allowFontScaling={false}>
          {friend.bssid}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.bond} allowFontScaling={false}>
          {bond}
        </Text>
        <Text style={styles.meta} allowFontScaling={false}>
          {friend.encounters}x
        </Text>
      </View>
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
  list: { paddingHorizontal: 16, paddingVertical: 8 },
  empty: { color: colors.dim, fontFamily: fonts.mono, fontSize: 12, textAlign: 'center', marginTop: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: { flex: 1 },
  right: { alignItems: 'flex-end', marginLeft: 12 },
  nick: { color: colors.accent, fontFamily: fonts.mono, fontSize: 13 },
  ssid: { color: colors.fg, fontFamily: fonts.mono, fontSize: 12, marginTop: 2 },
  bssid: { color: colors.dim, fontFamily: fonts.mono, fontSize: 10, marginTop: 2 },
  bond: { color: colors.warn, fontFamily: fonts.mono, fontSize: 14 },
  meta: { color: colors.dim, fontFamily: fonts.mono, fontSize: 11, marginTop: 2 },
});
