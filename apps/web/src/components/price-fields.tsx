'use client'

import { PRICE_DISPLAYS, PRICE_DISPLAY_LABEL, type PriceDisplay } from '@academia/contracts'
import { displayFlags } from '@academia/page-renderer'
import { brl } from '@/lib/format'
import { priceResult, switchPriceDisplay, type PriceErrors, type PriceForm } from '@/lib/price-form'
import { maskBRL, maskPercent } from '@/app/admin/(protected)/cursos/form-model'

/**
 * Preço da oferta: o usuário escolhe como o valor aparece e o formulário mostra só os campos daquele formato
 * (de/por → "De" e "Por"; % OFF → preço e porcentagem; preço padrão → um preço). Cada opção mostra a prévia com os valores atuais.
 */
export function PriceFields({ form, onChange, disabled, errors, maxInstallments, name }: { form: PriceForm; onChange: (next: PriceForm) => void; disabled?: boolean; errors?: PriceErrors; maxInstallments: number; name: string }) {
  const result = priceResult(form, maxInstallments)
  const offer = result.ok ? result.offer : null
  const hasDiscount = Boolean(offer && offer.discountPct > 0 && offer.listCents > offer.totalCents)
  // Erro do servidor (quando houver) vale sobre o local; chaves sem valor não apagam a mensagem local.
  const server = Object.fromEntries(Object.entries(errors ?? {}).filter(([, message]) => message)) as PriceErrors
  const shown: PriceErrors = { ...(result.ok ? {} : result.errors), ...server }
  const set = (patch: Partial<PriceForm>) => onChange({ ...form, ...patch })
  const field = (key: 'list' | 'final' | 'pct', label: string, value: string, mask: (v: string) => string, placeholder: string, suffix?: string) => (
    <div className="pdp-field">
      <label className="ds-label" htmlFor={`${name}-${key}`}>{label}</label>
      <input id={`${name}-${key}`} className="ds-input" inputMode="numeric" value={value} placeholder={placeholder} disabled={disabled} aria-invalid={Boolean(shown[key])} aria-describedby={shown[key] ? `${name}-${key}-err` : undefined} onChange={(e) => set({ [key]: mask(e.target.value) })} />
      {suffix ? <span className="pdp-suffix" aria-hidden="true">{suffix}</span> : null}
      {shown[key] ? <small id={`${name}-${key}-err`} role="alert" className="form-error">{shown[key]}</small> : null}
    </div>
  )

  return (
    <fieldset className="pdp" disabled={disabled}>
      <legend className="ds-label">Como mostrar o preço</legend>
      <div className="pdp-options" role="radiogroup" aria-label="Como mostrar o preço">
        {PRICE_DISPLAYS.map((option: PriceDisplay) => {
          const flags = displayFlags(option, hasDiscount)
          return (
            <label className={`pdp-option${form.display === option ? ' is-selected' : ''}`} key={option}>
              <input type="radio" name={`${name}-display`} value={option} checked={form.display === option} onChange={() => onChange(switchPriceDisplay(form, option, maxInstallments))} className="sr-only" />
              <b>{PRICE_DISPLAY_LABEL[option].label}</b>
              <small>{PRICE_DISPLAY_LABEL[option].hint}</small>
              {offer ? (
                <span className="pdp-sample num" aria-hidden="true">
                  {flags.showBadge ? <em>{offer.discountPct}% OFF</em> : null}
                  {flags.showOld ? <s>{brl(offer.listCents)}</s> : null}
                  <strong>{brl(offer.totalCents)}</strong>
                </span>
              ) : null}
            </label>
          )
        })}
      </div>

      <div className="pdp-fields" data-display={form.display}>
        {form.display === 'standard' ? field('final', 'Preço (R$)', form.final, maskBRL, '0,00') : null}
        {form.display === 'percent_off' ? (
          <>
            {field('list', 'Preço de tabela (R$)', form.list, maskBRL, '0,00')}
            {field('pct', 'Desconto (%)', form.pct, (v) => maskPercent(v), '0', '%')}
          </>
        ) : null}
        {form.display === 'from_to' || form.display === 'full' ? (
          <>
            {field('list', 'De (R$)', form.list, maskBRL, '0,00')}
            {field('final', 'Por (R$)', form.final, maskBRL, '0,00')}
          </>
        ) : null}
      </div>
      {offer ? (
        <p className="wizard-hint" role="status">
          Valor final: <strong>{brl(offer.totalCents)}</strong>
          {offer.discountPct > 0 ? ` (de ${brl(offer.listCents)}, ${offer.discountPct}% de desconto${form.display === 'percent_off' ? '' : ' calculado'})` : ''}
          {form.display === 'standard' ? ' · sem desconto destacado' : ''}. Vale em todo lugar que mostra o valor deste curso: página, checkout e cards. A mudança aparece no site depois de publicar.
        </p>
      ) : <p className="wizard-hint">Preencha os valores para ver a prévia.</p>}
    </fieldset>
  )
}
