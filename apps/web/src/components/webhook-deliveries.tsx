'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PAYMENT_EVENT_LABEL } from '@academia/contracts'
import { apiGet } from '@/lib/api-client'
import { relativeTime } from '@/lib/relative-time'
import { RESULT_LABEL } from '@/lib/webhook-labels'
import { CLOSE_ICON, EYE_ICON, svg } from './icons'
import { useDialogSync } from './use-dialog'
import { useNotice } from './use-notice'

export type DeliveryItem = {
  id: number
  receivedAt: string
  result: string
  httpStatus: number
  event: string | null
  signatureScheme: string | null
  hasSignatureHeader: boolean
  ip: string | null
  bodyBytes: number
  bodyTruncated: boolean
  paymentEventId: number | null
}
type Detail = DeliveryItem & { headers: Record<string, string>; rawBody: string; prettyBody: string }
type View = 'details' | 'raw'

const tone = (result: string) => (result === 'accepted' ? 'ok' : result === 'duplicate' ? 'neutral' : 'bad')
const bytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`)

const ICON = {
  check: svg(<path d="m5 12.5 4.5 4.5L19 7.500" />, 16),
  cross: svg(<path d="M6 6l12 12M18 6 6 18" />, 16),
  repeat: svg(<><path d="M17 2l3 3-3 3" /><path d="M4 11V9a4 4 0 0 1 4-4h12" /><path d="m7 22-3-3 3-3" /><path d="M20 13v2a4 4 0 0 1-4 4H4" /></>, 16),
  info: svg(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>, 16),
  file: svg(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>),
  eye: EYE_ICON,
  code: svg(<><path d="m8 7-5 5 5 5" /><path d="m16 7 5 5-5 5" /></>),
  dots: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>,
  close: CLOSE_ICON,
}
const RESULT_ICON: Record<string, ReactNode> = { accepted: ICON.check, duplicate: ICON.repeat, invalid_signature: ICON.cross, invalid_payload: ICON.cross, not_configured: ICON.info, empty_body: ICON.info }

/** Segunda linha da coluna "Assinatura": explica a variante que casou ou por que não casou. */
function signatureNote(d: DeliveryItem): string {
  if (d.signatureScheme === 'url-token') return 'Token na URL'
  if (d.signatureScheme) return 'HMAC SHA-256 do corpo'
  if (d.result === 'not_configured') return 'Nenhuma autenticação configurada'
  if (d.result === 'empty_body') return 'Sem corpo'
  return d.hasSignatureHeader ? 'Assinatura inválida' : 'Assinatura ausente ou token errado'
}

/**
 * Tabela das chamadas recebidas no webhook (padrão das listas do painel). O olho abre os detalhes, `</>` o corpo exatamente como
 * chegou e o menu copia ou baixa o corpo.
 */
export function WebhookDeliveries({ items }: { items: DeliveryItem[] }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [view, setView] = useState<View>('details')
  const [detail, setDetail] = useState<Detail | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [formatted, setFormatted] = useState(true)
  const [copied, setCopied] = useState(false)
  const [menu, setMenu] = useState<number | null>(null)
  const { notice, flash, copyText } = useNotice()
  const root = useRef<HTMLDivElement>(null)

  useDialogSync(dialog, openId !== null)

  useEffect(() => {
    if (menu === null) return
    const onPointer = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setMenu(null) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [menu])

  const fetchDetail = async (id: number): Promise<Detail | null> => {
    const res = await apiGet<Detail>(`/admin/webhook-deliveries/${id}`)
    return res.ok && res.data ? res.data : null
  }
  const open = async (id: number, next: View) => {
    setOpenId(id); setView(next); setDetail(null); setState('loading'); setFormatted(next === 'details'); setCopied(false); setMenu(null)
    const found = await fetchDetail(id)
    if (found) { setDetail(found); setState('idle') } else setState('error')
  }
  const copyBody = async (id: number) => {
    setMenu(null)
    const found = await fetchDetail(id)
    if (!found) return flash('Não foi possível ler a chamada.')
    await copyText(found.rawBody, 'Corpo copiado.')
  }
  const download = async (id: number) => {
    setMenu(null)
    const found = await fetchDetail(id)
    if (!found) return flash('Não foi possível ler a chamada.')
    const url = URL.createObjectURL(new Blob([found.rawBody], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = `webhook-themembers-${id}.json`; a.click()
    URL.revokeObjectURL(url)
    flash('Arquivo baixado.')
  }

  const body = detail ? (formatted ? detail.prettyBody || detail.rawBody : detail.rawBody) : ''

  return (
    <div ref={root}>
      {notice ? <p className="wh-toast" role="status">{notice}</p> : null}
      <div className="admin-table-wrap">
        <table className="admin-table wh-table">
          <caption className="sr-only">Chamadas recebidas no webhook</caption>
          <thead>
            <tr><th scope="col">#</th><th scope="col">Recebida em</th><th scope="col">Resultado</th><th scope="col">Evento</th><th scope="col">Assinatura</th><th scope="col" className="wh-num">Tamanho</th><th scope="col">Ações</th></tr>
          </thead>
          <tbody>
            {items.map((d) => {
              const when = new Date(d.receivedAt)
              return (
                <tr key={d.id}>
                  <th scope="row" className="wh-id">#{d.id}</th>
                  <td>{when.toLocaleString('pt-BR')}<small>{relativeTime(d.receivedAt)}</small></td>
                  <td>
                    <div className="wh-result">
                      <span className="wh-result-icon" data-tone={tone(d.result)} aria-hidden="true">{RESULT_ICON[d.result] ?? ICON.info}</span>
                      <div><span className="pay-pill" data-tone={tone(d.result)}>{RESULT_LABEL[d.result] ?? d.result}</span><small>HTTP {d.httpStatus}</small></div>
                    </div>
                  </td>
                  <td>
                    {d.event ? (
                      <div className="wh-event">
                        <span className="wh-event-icon" aria-hidden="true">{ICON.file}</span>
                        <div><strong>{d.event}</strong><small>{PAYMENT_EVENT_LABEL[d.event] ?? ''}</small></div>
                      </div>
                    ) : <div className="wh-event wh-event--none"><span aria-hidden="true">—</span><small>Evento não processado</small></div>}
                  </td>
                  <td>{d.signatureScheme ? <code className="wh-code">{d.signatureScheme}</code> : <span aria-hidden="true">—</span>}<small>{signatureNote(d)}</small></td>
                  <td className="wh-num">{bytes(d.bodyBytes)}{d.bodyTruncated ? <small>cortado</small> : null}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="icon-button" onClick={() => void open(d.id, 'details')} aria-label={`Ver detalhes da chamada #${d.id}`} title="Ver detalhes">{ICON.eye}</button>
                      <button type="button" className="icon-button" onClick={() => void open(d.id, 'raw')} aria-label={`Ver o corpo da chamada #${d.id} como chegou`} title="Ver o corpo como chegou">{ICON.code}</button>
                      <div className="row-menu">
                        <button type="button" className="icon-button" aria-label={`Mais ações para a chamada #${d.id}`} aria-haspopup="menu" aria-expanded={menu === d.id} onClick={() => setMenu(menu === d.id ? null : d.id)}>{ICON.dots}</button>
                        {menu === d.id ? (
                          <div className="row-menu-list" role="menu">
                            <button type="button" role="menuitem" onClick={() => void copyBody(d.id)}>Copiar corpo</button>
                            <button type="button" role="menuitem" onClick={() => void download(d.id)}>Baixar como JSON</button>
                            <button type="button" role="menuitem" onClick={() => { setMenu(null); void copyText(String(d.id), 'Número copiado.') }}>Copiar número da chamada</button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <dialog ref={dialog} className="media-dialog wh-dialog" aria-labelledby="wh-title" onClose={() => setOpenId(null)} onCancel={() => setOpenId(null)}
        onClick={(e) => { if (e.target === dialog.current) setOpenId(null) }}>
        {openId !== null ? (
          <>
            <div className="wh-dialog-head">
              <h2 id="wh-title">Chamada #{openId}</h2>
              <button type="button" className="icon-button" onClick={() => setOpenId(null)} aria-label="Fechar" title="Fechar">{ICON.close}</button>
            </div>
            <div className="wh-tabs" role="tablist" aria-label="Conteúdo da chamada">
              <button type="button" role="tab" aria-selected={view === 'details'} onClick={() => { setView('details'); setFormatted(true) }}>Detalhes</button>
              <button type="button" role="tab" aria-selected={view === 'raw'} onClick={() => { setView('raw'); setFormatted(false) }}>Corpo como chegou</button>
            </div>
            {state === 'loading' ? <p className="wizard-hint" role="status">Carregando…</p> : null}
            {state === 'error' ? <p role="alert" className="form-error">Não foi possível abrir esta chamada. <button type="button" className="link-button" onClick={() => void open(openId, view)}>Tentar de novo</button></p> : null}
            {detail ? (
              <div className="wh-detail">
                {view === 'details' ? (
                  <>
                    <dl className="wh-meta">
                      <div><dt>Resultado</dt><dd><span className="pay-pill" data-tone={tone(detail.result)}>{RESULT_LABEL[detail.result] ?? detail.result}</span> HTTP {detail.httpStatus}</dd></div>
                      <div><dt>Evento</dt><dd>{detail.event ?? '—'}</dd></div>
                      <div><dt>Autenticação que casou</dt><dd>{detail.signatureScheme ?? 'nenhuma'}</dd></div>
                      <div><dt>Recebida em</dt><dd>{new Date(detail.receivedAt).toLocaleString('pt-BR')}</dd></div>
                    </dl>
                    <h3>Cabeçalhos</h3>
                    <pre className="wh-pre wh-pre--short">{Object.entries(detail.headers).map(([k, v]) => `${k}: ${v}`).join('\n') || '—'}</pre>
                  </>
                ) : null}
                <div className="wh-body-head">
                  <h3>Corpo{detail.bodyTruncated ? ' (cortado no limite)' : ''}</h3>
                  <span className="wh-actions">
                    {view === 'details' ? <button type="button" className="admin-button secondary" onClick={() => setFormatted((v) => !v)} aria-pressed={!formatted}>{formatted ? 'Ver como chegou' : 'Ver formatado'}</button> : null}
                    <button type="button" className="admin-button secondary" onClick={() => void copyText(body, 'Corpo copiado.').then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })}>{copied ? 'Copiado' : 'Copiar'}</button>
                  </span>
                </div>
                <pre className="wh-pre" tabIndex={0} aria-label="Corpo da chamada">{body || '(vazio)'}</pre>
                <p className="wh-warn">Contém dados pessoais do comprador, exatamente como a The Members enviou. Apagado automaticamente depois do período de retenção.</p>
              </div>
            ) : null}
          </>
        ) : null}
      </dialog>
    </div>
  )
}
