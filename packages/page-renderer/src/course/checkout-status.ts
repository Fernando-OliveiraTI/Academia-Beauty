'use client';

import { useEffect, useRef, useState } from 'react';

/** Situação do pagamento da visita, como a API pública responde. */
export type VisitStatus = { status: 'none' | 'processing' | 'waiting' | 'approved' | 'failed' | 'refunded'; method: string | null };
const NONE: VisitStatus = { status: 'none', method: null };

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const STORAGE_KEY = 'ab:checkout-ref';
const REF_PATTERN = /^ab_[a-z0-9]{20}$/;

/** Código aleatório da visita: `ab_` + 20 caracteres. Não identifica a pessoa; só liga o pagamento a este navegador. */
export function newVisitRef(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(20);
  return `ab_${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')}`;
}

/** Lê/gera o código da aba (sessionStorage: a mesma aba mantém o código depois de recarregar, como no Pix pendente). */
export function loadVisitRef(): string {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved && REF_PATTERN.test(saved)) return saved;
    const fresh = newVisitRef();
    sessionStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return newVisitRef(); // storage bloqueado: vale só enquanto a página estiver aberta
  }
}

/** Põe o código na URL do checkout como UTM (a The Members devolve as UTMs no webhook). Parâmetros do próprio link são mantidos. */
export function withVisitRef(url: string, ref: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', 'academia');
    if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', 'site');
    u.searchParams.set('utm_content', ref);
    return u.toString();
  } catch {
    return url;
  }
}

/** Intervalo entre consultas: rápido no começo (quem acabou de pagar), mais espaçado depois. */
export function pollDelay(elapsedMs: number): number {
  if (elapsedMs < 2 * 60_000) return 4_000;
  if (elapsedMs < 15 * 60_000) return 8_000;
  return 20_000;
}
const GIVE_UP_MS = 60 * 60_000;

/**
 * Acompanha o pagamento da visita. Só consulta depois que o checkout apareceu na tela (`active`), enquanto a aba está
 * visível, e para ao aprovar ou depois de uma hora. Erros de rede são ignorados (tenta de novo no próximo ciclo).
 */
export function useVisitStatus(statusUrl: string | undefined, ref: string | null, active: boolean): VisitStatus {
  const [status, setStatus] = useState<VisitStatus>(NONE);
  const done = useRef(false);

  useEffect(() => {
    if (!statusUrl || !ref || !active) return;
    done.current = false;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const tick = async () => {
      if (cancelled || done.current) return;
      const elapsed = Date.now() - started;
      if (elapsed > GIVE_UP_MS) return;
      if (!document.hidden) {
        try {
          const res = await fetch(`${statusUrl}?ref=${encodeURIComponent(ref)}`, { cache: 'no-store', credentials: 'omit' });
          if (res.ok) {
            const body = (await res.json()) as VisitStatus;
            if (!cancelled) {
              setStatus({ status: body.status, method: body.method ?? null });
              if (body.status === 'approved') { done.current = true; return; }
            }
          }
        } catch { /* sem rede agora: tenta de novo */ }
      }
      if (!cancelled) timer = setTimeout(() => void tick(), pollDelay(Date.now() - started));
    };

    const onVisible = () => { if (!document.hidden && !done.current) { if (timer) clearTimeout(timer); void tick(); } };
    document.addEventListener('visibilitychange', onVisible);
    void tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [statusUrl, ref, active]);

  return status;
}
