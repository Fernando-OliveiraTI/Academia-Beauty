'use client'

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { z } from 'zod'
import type { PageDocument, SectionBackground } from '@academia/page-schema'
import {
  addSection, canRedo, canUndo, commit, createHistory, duplicateSection, moveSection, newSectionId, redo, removeSection,
  setBackground, setVisibility, undo, updateContent, type EditError, type EditResult, type History,
} from '@academia/editor-core'
import { MAX_PER_REPEATABLE_TYPE, backgroundsFor, editorRules, isRepeatable, metaFor, validatePageDocument } from '@academia/section-schemas'
import { courseReadiness, locateField, publishReadiness, syncDataFromDocument, type AdminCourse, type AdminProfessional, type DocumentVersion, type ReadinessIssue } from '@academia/contracts'
import { apiGet, apiSend } from '@/lib/api-client'
import { useConfirm } from '@/components/confirm-dialog'
import { CourseSettings, ProfessionalSettings, type SettingsFocus } from './page-settings'
import { PublishBlockedNotice, PublishIssues, type PublishIssue } from './publish-issues'
import { PublishOverlay, type PublishPhase } from './publish-overlay'
import { useAutosave, type SaveState } from './use-autosave'
import { SchemaForm, type JsonSchema } from '@/components/schema-form'
import { withoutTemplateSamples } from '@academia/page-renderer'
import { EDITOR_FIELD, EDITOR_FOCUS, EDITOR_INTERACTIVE, EDITOR_MESSAGE, EDITOR_PICK } from '@/components/live-preview'
import { fieldAnchor, findFieldPath, type PickInfo } from '@/lib/section-dom'

type Kind = 'professional' | 'course' | 'home'
export type EditorProps = {
  kind: Kind
  id: number
  title: string
  status: string
  /** Documento a editar: o salvo ou, se a página nunca foi personalizada, o derivado do cadastro. */
  initial: PageDocument
  /** Biblioteca para reinserir seções removidas, com conteúdo derivado do cadastro atual. */
  library: PageDocument
  documentRevision: number
  /** Revisão do cadastro: restaurar uma versão também sobrescreve o cadastro e precisa dela. */
  cadastroRevision: number
  templateKey: string
  canWrite: boolean
  canPublish: boolean
  versions: DocumentVersion[]
  /** Seções cuja visibilidade é decidida pelo catálogo (ex.: cursos do profissional). */
  dynamicTypes: string[]
  backHref: string
  /** Página pública da página editada (botão "Ver página"). */
  viewHref: string
  /**
   * Dados de fora da página (nome, endereço, foto do cartão, oferta…), editados no painel Configurações do próprio
   * editor. A Home não tem.
   */
  cadastro?: { kind: 'professional'; value: AdminProfessional } | { kind: 'course'; value: AdminCourse }
  /** Só em cursos: quem pode alterar preço e checkout (`commerce.manage`). */
  canCommerce?: boolean
}

/** Campo de texto onde dá para digitar (antes de seletores como o de ícone, e nunca botões ou campos desativados). */
const TEXT_FIELD = 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not(:disabled), textarea:not(:disabled)'

/** Pendências da oferta: o editor não conhece os domínios autorizados, então só o servidor as confirma ao publicar. */
const OFFER_FIELDS = new Set(['commercial', 'active', 'checkoutUrl', 'environment'])

const SAVE_LABEL: Record<SaveState, string> = {
  idle: 'Sem alterações', dirty: 'Alterações não salvas', saving: 'Salvando…', saved: 'Rascunho salvo agora', invalid: 'Corrija os campos para salvar',
  conflict: 'Conflito: outra pessoa alterou esta página', error: 'Falha ao salvar. Tentando novamente…',
  auth: 'Sessão expirada: alterações não salvas', forbidden: 'Sem permissão para salvar', archived: 'Arquivado: não é possível salvar',
}
const REGION_LABEL: Record<string, string> = { banner: 'Topo', main: 'Conteúdo', contentinfo: 'Rodapé', overlay: 'Flutuante' }
const ERROR_TEXT = (e: EditError): string => ({
  not_found: 'Seção não encontrada.', duplicate_id: 'Já existe uma seção com este id.', singleton: 'Esta seção só pode existir uma vez.',
  required: 'Esta seção é obrigatória e não pode ser removida.', cross_region: 'A seção só pode mudar de posição dentro da mesma região da página.',
  out_of_range: 'Posição inválida.', too_many: 'Limite de seções atingido.',
  too_many_of_type: `Esta seção já aparece ${MAX_PER_REPEATABLE_TYPE} vezes na página (o máximo).`,
}[e.code])

/** Tons de fundo da aba Estilo (9B). Cada seção mostra só os tons do seu esquema de cores (`backgroundsFor`). */
const BACKGROUND_INFO: Record<SectionBackground, { label: string; hint: string }> = {
  surface: { label: 'Painel', hint: 'Cinza quente, um tom acima da página' },
  dark: { label: 'Escuro', hint: 'Preto profundo' },
  glow: { label: 'Dourado suave', hint: 'Escuro com brilho dourado discreto' },
  white: { label: 'Branco', hint: 'Branco puro' },
  paper: { label: 'Papel', hint: 'Bege claro' },
  gold: { label: 'Dourado', hint: 'Dourado da marca' },
}

