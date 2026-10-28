import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

const FLIP_DURATION = 700;
const HOLD_BEFORE_REPEAT = 3300; // total cycle ~4s

/**
 * Loops: flip the image a full 360° to the right every ~4 seconds — infinitely.
 */
const DribbleFlipImage = ({ source, style }) => {
  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flipAnim, {
          toValue: 1,
          duration: FLIP_DURATION,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(HOLD_BEFORE_REPEAT),
        Animated.timing(flipAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [flipAnim]);

  const rotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.Image
      source={source}
      resizeMode="contain"
      style={[
        style,
        {
          transform: [
            { perspective: 300 },
            { rotateY },
          ],
        },
      ]}
    />
  );
};

export default DribbleFlipImage;
