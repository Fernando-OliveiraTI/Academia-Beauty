'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createBaseLayer, createBoostLayer, createLeftLayer, type Layer } from './telemetry';
import { useReducedMotion } from '../hooks';

const PARTICLES = 72;
const MAX_DPR = 2;

type Particle = { big: boolean; style: CSSProperties };

/** 72 partículas CSS com valores aleatórios: geradas só no cliente para não divergir da hidratação. */
function makeParticles(xMin: number, xSpan: number): Particle[] {
  return Array.from({ length: PARTICLES }, (_, i) => ({
    big: i % 10 === 0,
    style: {
      '--x': `${(xMin + Math.random() * xSpan).toFixed(2)}%`,
      '--dur': `${(7 + Math.random() * 8).toFixed(2)}s`,
      '--delay': `${(-Math.random() * 14).toFixed(2)}s`,
      '--dx': `${(-42 + Math.random() * 84).toFixed(0)}px`,
    } as CSSProperties,
  }));
}

/** Camada de telemetria (3 canvas + faixas CSS) e campo de partículas do hero. */
export function HeroTelemetry({
  heroSelector,
  particleX = [5, 90],
}: {
  /** Seletor do hero que define o tamanho dos canvas e recebe a classe `is-offscreen`. */
  heroSelector: string;
  /** Faixa horizontal das partículas: [início %, largura %]. */
  particleX?: [number, number];
}) {
  const left = useRef<HTMLCanvasElement>(null);
  const base = useRef<HTMLCanvasElement>(null);
  const boost = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const [particles, setParticles] = useState<Particle[]>([]);

  const [xMin, xSpan] = particleX;
  useEffect(() => setParticles(makeParticles(xMin, xSpan)), [xMin, xSpan]);

  useEffect(() => {
    const hero = document.querySelector<HTMLElement>(heroSelector);
    const canvases = [
      { el: base.current, make: createBaseLayer, px: true },
      { el: left.current, make: createLeftLayer, px: false },
      { el: boost.current, make: createBoostLayer, px: true },
    ];
    if (!hero) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const layers: { layer: Layer; ctx: CanvasRenderingContext2D; el: HTMLCanvasElement; px: boolean }[] = [];
    for (const c of canvases) {
      const ctx = c.el?.getContext('2d');
      if (c.el && ctx) layers.push({ layer: c.make(ctx), ctx, el: c.el, px: c.px });
    }

    const resize = () => {
      const r = hero.getBoundingClientRect();
      const W = Math.max(1, Math.floor(r.width));
      const H = Math.max(1, Math.floor(r.height));
      for (const l of layers) {
        l.el.width = Math.floor(W * dpr);
        l.el.height = Math.floor(H * dpr);
        if (l.px) { l.el.style.width = `${W}px`; l.el.style.height = `${H}px`; }
        l.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        l.layer.resize(W, H);
      }
    };
    const frame = (time: number) => layers.forEach((l) => l.layer.draw(time));

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) frame(0); // redimensionar limpa o canvas: redesenha o quadro estático
    });
    ro.observe(hero);

    if (reduced) {
      frame(0);
      return () => ro.disconnect();
    }

    // Anima só enquanto o hero está visível e a aba ativa (o original rodava sempre).
    let raf = 0;
    let inView = true;
    const loop = (t: number) => { frame(t); raf = requestAnimationFrame(loop); };
    const sync = () => {
      cancelAnimationFrame(raf);
      hero.classList.toggle('is-offscreen', !inView);
      if (inView && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([e]) => { inView = !!e?.isIntersecting; sync(); });
    io.observe(hero);
    document.addEventListener('visibilitychange', sync);
    sync();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', sync);
      hero.classList.remove('is-offscreen');
    };
  }, [heroSelector, reduced]);

  return (
    <>
      <div className="cb-telemetry-layer" aria-hidden="true">
        <canvas id="cbTelemetryCanvasLeft" ref={left} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.78, pointerEvents: 'none' }} />
        <canvas id="cbTelemetryCanvas" ref={base} />
        <canvas id="cbTelemetryCanvasBoost" ref={boost} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 1, mixBlendMode: 'screen' }} />
        <div className="cb-telemetry-horizon" />
        <div className="cb-telemetry-glow" />
        <div className="cb-telemetry-scan" />
      </div>
      <div className="cb-video-style-fx" aria-hidden="true">
        <div className="cb-digital-horizon" />
        <div className="cb-energy-bed" />
        <div className="cb-grid-floor" />
        <div className="cb-light-thread t1" />
        <div className="cb-light-thread t2" />
        <div className="cb-light-thread t3" />
        <div className="cb-particle-field">
          {particles.map((p, i) => <span key={i} className={p.big ? 'cb-particle big' : 'cb-particle'} style={p.style} />)}
        </div>
        <div className="cb-pulse-dot p1" />
        <div className="cb-pulse-dot p2" />
        <div className="cb-pulse-dot p3" />
      </div>
    </>
  );
}
