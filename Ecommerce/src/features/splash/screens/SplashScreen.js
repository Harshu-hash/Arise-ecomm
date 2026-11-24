import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { StatusBarManager } from '../../../shared/components';
import { cubicPath, cubicTable, SPARKLES, STREAKS } from '../utils/splashGeometry';

// Intro: a gold light streak sweeps in, the bag-"A" mark appears as a second ring circles it, the wordmark rises, a flare and
// gold waves settle at the bottom, shopping icons fade in and sparkles twinkle. Everything runs on the UI thread (Reanimated), so
// it stays smooth even while the app is starting. It holds its last frame until the app is ready, then fades out.
const MARK = require('../../../assets/images/splash/arise-mark.png');
const WORDMARK = require('../../../assets/images/splash/arise-wordmark.png');

const TOTAL_MS = 3000;
const EXIT_MS = 320;
const SETTLE = Easing.bezier(0.22, 1, 0.36, 1); // fast start, long soft landing
const SWEEP = Easing.bezier(0.45, 0.05, 0.2, 1);
const GOLD = '#FFC83D';
const GOLD_LIGHT = '#FFF1B8';
const GOLD_DEEP = '#F59E0B';
const NAVY = '#02164B';

const MARK_ASPECT = 595 / 904;
const WORD_ASPECT = 247 / 865;

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Shopping icons (Feather outlines, 24x24) that float in the corners.
const ICONS = [
  { x: 0.13, y: 0.29, phase: 0, parts: ['M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6', 'M10 21a1 1 0 1 0 0-.01', 'M21 21a1 1 0 1 0 0-.01'] },
  { x: 0.87, y: 0.31, phase: 0.3, parts: ['M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z', 'M7 7h.01'] },
  { x: 0.13, y: 0.74, phase: 0.6, parts: ['M20 12v10H4V12', 'M2 7h20v5H2z', 'M12 22V7', 'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z', 'M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z'] },
  { x: 0.88, y: 0.73, phase: 0.85, parts: ['M3 4h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M1 10h22'] },
];

/** One glowing layer of a streak: a dash of `trail` length whose front is the streak's head. */
function StreakLayer({ d, length, maxTrail, trail, width, color, opacity, progress }) {
  const props = useAnimatedProps(() => ({ strokeDashoffset: trail - progress.value * (length + maxTrail) }));
  return (
    <AnimatedPath
      d={d}
      animatedProps={props}
      stroke={color}
      strokeOpacity={opacity}
      strokeWidth={width}
      strokeLinecap="round"
      fill="none"
      strokeDasharray={[trail, length + 2 * maxTrail]}
    />
  );
}

