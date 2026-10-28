import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import { haptics } from '../utils/haptics';

const CUSTOM_ICONS = {
  Home: require('../assets/images/bottom_navbar/Home_logo.png'),
  Play: require('../assets/images/bottom_navbar/play_logo.png'),
  Categories: require('../assets/images/bottom_navbar/catagory_logo.png'),
  Account: require('../assets/images/bottom_navbar/profile_logo.png'),
  Cart: require('../assets/images/bottom_navbar/cart_logo.png'),
};

const CIRCLE_SIZE = 58;
const BAR_HORIZONTAL_PADDING = 4;

/**
 * Floating pill-shaped tab bar with custom PNG icons and a smooth sliding active circle.
 */
const CustomTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const iconScales = useRef({}).current;
  const getIconScale = (key) => {
    if (!iconScales[key]) iconScales[key] = new Animated.Value(1);
    return iconScales[key];
  };

  const numRoutes = state.routes.length || 5;

  useEffect(() => {
    if (barWidth > 0) {
      const tabWidth = (barWidth - BAR_HORIZONTAL_PADDING * 2) / numRoutes;
      const targetX = state.index * tabWidth + (tabWidth - CIRCLE_SIZE) / 2;

      Animated.spring(translateX, {
        toValue: targetX,
        useNativeDriver: true,
        damping: 18,
        stiffness: 180,
        mass: 0.8,
      }).start();
    }
  }, [state.index, barWidth, numRoutes, translateX]);

  const handleBarLayout = (e) => {
    const width = e.nativeEvent.layout.width;
    if (width && width !== barWidth) {
      setBarWidth(width);
    }
  };

  const focusedOptions = descriptors[state.routes[state.index].key].options;
  if (focusedOptions.tabBarStyle?.display === 'none') {
    return null;
  }

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <View style={styles.bar} onLayout={handleBarLayout}>
        {barWidth > 0 && (
          <Animated.View
            style={[
              styles.slidingCircle,
              {
                transform: [{ translateX }],
              },
            ]}
          />
        )}
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? route.name;
          const isFocused = state.index === index;
          const iconSource = CUSTOM_ICONS[route.name] || CUSTOM_ICONS.Home;

          const iconScale = getIconScale(route.key);

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              haptics.selection();
              Animated.sequence([
                Animated.spring(iconScale, { toValue: 0.82, useNativeDriver: true, speed: 40, bounciness: 0 }),
                Animated.spring(iconScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 10 }),
              ]).start();
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              activeOpacity={0.8}
              style={styles.tabTouchable}>
              <View style={styles.circleContainer}>
                <Animated.Image
                  source={iconSource}
                  style={[styles.tabIcon, { transform: [{ scale: iconScale }] }]}
                  resizeMode="contain"
                />
                <Text
                  style={[styles.label, isFocused ? styles.labelActive : styles.labelInactive]}
                  numberOfLines={1}
                  adjustsFontSizeToFit>
                  {label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingTop: 8,
    elevation: 0,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: COLORS.white,
    borderRadius: 36,
    paddingVertical: 6,
    paddingHorizontal: BAR_HORIZONTAL_PADDING,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  slidingCircle: {
    position: 'absolute',
    top: 6,
    left: BAR_HORIZONTAL_PADDING,
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: '#E0E4E9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  tabTouchable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  circleContainer: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  tabIcon: {
    width: 25,
    height: 25,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 0,
  },
  labelActive: {
    color: COLORS.primary,
  },
  labelInactive: {
    color: COLORS.textSecondary,
  },
});

export default CustomTabBar;
