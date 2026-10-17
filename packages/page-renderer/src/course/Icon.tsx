import type { IconName } from './schemas';

const stroke = { fill: 'none', stroke: 'currentColor' } as const;

/** Sprite único da página; os ícones o referenciam por `<use href="#i-nome">`. */
export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <symbol id="i-check" viewBox="0 0 24 24"><path {...stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7.5" /></symbol>
      <symbol id="i-shield" viewBox="0 0 24 24"><path {...stroke} strokeWidth="1.7" strokeLinejoin="round" d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" /><path {...stroke} strokeWidth="1.7" strokeLinecap="round" d="m9 12 2 2 4-4" /></symbol>
      <symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5" {...stroke} strokeWidth="1.7" /><path {...stroke} strokeWidth="1.7" d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></symbol>
      <symbol id="i-bolt" viewBox="0 0 24 24"><path {...stroke} strokeWidth="1.7" strokeLinejoin="round" d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" /></symbol>
      <symbol id="i-card" viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2.5" {...stroke} strokeWidth="1.7" /><path stroke="currentColor" strokeWidth="1.7" d="M3 10h18M7 15h3" /></symbol>
      <symbol id="i-pix" viewBox="0 0 24 24"><path {...stroke} strokeWidth="1.7" strokeLinejoin="round" d="M12 2.8 21.2 12 12 21.2 2.8 12 12 2.8Z" /><path {...stroke} strokeWidth="1.7" d="M7.5 7.5 12 12l4.5-4.5M7.5 16.5 12 12l4.5 4.5" /></symbol>
      <symbol id="i-barcode" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="1.7" d="M4 5v14M7 5v14M10.5 5v14M13 5v14M16.5 5v14M20 5v14" /></symbol>
      <symbol id="i-star" viewBox="0 0 24 24"><path fill="currentColor" d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8L12 3Z" /></symbol>
      <symbol id="i-arrow" viewBox="0 0 24 24"><path {...stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" /></symbol>
      <symbol id="i-scissors" viewBox="0 0 24 24"><circle cx="6" cy="6.5" r="2.8" {...stroke} strokeWidth="1.7" /><circle cx="6" cy="17.5" r="2.8" {...stroke} strokeWidth="1.7" /><path {...stroke} strokeWidth="1.7" strokeLinecap="round" d="M8.3 8.2 20 18.5M8.3 15.8 20 5.5" /></symbol>
      <symbol id="i-face" viewBox="0 0 24 24"><path {...stroke} strokeWidth="1.7" d="M12 3c-4 0-6.5 3-6.5 7.5 0 5 3 10.5 6.5 10.5s6.5-5.5 6.5-10.5C18.5 6 16 3 12 3Z" /><path {...stroke} strokeWidth="1.7" strokeLinecap="round" d="M9.5 15.5c1.4 1 3.6 1 5 0" /></symbol>
      <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" {...stroke} strokeWidth="1.7" /><path stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></symbol>
      <symbol id="i-gem" viewBox="0 0 24 24"><path {...stroke} strokeWidth="1.7" strokeLinejoin="round" d="M6.5 4h11L21 9l-9 11L3 9l3.5-5Z" /><path {...stroke} strokeWidth="1.7" strokeLinejoin="round" d="M3 9h18M9.5 4 8 9l4 11 4-11-1.5-5" /></symbol>
      <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" {...stroke} strokeWidth="1.7" /><path stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" d="M12 11v5.5M12 7.6v.1" /></symbol>
      <symbol id="i-alert" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" {...stroke} strokeWidth="1.7" /><path stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" d="M12 7.5V13M12 16.4v.1" /></symbol>
      <symbol id="i-chev" viewBox="0 0 24 24"><path {...stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></symbol>
      <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" {...stroke} strokeWidth="1.7" /><path {...stroke} strokeWidth="1.7" strokeLinecap="round" d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" /></symbol>
    </svg>
  );
}

export function Icon({ name, className, size }: { name: IconName; className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}
