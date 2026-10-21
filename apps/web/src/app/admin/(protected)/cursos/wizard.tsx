'use client'

import { useConfirm } from '@/components/confirm-dialog'
import { useState } from 'react'
import {
  COURSE_LEVELS,
  COURSE_LEVEL_LABEL,
  COURSE_MODALITIES,
  COURSE_MODALITY_LABEL,
  courseDataSchema,
  type AdminCourse,
  type CourseData,
  type Permission,
  type ReadinessIssue,
} from '@academia/contracts'
import { Button, Field, TextArea } from '@academia/design-system'
import { apiSend } from '@/lib/api-client'
import { describeApiError, type ApiErrorBody } from '@/lib/api-errors'
import { brl } from '@/lib/format'
import { PriceFields } from '@/components/price-fields'
import { initialPriceForm, priceDirty, priceResult } from '@/lib/price-form'
import { mediaSrc } from '@academia/page-renderer'
import { ActionCard, AddButton, Ico, InfoCard, IssueRow, NumberedSection, Notice, PanelHead, PublishingOverlay, PendingBanner, RemoveButton, SelectField, SummaryRow, WizardIcon, WizardSteps } from '@/components/wizard-ui'
import { ImageField } from '@/components/image-field'
import { CoursePaymentsPanel } from '@/components/course-payments'
import { canonical, emptyCourseData, emptyLines, fieldErrors, groupIssuesByStep, STEPS, suggestSlug } from './form-model'

/** Oferta de teste (sandbox) só existe fora de produção; a API também recusa em produção. */
const SANDBOX_ALLOWED = process.env.NODE_ENV !== 'production'

type Loaded = AdminCourse & { readiness: ReadinessIssue[] }
type ApiError = ApiErrorBody
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
  const known = body?.code ? MESSAGES[body.code] : undefined
  const extra = body?.code === 'checkout_url_invalid' && body.message ? ` ${body.message}.` : ''
  return describeApiError(status, body, known ? `${known}${extra}` : null)
}

const replaceAt = <T,>(list: readonly T[], index: number, value: T) => list.map((item, i) => (i === index ? value : item))
const removeAt = <T,>(list: readonly T[], index: number) => list.filter((_, i) => i !== index)

/** Título e ícone de cada pendência de publicação (o texto da pendência vem do servidor). */
const ISSUE_META: Record<string, { title: string; icon: React.ReactNode }> = {
  title: { title: 'Título do curso', icon: Ico.type },
  lead: { title: 'Descrição do curso', icon: Ico.doc },
  audience: { title: 'Público-alvo', icon: Ico.users },
  coverSrc: { title: 'Imagem de capa', icon: Ico.image },
  coverAlt: { title: 'Capa (texto alternativo)', icon: Ico.doc },
  benefits: { title: 'Benefício', icon: Ico.star },
  modules: { title: 'Módulo do conteúdo', icon: Ico.play },
  deliverables: { title: 'O que o aluno recebe', icon: Ico.cap },
  commercial: { title: 'Oferta e checkout', icon: Ico.cart },
  checkoutUrl: { title: 'Link de checkout', icon: Ico.link },
  active: { title: 'Oferta ativa', icon: Ico.cart },
  professionalId: { title: 'Profissional', icon: Ico.person },
}

const STEP_ICONS = [WizardIcon.book, WizardIcon.list, WizardIcon.shield, WizardIcon.tag, WizardIcon.check]

