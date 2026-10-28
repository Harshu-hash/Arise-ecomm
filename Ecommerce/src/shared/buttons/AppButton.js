import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTheme } from '@theme';
import AppText from '@shared/ui/AppText';
import PressableScale from '@shared/ui/PressableScale';

/**
 * Single button component covering all variants of the design system:
 * variant: 'primary' | 'secondary' | 'outlined' | 'text' | 'danger'
 * size:    'lg' (CTAs) | 'md' (default) | 'sm' (inline actions)
 * Handles loading and disabled states internally.
 */
function AppButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon = null,
  style,
}) {
  const theme = useTheme();
  const { colors, radius, spacing, touchTarget } = theme;
  const isBlocked = disabled || loading;

  const variantStyles = {
    primary: { backgroundColor: colors.primary, textColor: 'onPrimary' },
    secondary: { backgroundColor: colors.secondary, textColor: 'onSecondary' },
    outlined: {
      backgroundColor: 'transparent',
      textColor: 'primary',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    text: { backgroundColor: 'transparent', textColor: 'primary' },
    danger: { backgroundColor: colors.error, textColor: 'textInverse' },
  };

  const sizeStyles = {
    lg: { height: 52, paddingHorizontal: spacing.xl },
    md: { height: touchTarget, paddingHorizontal: spacing.lg },
    sm: { height: 36, paddingHorizontal: spacing.sm },
  };

  const { textColor, ...boxStyle } = variantStyles[variant];
  const spinnerColor = colors[textColor];

  return (
    <PressableScale
      onPress={onPress}
      disabled={isBlocked}
      accessibilityRole="button"
      accessibilityState={{ disabled: isBlocked, busy: loading }}
      style={[
        styles.base,
        { borderRadius: radius.md },
        boxStyle,
        sizeStyles[size],
        fullWidth && styles.fullWidth,
        disabled && {
          backgroundColor: variant === 'text' ? 'transparent' : colors.disabled,
          borderColor: colors.disabled,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <View style={styles.content}>
          {leftIcon ? <View style={{ marginRight: spacing.xs }}>{leftIcon}</View> : null}
          <AppText
            variant="button"
            color={disabled ? 'onDisabled' : textColor}
            numberOfLines={1}>
            {title}
          </AppText>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center' },
});

export default React.memo(AppButton);
