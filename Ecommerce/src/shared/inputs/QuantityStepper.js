import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme } from '@theme';
import AppText from '@shared/ui/AppText';
import PressableScale from '@shared/ui/PressableScale';

const BUTTON_SIZE = 32;
const DEFAULT_MAX = 99;

/** Quantity stepper used in cart rows and product details (− qty +). */
function QuantityStepper({ value, onChange, min = 1, max = DEFAULT_MAX, style }) {
  const { colors, radius, spacing } = useTheme();

  const decrease = useCallback(() => onChange(Math.max(min, value - 1)), [onChange, value, min]);
  const increase = useCallback(() => onChange(Math.min(max, value + 1)), [onChange, value, max]);

  const renderButton = (name, onPress, isDisabled, label) => (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={spacing.xxs}
      style={[
        styles.button,
        { borderRadius: radius.sm, backgroundColor: colors.surfaceVariant },
      ]}>
      <Icon name={name} size={16} color={isDisabled ? colors.onDisabled : colors.primary} />
    </PressableScale>
  );

  return (
    <View
      style={[
        styles.row,
        { borderColor: colors.border, borderRadius: radius.md, padding: spacing.xxs },
        style,
      ]}>
      {renderButton('minus', decrease, value <= min, 'Decrease quantity')}
      <AppText variant="label" style={styles.value} accessibilityLiveRegion="polite">
        {value}
      </AppText>
      {renderButton('plus', increase, value >= max, 'Increase quantity')}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, alignSelf: 'flex-start' },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { minWidth: 36, textAlign: 'center' },
});

export default React.memo(QuantityStepper);
