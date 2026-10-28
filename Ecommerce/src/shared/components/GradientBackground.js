import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

/**
 * Absolute-fill diagonal gradient backdrop (no native linear-gradient dependency needed —
 * react-native-svg is already installed/linked). Wrap content as a sibling, not a child.
 */
let gradIdCounter = 0;

const GradientBackground = ({ colors, id }) => {
  const gradIdRef = React.useRef(null);
  if (!gradIdRef.current) {
    gradIdRef.current = ++gradIdCounter;
  }
  const gradId = id ? `${id}_${gradIdRef.current}` : `auto_grad_${gradIdRef.current}`;

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      pointerEvents="none">
      <Defs>
        <LinearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
          {colors.map((c, i) => (
            <Stop key={`${gradId}_${c}_${i}`} offset={`${(i / (colors.length - 1)) * 100}%`} stopColor={c} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${gradId})`} />
    </Svg>
  );
};

export default GradientBackground;
