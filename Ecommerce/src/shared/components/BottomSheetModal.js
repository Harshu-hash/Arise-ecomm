import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, TouchableWithoutFeedback, Easing, Dimensions } from 'react-native';
import { RADIUS } from '../../constants/spacing';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SLIDE_DURATION = 320;

/**
 * Generic modal sheet that slides up from the bottom of the screen over a fading
 * backdrop. Stays mounted through its own close animation (tracked via `isMounted`,
 * separate from the `visible` prop) so it can animate back out instead of vanishing
 * instantly when the caller flips `visible` to false.
 *
 * Rendered as a plain absolutely-positioned overlay (not RN's `Modal`) — `Modal`'s
 * native window doesn't reliably get full-screen bounds under this app's architecture
 * (Fabric/bridgeless), which left an invisible layer still capturing every touch.
 * This instead overlays within whichever screen-filling container renders it, which
 * already has correct real dimensions everywhere else in the app.
 */
const BottomSheetModal = ({ visible, onClose, children }) => {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [isMounted, setIsMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: SLIDE_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: SLIDE_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: SLIDE_DURATION,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: SLIDE_DURATION,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setIsMounted(false);
      });
    }
  }, [visible, translateY, backdropOpacity]);

  if (!isMounted) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>{children}</Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 100,
    elevation: 100,
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '82%',
    overflow: 'hidden',
  },
});

export default BottomSheetModal;
