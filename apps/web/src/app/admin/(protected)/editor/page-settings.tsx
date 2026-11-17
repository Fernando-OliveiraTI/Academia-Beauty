'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  COURSE_MODALITIES,
  COURSE_MODALITY_LABEL,
  courseDataSchema,
  professionalDataSchema,
  type AdminCourse,
  type AdminProfessional,
  type CourseData,
  type ProfessionalData,
} from '@academia/contracts'
import { Field, TextArea } from '@academia/design-system'
import { apiGet, apiSend } from '@/lib/api-client'
import { describeApiError, type ApiErrorBody } from '@/lib/api-errors'
import { ImageField } from '@/components/image-field'
import { CoursePaymentsPanel } from '@/components/course-payments'
import { PROFESSIONAL_TEMPLATES } from '@academia/section-schemas'
import { CheckoutSettings } from './checkout-settings'

/** Pedido para levar o cursor a um campo do painel (pendência de publicação); `n` muda a cada pedido. */
export type SettingsFocus = { field: string; n: number } | null

type Commercial = NonNullable<AdminCourse['commercial']>

const MESSAGES: Record<string, string> = {
  slug_taken: 'Este endereço já está em uso. Escolha outro.',
  slug_locked: 'O endereço não muda depois da primeira publicação.',
  archived: 'Restaure este item na lista antes de editar.',
  revision_conflict: 'Outra pessoa alterou este item ao mesmo tempo. Recarregue a página para continuar.',
}

/** { field: 'data.name' } → { name: 'mensagem' } (o primeiro erro de cada campo). */
function fieldErrors(errors: ReadonlyArray<{ field: string; message: string }> | undefined) {
  const map: Record<string, string> = {}
  for (const e of errors ?? []) {
    const key = e.field.replace(/^data\./, '')
    if (!(key in map)) map[key] = e.message
  }
  return map
}

/**
 * Grava o cadastro a partir da versão mais recente do servidor: o editor também grava campos do cadastro (os que
 * aparecem na página), então a revisão que a tela carregou pode já ter mudado. Um conflito de revisão é tentado
 * de novo uma vez, com os dados recarregados; os outros erros voltam como estão.
 */
async function saveCadastro<T extends { slug: string; revision: number; data: D }, D>(
  path: string,
  apply: (fresh: D) => D,
  slug: string,
) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const fresh = await apiGet<T>(path)
    if (!fresh.ok || !fresh.data) return { ok: false as const, status: fresh.status, body: fresh.data as ApiErrorBody | null }
    const res = await apiSend<T & ApiErrorBody>('PUT', path, {
      slug: slug !== fresh.data.slug ? slug : undefined,
      data: apply(fresh.data.data),
      revision: fresh.data.revision,
    })
    if (res.ok && res.data) return { ok: true as const, data: res.data as T }
    if (res.status === 409 && (res.data as ApiErrorBody | null)?.code === 'revision_conflict' && attempt === 0) continue
    return { ok: false as const, status: res.status, body: res.data as ApiErrorBody | null }
  }
  return { ok: false as const, status: 409, body: { code: 'revision_conflict' } as ApiErrorBody }
}

/** Leva o cursor ao campo pedido (pendência) e o destaca por um instante. */
function useFocusField(root: React.RefObject<HTMLDivElement | null>, focus: SettingsFocus) {
  useEffect(() => {
    if (!focus) return
    const timer = window.setTimeout(() => {
      const box = root.current?.querySelector<HTMLElement>(`[data-cfg-field="${CSS.escape(focus.field)}"]`)
      const control = box?.matches('input, textarea, select, button') ? box
        : (box?.querySelector<HTMLElement>('input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), select:not(:disabled)') ?? box?.querySelector<HTMLElement>('button:not(:disabled)'))
      box?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      control?.focus({ preventScroll: true })
      box?.setAttribute('data-flash', '')
      window.setTimeout(() => box?.removeAttribute('data-flash'), 1400)
    }, 80)
    return () => window.clearTimeout(timer)
  }, [root, focus])
}

function Group({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="ed-cfg-group">
      <h3 className="ed-cfg-title">{title}</h3>
      {desc ? <p className="ed-cfg-desc">{desc}</p> : null}
      {children}
    </section>
  )
}

function Status({ msg }: { msg: { kind: 'ok' | 'error'; text: string } | null }) {
  if (!msg) return null
  return <p role={msg.kind === 'error' ? 'alert' : 'status'} className={msg.kind === 'error' ? 'form-error' : 'form-ok'}>{msg.text}</p>
}

/* ------------------------------- Profissional ------------------------------- */

type ProfessionalForm = Pick<ProfessionalData, 'name' | 'specialty' | 'cardPhotoSrc' | 'metaDescription'>
const proForm = (d: ProfessionalData): ProfessionalForm => ({ name: d.name, specialty: d.specialty, cardPhotoSrc: d.cardPhotoSrc, metaDescription: d.metaDescription })

