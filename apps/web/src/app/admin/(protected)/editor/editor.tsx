'use client'

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { z } from 'zod'
import type { PageDocument } from '@academia/page-schema'
import {
  addSection, canRedo, canUndo, commit, createHistory, moveSection, redo, removeSection,
  setVisibility, undo, updateContent, type EditError, type EditResult, type History,
} from '@academia/editor-core'
import { editorRules, metaFor, validatePageDocument } from '@academia/section-schemas'
import type { DocumentVersion } from '@academia/contracts'
import { apiGet, apiSend } from '@/lib/api-client'
import { useAutosave, type SaveState } from './use-autosave'
import { SchemaForm, type JsonSchema } from '@/components/schema-form'
import { EDITOR_MESSAGE } from '@/components/live-preview'

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
}

const SAVE_LABEL: Record<SaveState, string> = {
  idle: 'Sem alterações', dirty: 'Alterações não salvas', saving: 'Salvando…', saved: 'Salvo', invalid: 'Corrija os campos para salvar',
  conflict: 'Conflito: outra pessoa alterou esta página', error: 'Falha ao salvar. Tentando novamente…',
  auth: 'Sessão expirada: alterações não salvas', forbidden: 'Sem permissão para salvar', archived: 'Arquivado: não é possível salvar',
}
const REGION_LABEL: Record<string, string> = { banner: 'Topo', main: 'Conteúdo', contentinfo: 'Rodapé', overlay: 'Flutuante' }
const ERROR_TEXT = (e: EditError): string => ({
  not_found: 'Seção não encontrada.', duplicate_id: 'Já existe uma seção com este id.', singleton: 'Esta seção só pode existir uma vez.',
  required: 'Esta seção é obrigatória e não pode ser removida.', cross_region: 'A seção só pode mudar de posição dentro da mesma região da página.',
  out_of_range: 'Posição inválida.', too_many: 'Limite de seções atingido.',
}[e.code])

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
  const { kind, id, library, templateKey } = props
  const editable = props.canWrite && props.status !== 'archived'
  const rules = useMemo(() => editorRules(templateKey), [templateKey])
  const base = kind === 'professional' ? `/admin/professionals/${id}` : kind === 'course' ? `/admin/courses/${id}` : '/admin/home'

  const [history, setHistory] = useState<History>(() => createHistory(props.initial))
  const doc = history.present
  const [selectedId, setSelectedId] = useState<string | null>(props.initial.sections[0]?.id ?? null)
  const [notice, setNotice] = useState<string | null>(null)
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [panel, setPanel] = useState<'none' | 'history'>('none')
  const [confirm, setConfirm] = useState<null | { kind: 'reset' } | { kind: 'restore'; version: number }>(null)
  const [publishMsg, setPublishMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [versions, setVersions] = useState<DocumentVersion[]>(props.versions)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const previewReady = useRef(false)

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
    put: (d, revision) => apiSend<{ documentRevision: number; code?: string }>('PUT', `${base}/document`, { document: d, revision }),
    getServer: () => apiGet<{ document: unknown; documentRevision: number }>(`${base}/document`),
  })
  const saveState = autosave.state

  const selected = doc.sections.find((s) => s.id === selectedId) ?? null
  const selectedSchema = selected ? jsonSchemaOf(selected.type) : null

  /* ------------------------------- comandos ------------------------------- */
  const apply = useCallback((result: EditResult, coalesceKey?: string) => {
    if (!result.ok) { setNotice(ERROR_TEXT(result.error)); return false }
    setNotice(null)
    setHistory((h) => commit(h, result.doc, { coalesceKey }))
    return true
  }, [])

  const run = (fn: (d: PageDocument) => EditResult, key?: string) => { if (editable) apply(fn(doc), key) }

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

  const selectedIndex = selected ? doc.sections.findIndex((s) => s.id === selected.id) : -1
  const selectedErrors = errors.filter((e) => e.startsWith(`sections.${selectedIndex}.`))
  const errorSections = new Set(errors.map((e) => Number(/^sections\.(\d+)\./.exec(e)?.[1])).filter((n) => !Number.isNaN(n)))

  /* ------------------------------ pré-visualização ------------------------- */
  const post = useCallback(() => {
    if (!validation.ok) return
    iframeRef.current?.contentWindow?.postMessage({ type: EDITOR_MESSAGE, document: deferredDoc }, window.location.origin)
  }, [deferredDoc, validation])
  useEffect(() => { if (previewReady.current) post() }, [post])
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== iframeRef.current?.contentWindow) return
      if ((e.data as { type?: string })?.type === 'academia-editor-ready') { previewReady.current = true; post() }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [post])

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

  const publish = async () => {
    if (busy) return
    setBusy(true)
    setPublishMsg(null)
    try {
      // Garante que o servidor tem exatamente o que está na tela antes de publicar.
      if (!(await autosave.ensureSaved())) { setPublishMsg('Não foi possível salvar as alterações antes de publicar. Veja o aviso acima.'); return }
      const res = await apiSend<{ message?: string; errors?: { message: string }[] }>('POST', `${base}/publish`)
      if (res.ok) { setPublishMsg('Publicado. O site será atualizado em instantes.'); void loadVersions() }
      else if (res.status === 0) setPublishMsg('Sem conexão com o servidor. Tente publicar novamente.')
      else if (res.status === 401) setPublishMsg('Sua sessão expirou. Entre novamente para publicar.')
      else setPublishMsg([res.data?.message ?? `Falha ao publicar (código ${res.status}).`, ...(res.data?.errors ?? []).map((e) => e.message)].join(' · '))
    } finally {
      setBusy(false)
    }
  }

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
  const resetToRegistry = () => replaceOnServer(() => apiSend('DELETE', `${base}/document`, { revision: autosave.revisionRef.current }))
  const restoreVersion = (version: number) => replaceOnServer(() => apiSend('POST', `${base}/document/versions/${version}/restore`, { revision: autosave.revisionRef.current, ...(kind === 'home' ? {} : { dataRevision: props.cadastroRevision }) }))

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
      <div className="ed-bar" role="toolbar" aria-label="Ações do editor">
        <a href={props.backHref} className="link-button">← Voltar</a>
        <strong className="ed-title">{props.title}</strong>
        <span className="ed-status" role="status" aria-live="polite" data-state={saveState}>{editable ? SAVE_LABEL[saveState] : 'Somente leitura'}</span>
        <span className="ed-spacer" />
        <button type="button" className="admin-button secondary" onClick={doUndo} disabled={!editable || !canUndo(history)} aria-label="Desfazer (Ctrl+Z)">Desfazer</button>
        <button type="button" className="admin-button secondary" onClick={doRedo} disabled={!editable || !canRedo(history)} aria-label="Refazer (Ctrl+Shift+Z)">Refazer</button>
        <div className="ed-viewports" role="group" aria-label="Largura da pré-visualização">
          {(['desktop', 'tablet', 'mobile'] as const).map((v) => (
            <button key={v} type="button" className="admin-button secondary" aria-pressed={viewport === v} onClick={() => setViewport(v)}>{v === 'desktop' ? 'Desktop' : v === 'tablet' ? 'Tablet' : 'Celular'}</button>
          ))}
        </div>
        <button type="button" className="admin-button secondary" aria-expanded={panel === 'history'} onClick={() => { if (panel !== 'history') void loadVersions(); setPanel(panel === 'history' ? 'none' : 'history') }}>Histórico</button>
        {editable ? <button type="button" className="admin-button secondary" disabled={busy} onClick={() => setConfirm({ kind: 'reset' })}>{kind === 'home' ? 'Restaurar padrão' : 'Restaurar do cadastro'}</button> : null}
        {props.canPublish && props.status !== 'archived' ? <button type="button" className="admin-button" onClick={publish} disabled={busy || saveState === 'conflict' || !validation.ok}>{busy ? 'Aguarde…' : 'Publicar'}</button> : null}
      </div>

      {blockedBanner[saveState] ? <p role="alert" className="ed-banner">{blockedBanner[saveState]}</p> : null}
      {notice ? <p role="alert" className="ed-banner">{notice}</p> : null}
      {publishMsg ? <p role="status" className="ed-banner ed-banner-info">{publishMsg}</p> : null}
      {confirm ? (
        <ConfirmBar
          title={confirm.kind === 'reset'
            ? (kind === 'home' ? 'Descartar as edições do editor e voltar à Home original?' : 'Descartar as edições do editor e voltar à página gerada pelo cadastro?')
            : (kind === 'home' ? `Voltar o rascunho à versão ${confirm.version}?` : `Voltar o rascunho à versão ${confirm.version}? O cadastro também volta ao que estava nessa versão.`)}
          busy={busy}
          onConfirm={() => (confirm.kind === 'reset' ? resetToRegistry() : restoreVersion(confirm.version))}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
      {props.status === 'archived' ? <p role="alert" className="ed-banner">Este item está arquivado: restaure-o para editar.</p> : null}

      <div className="ed-body">
        <fieldset className="ed-pane ed-tree" disabled={!editable} aria-label="Seções da página">
          <legend className="ds-label">Seções</legend>
          <ul className="ed-list">
            {doc.sections.map((s, index) => {
              const meta = metaFor(s.type)
              const dynamic = props.dynamicTypes.includes(s.type)
              const canUp = moves[index]?.up ?? false
              const canDown = moves[index]?.down ?? false
              const required = rules.required.has(s.type)
              return (
                <li
                  key={s.id}
                  className="ed-item"
                  data-selected={s.id === selectedId || undefined}
                  data-hidden={!s.visibility.enabled || undefined}
                  data-error={errorSections.has(index) || undefined}
                  draggable={editable}
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.effectAllowed = 'move'; setDragId(s.id) }}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => { if (dragId && dragId !== s.id) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } }}
                  onDrop={(e) => { e.preventDefault(); if (dragId && dragId !== s.id) run((d) => moveSection(d, dragId, index, rules)); setDragId(null) }}
                >
                  <button type="button" className="ed-select" aria-current={s.id === selectedId ? 'true' : undefined} onClick={() => setSelectedId(s.id)}>
                    <span className="ed-handle" aria-hidden="true">⋮⋮</span>
                    <span>
                      <span className="ed-name">{meta?.label ?? s.type}</span>
                      <small>{REGION_LABEL[meta?.placement ?? 'main']}{!s.visibility.enabled ? ' · oculta' : ''}{dynamic ? ' · automática' : ''}{errorSections.has(index) ? ' · com erro' : ''}</small>
                    </span>
                  </button>
                  <span className="ed-actions">
                    <button type="button" className="link-button" disabled={!canUp} onClick={() => run((d) => moveSection(d, s.id, index - 1, rules))} aria-label={`Mover ${meta?.label ?? s.type} para cima`}>↑</button>
                    <button type="button" className="link-button" disabled={!canDown} onClick={() => run((d) => moveSection(d, s.id, index + 1, rules))} aria-label={`Mover ${meta?.label ?? s.type} para baixo`}>↓</button>
                    <button type="button" className="link-button" disabled={dynamic} aria-pressed={s.visibility.enabled} onClick={() => run((d) => setVisibility(d, s.id, !s.visibility.enabled))} aria-label={`${s.visibility.enabled ? 'Ocultar' : 'Mostrar'} ${meta?.label ?? s.type}`}>{s.visibility.enabled ? 'Ocultar' : 'Mostrar'}</button>
                    <button type="button" className="link-button" disabled={required} onClick={() => run((d) => removeSection(d, s.id, rules))} aria-label={`Remover ${meta?.label ?? s.type}`}>Remover</button>
                  </span>
                </li>
              )
            })}
          </ul>
          {missing.length ? (
            <div className="ed-add">
              <label htmlFor="ed-add-select" className="ds-label">Adicionar seção</label>
              <select id="ed-add-select" className="ds-input" value="" onChange={(e) => { if (e.target.value) addMissing(e.target.value) }}>
                <option value="">Escolha…</option>
                {missing.map((s) => <option key={s.type} value={s.type}>{metaFor(s.type)?.label ?? s.type}</option>)}
              </select>
            </div>
          ) : null}
        </fieldset>

        <div className="ed-pane ed-preview" aria-label="Pré-visualização">
          <iframe ref={iframeRef} title="Pré-visualização da página" src={previewSrc} style={{ width: frameWidth }} />
          {!validation.ok ? <p className="ed-stale" role="status">Pré-visualização desatualizada: há campos inválidos.</p> : null}
        </div>

        <div className="ed-pane ed-props">
          {panel === 'history' ? (
            <section aria-label="Histórico de versões">
              <h2 className="ed-h2">Versões publicadas</h2>
              {versions.length === 0 ? <p className="wizard-hint">Nenhuma publicação ainda.</p> : (
                <ul className="ed-versions">
                  {versions.map((v) => (
                    <li key={v.version}>
                      <span>Versão {v.version}{v.current ? ' (no ar)' : ''}<small> · {new Date(v.createdAt).toLocaleString('pt-BR')}{v.hasDocument ? '' : kind === 'home' ? ' · Home original' : ' · gerada pelo cadastro'}</small></span>
                      {editable ? <button type="button" className="link-button" onClick={() => setConfirm({ kind: 'restore', version: v.version })}>Restaurar no rascunho</button> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : selected && selectedSchema ? (
            <fieldset disabled={!editable} className="ed-form">
              <legend className="ed-h2">{metaFor(selected.type)?.label ?? selected.type}</legend>
              {selectedErrors.length ? (
                <ul role="alert" className="form-error ed-errors">{selectedErrors.map((e) => <li key={e}>{friendlyError(e, deferredDoc)}</li>)}</ul>
              ) : null}
              <SchemaForm
                schema={selectedSchema}
                value={selected.content}
                onChange={(next) => run((d) => updateContent(d, selected.id, next), `content:${selected.id}`)}
              />
              <p className="wizard-hint">Duplicar seções não está disponível neste template (cada seção tem âncoras próprias).</p>
            </fieldset>
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
