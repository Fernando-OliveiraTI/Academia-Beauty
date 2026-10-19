'use client'

import { useConfirm } from '@/components/confirm-dialog'
import { useState } from 'react'
import {
  professionalDataSchema,
  publishReadiness,
  type AdminProfessional,
  type Permission,
  type ProfessionalData,
  type ReadinessIssue,
} from '@academia/contracts'
import { Button, Field, TextArea } from '@academia/design-system'
import { apiSend } from '@/lib/api-client'
import { describeApiError, type ApiErrorBody } from '@/lib/api-errors'
import { PanelHead, WizardIcon, WizardSteps } from '@/components/wizard-ui'
import { PROFESSIONAL_TEMPLATES } from '@academia/section-schemas'
import { ImageField } from '@/components/image-field'
import { canonical, emptyProfessionalData, fieldErrors, groupIssuesByStep, parseTags, STEPS, suggestSlug } from './form-model'

type Loaded = AdminProfessional & { readiness: ReadinessIssue[] }
type ApiError = ApiErrorBody

const MESSAGES: Record<string, string> = {
  revision_conflict: 'Outra pessoa alterou este cadastro. Recarregue a página para continuar sem perder o trabalho dela.',
  slug_taken: 'Este endereço (slug) já está em uso.',
  slug_locked: 'O endereço não pode mudar depois da primeira publicação.',
  template_locked: 'A página foi personalizada no editor. Use «Restaurar do cadastro» no editor antes de trocar o modelo.',
  archived: 'Restaure o profissional antes de continuar.',
}

function describe(status: number, body: ApiError | null): string {
  return describeApiError(status, body, body?.code ? MESSAGES[body.code] : null)
}

const STEP_ICONS = [WizardIcon.user, WizardIcon.sparkle, WizardIcon.image, WizardIcon.list, WizardIcon.check]

