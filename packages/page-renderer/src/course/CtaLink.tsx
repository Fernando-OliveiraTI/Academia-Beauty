'use client';

import type { AnchorHTMLAttributes } from 'react';
import { useCourse, useReducedMotion } from './state';

/**
 * Link de compra. No checkout de demonstração rola até o formulário e foca o primeiro campo.
 * No Modo A (redirect) é um link comum para a URL do provedor, validada pelo backend; sem URL
 * (oferta indisponível) vira um botão desativado.
 */
export function CtaLink({ href = '#checkout', onClick, className, id, children, tabIndex, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { step, checkout } = useCourse();
  const reduced = useReducedMotion();

  if (checkout.mode === 'redirect') {
    // Defesa em profundidade: o backend já valida, mas o renderer nunca navega para algo que não seja https.
    if (!checkout.url || !/^https:\/\//i.test(checkout.url)) {
      return <span className={`${className ?? ''} is-disabled`.trim()} id={id} role="button" aria-disabled="true" tabIndex={tabIndex === undefined ? undefined : -1} data-cta="" data-unavailable="">{children}</span>;
    }
    return <a className={className} id={id} href={checkout.url} rel="noopener noreferrer" tabIndex={tabIndex} data-cta="">{children}</a>;
  }

  return (
    <a
      {...rest}
      tabIndex={tabIndex}
      className={className}
      id={id}
      href={href}
      data-cta=""
      onClick={(ev) => {
        onClick?.(ev);
        const target = document.getElementById('checkout');
        if (!target) return;
        ev.preventDefault();
        target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
        const first = document.getElementById('name');
        if (first && step === 1) setTimeout(() => first.focus({ preventScroll: true }), reduced ? 0 : 650);
      }}
    >
      {children}
    </a>
  );
}
