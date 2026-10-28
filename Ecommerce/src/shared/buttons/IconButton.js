import React from 'react';
import { StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme } from '@theme';
import PressableScale from '@shared/ui/PressableScale';

const ICON_SIZE = 20;
const HIT_SLOP = 8;

/**
 * Circular icon button (header actions, wishlist hearts, close buttons).
 * variant: 'plain' (no bg) | 'tonal' (subtle bg) | 'surface' (card bg + border)
 */
function IconButton({
  name,
  onPress,
  variant = 'plain',
  size = ICON_SIZE,
  color,
  accessibilityLabel,
  style,
}) {
  const { colors, touchTarget, radius } = useTheme();

  const backgrounds = {
    plain: 'transparent',
    tonal: colors.surfaceVariant,
    surface: colors.card,
  };

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || name}
      hitSlop={HIT_SLOP}
      style={[
        styles.base,
        {
          width: touchTarget,
          height: touchTarget,
          borderRadius: radius.pill,
          backgroundColor: backgrounds[variant],
        },
        variant === 'surface' && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}>
      <Icon name={name} size={size} color={color || colors.textPrimary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});

export default React.memo(IconButton);
