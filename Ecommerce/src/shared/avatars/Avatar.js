import React from 'react';
import { View, StyleSheet } from 'react-native';
import FastImage from 'react-native-fast-image';
import { useTheme } from '@theme';
import AppText from '@shared/ui/AppText';

const SIZES = { sm: 32, md: 44, lg: 64 };

/** Avatar with image or initials fallback. size: 'sm' | 'md' | 'lg' | number */
function Avatar({ uri, name = '', size = 'md', style }) {
  const { colors, radius } = useTheme();
  const dimension = typeof size === 'number' ? size : SIZES[size];

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('');

  const box = {
    width: dimension,
    height: dimension,
    borderRadius: radius.pill,
  };

  if (uri) {
    return (
      <FastImage
        source={{ uri, priority: FastImage.priority.normal }}
        style={[box, style]}
        resizeMode={FastImage.resizeMode.cover}
        accessibilityLabel={name}
      />
    );
  }

  return (
    <View
      style={[box, styles.fallback, { backgroundColor: colors.primarySubtle }, style]}
      accessibilityLabel={name}>
      <AppText variant={dimension >= SIZES.lg ? 'headingSm' : 'label'} color="primary">
        {initials || '?'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});

export default React.memo(Avatar);
