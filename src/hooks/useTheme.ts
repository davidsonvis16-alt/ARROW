import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'arrow_theme';

function read(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // Private browsing, or storage disabled. The system default is fine.
  }
  return 'system';
}

/**
 * Theme preference, persisted per browser.
 *
 * "system" writes no attribute at all, which lets the prefers-color-scheme
 * block in theme.css decide. An explicit choice stamps data-theme on the root,
 * where the matching token block wins over the media query.
 */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(read);

  useEffect(() => {
    const root = document.documentElement;

    if (preference === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', preference);
    }

    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Not being able to remember the choice is not worth failing over.
    }
  }, [preference]);

  /** Cycle through the three states, which is what a single button should do. */
  const cycle = useCallback(() => {
    setPreference((prev) => (prev === 'system' ? 'light' : prev === 'light' ? 'dark' : 'system'));
  }, []);

  return { preference, setPreference, cycle };
}