export function ProfessionalWizard({ initial, permissions, initialStep = 0 }: { initial?: Loaded; permissions: readonly Permission[]; initialStep?: number }) {
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [saved, setSaved] = useState<Loaded | undefined>(initial)
  const [data, setData] = useState<ProfessionalData>(initial?.data ?? emptyProfessionalData)
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [templateKey, setTemplateKey] = useState<string>(initial?.templateKey ?? 'professional-original')
  const [slugTouched, setSlugTouched] = useState(Boolean(initial))
  const [step, setStep] = useState(initial ? Math.min(Math.max(initialStep, 0), STEPS.length - 1) : 0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showcase, setShowcase] = useState({ homeVisible: initial?.homeVisible ?? false, homeOrder: initial?.homeOrder ?? 0 })

  const canWrite = permissions.includes('professionals.write')
  const canPublish = permissions.includes('professionals.publish')
  const set = <K extends keyof ProfessionalData>(key: K, value: ProfessionalData[K]) => setData((d) => ({ ...d, [key]: value }))
  const slugEditable = canWrite && (!saved || saved.status === 'draft')

  function fail(status: number, body: ApiError | null) {
    setErrors(fieldErrors(body?.errors))
    setMessage({ kind: 'error', text: describe(status, body) })
  }

  async function save(next?: number): Promise<boolean> {
    setMessage(null)
    const parsed = professionalDataSchema.safeParse(data)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))))
      setMessage({ kind: 'error', text: 'Corrija os campos destacados.' })
      return false
    }
    setBusy(true)
    try {
      const res = saved
        ? await apiSend<Loaded>('PUT', `/admin/professionals/${saved.id}`, { slug: slug !== saved.slug ? slug : undefined, data: parsed.data, revision: saved.revision, templateKey })
        : await apiSend<Loaded>('POST', '/admin/professionals', { slug, data: parsed.data, templateKey })
      if (!res.ok || !res.data) {
        fail(res.status, res.data as ApiError | null)
        return false
      }
      if (!saved) {
        window.location.assign(`/admin/profissionais/${res.data.id}`) // recarrega já no modo edição
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

  async function action(path: string, method: 'POST' | 'PUT' = 'POST', body?: unknown, okText = 'Concluído.') {
    if (!saved) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await apiSend<Loaded & ApiError>(method, `/admin/professionals/${saved.id}${path}`, body)
      if (!res.ok || !res.data) {
        fail(res.status, res.data as ApiError | null)
        const issues = (res.data as ApiError | null)?.errors
        if (res.status === 422 && issues?.length) {
          setMessage({ kind: 'error', text: `Faltam informações: ${issues.map((i) => i.message).join('; ')}.` })
        }
        return
      }
      setSaved({ ...saved, ...res.data, readiness: saved.readiness })
      setMessage({ kind: 'ok', text: okText })
    } catch {
      setMessage({ kind: 'error', text: describe(0, null) })
    } finally {
      setBusy(false)
    }
  }

  // A publicação usa o que está salvo no servidor; as pendências refletem esse estado, não o formulário.
  const liveIssues = saved ? publishReadiness(saved.data) : []
  const dirty = saved ? canonical(professionalDataSchema.safeParse(data).data ?? data) !== canonical(saved.data) : false

  return (
    <div className="wizard">
      {confirmDialog}
      {saved && saved.documentRevision > 0 ? (
        <p role="note" className="ed-banner ed-banner-info">
          Esta página foi personalizada no editor visual: alterações feitas aqui no cadastro <strong>não alteram</strong> as seções já editadas
          (cursos publicados e vitrine continuam automáticos). Para voltar à página gerada pelo cadastro, use{' '}
          <a href={`/admin/editor/profissionais/${saved.id}`}>«Restaurar do cadastro» no editor</a>.
        </p>
      ) : null}
      <WizardSteps steps={STEPS} step={step} onSelect={setStep} isDisabled={(i) => !saved && i > 0} />

      {message ? <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'form-error' : 'form-ok'}>{message.text}</p> : null}

      <section className="admin-card wizard-panel" aria-labelledby="wizard-title">
        <PanelHead icon={STEP_ICONS[step]} title={STEPS[step]!.label} desc={STEPS[step]!.desc} />

        {step === 0 ? (
          <div className="wizard-grid">
            <Field label="Nome completo" requiredMark icon={WizardIcon.person} value={data.name} maxLength={80} disabled={!canWrite} error={errors.name}
              onChange={(e) => {
                set('name', e.target.value)
                if (!slugTouched) setSlug(suggestSlug(e.target.value))
              }} />
            <Field label="Especialidade" requiredMark icon={WizardIcon.sparkle} value={data.specialty} maxLength={40} disabled={!canWrite} error={errors.specialty} placeholder="Hair, Barber, Make…" onChange={(e) => set('specialty', e.target.value)} />
            <div className="wizard-full">
              <Field label="Endereço da página (slug)" requiredMark prefix="/profissionais/" suffix={WizardIcon.link} value={slug} maxLength={80} disabled={!slugEditable} error={errors.slug}
                hint={<>A página ficará em <code>/profissionais/{slug || '…'}</code>. O endereço não muda depois da primeira publicação.</>}
                onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()) }} />
            </div>
            <fieldset className="template-picker" disabled={!canWrite || Boolean(saved && saved.documentRevision > 0)}>
              <legend className="ds-label">Modelo da página</legend>
              {PROFESSIONAL_TEMPLATES.map((t) => (
                <div className="template-option" key={t.key} data-selected={templateKey === t.key || undefined}>
                  <label>
                    <input type="radio" name="templateKey" value={t.key} checked={templateKey === t.key} onChange={() => setTemplateKey(t.key)} />
                    <span><strong>{t.label}</strong><small>{t.description}</small></span>
                  </label>
                  <a className="link-button" href={`/preview/modelos/${t.key}`} target="_blank" rel="noopener" aria-label={`Ver exemplo do modelo ${t.label} (abre em nova aba)`}>Ver exemplo</a>
                </div>
              ))}
              {saved && saved.documentRevision > 0 ? <p className="wizard-hint">A página foi personalizada no editor: para trocar o modelo, use «Restaurar do cadastro» no editor.</p> : <p className="wizard-hint">O modelo define a composição e o visual da página. Você ainda poderá editar cada seção no editor visual.</p>}
            </fieldset>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="wizard-grid">
            <TextArea label="Frase de apresentação" value={data.tagline} maxLength={200} rows={2} disabled={!canWrite} error={errors.tagline} onChange={(e) => set('tagline', e.target.value)} />
            <Field label="Anos de experiência" type="number" min={0} max={80} inputMode="numeric" value={data.experienceYears ?? ''} disabled={!canWrite} error={errors.experienceYears}
              onChange={(e) => set('experienceYears', e.target.value === '' ? null : Number(e.target.value))} />
            <Field label="Instagram (usuário)" value={data.instagramHandle} maxLength={40} placeholder="@usuario" disabled={!canWrite} error={errors.instagramHandle} onChange={(e) => set('instagramHandle', e.target.value)} />
            <Field label="Seguidores (texto exibido)" value={data.instagramFollowers} maxLength={40} placeholder="53,6 Mil seguidores" disabled={!canWrite} error={errors.instagramFollowers} onChange={(e) => set('instagramFollowers', e.target.value)} />
            <Field label="Link do Instagram" type="url" value={data.instagramUrl} placeholder="https://instagram.com/usuario" disabled={!canWrite} error={errors.instagramUrl} onChange={(e) => set('instagramUrl', e.target.value)} />
            <TextArea label="Descrição para buscadores (opcional)" value={data.metaDescription} maxLength={200} rows={2} disabled={!canWrite} error={errors.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="wizard-grid">
            <p className="wizard-hint">Clique em “Editar” para trocar uma imagem: arraste o arquivo ou selecione do computador. Também dá para escolher um arquivo já enviado na biblioteca de mídia.</p>
            <ImageField label="Retrato da página" kind="image" value={data.portraitSrc} disabled={!canWrite} error={errors.portraitSrc} onChange={(v) => set('portraitSrc', v)} />
            <ImageField label="Foto do cartão na Home" kind="image" value={data.cardPhotoSrc} disabled={!canWrite} error={errors.cardPhotoSrc} onChange={(v) => set('cardPhotoSrc', v)} />
            <ImageField label="Vídeo de apresentação (opcional, MP4)" kind="video" value={data.videoSrc} disabled={!canWrite} error={errors.videoSrc} onChange={(v) => set('videoSrc', v)} onClear={() => set('videoSrc', '')} />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="wizard-grid">
            <fieldset className="wizard-fieldset">
              <legend>Trajetória (parágrafos)</legend>
              {data.bio.map((paragraph, i) => (
                <div key={i} className="wizard-row">
                  <TextArea label={`Parágrafo ${i + 1}`} value={paragraph} maxLength={1200} disabled={!canWrite} error={errors[`bio.${i}`]}
                    onChange={(e) => set('bio', data.bio.map((p, j) => (j === i ? e.target.value : p)))} />
                  {canWrite ? <Button variant="secondary" onClick={() => set('bio', data.bio.filter((_, j) => j !== i))}>Remover parágrafo {i + 1}</Button> : null}
                </div>
              ))}
              {canWrite && data.bio.length < 6 ? <Button variant="secondary" onClick={() => set('bio', [...data.bio, ''])}>Adicionar parágrafo</Button> : null}
            </fieldset>
            <fieldset className="wizard-fieldset">
              <legend>Trabalhos em destaque (até 12)</legend>
              {data.works.map((work, i) => {
                const update = (patch: Partial<typeof work>) => set('works', data.works.map((w, j) => (j === i ? { ...w, ...patch } : w)))
                return (
                  <div key={i} className="wizard-row wizard-work">
                    <Field label={`Trabalho ${i + 1} · título`} value={work.title} maxLength={120} disabled={!canWrite} error={errors[`works.${i}.title`]} onChange={(e) => update({ title: e.target.value })} />
                    <ImageField label="Imagem" kind="image" value={work.imageSrc} disabled={!canWrite} error={errors[`works.${i}.imageSrc`]} onChange={(v) => update({ imageSrc: v })} />
                    <Field label="Texto alternativo da imagem" value={work.alt} maxLength={300} disabled={!canWrite} error={errors[`works.${i}.alt`]} onChange={(e) => update({ alt: e.target.value })} />
                    <Field key={work.tags.join('|')} label="Etiquetas (até 2, separadas por vírgula)" defaultValue={work.tags.join(', ')} disabled={!canWrite} onBlur={(e) => update({ tags: parseTags(e.target.value) })} />
                    {canWrite ? <Button variant="secondary" onClick={() => set('works', data.works.filter((_, j) => j !== i))}>Remover trabalho {i + 1}</Button> : null}
                  </div>
                )
              })}
              {canWrite && data.works.length < 12 ? <Button variant="secondary" onClick={() => set('works', [...data.works, { imageSrc: '', alt: '', title: '', tags: [] }])}>Adicionar trabalho</Button> : null}
            </fieldset>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="wizard-grid">
            {!saved ? <p>Salve o cadastro antes de publicar.</p> : (
              <>
                <p>
                  Situação: <strong>{({ draft: 'Rascunho', published: 'Publicado', archived: 'Arquivado' } as const)[saved.status]}</strong>
                  {saved.publishedVersion ? ` · versão ${saved.publishedVersion}` : ''}
                  {saved.hasUnpublishedChanges ? ' · há alterações não publicadas' : ''}
                </p>
                {liveIssues.length ? (
                  <div role="status">
                    <p>Pendências para publicar:</p>
                    <ul>
                      {groupIssuesByStep(liveIssues).map((i) => (
                        <li key={i.field}>{i.message} — <button type="button" className="link-button" onClick={() => setStep(i.step)}>ir para a etapa</button></li>
                      ))}
                    </ul>
                  </div>
                ) : <p className="form-ok">Cadastro completo: pronto para publicar.</p>}

                {dirty ? <p role="status" className="form-error">Há alterações não salvas. Salve antes de pré-visualizar ou publicar.</p> : null}
                <p><a href={`/admin/preview/profissionais/${saved.id}`} target="_blank" rel="noreferrer">Abrir pré-visualização do rascunho (nova aba)</a></p>
                <p><a href={`/admin/editor/profissionais/${saved.id}`}>Abrir editor visual (personalizar seções, ordem e textos)</a></p>

                {canPublish ? (
                  <fieldset className="wizard-fieldset">
                    <legend>Vitrine da Home</legend>
                    <label className="wizard-check"><input type="checkbox" checked={showcase.homeVisible} onChange={(e) => setShowcase((s) => ({ ...s, homeVisible: e.target.checked }))} /> Exibir na Home quando publicado</label>
                    <Field label="Posição (menor aparece primeiro)" type="number" min={0} max={9999} value={showcase.homeOrder} onChange={(e) => setShowcase((s) => ({ ...s, homeOrder: Number(e.target.value) || 0 }))} />
                    <Button variant="secondary" disabled={busy || saved.status === 'archived'} onClick={() => action('/showcase', 'PUT', { ...showcase, featured: saved.featured }, 'Vitrine atualizada.')}>Salvar vitrine</Button>
                  </fieldset>
                ) : null}

                {canPublish ? (
                  <div className="wizard-actions">
                    {saved.status !== 'archived' ? (
                      <Button disabled={busy || dirty || liveIssues.length > 0 || (saved.status === 'published' && !saved.hasUnpublishedChanges)} onClick={() => action('/publish', 'POST', undefined, 'Publicado. A página pública já foi atualizada.')}>
                        {saved.status === 'published' ? 'Publicar alterações' : 'Publicar'}
                      </Button>
                    ) : null}
                    {saved.status === 'published' ? <Button variant="secondary" disabled={busy} onClick={() => action('/unpublish', 'POST', undefined, 'Página tirada do ar.')}>Despublicar</Button> : null}
                    {saved.status !== 'archived' ? <Button variant="secondary" disabled={busy} onClick={async () => { if (await confirm({ title: 'Arquivar profissional?', message: 'A página do profissional sai do ar e do site. Você pode restaurar depois.', confirmLabel: 'Arquivar' })) void action('/archive', 'POST', undefined, 'Profissional arquivado.') }}>Arquivar</Button> : <Button variant="secondary" disabled={busy} onClick={() => action('/restore', 'POST', undefined, 'Profissional restaurado como rascunho.')}>Restaurar</Button>}
                  </div>
                ) : <p>Você pode editar, mas não publicar.</p>}
              </>
            )}
          </div>
        ) : null}

        <div className="wizard-nav">
          {step > 0 ? <Button variant="secondary" disabled={busy} onClick={() => setStep(step - 1)}>Voltar</Button> : <span />}
          {canWrite && step < 4 ? (
            <div className="wizard-actions">
              <Button variant="secondary" disabled={busy} onClick={() => save()}>{saved ? 'Salvar' : 'Criar rascunho'}</Button>
              {saved ? <Button disabled={busy} onClick={() => save(step + 1)}>Salvar e continuar</Button> : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
