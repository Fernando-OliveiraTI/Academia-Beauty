'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PAYMENT_EVENT_LABEL, PAYMENT_METHOD_LABEL } from '@academia/contracts'
import { money } from '@/lib/format'
import { relativeTime } from '@/lib/relative-time'
import { apiGet } from '@/lib/api-client'
import { DEVICE_LABEL, HISTORY_LABEL, HISTORY_TONE, STATE_PILL, paymentPill, placeOf, type PaymentState } from '@/lib/checkout-labels'
import { CLOSE_ICON, EYE_ICON, svg } from './icons'
import { useDialogSync } from './use-dialog'
import { useNotice } from './use-notice'

export type SessionPayment = {
  state: PaymentState
  status: string | null
  event: string
  method: string | null
  amountCents: number | null
  currency: string | null
  instalments: number | null
  cardBrand: string | null
  buyerName: string | null
  buyerEmail: string | null
  occurredAt: string
  events: number
  paymentEventId: number
  deliveryId: number | null
}
type HistoryEvent = { id: number; status: string; event: string; occurredAt: string; amountCents: number | null; currency: string | null; method: string | null }
type HistoryTransaction = { transactionId: string | null; events: HistoryEvent[] }
export type SessionItem = {
  id: number
  ref: string
  courseSlug: string | null
  courseTitle: string | null
  createdAt: string
  lastSeenAt: string
  visits: number
  ip: string | null
  country: string | null
  region: string | null
  city: string | null
  browser: string | null
  browserVersion: string | null
  os: string | null
  osVersion: string | null
  device: string | null
  inApp: string | null
  language: string | null
  timezone: string | null
  viewport: { w: number; h: number } | null
  referrerHost: string | null
  landingPath: string | null
  utm: { source: string | null; medium: string | null; campaign: string | null; content: string | null; term: string | null }
  hasClickId: boolean
  payment: SessionPayment | null
}

