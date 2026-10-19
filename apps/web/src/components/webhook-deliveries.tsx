'use client'

import { useEffect, useRef, useState } from 'react'
import { apiGet } from '@/lib/api-client'
import { relativeTime } from '@/lib/relative-time'
import { RESULT_LABEL } from '@/lib/webhook-labels'

export type DeliveryItem = {
  id: number
  receivedAt: string
  result: string
  httpStatus: number
  event: string | null
  signatureScheme: string | null
  ip: string | null
  bodyBytes: number
  bodyTruncated: boolean
  paymentEventId: number | null
}
type Detail = DeliveryItem & { headers: Record<string, string>; rawBody: string; prettyBody: string }

const tone = (result: string) => (result === 'accepted' ? 'ok' : result === 'duplicate' ? 'neutral' : 'bad')
const bytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`)

const CLOSE = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
)
const EYE = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.500-7 10-7 10 7 10 7-3.500 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
)

/** Tabela das chamadas recebidas no webhook, com a janela que mostra o corpo bruto exatamente como chegou. */
export function WebhookDeliveries({ items }: { items: DeliveryItem[] }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [raw, setRaw] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (openId !== null && !el.open) { if (typeof el.showModal === 'function') el.showModal(); else el.setAttribute('open', '') }
    if (openId === null && el.open) el.close()
  }, [openId])

  const open = async (id: number) => {
    setOpenId(id); setDetail(null); setState('loading'); setRaw(false); setCopied(false)
    const res = await apiGet<Detail>(`/admin/webhook-deliveries/${id}`)
    if (res.ok && res.data) { setDetail(res.data); setState('idle') } else setState('error')
  }
  const body = detail ? (raw ? detail.rawBody : detail.prettyBody || detail.rawBody) : ''
  const copy = async () => {
    try { await navigator.clipboard.writeText(body); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { setCopied(false) }
  }

  return (
    <>
      <div className="wh-table-wrap">
        <table className="admin-table wh-table">
          <thead>
            <tr><th scope="col">Recebida</th><th scope="col">Resultado</th><th scope="col">Evento</th><th scope="col">Assinatura</th><th scope="col" className="wh-num">Tamanho</th><th scope="col"><span className="sr-only">Ações</span></th></tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id}>
                <td title={new Date(d.receivedAt).toLocaleString('pt-BR')}>{relativeTime(d.receivedAt)}<small>#{d.id}{d.ip ? ` · ${d.ip}` : ''}</small></td>
                <td><span className="pay-pill" data-tone={tone(d.result)}>{RESULT_LABEL[d.result] ?? d.result}</span><small>HTTP {d.httpStatus}</small></td>
                <td>{d.event ?? '—'}</td>
                <td>{d.signatureScheme ? <code className="wh-code">{d.signatureScheme}</code> : '—'}</td>
                <td className="wh-num">{bytes(d.bodyBytes)}{d.bodyTruncated ? <small>cortado</small> : null}</td>
                <td><button type="button" className="icon-button" onClick={() => void open(d.id)} aria-label={`Ver a chamada #${d.id}`} title="Ver o corpo recebido">{EYE}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dialog ref={dialog} className="media-dialog wh-dialog" aria-labelledby="wh-title" onClose={() => setOpenId(null)} onCancel={() => setOpenId(null)}
        onClick={(e) => { if (e.target === dialog.current) setOpenId(null) }}>
        {openId !== null ? (
          <>
            <div className="wh-dialog-head">
              <h2 id="wh-title">Chamada #{openId}</h2>
              <button type="button" className="icon-button" onClick={() => setOpenId(null)} aria-label="Fechar" title="Fechar">{CLOSE}</button>
            </div>
            {state === 'loading' ? <p className="wizard-hint" role="status">Carregando…</p> : null}
            {state === 'error' ? <p role="alert" className="form-error">Não foi possível abrir esta chamada. <button type="button" className="link-button" onClick={() => void open(openId)}>Tentar de novo</button></p> : null}
            {detail ? (
              <div className="wh-detail">
                <dl className="wh-meta">
                  <div><dt>Resultado</dt><dd><span className="pay-pill" data-tone={tone(detail.result)}>{RESULT_LABEL[detail.result] ?? detail.result}</span> HTTP {detail.httpStatus}</dd></div>
                  <div><dt>Evento</dt><dd>{detail.event ?? '—'}</dd></div>
                  <div><dt>Assinatura que casou</dt><dd>{detail.signatureScheme ?? 'nenhuma'}</dd></div>
                  <div><dt>Recebida em</dt><dd>{new Date(detail.receivedAt).toLocaleString('pt-BR')}</dd></div>
                </dl>
                <h3>Cabeçalhos</h3>
                <pre className="wh-pre wh-pre--short">{Object.entries(detail.headers).map(([k, v]) => `${k}: ${v}`).join('\n') || '—'}</pre>
                <div className="wh-body-head">
                  <h3>Corpo{detail.bodyTruncated ? ' (cortado no limite)' : ''}</h3>
                  <span className="wh-actions">
                    <button type="button" className="admin-button secondary" onClick={() => setRaw((v) => !v)} aria-pressed={raw}>{raw ? 'Ver formatado' : 'Ver como chegou'}</button>
                    <button type="button" className="admin-button secondary" onClick={() => void copy()}>{copied ? 'Copiado' : 'Copiar'}</button>
                  </span>
                </div>
                <pre className="wh-pre" tabIndex={0} aria-label="Corpo da chamada">{body || '(vazio)'}</pre>
                <p className="wh-warn">Contém dados pessoais do comprador, exatamente como a The Members enviou. Apagado automaticamente depois do período de retenção.</p>
              </div>
            ) : null}
          </>
        ) : null}
      </dialog>
    </>
  )
}