const svg = (d: ReactNode) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
const ICONS = {
  nav: svg(<><circle cx="5" cy="6" r="1" /><circle cx="12" cy="6" r="1" /><circle cx="19" cy="6" r="1" /><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="18" r="1" /><circle cx="12" cy="18" r="1" /><circle cx="19" cy="18" r="1" /></>),
  hero: svg(<path d="M12 3c3 4 6 6.5 6 10a6 6 0 0 1-12 0c0-3.500 3-6 6-10z" />),
  grid: svg(<><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>),
  content: svg(<><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h8M8 17h5" /></>),
  star: svg(<path d="m12 3 2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9z" />),
  image: svg(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.600" /><path d="m21 16-5-5-8 8" /></>),
  video: svg(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3z" /></>),
  quote: svg(<path d="M5 18v-5a4 4 0 0 1 4-4M13 18v-5a4 4 0 0 1 4-4M5 13h4v5H5zM13 13h4v5h-4z" />),
  person: svg(<><circle cx="12" cy="8" r="3.500" /><path d="M5 20a7 7 0 0 1 14 0" /></>),
  help: svg(<><circle cx="12" cy="12" r="9" /><path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.7.400-1 .9-1 1.700M12 17h.01" /></>),
  tag: svg(<><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.500" cy="8.500" r="1" /></>),
  footer: svg(<><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 15h16" /></>),
  pin: svg(<><rect x="4" y="9" width="16" height="10" rx="2" /><path d="M8 5h8" /></>),
}
const SECTION_ICON: Record<string, ReactNode> = {
  'course.header': ICONS.nav, 'professional.nav': ICONS.nav, 'home.nav': ICONS.nav,
  'course.hero': ICONS.hero, 'professional.hero': ICONS.hero, 'home.hero': ICONS.hero,
  'home.professionals': ICONS.grid, 'course.facts': ICONS.grid, 'professional.stats': ICONS.grid,
  'home.courses': ICONS.content, 'professional.courses': ICONS.content, 'course.curriculum': ICONS.content, 'course.deliverables': ICONS.content,
  'course.benefits': ICONS.star, 'home.benefits': ICONS.star, 'course.guarantee': ICONS.star,
  'home.brands': ICONS.image, 'professional.works': ICONS.image,
  'professional.video': ICONS.video,
  'course.proof': ICONS.quote, 'professional.bio': ICONS.person, 'course.instructor': ICONS.person,
  'course.faq': ICONS.help, 'course.offer': ICONS.tag, 'course.checkout': ICONS.tag,
  'home.cta': ICONS.image, 'course.final-cta': ICONS.image, 'professional.cta': ICONS.image,
  'home.footer': ICONS.footer, 'course.footer': ICONS.footer, 'professional.footer': ICONS.footer,
  'course.sticky-cta': ICONS.pin,
}
const EyeIcon = ({ off }: { off?: boolean }) => svg(<><path d="M2 12s3.600-7 10-7 10 7 10 7-3.600 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{off ? <path d="M4 4l16 16" /> : null}</>)
const VIEWPORT_ICON = {
  desktop: svg(<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>),
  tablet: svg(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M11 18h2" /></>),
  mobile: svg(<><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" /></>),
}

const SECTION_DESC: Record<string, string> = {
  'home.nav': 'Menu principal', 'home.hero': 'Destaque principal', 'home.professionals': 'Lista de profissionais', 'home.courses': 'Cursos em destaque',
  'home.benefits': 'Diferenciais', 'home.brands': 'Marcas e parceiros', 'home.cta': 'Conversão', 'home.footer': 'Informações finais',
  'professional.nav': 'Menu principal', 'professional.hero': 'Destaque principal', 'professional.bio': 'História e trajetória', 'professional.works': 'Galeria de trabalhos',
  'professional.video': 'Vídeo de apresentação', 'professional.stats': 'Números do profissional', 'professional.cta': 'Chamada para ação', 'professional.courses': 'Cursos do profissional',
  'professional.footer': 'Informações finais',
  'course.header': 'Menu principal', 'course.hero': 'Destaque principal', 'course.facts': 'Dados do curso', 'course.benefits': 'Diferenciais', 'course.curriculum': 'Módulos e aulas',
  'course.deliverables': 'Entregáveis', 'course.instructor': 'Quem ensina', 'course.proof': 'Prova social', 'course.offer': 'Preço e compra', 'course.faq': 'Dúvidas comuns',
  'course.checkout': 'Finalização', 'course.guarantee': 'Garantia', 'course.final-cta': 'Conversão', 'course.footer': 'Informações finais', 'course.sticky-cta': 'Barra fixa de compra',
}
const HOME_ICON = svg(<path d="m3 11 9-8 9 8M5 10v10h5v-6h4v6h5V10" />)
const CLOUD_ICON = svg(<><path d="M7 18a4 4 0 0 1-.5-7.970A6 6 0 0 1 18 9a4.500 4.500 0 0 1 0 9" /><path d="m12 12-3 3m3-3 3 3m-3-3v8" /></>)
const FULL_ICON = svg(<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />)
const CHEVRON = svg(<path d="m6 9 6 6 6-6" />)

/** Miniatura da seção (captura gerada por `pnpm --filter @academia/web section-thumbs`); sem arquivo, mostra o ícone do tipo. */
function SectionThumb({ type }: { type: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span className="ed-icon" aria-hidden="true">{SECTION_ICON[type] ?? ICONS.content}</span>
  // eslint-disable-next-line @next/next/no-img-element
  // A imagem pode falhar antes de o React ligar o onError (renderização no servidor): confere ao montar.
  const check = (img: HTMLImageElement | null) => { if (img?.complete && img.naturalWidth === 0) setFailed(true) }
  return <img ref={check} className="ed-thumb" src={`/admin/section-thumbs/${type}.jpg`} alt="" width={70} height={46} loading="lazy" onError={() => setFailed(true)} />
}

/** Menu suspenso: fecha com Esc e clique fora. */
function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [open])
  return { open, setOpen, ref }
}

const jsonSchemaCache = new Map<string, JsonSchema>()
const jsonSchemaOf = (type: string): JsonSchema | null => {
  const meta = metaFor(type)
  if (!meta) return null
  let cached = jsonSchemaCache.get(type)
  if (!cached) {
    cached = z.toJSONSchema(meta.schema, { unrepresentable: 'any', io: 'input' }) as JsonSchema
    jsonSchemaCache.set(type, cached)
  }
  return cached
}

/** "sections.3.content.portrait.src: URL não permitida" → "Trajetória › portrait › src: URL não permitida". */
function friendlyError(raw: string, doc: PageDocument): string {
  const m = /^sections\.(\d+)\.(?:content\.)?(.*?): (.*)$/.exec(raw)
  if (!m) return raw
  const section = doc.sections[Number(m[1])]
  const label = (section && metaFor(section.type)?.label) ?? 'Seção'
  const path = (m[2] ?? '').split('.').filter(Boolean).join(' › ')
  return `${label}${path ? ` › ${path}` : ''}: ${m[3]}`
}

export function Editor(props: EditorProps) {
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm()
  const { kind, id, library, templateKey } = props
  // Situação da página: muda ao publicar sem recarregar o editor (menu Despublicar, botão Ver página).
  const [status, setStatus] = useState(props.status)
  const [publishPhase, setPublishPhase] = useState<PublishPhase>(null)
  // Aviso "Não publicado" (pendências): só informa; a lista fica no painel lateral.
  const [blockedNotice, setBlockedNotice] = useState(false)
  const editable = props.canWrite && status !== 'archived'
  const rules = useMemo(() => editorRules(templateKey), [templateKey])
  const base = kind === 'professional' ? `/admin/professionals/${id}` : kind === 'course' ? `/admin/courses/${id}` : '/admin/home'

  const [history, setHistory] = useState<History>(() => createHistory(props.initial))
  const doc = history.present
  const [selectedId, setSelectedId] = useState<string | null>(props.initial.sections[0]?.id ?? null)
  const [notice, setNotice] = useState<string | null>(null)
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [panel, setPanel] = useState<'none' | 'history' | 'settings' | 'issues'>('none')
  const [confirm, setConfirm] = useState<null | { kind: 'reset' } | { kind: 'restore'; version: number }>(null)
  const [cadastro, setCadastro] = useState(props.cadastro)
  // Pendências da última tentativa de publicar; a oferta só é reconferida pelo servidor (ver OFFER_FIELDS).
  const [serverIssues, setServerIssues] = useState<ReadinessIssue[]>([])
  const [offerTouched, setOfferTouched] = useState(false)
  const [settingsFocus, setSettingsFocus] = useState<SettingsFocus>(null)
  // Revisão atual do cadastro: a página também o grava (editor único), e restaurar uma versão precisa dela.
  const cadastroRevision = useRef(props.cadastroRevision)
  // Sequência dos pedidos de foco vindos das pendências (cada clique precisa de um valor novo).
  const focusSeq = useRef(0)
  const [publishMsg, setPublishMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [versions, setVersions] = useState<DocumentVersion[]>(props.versions)
  // Visão do painel de propriedades: uma seção por vez ou todas empilhadas. A escolha fica só neste navegador.
  const [tab, setTab] = useState<'content' | 'style' | 'advanced'>('content')
  const moreMenu = usePopover()
  const addMenu = usePopover()
  const [view, setView] = useState<'section' | 'all'>('section')
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(props.initial.sections[0] ? [props.initial.sections[0].id] : []))

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const previewReady = useRef(false)
  const previewPane = useRef<HTMLDivElement>(null)
  // Rolar a página até a seção só quando a escolha vem da lista (clicar na própria página não deve mover a tela).
  const scrollNext = useRef(false)
  const [full, setFull] = useState(false)
  const lastFocusedSection = useRef<string | null>(null)
  const [pendingFocus, setPendingFocus] = useState<{ sectionId: string; path: string | null; n: number } | null>(null)

  // Validação e pré-visualização acompanham o documento com atraso curto: digitar não trava a interface.
  const deferredDoc = useDeferredValue(doc)
  const validation = useMemo(() => validatePageDocument(deferredDoc), [deferredDoc])
  const errors = useMemo(() => (validation.ok ? [] : validation.errors), [validation])

  const autosave = useAutosave({
    doc,
    initialSaved: props.initial,
    initialRevision: props.documentRevision,
    enabled: editable,
    validate: (d) => validatePageDocument(d).ok,
    put: async (d, revision) => {
      const res = await apiSend<{ documentRevision: number; revision?: number; code?: string }>('PUT', `${base}/document`, { document: d, revision })
      if (res.ok && typeof res.data?.revision === 'number') cadastroRevision.current = res.data.revision
      return res
    },
    getServer: () => apiGet<{ document: unknown; documentRevision: number }>(`${base}/document`),
  })
  const saveState = autosave.state

  useEffect(() => {
    try { const v = window.localStorage.getItem('academia-editor-view'); if (v === 'all' || v === 'section') setView(v) } catch { /* sem armazenamento: segue o padrão */ }
  }, [])
  const chooseView = (v: 'section' | 'all') => {
    setView(v)
    try { window.localStorage.setItem('academia-editor-view', v) } catch { /* só conveniência */ }
  }
  const toggleOpen = (sectionId: string) => setOpenIds((prev) => { const next = new Set(prev); if (next.has(sectionId)) next.delete(sectionId); else next.add(sectionId); return next })
  // Na visão "Todos", escolher uma seção na lista abre o bloco dela e leva até ele.
  useEffect(() => {
    if (view !== 'all' || !selectedId) return
    setOpenIds((prev) => (prev.has(selectedId) ? prev : new Set(prev).add(selectedId)))
    document.getElementById(`ed-sec-${selectedId}`)?.scrollIntoView({ block: 'nearest' })
  }, [selectedId, view])

  // Focar um campo marca a seção dele na página (e leva a página até ela), inclusive na visão "Todos os elementos".
  const onFieldFocus = (sectionId: string) => {
    if (lastFocusedSection.current === sectionId) return
    lastFocusedSection.current = sectionId
    if (sectionId !== selectedId) { scrollNext.current = true; setSelectedId(sectionId) }
    else postToPreview({ type: EDITOR_FOCUS, sectionId, scroll: true })
  }
  const selectSection = (sectionId: string) => {
    lastFocusedSection.current = sectionId
    // Escolher uma seção mostra o formulário dela: fecha Configurações/Pendências, que ocupam o mesmo painel.
    setPanel((p) => (p === 'settings' || p === 'issues' ? 'none' : p))
    setTab('content')
    if (sectionId === selectedId) { postToPreview({ type: EDITOR_FOCUS, sectionId, scroll: true }); return }
    scrollNext.current = true
    setSelectedId(sectionId)
  }

  const selected = doc.sections.find((s) => s.id === selectedId) ?? null
  const selectedSchema = selected ? jsonSchemaOf(selected.type) : null

  /* --------------------------- pendências de publicação -------------------------- */
  // O que ainda falta segundo a página atual (editor único: o cadastro recebe os campos da página ao salvar).
  const localIssueFields = useMemo(() => {
    if (!cadastro) return new Set<string>()
    const issues = cadastro.kind === 'professional'
      ? publishReadiness(syncDataFromDocument('professional', cadastro.value.data, deferredDoc).data)
      : courseReadiness(syncDataFromDocument('course', cadastro.value.data, deferredDoc).data)
    return new Set(issues.map((i) => i.field))
  }, [cadastro, deferredDoc])
  const issues: PublishIssue[] = serverIssues.map((i) => ({
    ...i,
    // Profissional não publicado: só a próxima tentativa confirma (ele é publicado no editor dele).
    resolved: i.field === 'professionalId' ? false : OFFER_FIELDS.has(i.field) ? offerTouched : !localIssueFields.has(i.field),
  }))

  // Onde ainda há pendência: marca a seção na lista (a primeira do tipo, a que alimenta o cadastro) e o botão Configurações.
  const pendingPlaces = { sections: new Map<string, number>(), settings: 0 }
  if (cadastro) {
    for (const i of issues) {
      if (i.resolved) continue
      const loc = locateField(cadastro.kind, i.field)
      if ('settings' in loc) pendingPlaces.settings += 1
      else pendingPlaces.sections.set(loc.section, (pendingPlaces.sections.get(loc.section) ?? 0) + 1)
    }
  }
  const pendingFor = (sectionId: string, type: string) =>
    doc.sections.find((x) => x.type === type)?.id === sectionId ? pendingPlaces.sections.get(type) ?? 0 : 0

  /** Leva à seção (e ao campo) onde a pendência se resolve, ou ao painel Configurações. */
  const goToIssue = (field: string) => {
    if (!cadastro) return
    const loc = locateField(cadastro.kind, field)
    if ('settings' in loc) {
      setPanel('settings')
      setSettingsFocus({ field, n: ++focusSeq.current })
      return
    }
    let section = doc.sections.find((s) => s.type === loc.section)
    if (!section) {
      const fromLibrary = library.sections.find((s) => s.type === loc.section)
      // Volta visível: a seção removida/oculta não conta para publicar.
      if (!fromLibrary || !editable || !apply(addSection(doc, { ...structuredClone(fromLibrary), visibility: { enabled: true } }, insertIndexFor(loc.section), rules))) return
      section = fromLibrary
    } else if (!section.visibility.enabled && editable) {
      apply(reveal(doc, section.id))
    }
    setPanel('none')
    setTab('content')
    if (view === 'all') setOpenIds((prev) => new Set(prev).add(section.id))
    lastFocusedSection.current = section.id
    scrollNext.current = true
    setSelectedId(section.id)
    setPendingFocus({ sectionId: section.id, path: loc.path, n: ++focusSeq.current })
  }

  /* ------------------------------- comandos ------------------------------- */
  const apply = useCallback((result: EditResult, coalesceKey?: string) => {
    if (!result.ok) { setNotice(ERROR_TEXT(result.error)); return false }
    setNotice(null)
    setHistory((h) => commit(h, result.doc, { coalesceKey }))
    return true
  }, [])

  const run = (fn: (d: PageDocument) => EditResult, key?: string) => { if (editable) apply(fn(doc), key) }
  /**
   * Mostra uma seção oculta. No curso, se a lista dela ainda tem só o exemplo do template (texto de outro curso), troca
   * pelo item provisório: o exemplo não pode parecer, nem contar como, conteúdo do curso.
   */
  const reveal = (d: PageDocument, sectionId: string): EditResult => {
    const shown = setVisibility(d, sectionId, true)
    if (!shown.ok || kind !== 'course') return shown
    const section = shown.doc.sections.find((x) => x.id === sectionId)
    const cleaned = section ? withoutTemplateSamples(section.type, section.content) : null
    return cleaned ? updateContent(shown.doc, sectionId, cleaned) : shown
  }

  const insertIndexFor = (type: string): number => {
    const order = library.sections.map((s) => s.type)
    const at = order.indexOf(type)
    for (let i = at - 1; i >= 0; i -= 1) {
      const present = doc.sections.findIndex((s) => s.type === order[i])
      if (present !== -1) return present + 1
    }
    return 0
  }
  const missing = library.sections.filter((s) => !doc.sections.some((d) => d.type === s.type))
  // Tipos repetíveis (D-031) que já estão na página e ainda não chegaram ao limite: podem ganhar outra instância.
  const again = library.sections.filter((s) => isRepeatable(s.type) && doc.sections.some((d) => d.type === s.type) && doc.sections.filter((d) => d.type === s.type).length < MAX_PER_REPEATABLE_TYPE)
  const addAgain = (type: string) => {
    const base = library.sections.find((s) => s.type === type)
    if (!base) return
    const copy = { ...structuredClone(base), id: newSectionId(doc, type) }
    const last = doc.sections.map((d) => d.type).lastIndexOf(type)
    if (apply(addSection(doc, copy, last + 1, rules))) setSelectedId(copy.id)
  }
  const duplicate = (sectionId: string, type: string) => {
    const newId = newSectionId(doc, type)
    if (apply(duplicateSection(doc, sectionId, rules))) setSelectedId(newId)
  }
  const addMissing = (type: string) => {
    const section = library.sections.find((s) => s.type === type)
    if (!section) return
    if (apply(addSection(doc, structuredClone(section), insertIndexFor(type), rules))) setSelectedId(section.id)
  }

  // Quais botões ↑/↓ estão disponíveis (calculado uma vez por documento, não a cada render).
  const moves = useMemo(() => doc.sections.map((s, index) => ({
    up: index > 0 && moveSection(doc, s.id, index - 1, rules).ok,
    down: index < doc.sections.length - 1 && moveSection(doc, s.id, index + 1, rules).ok,
  })), [doc, rules])

  /* --------------------------- desfazer / refazer -------------------------- */
  const doUndo = useCallback(() => setHistory((h) => undo(h)), [])
  const doRedo = useCallback(() => setHistory((h) => redo(h)), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable]')) return // o campo tem o desfazer nativo
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo() }
      else if (e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doUndo, doRedo])

  // Depois de clicar num elemento da página: mostra o painel certo e leva o cursor ao campo correspondente.
  useEffect(() => {
    if (!pendingFocus) return
    const timer = window.setTimeout(() => {
      const scope = view === 'all' ? document.getElementById(`ed-sec-${pendingFocus.sectionId}`) : document.querySelector('.ed-section-panel')
      const field = pendingFocus.path ? scope?.querySelector<HTMLElement>(`[data-field-path="${CSS.escape(pendingFocus.path)}"]`) : null
      // Numa lista, o primeiro controle é a seta "mover" (desativada no 1º item): o cursor vai para o primeiro campo editável.
      const control = field?.matches('input, textarea, select, button') ? field : (field?.querySelector<HTMLElement>(TEXT_FIELD) ?? field?.querySelector<HTMLElement>('select:not(:disabled), button:not(:disabled)'))
      field?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      control?.focus({ preventScroll: true })
      field?.setAttribute('data-flash', '')
      window.setTimeout(() => field?.removeAttribute('data-flash'), 1400)
    }, 80)
    return () => window.clearTimeout(timer)
  }, [pendingFocus, view])

  // Tela cheia da pré-visualização: usa a API do navegador quando existe e mantém o estado em sincronia com ela (Esc sai).
  useEffect(() => {
    const onChange = () => { if (!document.fullscreenElement) setFull(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false) }
    document.addEventListener('fullscreenchange', onChange)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('fullscreenchange', onChange); window.removeEventListener('keydown', onKey) }
  }, [])
  const toggleFull = () => {
    const next = !full
    setFull(next)
    if (next) void previewPane.current?.requestFullscreen?.().catch(() => undefined)
    else if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
  }

  const selectedIndex = selected ? doc.sections.findIndex((s) => s.id === selected.id) : -1
  // Pendências de publicação que se resolvem nesta seção (com a dica de qual campo preencher).
  const selectedIssues = selected && cadastro
    ? issues.flatMap((i) => {
      if (i.resolved) return []
      const loc = locateField(cadastro.kind, i.field)
      return 'section' in loc && loc.section === selected.type ? [{ ...i, hint: loc.hint, path: loc.path }] : []
    })
    : []
  const pendingPaths = selectedIssues.map((i) => i.path).filter((p): p is string => Boolean(p)).join('|')

  // Campos pendentes ficam marcados no formulário até serem preenchidos (o destaque do foco some em 1,4 s).
  useEffect(() => {
    const scope = window.document.querySelector('.ed-props')
    if (!scope) return
    scope.querySelectorAll('[data-pending-field]').forEach((el) => el.removeAttribute('data-pending-field'))
    for (const path of pendingPaths ? pendingPaths.split('|') : []) {
      scope.querySelector(`[data-field-path="${CSS.escape(path)}"]`)?.setAttribute('data-pending-field', '')
    }
  }, [pendingPaths, selectedId, tab, view, panel])

  /** Campo focado no formulário → a pré-visualização rola até ele e mostra a moldura com o nome do campo. */
  const showFieldInPreview = (sectionId: string, target: EventTarget) => {
    const box = (target as HTMLElement | null)?.closest?.('[data-field-path]')
    const path = box?.getAttribute('data-field-path')
    const section = path ? doc.sections.find((x) => x.id === sectionId) : null
    if (!box || !path || !section) return
    const name = box.querySelector('.ds-label, legend')?.textContent?.replace(/\(\d+(\/\d+)?\)/, '').trim() || 'Campo'
    const label = box.hasAttribute('data-pending-field') ? `Pendente · ${name}` : name
    const anchor = fieldAnchor(section.content, path)
    if (!anchor.texts.length && !anchor.srcs.length) return
    // Depois da troca de seção (que limpa a moldura no quadro), não antes.
    window.setTimeout(() => postToPreview({ type: EDITOR_FIELD, sectionId, ...anchor, label }), 250)
  }
  const selectedErrors = errors.filter((e) => e.startsWith(`sections.${selectedIndex}.`))
  const errorSections = new Set(errors.map((e) => Number(/^sections\.(\d+)\./.exec(e)?.[1])).filter((n) => !Number.isNaN(n)))

  /* ------------------------------ pré-visualização ------------------------- */
  const post = useCallback(() => {
    if (!validation.ok) return
    iframeRef.current?.contentWindow?.postMessage({ type: EDITOR_MESSAGE, document: deferredDoc }, window.location.origin)
  }, [deferredDoc, validation])
  useEffect(() => { if (previewReady.current) post() }, [post])
  const postToPreview = useCallback((message: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(message, window.location.origin)
  }, [])
  // Destaque (e rolagem) da seção selecionada na página; refeito quando a página termina de carregar.
  const postFocus = useCallback(() => {
    postToPreview({ type: EDITOR_FOCUS, sectionId: selectedId, scroll: scrollNext.current })
    scrollNext.current = false
  }, [postToPreview, selectedId])
  useEffect(() => { if (previewReady.current) postFocus() }, [postFocus])
  useEffect(() => { postToPreview({ type: EDITOR_INTERACTIVE, on: !full }) }, [full, postToPreview])
  const pickRef = useRef<(info: PickInfo) => void>(() => undefined)
  pickRef.current = (info) => {
    const section = doc.sections.find((x) => x.id === info.sectionId)
    if (!section || !editable) return
    setPanel((p) => (p === 'settings' || p === 'issues' ? 'none' : p))
    setSelectedId(section.id)
    setTab('content')
    if (view === 'all') setOpenIds((prev) => new Set(prev).add(section.id))
    setPendingFocus({ sectionId: section.id, path: findFieldPath(section.content, info), n: Date.now() })
  }
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== iframeRef.current?.contentWindow) return
      const data = e.data as { type?: string } & Partial<PickInfo>
      if (data?.type === 'academia-editor-ready') { previewReady.current = true; post(); postFocus(); postToPreview({ type: EDITOR_INTERACTIVE, on: !full }) }
      if (data?.type === EDITOR_PICK && data.sectionId) pickRef.current({ sectionId: data.sectionId, texts: data.texts ?? [], srcs: data.srcs ?? [] })
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [post, postFocus, postToPreview, full])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (!autosave.isSaved() && saveState !== 'conflict') e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [autosave, saveState])

  /* ------------------------------- ações --------------------------------- */
  const loadVersions = useCallback(async () => {
    const res = await apiGet<{ items: DocumentVersion[] }>(`${base}/document/versions`)
    if (res.ok && res.data) setVersions(res.data.items)
  }, [base])

  // Cria uma cópia em rascunho (com o que está na tela salvo antes) e abre o editor dela.
  const duplicatePage = async () => {
    if (busy || kind === 'home') return
    setBusy(true)
    try {
      if (!(await autosave.ensureSaved())) { setNotice('Não foi possível salvar antes de duplicar. Veja o aviso acima.'); return }
      const res = await apiSend<{ id: number }>('POST', `${base}/duplicate`)
      if (!res.ok || !res.data) { setNotice(res.status === 403 ? 'Você não tem permissão para duplicar.' : res.status === 0 ? 'Sem conexão com o servidor. Tente novamente.' : `Não foi possível duplicar (código ${res.status}).`); return }
      window.location.assign(`/admin/editor/${kind === 'course' ? 'cursos' : 'profissionais'}/${res.data.id}`)
    } finally {
      setBusy(false)
    }
  }

  // Tira do ar (volta a rascunho, conteúdo preservado) e recarrega para refletir a situação.
  const unpublishPage = async () => {
    if (busy || kind === 'home') return
    if (!(await askConfirm({ title: 'Despublicar a página?', message: 'A página sai do site; o conteúdo continua salvo como rascunho.', confirmLabel: 'Despublicar' }))) return
    setBusy(true)
    try {
      const res = await apiSend('POST', `${base}/unpublish`)
      if (!res.ok) { setNotice(res.status === 403 ? 'Você não tem permissão para despublicar.' : `Não foi possível despublicar (código ${res.status}).`); return }
      window.location.reload()
    } finally {
      setBusy(false)
    }
  }

  const publish = async () => {
    if (busy) return
    setBusy(true)
    setPublishMsg(null)
    let succeeded = false
    try {
      // Garante que o servidor tem exatamente o que está na tela antes de publicar.
      if (!autosave.isSaved()) setPublishPhase('saving')
      if (!(await autosave.ensureSaved())) { setPublishMsg('Não foi possível salvar as alterações antes de publicar. Veja o aviso acima.'); return }
      setPublishPhase('publishing')
      // Tempo mínimo da animação: uma resposta rápida não pode virar um piscar de tela que ninguém percebe.
      const [res] = await Promise.all([
        apiSend<{ code?: string; message?: string; errors?: ReadinessIssue[] }>('POST', `${base}/publish`),
        new Promise((r) => setTimeout(r, 900)),
      ])
      if (res.ok) {
        succeeded = true
        setServerIssues([])
        setPanel((p) => (p === 'issues' ? 'none' : p))
        setStatus('published')
        setPublishPhase('done')
        void loadVersions()
      }
      else if (res.status === 422 && res.data?.code === 'not_ready' && cadastro && res.data.errors?.length) {
        // Editor único: as pendências ficam aqui; cada uma leva à seção (ou às Configurações) onde se resolve.
        setServerIssues(res.data.errors)
        setOfferTouched(false)
        setPanel('issues')
        setBlockedNotice(true)
      }
      else if (res.status === 0) setPublishMsg('Sem conexão com o servidor. Tente publicar novamente.')
      else if (res.status === 401) setPublishMsg('Sua sessão expirou. Entre novamente para publicar.')
      else setPublishMsg([res.data?.message ?? `Falha ao publicar (código ${res.status}).`, ...(res.data?.errors ?? []).map((e) => e.message)].join(' · '))
    } finally {
      if (!succeeded) setPublishPhase(null)
      setBusy(false)
    }
  }
  const closePublished = useCallback(() => setPublishPhase(null), [])
  const closeBlocked = useCallback(() => setBlockedNotice(false), [])

  /** Operações que trocam o documento no servidor (restaurar): suspendem o autosave e recarregam a tela. */
  const replaceOnServer = async (call: () => Promise<{ ok: boolean; status: number }>) => {
    if (busy) return
    setBusy(true)
    const resume = autosave.pause()
    try {
      const res = await call()
      if (res.ok) { window.location.reload(); return }
      resume()
      setConfirm(null)
      setNotice(res.status === 409 ? 'Conflito: o cadastro ou a página mudou. Recarregue para continuar.' : res.status === 0 ? 'Sem conexão com o servidor. Tente novamente.' : res.status === 401 ? 'Sua sessão expirou. Entre novamente.' : `Não foi possível concluir (código ${res.status}).`)
    } finally {
      setBusy(false)
    }
  }
  /**
   * Troca o modelo da página do profissional: descarta o documento (a página volta a ser montada do cadastro, que já tem
   * os campos da página sincronizados) e grava o novo modelo. Recarrega o editor no fim.
   */
  const changeTemplate = async (next: string) => {
    if (kind !== 'professional') return
    if (!(await askConfirm({ title: 'Trocar o modelo da página?', message: 'A página é recriada no novo modelo com a frase, o retrato, a trajetória, o Instagram, os trabalhos e o vídeo atuais. Ajustes de layout e textos extras das seções (títulos, ordem, fundos) são descartados.', confirmLabel: 'Trocar modelo', tone: 'danger' }))) return
    await replaceOnServer(async () => {
      if (autosave.revisionRef.current > 0) {
        const cleared = await apiSend('DELETE', `${base}/document`, { revision: autosave.revisionRef.current })
        if (!cleared.ok) return cleared
      }
      const fresh = await apiGet<AdminProfessional>(base)
      if (!fresh.ok || !fresh.data) return fresh
      return apiSend('PUT', base, { data: fresh.data.data, revision: fresh.data.revision, templateKey: next })
    })
  }
  const resetToRegistry = () => replaceOnServer(() => apiSend('DELETE', `${base}/document`, { revision: autosave.revisionRef.current }))
  const restoreVersion = (version: number) => replaceOnServer(() => apiSend('POST', `${base}/document/versions/${version}/restore`, { revision: autosave.revisionRef.current, ...(kind === 'home' ? {} : { dataRevision: cadastroRevision.current }) }))

  // Endereço público da página (depois de publicar, "Ver página" leva ao site, não à pré-visualização).
  const publicHref = kind === 'home' || !cadastro ? '/' : `/${cadastro.kind === 'course' ? 'cursos' : 'profissionais'}/${cadastro.value.slug}`
  const frameWidth = viewport === 'desktop' ? '100%' : viewport === 'tablet' ? '820px' : '390px'
  const previewSrc = kind === 'home' ? '/admin/preview/home/live' : `/admin/preview/${kind === 'professional' ? 'profissionais' : 'cursos'}/${id}/live`
  const blockedBanner: Partial<Record<SaveState, ReactNode>> = {
    conflict: <>Outra pessoa alterou esta página no editor. Suas alterações não foram salvas. <button type="button" className="link-button" onClick={() => window.location.reload()}>Recarregar</button></>,
    auth: <>Sua sessão expirou e as alterações ainda não foram salvas. <a href="/admin/login" target="_blank" rel="noreferrer">Entrar novamente (nova aba)</a> e depois <button type="button" className="link-button" onClick={autosave.retry}>tentar salvar</button>.</>,
    forbidden: <>Você não tem permissão para salvar esta página. <button type="button" className="link-button" onClick={autosave.retry}>Tentar novamente</button></>,
    archived: <>Este item está arquivado: restaure-o para editar. As alterações desta tela não foram salvas.</>,
    error: <>Falha ao salvar; tentando de novo automaticamente. <button type="button" className="link-button" onClick={autosave.retry}>Tentar agora</button></>,
  }

  return (
    <div className="ed">
      {confirmDialog}
      <PublishOverlay phase={publishPhase} publicHref={publicHref} onClose={closePublished} />
      {blockedNotice && !publishPhase ? <PublishBlockedNotice count={issues.filter((i) => !i.resolved).length} onClose={closeBlocked} /> : null}
      <div className="ed-bar" role="toolbar" aria-label="Ações do editor">
        <div className="ed-bar-group">
          <a href={props.backHref} className="link-button ed-back">← Voltar</a>
          <strong className="ed-title">Editar página</strong>
          <span className="ed-chip">{HOME_ICON}{props.title}</span>
          <span className="ed-status" role="status" aria-live="polite" data-state={saveState}><i aria-hidden="true" />{editable ? SAVE_LABEL[saveState] : 'Somente leitura'}</span>
        </div>
        <div className="ed-bar-group">
          <div className="ed-viewports" role="group" aria-label="Largura da pré-visualização">
            {(['desktop', 'tablet', 'mobile'] as const).map((v) => {
              const label = v === 'desktop' ? 'Desktop' : v === 'tablet' ? 'Tablet' : 'Celular'
              return <button key={v} type="button" aria-label={label} title={label} aria-pressed={viewport === v} onClick={() => setViewport(v)}>{VIEWPORT_ICON[v]}</button>
            })}
          </div>
          <button type="button" className="ed-icon-btn" aria-label="Tela cheia" title="Pré-visualizar em tela cheia" onClick={toggleFull}>{FULL_ICON}</button>
          {cadastro ? <button type="button" className="admin-button secondary" aria-pressed={panel === 'settings'} data-pending={pendingPlaces.settings > 0 || undefined} title={pendingPlaces.settings ? `${pendingPlaces.settings} pendência(s) para publicar aqui` : undefined} onClick={() => { setSettingsFocus(null); setPanel(panel === 'settings' ? 'none' : 'settings') }}>Configurações{pendingPlaces.settings ? <span className="ed-pend-dot" aria-hidden="true">{pendingPlaces.settings}</span> : null}</button> : null}
          <a className="admin-button secondary" href={status === 'published' ? publicHref : props.viewHref} target="_blank" rel="noreferrer">Ver página</a>
          <div className="ed-menu" ref={moreMenu.ref}>
            <button type="button" className="admin-button secondary" aria-haspopup="menu" aria-expanded={moreMenu.open} onClick={() => moreMenu.setOpen((v) => !v)}>Mais ações {CHEVRON}</button>
            {moreMenu.open ? (
              <div className="ed-menu-list" role="menu">
                <button type="button" role="menuitem" onClick={() => { doUndo(); moreMenu.setOpen(false) }} disabled={!editable || !canUndo(history)}>Desfazer<small>Ctrl+Z</small></button>
                <button type="button" role="menuitem" onClick={() => { doRedo(); moreMenu.setOpen(false) }} disabled={!editable || !canRedo(history)}>Refazer<small>Ctrl+Shift+Z</small></button>
                {props.canWrite && kind !== 'home' ? <button type="button" role="menuitem" disabled={busy} onClick={() => { moreMenu.setOpen(false); void duplicatePage() }}>{kind === 'course' ? 'Duplicar curso' : 'Duplicar profissional'}<small>Cria um rascunho com o mesmo conteúdo</small></button> : null}
                {props.canPublish && status === 'published' && kind !== 'home' ? <button type="button" role="menuitem" disabled={busy} onClick={() => { moreMenu.setOpen(false); void unpublishPage() }}>Despublicar<small>Tira a página do site e mantém o rascunho</small></button> : null}
                <button type="button" role="menuitem" aria-expanded={panel === 'history'} onClick={() => { if (panel !== 'history') void loadVersions(); setPanel(panel === 'history' ? 'none' : 'history'); moreMenu.setOpen(false) }}>Histórico</button>
                {editable && kind === 'home' ? <button type="button" role="menuitem" disabled={busy} onClick={() => { setConfirm({ kind: 'reset' }); moreMenu.setOpen(false) }}>Restaurar padrão</button> : null}
              </div>
            ) : null}
          </div>
          {props.canPublish && status !== 'archived' ? <button type="button" className="admin-button" onClick={publish} disabled={busy || saveState === 'conflict' || !validation.ok}>{CLOUD_ICON}{busy ? 'Aguarde…' : 'Publicar'}</button> : null}
        </div>
      </div>

      {blockedBanner[saveState] ? <p role="alert" className="ed-banner">{blockedBanner[saveState]}</p> : null}
      {notice ? <p role="alert" className="ed-banner">{notice}</p> : null}
      {publishMsg ? <p role="status" className="ed-banner ed-banner-info">{publishMsg}</p> : null}
      {panel !== 'issues' && issues.some((i) => !i.resolved) ? (
        <p role="status" className="ed-banner ed-banner-info">
          Ainda {issues.filter((i) => !i.resolved).length === 1 ? 'falta 1 item' : `faltam ${issues.filter((i) => !i.resolved).length} itens`} para publicar.{' '}
          <button type="button" className="link-button" onClick={() => setPanel('issues')}>Ver pendências</button>
        </p>
      ) : null}
      {confirm ? (
        <ConfirmBar
          title={confirm.kind === 'reset'
            ? 'Descartar as edições do editor e voltar à Home original?'
            : (kind === 'home' ? `Voltar o rascunho à versão ${confirm.version}?` : `Voltar o rascunho à versão ${confirm.version}? As configurações também voltam ao que estavam nessa versão.`)}
          busy={busy}
          onConfirm={() => (confirm.kind === 'reset' ? resetToRegistry() : restoreVersion(confirm.version))}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
      {status === 'archived' ? <p role="alert" className="ed-banner">Este item está arquivado: restaure-o para editar.</p> : null}

      <div className="ed-body">
        <fieldset className="ed-pane ed-tree" disabled={!editable} aria-label="Seções da página">
          <legend className="ds-label">Seções da página</legend>
          <div className="ed-menu ed-add" ref={addMenu.ref}>
            <button type="button" className="admin-button ed-add-btn" aria-haspopup="menu" aria-expanded={addMenu.open} disabled={missing.length === 0 && again.length === 0} title={missing.length === 0 && again.length === 0 ? 'Todas as seções já estão na página' : undefined} onClick={() => addMenu.setOpen((v) => !v)}>+ Adicionar seção</button>
            {addMenu.open ? (
              <div className="ed-menu-list" role="menu">
                {missing.map((m) => <button key={m.type} type="button" role="menuitem" onClick={() => { addMissing(m.type); addMenu.setOpen(false) }}>{metaFor(m.type)?.label ?? m.type}<small>{SECTION_DESC[m.type] ?? ''}</small></button>)}
                {again.map((m) => <button key={`again-${m.type}`} type="button" role="menuitem" onClick={() => { addAgain(m.type); addMenu.setOpen(false) }}>Outra «{metaFor(m.type)?.label ?? m.type}»<small>Repete esta seção na página (até {MAX_PER_REPEATABLE_TYPE})</small></button>)}
              </div>
            ) : null}
          </div>
          <ul className="ed-list">
            {doc.sections.map((s, index) => {
              const meta = metaFor(s.type)
              const dynamic = props.dynamicTypes.includes(s.type)
              return (
                <li
                  key={s.id}
                  className="ed-item"
                  data-selected={s.id === selectedId || undefined}
                  data-hidden={!s.visibility.enabled || undefined}
                  data-error={errorSections.has(index) || undefined}
                  data-pending={pendingFor(s.id, s.type) > 0 || undefined}
                  draggable={editable}
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.effectAllowed = 'move'; setDragId(s.id) }}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => { if (dragId && dragId !== s.id) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } }}
                  onDrop={(e) => { e.preventDefault(); if (dragId && dragId !== s.id) run((d) => moveSection(d, dragId, index, rules)); setDragId(null) }}
                >
                  <button type="button" className="ed-select" aria-current={s.id === selectedId ? 'true' : undefined} onClick={() => selectSection(s.id)}>
                    <span className="ed-num" aria-hidden="true">{index + 1}</span>
                    <span className="ed-handle" aria-hidden="true">⋮⋮</span>
                    <SectionThumb type={s.type} />
                    <span className="ed-text">
                      <span className="ed-name">{meta?.label ?? s.type}</span>
                      {pendingFor(s.id, s.type) ? <span className="ed-pend-badge" title={`${pendingFor(s.id, s.type)} pendência(s) para publicar`}>Pendente para publicar</span> : null}
                      <small>{SECTION_DESC[s.type] ?? REGION_LABEL[meta?.placement ?? 'main']}{!s.visibility.enabled ? ' · oculta' : ''}{dynamic ? ' · automática' : ''}{errorSections.has(index) ? ' · com erro' : ''}</small>
                    </span>
                  </button>
                  <button type="button" className="ed-eye" disabled={dynamic} aria-pressed={s.visibility.enabled} onClick={() => run((d) => (s.visibility.enabled ? setVisibility(d, s.id, false) : reveal(d, s.id)))} aria-label={`${s.visibility.enabled ? 'Ocultar' : 'Mostrar'} ${meta?.label ?? s.type}`}><EyeIcon off={!s.visibility.enabled} /></button>
                </li>
              )
            })}
          </ul>
        </fieldset>

        <div className="ed-pane ed-preview" ref={previewPane} data-full={full || undefined} data-viewport={viewport} aria-label="Pré-visualização">
          {full ? (
            <div className="ed-full-bar" role="toolbar" aria-label="Tela cheia">
              <div className="ed-viewports" role="group" aria-label="Largura da pré-visualização">
                {(['desktop', 'tablet', 'mobile'] as const).map((v) => {
                  const label = v === 'desktop' ? 'Desktop' : v === 'tablet' ? 'Tablet' : 'Celular'
                  return <button key={v} type="button" aria-label={label} title={label} aria-pressed={viewport === v} onClick={() => setViewport(v)}>{VIEWPORT_ICON[v]}</button>
                })}
              </div>
              <button type="button" className="admin-button secondary" onClick={toggleFull}>Sair da tela cheia</button>
            </div>
          ) : null}
          <iframe ref={iframeRef} title="Pré-visualização da página" src={previewSrc} style={{ width: frameWidth }} />
          {!validation.ok ? <p className="ed-stale" role="status">Pré-visualização desatualizada: há campos inválidos.</p> : null}
        </div>

        <div className="ed-pane ed-props">
          <div className="ed-view" role="group" aria-label="Visão do painel">
            <button type="button" className="admin-button secondary" aria-pressed={view === 'section'} onClick={() => { chooseView('section'); setPanel('none') }}>Por seção</button>
            <button type="button" className="admin-button secondary" aria-pressed={view === 'all'} onClick={() => { chooseView('all'); setPanel('none') }}>Todos os elementos</button>
          </div>
          {panel === 'settings' && cadastro ? (
            <section className="ed-panel-head-wrap" aria-labelledby="ed-settings-title">
              <div className="ed-panel-head">
                <div>
                  <h2 id="ed-settings-title" className="ed-h2">Configurações</h2>
                  <p className="ed-cfg-desc">O que não aparece na página: identidade, {cadastro.kind === 'course' ? 'oferta' : 'foto do cartão'}, buscadores e vitrine.</p>
                </div>
                <button type="button" className="link-button" onClick={() => setPanel(serverIssues.length ? 'issues' : 'none')}>{serverIssues.length ? '← Pendências' : '← Seções'}</button>
              </div>
              {cadastro.kind === 'professional' ? (
                <ProfessionalSettings cadastro={cadastro.value} canWrite={props.canWrite} canPublish={props.canPublish} focus={settingsFocus}
                  templateKey={templateKey} onChangeTemplate={(next) => void changeTemplate(next)}
                  onSaved={(next) => { cadastroRevision.current = next.revision; setCadastro({ kind: 'professional', value: next }) }} />
              ) : (
                <CourseSettings cadastro={cadastro.value} canWrite={props.canWrite} canPublish={props.canPublish} canCommerce={Boolean(props.canCommerce)} focus={settingsFocus}
                  onSaved={(next) => { cadastroRevision.current = next.revision; setCadastro({ kind: 'course', value: { ...next, commercial: next.commercial ?? (cadastro.value as AdminCourse).commercial } }) }}
                  onOfferSaved={(commercial) => { setOfferTouched(true); setCadastro((c) => (c && c.kind === 'course' ? { kind: 'course', value: { ...c.value, commercial } } : c)) }} />
              )}
            </section>
          ) : panel === 'issues' && cadastro ? (
            <PublishIssues kind={cadastro.kind} issues={issues} doc={doc} busy={busy} canPublish={props.canPublish}
              onGo={goToIssue} onPublish={() => void publish()} onClose={() => setPanel('none')} />
          ) : panel === 'history' ? (
            <section aria-label="Histórico de versões">
              <h2 className="ed-h2">Versões publicadas</h2>
              {versions.length === 0 ? <p className="wizard-hint">Nenhuma publicação ainda.</p> : (
                <ul className="ed-versions">
                  {versions.map((v) => (
                    <li key={v.version}>
                      <span>Versão {v.version}{v.current ? ' (no ar)' : ''}<small> · {new Date(v.createdAt).toLocaleString('pt-BR')}{v.hasDocument ? '' : kind === 'home' ? ' · Home original' : ' · página automática'}</small></span>
                      {editable ? <button type="button" className="link-button" onClick={() => setConfirm({ kind: 'restore', version: v.version })}>Restaurar no rascunho</button> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : view === 'all' ? (
            <div className="ed-all">
              <div className="ed-all-bar">
                <strong className="ed-h2">Todos os elementos</strong>
                <span className="ed-actions">
                  <button type="button" className="link-button" onClick={() => setOpenIds(new Set(doc.sections.map((x) => x.id)))}>Expandir tudo</button>
                  <button type="button" className="link-button" onClick={() => setOpenIds(new Set())}>Recolher tudo</button>
                </span>
              </div>
              {doc.sections.map((s, index) => {
                const schema = jsonSchemaOf(s.type)
                const open = openIds.has(s.id)
                const sectionErrors = errors.filter((e) => e.startsWith(`sections.${index}.`))
                return (
                  <section key={s.id} id={`ed-sec-${s.id}`} onFocusCapture={(e) => { onFieldFocus(s.id); showFieldInPreview(s.id, e.target) }} className="ed-acc" data-selected={s.id === selectedId || undefined} data-error={sectionErrors.length ? true : undefined}>
                    <h3>
                      <button type="button" className="ed-acc-head" aria-expanded={open} aria-controls={`ed-sec-body-${s.id}`} onClick={() => { selectSection(s.id); toggleOpen(s.id) }}>
                        <span>{open ? '▾' : '▸'} {metaFor(s.type)?.label ?? s.type}</span>
                        <small>{!s.visibility.enabled ? 'oculta' : sectionErrors.length ? 'com erro' : ''}</small>
                      </button>
                    </h3>
                    {open ? (
                      <fieldset id={`ed-sec-body-${s.id}`} disabled={!editable} className="ed-form ed-acc-body">
                        <legend className="sr-only">{metaFor(s.type)?.label ?? s.type}</legend>
                        {sectionErrors.length ? <ul role="alert" className="form-error ed-errors">{sectionErrors.map((e) => <li key={e}>{friendlyError(e, deferredDoc)}</li>)}</ul> : null}
                        {schema ? (
                          <SchemaForm schema={schema} value={s.content} onChange={(next) => run((d) => updateContent(d, s.id, next), `content:${s.id}`)} />
                        ) : <p className="wizard-hint">Esta seção não tem campos editáveis.</p>}
                      </fieldset>
                    ) : null}
                  </section>
                )
              })}
              <p className="wizard-hint">Duplicar seções não está disponível neste template (cada seção tem âncoras próprias).</p>
            </div>
          ) : selected && selectedSchema ? (
            <div className="ed-section-panel" onFocusCapture={(e) => { onFieldFocus(selected.id); showFieldInPreview(selected.id, e.target) }}>
              <div className="ed-current">
                <span className="ed-current-num" aria-hidden="true">{selectedIndex + 1}</span>
                <div>
                  <p className="ed-current-kicker">Editando seção {selectedIndex + 1} de {doc.sections.length}</p>
                  <h2 className="ed-h2">{metaFor(selected.type)?.label ?? selected.type}</h2>
                </div>
              </div>
              <p className="ed-sub">Configure o conteúdo e o estilo desta seção.</p>
              <div className="ed-tabs" role="tablist" aria-label="Abas da seção">
                {([['content', 'Conteúdo'], ['style', 'Estilo'], ['advanced', 'Avançado']] as const).map(([key, label]) => (
                  <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>
                ))}
              </div>
              {tab === 'content' ? (
                <fieldset disabled={!editable} className="ed-form">
                  <legend className="sr-only">{metaFor(selected.type)?.label ?? selected.type}</legend>
                  {selectedIssues.length ? (
                    <div className="ed-pending-note" role="status">
                      <strong>Para publicar</strong>
                      <ul>{selectedIssues.map((i) => <li key={i.field}>{i.message}.{i.hint ? ` ${i.hint}` : ''}</li>)}</ul>
                    </div>
                  ) : null}
                  {!selected.visibility.enabled && !props.dynamicTypes.includes(selected.type) ? (
                    <p className="ed-hidden-note" role="status">
                      Esta seção está oculta: não aparece na página{kind !== 'home' ? ' e o conteúdo dela não conta para publicar' : ''}.{' '}
                      <button type="button" className="link-button" onClick={() => run((d) => reveal(d, selected.id))}>Mostrar seção</button>
                    </p>
                  ) : null}
                  {selectedErrors.length ? (
                    <ul role="alert" className="form-error ed-errors">{selectedErrors.map((e) => <li key={e}>{friendlyError(e, deferredDoc)}</li>)}</ul>
                  ) : null}
                  <SchemaForm
                    schema={selectedSchema}
                    value={selected.content}
                    onChange={(next) => run((d) => updateContent(d, selected.id, next), `content:${selected.id}`)}
                  />
                </fieldset>
              ) : tab === 'style' ? (
                backgroundsFor(templateKey, selected.type).length > 0 ? (
                  <fieldset disabled={!editable} className="ed-form ed-style">
                    <legend className="ds-label">Fundo da seção</legend>
                    <div className="ed-bg-options" role="radiogroup" aria-label="Fundo da seção">
                      {[undefined, ...backgroundsFor(templateKey, selected.type)].map((tone) => {
                        const info = tone ? BACKGROUND_INFO[tone] : { label: 'Padrão do modelo', hint: 'Sem alteração' }
                        return (
                          <label key={tone ?? 'default'} className="ed-bg-opt" data-selected={selected.settings.background === tone || undefined}>
                            <input type="radio" name={`bg-${selected.id}`} checked={selected.settings.background === tone} onChange={() => run((d) => setBackground(d, selected.id, tone))} />
                            <span className="ed-bg-swatch" data-bg={tone ?? 'default'} aria-hidden="true" />
                            <span><strong>{info.label}</strong><small>{info.hint}</small></span>
                          </label>
                        )
                      })}
                    </div>
                    <p className="wizard-hint">O tom vale só para esta seção e combina com a cor do texto dela.</p>
                  </fieldset>
                ) : <p className="wizard-hint">{kind === 'home' ? 'A Home alterna seções claras e escuras, e a cor do texto depende do fundo de cada uma: por isso o fundo não é editável aqui.' : 'Esta seção tem visual próprio e não aceita troca de fundo.'}</p>
              ) : (
                <fieldset disabled={!editable} className="ed-form ed-advanced">
                  <legend className="sr-only">Avançado: {metaFor(selected.type)?.label ?? selected.type}</legend>
                  <label className="sf-check">
                    <input type="checkbox" checked={selected.visibility.enabled} disabled={props.dynamicTypes.includes(selected.type)} onChange={(e) => run((d) => (e.target.checked ? reveal(d, selected.id) : setVisibility(d, selected.id, false)))} /> Mostrar esta seção na página
                  </label>
                  {props.dynamicTypes.includes(selected.type) ? <p className="wizard-hint">Esta seção é automática: aparece quando há itens publicados.</p> : null}
                  {kind === 'course' && cadastro && (selected.type === 'course.checkout' || selected.type === 'course.offer') ? (
                    <div className="sf-field">
                      <span className="ds-label">Preço e checkout</span>
                      <p className="wizard-hint">Preço, parcelas e o link de pagamento ficam na oferta do curso, fora da página.</p>
                      <button type="button" className="admin-button secondary" onClick={() => { setPanel('settings'); setSettingsFocus({ field: 'checkoutUrl', n: ++focusSeq.current }) }}>Abrir a oferta nas Configurações</button>
                    </div>
                  ) : null}
                  <div className="sf-field">
                    <span className="ds-label">Posição</span>
                    <span className="ed-actions">
                      <button type="button" className="admin-button secondary" disabled={!(moves[selectedIndex]?.up)} onClick={() => run((d) => moveSection(d, selected.id, selectedIndex - 1, rules))} aria-label={`Mover ${metaFor(selected.type)?.label ?? selected.type} para cima`}>↑ Subir</button>
                      <button type="button" className="admin-button secondary" disabled={!(moves[selectedIndex]?.down)} onClick={() => run((d) => moveSection(d, selected.id, selectedIndex + 1, rules))} aria-label={`Mover ${metaFor(selected.type)?.label ?? selected.type} para baixo`}>↓ Descer</button>
                    </span>
                  </div>
                  {isRepeatable(selected.type) ? (
                    <div className="sf-field">
                      <span className="ds-label">Repetir seção</span>
                      <button type="button" className="admin-button secondary" onClick={() => duplicate(selected.id, selected.type)}>Duplicar seção</button>
                      <p className="wizard-hint">Cria uma cópia logo abaixo, com o mesmo conteúdo para você ajustar. Até {MAX_PER_REPEATABLE_TYPE} por página.</p>
                    </div>
                  ) : null}
                  <div className="sf-field">
                    <span className="ds-label">Identificador da seção</span>
                    <code className="ed-code">{selected.id}</code>
                  </div>
                  <button type="button" className="admin-button secondary ed-danger" disabled={rules.required.has(selected.type)} onClick={() => run((d) => removeSection(d, selected.id, rules))} aria-label={`Remover ${metaFor(selected.type)?.label ?? selected.type}`}>Remover seção</button>
                  {rules.required.has(selected.type) ? <p className="wizard-hint">Esta seção é obrigatória e não pode ser removida.</p> : null}
                </fieldset>
              )}
            </div>
          ) : <p className="wizard-hint">Selecione uma seção para editar.</p>}
        </div>
      </div>
    </div>
  )
}

/** Confirmação inline acessível: foco no botão seguro, Esc cancela. */
function ConfirmBar({ title, busy, onConfirm, onCancel }: { title: string; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => { cancel.current?.focus() }, [])
  return (
    <div role="alertdialog" aria-labelledby="ed-confirm-title" className="ed-banner" onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}>
      <strong id="ed-confirm-title">{title}</strong>{' '}
      <button type="button" className="admin-button" disabled={busy} onClick={onConfirm}>Confirmar</button>{' '}
      <button ref={cancel} type="button" className="admin-button secondary" onClick={onCancel}>Cancelar</button>
    </div>
  )
}
