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
    // Menu lateral: marca a seção que está no meio da tela (igual ao menu do curso). Refaz a observação quando os links mudam.
    let spy: IntersectionObserver | null = null;
    let signature = '';
    const bindSpy = () => {
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.pg-pro .pro-side-nav a'));
      const sig = links.map((a) => a.getAttribute('href') ?? '').join('|');
      if (sig === signature) return;
      signature = sig;
      spy?.disconnect();
      // O menu é editável: só âncoras internas (#id) viram seção observada; qualquer outro href é ignorado.
      const targets = links
        .map((a) => {
          const href = a.getAttribute('href') ?? '';
          return href.length > 1 && href.startsWith('#') ? document.getElementById(href.slice(1)) : null;
        })
        .filter((t): t is HTMLElement => !!t);
      spy = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${e.target.id}`));
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      targets.forEach((t) => spy!.observe(t));
    };
    scan();
    bindSpy();
    const mo = new MutationObserver(() => { scan(); bindSpy(); });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
      spy?.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);
  return null;
}
