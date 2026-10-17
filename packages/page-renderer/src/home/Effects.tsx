'use client';

import { useEffect } from 'react';

/**
 * Revela `.cb-reveal` ao entrar na viewport (uma vez): adiciona `.cb-in`. Elementos já marcados no HTML não animam.
 * Observa também elementos que aparecem depois da montagem (seção adicionada/reexibida no editor).
 */
export function HomeEffects() {
  useEffect(() => {
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('cb-in');
      io.unobserve(e.target);
    }), { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    const scan = () => document.querySelectorAll('.pg-home .cb-reveal:not(.cb-in)').forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      io.observe(el);
    });
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, []);
  return null;
}
