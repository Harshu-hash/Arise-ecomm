import React from 'react';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { COLORS } from '../../constants/colors';

/** Simple line-art shopping-cart illustration for the empty-cart state. */
const EmptyCartIllustration = ({ size = 140 }) => (
  <Svg width={size} height={size} viewBox="0 0 140 140" fill="none">
    <Path
      d="M20 30 H35 L48 90 H105 L118 48 H42"
      stroke={COLORS.border}
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Line x1="55" y1="48" x2="55" y2="90" stroke={COLORS.border} strokeWidth={3} />
    <Line x1="75" y1="48" x2="75" y2="90" stroke={COLORS.border} strokeWidth={3} />
    <Line x1="95" y1="48" x2="95" y2="90" stroke={COLORS.border} strokeWidth={3} />
    <Circle cx="58" cy="104" r="7" fill={COLORS.border} />
    <Circle cx="98" cy="104" r="7" fill={COLORS.border} />
    <Path d="M55 22 L68 34" stroke={COLORS.primary} strokeWidth={4} strokeLinecap="round" />
    <Circle cx="68" cy="34" r="5" fill={COLORS.primary} />
  </Svg>
);

export default EmptyCartIllustration;
