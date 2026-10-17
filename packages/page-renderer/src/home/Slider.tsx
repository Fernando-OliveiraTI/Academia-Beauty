'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks';

const AUTOPLAY_MS = 4000;
const GAP = 24; // mesmo gap do CSS (.professores-slider)

type Item = { name: string; photo: string; href: string };

/**
 * Slider de profissionais: scroll nativo com snap, setas e autoplay de 4 s que rebobina no fim.
 * Pausa com o ponteiro dentro, com o foco de teclado dentro, com a aba oculta e com reduced-motion (o original só pausava com o ponteiro).
 */
export function ProfessionalsSlider({
  items, prevLabel, nextLabel, cardLabel,
}: { items: Item[]; prevLabel: string; nextLabel: string; cardLabel: string }) {
  const slider = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const step = useCallback(() => {
    const first = slider.current?.querySelector<HTMLElement>('.professor-card-link');
    return first ? first.offsetWidth + GAP : 260;
  }, []);
  const scrollBy = useCallback((dir: 1 | -1) => slider.current?.scrollBy({ left: dir * step(), behavior: reduced ? 'auto' : 'smooth' }), [step, reduced]);

  useEffect(() => {
    const el = slider.current;
    const wrap = wrapper.current;
    if (!el || !wrap || reduced) return;
    let timer = 0;
    let hovering = false;
    let focusing = false;
    const tick = () => {
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 10) el.scrollTo({ left: 0, behavior: 'smooth' });
      else el.scrollBy({ left: step(), behavior: 'smooth' });
    };
    const sync = () => {
      window.clearInterval(timer);
      if (!hovering && !focusing && !document.hidden) timer = window.setInterval(tick, AUTOPLAY_MS);
    };
    const on = (type: string, fn: (e: Event) => void) => { wrap.addEventListener(type, fn); return () => wrap.removeEventListener(type, fn); };
    const offs = [
      on('mouseenter', () => { hovering = true; sync(); }),
      on('mouseleave', () => { hovering = false; sync(); }),
      // Só o foco de teclado pausa (WCAG 2.2.2); o foco deixado por um clique do mouse não deve travar o autoplay.
      on('focusin', (e) => { focusing = (e.target as HTMLElement).matches(':focus-visible'); sync(); }),
      on('focusout', () => { focusing = false; sync(); }),
    ];
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      window.clearInterval(timer);
      offs.forEach((off) => off());
      document.removeEventListener('visibilitychange', sync);
    };
  }, [reduced, step]);

  return (
    <div className="professores-slider-wrapper" ref={wrapper}>
      <button id="sliderPrevBtn" type="button" aria-label={prevLabel} className="slider-btn-side prev-btn" onClick={() => scrollBy(-1)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5" /></svg>
      </button>

      <div className="professores-slider" id="professoresSlider" ref={slider}>
        {items.map((p, ix) => (
          <a className="professor-card-link" href={p.href} key={`${ix}-${p.href}`}>
            <div className="professor-item">
              <div className="professor-imagem"><img alt={p.name} src={p.photo} loading="lazy" decoding="async" /></div>
              <div className="professor-info"><h3>{p.name}</h3><span>{cardLabel}</span></div>
            </div>
          </a>
        ))}
      </div>

      <button id="sliderNextBtn" type="button" aria-label={nextLabel} className="slider-btn-side next-btn" onClick={() => scrollBy(1)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 5.5 6.5 6.5-6.5 6.5" /></svg>
      </button>
    </div>
  );
}
