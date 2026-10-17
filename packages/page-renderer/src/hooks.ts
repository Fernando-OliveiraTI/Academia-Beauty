import { useSyncExternalStore } from 'react';

/** Subscreve uma media query; no servidor assume `fallback` para não divergir na hidratação. */
export function useMediaQuery(query: string, fallback = false): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', notify);
      return () => mq.removeEventListener('change', notify);
    },
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}

export const DESKTOP_QUERY = '(min-width: 900px)';
export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
