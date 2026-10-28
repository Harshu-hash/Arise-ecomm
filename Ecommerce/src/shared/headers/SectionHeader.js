import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme } from '@theme';
import AppText from '@shared/ui/AppText';

/**
 * Home/list section header: title left, optional "See all" action right.
 * Keeps every section on Home visually identical.
 */
function SectionHeader({ title, subtitle, actionLabel = 'See all', onActionPress, style }) {
  const { colors, spacing, pressedOpacity } = useTheme();

  return (
    <View style={[styles.row, { paddingVertical: spacing.sm }, style]}>
      <View style={styles.titles}>
        <AppText variant="headingSm" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="bodySm" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {onActionPress ? (
        <Pressable
          onPress={onActionPress}
          accessibilityRole="button"
          hitSlop={spacing.xs}
          style={({ pressed }) => [styles.action, pressed && { opacity: pressedOpacity }]}>
          <AppText variant="label" color="primary">
            {actionLabel}
          </AppText>
          <Icon name="chevron-right" size={16} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titles: { flex: 1, marginRight: 12 },
  action: { flexDirection: 'row', alignItems: 'center' },
});

export default React.memo(SectionHeader);
