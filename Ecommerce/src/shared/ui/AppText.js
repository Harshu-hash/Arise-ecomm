import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '@theme';

/**
 * The only text component allowed in the app. Enforces the typography
 * scale and semantic colors so no screen ever sets ad-hoc font styles.
 *
 * variant: any key of theme.typography (headingXl ... offer)
 * color:   any key of theme.colors (defaults to textPrimary)
 */
function AppText({
  variant = 'bodyMd',
  color = 'textPrimary',
  align,
  numberOfLines,
  style,
  children,
  ...rest
}) {
  const { typography, colors } = useTheme();

  return (
    <Text
      numberOfLines={numberOfLines}
      allowFontScaling
      maxFontSizeMultiplier={1.4}
      style={[
        typography[variant],
        { color: colors[color] || color },
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}>
      {children}
    </Text>
  );
}

export default React.memo(AppText);
