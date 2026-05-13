import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from '@/constants/theme';

type TabIconProps = { focused: boolean; label: string };

function TabGlyph({ focused, label }: TabIconProps) {
  return (
    <Text
      style={[styles.glyph, { color: focused ? colors.accent : colors.dim }]}
      allowFontScaling={false}
    >
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 72 + insets.bottom,
          paddingTop: 8,
          paddingBottom: 12 + insets.bottom,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.mono,
          fontSize: 11,
          letterSpacing: 1,
          marginTop: 2,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.dim,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'home',
          tabBarIcon: ({ focused }) => <TabGlyph focused={focused} label="⌂" />,
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: 'diary',
          tabBarIcon: ({ focused }) => <TabGlyph focused={focused} label="▤" />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'friends',
          tabBarIcon: ({ focused }) => <TabGlyph focused={focused} label="◉" />,
        }}
      />
      <Tabs.Screen
        name="diet"
        options={{
          title: 'diet',
          tabBarIcon: ({ focused }) => <TabGlyph focused={focused} label="✦" />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'menu',
          tabBarIcon: ({ focused }) => <TabGlyph focused={focused} label="☰" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  glyph: {
    fontFamily: fonts.mono,
    fontSize: 18,
    lineHeight: 22,
  },
});
