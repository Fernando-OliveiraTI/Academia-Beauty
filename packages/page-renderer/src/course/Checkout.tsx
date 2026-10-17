'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react';
import { Icon } from './Icon';
import { BUYER_FIELDS, masks, rules, type BuyerField } from './checkout-logic';
import type { CheckoutContent } from './schemas';
import { DESKTOP_QUERY, useCourse, useMediaQuery, useReducedMotion } from './state';
import { installmentLabel, offerTexts, type OfferView } from '../offer';
import { mediaSrc } from '../media';

type Method = 'card' | 'pix' | 'boleto';
type FieldState = { value: string; status: 'idle' | 'valid' | 'invalid'; error: string };
type Buyer = Record<BuyerField, FieldState>;

const EMPTY: FieldState = { value: '', status: 'idle', error: '' };
const initialBuyer = (): Buyer => ({ name: EMPTY, email: EMPTY, cpf: EMPTY, phone: EMPTY });

const GAP: CSSProperties = { marginBottom: 'var(--space-5)' };
const PANE_RESET: CSSProperties = { border: 0, margin: 0, padding: 0, minWidth: 0 };
const LEGEND: CSSProperties = { padding: 0, marginBottom: 'var(--space-5)' };
const SUB: CSSProperties = { fontSize: '.9rem' };

const STEP_LABELS = ['Seus dados', 'Pagamento', 'Confirmação'];

function StatusIcons() {
  return (
    <>
      <Icon name="check" className="input-status input-status--ok" />
      <Icon name="alert" className="input-status input-status--err" />
    </>
  );
}