export function ProfessionalSettings({ cadastro, canWrite, canPublish, focus, onSaved, templateKey, onChangeTemplate }: {
  cadastro: AdminProfessional
  canWrite: boolean
  canPublish: boolean
  focus: SettingsFocus
  onSaved: (next: AdminProfessional) => void
  /** Modelo atual da página e a troca (recria a página no novo modelo; feita pelo editor, que controla o salvamento). */
  templateKey: string
  onChangeTemplate: (templateKey: string) => void
}) {
  const [nextTemplate, setNextTemplate] = useState(templateKey)
  const root = useRef<HTMLDivElement>(null)
  useFocusField(root, focus)
  const [form, setForm] = useState(proForm(cadastro.data))
  const [slug, setSlug] = useState(cadastro.slug)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [showcase, setShowcase] = useState({ homeVisible: cadastro.homeVisible, homeOrder: cadastro.homeOrder })
  const [showMsg, setShowMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const editable = canWrite && cadastro.status !== 'archived'
  const slugEditable = editable && cadastro.status === 'draft' && cadastro.publishedVersion === null
  const saved = proForm(cadastro.data)
  const dirty = slug !== cadastro.slug || (Object.keys(form) as (keyof ProfessionalForm)[]).some((k) => form[k] !== saved[k])
  const set = <K extends keyof ProfessionalForm>(key: K, value: ProfessionalForm[K]) => setForm((f) => ({ ...f, [key]: value }))

  async function save() {
    setMsg(null)
    const check = professionalDataSchema.safeParse({ ...cadastro.data, ...form })
    if (!check.success) {
      setErrors(fieldErrors(check.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))))
      setMsg({ kind: 'error', text: 'Corrija os campos destacados.' })
      return
    }
    setBusy(true)
    const res = await saveCadastro<AdminProfessional, ProfessionalData>(`/admin/professionals/${cadastro.id}`, (fresh) => ({ ...fresh, ...form }), slug)
    setBusy(false)
    if (!res.ok) {
      setErrors(fieldErrors(res.body?.errors))
      setMsg({ kind: 'error', text: describeApiError(res.status, res.body, res.body?.code ? MESSAGES[res.body.code] : null) })
      return
    }
    setErrors({})
    setMsg({ kind: 'ok', text: 'Configurações salvas.' })
    onSaved(res.data)
  }

  async function saveShowcase() {
    setShowMsg(null)
    const res = await apiSend<AdminProfessional & ApiErrorBody>('PUT', `/admin/professionals/${cadastro.id}/showcase`, { ...showcase, featured: cadastro.featured })
    if (!res.ok || !res.data) return setShowMsg({ kind: 'error', text: describeApiError(res.status, res.data) })
    setShowMsg({ kind: 'ok', text: 'Vitrine atualizada.' })
    onSaved({ ...cadastro, ...res.data })
  }

  return (
    <div className="ed-cfg" ref={root}>
      <Group title="Identidade" desc="Usados no cartão da Home, nos cursos e nos buscadores. O que aparece na página (nome em destaque, frase, retrato) é editado nas seções.">
        <fieldset className="ed-form ed-cfg-fields" disabled={!editable || busy}>
          <legend className="sr-only">Identidade</legend>
          <div data-cfg-field="name"><Field label="Nome completo" requiredMark value={form.name} maxLength={80} error={errors.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div data-cfg-field="specialty"><Field label="Especialidade" requiredMark value={form.specialty} maxLength={40} placeholder="Hair, Barber, Make…" error={errors.specialty} onChange={(e) => set('specialty', e.target.value)} /></div>
          <div data-cfg-field="slug">
            <Field label="Endereço da página" value={slug} maxLength={80} disabled={!slugEditable} error={errors.slug}
              hint={<>A página fica em <code>/profissionais/{slug || '…'}</code>. {slugEditable ? 'Não muda depois da primeira publicação.' : 'Fixo: a página já foi publicada.'}</>}
              onChange={(e) => setSlug(e.target.value.toLowerCase())} />
          </div>
          <div data-cfg-field="cardPhotoSrc"><ImageField label="Foto do cartão na Home" kind="image" value={form.cardPhotoSrc} error={errors.cardPhotoSrc} disabled={!editable} onChange={(v) => set('cardPhotoSrc', v)} /></div>
          <div data-cfg-field="metaDescription"><TextArea label="Descrição para buscadores (opcional)" rows={2} value={form.metaDescription} maxLength={200} error={errors.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} /></div>
        </fieldset>
        <Status msg={msg} />
        {editable ? <button type="button" className="admin-button" disabled={busy || !dirty} onClick={() => void save()}>{busy ? 'Salvando…' : 'Salvar configurações'}</button> : null}
      </Group>

      <Group title="Modelo da página" desc="Trocar o modelo recria a página no novo layout com a frase, o retrato, a trajetória, o Instagram, os trabalhos e o vídeo atuais. Ajustes de layout e textos extras das seções (títulos, ordem, fundos) são descartados.">
        <fieldset className="ed-form ed-cfg-fields" disabled={!editable}>
          <legend className="sr-only">Modelo da página</legend>
          {PROFESSIONAL_TEMPLATES.map((t) => (
            <label key={t.key} className="ed-bg-opt" data-selected={nextTemplate === t.key || undefined}>
              <input type="radio" name="cfg-template" value={t.key} checked={nextTemplate === t.key} onChange={() => setNextTemplate(t.key)} />
              <span><strong>{t.label}{t.key === templateKey ? ' (atual)' : ''}</strong><small>{t.description}</small></span>
            </label>
          ))}
        </fieldset>
        {editable ? (
          <span className="ed-actions">
            <button type="button" className="admin-button secondary" disabled={nextTemplate === templateKey} onClick={() => onChangeTemplate(nextTemplate)}>Trocar modelo</button>
            <a className="link-button" href={`/preview/modelos/${nextTemplate}`} target="_blank" rel="noopener">Ver exemplo do modelo</a>
          </span>
        ) : null}
      </Group>

      {canPublish ? (
        <Group title="Vitrine da Home" desc="Vale quando o profissional está publicado.">
          <fieldset className="ed-form ed-cfg-fields" disabled={cadastro.status === 'archived'}>
            <legend className="sr-only">Vitrine da Home</legend>
            <label className="sf-check"><input type="checkbox" checked={showcase.homeVisible} onChange={(e) => setShowcase((s) => ({ ...s, homeVisible: e.target.checked }))} /> Exibir na Home</label>
            <Field label="Posição (menor aparece primeiro)" type="number" min={0} max={9999} value={showcase.homeOrder} onChange={(e) => setShowcase((s) => ({ ...s, homeOrder: Number(e.target.value) || 0 }))} />
          </fieldset>
          <Status msg={showMsg} />
          <button type="button" className="admin-button secondary" disabled={cadastro.status === 'archived'} onClick={() => void saveShowcase()}>Salvar vitrine</button>
        </Group>
      ) : null}
    </div>
  )
}

