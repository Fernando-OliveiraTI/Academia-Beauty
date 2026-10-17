'use client'

import { useState } from 'react'
import {
  COURSE_LEVELS,
  COURSE_LEVEL_LABEL,
  COURSE_MODALITIES,
  COURSE_MODALITY_LABEL,
  computeOffer,
  courseDataSchema,
  type AdminCourse,
  type CourseData,
  type Permission,
  type ReadinessIssue,
} from '@academia/contracts'
import { Button, Field, TextArea } from '@academia/design-system'
import { apiSend } from '@/lib/api-client'
import { MediaInput } from '@/components/media-input'
import { canonical, centsToInput, emptyCourseData, emptyLines, fieldErrors, groupIssuesByStep, parseBRLToCents, STEPS, suggestSlug } from './form-model'

type Loaded = AdminCourse & { readiness: ReadinessIssue[] }
type ApiError = { message?: string; code?: string; errors?: Array<{ field: string; message: string }> }
export type ProfessionalOption = { id: number; name: string }

const MESSAGES: Record<string, string> = {
  revision_conflict: 'Outra pessoa alterou este registro. Recarregue a página para continuar sem perder o trabalho dela.',
  slug_taken: 'Este endereço (slug) já está em uso.',
  slug_locked: 'O endereço não pode mudar depois da primeira publicação.',
  archived: 'Restaure o curso antes de continuar.',
  professional_not_published: 'Publique o profissional deste curso antes de publicar o curso.',
  checkout_url_invalid: 'O link de checkout não é aceito.',
}

function describe(status: number, body: ApiError | null): string {
  if (body?.code && MESSAGES[body.code]) return `${MESSAGES[body.code]}${body.code === 'checkout_url_invalid' && body.message ? ` ${body.message}.` : ''}`
  if (status === 0) return 'Sem conexão com o servidor. Verifique a internet e tente novamente.'
  if (status === 401) return 'Sua sessão expirou. Entre novamente (em outra aba) e tente de novo.'
  if (status === 403) return 'Você não tem permissão para esta ação. Recarregue a página.'
  if (status === 422 && body?.message) return body.message
  return 'Não foi possível concluir agora. Tente novamente.'
}

const brl = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
const replaceAt = <T,>(list: readonly T[], index: number, value: T) => list.map((item, i) => (i === index ? value : item))
const removeAt = <T,>(list: readonly T[], index: number) => list.filter((_, i) => i !== index)

