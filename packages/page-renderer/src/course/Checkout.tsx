'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { Icon } from './Icon';
import { FIELD_INPUT, validateBuyer } from './checkout-logic';
import type { CheckoutContent } from './schemas';
import { DESKTOP_QUERY, useCourse, useMediaQuery, useReducedMotion } from './state';
import { installmentLabel, offerTexts, type OfferView } from '../offer';
import { mediaSrc } from '../media';
import { loadVisitRef, useVisitStatus, withVisitRef } from './checkout-status';

type Method = 'card' | 'pix' | 'boleto';
type FieldState = { value: string; status: 'idle' | 'valid' | 'invalid'; error: string };
type BuyerField = CheckoutContent['buyerFields'][number];

const EMPTY: FieldState = { value: '', status: 'idle', error: '' };

const GAP: CSSProperties = { marginBottom: 'var(--space-5)' };
const PANE_RESET: CSSProperties = { border: 0, margin: 0, padding: 0, minWidth: 0 };
const LEGEND: CSSProperties = { padding: 0, marginBottom: 'var(--space-5)' };
const SUB: CSSProperties = { fontSize: '.9rem' };

function StatusIcons() {
  return (
    <>
      <Icon name="check" className="input-status input-status--ok" />
      <Icon name="alert" className="input-status input-status--err" />
    </>
  );
}

type BuyerInputProps = {
  id: string;
  field: BuyerField;
  state: FieldState;
  onChange: (value: string) => void;
  onBlur: () => void;
};

function BuyerInput({ id, field, state, onChange, onBlur }: BuyerInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const kind = FIELD_INPUT[field.type];
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
      <label htmlFor={id}>{field.label}{field.help ? <> <small>({field.help})</small></> : null}{field.required ? null : <> <small>(opcional)</small></>}</label>
      <div className="input-wrap">
        <input
          ref={ref}
          className={kind.numeric ? 'input num' : 'input'}
          id={id}
          name={id}
          type={kind.type}
          inputMode={kind.inputMode}
          autoComplete={kind.autoComplete}
          maxLength={kind.maxLength}
          placeholder={field.placeholder || undefined}
          value={state.value}
          aria-invalid={state.status === 'invalid' ? true : state.status === 'valid' ? false : undefined}
          aria-describedby={`${id}-error`}
          aria-required={field.required || undefined}
          onChange={(e) => {
            caret.current = e.target.value.length - (e.target.selectionStart ?? e.target.value.length);
            onChange(e.target.value);
          }}
          onBlur={onBlur}
        />
        <StatusIcons />
      </div>
      <p className="field-error" id={`${id}-error`} aria-live="polite">{state.error}</p>
    </div>
  );
}

const PAIRED = new Set(['cpf', 'phone']);
const METHOD_ICONS = ['card', 'pix', 'barcode'] as const;
const METHOD_KEYS = ['card', 'pix', 'boleto'] as const;