/* ---------------------------------- Curso ---------------------------------- */

/**
 * Só o que sai da página: título (cartões, Google), formato (cartões da Home) e descrição para buscadores.
 * Público, nível, carga horária e garantia só montavam a página na criação; agora são editados nas seções
 * (Fatos do curso, Garantia…), onde aparecem.
 */
type CourseForm = Pick<CourseData, 'title' | 'modality' | 'metaDescription'>
const courseForm = (d: CourseData): CourseForm => ({ title: d.title, modality: d.modality, metaDescription: d.metaDescription })

export function CourseSettings({ cadastro, canWrite, canPublish, canCommerce, focus, onSaved, onOfferSaved }: {
  cadastro: AdminCourse
  canWrite: boolean
  canPublish: boolean
  canCommerce: boolean
  focus: SettingsFocus
  onSaved: (next: AdminCourse) => void
  onOfferSaved: (commercial: Commercial) => void
}) {
  const root = useRef<HTMLDivElement>(null)
  useFocusField(root, focus)
  const [form, setForm] = useState(courseForm(cadastro.data))
  const [slug, setSlug] = useState(cadastro.slug)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [showcase, setShowcase] = useState({ showcaseVisible: cadastro.showcaseVisible, showcaseOrder: cadastro.showcaseOrder })
  const [showMsg, setShowMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const editable = canWrite && cadastro.status !== 'archived'
  const slugEditable = editable && cadastro.status === 'draft' && cadastro.publishedVersion === null
  const saved = courseForm(cadastro.data)
  const dirty = slug !== cadastro.slug || (Object.keys(form) as (keyof CourseForm)[]).some((k) => form[k] !== saved[k])
  const set = <K extends keyof CourseForm>(key: K, value: CourseForm[K]) => setForm((f) => ({ ...f, [key]: value }))

  async function save() {
    setMsg(null)
    const check = courseDataSchema.safeParse({ ...cadastro.data, ...form })
    if (!check.success) {
      setErrors(fieldErrors(check.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))))
      setMsg({ kind: 'error', text: 'Corrija os campos destacados.' })
      return
    }
    setBusy(true)
    const res = await saveCadastro<AdminCourse, CourseData>(`/admin/courses/${cadastro.id}`, (fresh) => ({ ...fresh, ...form }), slug)
    setBusy(false)
    if (!res.ok) {
      setErrors(fieldErrors(res.body?.errors))
      setMsg({ kind: 'error', text: describeApiError(res.status, res.body, res.body?.code ? MESSAGES[res.body.code] : null) })
      return
    }
    setErrors({})
    setMsg({ kind: 'ok', text: 'Configurações salvas.' })
    onSaved(res.data)
  }

  async function saveShowcase() {
    setShowMsg(null)
    const res = await apiSend<AdminCourse & ApiErrorBody>('PUT', `/admin/courses/${cadastro.id}/showcase`, { ...showcase, featured: cadastro.featured })
    if (!res.ok || !res.data) return setShowMsg({ kind: 'error', text: describeApiError(res.status, res.data) })
    setShowMsg({ kind: 'ok', text: 'Vitrine atualizada.' })
    onSaved({ ...cadastro, ...res.data })
  }

  return (
    <div className="ed-cfg" ref={root}>
      <Group title="Dados do curso" desc="Usados nos cartões e nos buscadores. Público, nível, carga horária, garantia, textos, capa, benefícios, módulos e entregáveis são editados nas seções da página.">
        <fieldset className="ed-form ed-cfg-fields" disabled={!editable || busy}>
          <legend className="sr-only">Dados do curso</legend>
          <div data-cfg-field="title"><Field label="Título do curso" requiredMark value={form.title} maxLength={80} error={errors.title} onChange={(e) => set('title', e.target.value)} /></div>
          <div data-cfg-field="slug">
            <Field label="Endereço da página" value={slug} maxLength={80} disabled={!slugEditable} error={errors.slug}
              hint={<>A página fica em <code>/cursos/{slug || '…'}</code>. {slugEditable ? 'Não muda depois da primeira publicação.' : 'Fixo: a página já foi publicada.'}</>}
              onChange={(e) => setSlug(e.target.value.toLowerCase())} />
          </div>
          <div className="sf-field" data-cfg-field="professionalId">
            <span className="ds-label">Profissional</span>
            <p className="ed-cfg-value">{cadastro.professionalName}</p>
            <a className="link-button" href={`/admin/editor/profissionais/${cadastro.professionalId}`}>Abrir a página do profissional</a>
            <p className="ed-cfg-desc">O curso só pode ser publicado depois do profissional.</p>
          </div>
          <div className="sf-field" data-cfg-field="modality">
            <label className="ds-label" htmlFor="cfg-modality">Formato</label>
            <select id="cfg-modality" className="ds-input" value={form.modality} onChange={(e) => set('modality', e.target.value as CourseData['modality'])}>
              {COURSE_MODALITIES.map((m) => <option key={m} value={m}>{COURSE_MODALITY_LABEL[m]}</option>)}
            </select>
            <p className="ed-cfg-desc">Aparece nos cartões de curso da Home.</p>
          </div>
          <div data-cfg-field="metaDescription"><TextArea label="Descrição para buscadores (opcional)" rows={2} value={form.metaDescription} maxLength={200} error={errors.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} /></div>
        </fieldset>
        <Status msg={msg} />
        {editable ? <button type="button" className="admin-button" disabled={busy || !dirty} onClick={() => void save()}>{busy ? 'Salvando…' : 'Salvar configurações'}</button> : null}
      </Group>

      <Group title="Oferta e checkout" desc="Preço, parcelas e o link de pagamento. Sem oferta ativa o curso não pode ser publicado.">
        <CheckoutSettings courseId={cadastro.id} commercial={cadastro.commercial} canCommerce={canCommerce} onSaved={onOfferSaved} />
      </Group>

      {canPublish ? (
        <Group title="Vitrine" desc="Cursos da página do profissional. Vale quando o curso está publicado.">
          <fieldset className="ed-form ed-cfg-fields" disabled={cadastro.status === 'archived'}>
            <legend className="sr-only">Vitrine</legend>
            <label className="sf-check"><input type="checkbox" checked={showcase.showcaseVisible} onChange={(e) => setShowcase((s) => ({ ...s, showcaseVisible: e.target.checked }))} /> Exibir na página do profissional</label>
            <Field label="Posição (menor aparece primeiro)" type="number" min={0} max={9999} value={showcase.showcaseOrder} onChange={(e) => setShowcase((s) => ({ ...s, showcaseOrder: Number(e.target.value) || 0 }))} />
          </fieldset>
          <Status msg={showMsg} />
          <button type="button" className="admin-button secondary" disabled={cadastro.status === 'archived'} onClick={() => void saveShowcase()}>Salvar vitrine</button>
        </Group>
      ) : null}

      {canCommerce && cadastro.commercial ? (
        <Group title="Vendas">
          <CoursePaymentsPanel courseId={cadastro.id} externalCourseId={cadastro.commercial.externalCourseId ?? ''} />
        </Group>
      ) : null}
    </div>
  )
}
