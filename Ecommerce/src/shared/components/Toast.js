import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS } from '../../constants/spacing';

const VARIANT_STYLES = {
  default: { bg: '#212121', icon: COLORS.white },
  success: { bg: COLORS.ratingGreen, icon: COLORS.white },
  error: { bg: COLORS.error, icon: COLORS.white },
};

/** Bottom slide-up-and-fade toast. Rendered by ToastProvider — not used directly. */
const Toast = ({ visible, message, icon, variant = 'default' }) => {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(40);
  const opacity = useSharedValue(0);
  const theme = VARIANT_STYLES[variant] || VARIANT_STYLES.default;

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 16, stiffness: 180 });
      opacity.value = withTiming(1, { duration: 180 });
    } else {
      translateY.value = withTiming(40, { duration: 180 });
      opacity.value = withTiming(0, { duration: 180 });
    }
  }, [visible, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        { bottom: Math.max(insets.bottom, SPACING.l) + 64, backgroundColor: theme.bg },
        animatedStyle,
      ]}>
      {icon ? <Icon name={icon} size={16} color={theme.icon} style={styles.icon} /> : null}
      <Text style={styles.text} numberOfLines={2}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: SPACING.l,
    right: SPACING.l,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.m,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    zIndex: 998,
    elevation: 998,
  },
  icon: {
    marginRight: SPACING.s,
  },
  text: {
    flex: 1,
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default Toast;
