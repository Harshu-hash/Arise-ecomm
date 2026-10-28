import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Icon from 'react-native-vector-icons/Feather';

const RING_SIZE = 104;
const RING_RADIUS = 44;
const RING_STROKE = 5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const BAR_WIDTH = 168;
const FADE_DURATION = 260;

const THEMES = {
  value365: {
    accent: '#E52E2E',
    iconColor: '#D32F2F',
    text: '#900C1F',
    subText: '#878787',
    iconBg: 'rgba(229,46,46,0.10)',
    track: 'rgba(229,46,46,0.14)',
    title: 'Deals',
    subtitle: "Fetching today's best deals",
  },
  flipkart: {
    accent: '#FFC200',
    iconColor: '#002F6C',
    text: '#002F6C',
    subText: '#878787',
    iconBg: 'rgba(255,225,27,0.28)',
    track: 'rgba(255,194,0,0.20)',
    title: 'Arise',
    subtitle: 'Taking you back to Arise',
  },
};

/**
 * Branded full-screen loader shown while switching between the Arise and Deals sections.
 * `tab` is the destination brand tab ({ id, icon, iconImage }) so the loader dresses itself
 * in the colors of the section being opened. Stays mounted through its own fade-out.
 */
const BrandSwitchLoader = ({ visible, tab }) => {
  const theme = THEMES[tab?.id] || THEMES.flipkart;
  const [isMounted, setIsMounted] = useState(visible);

  const fade = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      Animated.timing(fade, { toValue: 1, duration: FADE_DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      return undefined;
    }
    Animated.timing(fade, { toValue: 0, duration: FADE_DURATION, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) setIsMounted(false);
      }
    );
    return undefined;
  }, [visible, fade]);

  useEffect(() => {
    if (!isMounted) return undefined;

    const spinLoop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true })
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    const barLoop = Animated.loop(
      Animated.timing(bar, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.cubic), useNativeDriver: true })
    );
    const dotLoops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.25, duration: 320, useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ])
      )
    );

    spin.setValue(0);
    bar.setValue(0);
    spinLoop.start();
    pulseLoop.start();
    barLoop.start();
    dotLoops.forEach((l) => l.start());

    return () => {
      spinLoop.stop();
      pulseLoop.stop();
      barLoop.stop();
      dotLoops.forEach((l) => l.stop());
    };
  }, [isMounted, spin, pulse, bar, dots]);

  if (!isMounted) return null;

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const iconScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
  const barTranslate = bar.interpolate({ inputRange: [0, 1], outputRange: [-BAR_WIDTH * 0.45, BAR_WIDTH] });
  const contentScale = fade.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });

  return (
    <Animated.View style={[styles.root, { opacity: fade }]} pointerEvents="auto">
      <Animated.View style={[styles.content, { transform: [{ scale: contentScale }] }]}>
        <View style={styles.ringWrap}>
            <Animated.View
              style={[
                styles.glow,
                { backgroundColor: theme.accent, opacity: glowOpacity, transform: [{ scale: glowScale }] },
              ]}
            />

            <Animated.View style={{ transform: [{ rotate }] }}>
              <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke={theme.track}
                  strokeWidth={RING_STROKE}
                  fill="none"
                />
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke={theme.accent}
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={`${RING_CIRCUMFERENCE * 0.3} ${RING_CIRCUMFERENCE}`}
                />
              </Svg>
            </Animated.View>

            <Animated.View
              style={[styles.iconCircle, { backgroundColor: theme.iconBg, transform: [{ scale: iconScale }] }]}>
              {tab?.iconImage ? (
                <Image source={tab.iconImage} style={styles.iconImage} resizeMode="contain" />
              ) : (
                <Icon name={tab?.icon || 'sunrise'} size={30} color={theme.iconColor} />
              )}
            </Animated.View>
        </View>

        <Text style={[styles.title, { color: theme.text }]}>{theme.title}</Text>

        <View style={styles.subtitleRow}>
          <Text style={[styles.subtitle, { color: theme.subText }]}>{theme.subtitle}</Text>
          <View style={styles.dotsRow}>
            {dots.map((d, i) => (
              <Animated.View
                key={i}
                style={[styles.dot, { backgroundColor: theme.subText, opacity: d }]}
              />
            ))}
          </View>
        </View>

        <View style={[styles.barTrack, { backgroundColor: theme.track }]}>
          <Animated.View
            style={[
              styles.barFill,
              { backgroundColor: theme.accent, transform: [{ translateX: barTranslate }] },
            ]}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 999,
  },
  content: {
    alignItems: 'center',
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  glow: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  iconCircle: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImage: {
    width: 34,
    height: 34,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  subtitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
    gap: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  barTrack: {
    width: BAR_WIDTH,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 26,
  },
  barFill: {
    width: BAR_WIDTH * 0.45,
    height: '100%',
    borderRadius: 2,
  },
});

export default BrandSwitchLoader;
