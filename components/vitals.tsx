import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';

const HEARTS_TOTAL = 5;

type Props = {
  hunger: number; // 0..100
  energy: number; // 0..100
  health: number; // 0..100
};

export function Vitals({ hunger, energy, health }: Props) {
  const filledHearts = Math.max(0, HEARTS_TOTAL - Math.ceil(hunger / 20));
  return (
    <View style={styles.wrap}>
      <Row label="HUNGER">
        <Text style={styles.hearts} allowFontScaling={false}>
          {'♥'.repeat(filledHearts)}
          <Text style={{ color: colors.border }}>{'♥'.repeat(HEARTS_TOTAL - filledHearts)}</Text>
        </Text>
      </Row>
      <Row label="ENERGY">
        <Bar value={energy} color={colors.warn} />
      </Row>
      <Row label="HEALTH">
        <Bar value={health} color={health < 30 ? colors.danger : colors.accent} />
      </Row>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel} allowFontScaling={false}>
        {label}
      </Text>
      <View style={styles.rowValue}>{children}</View>
    </View>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  const cells = 12;
  const filled = Math.round((value / 100) * cells);
  return (
    <Text style={styles.bar} allowFontScaling={false}>
      <Text style={{ color }}>{'█'.repeat(filled)}</Text>
      <Text style={{ color: colors.border }}>{'░'.repeat(cells - filled)}</Text>
      <Text style={styles.barPct}> {Math.round(value)}%</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  rowLabel: {
    color: colors.dim,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    width: 64,
  },
  rowValue: { flex: 1 },
  hearts: { color: colors.danger, fontFamily: fonts.mono, fontSize: 14, letterSpacing: 2 },
  bar: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0 },
  barPct: { color: colors.dim, fontSize: 11 },
});