/** The bright point at the front of a streak. */
function Spark({ table, maxTrail, progress, size }) {
  const style = useAnimatedStyle(() => {
    const head = progress.value * (table.length + maxTrail);
    const at = Math.min(head, table.length);
    return {
      opacity: interpolate(head, [0, table.length * 0.04, table.length, table.length * 1.15], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(at, table.lengths, table.xs) - size / 2 },
        { translateY: interpolate(at, table.lengths, table.ys) - size / 2 },
        { scale: interpolate(head, [0, table.length], [0.6, 1.25], Extrapolation.CLAMP) },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="spark" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="0.25" stopColor={GOLD_LIGHT} stopOpacity="0.9" />
            <Stop offset="1" stopColor={GOLD_DEEP} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#spark)" />
      </Svg>
    </Animated.View>
  );
}

function Sparkle({ x, y, size, phase, clock, intro }) {
  const style = useAnimatedStyle(() => ({
    opacity: intro.value * (0.2 + 0.8 * (0.5 + 0.5 * Math.sin((clock.value + phase) * 2 * Math.PI))),
    transform: [{ scale: 0.7 + 0.5 * (0.5 + 0.5 * Math.sin((clock.value + phase) * 2 * Math.PI)) }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.sparkle, { left: x, top: y, width: size, height: size, borderRadius: size }, style]} />;
}

function FloatingIcon({ icon, size, stageTop, stageSize, clock, delay, reduced }) {
  const visible = useSharedValue(0);
  useEffect(() => {
    visible.value = withDelay(reduced ? 0 : delay, withTiming(1, { duration: reduced ? 0 : 700, easing: Easing.out(Easing.quad) }));
  }, [delay, reduced, visible]);
  const style = useAnimatedStyle(() => ({
    opacity: visible.value * 0.42,
    transform: [{ translateY: Math.sin((clock.value + icon.phase) * 2 * Math.PI) * 3 + (1 - visible.value) * 8 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { left: icon.x * stageSize - size / 2, top: stageTop + icon.y * stageSize - size / 2, width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#D9A21E" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
        {icon.parts.map((part) => <Path key={part} d={part} />)}
      </Svg>
    </Animated.View>
  );
}

const SplashScreen = ({ ready = true, onFinish = () => {} }) => {
  const { width: W, height: H } = useWindowDimensions();
  const reduced = useReducedMotion();
  const S = W; // the artwork is composed on a square as wide as the screen
  const stageTop = H / 2 - S / 2;

  const layout = useMemo(() => {
    const markW = S * 0.6;
    const markH = markW * MARK_ASPECT;
    const wordW = S * 0.5;
    const wordH = wordW * WORD_ASPECT;
    const groupH = markH + S * 0.02 + wordH;
    const top = H / 2 - groupH / 2 - S * 0.02;
    return { markW, markH, markLeft: (W - markW) / 2, markTop: top, wordW, wordH, wordLeft: (W - wordW) / 2, wordTop: top + markH + S * 0.02 };
  }, [W, H, S]);

  const streaks = useMemo(() => Object.fromEntries(Object.entries(STREAKS).map(([name, points]) => {
    const scaled = points.map(([x, y]) => [x * S, stageTop + y * S]);
    return [name, { table: cubicTable(scaled), d: cubicPath(scaled) }];
  })), [S, stageTop]);

  const sweep = useSharedValue(0);
  const orbit = useSharedValue(0);
  const markIn = useSharedValue(0);
  const markScale = useSharedValue(0.86);
  const glow = useSharedValue(0);
  const wordIn = useSharedValue(0);
  const flare = useSharedValue(0);
  const wavesIn = useSharedValue(0);
  const sparklesIn = useSharedValue(0);
  const clock = useSharedValue(0);
  const exit = useSharedValue(1);
  const [animationDone, setAnimationDone] = useState(false);

  useEffect(() => {
    const k = reduced ? 0 : 1; // reduced motion: jump to the finished picture
    const play = (value, to, delay, duration, easing = SETTLE) => { value.value = withDelay(delay * k, withTiming(to, { duration: duration * k, easing })); };
    play(sweep, 1, 100, 1150, SWEEP);
    play(orbit, 1, 650, 1500, SWEEP);
    play(markIn, 1, 700, 600, Easing.out(Easing.quad));
    play(markScale, 1, 700, 1000);
    play(glow, 1, 800, 1000, Easing.out(Easing.quad));
    play(wordIn, 1, 1300, 800);
    play(wavesIn, 1, 1450, 1000);
    play(sparklesIn, 1, 900, 800, Easing.out(Easing.quad));
    flare.value = reduced ? 0 : withDelay(1300, withSequence(withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) }), withTiming(0, { duration: 900, easing: Easing.in(Easing.quad) })));
    clock.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.linear }), -1);
    const timer = setTimeout(() => setAnimationDone(true), reduced ? 500 : TOTAL_MS);
    return () => clearTimeout(timer);
  }, [reduced, sweep, orbit, markIn, markScale, glow, wordIn, flare, wavesIn, sparklesIn, clock]);

  // Hold the last frame until the app is ready, then fade out and hand over.
  useEffect(() => {
    if (!(animationDone && ready)) return;
    exit.value = withTiming(0, { duration: reduced ? 0 : EXIT_MS, easing: Easing.in(Easing.quad) }, (finished) => {
      if (finished) runOnJS(onFinish)();
    });
  }, [animationDone, ready, reduced, exit, onFinish]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: exit.value }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value * (0.85 + 0.15 * Math.sin(clock.value * 2 * Math.PI)) }));
  const markStyle = useAnimatedStyle(() => ({ opacity: markIn.value, transform: [{ scale: markScale.value }] }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: wordIn.value, transform: [{ translateY: (1 - wordIn.value) * 26 }, { scale: 0.95 + 0.05 * wordIn.value }] }));
  const flareStyle = useAnimatedStyle(() => ({ opacity: flare.value, transform: [{ scaleX: 0.25 + 0.75 * flare.value }] }));
  const wavesStyle = useAnimatedStyle(() => ({ opacity: wavesIn.value, transform: [{ translateY: (1 - wavesIn.value) * S * 0.12 }] }));

  const glowSize = S * 1.2;
  const waveH = S * 0.34;
  const flareW = S * 1.1;
  const flareH = S * 0.2;
  const markCenterY = layout.markTop + layout.markH / 2;
  const longTrail = streaks.sweep.table.length * 0.6;

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      <StatusBarManager barStyle="light-content" themeColor={NAVY} />

      <Svg width={W} height={H} style={styles.abs}>
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#02164B" />
            <Stop offset="0.38" stopColor="#020B2B" />
            <Stop offset="0.72" stopColor="#01061A" />
            <Stop offset="1" stopColor="#02050F" />
          </LinearGradient>
          <RadialGradient id="bloom" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#0B2A7A" stopOpacity="0.45" />
            <Stop offset="1" stopColor="#0B2A7A" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width={W} height={H} fill="url(#bg)" />
        <Ellipse cx={W / 2} cy={markCenterY} rx={S * 0.75} ry={S * 0.6} fill="url(#bloom)" />
      </Svg>

      <Animated.View pointerEvents="none" style={[styles.abs, { left: (W - glowSize) / 2, top: markCenterY - glowSize / 2, width: glowSize, height: glowSize }, glowStyle]}>
        <Svg width={glowSize} height={glowSize}>
          <Defs>
            <RadialGradient id="logoGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={GOLD_DEEP} stopOpacity="0.3" />
              <Stop offset="0.55" stopColor={GOLD_DEEP} stopOpacity="0.08" />
              <Stop offset="1" stopColor={GOLD_DEEP} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={glowSize / 2} cy={glowSize / 2} r={glowSize / 2} fill="url(#logoGlow)" />
        </Svg>
      </Animated.View>

      {SPARKLES.map(([x, y, size, phase]) => (
        <Sparkle key={`${x}-${y}`} x={x * S} y={stageTop + y * S} size={size} phase={phase} clock={clock} intro={sparklesIn} />
      ))}

      {ICONS.map((icon, index) => (
        <FloatingIcon key={icon.parts[0]} icon={icon} size={S * 0.075} stageTop={stageTop} stageSize={S} clock={clock} delay={1900 + index * 130} reduced={reduced} />
      ))}

      <Animated.View pointerEvents="none" style={[styles.abs, { left: 0, bottom: 0, width: W, height: waveH }, wavesStyle]}>
        <Svg width={W} height={waveH} viewBox={`0 0 ${W} ${waveH}`}>
          <Defs>
            <LinearGradient id="ribbon" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={GOLD} stopOpacity="0.55" />
              <Stop offset="0.35" stopColor={GOLD_DEEP} stopOpacity="0.16" />
              <Stop offset="1" stopColor="#7A4A00" stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={GOLD_LIGHT} stopOpacity="0.95" />
              <Stop offset="0.5" stopColor={GOLD} stopOpacity="0.55" />
              <Stop offset="1" stopColor={GOLD_LIGHT} stopOpacity="0.9" />
            </LinearGradient>
          </Defs>
          <Path d={`M0,${waveH * 0.5} C${W * 0.3},${waveH * 0.22} ${W * 0.62},${waveH * 0.62} ${W},${waveH * 0.3} L${W},${waveH} L0,${waveH} Z`} fill="url(#ribbon)" />
          <Path d={`M0,${waveH * 0.5} C${W * 0.3},${waveH * 0.22} ${W * 0.62},${waveH * 0.62} ${W},${waveH * 0.3}`} stroke="url(#edge)" strokeWidth={2} fill="none" strokeLinecap="round" />
          <Path d={`M0,${waveH * 0.72} C${W * 0.35},${waveH * 0.5} ${W * 0.7},${waveH * 0.86} ${W},${waveH * 0.58}`} stroke="url(#edge)" strokeOpacity={0.55} strokeWidth={1.2} fill="none" strokeLinecap="round" />
        </Svg>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.abs, { left: (W - flareW) / 2, bottom: S * 0.2 - flareH / 2, width: flareW, height: flareH }, flareStyle]}>
        <Svg width={flareW} height={flareH}>
          <Defs>
            <RadialGradient id="flare" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
              <Stop offset="0.18" stopColor={GOLD_LIGHT} stopOpacity="0.7" />
              <Stop offset="1" stopColor={GOLD_DEEP} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx={flareW / 2} cy={flareH / 2} rx={flareW / 2} ry={flareH * 0.18} fill="url(#flare)" />
        </Svg>
      </Animated.View>

      <Animated.Image source={MARK} resizeMode="contain" style={[styles.abs, { left: layout.markLeft, top: layout.markTop, width: layout.markW, height: layout.markH }, markStyle]} />
      <Animated.Image source={WORDMARK} resizeMode="contain" style={[styles.abs, { left: layout.wordLeft, top: layout.wordTop, width: layout.wordW, height: layout.wordH }, wordStyle]} />

      <Svg width={W} height={H} style={styles.abs} pointerEvents="none">
        <StreakLayer {...streaks.sweep} length={streaks.sweep.table.length} maxTrail={longTrail} trail={longTrail} width={S * 0.03} color={GOLD_DEEP} opacity={0.18} progress={sweep} />
        <StreakLayer {...streaks.sweep} length={streaks.sweep.table.length} maxTrail={longTrail} trail={longTrail * 0.75} width={S * 0.01} color={GOLD} opacity={0.75} progress={sweep} />
        <StreakLayer {...streaks.sweep} length={streaks.sweep.table.length} maxTrail={longTrail} trail={longTrail * 0.4} width={S * 0.004} color={GOLD_LIGHT} opacity={1} progress={sweep} />
        <StreakLayer {...streaks.orbit} length={streaks.orbit.table.length} maxTrail={longTrail} trail={longTrail * 0.9} width={S * 0.006} color={GOLD} opacity={0.5} progress={orbit} />
        <StreakLayer {...streaks.orbit} length={streaks.orbit.table.length} maxTrail={longTrail} trail={longTrail * 0.45} width={S * 0.003} color={GOLD_LIGHT} opacity={0.95} progress={orbit} />
      </Svg>
      <Spark table={streaks.sweep.table} maxTrail={longTrail} progress={sweep} size={S * 0.12} />
      <Spark table={streaks.orbit.table} maxTrail={longTrail} progress={orbit} size={S * 0.08} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY, overflow: 'hidden' },
  abs: { position: 'absolute' },
  sparkle: { position: 'absolute', backgroundColor: GOLD_LIGHT },
});

export default SplashScreen;
