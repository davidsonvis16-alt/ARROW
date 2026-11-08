import { useCallback, useEffect, useState } from 'react';

export type TextSize = 'standard' | 'large' | 'larger';

const STORAGE_KEY = 'arrow_text_size';
const EVENT = 'arrow:text-size';

function read(): TextSize {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'large' || stored === 'larger' || stored === 'standard') return stored;
  } catch {
    // Storage unavailable: standard size is fine.
  }
  return 'standard';
}

/**
 * Text size, persisted per browser, for anyone who finds the default small.
 * Stamps data-text-size on the root; theme.css scales the whole interface from
 * there, so every screen grows together rather than only the body copy.
 */
export function useTextSize() {
  const [size, setSizeState] = useState<TextSize>(read);

  useEffect(() => {
    const root = document.documentElement;
    if (size === 'standard') root.removeAttribute('data-text-size');
    else root.setAttribute('data-text-size', size);
  }, [size]);

  // Keep every user of the hook (the app shell and Settings) in step.
  useEffect(() => {
    const onChange = () => setSizeState(read());
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const setSize = useCallback((next: TextSize) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembering is not worth failing over.
    }
    setSizeState(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { size, setSize };
}