export function CourseWizard({ initial, professionals, permissions }: { initial?: Loaded; professionals: ProfessionalOption[]; permissions: readonly Permission[] }) {
  const [saved, setSaved] = useState<Loaded | undefined>(initial)
  const [data, setData] = useState<CourseData>(initial?.data ?? emptyCourseData)
  const [professionalId, setProfessionalId] = useState<number | ''>(initial?.professionalId ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(initial))
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showcase, setShowcase] = useState({ showcaseVisible: initial?.showcaseVisible ?? true, showcaseOrder: initial?.showcaseOrder ?? 0 })
  const c0 = initial?.commercial
  const [offer, setOffer] = useState({
    price: c0 ? centsToInput(c0.listCents) : '',
    discountPct: String(c0?.discountPct ?? 0),
    maxInstallments: String(c0?.maxInstallments ?? 1),
    checkoutUrl: c0?.checkoutUrl ?? '',
    environment: c0?.environment ?? 'production',
    active: c0?.active ?? false,
  })

  const canWrite = permissions.includes('courses.write')
  const canPublish = permissions.includes('courses.publish')
  const canCommerce = permissions.includes('commerce.manage')
  const set = <K extends keyof CourseData>(key: K, value: CourseData[K]) => setData((d) => ({ ...d, [key]: value }))
  const slugEditable = canWrite && (!saved || saved.status === 'draft')

  function fail(status: number, body: ApiError | null) {
    setErrors(fieldErrors(body?.errors))
    setMessage({ kind: 'error', text: describe(status, body) })
  }

  async function save(next?: number): Promise<boolean> {
    setMessage(null)
    if (!saved && professionalId === '') {
      setErrors({ professionalId: 'Escolha o profissional do curso' })
      setMessage({ kind: 'error', text: 'Escolha o profissional do curso.' })
      return false
    }
    const parsed = courseDataSchema.safeParse(data)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))))
      setMessage({ kind: 'error', text: 'Corrija os campos destacados.' })
      return false
    }
    setBusy(true)
    try {
      const res = saved
        ? await apiSend<Loaded>('PUT', `/admin/courses/${saved.id}`, { slug: slug !== saved.slug ? slug : undefined, data: parsed.data, revision: saved.revision })
        : await apiSend<Loaded>('POST', '/admin/courses', { professionalId, slug, data: parsed.data })
      if (!res.ok || !res.data) {
        fail(res.status, res.data as ApiError | null)
        return false
      }
      if (!saved) {
        window.location.assign(`/admin/cursos/${res.data.id}`)
        return true
      }
      setSaved(res.data)
      setErrors({})
      setMessage({ kind: 'ok', text: 'Alterações salvas.' })
      if (next !== undefined) setStep(next)
      return true
    } catch {
      setMessage({ kind: 'error', text: describe(0, null) })
      return false
    } finally {
      setBusy(false)
    }
  }

  async function saveOffer() {
    if (!saved) return
    setMessage(null)
    const listCents = parseBRLToCents(offer.price)
    if (listCents === null) {
      setErrors({ price: 'Informe um preço válido, como 250,00' })
      setMessage({ kind: 'error', text: 'Corrija os campos destacados.' })
      return
    }
    setBusy(true)
    try {
      const res = await apiSend<Loaded>('PUT', `/admin/courses/${saved.id}/commercial`, {
        listCents,
        discountPct: Number(offer.discountPct) || 0,
        maxInstallments: Number(offer.maxInstallments) || 1,
        checkoutUrl: offer.checkoutUrl.trim(),
        environment: offer.environment,
        active: offer.active,
        revision: saved.commercial?.revision ?? 0,
      })
      if (!res.ok || !res.data) {
        fail(res.status, res.data as ApiError | null)
        return
      }
      setSaved({ ...saved, ...res.data })
      setErrors({})
      setMessage({ kind: 'ok', text: 'Oferta salva. Ela só chega à página pública quando o curso for publicado.' })
    } catch {
      setMessage({ kind: 'error', text: describe(0, null) })
    } finally {
      setBusy(false)
    }
  }

  async function action(path: string, method: 'POST' | 'PUT' = 'POST', body?: unknown, okText = 'Concluído.') {
    if (!saved) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await apiSend<Loaded & ApiError>(method, `/admin/courses/${saved.id}${path}`, body)
      if (!res.ok || !res.data) {
        fail(res.status, res.data as ApiError | null)
        const issues = (res.data as ApiError | null)?.errors
        if (res.status === 422 && issues?.length) {
          setMessage({ kind: 'error', text: `Faltam informações: ${issues.map((i) => i.message).join('; ')}.` })
        }
        return
      }
      setSaved({ ...saved, ...res.data })
      setMessage({ kind: 'ok', text: okText })
    } catch {
      setMessage({ kind: 'error', text: describe(0, null) })
    } finally {
      setBusy(false)
    }
  }

  const issues = saved?.readiness ?? []
  const dirty = saved ? canonical(courseDataSchema.safeParse(data).data ?? data) !== canonical(saved.data) : false
  const previewOffer = (() => {
    const cents = parseBRLToCents(offer.price)
    if (cents === null || cents < 100) return null
    return computeOffer({ listCents: cents, discountPct: Math.min(90, Math.max(0, Number(offer.discountPct) || 0)), maxInstallments: Math.min(12, Math.max(1, Number(offer.maxInstallments) || 1)) })
  })()

  return (
    <div className="wizard">
      {saved && saved.documentRevision > 0 ? (
        <p role="note" className="ed-banner ed-banner-info">
          Esta página foi personalizada no editor visual: alterações feitas aqui no cadastro <strong>não alteram</strong> as seções já editadas
          (cursos publicados e vitrine continuam automáticos). Para voltar à página gerada pelo cadastro, use{' '}
          <a href={`/admin/editor/cursos/${saved.id}`}>«Restaurar do cadastro» no editor</a>.
        </p>
      ) : null}
      <ol className="wizard-steps" aria-label="Etapas do cadastro">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <button type="button" className="wizard-step" aria-current={i === step ? 'step' : undefined} disabled={!saved && i > 0} onClick={() => setStep(i)}>
              <span aria-hidden="true">{i + 1}</span> {s.label}
            </button>
          </li>
        ))}
      </ol>

      {message ? <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'form-error' : 'form-ok'}>{message.text}</p> : null}

      <section className="admin-card wizard-panel" aria-labelledby="wizard-title">
        <h2 id="wizard-title">{STEPS[step]!.label}</h2>

        {step === 0 ? (
          <div className="wizard-grid">
            <div>
              <label className="ds-label" htmlFor="professional">Profissional</label>
              <select id="professional" className="ds-input" value={professionalId} disabled={Boolean(saved) || !canWrite} aria-invalid={errors.professionalId ? true : undefined}
                onChange={(e) => setProfessionalId(e.target.value === '' ? '' : Number(e.target.value))}>
                <option value="">Selecione…</option>
                {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {errors.professionalId ? <p className="form-error">{errors.professionalId}</p> : null}
              {saved ? <p className="wizard-hint">O profissional não muda depois que o curso é criado.</p> : null}
            </div>
            <Field label="Título do curso" value={data.title} maxLength={80} disabled={!canWrite} error={errors.title}
              onChange={(e) => { set('title', e.target.value); if (!slugTouched) setSlug(suggestSlug(e.target.value)) }} />
            <Field label="Endereço da página (slug)" value={slug} maxLength={80} disabled={!slugEditable} error={errors.slug}
              onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()) }} />
            <p className="wizard-hint">A página ficará em <code>/cursos/{slug || '…'}</code>. O endereço não muda depois da primeira publicação.</p>
            <div>
              <label className="ds-label" htmlFor="modality">Formato</label>
              <select id="modality" className="ds-input" value={data.modality} disabled={!canWrite} onChange={(e) => set('modality', e.target.value as CourseData['modality'])}>
                {COURSE_MODALITIES.map((m) => <option key={m} value={m}>{COURSE_MODALITY_LABEL[m]}</option>)}
              </select>
            </div>
            <div>
              <label className="ds-label" htmlFor="level">Nível</label>
              <select id="level" className="ds-input" value={data.level} disabled={!canWrite} onChange={(e) => set('level', e.target.value as CourseData['level'])}>
                {COURSE_LEVELS.map((l) => <option key={l} value={l}>{COURSE_LEVEL_LABEL[l]}</option>)}
              </select>
            </div>
            <Field label="Carga horária em horas (opcional)" type="number" min={1} max={2000} inputMode="numeric" value={data.workloadHours ?? ''} disabled={!canWrite} error={errors.workloadHours}
              onChange={(e) => set('workloadHours', e.target.value === '' ? null : Number(e.target.value))} />
            <Field label="Para quem é o curso" value={data.audience} maxLength={80} placeholder="Cabeleireiros e coloristas" disabled={!canWrite} error={errors.audience} onChange={(e) => set('audience', e.target.value)} />
          </div>
        ) : null}

        {step === 1 ? (
          <div className="wizard-grid">
            <TextArea label="Descrição do curso" value={data.lead} maxLength={400} rows={3} disabled={!canWrite} error={errors.lead} onChange={(e) => set('lead', e.target.value)} />
            <p className="wizard-hint">Escolha a capa na biblioteca de mídia (botão “Biblioteca”, que também envia arquivos novos). Caminhos do site (<code>/site/…</code>) continuam valendo.</p>
            <MediaInput label="Imagem de capa" kind="image" value={data.coverSrc} disabled={!canWrite} error={errors.coverSrc} onChange={(v) => set('coverSrc', v)} />
            <Field label="Descrição da capa (texto alternativo)" value={data.coverAlt} maxLength={300} disabled={!canWrite} error={errors.coverAlt} onChange={(e) => set('coverAlt', e.target.value)} />

            <fieldset className="wizard-fieldset">
              <legend>Benefícios (até 4)</legend>
              {data.benefits.map((b, i) => (
                <div key={i} className="wizard-row">
                  <Field label={`Benefício ${i + 1} · título`} value={b.title} maxLength={60} disabled={!canWrite} error={errors[`benefits.${i}.title`]} onChange={(e) => set('benefits', replaceAt(data.benefits, i, { ...b, title: e.target.value }))} />
                  <Field label="Texto" value={b.text} maxLength={200} disabled={!canWrite} error={errors[`benefits.${i}.text`]} onChange={(e) => set('benefits', replaceAt(data.benefits, i, { ...b, text: e.target.value }))} />
                  {canWrite ? <Button variant="secondary" onClick={() => set('benefits', removeAt(data.benefits, i))}>Remover benefício {i + 1}</Button> : null}
                </div>
              ))}
              {canWrite && data.benefits.length < 4 ? <Button variant="secondary" onClick={() => set('benefits', [...data.benefits, { title: '', text: '' }])}>Adicionar benefício</Button> : null}
            </fieldset>

            <fieldset className="wizard-fieldset">
              <legend>Módulos do conteúdo (até 12)</legend>
              {data.modules.map((m, i) => (
                <div key={i} className="wizard-row">
                  <Field label={`Módulo ${i + 1} · título`} value={m.title} maxLength={120} disabled={!canWrite} error={errors[`modules.${i}.title`]} onChange={(e) => set('modules', replaceAt(data.modules, i, { ...m, title: e.target.value }))} />
                  <TextArea label="Descrição" value={m.text} maxLength={600} rows={2} disabled={!canWrite} error={errors[`modules.${i}.text`]} onChange={(e) => set('modules', replaceAt(data.modules, i, { ...m, text: e.target.value }))} />
                  <TextArea key={m.bullets.join('\n')} label="Tópicos (um por linha, até 6)" defaultValue={m.bullets.join('\n')} rows={3} disabled={!canWrite} onBlur={(e) => set('modules', replaceAt(data.modules, i, { ...m, bullets: emptyLines(e.target.value).slice(0, 6) }))} />
                  {canWrite ? <Button variant="secondary" onClick={() => set('modules', removeAt(data.modules, i))}>Remover módulo {i + 1}</Button> : null}
                </div>
              ))}
              {canWrite && data.modules.length < 12 ? <Button variant="secondary" onClick={() => set('modules', [...data.modules, { title: '', text: '', bullets: [] }])}>Adicionar módulo</Button> : null}
            </fieldset>

            <fieldset className="wizard-fieldset">
              <legend>O que o aluno recebe (até 8)</legend>
              {data.deliverables.map((d, i) => (
                <div key={i} className="wizard-row">
                  <Field label={`Item ${i + 1} · título`} value={d.title} maxLength={100} disabled={!canWrite} error={errors[`deliverables.${i}.title`]} onChange={(e) => set('deliverables', replaceAt(data.deliverables, i, { ...d, title: e.target.value }))} />
                  <Field label="Texto" value={d.text} maxLength={200} disabled={!canWrite} error={errors[`deliverables.${i}.text`]} onChange={(e) => set('deliverables', replaceAt(data.deliverables, i, { ...d, text: e.target.value }))} />
                  {canWrite ? <Button variant="secondary" onClick={() => set('deliverables', removeAt(data.deliverables, i))}>Remover item {i + 1}</Button> : null}
                </div>
              ))}
              {canWrite && data.deliverables.length < 8 ? <Button variant="secondary" onClick={() => set('deliverables', [...data.deliverables, { title: '', text: '' }])}>Adicionar item</Button> : null}
            </fieldset>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="wizard-grid">
            <p className="wizard-hint">Estas seções só aparecem na página quando preenchidas. Cadastre somente o que a Academia de fato oferece.</p>
            <Field label="Dias de garantia (vazio = sem garantia)" type="number" min={1} max={90} inputMode="numeric" value={data.guaranteeDays ?? ''} disabled={!canWrite} error={errors.guaranteeDays}
              onChange={(e) => set('guaranteeDays', e.target.value === '' ? null : Number(e.target.value))} />
            <fieldset className="wizard-fieldset">
              <legend>Perguntas frequentes (até 10)</legend>
              {data.faq.map((q, i) => (
                <div key={i} className="wizard-row">
                  <Field label={`Pergunta ${i + 1}`} value={q.title} maxLength={160} disabled={!canWrite} error={errors[`faq.${i}.title`]} onChange={(e) => set('faq', replaceAt(data.faq, i, { ...q, title: e.target.value }))} />
                  <TextArea label="Resposta" value={q.text} maxLength={800} rows={3} disabled={!canWrite} error={errors[`faq.${i}.text`]} onChange={(e) => set('faq', replaceAt(data.faq, i, { ...q, text: e.target.value }))} />
                  {canWrite ? <Button variant="secondary" onClick={() => set('faq', removeAt(data.faq, i))}>Remover pergunta {i + 1}</Button> : null}
                </div>
              ))}
              {canWrite && data.faq.length < 10 ? <Button variant="secondary" onClick={() => set('faq', [...data.faq, { title: '', text: '' }])}>Adicionar pergunta</Button> : null}
            </fieldset>
            <fieldset className="wizard-fieldset">
              <legend>Depoimentos reais (até 6)</legend>
              {data.testimonials.map((t, i) => (
                <div key={i} className="wizard-row">
                  <TextArea label={`Depoimento ${i + 1}`} value={t.quote} maxLength={300} rows={2} disabled={!canWrite} error={errors[`testimonials.${i}.quote`]} onChange={(e) => set('testimonials', replaceAt(data.testimonials, i, { ...t, quote: e.target.value }))} />
                  <Field label="Nome" value={t.name} maxLength={60} disabled={!canWrite} error={errors[`testimonials.${i}.name`]} onChange={(e) => set('testimonials', replaceAt(data.testimonials, i, { ...t, name: e.target.value }))} />
                  <Field label="Profissão" value={t.role} maxLength={60} disabled={!canWrite} onChange={(e) => set('testimonials', replaceAt(data.testimonials, i, { ...t, role: e.target.value }))} />
                  {canWrite ? <Button variant="secondary" onClick={() => set('testimonials', removeAt(data.testimonials, i))}>Remover depoimento {i + 1}</Button> : null}
                </div>
              ))}
              {canWrite && data.testimonials.length < 6 ? <Button variant="secondary" onClick={() => set('testimonials', [...data.testimonials, { quote: '', name: '', role: '' }])}>Adicionar depoimento</Button> : null}
            </fieldset>
            <TextArea label="Descrição para buscadores (opcional)" value={data.metaDescription} maxLength={200} rows={2} disabled={!canWrite} error={errors.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="wizard-grid">
            {!canCommerce ? (
              <p className="wizard-hint" role="note">Somente quem gerencia o comércio altera preço e link de checkout. Você vê a oferta atual abaixo.</p>
            ) : (
              <p className="wizard-hint">A compra acontece na página do provedor (redirecionamento). O preço é sempre o definido aqui, nunca o que o navegador envia.</p>
            )}
            <Field label="Preço de tabela (R$)" inputMode="decimal" value={offer.price} placeholder="250,00" disabled={!canCommerce} error={errors.price ?? errors.listCents} onChange={(e) => setOffer((o) => ({ ...o, price: e.target.value }))} />
            <Field label="Desconto (%)" type="number" min={0} max={90} inputMode="numeric" value={offer.discountPct} disabled={!canCommerce} error={errors.discountPct} onChange={(e) => setOffer((o) => ({ ...o, discountPct: e.target.value }))} />
            <div>
              <label className="ds-label" htmlFor="installments">Parcelas máximas (sem juros, exibição)</label>
              <select id="installments" className="ds-input" value={offer.maxInstallments} disabled={!canCommerce} onChange={(e) => setOffer((o) => ({ ...o, maxInstallments: e.target.value }))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}x</option>)}
              </select>
            </div>
            <Field label="Link do checkout (https)" type="url" value={offer.checkoutUrl} placeholder="https://…" disabled={!canCommerce} error={errors.checkoutUrl} onChange={(e) => setOffer((o) => ({ ...o, checkoutUrl: e.target.value }))} />
            <p className="wizard-hint">Só aceita domínios autorizados no ambiente. Domínio fora da lista é recusado ao salvar.</p>
            <div>
              <label className="ds-label" htmlFor="environment">Ambiente</label>
              <select id="environment" className="ds-input" value={offer.environment} disabled={!canCommerce} onChange={(e) => setOffer((o) => ({ ...o, environment: e.target.value as 'production' | 'sandbox' }))}>
                <option value="production">Produção</option>
                <option value="sandbox">Teste (sandbox)</option>
              </select>
            </div>
            <label className="wizard-check"><input type="checkbox" checked={offer.active} disabled={!canCommerce} onChange={(e) => setOffer((o) => ({ ...o, active: e.target.checked }))} /> Oferta ativa (permite publicar o curso)</label>
            {previewOffer ? (
              <p className="wizard-hint" role="status">
                Prévia: de {brl(previewOffer.listCents)} por <strong>{brl(previewOffer.totalCents)}</strong>
                {previewOffer.discountPct > 0 ? ` (${previewOffer.discountPct}% de desconto)` : ''}
                {previewOffer.installments.length > 1 ? `, até ${previewOffer.installments.at(-1)!.count}x de ${brl(previewOffer.installments.at(-1)!.amountCents)}` : ', à vista'}. O servidor recalcula este valor.
              </p>
            ) : null}
            {saved?.commercial ? <p className="wizard-hint">Revisão da oferta: {saved.commercial.revision}.</p> : null}
            {canCommerce ? <Button disabled={busy || !saved} onClick={saveOffer}>Salvar oferta</Button> : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="wizard-grid">
            {!saved ? <p>Salve o curso antes de publicar.</p> : (
              <>
                <p>
                  Situação: <strong>{({ draft: 'Rascunho', published: 'Publicado', archived: 'Arquivado' } as const)[saved.status]}</strong>
                  {saved.publishedVersion ? ` · versão ${saved.publishedVersion}` : ''}
                  {saved.hasUnpublishedChanges ? ' · há alterações não publicadas (conteúdo ou oferta)' : ''}
                </p>
                <p>Profissional: <strong>{saved.professionalName}</strong></p>
                {issues.length ? (
                  <div role="status">
                    <p>Pendências para publicar:</p>
                    <ul>
                      {groupIssuesByStep(issues).map((i) => (
                        <li key={`${i.field}-${i.message}`}>{i.message}{i.field === 'professionalId' ? '' : <> — <button type="button" className="link-button" onClick={() => setStep(i.step)}>ir para a etapa</button></>}</li>
                      ))}
                    </ul>
                  </div>
                ) : <p className="form-ok">Curso completo: pronto para publicar.</p>}

                {dirty ? <p role="status" className="form-error">Há alterações não salvas. Salve antes de pré-visualizar ou publicar.</p> : null}
                <p><a href={`/admin/preview/cursos/${saved.id}`} target="_blank" rel="noreferrer">Abrir pré-visualização do rascunho (nova aba)</a></p>
                <p><a href={`/admin/editor/cursos/${saved.id}`}>Abrir editor visual (personalizar seções, ordem e textos)</a></p>

                {canPublish ? (
                  <fieldset className="wizard-fieldset">
                    <legend>Vitrine na página do profissional</legend>
                    <label className="wizard-check"><input type="checkbox" checked={showcase.showcaseVisible} onChange={(e) => setShowcase((s) => ({ ...s, showcaseVisible: e.target.checked }))} /> Exibir na página do profissional quando publicado</label>
                    <Field label="Posição (menor aparece primeiro)" type="number" min={0} max={9999} value={showcase.showcaseOrder} onChange={(e) => setShowcase((s) => ({ ...s, showcaseOrder: Number(e.target.value) || 0 }))} />
                    <Button variant="secondary" disabled={busy || saved.status === 'archived'} onClick={() => action('/showcase', 'PUT', { ...showcase, featured: saved.featured }, 'Vitrine atualizada.')}>Salvar vitrine</Button>
                  </fieldset>
                ) : null}

                {canPublish ? (
                  <div className="wizard-actions">
                    {saved.status !== 'archived' ? (
                      <Button disabled={busy || dirty || issues.length > 0 || (saved.status === 'published' && !saved.hasUnpublishedChanges)} onClick={() => action('/publish', 'POST', undefined, 'Publicado. A página pública já foi atualizada.')}>
                        {saved.status === 'published' ? 'Publicar alterações' : 'Publicar'}
                      </Button>
                    ) : null}
                    {saved.status === 'published' ? <Button variant="secondary" disabled={busy} onClick={() => action('/unpublish', 'POST', undefined, 'Curso tirado do ar.')}>Despublicar</Button> : null}
                    {saved.status !== 'archived' ? <Button variant="secondary" disabled={busy} onClick={() => { if (window.confirm('Arquivar tira o curso do ar e do site. Continuar?')) void action('/archive', 'POST', undefined, 'Curso arquivado.') }}>Arquivar</Button> : <Button variant="secondary" disabled={busy} onClick={() => action('/restore', 'POST', undefined, 'Curso restaurado como rascunho.')}>Restaurar</Button>}
                  </div>
                ) : <p>Você pode editar, mas não publicar.</p>}
              </>
            )}
          </div>
        ) : null}

        <div className="wizard-nav">
          {step > 0 ? <Button variant="secondary" disabled={busy} onClick={() => setStep(step - 1)}>Voltar</Button> : <span />}
          {canWrite && step < 3 ? (
            <div className="wizard-actions">
              <Button variant="secondary" disabled={busy} onClick={() => save()}>{saved ? 'Salvar' : 'Criar rascunho'}</Button>
              {saved ? <Button disabled={busy} onClick={() => save(step + 1)}>Salvar e continuar</Button> : null}
            </div>
          ) : null}
          {step === 3 ? <Button variant="secondary" disabled={busy} onClick={() => setStep(4)}>Continuar</Button> : null}
        </div>
      </section>
    </div>
  )
}