const ICON = {
  eye: EYE_ICON,
  close: CLOSE_ICON,
  copy: svg(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>, 15),
  phone: svg(<><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>),
  tablet: svg(<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M11 17h2" /></>),
  desktop: svg(<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>),
}
const DEVICE_ICON: Record<string, ReactNode> = { mobile: ICON.phone, tablet: ICON.tablet, desktop: ICON.desktop }

const browserLabel = (s: SessionItem) => (s.inApp ? `${s.inApp} (app)` : [s.browser, s.browserVersion].filter(Boolean).join(' '))
const osLabel = (s: SessionItem) => [s.os, s.osVersion].filter(Boolean).join(' ')
const sourceLabel = (s: SessionItem) => s.utm.source ?? s.referrerHost ?? 'Direto'

/** Tabela das visitas ao checkout com o pagamento ligado pelo código; o olho abre todos os detalhes. */
export function CheckoutSessions({ items }: { items: SessionItem[] }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const { notice, copyText } = useNotice()
  const current = items.find((i) => i.id === openId) ?? null
  const [history, setHistory] = useState<{ id: number; state: 'loading' | 'error' | 'ready'; transactions: HistoryTransaction[] } | null>(null)

  // A lista traz só o último evento; o histórico completo (compra → reembolso) vem do detalhe, ao abrir.
  useEffect(() => {
    if (openId === null || !items.find((i) => i.id === openId)?.payment) { setHistory(null); return }
    let alive = true
    setHistory({ id: openId, state: 'loading', transactions: [] })
    void apiGet<{ history?: HistoryTransaction[] }>(`/admin/checkout-sessions/${openId}`).then((res) => {
      if (!alive) return
      setHistory(res.ok && res.data?.history ? { id: openId, state: 'ready', transactions: res.data.history } : { id: openId, state: 'error', transactions: [] })
    })
    return () => { alive = false }
  }, [openId, items])

  useDialogSync(dialog, openId !== null)

  return (
    <div>
      {notice ? <p className="wh-toast" role="status">{notice}</p> : null}
      <div className="admin-table-wrap">
        <table className="admin-table wh-table cs-table">
          <caption className="sr-only">Visitas ao checkout</caption>
          <thead>
            <tr><th scope="col">Quando</th><th scope="col">Visitante</th><th scope="col">Origem</th><th scope="col">Pagamento</th><th scope="col">Comprador</th><th scope="col">Código</th><th scope="col">Ações</th></tr>
          </thead>
          <tbody>
            {items.map((s) => {
              const place = placeOf(s.city, s.region, s.country)
              return (
                <tr key={s.id}>
                  <td title={new Date(s.createdAt).toLocaleString('pt-BR')}>
                    {new Date(s.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })}
                    <small>{relativeTime(s.createdAt)}{s.visits > 1 ? ` · ${s.visits} aberturas` : ''}</small>
                    {s.courseTitle || s.courseSlug ? <small className="cs-course">{s.courseTitle ?? s.courseSlug}</small> : null}
                  </td>
                  <td>
                    <div className="wh-event">
                      <span className="wh-event-icon" aria-hidden="true">{DEVICE_ICON[s.device ?? ''] ?? ICON.desktop}</span>
                      <div><strong>{browserLabel(s) || 'Navegador desconhecido'}</strong><small>{[osLabel(s), DEVICE_LABEL[s.device ?? ''] ?? null].filter(Boolean).join(' · ')}</small><small>{[s.ip, place].filter(Boolean).join(' · ') || 'Local não informado'}</small></div>
                    </div>
                  </td>
                  <td>{sourceLabel(s)}<small>{[s.utm.medium, s.utm.campaign].filter(Boolean).join(' · ') || (s.referrerHost && s.utm.source ? s.referrerHost : '')}</small></td>
                  <td>
                    {s.payment ? (
                      <>
                        <span className="pay-pill" data-tone={paymentPill(s.payment).tone}>{paymentPill(s.payment).text}</span>
                        {s.payment.state === 'refunded' ? null : <small>{PAYMENT_EVENT_LABEL[s.payment.event] ?? s.payment.event}</small>}
                        <small>{money(s.payment.amountCents, s.payment.currency)}{s.payment.method ? ` · ${PAYMENT_METHOD_LABEL[s.payment.method] ?? s.payment.method}` : ''}</small>
                      </>
                    ) : <><span className="pay-pill" data-tone="neutral">{STATE_PILL.none}</span><small>Nenhum pagamento recebido</small></>}
                  </td>
                  <td>{s.payment?.buyerName ?? <span aria-hidden="true">—</span>}{s.payment?.buyerEmail ? <small className="pay-mono">{s.payment.buyerEmail}</small> : null}</td>
                  <td><code className="wh-code">{s.ref}</code></td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="icon-button" onClick={() => setOpenId(s.id)} aria-label={`Ver detalhes da visita ${s.ref}`} title="Ver detalhes">{ICON.eye}</button>
                      <button type="button" className="icon-button" onClick={() => void copyText(s.ref, 'Código copiado.')} aria-label={`Copiar o código ${s.ref}`} title="Copiar código">{ICON.copy}</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <dialog ref={dialog} className="media-dialog wh-dialog" aria-labelledby="cs-title" onClose={() => setOpenId(null)} onCancel={() => setOpenId(null)}
        onClick={(e) => { if (e.target === dialog.current) setOpenId(null) }}>
        {current ? (
          <>
            <div className="wh-dialog-head">
              <h2 id="cs-title">Visita <code className="wh-code">{current.ref}</code></h2>
              <button type="button" className="icon-button" onClick={() => setOpenId(null)} aria-label="Fechar" title="Fechar">{ICON.close}</button>
            </div>
            <div className="wh-detail">
              <h3>Visita</h3>
              <dl className="wh-meta">
                <div><dt>Primeira abertura</dt><dd>{new Date(current.createdAt).toLocaleString('pt-BR')}</dd></div>
                <div><dt>Última atividade</dt><dd>{new Date(current.lastSeenAt).toLocaleString('pt-BR')} · {current.visits} {current.visits === 1 ? 'abertura' : 'aberturas'}</dd></div>
                <div><dt>Curso</dt><dd>{current.courseTitle ?? current.courseSlug ?? '—'}</dd></div>
                <div><dt>Página de entrada</dt><dd>{current.landingPath ?? '—'}</dd></div>
              </dl>
              <h3>Visitante</h3>
              <dl className="wh-meta">
                <div><dt>Navegador</dt><dd>{browserLabel(current) || '—'}</dd></div>
                <div><dt>Sistema e aparelho</dt><dd>{[osLabel(current), DEVICE_LABEL[current.device ?? ''] ?? null].filter(Boolean).join(' · ') || '—'}</dd></div>
                <div><dt>IP</dt><dd>{current.ip ?? 'não guardado'}</dd></div>
                <div><dt>Local aproximado</dt><dd>{placeOf(current.city, current.region, current.country) ?? 'não informado (a cidade vem da CDN)'}</dd></div>
                <div><dt>Idioma e fuso</dt><dd>{[current.language, current.timezone].filter(Boolean).join(' · ') || '—'}</dd></div>
                <div><dt>Tela</dt><dd>{current.viewport ? `${current.viewport.w} × ${current.viewport.h}` : '—'}</dd></div>
              </dl>
              <h3>Origem</h3>
              <dl className="wh-meta">
                <div><dt>Veio de</dt><dd>{current.referrerHost ?? 'acesso direto'}</dd></div>
                <div><dt>UTMs</dt><dd>{Object.entries(current.utm).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}{current.hasClickId ? ' · veio de anúncio (id de clique)' : ''}</dd></div>
              </dl>
              <h3>Pagamento</h3>
              {current.payment ? (
                <dl className="wh-meta">
                  <div><dt>Situação</dt><dd><span className="pay-pill" data-tone={paymentPill(current.payment).tone}>{paymentPill(current.payment).text}</span> {current.payment.state === 'refunded' ? '' : PAYMENT_EVENT_LABEL[current.payment.event] ?? current.payment.event}</dd></div>
                  <div><dt>Valor e forma</dt><dd>{money(current.payment.amountCents, current.payment.currency)}{current.payment.method ? ` · ${PAYMENT_METHOD_LABEL[current.payment.method] ?? current.payment.method}` : ''}{current.payment.instalments && current.payment.instalments > 1 ? ` em ${current.payment.instalments}x` : ''}{current.payment.cardBrand ? ` · ${current.payment.cardBrand}` : ''}</dd></div>
                  <div><dt>Comprador (mascarado)</dt><dd>{current.payment.buyerName ?? '—'}{current.payment.buyerEmail ? ` · ${current.payment.buyerEmail}` : ''}</dd></div>
                  <div><dt>Último evento</dt><dd>{new Date(current.payment.occurredAt).toLocaleString('pt-BR')} · {current.payment.events} {current.payment.events === 1 ? 'evento' : 'eventos'}</dd></div>
                </dl>
              ) : <p className="wizard-hint">Nenhum pagamento chegou com este código. A pessoa só visitou o checkout, ou a The Members não devolveu o código no webhook.</p>}
              {current.payment ? (
                <>
                  <h3>Histórico do pagamento</h3>
                  {history?.id === current.id && history.state === 'loading' ? <p className="wizard-hint" role="status">Carregando histórico…</p> : null}
                  {history?.id === current.id && history.state === 'error' ? <p className="form-error" role="alert">Não foi possível carregar o histórico.</p> : null}
                  {history?.id === current.id && history.state === 'ready' && history.transactions.length === 0 ? <p className="wizard-hint">Nenhuma etapa de pagamento registrada.</p> : null}
                  {history?.id === current.id ? history.transactions.map((tx, index) => (
                    <section className="cs-tx" key={tx.transactionId ?? `evt-${index}`} aria-label={`Transação ${index + 1}`}>
                      <p className="cs-tx-head">Transação {history.transactions.length > 1 ? index + 1 : ''}{tx.transactionId ? <code className="wh-code">…{tx.transactionId.slice(-6)}</code> : null}</p>
                      <ol className="cs-timeline">
                        {[...tx.events].reverse().map((e) => (
                          <li key={e.id} data-tone={HISTORY_TONE[e.status] ?? 'neutral'}>
                            <time dateTime={e.occurredAt}>{new Date(e.occurredAt).toLocaleTimeString('pt-BR')}<small>{new Date(e.occurredAt).toLocaleDateString('pt-BR')}</small></time>
                            <i className="cs-dot" aria-hidden="true" />
                            <div>
                              <span className="pay-pill" data-tone={HISTORY_TONE[e.status] ?? 'neutral'}>{HISTORY_LABEL[e.status] ?? e.status}</span>
                              {e.amountCents !== null ? <small>{money(e.amountCents, e.currency)}{e.method ? ` · ${PAYMENT_METHOD_LABEL[e.method] ?? e.method}` : ''}</small> : null}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </section>
                  )) : null}
                </>
              ) : null}
              {current.payment ? (
                <p className="wh-warn">
                  O e-mail e o nome completos estão no corpo bruto da chamada do webhook (só administrador).{' '}
                  <Link className="link-button" href={`/admin/webhooks/themembers?q=${current.payment.deliveryId ?? current.payment.paymentEventId}`}>Abrir no registro do webhook</Link>
                </p>
              ) : null}
              <p className="wh-warn">Contém dados pessoais (IP e dados de navegação). Apagado automaticamente depois do período de retenção.</p>
            </div>
          </>
        ) : null}
      </dialog>
    </div>
  )
}
