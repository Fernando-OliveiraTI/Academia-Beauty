'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { HeroTelemetry } from '../fx/HeroTelemetry';
import { useReducedMotion } from '../hooks';

const HERO = '.cb-hero';
const vars = (v: Record<string, string>) => v as unknown as CSSProperties;
const rnd = (min: number, span: number, digits = 2) => (min + Math.random() * span).toFixed(digits);

/** Camada que acompanha o mouse: desloca `layer` até `±maxX/±maxY` com suavização, só enquanto há movimento a fazer. */
function usePointerParallax(layer: React.RefObject<HTMLElement | null>, maxX: number, maxY: number, lerp: number) {
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = layer.current;
    const hero = el?.closest<HTMLElement>(HERO);
    if (!el || !hero || reduced) return;
    let tx = 0; let ty = 0; let cx = 0; let cy = 0; let raf = 0;
    const apply = () => { el.style.transform = `translate3d(${cx}px,${cy}px,0)`; };
    const step = () => {
      cx += (tx - cx) * lerp;
      cy += (ty - cy) * lerp;
      apply();
      if (Math.abs(tx - cx) > 0.01 || Math.abs(ty - cy) > 0.01) { raf = requestAnimationFrame(step); return; }
      cx = tx; cy = ty; apply(); // assenta exatamente no alvo (sem resíduo de subpixel)
      raf = 0;
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(step); };
    const move = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * maxX;
      ty = ((e.clientY - r.top) / r.height - 0.5) * maxY;
      wake();
    };
    const leave = () => { tx = 0; ty = 0; wake(); };
    apply();
    hero.addEventListener('pointermove', move);
    hero.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(raf);
      hero.removeEventListener('pointermove', move);
      hero.removeEventListener('pointerleave', leave);
    };
  }, [layer, maxX, maxY, lerp, reduced]);
}

type Spec = { count: number; style: (i: number) => CSSProperties; className: (i: number) => string };

/** Elementos decorativos com valores aleatórios por elemento: gerados só no cliente (sem divergência de hidratação). */
function useScattered(specs: Record<string, Spec>) {
  const [items, setItems] = useState<Record<string, { className: string; style: CSSProperties }[]>>({});
  useEffect(() => {
    setItems(Object.fromEntries(Object.entries(specs).map(([k, s]) => [
      k, Array.from({ length: s.count }, (_, i) => ({ className: s.className(i), style: s.style(i) })),
    ])));
  }, [specs]); // `specs` são constantes do módulo
  return items;
}

const Spans = ({ items }: { items?: { className: string; style: CSSProperties }[] }) => (
  <>{items?.map((p, i) => <span key={i} className={p.className} style={p.style} />)}</>
);

const BOLD = {
  flashes: { count: 16, className: () => 'flash', style: () => vars({ '--fx': `${rnd(36, 58)}%`, '--fy': `${rnd(28, 48)}%`, '--fdur': `${rnd(5, 6)}s`, '--fdelay': `${rnd(-8, 8)}s`, '--frot': `${rnd(-24, 48, 1)}deg` }) },
};
const RIBBONS = {
  particles: { count: 44, className: (i: number) => (i % 8 === 0 ? 'particle big' : 'particle'), style: () => vars({ '--x': `${rnd(5, 90)}%`, '--y': `${rnd(28, 62)}%`, '--dur': `${rnd(6, 7)}s`, '--delay': `${rnd(-12, 12)}s`, '--dx': `${rnd(-60, 120, 0)}px` }) },
  sparks: { count: 10, className: () => 'spark', style: () => vars({ '--sx': `${rnd(10, 75)}%`, '--sy': `${rnd(38, 45)}%`, '--sdur': `${rnd(7, 8)}s`, '--sdelay': `${rnd(-10, 10)}s`, '--rot': `${rnd(-25, 50, 1)}deg` }) },
};
const ENERGY = {
  particles: { count: 52, className: (i: number) => (i % 9 === 0 ? 'particle large' : 'particle'), style: () => vars({ '--x': `${rnd(2, 96)}%`, '--dur': `${rnd(8, 10)}s`, '--delay': `${rnd(-16, 16)}s`, '--drift': `${rnd(-45, 90, 0)}px` }) },
};

function BoldFx() {
  const ref = useRef<HTMLDivElement>(null);
  const { flashes } = useScattered(BOLD);
  usePointerParallax(ref, 28, 14, 0.045);
  return (
    <div className="cb-hero-boldfx" aria-hidden="true" ref={ref}>
      <div className="aurora" />
      <div className="aurora aurora-2" />
      <div className="orb" />
      <svg viewBox="0 0 1600 800" preserveAspectRatio="none">
        <defs>
          <linearGradient id="cbGoldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7D5A0F" stopOpacity="0" />
            <stop offset="22%" stopColor="#C49A33" stopOpacity=".55" />
            <stop offset="48%" stopColor="#FFF0BA" stopOpacity="1" />
            <stop offset="72%" stopColor="#E1C986" stopOpacity=".72" />
            <stop offset="100%" stopColor="#7D5A0F" stopOpacity="0" />
          </linearGradient>
          <filter id="cbGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path className="energy-path thick" d="M-100 610 C 220 280, 500 720, 850 410 S 1370 250, 1700 520" />
        <path className="energy-path" d="M-80 500 C 280 180, 520 620, 790 390 S 1220 230, 1680 420" />
        <path className="energy-path soft" d="M-120 700 C 260 390, 560 790, 920 500 S 1400 380, 1720 600" />
      </svg>
      <div className="pulse-line" />
      <div className="flare" />
      <div className="flash-field"><Spans items={flashes} /></div>
    </div>
  );
}

function Ribbons() {
  const ref = useRef<HTMLDivElement>(null);
  const { particles, sparks } = useScattered(RIBBONS);
  usePointerParallax(ref, 18, 10, 0.05);
  return (
    <div className="cb-hero-ribbons" aria-hidden="true" ref={ref}>
      <div className="gold-core" />
      <div className="ribbon r1" />
      <div className="ribbon r2" />
      <div className="ribbon r3" />
      <div className="sweep" />
      <div className="particle-field"><Spans items={particles} /></div>
      <div className="spark-field"><Spans items={sparks} /></div>
    </div>
  );
}

function Energy() {
  const { particles } = useScattered(ENERGY);
  return (
    <div className="cb-hero-energy" aria-hidden="true">
      <div className="ambient-glow" />
      <div className="filament f1" />
      <div className="filament f2" />
      <div className="filament f3" />
      <div className="energy-line" />
      <div className="particles"><Spans items={particles} /></div>
    </div>
  );
}

/** Camadas decorativas do hero, na mesma ordem do DOM original: boldfx, ribbons, energy, telemetria + video-style. */
export function HomeHeroFx() {
  return (
    <>
      <BoldFx />
      <Ribbons />
      <Energy />
      <HeroTelemetry heroSelector={HERO} particleX={[35, 62]} />
    </>
  );
}
