'use client'

import { useState } from 'react'
import { computeOffer, PRICE_MAX_CENTS, PRICE_MIN_CENTS, type AdminCourse, type CheckoutProvider } from '@academia/contracts'
import { apiSend } from '@/lib/api-client'
import { brl } from '@/lib/format'
import { centsToInput, maskBRL, maskPercent, parseBRLToCents } from '../cursos/form-model'


type Commercial = NonNullable<AdminCourse['commercial']>

/**
 * Aba Avançado das seções de compra: preço, desconto, quem processa o checkout (Academia × The Members embutido)
 * e a URL. Preço e link nunca ficam no documento da página; salva na oferta (`commerce.manage`).
 */
export function CheckoutSettings({ courseId, commercial, canCommerce }: { courseId: number; commercial: Commercial | null; canCommerce: boolean }) {
  const [saved, setSaved] = useState(commercial)
  const [provider, setProvider] = useState<CheckoutProvider>(commercial?.provider ?? 'academia')
  const [price, setPrice] = useState(commercial ? centsToInput(commercial.listCents) : '')
  const [discount, setDiscount] = useState(String(commercial?.discountPct ?? 0))
  const [url, setUrl] = useState(commercial?.checkoutUrl ?? '')
  const [active, setActive] = useState(commercial?.active ?? false)
  const [courseRef, setCourseRef] = useState(commercial?.externalCourseId ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  if (!saved) {
    if (!canCommerce) return <p className="wizard-hint">Somente quem gerencia o comércio vê e altera preço e checkout.</p>
    return <p className="wizard-hint">Cadastre a oferta em “Dados do cadastro” antes de configurar preço e checkout.</p>
  }
  const cents = parseBRLToCents(price)
  const priceValid = cents !== null && cents >= PRICE_MIN_CENTS && cents <= PRICE_MAX_CENTS
  const discountPct = Math.min(90, Math.max(0, Number(discount) || 0))
  const preview = priceValid ? computeOffer({ listCents: cents, discountPct, maxInstallments: saved.maxInstallments }) : null
  const dirty = (priceValid && cents !== saved.listCents) || discountPct !== saved.discountPct || provider !== saved.provider || url.trim() !== saved.checkoutUrl || courseRef.trim() !== (saved.externalCourseId ?? '') || active !== saved.active

  const save = async () => {
    if (!priceValid) return setMsg({ kind: 'error', text: 'Informe um preço entre R$ 1,00 e R$ 100.000,00.' })
    setBusy(true)
    setMsg(null)
    const res = await apiSend<{ commercial?: Commercial; message?: string }>('PUT', `/admin/courses/${courseId}/commercial`, {
      listCents: cents,
      discountPct,
      maxInstallments: saved.maxInstallments,
      checkoutUrl: url.trim(),
      provider,
      externalCourseId: courseRef.trim(),
      environment: saved.environment,
      active,
      revision: saved.revision,
    })
    setBusy(false)
    if (res.ok && res.data?.commercial) {
      setSaved(res.data.commercial)
      setPrice(centsToInput(res.data.commercial.listCents))
      setDiscount(String(res.data.commercial.discountPct))
      setMsg({ kind: 'ok', text: 'Oferta salva. Republique o curso para valer na página pública.' })
    } else if (res.status === 409) {
      setMsg({ kind: 'error', text: 'Outra pessoa alterou a oferta. Recarregue a página para continuar.' })
    } else {
      setMsg({ kind: 'error', text: res.data?.message ?? 'Não foi possível salvar a oferta.' })
    }
  }

  return (
    <div className="sf-field" data-testid="checkout-settings">
      <label className="ds-label" htmlFor="ed-offer-price">Preço (R$)</label>
      <input id="ed-offer-price" className="ds-input" inputMode="numeric" value={price} placeholder="0,00" disabled={!canCommerce || busy} aria-invalid={!priceValid} onChange={(e) => setPrice(maskBRL(e.target.value))} />
      <label className="ds-label" htmlFor="ed-offer-discount">Desconto (%)</label>
      <input id="ed-offer-discount" className="ds-input" inputMode="numeric" value={discount} placeholder="0" disabled={!canCommerce || busy} onChange={(e) => setDiscount(maskPercent(e.target.value))} />
      {preview ? (
        <p className="wizard-hint" role="status">
          Prévia: de {brl(preview.listCents)} por <strong>{brl(preview.totalCents)}</strong>
          {preview.discountPct > 0 ? ` (${preview.discountPct}% de desconto)` : ''}. O servidor recalcula este valor.
        </p>
      ) : <p className="wizard-hint">Informe um preço entre R$ 1,00 e R$ 100.000,00.</p>}
      <span className="ds-label">Checkout</span>
      <select className="ds-input" aria-label="Checkout" value={provider} disabled={!canCommerce || busy} onChange={(e) => setProvider(e.target.value as CheckoutProvider)}>
        <option value="academia">Academia (formulário da página + redirecionamento)</option>
        <option value="themembers">The Members (embutido na página)</option>
      </select>
      <label className="ds-label" htmlFor="ed-checkout-url">{provider === 'themembers' ? 'URL do checkout da The Members (https)' : 'Link do checkout (https)'}</label>
      <input id="ed-checkout-url" className="ds-input" type="url" value={url} placeholder="https://…" disabled={!canCommerce || busy} onChange={(e) => setUrl(e.target.value)} />
      <label className="ds-label" htmlFor="ed-checkout-course-id">ID do curso na The Members</label>
      <input id="ed-checkout-course-id" className="ds-input" type="text" value={courseRef} placeholder="Ex.: 7508903696019193856" maxLength={128} disabled={!canCommerce || busy} onChange={(e) => setCourseRef(e.target.value)} />
      <label className="sf-check">
        <input type="checkbox" checked={active} disabled={!canCommerce || busy} onChange={(e) => setActive(e.target.checked)} /> Oferta ativa (sem isso a página mostra “compra indisponível”)
      </label>
      <p className="wizard-hint">
        {provider === 'themembers' ? 'O formulário da Academia fica desabilitado e o checkout da The Members aparece dentro da página.' : 'O comprador preenche o formulário da página e termina no link acima.'}{' '}
        Só aceita domínios autorizados no ambiente; a troca vale na página pública depois de republicar.
      </p>
      {!canCommerce ? <p className="wizard-hint">Somente quem gerencia o comércio altera preço e checkout.</p> : null}
      {msg ? <p role={msg.kind === 'error' ? 'alert' : 'status'} className={msg.kind === 'error' ? 'form-error' : 'wizard-hint'}>{msg.text}</p> : null}
      {canCommerce ? <button type="button" className="admin-button" disabled={busy || !dirty} onClick={() => void save()}>{busy ? 'Salvando…' : 'Salvar oferta'}</button> : null}
    </div>
  )
}
