// Light / dark / system theme — the logic half.
//
// No JSX in here on purpose: the test runner strips types but not JSX, so
// keeping this a .ts file lets `npm test` import the cycle and check it. The
// button lives in ThemeToggle.tsx.
//
// "system" is the default and a real setting, not just the initial guess: while
// it's selected the page keeps following the OS, so flipping your machine to
// dark at sunset flips the drawing too, without a reload.
//
// The class is applied to <html> by a tiny blocking script in index.html before
// first paint. This module keeps it in sync afterwards — if you change the
// storage key or the class here, change it there too. test/theme.test.ts pins
// that agreement.

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export const THEME_KEY = 'shedder:theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * One button cycles the lot, so the order is part of the UI.
 *
 * Starts at system; the first press is the one people reach for in a dark room,
 * so it goes there before light, and light hands back to system.
 */
export const THEME_CYCLE: Record<Theme, Theme> = {
  system: 'dark',
  dark: 'light',
  light: 'system',
};

export function nextTheme(theme: Theme): Theme {
  return THEME_CYCLE[theme];
}

export function readStored(): Theme {
  if (typeof localStorage === 'undefined') return 'system';
  const v = localStorage.getItem(THEME_KEY);
  // Anything unrecognised means follow the system — index.html does the same.
  return v === 'light' || v === 'dark' ? v : 'system';
}

/** Paint the choice onto <html>. `colorScheme` is what retints the native bits:
 *  scrollbars, focus rings, and the number-input steppers. */
function apply(dark: boolean) {
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readStored);

  useEffect(() => {
    const mq = window.matchMedia(DARK_QUERY);
    const sync = () => apply(theme === 'dark' || (theme === 'system' && mq.matches));
    sync();

    // Only listen while following the system; an explicit choice is absolute.
    if (theme !== 'system') return;
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private mode or storage disabled — the theme just won't persist.
    }
  }, []);

  // Cycles from the live state, not from storage: if a write ever failed the
  // two would diverge and the button would jump.
  const cycle = useCallback(() => setTheme(nextTheme(theme)), [setTheme, theme]);

  return { theme, setTheme, cycle };
}
