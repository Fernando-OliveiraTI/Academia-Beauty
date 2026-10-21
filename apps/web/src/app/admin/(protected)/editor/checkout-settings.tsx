'use client'

import { useState } from 'react'
import type { AdminCourse, CheckoutProvider } from '@academia/contracts'
import { PriceFields } from '@/components/price-fields'
import { initialPriceForm, priceDirty, priceResult } from '@/lib/price-form'
import { apiSend } from '@/lib/api-client'


type Commercial = NonNullable<AdminCourse['commercial']>

/**
 * Aba Avançado das seções de compra: preço, desconto, quem processa o checkout (Academia × The Members embutido)
 * e a URL. Preço e link nunca ficam no documento da página; salva na oferta (`commerce.manage`).
 */
export function CheckoutSettings({ courseId, commercial, canCommerce }: { courseId: number; commercial: Commercial | null; canCommerce: boolean }) {
  const [saved, setSaved] = useState(commercial)
  const [provider, setProvider] = useState<CheckoutProvider>(commercial?.provider ?? 'academia')
  const [priceForm, setPriceForm] = useState(initialPriceForm(commercial))
  const [url, setUrl] = useState(commercial?.checkoutUrl ?? '')
  const [active, setActive] = useState(commercial?.active ?? false)
  const [courseRef, setCourseRef] = useState(commercial?.externalCourseId ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  if (!saved) {
    if (!canCommerce) return <p className="wizard-hint">Somente quem gerencia o comércio vê e altera preço e checkout.</p>
    return <p className="wizard-hint">Cadastre a oferta em “Dados do cadastro” antes de configurar preço e checkout.</p>
  }
  const price = priceResult(priceForm, saved.maxInstallments)
  const dirty = priceDirty(priceForm, saved, saved.maxInstallments) || provider !== saved.provider || url.trim() !== saved.checkoutUrl || courseRef.trim() !== (saved.externalCourseId ?? '') || active !== saved.active

  const save = async () => {
    if (!price.ok) return setMsg({ kind: 'error', text: 'Corrija os campos de preço destacados.' })
    setBusy(true)
    setMsg(null)
    const res = await apiSend<{ commercial?: Commercial; message?: string }>('PUT', `/admin/courses/${courseId}/commercial`, {
      ...price.value,
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
      setPriceForm(initialPriceForm(res.data.commercial))
      setMsg({ kind: 'ok', text: 'Oferta salva. Republique o curso para valer na página pública.' })
    } else if (res.status === 409) {
      setMsg({ kind: 'error', text: 'Outra pessoa alterou a oferta. Recarregue a página para continuar.' })
    } else {
      setMsg({ kind: 'error', text: res.data?.message ?? 'Não foi possível salvar a oferta.' })
    }
  }

  return (
    <div className="sf-field" data-testid="checkout-settings">
      <PriceFields name="ed-price" form={priceForm} onChange={setPriceForm} disabled={!canCommerce || busy} maxInstallments={saved.maxInstallments} />
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