type BuyerInputProps = {
  id: BuyerField;
  label: React.ReactNode;
  state: FieldState;
  onChange: (id: BuyerField, e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: (id: BuyerField) => void;
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
  numeric?: boolean;
};

function BuyerInput({ id, label, state, onChange, onBlur, inputProps, numeric }: BuyerInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  // Mantém o cursor na mesma posição relativa ao fim depois da máscara reescrever o valor.
  useLayoutEffect(() => {
    if (caret.current === null || !ref.current) return;
    const pos = ref.current.value.length - caret.current;
    caret.current = null;
    try { ref.current.setSelectionRange(pos, pos); } catch { /* tipo sem seleção */ }
  });
  const cls = state.status === 'valid' ? 'field is-valid' : state.status === 'invalid' ? 'field is-invalid' : 'field';
  return (
    <div className={cls} data-field={id}>
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <input
          {...inputProps}
          ref={ref}
          className={numeric ? 'input num' : 'input'}
          id={id}
          name={id}
          value={state.value}
          aria-invalid={state.status === 'invalid' ? true : state.status === 'valid' ? false : undefined}
          aria-describedby={`${id}-error`}
          required
          onChange={(e) => {
            caret.current = e.target.value.length - (e.target.selectionStart ?? e.target.value.length);
            onChange(id, e);
          }}
          onBlur={() => onBlur(id)}
        />
        <StatusIcons />
      </div>
      <p className="field-error" id={`${id}-error`} aria-live="polite">{state.error}</p>
    </div>
  );
}

export function Checkout({ content, offer }: { content: CheckoutContent; offer: OfferView }) {
  const { step, setStep } = useCourse();
  const reduced = useReducedMotion();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [summaryOpen, setSummaryOpen] = useState<boolean | null>(null);
  const [buyer, setBuyer] = useState<Buyer>(initialBuyer);
  const [method, setMethod] = useState<Method>('card');
  const [alert, setAlert] = useState<string | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLOListElement>(null);
  const t = offerTexts(offer);

  // Resumo aberto no desktop; no mobile o usuário recolhe. A media query volta a mandar quando muda.
  const isSummaryOpen = summaryOpen ?? desktop;
  useEffect(() => setSummaryOpen(null), [desktop]);

  useEffect(() => {
    if (alert) alertRef.current?.focus({ preventScroll: true });
  }, [alert]);

  const note = method === 'pix' ? 'à vista no PIX' : method === 'boleto' ? 'à vista no boleto' : t.summaryNote;

  const validate = (id: BuyerField, value: string, silent = false): boolean => {
    const result = rules[id](value);
    const ok = result === true;
    if (!silent) setBuyer((b) => ({ ...b, [id]: { value, status: ok ? 'valid' : 'invalid', error: ok ? '' : result } }));
    return ok;
  };

  const onChange = (id: BuyerField, e: ChangeEvent<HTMLInputElement>) => {
    const mask = id === 'cpf' ? masks.cpf : id === 'phone' ? masks.phone : undefined;
    const value = mask ? mask(e.target.value) : e.target.value;
    const current = buyer[id];
    if (current.status === 'invalid' || validate(id, value, true)) validate(id, value);
    else setBuyer((b) => ({ ...b, [id]: { value, status: 'idle', error: '' } }));
  };

  const onBlur = (id: BuyerField) => {
    if (buyer[id].value.trim()) validate(id, buyer[id].value);
  };

  const scrollSteps = () => {
    const el = stepsRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top < 60 || top > window.innerHeight * 0.35) el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };

  const goToStep = (next: 1 | 2) => {
    setStep(next);
    setAlert(null);
    requestAnimationFrame(scrollSteps);
  };

  const next = () => {
    const invalid = BUYER_FIELDS.filter((id) => !validate(id, buyer[id].value));
    if (invalid.length) {
      setAlert(invalid.length === 1 ? 'Falta ajustar um campo para continuar.' : `Faltam ajustar ${invalid.length} campos para continuar.`);
      document.getElementById(invalid[0]!)?.focus();
      return;
    }
    goToStep(2);
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>('input[name="method"]:checked')?.focus({ preventScroll: true }));
  };

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    if (step !== 2) return;
    // O processamento do pagamento entra na fase de comércio; nenhum dado do formulário é lido ou enviado aqui.
    setAlert('O pagamento ainda não está disponível neste ambiente. Nenhum dado foi enviado.');
  };

  const firstName = buyer.name.value.trim().split(/\s+/)[0] ?? '';

  return (
    <section className="section checkout-section" id="checkout" aria-labelledby="checkout-title">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">{content.eyebrow}</span>
          <h2 id="checkout-title">{content.title}</h2>
        </div>

        <div className="checkout">
          <aside className="card summary-card" aria-labelledby="summary-title">
            <div className={isSummaryOpen ? 'summary is-open' : 'summary'}>
              <button
                className="summary-toggle"
                type="button"
                aria-expanded={isSummaryOpen}
                aria-controls="summary-body"
                onClick={() => setSummaryOpen(!isSummaryOpen)}
              >
                <span id="summary-title" className="caption" style={{ color: 'var(--color-text)' }}>Seu pedido</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong className="num">{t.total}</strong>
                  <Icon name="chev" className="chev" />
                </span>
              </button>
              <div className="summary-body" id="summary-body" hidden={!isSummaryOpen}>
                <div className="summary-product">
                  <img src={mediaSrc(content.productImage.src, 320)} alt="" width={64} height={64} loading="lazy" />
                  <div><strong>{content.productName}</strong><span className="caption">{content.productCaption}</span></div>
                </div>
                <dl className="summary-lines">
                  <div><dt>Produto</dt><dd>{t.list}</dd></div>
                  <div className="discount"><dt>Desconto ({t.discountPct})</dt><dd>{t.discount}</dd></div>
                </dl>
                <div className="summary-total">
                  <span className="caption" style={{ color: 'var(--color-text)' }}>Total</span>
                  <div><strong>{t.total}</strong><div className="summary-total-sub">{note}</div></div>
                </div>
                <div className="seals">
                  {content.seals.map((s) => (
                    <div className="seal" key={s.label}><Icon name={s.icon} />{s.label}</div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <div className="checkout-main">
            <ol className="steps" aria-label="Etapas da compra" ref={stepsRef}>
              {STEP_LABELS.map((label, i) => {
                const n = i + 1;
                const cls = n === step ? 'step is-active' : n < step ? 'step is-done' : 'step';
                return (
                  <li key={label} className={cls} aria-current={n === step ? 'step' : undefined}>
                    <span><b>{n}</b> {label}</span>
                  </li>
                );
              })}
            </ol>

            <div className="card checkout-card">
              <form id="checkout-form" noValidate onSubmit={onSubmit}>
                <div className="alert alert--info" role="note" style={GAP}>
                  <Icon name="info" />
                  <p>{content.notice}</p>
                </div>

                <div className="alert alert--error" id="form-alert" role="alert" tabIndex={-1} hidden={!alert} style={GAP} ref={alertRef}>
                  <Icon name="alert" />
                  <p>{alert ?? 'Confira os campos destacados.'}</p>
                </div>

                <fieldset
                  className="pane"
                  hidden={step !== 1}
                  style={PANE_RESET}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') { e.preventDefault(); next(); }
                  }}
                >
                  <legend className="pane-head" style={LEGEND}>
                    <h3>Seus dados</h3>
                    <span className="muted" style={SUB}>O acesso ao curso será enviado para este e-mail.</span>
                  </legend>
                  <div className="form-grid">
                    <BuyerInput
                      id="name" label="Nome completo" state={buyer.name} onChange={onChange} onBlur={onBlur}
                      inputProps={{ type: 'text', autoComplete: 'name', placeholder: 'Como está no seu documento' }}
                    />
                    <BuyerInput
                      id="email" label="E-mail" state={buyer.email} onChange={onChange} onBlur={onBlur}
                      inputProps={{ type: 'email', inputMode: 'email', autoComplete: 'email', placeholder: 'voce@email.com' }}
                    />
                    <div className="form-row">
                      <BuyerInput
                        id="cpf" numeric label={<>CPF <small>(para a nota fiscal)</small></>} state={buyer.cpf} onChange={onChange} onBlur={onBlur}
                        inputProps={{ type: 'text', inputMode: 'numeric', autoComplete: 'off', placeholder: '000.000.000-00', maxLength: 14 }}
                      />
                      <BuyerInput
                        id="phone" numeric label="Celular com DDD" state={buyer.phone} onChange={onChange} onBlur={onBlur}
                        inputProps={{ type: 'tel', inputMode: 'tel', autoComplete: 'tel-national', placeholder: '(11) 90000-0000', maxLength: 15 }}
                      />
                    </div>
                  </div>
                  <div className="pane-actions">
                    <button className="btn btn--primary btn--block" type="button" onClick={next}>
                      Continuar para o pagamento
                      <Icon name="arrow" className="arrow" size={18} />
                    </button>
                    <p className="secure-note"><Icon name="lock" />Seus dados estão protegidos</p>
                  </div>
                </fieldset>

                <fieldset className="pane" hidden={step !== 2} style={PANE_RESET}>
                  <legend className="pane-head" style={LEGEND}>
                    <h3>Forma de pagamento</h3>
                    <span className="muted" style={SUB}>
                      {firstName ? `Quase lá, ${firstName}. Escolha como prefere pagar.` : 'Escolha como prefere pagar.'}
                    </span>
                  </legend>

                  <div className="pay-methods" role="radiogroup" aria-label="Forma de pagamento">
                    {([
                      ['card', 'card', 'Cartão', `até ${t.maxInstallments}x`],
                      ['pix', 'pix', 'PIX', 'aprovação na hora'],
                      ['boleto', 'barcode', 'Boleto', 'até 3 dias úteis'],
                    ] as const).map(([value, icon, title, sub]) => (
                      <div className="pay-method" key={value}>
                        <input
                          type="radio" name="method" id={`m-${value}`} value={value}
                          checked={method === value}
                          onChange={() => { setMethod(value); setAlert(null); }}
                        />
                        <label htmlFor={`m-${value}`}><Icon name={icon} />{title}<small>{sub}</small></label>
                      </div>
                    ))}
                  </div>

                  <div className="method-panel" hidden={method !== 'card'}>
                    <CardFields offer={offer} />
                  </div>
                  <div className="method-panel" hidden={method !== 'pix'}>
                    <div className="info-box">
                      <Icon name="pix" />
                      <p>Ao finalizar, geramos um <strong>QR Code PIX</strong> válido por 30 minutos. O acesso é liberado assim que o pagamento é confirmado.</p>
                    </div>
                  </div>
                  <div className="method-panel" hidden={method !== 'boleto'}>
                    <div className="info-box">
                      <Icon name="barcode" />
                      <p>O boleto vence em <strong>3 dias úteis</strong>. A liberação acontece após a compensação bancária, em até 3 dias úteis após o pagamento.</p>
                    </div>
                  </div>

                  <div className="pane-actions">
                    <button className="btn btn--primary btn--block" type="submit">
                      <span>Finalizar compra · <span>{t.total}</span></span>
                    </button>
                    <p className="secure-note"><Icon name="lock" />Pagamento criptografado · Garantia de 7 dias</p>
                    <button className="link-btn" type="button" onClick={() => { goToStep(1); requestAnimationFrame(() => document.getElementById('name')?.focus()); }}>
                      Voltar e editar meus dados
                    </button>
                  </div>
                </fieldset>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Campos do cartão: apenas apresentação. Nada é lido, validado, guardado nem enviado nesta fase. */
function CardFields({ offer }: { offer: OfferView }) {
  const wrap = (id: string, label: string, input: React.ReactNode, extra?: React.ReactNode) => (
    <div className="field" data-field={id}>
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        {input}
        {extra}
        <StatusIcons />
      </div>
      <p className="field-error" id={`${id}-error`} aria-live="polite" />
    </div>
  );
  return (
    <>
      {wrap('cardNumber', 'Número do cartão',
        <input className="input num" id="cardNumber" name="cardNumber" type="text" inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" maxLength={23} aria-describedby="cardNumber-error" />,
        <span className="card-brand" aria-live="polite" />)}
      {wrap('cardName', 'Nome impresso no cartão',
        <input className="input" id="cardName" name="cardName" type="text" autoComplete="cc-name" placeholder="NOME SOBRENOME" aria-describedby="cardName-error" style={{ textTransform: 'uppercase' }} />)}
      <div className="form-row">
        {wrap('cardExpiry', 'Validade',
          <input className="input num" id="cardExpiry" name="cardExpiry" type="text" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" maxLength={5} aria-describedby="cardExpiry-error" />)}
        {wrap('cardCvv', 'Código de segurança',
          <input className="input num" id="cardCvv" name="cardCvv" type="text" inputMode="numeric" autoComplete="cc-csc" placeholder="CVV" maxLength={4} aria-describedby="cardCvv-error" />)}
      </div>
      <div className="field">
        <label htmlFor="installments">Parcelas</label>
        <select className="select num" id="installments" name="installments">
          {offer.installments.map((o) => (
            <option key={o.count} value={o.count}>{installmentLabel(o, offer.totalCents)}</option>
          ))}
        </select>
      </div>
    </>
  );
}
