'use client';

import { useEffect, useState } from 'react';
import { CtaLink } from './CtaLink';
import { useCourse } from './state';

/** Barra de compra do mobile: aparece depois do hero e some no checkout e na confirmação. */
export function StickyCta({ price, installments, ctaLabel }: { price: string; installments: string; ctaLabel: string }) {
  const { step } = useCourse();
  const [heroVisible, setHeroVisible] = useState(true);
  const [checkoutVisible, setCheckoutVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById('hero-cta');
    const checkout = document.getElementById('checkout');
    const observers: IntersectionObserver[] = [];
    if (hero) {
      const io = new IntersectionObserver(([e]) => setHeroVisible(!!e?.isIntersecting));
      io.observe(hero);
      observers.push(io);
    }
    if (checkout) {
      const io = new IntersectionObserver(([e]) => setCheckoutVisible(!!e?.isIntersecting), { rootMargin: '0px 0px -20% 0px' });
      io.observe(checkout);
      observers.push(io);
    }
    return () => observers.forEach((io) => io.disconnect());
  }, []);

  const show = !heroVisible && !checkoutVisible && step !== 3;
  return (
    <div className={show ? 'sticky-cta is-visible' : 'sticky-cta'} id="sticky-cta" aria-hidden={!show} inert={!show}>
      <div className="sticky-price">
        <strong className="num">{price}</strong>
        <span className="num">{installments}</span>
      </div>
      <CtaLink className="btn btn--primary" tabIndex={show ? 0 : -1}>{ctaLabel}</CtaLink>
    </div>
  );
}
