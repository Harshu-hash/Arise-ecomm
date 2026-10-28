import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useTheme } from '@theme';
import AppText from '@shared/ui/AppText';

/**
 * Full-screen loader for blocking transitions (payment processing,
 * order placement). For content loading, prefer skeletons instead.
 */
function FullScreenLoader({ message }) {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? (
        <AppText variant="bodyMd" color="textSecondary" style={{ marginTop: spacing.md }}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default React.memo(FullScreenLoader);
