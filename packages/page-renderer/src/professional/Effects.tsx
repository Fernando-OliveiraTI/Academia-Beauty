'use client';

import { useEffect } from 'react';

const SELECTOR = '.pg-pro .reveal, .pg-pro .work-card, .pg-pro .cb-course';

/**
 * Revela `.reveal`, `.work-card` e `.cb-course` ao entrar na viewport; os cards de trabalhos entram em cascata (100 ms).
 * Observa também elementos que aparecem depois da montagem (seção adicionada/reexibida no editor).
 */
export function ProfessionalEffects() {
  useEffect(() => {
    const timers: number[] = [];
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const parent = entry.target.parentElement;
        const stagger = parent && (parent.classList.contains('work-grid') || parent.classList.contains('cb-courses'))
          ? Array.from(parent.children).indexOf(entry.target) : 0;
        timers.push(window.setTimeout(() => entry.target.classList.add('in'), Math.max(0, stagger) * 100));
        io.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
    const scan = () => document.querySelectorAll(SELECTOR).forEach((el) => {
      if (seen.has(el) || el.classList.contains('in')) return;
      seen.add(el);
      io.observe(el);
    });
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);
  return null;
}