export function Checkout({ content, offer }: { content: CheckoutContent; offer: OfferView }) {
  const { step, setStep, checkout } = useCourse();
  const embed = checkout.mode === 'embed';
  const redirect = checkout.mode === 'redirect';
  const reduced = useReducedMotion();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [summaryOpen, setSummaryOpen] = useState<boolean | null>(null);
  const fields = content.buyerFields;
  // O estado é por posição do campo; se a lista muda (o editor reordena, insere ou remove), ele recomeça vazio
  // em vez de passar valor, validade e erro para outro campo.
  const fieldsSig = fields.map((f) => `${f.type}:${f.label}`).join('|');
  const [buyerState, setBuyerState] = useState<{ sig: string; map: Record<number, FieldState> }>({ sig: fieldsSig, map: {} });
  const buyer = buyerState.sig === fieldsSig ? buyerState.map : {};
  const setBuyer = (update: (b: Record<number, FieldState>) => Record<number, FieldState>) =>
    setBuyerState((s) => ({ sig: fieldsSig, map: update(s.sig === fieldsSig ? s.map : {}) }));
  const [methodIx, setMethodIx] = useState(0);
  const [alert, setAlert] = useState<string | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLOListElement>(null);
  const confirmRef = useRef<HTMLHeadingElement>(null);
  const t = offerTexts(offer);
  const methods = content.methods.slice(0, METHOD_KEYS.length);
  const stepLabels = [content.stepData, content.stepPayment, content.stepConfirmation];

  // Resumo aberto no desktop; no mobile o usuário recolhe. A media query volta a mandar quando muda.
  const isSummaryOpen = summaryOpen ?? desktop;
  useEffect(() => setSummaryOpen(null), [desktop]);

  useEffect(() => {
    if (alert) alertRef.current?.focus({ preventScroll: true });
  }, [alert]);

  const methodKey = METHOD_KEYS[methodIx] ?? 'card';
  const note = methodKey === 'pix' ? 'à vista no PIX' : methodKey === 'boleto' ? 'à vista no boleto' : t.summaryNote;
  const valueOf = (i: number) => buyer[i]?.value ?? '';

  const validate = (i: number, value: string, silent = false): boolean => {
    const f = fields[i];
    if (!f) return true;
    const result = validateBuyer(f.type, value, f.required);
    const ok = result === true;
    if (!silent) setBuyer((b) => ({ ...b, [i]: { value, status: ok ? (value.trim() ? 'valid' : 'idle') : 'invalid', error: ok ? '' : result } }));
    return ok;
  };

  const onChange = (i: number, raw: string) => {
    const mask = FIELD_INPUT[fields[i]?.type ?? 'text'].mask;
    const value = mask ? mask(raw) : raw;
    if (buyer[i]?.status === 'invalid' || validate(i, value, true)) validate(i, value);
    else setBuyer((b) => ({ ...b, [i]: { value, status: 'idle', error: '' } }));
  };

  const onBlur = (i: number) => {
    if (valueOf(i).trim()) validate(i, valueOf(i));
  };

  const scrollSteps = () => {
    const el = stepsRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top < 60 || top > window.innerHeight * 0.35) el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };

  const goToStep = (next: 1 | 2 | 3) => {
    setStep(next);
    setAlert(null);
    requestAnimationFrame(scrollSteps);
  };

  const next = () => {
    const invalid = fields.map((_, i) => i).filter((i) => !validate(i, valueOf(i)));
    if (invalid.length) {
      setAlert(invalid.length === 1 ? 'Falta ajustar um campo para continuar.' : `Faltam ajustar ${invalid.length} campos para continuar.`);
      document.getElementById(`buyer-${invalid[0]}`)?.focus();
      return;
    }
    goToStep(2);
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>('input[name="method"]:checked')?.focus({ preventScroll: true }));
  };

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    if (step !== 2) return;
    if (redirect) {
      // Nada do formulário é enviado: a compra termina no ambiente do provedor (a integração é da Fase 6).
      goToStep(3);
      requestAnimationFrame(() => confirmRef.current?.focus({ preventScroll: true }));
      return;
    }
    // Demonstração: o processamento do pagamento não existe; nenhum dado do formulário é lido ou enviado aqui.
    setAlert('O pagamento ainda não está disponível neste ambiente. Nenhum dado foi enviado.');
  };

  const url = checkout.mode === 'redirect' && checkout.url && /^https:\/\//i.test(checkout.url) ? checkout.url : null;

  const fieldRows: ReactNode[] = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]!;
    const input = (ix: number) => (
      <BuyerInput
        key={ix} id={`buyer-${ix}`} field={fields[ix]!} state={buyer[ix] ?? EMPTY}
        onChange={(v) => onChange(ix, v)} onBlur={() => onBlur(ix)}
      />
    );
    if (PAIRED.has(f.type) && fields[i + 1] && PAIRED.has(fields[i + 1]!.type)) {
      fieldRows.push(<div className="form-row" key={`row-${i}`}>{input(i)}{input(i + 1)}</div>);
      i++;
    } else {
      fieldRows.push(input(i));
    }
  }

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
                <span id="summary-title" className="caption" style={{ color: 'var(--color-text)' }}>{content.summaryTitle}</span>
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
                  <div><dt>{content.summaryProduct}</dt><dd>{t.list}</dd></div>
                  {t.hasDiscount && <div className="discount"><dt>{content.summaryDiscount} ({t.discountPct})</dt><dd>{t.discount}</dd></div>}
                </dl>
                <div className="summary-total">
                  <span className="caption" style={{ color: 'var(--color-text)' }}>{content.summaryTotal}</span>
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
            {embed ? <EmbeddedCheckout url={checkout.url} statusUrl={checkout.mode === 'embed' ? checkout.statusUrl : undefined} title={content.title} content={content} /> : <>
            <ol className="steps" aria-label="Etapas da compra" ref={stepsRef}>
              {stepLabels.map((label, i) => {
                const n = i + 1;
                const cls = n === step ? 'step is-active' : n < step ? 'step is-done' : 'step';
                return (
                  <li key={n} className={cls} aria-current={n === step ? 'step' : undefined}>
                    <span><b>{n}</b> {label}</span>
                  </li>
                );
              })}
            </ol>

            <div className="card checkout-card">
              <form id="checkout-form" noValidate onSubmit={onSubmit}>
                {content.notice && (
                  <div className="alert alert--info" role="note" style={GAP}>
                    <Icon name="info" />
                    <p>{content.notice}</p>
                  </div>
                )}

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
                    <h3>{content.dataTitle}</h3>
                    {content.dataLead && <span className="muted" style={SUB}>{content.dataLead}</span>}
                  </legend>
                  <div className="form-grid">{fieldRows}</div>
                  <div className="pane-actions">
                    <button className="btn btn--primary btn--block" type="button" onClick={next}>
                      {content.dataButton}
                      <Icon name="arrow" className="arrow" size={18} />
                    </button>
                    {content.dataNote && <p className="secure-note"><Icon name="lock" />{content.dataNote}</p>}
                  </div>
                </fieldset>

                <fieldset className="pane" hidden={step !== 2} style={PANE_RESET}>
                  <legend className="pane-head" style={LEGEND}>
                    <h3>{content.paymentTitle}</h3>
                    {content.paymentLead && <span className="muted" style={SUB}>{content.paymentLead}</span>}
                  </legend>

                  <div className="pay-methods" role="radiogroup" aria-label={content.paymentTitle}>
                    {methods.map((m, i) => (
                      <div className="pay-method" key={METHOD_KEYS[i]}>
                        <input
                          type="radio" name="method" id={`m-${METHOD_KEYS[i]}`} value={METHOD_KEYS[i]}
                          checked={methodIx === i}
                          onChange={() => { setMethodIx(i); setAlert(null); }}
                        />
                        <label htmlFor={`m-${METHOD_KEYS[i]}`}><Icon name={METHOD_ICONS[i]!} />{m.title}<small>{!redirect && i === 0 ? `até ${t.maxInstallments}x` : m.sub}</small></label>
                      </div>
                    ))}
                  </div>

                  {methods.map((m, i) => (
                    <div className="method-panel" key={METHOD_KEYS[i]} hidden={methodIx !== i}>
                      {!redirect && i === 0 ? (
                        <CardFields offer={offer} />
                      ) : (
                        <div className="info-box">
                          <Icon name={METHOD_ICONS[i]!} />
                          <p>{m.info}{redirect && i === 0 && t.maxInstallments > 1 ? ` Até ${t.maxInstallments}x sem juros.` : ''}</p>
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="pane-actions">
                    <button className="btn btn--primary btn--block" type="submit">
                      {redirect
                        ? <span>{content.paymentButton} · <span>{t.total}</span></span>
                        : <span>Finalizar compra · <span>{t.total}</span></span>}
                    </button>
                    {content.paymentNote && <p className="secure-note"><Icon name="lock" />{content.paymentNote}</p>}
                    <button className="link-btn" type="button" onClick={() => { goToStep(1); requestAnimationFrame(() => document.getElementById('buyer-0')?.focus()); }}>
                      {content.paymentBack}
                    </button>
                  </div>
                </fieldset>

                <fieldset className="pane" hidden={step !== 3} style={PANE_RESET}>
                  <legend className="pane-head" style={LEGEND}>
                    <h3 tabIndex={-1} ref={confirmRef}>{content.confirmTitle}</h3>
                    {content.confirmLead && <span className="muted" style={SUB}>{content.confirmLead}</span>}
                  </legend>
                  <div className="pane-actions">
                    {url ? (
                      <a className="btn btn--primary btn--block" href={url} rel="noopener noreferrer" data-cta="">
                        {content.confirmButton}
                        <Icon name="arrow" className="arrow" size={18} />
                      </a>
                    ) : (
                      <>
                        <span className="btn btn--primary btn--block is-disabled" role="button" aria-disabled="true" data-unavailable="">{content.confirmButton}</span>
                        <p className="field-error" role="status">{content.confirmUnavailable}</p>
                      </>
                    )}
                    <button className="link-btn" type="button" onClick={() => goToStep(2)}>{content.confirmBack}</button>
                  </div>
                </fieldset>
              </form>
            </div>
            </>}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Checkout hospedado da The Members dentro da página. A URL já foi validada pelo backend (https + domínio autorizado).
 * Com `statusUrl` (só na página pública) a visita ganha um código que vai na URL do iframe como UTM; quando o webhook
 * da The Members confirma o pagamento a página troca o iframe pela confirmação, sem o comprador precisar fazer nada.
 */
function EmbeddedCheckout({ url, statusUrl, title, content }: { url: string | null; statusUrl?: string; title: string; content: CheckoutContent }) {
  const safe = url && /^https:\/\//i.test(url) ? url : null;
  const tracked = Boolean(safe && statusUrl);
  const [ref, setRef] = useState<string | null>(null);
  const [seen, setSeen] = useState(false);
  const card = useRef<HTMLDivElement>(null);

  // O código nasce no navegador (depois da hidratação): o HTML do servidor não o conhece.
  useEffect(() => { if (tracked) setRef(loadVisitRef()); }, [tracked]);
  // Só começa a consultar depois que o checkout apareceu na tela: quem nem chegou até ele não gera chamadas.
  useEffect(() => {
    if (!tracked || seen) return;
    const el = card.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [tracked, seen]);

  const visit = useVisitStatus(statusUrl, ref, tracked && seen);
  const paid = visit.status === 'approved';
  const message =
    visit.status === 'processing' ? content.processingText
    : visit.status === 'waiting' ? (visit.method === 'boleto' ? content.waitingBoleto : content.waitingPix)
    : visit.status === 'failed' ? content.failedText
    : visit.status === 'refunded' ? content.refundedText
    : null;
  const src = safe ? (tracked ? (ref ? withVisitRef(safe, ref) : null) : safe) : null;

  return (
    <div className="card checkout-card" data-embed="" ref={card}>
      {paid ? (
        <div className="pay-result" role="status" data-state="paid">
          <span className="pay-result-icon" aria-hidden="true"><Icon name="check" /></span>
          <h3>{content.paidTitle}</h3>
          <p>{content.paidText}</p>
        </div>
      ) : (
        <>
          {message ? (
            <p className="pay-notice" role="status" aria-live="polite" data-state={visit.status}>{message}</p>
          ) : null}
          {safe ? (
            src ? (
              <iframe
                src={src}
                title={title}
                loading="lazy"
                allow="payment *"
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-storage-access-by-user-activation"
                style={{ display: 'block', width: '100%', minHeight: 1180, border: 0, borderRadius: 'inherit', background: 'transparent' }}
              />
            ) : <div aria-hidden="true" style={{ minHeight: 1180 }} />
          ) : (
            <p className="field-error" role="status">{content.confirmUnavailable}</p>
          )}
        </>
      )}
    </div>
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
