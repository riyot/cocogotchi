import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import type { EspEvent } from '@/services/esp';

type Props = {
  events: EspEvent[];
};

const formatTime = (at: number): string => {
  const d = new Date(at);
  return `${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
};

const lineFor = (e: EspEvent): { tag: string; tagColor: string; text: string } => {
  switch (e.type) {
    case 'network':
      return {
        tag: 'AP',
        tagColor: colors.warn,
        text: `${e.network.ssid}  ${e.network.rssi}dBm  ch${e.network.channel}`,
      };
    case 'handshake':
      return {
        tag: 'HS',
        tagColor: colors.accent,
        text: `${e.handshake.ssid}  ${e.handshake.bssid}`,
      };
    case 'mood':
      return { tag: 'MD', tagColor: colors.dim, text: `${e.mood} — ${e.reason}` };
    case 'tick':
    default:
      return { tag: '..', tagColor: colors.dim, text: '' };
  }
};

export function EventLog({ events }: Props) {
  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      {events.length === 0 ? (
        <Text style={styles.empty} allowFontScaling={false}>
          waiting for activity...
        </Text>
      ) : (
        events.map((e, i) => {
          const line = lineFor(e);
          return (
            <View key={`${e.at}-${i}`} style={styles.row}>
              <Text style={styles.time} allowFontScaling={false}>
                {formatTime(e.at)}
              </Text>
              <Text style={[styles.tag, { color: line.tagColor }]} allowFontScaling={false}>
                {line.tag}
              </Text>
              <Text style={styles.text} numberOfLines={1} allowFontScaling={false}>
                {line.text}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  empty: {
    color: colors.dim,
    fontFamily: fonts.mono,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  time: {
    color: colors.dim,
    fontFamily: fonts.mono,
    fontSize: 11,
    width: 64,
  },
  tag: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    width: 32,
  },
  text: {
    flex: 1,
    color: colors.fg,
    fontFamily: fonts.mono,
    fontSize: 12,
  },
});
