import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useBeing } from '@/hooks/use-being';

export default function Index() {
  const { being, ready } = useBeing();

  if (!ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.fg} />
      </View>
    );
  }

  if (!being) return <Redirect href="/birth" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
