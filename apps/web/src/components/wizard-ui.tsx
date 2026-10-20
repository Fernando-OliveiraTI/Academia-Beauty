import Link from 'next/link'
import { useId, type ReactNode, type SelectHTMLAttributes } from 'react'

const svg = (children: ReactNode, size = 20) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)

/** Ícones do assistente (traço fino, herdam a cor do texto). */
export const WizardIcon = {
  book: svg(<><path d="M4 5.5A2.5 2.5 0 016.5 3H20v16H6.5A2.5 2.5 0 004 21.5z" /><path d="M4 5.5v16" /><path d="M9 7h6" /></>, 26),
  user: svg(<><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></>, 26),
  list: svg(<><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>, 26),
  image: svg(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5-5-8 8" /></>, 26),
  shield: svg(<path d="M12 3l7 3v5c0 5-3.2 8.4-7 10-3.8-1.6-7-5-7-10V6z" />, 26),
  tag: svg(<><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.2" /></>, 26),
  check: svg(<><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.5" /></>, 26),
  person: svg(<><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></>),
  type: svg(<><path d="M5 6V4h14v2" /><path d="M12 4v16" /><path d="M9 20h6" /></>),
  chart: svg(<><path d="M5 20v-5M10 20V9M15 20v-8M20 20V5" /></>),
  monitor: svg(<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>),
  clock: svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  users: svg(<><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.2 2.7-5 6-5s6 1.8 6 5" /><path d="M16 5.5a3 3 0 010 5.5M18 15c2 .5 3 2 3 5" /></>),
  link: svg(<><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></>),
  sparkle: svg(<><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></>),
  arrowLeft: svg(<><path d="M19 12H5" /><path d="M11 6l-6 6 6 6" /></>, 18),
  arrowRight: svg(<><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>, 18),
}

/** Ícones de 20 px para linhas, botões e cartões. */
export const Ico = {
  calendar: svg(<><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>),
  help: svg(<><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01" /></>),
  doc: svg(<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>),
  trash: svg(<><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>),
  plus: svg(<><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>),
  save: svg(<><path d="M5 3h12l3 3v15H5z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></>),
  eye: svg(<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
  pencil: svg(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></>),
  star: svg(<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />),
  play: svg(<><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5.5 3.5-5.5 3.5z" /></>),
  cap: svg(<><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5" /></>),
  cart: svg(<><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h3l2.4 12h11l2-8H6" /></>),
  info: svg(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>),
  shield: svg(<path d="M12 3l7 3v5c0 5-3.2 8.4-7 10-3.8-1.6-7-5-7-10V6z" />),
  image: svg(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5-5-8 8" /></>),
  link: svg(<><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></>),
  person: svg(<><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></>),
  type: svg(<><path d="M5 6V4h14v2" /><path d="M12 4v16" /><path d="M9 20h6" /></>),
  chart: svg(<path d="M5 20v-5M10 20V9M15 20v-8M20 20V5" />),
  monitor: svg(<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>),
  users: svg(<><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.2 2.7-5 6-5s6 1.8 6 5" /><path d="M16 5.5a3 3 0 010 5.5M18 15c2 .5 3 2 3 5" /></>),
  arrowRight: svg(<><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>, 18),
  arrowLeft: svg(<><path d="M19 12H5" /><path d="M11 6l-6 6 6 6" /></>, 18),
}

/** Cabeçalho da tela: voltar, título com a última palavra em destaque, subtítulo e ação à direita. */
export function WizardHeader({ backHref, backLabel = 'Voltar', title, subtitle, action }: { backHref: string; backLabel?: string; title: string; subtitle?: string; action?: ReactNode }) {
  const words = title.trim().split(/\s+/)
  const last = words.length > 1 ? words.pop() : null
  return (
    <header className="wz-header">
      <div>
        <Link className="wz-back" href={backHref}>{WizardIcon.arrowLeft}{backLabel}</Link>
        <h1>{last ? <>{words.join(' ')} <span>{last}</span></> : title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action ? <div className="wz-header-action">{action}</div> : null}
    </header>
  )
}

export type WizardStep = { key: string; label: string }

/** Etapas em círculos numerados ligados por uma linha; a ativa leva o sublinhado dourado. */
export function WizardSteps({ steps, step, onSelect, isDisabled }: { steps: readonly WizardStep[]; step: number; onSelect: (i: number) => void; isDisabled?: (i: number) => boolean }) {
  return (
    <ol className="wz-steps" aria-label="Etapas do cadastro">
      {steps.map((s, i) => (
        <li key={s.key} data-state={i === step ? 'current' : i < step ? 'done' : 'todo'}>
          <button type="button" aria-current={i === step ? 'step' : undefined} disabled={isDisabled?.(i)} onClick={() => onSelect(i)}>
            <span className="wz-dot" aria-hidden="true">{i + 1}</span>
            <span className="wz-step-label">{s.label}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}

/** Título do painel: ícone em caixa, título (última palavra em dourado), descrição e, opcionalmente, um cartão à direita. */
export function PanelHead({ icon, title, desc, aside, accent }: { icon: ReactNode; title: string; desc?: string; aside?: ReactNode; accent?: boolean }) {
  const words = title.trim().split(/\s+/)
  const last = accent && words.length > 1 ? words.pop() : null
  return (
    <div className="wz-panel-head">
      <span className="wz-panel-icon" aria-hidden="true">{icon}</span>
      <div className="wz-panel-text">
        <h2 id="wizard-title">{last ? <>{words.join(' ')} <span>{last}</span></> : title}</h2>
        {desc ? <p>{desc}</p> : null}
      </div>
      {aside ? <div className="wz-panel-aside">{aside}</div> : null}
    </div>
  )
}

/** Cartão informativo (ícone + título + texto). */
export function InfoCard({ icon = Ico.info, title, children }: { icon?: ReactNode; title?: string; children: ReactNode }) {
  return (
    <div className="wz-info">
      <span aria-hidden="true">{icon}</span>
      <div>{title ? <strong>{title}</strong> : null}<p>{children}</p></div>
    </div>
  )
}

/** Bloco numerado (círculo 1, 2, 3…) com título, destaque dourado opcional, descrição e cartão lateral. */
export function NumberedSection({ n, title, accent, desc, aside, boxed, children }: { n: number; title: string; accent?: string; desc?: string; aside?: ReactNode; boxed?: boolean; children: ReactNode }) {
  return (
    <section className="wz-section" aria-label={title}>
      <header>
        <span className="wz-num" aria-hidden="true">{n}</span>
        <div>
          <h3>{title}{accent ? <> <em>{accent}</em></> : null}</h3>
          {desc ? <p>{desc}</p> : null}
        </div>
      </header>
      <div className={aside ? 'wz-section-body wz-section-body--aside' : 'wz-section-body'}>
        <div className={boxed ? 'wz-section-main wz-box' : 'wz-section-main'}>{children}</div>
        {aside ? <div className="wz-section-aside">{aside}</div> : null}
      </div>
    </section>
  )
}

/** Botão de remover item (lixeira). */
export function RemoveButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className="wz-remove" aria-label={label} title={label} disabled={disabled} onClick={onClick}>{Ico.trash}</button>
}

/** Botão de adicionar item; `wide` ocupa a linha inteira com borda tracejada. */
export function AddButton({ children, onClick, disabled, wide }: { children: ReactNode; onClick: () => void; disabled?: boolean; wide?: boolean }) {
  return <button type="button" className={wide ? 'wz-add wz-add--wide' : 'wz-add'} disabled={disabled} onClick={onClick}>{Ico.plus}{children}</button>
}

/** Linha do resumo: ícone, rótulo pequeno e valor. */
export function SummaryRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="wz-sum-row">
      <span aria-hidden="true">{icon}</span>
      <div><small>{label}</small><strong>{value || '—'}</strong></div>
    </div>
  )
}

/** Pendência: ícone, título, descrição e ação "Ir para a etapa". */
export function IssueRow({ icon, title, desc, onGo }: { icon: ReactNode; title: string; desc: string; onGo?: () => void }) {
  return (
    <li className="wz-issue">
      <span aria-hidden="true">{icon}</span>
      <div><strong>{title}</strong><small>{desc}</small></div>
      {onGo ? <button type="button" onClick={onGo}>Ir para a etapa {Ico.arrowRight}</button> : null}
    </li>
  )
}

/** Faixa de pendências para publicar: resume o que falta por etapa e abre a etapa com o formulário. */
export function PendingBanner({ issues, stepLabels, onGo }: { issues: readonly { message: string; step: number }[]; stepLabels: readonly string[]; onGo: (step: number) => void }) {
  if (issues.length === 0) return <p role="status" className="form-ok">Cadastro completo: volte ao editor para publicar.</p>
  const steps = [...new Set(issues.map((i) => i.step))].sort((a, b) => a - b)
  return (
    <section role="alert" className="wz-pending" aria-labelledby="wz-pending-title">
      <div className="wz-pending-head">
        <div>
          <strong id="wz-pending-title">{issues.length === 1 ? 'Falta 1 informação para publicar' : `Faltam ${issues.length} informações para publicar`}</strong>
          <small>Preencha os itens abaixo e volte ao editor para publicar.</small>
        </div>
        <button type="button" className="admin-button" onClick={() => onGo(steps[0]!)}>Preencher agora {Ico.arrowRight}</button>
      </div>
      <ul>
        {steps.map((step) => (
          <li key={step}>
            <div>
              <small>{stepLabels[step]}</small>
              <ul>{issues.filter((i) => i.step === step).map((i) => <li key={i.message}>{i.message}</li>)}</ul>
            </div>
            <button type="button" onClick={() => onGo(step)}>Abrir etapa {Ico.arrowRight}</button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Cartão de ação (pré-visualizar, abrir editor). */
export function ActionCard({ href, icon, title, desc, external }: { href: string; icon: ReactNode; title: string; desc: string; external?: boolean }) {
  return (
    <a className="wz-action-card" href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
      <span aria-hidden="true">{icon}</span>
      <div><strong>{title}</strong><small>{desc}</small></div>
      {Ico.arrowRight}
    </a>
  )
}

/** Select no mesmo desenho dos campos decorados (ícone à esquerda e seta). */
export function SelectField({ label, icon, hint, error, requiredMark, children, id, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; icon?: ReactNode; hint?: ReactNode; error?: string; requiredMark?: boolean }) {
  const auto = useId()
  const selectId = id ?? auto
  return (
    <div className="ds-field">
      <label className="ds-label" htmlFor={selectId}>{label}{requiredMark ? <span className="ds-req" aria-hidden="true"> *</span> : null}</label>
      <div className="ds-input-wrap" data-invalid={error ? true : undefined} data-disabled={rest.disabled || undefined}>
        {icon ? <span className="ds-icon" aria-hidden="true">{icon}</span> : null}
        <select id={selectId} className="ds-input" aria-invalid={error ? true : undefined} {...rest}>{children}</select>
      </div>
      {hint ? <p className="ds-hint">{hint}</p> : null}
      {error ? <p role="alert" className="ds-error">{error}</p> : null}
    </div>
  )
}
