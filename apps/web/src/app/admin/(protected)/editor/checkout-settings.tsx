'use client'

import { useState } from 'react'
import type { AdminCourse, CheckoutProvider } from '@academia/contracts'
import { PriceFields } from '@/components/price-fields'
import { initialPriceForm, priceDirty, priceResult } from '@/lib/price-form'
import { apiSend } from '@/lib/api-client'

type Commercial = NonNullable<AdminCourse['commercial']>
type CheckoutEnvironment = Commercial['environment']

/** Oferta de teste (sandbox) só existe fora de produção; em produção o servidor também recusa publicar com ela. */
const SANDBOX_ALLOWED = process.env.NODE_ENV !== 'production'

/**
 * Oferta do curso (preço, parcelas, checkout e ativação), usada no painel Configurações e na aba Avançado das seções
 * de compra. Cria a oferta quando ainda não existe. Preço e link nunca ficam no documento da página; salva na oferta
 * (`commerce.manage`), e a mudança só vale na página pública depois de publicar o curso.
 */
export function CheckoutSettings({ courseId, commercial, canCommerce, onSaved }: {
  courseId: number
  commercial: Commercial | null
  canCommerce: boolean
  onSaved?: (commercial: Commercial) => void
}) {
  const [saved, setSaved] = useState(commercial)
  const [provider, setProvider] = useState<CheckoutProvider>(commercial?.provider ?? 'academia')
  const [priceForm, setPriceForm] = useState(initialPriceForm(commercial))
  const [installments, setInstallments] = useState(commercial?.maxInstallments ?? 1)
  const [environment, setEnvironment] = useState<CheckoutEnvironment>(SANDBOX_ALLOWED ? (commercial?.environment ?? 'production') : 'production')
  const [url, setUrl] = useState(commercial?.checkoutUrl ?? '')
  const [active, setActive] = useState(commercial?.active ?? false)
  const [courseRef, setCourseRef] = useState(commercial?.externalCourseId ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  if (!saved && !canCommerce) return <p className="wizard-hint">Somente quem gerencia o comércio vê e altera preço e checkout.</p>

  const price = priceResult(priceForm, installments)
  const dirty = !saved || priceDirty(priceForm, saved, installments) || installments !== saved.maxInstallments || environment !== saved.environment
    || provider !== saved.provider || url.trim() !== saved.checkoutUrl || courseRef.trim() !== (saved.externalCourseId ?? '') || active !== saved.active

  const save = async () => {
    if (!price.ok) return setMsg({ kind: 'error', text: 'Corrija os campos de preço destacados.' })
    setBusy(true)
    setMsg(null)
    const res = await apiSend<{ commercial?: Commercial; message?: string; errors?: { message: string }[] }>('PUT', `/admin/courses/${courseId}/commercial`, {
      ...price.value,
      maxInstallments: installments,
      checkoutUrl: url.trim(),
      provider,
      externalCourseId: courseRef.trim(),
      environment,
      active,
      revision: saved?.revision ?? 0,
    })
    setBusy(false)
    if (res.ok && res.data?.commercial) {
      setSaved(res.data.commercial)
      setPriceForm(initialPriceForm(res.data.commercial))
      setMsg({ kind: 'ok', text: 'Oferta salva. Ela vale na página pública depois de publicar o curso.' })
      onSaved?.(res.data.commercial)
    } else if (res.status === 409) {
      setMsg({ kind: 'error', text: 'Outra pessoa alterou a oferta. Recarregue a página para continuar.' })
    } else if (res.status === 0) {
      setMsg({ kind: 'error', text: 'Sem conexão com o servidor. Tente salvar novamente.' })
    } else {
      setMsg({ kind: 'error', text: [res.data?.message ?? 'Não foi possível salvar a oferta.', ...(res.data?.errors ?? []).map((e) => e.message)].join(' · ') })
    }
  }

  const disabled = !canCommerce || busy
  return (
    <div className="sf-field ed-offer" data-testid="checkout-settings">
      {!saved ? <p className="wizard-hint" data-cfg-field="commercial">Este curso ainda não tem oferta. Preencha o preço e o link de pagamento e salve.</p> : null}
      <PriceFields name={`ed-price-${courseId}`} form={priceForm} onChange={setPriceForm} disabled={disabled} maxInstallments={installments} />
      <label className="ds-label" htmlFor={`ed-installments-${courseId}`}>Parcelas máximas (sem juros, exibição)</label>
      <select id={`ed-installments-${courseId}`} className="ds-input" value={installments} disabled={disabled} onChange={(e) => setInstallments(Number(e.target.value) || 1)}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}x</option>)}
      </select>
      <label className="ds-label" htmlFor={`ed-provider-${courseId}`}>Checkout</label>
      <select id={`ed-provider-${courseId}`} className="ds-input" value={provider} disabled={disabled} onChange={(e) => setProvider(e.target.value as CheckoutProvider)}>
        <option value="academia">Academia (formulário da página + redirecionamento)</option>
        <option value="themembers">The Members (embutido na página)</option>
      </select>
      <div data-cfg-field="checkoutUrl" className="ed-offer-field">
        <label className="ds-label" htmlFor={`ed-checkout-url-${courseId}`}>{provider === 'themembers' ? 'URL do checkout da The Members (https)' : 'Link do checkout (https)'}</label>
        <input id={`ed-checkout-url-${courseId}`} className="ds-input" type="url" value={url} placeholder="https://…" disabled={disabled} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <label className="ds-label" htmlFor={`ed-checkout-course-id-${courseId}`}>ID do curso na The Members</label>
      <input id={`ed-checkout-course-id-${courseId}`} className="ds-input" type="text" value={courseRef} placeholder="Ex.: 7508903696019193856" maxLength={128} disabled={disabled} onChange={(e) => setCourseRef(e.target.value)} />
      <div data-cfg-field="environment" className="ed-offer-field">
        <label className="ds-label" htmlFor={`ed-environment-${courseId}`}>Ambiente</label>
        <select id={`ed-environment-${courseId}`} className="ds-input" value={environment} disabled={disabled} onChange={(e) => setEnvironment(e.target.value as CheckoutEnvironment)}>
          <option value="production">Produção</option>
          {SANDBOX_ALLOWED || environment === 'sandbox' ? <option value="sandbox">Teste (sandbox)</option> : null}
        </select>
      </div>
      <label className="sf-check" data-cfg-field="active">
        <input type="checkbox" checked={active} disabled={disabled} onChange={(e) => setActive(e.target.checked)} /> Oferta ativa (permite publicar o curso)
      </label>
      <p className="wizard-hint">
        {provider === 'themembers' ? 'O formulário da Academia fica desabilitado e o checkout da The Members aparece dentro da página.' : 'O comprador preenche o formulário da página e termina no link acima.'}{' '}
        Só aceita domínios autorizados no ambiente.
      </p>
      {!canCommerce ? <p className="wizard-hint">Somente quem gerencia o comércio altera preço e checkout.</p> : null}
      {msg ? <p role={msg.kind === 'error' ? 'alert' : 'status'} className={msg.kind === 'error' ? 'form-error' : 'form-ok'}>{msg.text}</p> : null}
      {canCommerce ? <button type="button" className="admin-button" disabled={busy || !dirty} onClick={() => void save()}>{busy ? 'Salvando…' : 'Salvar oferta'}</button> : null}
    </div>
  )
}
