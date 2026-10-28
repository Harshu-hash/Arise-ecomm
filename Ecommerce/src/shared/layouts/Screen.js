import React from 'react';
import { StatusBar, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@theme';

/**
 * Base screen layout: themed background, safe areas and status bar.
 * Every screen in the app must render inside <Screen>.
 *
 * padded: applies standard horizontal screen padding
 * edges:  safe area edges (default: top only; tabs/CTA own the bottom)
 */
function Screen({ children, padded = false, edges = ['top'], style }) {
  const { colors, screenPadding, isDark } = useTheme();

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.flex, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
        translucent={false}
      />
      <View
        style={[styles.flex, padded && { paddingHorizontal: screenPadding }, style]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

export default React.memo(Screen);
