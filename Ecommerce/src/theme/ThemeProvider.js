import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors } from './lightTheme';
import { darkColors } from './darkTheme';
import { typography, fontWeights } from './typography';
import { spacing, screenPadding, touchTarget } from './spacing';
import { radius } from './radius';
import { elevation } from './elevation';
import { durations, easings, springs, pressedScale, pressedOpacity } from './animations';

export const THEME_MODES = { light: 'light', dark: 'dark', system: 'system' };

const ThemeContext = createContext(null);

/**
 * Theme context provider. UI concern only (allowed to use Context per
 * project rules — this is not business state).
 * Mode preference persistence is wired in app/startup via MMKV.
 */
export function ThemeProvider({ initialMode = THEME_MODES.system, children }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState(initialMode);

  const resolvedScheme =
    mode === THEME_MODES.system ? systemScheme || THEME_MODES.light : mode;
  const isDark = resolvedScheme === THEME_MODES.dark;

  const toggleMode = useCallback(() => {
    setMode(prev => {
      const current = prev === THEME_MODES.system ? systemScheme : prev;
      return current === THEME_MODES.dark ? THEME_MODES.light : THEME_MODES.dark;
    });
  }, [systemScheme]);

  const theme = useMemo(
    () => ({
      isDark,
      mode,
      colors: isDark ? darkColors : lightColors,
      typography,
      fontWeights,
      spacing,
      screenPadding,
      touchTarget,
      radius,
      elevation,
      durations,
      easings,
      springs,
      pressedScale,
      pressedOpacity,
      setMode,
      toggleMode,
    }),
    [isDark, mode, toggleMode],
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** Access the active theme. Throws if used outside ThemeProvider. */
export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return theme;
}
