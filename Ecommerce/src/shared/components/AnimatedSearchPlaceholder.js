import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';

const TYPE_SPEED = 60;
const DELETE_SPEED = 30;
const HOLD_DURATION = 1400;
const PAUSE_BEFORE_NEXT = 300;

/**
 * Cycles through `phrases`, typing each one out character by character,
 * holding, then deleting before moving to the next — a typewriter effect
 * used as the search bar's animated placeholder.
 */
const AnimatedSearchPlaceholder = ({ phrases, style, numberOfLines = 1 }) => {
  const [displayText, setDisplayText] = useState('');
  const phraseIndexRef = useRef(0);
  const charIndexRef = useRef(0);
  const phaseRef = useRef('typing'); // 'typing' | 'holding' | 'deleting' | 'pausing'

  useEffect(() => {
    if (!phrases || phrases.length === 0) return undefined;

    let timeoutId;

    const tick = () => {
      const currentPhrase = phrases[phraseIndexRef.current];

      switch (phaseRef.current) {
        case 'typing': {
          charIndexRef.current += 1;
          setDisplayText(currentPhrase.slice(0, charIndexRef.current));
          if (charIndexRef.current >= currentPhrase.length) {
            phaseRef.current = 'holding';
            timeoutId = setTimeout(tick, HOLD_DURATION);
          } else {
            timeoutId = setTimeout(tick, TYPE_SPEED);
          }
          break;
        }
        case 'holding': {
          phaseRef.current = phrases.length > 1 ? 'deleting' : 'holding';
          timeoutId = setTimeout(tick, phrases.length > 1 ? DELETE_SPEED : HOLD_DURATION);
          break;
        }
        case 'deleting': {
          charIndexRef.current -= 1;
          setDisplayText(currentPhrase.slice(0, charIndexRef.current));
          if (charIndexRef.current <= 0) {
            phraseIndexRef.current = (phraseIndexRef.current + 1) % phrases.length;
            phaseRef.current = 'pausing';
            timeoutId = setTimeout(tick, PAUSE_BEFORE_NEXT);
          } else {
            timeoutId = setTimeout(tick, DELETE_SPEED);
          }
          break;
        }
        case 'pausing':
        default: {
          phaseRef.current = 'typing';
          timeoutId = setTimeout(tick, TYPE_SPEED);
          break;
        }
      }
    };

    timeoutId = setTimeout(tick, TYPE_SPEED);
    return () => clearTimeout(timeoutId);
  }, [phrases]);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {displayText}
    </Text>
  );
};

export default AnimatedSearchPlaceholder;
