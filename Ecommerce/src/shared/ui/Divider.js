import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@theme';

/**
 * Divider variants:
 * - "hairline": 1px line between list rows
 * - "section": thick band separating page sections (Amazon/Flipkart style)
 */
function Divider({ variant = 'hairline', style }) {
  const { colors, spacing } = useTheme();

  if (variant === 'section') {
    return (
      <View
        style={[{ height: spacing.xs, backgroundColor: colors.surfaceVariant }, style]}
      />
    );
  }

  return (
    <View
      style={[
        { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
        style,
      ]}
    />
  );
}

export default React.memo(Divider);
