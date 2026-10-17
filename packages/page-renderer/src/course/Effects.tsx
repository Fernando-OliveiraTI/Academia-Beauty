'use client';

import { useEffect } from 'react';
import { useReducedMotion } from './state';

const ROOT = '.pg-course';
const qsa = <T extends Element = HTMLElement>(sel: string) => Array.from(document.querySelectorAll<T>(`${ROOT} ${sel}`));

/** Header com fundo ao rolar, barra de progresso e link ativo do menu (scroll-spy). */
function useScrollChrome() {
  useEffect(() => {
    const header = document.getElementById('header');
    const progress = document.querySelector<HTMLElement>(`${ROOT} .scroll-progress`);
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      header?.classList.toggle('is-scrolled', y > 24);
      progress?.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : '0');
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();

    const links = qsa<HTMLAnchorElement>('.nav a');
    // O menu é editável: só âncoras internas (#id) viram seção observada; qualquer outro href é ignorado (querySelector lançaria).
    const sections = links
      .map((a) => {
        const href = a.getAttribute('href') ?? '';
        return href.length > 1 && href.startsWith('#') ? document.getElementById(href.slice(1)) : null;
      })
      .filter((s): s is HTMLElement => !!s);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${e.target.id}`));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => io.observe(s));

    return () => {
      window.removeEventListener('scroll', onScroll);
      io.disconnect();
    };
  }, []);
}

/** Só esconde o que está abaixo da dobra no carregamento: o primeiro quadro já é completo. */
function useReveal(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const pending: Element[] = [];
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.remove('is-pending');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    qsa('.reveal').forEach((el) => {
      if (el.getBoundingClientRect().top > window.innerHeight * 0.92) {
        el.classList.add('is-pending');
        pending.push(el);
        io.observe(el);
      }
    });
    return () => {
      io.disconnect();
      pending.forEach((el) => el.classList.remove('is-pending'));
    };
  }, [enabled]);
}

/** Contadores da prova social: contam de 0 ao valor quando entram na viewport. */
function useCounters(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
    const frames = new Set<number>();
    const targets = qsa('[data-count]');
    const finals = new Map(targets.map((el) => [el, el.textContent ?? '']));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        const el = e.target as HTMLElement;
        const end = parseFloat(el.dataset.count ?? '0');
        const decimals = String(el.dataset.count).includes('.') ? 1 : 0;
        const pre = el.dataset.prefix ?? '';
        const suf = el.dataset.suffix ?? '';
        const start = performance.now();
        const duration = 1100;
        const step = (t: number) => {
          const k = Math.min(1, (t - start) / duration);
          const eased = 1 - Math.pow(1 - k, 3);
          const v = decimals ? Math.round(end * eased * 10) / 10 : Math.round(end * eased);
          el.textContent = pre + fmt.format(v) + suf;
          if (k < 1) frames.add(requestAnimationFrame(step));
        };
        frames.add(requestAnimationFrame(step));
      });
    }, { threshold: 0.6 });
    targets.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      frames.forEach(cancelAnimationFrame);
      finals.forEach((text, el) => { el.textContent = text; });
    };
  }, [enabled]);
}

/** Efeitos de página do template Curso. Atuam sobre o DOM renderizado no servidor, sem alterá-lo. */
export function CourseEffects() {
  const reduced = useReducedMotion();
  useScrollChrome();
  useReveal(!reduced);
  useCounters(!reduced);
  return null;
}
