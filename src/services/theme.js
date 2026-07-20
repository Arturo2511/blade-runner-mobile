/**
 * Centralised theme service.
 *
 * Provides a `ThemeProvider` context wrapping the app, exposing:
 *  - `mode`       : 'auto' | 'light' | 'dark'
 *  - `isDark`     : resolved boolean (auto follows the system)
 *  - `colors`     : palette active (surfaces / textes / bordures / accent)
 *  - `setMode`    : persist the new mode in AsyncStorage (key: theme_mode)
 *
 * The palette only covers neutral surfaces. Semantic colours
 * (severityColors / qualityGateColors / statusColors) stay in
 * `src/data/reviewColors.js` — identical in both modes by design.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = 'theme_mode';

export const lightColors = {
  bg: '#F5F5F7',
  card: '#FFFFFF',
  cardAlt: '#F0F0F3',
  border: '#E0E0E0',
  text: '#1A1A1A',
  textMuted: '#666',
  textFaint: '#999',
  accent: '#1976D2',
  overlay: 'rgba(0,0,0,0.4)',
  codeBg: '#F8F8F8',
  // Helpers used across components, derived but pre-resolved for convenience
  diffAddBg: 'rgba(76,175,80,0.10)',
  diffRemoveBg: 'rgba(244,67,54,0.08)',
  lineBorder: 'rgba(0,0,0,0.05)',
  // AI banner tint (blue-ish)
  bannerBg: '#E3F2FD',
  bannerAccent: '#1976D2',
  chipBg: '#E3F2FD',
  chipText: '#0D47A1',
};

export const darkColors = {
  bg: '#1E1E1E',
  card: '#252526',
  cardAlt: '#2A2A2E',
  border: '#333',
  text: '#FFF',
  textMuted: '#AAA',
  textFaint: '#777',
  accent: '#64B5F6',
  overlay: 'rgba(0,0,0,0.6)',
  codeBg: '#1A1A1A',
  diffAddBg: 'rgba(76,175,80,0.15)',
  diffRemoveBg: 'rgba(244,67,54,0.15)',
  lineBorder: 'rgba(255,255,255,0.03)',
  bannerBg: '#1F2A38',
  bannerAccent: '#7CC4FF',
  chipBg: '#2F3A4A',
  chipText: '#CFE3FF',
};

const ThemeContext = createContext({
  mode: 'auto',
  isDark: true,
  colors: darkColors,
  setMode: () => {},
  ready: false,
});

const VALID_MODES = ['auto', 'light', 'dark'];

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState('auto');
  const [ready, setReady] = useState(false);

  // Load the persisted mode once.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (mounted && stored && VALID_MODES.includes(stored)) {
          setModeState(stored);
        }
      } catch (err) {
        // Non fatal — keep default 'auto'
        console.warn('theme: could not read stored mode', err);
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const setMode = async (next) => {
    if (!VALID_MODES.includes(next)) return;
    setModeState(next);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (err) {
      console.warn('theme: could not persist mode', err);
    }
  };

  const isDark = useMemo(() => {
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    // auto
    return systemScheme !== 'light';
  }, [mode, systemScheme]);

  const colors = isDark ? darkColors : lightColors;

  const value = useMemo(
    () => ({ mode, setMode, isDark, colors, ready }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, isDark, ready]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeProvider;
