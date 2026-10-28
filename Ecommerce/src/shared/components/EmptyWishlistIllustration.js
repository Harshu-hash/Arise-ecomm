import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { COLORS } from '../../constants/colors';

/** Simple line-art heart illustration for the empty-wishlist state. */
const EmptyWishlistIllustration = ({ size = 140 }) => (
  <Svg width={size} height={size} viewBox="0 0 140 140" fill="none">
    <Path
      d="M70 105 C40 82 22 64 22 44 C22 28 34 18 48 18 C58 18 66 24 70 32 C74 24 82 18 92 18 C106 18 118 28 118 44 C118 64 100 82 70 105 Z"
      stroke={COLORS.border}
      strokeWidth={4}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <Path d="M70 105 C40 82 22 64 22 44" stroke={COLORS.border} strokeWidth={4} strokeLinecap="round" fill="none" opacity={0} />
    <Circle cx="100" cy="30" r="6" fill={COLORS.primary} opacity={0.9} />
    <Path d="M108 20 L114 26" stroke={COLORS.primary} strokeWidth={3} strokeLinecap="round" />
  </Svg>
);

export default EmptyWishlistIllustration;
