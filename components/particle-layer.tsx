import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import type { ParticleKind } from '@/constants/face-variants';
import { colors, fonts } from '@/constants/theme';

type Props = {
  kind: ParticleKind;
  width: number;
};

const KIND_CHARS: Record<Exclude<ParticleKind, null>, readonly string[]> = {
  z: ['z', 'Z', 'z'],
  sparkle: ['·', '*', '✦', '◦', '・'],
  glitch: ['#', '%', '?', '$', '!', '0', '1'],
  matrix: ['0', '1', '?', '$', '#', '@', '*', '+'],
  heart: ['♥', '♡', '·'],
};

const KIND_COLOR: Record<Exclude<ParticleKind, null>, string> = {
  z: colors.dim,
  sparkle: colors.warn,
  glitch: colors.danger,
  matrix: colors.accent,
  heart: colors.danger,
};

const COUNT = 6;

export function ParticleLayer({ kind, width }: Props) {
  if (!kind) return <View pointerEvents="none" style={[styles.layer, { width }]} />;
  return (
    <View pointerEvents="none" style={[styles.layer, { width }]}>
      {Array.from({ length: COUNT }).map((_, i) => (
        <Particle key={`${kind}-${i}`} kind={kind} index={i} width={width} />
      ))}
    </View>
  );
}

function Particle({ kind, index, width }: { kind: Exclude<ParticleKind, null>; index: number; width: number }) {
  const y = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const charRef = useRef<string>(pickChar(kind));

  useEffect(() => {
    const cycle = () => {
      charRef.current = pickChar(kind);
      y.setValue(0);
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(y, {
          toValue: -120 - Math.random() * 60,
          duration: 2500 + Math.random() * 1500,
          useNativeDriver: true,
          delay: index * 250,
        }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true, delay: index * 250 }),
          Animated.delay(1800),
          Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]),
      ]).start(({ finished }) => {
        if (finished) cycle();
      });
    };
    cycle();
  }, [kind, index, y, opacity]);

  const left = ((index + 0.5) / COUNT) * width + (Math.random() - 0.5) * 20;

  return (
    <Animated.Text
      style={[
        styles.particle,
        { left, color: KIND_COLOR[kind], opacity, transform: [{ translateY: y }] },
      ]}
      allowFontScaling={false}
    >
      {charRef.current}
    </Animated.Text>
  );
}

function pickChar(kind: Exclude<ParticleKind, null>) {
  const list = KIND_CHARS[kind];
  return list[Math.floor(Math.random() * list.length)];
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 140,
  },
  particle: {
    position: 'absolute',
    top: 120,
    fontFamily: fonts.mono,
    fontSize: 14,
  },
});
