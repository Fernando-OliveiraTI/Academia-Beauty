'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  PAYMENT_EVENT_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  paymentTone,
  type CoursePayments,
  type PaymentEventItem,
} from '@academia/contracts'
import Link from 'next/link'
import { apiGet } from '@/lib/api-client'
import { money } from '@/lib/format'
import { HISTORY_LABEL, HISTORY_TONE } from '@/lib/checkout-labels'

const icon = (d: React.ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)
const ICON_COPY = icon(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>)
const ICON_REFRESH = icon(<><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>)
const ICON_WALLET = icon(<><path d="M3 7a2 2 0 0 1 2-2h13v4" /><path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2Z" /><circle cx="16.5" cy="13.5" r="1" /></>)

/** Forma de pagamento em duas linhas curtas: "Cartão" e "3x · visa" (a tabela cabe na coluna do formulário). */
function method(item: PaymentEventItem): { main: string; extra: string } {
  const main = item.paymentMethod === 'credit_card' ? 'Cartão' : item.paymentMethod ? (PAYMENT_METHOD_LABEL[item.paymentMethod] ?? item.paymentMethod) : '—'
  const extra = item.paymentMethod === 'credit_card' ? [item.instalments ? `${item.instalments}x` : null, item.cardBrand].filter(Boolean).join(' · ') : ''
  return { main, extra }
}

/** Pagamentos recebidos pelo webhook da The Members, já tratados (aba Oferta do curso; só quem gerencia a oferta). */
export function CoursePaymentsPanel({ courseId, externalCourseId }: { courseId: number; externalCourseId: string }) {
  const [data, setData] = useState<CoursePayments | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')

  useEffect(() => { setOrigin(window.location.origin) }, [])

  const load = useCallback(async () => {
    setState('loading')
    const res = await apiGet<CoursePayments>(`/admin/courses/${courseId}/payments`)
    if (res.ok && res.data) { setData(res.data); setState('ready') } else setState('error')
  }, [courseId])
  useEffect(() => { void load() }, [load, externalCourseId])

  const url = data ? `${origin}/api${data.webhookPath}${data.webhookTokenConfigured ? '/<seu-token>' : ''}` : ''
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { setCopied(false) }
  }
  const linked = (data?.externalCourseId ?? externalCourseId).trim() !== ''
  // Uma linha do tempo por transação: pendente → aprovado → reembolso, sem chamadas do webhook, pedido nem acesso.
  const transactions = useMemo(() => {
    const groups = new Map<string, { key: string; transactionId: string | null; events: PaymentEventItem[] }>()
    const ordered = (data?.items ?? [])
      .filter((e) => e.kind === 'transaction' && e.status && e.status in HISTORY_LABEL)
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime() || a.id - b.id)
    for (const e of ordered) {
      const key = e.transactionId ?? `evt-${e.id}`
      const group = groups.get(key) ?? { key, transactionId: e.transactionId, events: [] }
      group.events.push(e)
      groups.set(key, group)
    }
    return [...groups.values()].sort((a, b) => new Date(b.events[b.events.length - 1]!.occurredAt).getTime() - new Date(a.events[a.events.length - 1]!.occurredAt).getTime())
  }, [data])

  return (
    <section className="pay-panel" aria-label="Pagamentos recebidos da The Members">
      <header className="pay-head">
        <span className="pay-icon" aria-hidden="true">{ICON_WALLET}</span>
        <div>
          <h3>Pagamentos da The Members</h3>
          <p>Cada pagamento aprovado, recusado ou reembolsado chega pelo webhook e aparece aqui.</p>
        </div>
        <button type="button" className="icon-button" onClick={() => void load()} disabled={state === 'loading'} aria-label="Atualizar pagamentos" title="Atualizar pagamentos">{ICON_REFRESH}</button>
      </header>

      {state === 'error' ? (
        <p role="alert" className="form-error">Não foi possível carregar os pagamentos. <button type="button" className="link-button" onClick={() => void load()}>Tentar de novo</button></p>
      ) : null}

      {data ? (
        <>
          <div className="pay-hook">
            <label className="ds-label" htmlFor={`pay-url-${courseId}`}>URL para cadastrar no webhook da The Members</label>
            <div className="pay-hook-row">
              <input id={`pay-url-${courseId}`} className="ds-input" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="icon-button" onClick={() => void copy()} aria-label="Copiar URL do webhook" title="Copiar URL do webhook">{ICON_COPY}</button>
            </div>
            <p className="pay-hook-note" role="status">
              {copied ? 'URL copiada.' : (
                <>
                  <span className="pay-pill" data-tone={data.webhookConfigured ? 'ok' : 'bad'}>{data.webhookConfigured ? 'Autenticação configurada' : 'Autenticação não configurada'}</span>
                  {data.webhookConfigured
                    ? (data.webhookTokenConfigured
                      ? ' No painel da The Members: Checkout → Ferramentas → Webhooks. Troque <seu-token> pelo valor de THEMEMBERS_WEBHOOK_TOKEN do servidor.'
                      : ' No painel da The Members: Checkout → Ferramentas → Webhooks, com o mesmo token do servidor.')
                    : ' Defina THEMEMBERS_WEBHOOK_TOKEN (ou THEMEMBERS_WEBHOOK_SECRET) no servidor: sem isso o receptor recusa todas as chamadas.'}
                </>
              )}
            </p>
          </div>

          {!linked ? (
            <p className="wizard-hint">Informe o <strong>ID do curso na The Members</strong> acima e salve a oferta: é por ele que os pagamentos são ligados a este curso.</p>
          ) : null}
          {data.unmatchedTransactions > 0 ? (
            <p className="wizard-hint" role="status">{data.unmatchedTransactions} {data.unmatchedTransactions === 1 ? 'pagamento chegou' : 'pagamentos chegaram'} de produtos sem curso vinculado. Se algum deveria estar aqui, confira o ID do produto.</p>
          ) : null}

          <dl className="pay-summary">
            <div><dt>Compras</dt><dd data-tone="ok">{data.summary.purchased}<small>{money(data.summary.purchasedCents)}</small></dd></div>
            <div><dt>Pendentes</dt><dd data-tone="warn">{data.summary.pending}</dd></div>
            <div><dt>Recusados</dt><dd data-tone="bad">{data.summary.failed}</dd></div>
            <div><dt>Reembolsos</dt><dd data-tone="bad">{data.summary.refunded}<small>{money(data.summary.refundedCents)}</small></dd></div>
            <div><dt>Transações</dt><dd>{data.summary.transactions}</dd></div>
          </dl>

          {transactions.length === 0 ? (
            <div className="pay-empty">
              <span className="pay-empty-icon" aria-hidden="true">{ICON_WALLET}</span>
              <div>
                <strong>Nenhum pagamento recebido ainda</strong>
                <p>Depois de cadastrar a URL acima, os eventos aparecem aqui assim que a The Members enviar.</p>
              </div>
            </div>
          ) : (
            <div className="pay-txs">
              {transactions.map((tx) => {
                const last = tx.events[tx.events.length - 1]!
                const pay = method(last)
                const buyer = [...tx.events].reverse().find((e) => e.buyerName || e.buyerEmail) ?? last
                return (
                  <article className="pay-tx" key={tx.key} aria-label={`Transação ${tx.transactionId ? `final ${tx.transactionId.slice(-6)}` : ''}`}>
                    <header className="pay-tx-head">
                      <div>
                        <span className="pay-pill" data-tone={HISTORY_TONE[last.status ?? ''] ?? 'neutral'}>{HISTORY_LABEL[last.status ?? ''] ?? last.status}</span>
                        <small>{money(last.amountCents, last.currency)} · {pay.main}{pay.extra ? ` · ${pay.extra}` : ''}</small>
                      </div>
                      <div className="pay-tx-buyer">{buyer.buyerName ?? '—'}{buyer.buyerEmail ? <small className="pay-mono">{buyer.buyerEmail}</small> : null}</div>
                    </header>
                    <ol className="cs-timeline">
                      {[...tx.events].reverse().map((e) => (
                        <li key={e.id} data-tone={HISTORY_TONE[e.status ?? ''] ?? 'neutral'}>
                          <time dateTime={e.occurredAt} title={new Date(e.occurredAt).toLocaleString('pt-BR')}>{new Date(e.occurredAt).toLocaleTimeString('pt-BR')}<small>{new Date(e.occurredAt).toLocaleDateString('pt-BR')}</small></time>
                          <i className="cs-dot" aria-hidden="true" />
                          <div><span className="pay-pill" data-tone={HISTORY_TONE[e.status ?? ''] ?? 'neutral'}>{HISTORY_LABEL[e.status ?? ''] ?? e.status}</span></div>
                        </li>
                      ))}
                    </ol>
                  </article>
                )
              })}
            </div>
          )}
          <p className="pay-foot"><Link className="link-button" href="/admin/webhooks/themembers">Ver as chamadas recebidas (técnico, só administrador)</Link></p>
          <p className="pay-foot">Mostra as transações dos 50 eventos mais recentes, com todas as etapas de cada uma (pendente, aprovado, reembolso). Nome e e-mail dos compradores aparecem mascarados e nenhum dado de cartão é guardado.</p>
        </>
      ) : state === 'loading' ? <p className="wizard-hint" role="status">Carregando pagamentos…</p> : null}
    </section>
  )
}
