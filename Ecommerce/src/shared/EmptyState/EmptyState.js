import React from 'react';
import { View, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme } from '@theme';
import AppText from '@shared/ui/AppText';
import AppButton from '@shared/buttons/AppButton';

const ICON_CIRCLE = 88;
const ICON_SIZE = 36;

/**
 * Guiding empty state: icon in a soft circle, title, message, optional CTA.
 * Every empty state must tell the user what to do next
 * (e.g. empty cart → "Start shopping").
 */
function EmptyState({ icon = 'inbox', title, message, actionLabel, onActionPress, style }) {
  const { colors, spacing, radius } = useTheme();

  return (
    <View style={[styles.container, { padding: spacing.xxl }, style]}>
      <View
        style={[
          styles.iconCircle,
          {
            width: ICON_CIRCLE,
            height: ICON_CIRCLE,
            borderRadius: radius.pill,
            backgroundColor: colors.primarySubtle,
            marginBottom: spacing.lg,
          },
        ]}>
        <Icon name={icon} size={ICON_SIZE} color={colors.primary} />
      </View>

      <AppText variant="headingSm" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText
          variant="bodyMd"
          color="textSecondary"
          align="center"
          style={{ marginTop: spacing.xs }}>
          {message}
        </AppText>
      ) : null}

      {actionLabel && onActionPress ? (
        <AppButton
          title={actionLabel}
          onPress={onActionPress}
          size="md"
          style={{ marginTop: spacing.xl }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconCircle: { alignItems: 'center', justifyContent: 'center' },
});

export default React.memo(EmptyState);
