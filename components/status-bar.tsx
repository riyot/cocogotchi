import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import type { EspStatus } from '@/services/esp';

type Props = {
  status: EspStatus;
};

const formatUptime = (sec: number): string => {
  const h = Math.floor(sec / 3600)
    .toString()
    .padStart(2, '0');
  const m = Math.floor((sec % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

export function StatusBar({ status }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Cell label="CH" value={status.channel.toString().padStart(2, '0')} />
        <Cell label="APS" value={status.counters.networksSeen.toString()} />
        <Cell label="HS" value={status.counters.handshakesCaught.toString()} accent />
        <Cell label="DEAUTH" value={status.counters.deauthsSent.toString()} />
        <Cell label="UP" value={formatUptime(status.uptimeSec)} />
      </View>
    </View>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel} allowFontScaling={false}>
        {label}
      </Text>
      <Text style={[styles.cellValue, accent && { color: colors.accent }]} allowFontScaling={false}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  cell: {
    alignItems: 'center',
    minWidth: 56,
  },
  cellLabel: {
    color: colors.dim,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
  },
  cellValue: {
    color: colors.fg,
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
});
