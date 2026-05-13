import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { useFaceAnimator } from '@/hooks/use-face-animator';
import type { Mood } from '@/services/esp';

import { ParticleLayer } from './particle-layer';

type Props = {
  mood: Mood;
  defaultSaying: string;
};

export function PwnagotchiFace({ mood, defaultSaying }: Props) {
  const { face, saying, particles } = useFaceAnimator({ mood, defaultSaying });
  const [width, setWidth] = useState(320);
  const visible = saying.trim().length > 0;

  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ParticleLayer kind={particles} width={width} />
      <Text style={styles.face} allowFontScaling={false}>
        {face}
      </Text>
      <View style={[styles.bubble, !visible && styles.bubbleEmpty]}>
        <Text style={styles.saying} allowFontScaling={false}>
          {visible ? saying : ' '}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 28,
    overflow: 'hidden',
  },
  face: {
    color: colors.fg,
    fontFamily: fonts.mono,
    fontSize: 44,
    letterSpacing: 1,
    minHeight: 60,
    textAlign: 'center',
  },
  bubble: {
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    maxWidth: '92%',
    minHeight: 36,
    justifyContent: 'center',
  },
  bubbleEmpty: {
    borderColor: 'transparent',
  },
  saying: {
    color: colors.fg,
    fontFamily: fonts.mono,
    fontSize: 13,
    textAlign: 'center',
  },
});