export function CourseWizard({ initial, professionals, permissions, initialStep = 0, showPending = false }: { initial?: Loaded; professionals: ProfessionalOption[]; permissions: readonly Permission[]; initialStep?: number; showPending?: boolean }) {
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [saved, setSaved] = useState<Loaded | undefined>(initial)
  const [data, setData] = useState<CourseData>(initial?.data ?? emptyCourseData)
  const [professionalId, setProfessionalId] = useState<number | ''>(initial?.professionalId ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(initial))
  const [step, setStep] = useState(initial ? Math.min(Math.max(initialStep, 0), STEPS.length - 1) : 0)
  const [busy, setBusy] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [justPublished, setJustPublished] = useState(false)
  const [hidePending, setHidePending] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showcase, setShowcase] = useState({ showcaseVisible: initial?.showcaseVisible ?? true, showcaseOrder: initial?.showcaseOrder ?? 0 })
  const c0 = initial?.commercial
  const [priceForm, setPriceForm] = useState(initialPriceForm(c0))
  const [offer, setOffer] = useState({
    maxInstallments: String(c0?.maxInstallments ?? 1),
    checkoutUrl: c0?.checkoutUrl ?? '',
    provider: (c0?.provider ?? 'academia') as 'academia' | 'themembers',
    externalCourseId: c0?.externalCourseId ?? '',
    environment: SANDBOX_ALLOWED ? (c0?.environment ?? 'production') : 'production',
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

  async function saveOffer(next?: number): Promise<boolean> {
    if (!saved) return false
    setMessage(null)
    const price = priceResult(priceForm, Number(offer.maxInstallments) || 1)
    if (!price.ok) {
      setErrors({})
      setMessage({ kind: 'error', text: 'Corrija os campos de preço destacados.' })
      return false
    }
    setBusy(true)
    try {
      const res = await apiSend<Loaded>('PUT', `/admin/courses/${saved.id}/commercial`, {
        ...price.value,
        maxInstallments: Number(offer.maxInstallments) || 1,
        checkoutUrl: offer.checkoutUrl.trim(),
        provider: offer.provider,
        externalCourseId: offer.externalCourseId.trim(),
        environment: offer.environment,
        active: offer.active,
        revision: saved.commercial?.revision ?? 0,
      })
      if (!res.ok || !res.data) {
        fail(res.status, res.data as ApiError | null)
        return false
      }
      setSaved({ ...saved, ...res.data })
      setErrors({})
      setMessage({ kind: 'ok', text: 'Oferta salva. Ela só chega à página pública quando o curso for publicado.' })
      if (next !== undefined) setStep(next)
      return true
    } catch {
      setMessage({ kind: 'error', text: describe(0, null) })
      return false
    } finally {
      setBusy(false)
    }
  }

  async function action(path: string, method: 'POST' | 'PUT' = 'POST', body?: unknown, okText = 'Concluído.') {
    if (!saved) return
    const isPublish = path === '/publish'
    setBusy(true)
    setMessage(null)
    setJustPublished(false)
    if (isPublish) { setHidePending(true); setPublishing(true) }
    const minWait = isPublish ? new Promise((r) => setTimeout(r, 900)) : null
    try {
      const res = await apiSend<Loaded & ApiError>(method, `/admin/courses/${saved.id}${path}`, body)
      await minWait
      if (!res.ok || !res.data) {
        fail(res.status, res.data as ApiError | null)
        const issues = (res.data as ApiError | null)?.errors
        if (res.status === 422 && issues?.length) {
          setMessage({ kind: 'error', text: `Faltam informações: ${issues.map((i) => i.message).join('; ')}.` })
        }
        return
      }
      setSaved({ ...saved, ...res.data })
      if (isPublish) setJustPublished(true)
      else setMessage({ kind: 'ok', text: okText })
    } catch {
      setMessage({ kind: 'error', text: describe(0, null) })
    } finally {
      setBusy(false)
      setPublishing(false)
    }
  }

  const issues = saved?.readiness ?? []
  const goToStep = (i: number) => { setStep(i); document.getElementById('wizard-title')?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }
  const c = saved?.commercial
  const offerDirty = canCommerce && Boolean(saved) && (c
    ? priceDirty(priceForm, c, Number(offer.maxInstallments) || 1) || Number(offer.maxInstallments) !== c.maxInstallments
      || offer.checkoutUrl.trim() !== c.checkoutUrl || offer.provider !== c.provider || offer.externalCourseId.trim() !== c.externalCourseId
      || offer.environment !== c.environment || offer.active !== c.active
    : priceDirty(priceForm, null))
  const dirty = saved ? canonical(courseDataSchema.safeParse(data).data ?? data) !== canonical(saved.data) : false
  const priceCalc = priceResult(priceForm, Math.min(12, Math.max(1, Number(offer.maxInstallments) || 1)))
  const previewOffer = priceCalc.ok ? priceCalc.offer : null

  return (
    <div className="wizard">
      {confirmDialog}
      {saved && saved.documentRevision > 0 ? (
        <Notice tone="info" title="Esta página foi personalizada no editor visual">
          As alterações feitas aqui no cadastro não alteram as seções já editadas (cursos publicados e vitrine continuam automáticos).
          Para voltar à página gerada pelo cadastro, use <a href={`/admin/editor/cursos/${saved.id}`}>Restaurar do cadastro</a> no editor.
        </Notice>
      ) : null}
      {showPending && !hidePending && saved ? <PendingBanner issues={groupIssuesByStep(issues)} stepLabels={STEPS.map((x) => x.label)} onGo={goToStep} /> : null}
      <WizardSteps steps={STEPS} step={step} onSelect={setStep} isDisabled={(i) => !saved && i > 0} />

      {publishing ? <PublishingOverlay title="Publicando…" hint="Estamos atualizando a página pública. Isso leva só um instante." /> : null}
      {justPublished ? <Notice tone="success" title="Publicado com sucesso">A página pública já foi atualizada.</Notice> : null}
      {message ? <p role={message.kind === 'error' ? 'alert' : 'status'} className={`wz-msg ${message.kind === 'error' ? 'form-error' : 'form-ok'}`}>{message.kind === 'error' ? (message.text.startsWith('Sem conexão') ? Ico.wifiOff : Ico.alert) : WizardIcon.check}{message.text}</p> : null}

      <section className="admin-card wizard-panel" aria-labelledby="wizard-title">
        <PanelHead icon={STEP_ICONS[step]} title={STEPS[step]!.label} desc={STEPS[step]!.desc} accent={step === 2} aside={step === 2 ? <InfoCard title="Estas seções só aparecem na página quando preenchidas.">Cadastre somente o que a Academia de fato oferece.</InfoCard> : undefined} />

        {step === 0 ? (
          <div className="wizard-grid wizard-grid--wide">
            <SelectField label="Profissional" requiredMark icon={WizardIcon.person} id="professional" value={professionalId} disabled={Boolean(saved) || !canWrite} error={errors.professionalId}
              hint={saved ? 'O profissional não muda depois que o curso é criado.' : undefined}
              onChange={(e) => setProfessionalId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">Selecione…</option>
              {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </SelectField>
            <SelectField label="Formato" requiredMark icon={WizardIcon.monitor} id="modality" value={data.modality} disabled={!canWrite} onChange={(e) => set('modality', e.target.value as CourseData['modality'])}>
              {COURSE_MODALITIES.map((m) => <option key={m} value={m}>{COURSE_MODALITY_LABEL[m]}</option>)}
            </SelectField>
            <Field label="Título do curso" requiredMark icon={WizardIcon.type} value={data.title} maxLength={80} disabled={!canWrite} error={errors.title}
              onChange={(e) => { set('title', e.target.value); if (!slugTouched) setSlug(suggestSlug(e.target.value)) }} />
            <SelectField label="Nível" requiredMark icon={WizardIcon.chart} id="level" value={data.level} disabled={!canWrite} onChange={(e) => set('level', e.target.value as CourseData['level'])}>
              {COURSE_LEVELS.map((l) => <option key={l} value={l}>{COURSE_LEVEL_LABEL[l]}</option>)}
            </SelectField>
            <div className="wizard-full">
              <Field label="Endereço da página (slug)" requiredMark prefix="/cursos/" suffix={WizardIcon.link} value={slug} maxLength={80} disabled={!slugEditable} error={errors.slug}
                hint={<>A página ficará em <code>/cursos/{slug || '…'}</code>. O endereço não muda depois da primeira publicação.</>}
                onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()) }} />
            </div>
            <div className="wizard-full">
              <Field label={<>Carga horária em horas <span className="wz-optional">(opcional)</span></>} icon={WizardIcon.clock} type="number" min={1} max={2000} inputMode="numeric" placeholder="Ex.: 10" value={data.workloadHours ?? ''} disabled={!canWrite} error={errors.workloadHours}
                onChange={(e) => set('workloadHours', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
            <div className="wizard-full">
              <TextArea label="Para quem é o curso" icon={WizardIcon.users} rows={2} value={data.audience} maxLength={80} placeholder="Cabeleireiros e coloristas" disabled={!canWrite} error={errors.audience}
                hint="Descreva o público-alvo do seu curso." onChange={(e) => set('audience', e.target.value)} />
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="wizard-grid">
            <TextArea label="Descrição do curso" value={data.lead} maxLength={400} rows={3} disabled={!canWrite} error={errors.lead} onChange={(e) => set('lead', e.target.value)} />
            <p className="wizard-hint">Clique em “Editar” para trocar a capa: arraste o arquivo ou selecione do computador. Também dá para escolher um arquivo já enviado na biblioteca de mídia.</p>
            <ImageField label="Imagem de capa" kind="image" value={data.coverSrc} disabled={!canWrite} error={errors.coverSrc} onChange={(v) => set('coverSrc', v)} />
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
          <div className="wz-sections">
            <NumberedSection n={1} title="Garantia" desc="Informe quantos dias de garantia o aluno terá para solicitar reembolso."
              aside={<InfoCard icon={Ico.shield} title="Como funciona?">Este texto será exibido na página do curso.</InfoCard>}>
              <Field label="Dias de garantia (vazio = sem garantia)" icon={Ico.calendar} type="number" min={1} max={90} inputMode="numeric" placeholder="Ex.: 7, 15, 30" value={data.guaranteeDays ?? ''} disabled={!canWrite} error={errors.guaranteeDays}
                onChange={(e) => set('guaranteeDays', e.target.value === '' ? null : Number(e.target.value))} />
            </NumberedSection>

            <NumberedSection n={2} boxed title="Perguntas frequentes" accent="(até 10)" desc="Adicione as principais dúvidas sobre o curso e suas respostas.">
              {data.faq.map((q, i) => (
                <div key={i} className="wz-item">
                  <div className="wz-item-fields">
                    <Field label="Pergunta" icon={Ico.help} placeholder="Digite a pergunta" value={q.title} maxLength={160} disabled={!canWrite} error={errors[`faq.${i}.title`]} onChange={(e) => set('faq', replaceAt(data.faq, i, { ...q, title: e.target.value }))} />
                    <TextArea label="Resposta" icon={Ico.doc} placeholder="Digite a resposta" value={q.text} maxLength={800} rows={3} disabled={!canWrite} error={errors[`faq.${i}.text`]} onChange={(e) => set('faq', replaceAt(data.faq, i, { ...q, text: e.target.value }))} />
                  </div>
                  {canWrite ? <RemoveButton label={`Remover pergunta ${i + 1}`} onClick={() => set('faq', removeAt(data.faq, i))} /> : null}
                </div>
              ))}
              {canWrite ? (
                <div className="wz-add-row">
                  <AddButton disabled={data.faq.length >= 10} onClick={() => set('faq', [...data.faq, { title: '', text: '' }])}>Adicionar pergunta</AddButton>
                  <span>{data.faq.length} de 10 perguntas adicionadas</span>
                </div>
              ) : null}
            </NumberedSection>

            <NumberedSection n={3} boxed title="Depoimentos reais" accent="(até 6)" desc="Adicione depoimentos de alunos para gerar mais credibilidade.">
              {data.testimonials.map((t, i) => (
                <div key={i} className="wz-item">
                  <div className="wz-item-fields">
                    <TextArea label="Depoimento" icon={Ico.doc} value={t.quote} maxLength={300} rows={2} disabled={!canWrite} error={errors[`testimonials.${i}.quote`]} onChange={(e) => set('testimonials', replaceAt(data.testimonials, i, { ...t, quote: e.target.value }))} />
                    <div className="wz-two">
                      <Field label="Nome" icon={Ico.person} value={t.name} maxLength={60} disabled={!canWrite} error={errors[`testimonials.${i}.name`]} onChange={(e) => set('testimonials', replaceAt(data.testimonials, i, { ...t, name: e.target.value }))} />
                      <Field label="Profissão" icon={Ico.users} value={t.role} maxLength={60} disabled={!canWrite} onChange={(e) => set('testimonials', replaceAt(data.testimonials, i, { ...t, role: e.target.value }))} />
                    </div>
                  </div>
                  {canWrite ? <RemoveButton label={`Remover depoimento ${i + 1}`} onClick={() => set('testimonials', removeAt(data.testimonials, i))} /> : null}
                </div>
              ))}
              {canWrite ? <AddButton wide disabled={data.testimonials.length >= 6} onClick={() => set('testimonials', [...data.testimonials, { quote: '', name: '', role: '' }])}>Adicionar depoimento</AddButton> : null}
            </NumberedSection>

            <NumberedSection n={4} title="Descrição para buscadores" accent="(opcional)" desc="Texto curto usado por Google e redes sociais ao compartilhar o curso.">
              <TextArea label="Descrição" icon={Ico.doc} value={data.metaDescription} maxLength={200} rows={2} disabled={!canWrite} error={errors.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} />
            </NumberedSection>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="wizard-grid">
            {!canCommerce ? (
              <p className="wizard-hint" role="note">Somente quem gerencia o comércio altera preço e link de checkout. Você vê a oferta atual abaixo.</p>
            ) : (
              <p className="wizard-hint">{offer.provider === 'themembers' ? 'A compra acontece dentro da página, no checkout da The Members (iframe); o formulário da Academia fica desabilitado.' : 'A compra acontece na página do provedor (redirecionamento) depois do formulário da Academia.'} O preço exibido é sempre o definido aqui, nunca o que o navegador envia.</p>
            )}
            <div>
              <label className="ds-label" htmlFor="provider">Checkout</label>
              <select id="provider" className="ds-input" value={offer.provider} disabled={!canCommerce} onChange={(e) => setOffer((o) => ({ ...o, provider: e.target.value as 'academia' | 'themembers' }))}>
                <option value="academia">Academia (formulário da página + redirecionamento)</option>
                <option value="themembers">The Members (embutido na página)</option>
              </select>
            </div>
            <PriceFields name="price" form={priceForm} onChange={setPriceForm} disabled={!canCommerce} errors={{ list: errors.listCents ?? errors.price, final: errors.finalCents, pct: errors.discountPct }} maxInstallments={Number(offer.maxInstallments) || 1} />
            <div>
              <label className="ds-label" htmlFor="installments">Parcelas máximas (sem juros, exibição)</label>
              <select id="installments" className="ds-input" value={offer.maxInstallments} disabled={!canCommerce} onChange={(e) => setOffer((o) => ({ ...o, maxInstallments: e.target.value }))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}x</option>)}
              </select>
            </div>
            <Field label={offer.provider === 'themembers' ? 'URL do checkout da The Members (https)' : 'Link do checkout (https)'} type="url" value={offer.checkoutUrl} placeholder="https://…" disabled={!canCommerce} error={errors.checkoutUrl} onChange={(e) => setOffer((o) => ({ ...o, checkoutUrl: e.target.value }))} />
            <p className="wizard-hint">Só aceita domínios autorizados no ambiente. Domínio fora da lista é recusado ao salvar.</p>
            <Field label="ID do curso na The Members" value={offer.externalCourseId} placeholder="Ex.: 12345" disabled={!canCommerce} error={errors.externalCourseId} onChange={(e) => setOffer((o) => ({ ...o, externalCourseId: e.target.value }))} />
            <div>
              <label className="ds-label" htmlFor="environment">Ambiente</label>
              <select id="environment" className="ds-input" value={offer.environment} disabled={!canCommerce} onChange={(e) => setOffer((o) => ({ ...o, environment: e.target.value as 'production' | 'sandbox' }))}>
                <option value="production">Produção</option>
                {SANDBOX_ALLOWED ? <option value="sandbox">Teste (sandbox)</option> : null}
              </select>
            </div>
            <label className="wizard-check"><input type="checkbox" checked={offer.active} disabled={!canCommerce} onChange={(e) => setOffer((o) => ({ ...o, active: e.target.checked }))} /> Oferta ativa (permite publicar o curso)</label>
            {previewOffer ? (
              <p className="wizard-hint" role="status">
                Valor final: <strong>{brl(previewOffer.totalCents)}</strong>
                {previewOffer.discountPct > 0 ? ` (de ${brl(previewOffer.listCents)}, ${previewOffer.discountPct}% de desconto)` : ''}
                {previewOffer.installments.length > 1 ? `, até ${previewOffer.installments.at(-1)!.count}x de ${brl(previewOffer.installments.at(-1)!.amountCents)}` : ', à vista'}. O servidor recalcula este valor.
              </p>
            ) : null}
            {saved?.commercial ? <p className="wizard-hint">Revisão da oferta: {saved.commercial.revision}.</p> : null}
            {canCommerce ? <Button disabled={busy || !saved} onClick={() => saveOffer()}>Salvar oferta</Button> : null}
            {canCommerce && saved ? <CoursePaymentsPanel courseId={saved.id} externalCourseId={saved.commercial?.externalCourseId ?? ''} /> : null}
          </div>
        ) : null}

        {step === 4 ? (
          !saved ? <p>Salve o curso antes de publicar.</p> : (
            <div className="wz-review">
              <div className="wz-review-grid">
                <aside className="wz-card wz-summary" aria-label="Resumo do curso">
                  <h3>Resumo do curso</h3>
                  {data.coverSrc ? (
                    <div className="wz-cover">
                      <img src={mediaSrc(data.coverSrc, 640)} alt="" loading="lazy" />
                      <span className="wz-cover-badge">{Ico.monitor}{COURSE_MODALITY_LABEL[data.modality]}</span>
                    </div>
                  ) : null}
                  <SummaryRow icon={Ico.type} label="Título" value={data.title} />
                  <SummaryRow icon={Ico.link} label="Endereço (slug)" value={saved.slug} />
                  <SummaryRow icon={Ico.person} label="Profissional" value={saved.professionalName} />
                  <SummaryRow icon={Ico.chart} label="Nível" value={COURSE_LEVEL_LABEL[data.level]} />
                  <SummaryRow icon={Ico.monitor} label="Formato" value={COURSE_MODALITY_LABEL[data.modality]} />
                </aside>

                <section className="wz-card wz-issues" aria-label="Pendências para publicar">
                  <div className="wz-issues-head">
                    <div>
                      <h3>Pendências para publicar</h3>
                      <p>Verifique os itens abaixo e complete todas as informações para publicar o seu curso.</p>
                    </div>
                    <InfoCard>Todos os itens devem ser preenchidos para que o curso possa ser publicado.</InfoCard>
                  </div>
                  {issues.length ? (
                    <ul role="status">
                      {groupIssuesByStep(issues).map((i) => {
                        const meta = ISSUE_META[i.field]
                        return <IssueRow key={`${i.field}-${i.message}`} icon={meta?.icon ?? Ico.info} title={meta?.title ?? 'Pendência'} desc={i.message} onGo={i.field === 'professionalId' ? undefined : () => setStep(i.step)} />
                      })}
                    </ul>
                  ) : <p className="form-ok">Curso completo: pronto para publicar.</p>}
                </section>
              </div>

              {dirty ? <p role="status" className="form-error">Há alterações não salvas. Salve antes de pré-visualizar ou publicar.</p> : null}

              <div className="wz-card wz-actions-wrap"><div className="wz-actions-grid">
                <ActionCard external href={`/admin/preview/cursos/${saved.id}`} icon={Ico.eye} title="Pré-visualizar o rascunho" desc="Veja como o curso ficará para os seus alunos." />
                <ActionCard href={`/admin/editor/cursos/${saved.id}`} icon={Ico.pencil} title="Abrir editor visual" desc="Personalize seções, ordem e textos." />
              </div></div>

              <section className="wz-card wz-manage" aria-label="Situação e vitrine">
                <p>
                  Situação: <strong>{({ draft: 'Rascunho', published: 'Publicado', archived: 'Arquivado' } as const)[saved.status]}</strong>
                  {saved.publishedVersion ? ` · versão ${saved.publishedVersion}` : ''}
                  {saved.hasUnpublishedChanges ? ' · há alterações não publicadas (conteúdo ou oferta)' : ''}
                </p>
                {canPublish ? (
                  <>
                    <div className="wz-manage-vitrine">
                      <label className="wizard-check"><input type="checkbox" checked={showcase.showcaseVisible} onChange={(e) => setShowcase((s) => ({ ...s, showcaseVisible: e.target.checked }))} /> Exibir na página do profissional quando publicado</label>
                      <Field label="Posição (menor aparece primeiro)" type="number" min={0} max={9999} value={showcase.showcaseOrder} onChange={(e) => setShowcase((s) => ({ ...s, showcaseOrder: Number(e.target.value) || 0 }))} />
                      <Button variant="secondary" disabled={busy || saved.status === 'archived'} onClick={() => action('/showcase', 'PUT', { ...showcase, featured: saved.featured }, 'Vitrine atualizada.')}>Salvar vitrine</Button>
                    </div>
                    <div className="wizard-actions">
                      {saved.status === 'published' ? <Button variant="secondary" disabled={busy} onClick={() => action('/unpublish', 'POST', undefined, 'Curso tirado do ar.')}>Despublicar</Button> : null}
                      {saved.status !== 'archived' ? <Button variant="secondary" disabled={busy} onClick={async () => { if (await confirm({ title: 'Arquivar curso?', message: 'O curso sai do ar e do site. Você pode restaurar depois.', confirmLabel: 'Arquivar' })) void action('/archive', 'POST', undefined, 'Curso arquivado.') }}>Arquivar</Button> : <Button variant="secondary" disabled={busy} onClick={() => action('/restore', 'POST', undefined, 'Curso restaurado.')}>Restaurar</Button>}
                    </div>
                  </>
                ) : <p>Você pode editar, mas não publicar.</p>}
              </section>
            </div>
          )
        ) : null}

      </section>
        <div className="wizard-nav">
          {step > 0 ? <Button variant="secondary" disabled={busy} onClick={() => setStep(step - 1)}>{Ico.arrowLeft}Voltar</Button> : <span />}
          {canWrite && step < 3 ? (
            <div className="wizard-actions">
              <Button variant="secondary" disabled={busy} onClick={() => save()}>{Ico.save}{saved ? 'Salvar rascunho' : 'Criar rascunho'}</Button>
              {saved ? <Button disabled={busy} onClick={() => save(step + 1)}>Salvar e continuar{Ico.arrowRight}</Button> : null}
            </div>
          ) : null}
          {step === 3 ? (
            <div className="wizard-actions">
              {canWrite ? <Button variant="secondary" disabled={busy} onClick={() => (offerDirty ? saveOffer() : save())}>{Ico.save}Salvar rascunho</Button> : null}
              <Button disabled={busy} onClick={() => (offerDirty ? saveOffer(4) : setStep(4))}>{offerDirty ? 'Salvar e continuar' : 'Continuar'}{Ico.arrowRight}</Button>
            </div>
          ) : null}
          {step === 4 && saved ? (
            <div className="wizard-actions">
              {canWrite ? <Button variant="secondary" disabled={busy} onClick={() => save()}>{Ico.save}Salvar rascunho</Button> : null}
              {canPublish && saved.status !== 'archived' ? (
                <Button disabled={busy || dirty || issues.length > 0 || (saved.status === 'published' && !saved.hasUnpublishedChanges)} onClick={() => action('/publish', 'POST', undefined, 'Publicado. A página pública já foi atualizada.')}>
                  {saved.status === 'published' ? 'Publicar alterações' : 'Publicar curso'}{Ico.arrowRight}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
    </div>
  )
}
