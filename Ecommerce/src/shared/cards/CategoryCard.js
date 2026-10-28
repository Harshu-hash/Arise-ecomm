import React from 'react';
import { StyleSheet } from 'react-native';
import FastImage from 'react-native-fast-image';
import { useTheme } from '@theme';
import AppText from '@shared/ui/AppText';
import PressableScale from '@shared/ui/PressableScale';

const IMAGE_SIZE = 64;

/**
 * Compact category tile: circular image over a small label.
 * Used in the horizontal category rail on Home and the category grid.
 */
function CategoryCard({ category, onPress, style }) {
  const { colors, radius, spacing } = useTheme();
  const { name, image } = category;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={[styles.container, { padding: spacing.xs }, style]}>
      <FastImage
        source={{ uri: image, priority: FastImage.priority.normal }}
        style={{
          width: IMAGE_SIZE,
          height: IMAGE_SIZE,
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceVariant,
        }}
        resizeMode={FastImage.resizeMode.cover}
      />
      <AppText
        variant="caption"
        color="textSecondary"
        align="center"
        numberOfLines={2}
        style={[styles.label, { marginTop: spacing.xs }]}>
        {name}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  label: { maxWidth: IMAGE_SIZE + 16 },
});

export default React.memo(CategoryCard);
