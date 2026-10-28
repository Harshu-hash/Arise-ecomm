import React, { useState, useCallback } from 'react';
import { TextInput, View, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme } from '@theme';
import AppText from '@shared/ui/AppText';
import IconButton from '@shared/buttons/IconButton';

const FIELD_HEIGHT = 52;

/**
 * Standard text field: label above, soft surface, focus ring, error text.
 * secureToggle renders an eye icon for password fields.
 * Designed to plug into React Hook Form via value/onChangeText/onBlur.
 */
function TextField({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  error,
  helper,
  leftIcon,
  secureToggle = false,
  editable = true,
  style,
  ...inputProps
}) {
  const { colors, radius, spacing, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secureToggle);

  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlur = useCallback(
    e => {
      setFocused(false);
      onBlur?.(e);
    },
    [onBlur],
  );
  const toggleHidden = useCallback(() => setHidden(prev => !prev), []);

  const borderColor = error ? colors.error : focused ? colors.primary : colors.border;

  return (
    <View style={style}>
      {label ? (
        <AppText variant="label" color="textSecondary" style={{ marginBottom: spacing.xxs }}>
          {label}
        </AppText>
      ) : null}

      <View
        style={[
          styles.box,
          {
            borderColor,
            borderRadius: radius.md,
            backgroundColor: editable ? colors.surface : colors.surfaceVariant,
            paddingHorizontal: spacing.md,
          },
        ]}>
        {leftIcon ? (
          <Icon
            name={leftIcon}
            size={18}
            color={colors.textTertiary}
            style={{ marginRight: spacing.xs }}
          />
        ) : null}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          secureTextEntry={hidden}
          editable={editable}
          style={[styles.input, typography.bodyLg, { color: colors.textPrimary }]}
          {...inputProps}
        />

        {secureToggle ? (
          <IconButton
            name={hidden ? 'eye' : 'eye-off'}
            onPress={toggleHidden}
            color={colors.textTertiary}
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          />
        ) : null}
      </View>

      {error || helper ? (
        <AppText
          variant="bodySm"
          color={error ? 'error' : 'textTertiary'}
          style={{ marginTop: spacing.xxs }}>
          {error || helper}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    height: FIELD_HEIGHT,
  },
  input: { flex: 1, paddingVertical: 0 },
});

export default React.memo(TextField);
