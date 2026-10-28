import React from 'react';
import { TextInput, View, StyleSheet, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme } from '@theme';
import AppText from '@shared/ui/AppText';

const BAR_HEIGHT = 46;

/**
 * Search bar used on Home and Search screens.
 * Pass onPress (without onChangeText) to render as a tappable
 * "fake" bar that navigates to the Search screen — the common
 * marketplace pattern that avoids keyboard flashes on Home.
 */
function SearchBar({
  value,
  onChangeText,
  onPress,
  onSubmit,
  placeholder = 'Search products, brands and more',
  autoFocus = false,
  style,
}) {
  const { colors, radius, spacing } = useTheme();
  const isNavigational = !!onPress && !onChangeText;

  const box = [
    styles.box,
    {
      height: BAR_HEIGHT,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceVariant,
      paddingHorizontal: spacing.md,
    },
    style,
  ];

  if (isNavigational) {
    return (
      <Pressable onPress={onPress} accessibilityRole="search" style={box}>
        <Icon name="search" size={18} color={colors.textTertiary} />
        <AppText
          variant="bodyMd"
          color="textTertiary"
          numberOfLines={1}
          style={{ marginLeft: spacing.xs }}>
          {placeholder}
        </AppText>
      </Pressable>
    );
  }

  return (
    <View style={box}>
      <Icon name="search" size={18} color={colors.textTertiary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        autoFocus={autoFocus}
        returnKeyType="search"
        style={[styles.input, { color: colors.textPrimary, marginLeft: spacing.xs }]}
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityLabel="Clear search"
          hitSlop={spacing.xs}>
          <Icon name="x" size={18} color={colors.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, fontSize: 14, paddingVertical: 0 },
});

export default React.memo(SearchBar);
