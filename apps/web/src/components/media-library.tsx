'use client'

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { MediaAsset, MediaKind } from '@academia/contracts'
import { apiGet, apiSend, apiUpload } from '@/lib/api-client'
import { MediaDropzone } from './media-dropzone'

type List = { items: MediaAsset[]; page: number; perPage: number; total: number }
type Usage = { type: string; id: number; label: string; published: boolean }
type Detail = { asset: MediaAsset; usages: Usage[] }

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,video/mp4,video/quicktime,video/webm'
const KIND_LABEL: Record<string, string> = { '': 'Tudo', image: 'Imagens', video: 'Vídeos' }
const USAGE_LABEL: Record<string, string> = { professional: 'Profissional', course: 'Curso', home: 'Home' }

const icon = (d: ReactNode, size = 18) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
const EYE = icon(<><path d="M2 12s3.600-7 10-7 10 7 10 7-3.600 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>)
const DOWNLOAD = icon(<><path d="M12 4v12m0 0-4-4m4 4 4-4" /><path d="M4 18v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1" /></>)
const TRASH = icon(<><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" /></>)
const PLAY = icon(<path d="m9 6 9 6-9 6z" fill="currentColor" />, 16)
const IMG_BADGE = icon(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.600" /><path d="m21 16-5-5-8 8" /></>, 16)
const CHECK = icon(<path d="m5 12 5 5 9-10" />, 16)
const GRID = icon(<><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>)
const LIST = icon(<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />)
const SEARCH = icon(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.500-3.500" /></>)
const FILTER = icon(<path d="M4 7h16M7 12h10M10 17h4" />)
const IMAGE = icon(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.600" /><path d="m21 16-5-5-8 8" /></>, 26)

const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)
const errorMessage = (data: unknown, fallback: string) =>
  data && typeof data === 'object' && 'message' in data && typeof (data as { message: unknown }).message === 'string' ? (data as { message: string }).message : fallback

/** Miniatura: imagens pedem o derivado pequeno; vídeo mostra o primeiro quadro. */
export function MediaThumb({ asset }: { asset: Pick<MediaAsset, 'kind' | 'path' | 'name'> }) {
  return asset.kind === 'video'
    ? <video className="media-thumb" src={asset.path} preload="metadata" muted aria-label={asset.name} />
    : <img className="media-thumb" src={`${asset.path}?w=320`} alt={asset.name} loading="lazy" />
}

/**
 * Biblioteca de mídia. `manage` mostra detalhes e exclusão (página /admin/midia); `pick` só escolhe
 * (seletor dos formulários). Quem não pode gerenciar (`canManage` falso) só vê a lista, se a API deixar.
 */
export function MediaLibrary({ mode, kind: forcedKind, onPick, upload: showUpload = true, currentPath, title }: { mode: 'manage' | 'pick'; kind?: MediaKind; onPick?: (asset: MediaAsset) => void; upload?: boolean; currentPath?: string; title?: string }) {
  const [kind, setKind] = useState<'' | MediaKind>(forcedKind ?? '')
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [list, setList] = useState<List | null>(null)
  const [loading, setLoading] = useState(true)
  // Falha ao carregar a lista × falha de uma ação (envio, exclusão): recarregar a lista não apaga o motivo da ação.
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDialogElement>(null)
  const id = useId()

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), perPage: mode === 'pick' ? '12' : '24' })
    if (kind) params.set('kind', kind)
    if (term) params.set('q', term)
    const res = await apiGet<List>(`/admin/media?${params}`)
    if (res.ok && res.data) {
      setList(res.data)
      setLoadError(null)
    } else {
      setLoadError(res.status === 403 ? 'Você não tem permissão para a biblioteca de mídia.' : 'Não foi possível carregar a biblioteca. Tente novamente.')
    }
    setLoading(false)
  }, [page, kind, term, mode])

  useEffect(() => { void load() }, [load])

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    setError(null)
    const done: MediaAsset[] = []
    for (const file of Array.from(files)) {
      setNotice(`Enviando ${file.name}…`)
      const res = await apiUpload<MediaAsset>('/admin/media', file)
      if (res.ok && res.data) done.push(res.data)
      else { setError(`${file.name}: ${res.status === 413 ? 'arquivo grande demais.' : errorMessage(res.data, 'não foi possível enviar.')}`); break }
    }
    setNotice(done.length ? `${done.length} arquivo(s) enviado(s).` : null)
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
    setPage(1)
    await load()
    // Um único arquivo enviado no seletor já é a escolha mais provável.
    if (mode === 'pick' && done.length === 1 && onPick && (!forcedKind || done[0]?.kind === forcedKind)) onPick(done[0] as MediaAsset)
  }

  async function open(asset: MediaAsset) {
    const res = await apiGet<Detail>(`/admin/media/${asset.id}`)
    if (res.ok && res.data) setDetail(res.data)
    else setError('Não foi possível carregar os detalhes.')
  }

  async function remove(asset: MediaAsset) {
    setBusy(true)
    const res = await apiSend<{ message?: string }>('DELETE', `/admin/media/${asset.id}`)
    setBusy(false)
    setConfirming(null)
    if (res.ok) {
      setNotice(`"${asset.name}" excluído.`)
      setDetail(null)
      await load()
    } else {
      setError(res.status === 409 ? 'O arquivo está em uso e não pode ser excluído. Troque a mídia nas páginas que o usam.' : errorMessage(res.data, 'Não foi possível excluir.'))
      if (res.status === 409) await open(asset)
    }
  }

  useEffect(() => {
    const dialog = previewRef.current
    if (!dialog) return
    if (detail && !dialog.open) (typeof dialog.showModal === 'function' ? dialog.showModal() : dialog.setAttribute('open', ''))
    if (!detail && dialog.open) (typeof dialog.close === 'function' ? dialog.close() : dialog.removeAttribute('open'))
  }, [detail])

  // No seletor a busca acontece enquanto digita (sem botão).
  useEffect(() => {
    if (mode !== 'pick') return
    const timer = window.setTimeout(() => { setPage(1); setTerm(q.trim()) }, 300)
    return () => window.clearTimeout(timer)
  }, [q, mode])

  const lastPage = list ? Math.max(1, Math.ceil(list.total / list.perPage)) : 1

  return (
    <section className="media-lib" aria-label="Biblioteca de mídia">
      {showUpload ? <MediaDropzone onFiles={(files) => void upload(files)} inputRef={fileRef} accept={forcedKind === 'image' ? 'image/jpeg,image/png,image/webp,image/avif' : forcedKind === 'video' ? 'video/mp4,video/quicktime,video/webm' : ACCEPT}
        multiple={mode === 'manage'} busy={busy} compact={mode === 'pick'} art={mode === 'manage'}
        hint={<>JPG, PNG, WebP ou AVIF até 15 MB; MP4, MOV ou WebM até 60 MB.<br />Imagens ganham versões otimizadas automaticamente.</>} /> : null}

      {mode === 'pick' ? (
        <div className="media-pick-head">
          {title ? <h3>{title}</h3> : <span />}
          <div className="media-pick-tools">
            <span className="media-search">{SEARCH}<input aria-label="Buscar arquivos" value={q} maxLength={100} onChange={(e) => setQ(e.target.value)} placeholder="Buscar arquivos…" /></span>
            {forcedKind ? null : (
              <select aria-label="Tipo" className="media-select" value={kind} onChange={(e) => { setPage(1); setKind(e.target.value as '' | MediaKind) }}>
                {Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            )}
            <div className="media-view" role="group" aria-label="Modo de exibição">
              <button type="button" aria-label="Grade" title="Grade" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>{GRID}</button>
              <button type="button" aria-label="Lista" title="Lista" aria-pressed={view === 'list'} onClick={() => setView('list')}>{LIST}</button>
            </div>
          </div>
        </div>
      ) : (
      <form className="media-filter" role="search" onSubmit={(e) => { e.preventDefault(); setPage(1); setTerm(q.trim()) }}>
        <div className="media-field">
          <label className="ds-label" htmlFor={`${id}-q`}>Buscar</label>
          <span className="media-search">{SEARCH}<input id={`${id}-q`} value={q} maxLength={100} onChange={(e) => setQ(e.target.value)} placeholder="Nome do arquivo…" /></span>
        </div>
        {forcedKind ? null : (
          <div className="media-field">
            <label className="ds-label" htmlFor={`${id}-kind`}>Tipo</label>
            <select id={`${id}-kind`} className="media-select" value={kind} onChange={(e) => { setPage(1); setKind(e.target.value as '' | MediaKind) }}>
              {Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )}
        <button type="submit" className="admin-button secondary media-search-btn">{FILTER}Buscar</button>
      </form>
      )}

      <div aria-live="polite" className="media-status">{notice}</div>
      {loadError || error ? <p role="alert" className="form-error">{error ?? loadError}</p> : null}

      {loading && !list ? <p>Carregando…</p> : list && list.items.length === 0 ? (
        <section className="media-empty"><span aria-hidden="true">{IMAGE}</span><div><p><strong>Nenhum arquivo encontrado.</strong></p><p>Envie o primeiro arquivo acima.</p></div></section>
      ) : (
        <ul className="media-grid" data-view={view}>
          {list?.items.map((asset) => (
            <li key={asset.id} className="media-card" data-current={currentPath && asset.path === currentPath.split('?')[0] ? true : undefined}>
              {(() => {
                const isCurrent = Boolean(currentPath && asset.path === currentPath.split('?')[0])
                const body = (
                  <>
                    <div className="media-card-thumb">
                      <MediaThumb asset={asset} />
                      {isCurrent ? <span className="media-check" aria-hidden="true">{CHECK}</span> : <span className="media-kind" aria-hidden="true">{asset.kind === 'video' ? PLAY : IMG_BADGE}</span>}
                      {mode === 'manage' && asset.inUse ? <span className="media-flag">Em uso</span> : null}
                    </div>
                    <div className="media-meta">
                      <strong title={asset.name}>{asset.name}</strong>
                      <small>{asset.kind === 'video' ? 'Vídeo • ' : ''}{formatSize(asset.size)}{asset.width ? ` • ${asset.width}×${asset.height}` : ''}</small>
                    </div>
                  </>
                )
                return mode === 'pick'
                  ? <button type="button" className="media-pick" aria-label={`Usar ${asset.name}`} aria-pressed={isCurrent} onClick={() => onPick?.(asset)}>{body}</button>
                  : <div className="media-card-body">{body}</div>
              })()}
              <div className="media-actions">
                <button type="button" className="media-icon-btn" onClick={() => void open(asset)} aria-label={`Detalhes de ${asset.name}`} title="Visualizar">{EYE}</button>
                <a className="media-icon-btn" href={asset.path} download={asset.name} aria-label={`Baixar ${asset.name}`} title="Baixar">{DOWNLOAD}</a>
                {confirming === asset.id ? (
                  <>
                    <button type="button" className="media-confirm danger" disabled={busy} onClick={() => void remove(asset)} aria-label={`Confirmar exclusão de ${asset.name}`}>Confirmar</button>
                    <button type="button" className="media-confirm" onClick={() => setConfirming(null)}>Cancelar</button>
                  </>
                ) : <button type="button" className="media-icon-btn danger" onClick={() => setConfirming(asset.id)} aria-label={`Excluir ${asset.name}`} title="Excluir">{TRASH}</button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {lastPage > 1 ? (
        <nav className="admin-pager" aria-label="Paginação da biblioteca">
          <button type="button" className="link-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
          <span>Página {page} de {lastPage}</span>
          <button type="button" className="link-button" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>Próxima</button>
        </nav>
      ) : null}

      <dialog ref={previewRef} className="media-dialog media-preview" aria-label={detail ? `Detalhes de ${detail.asset.name}` : 'Detalhes'} onClose={() => setDetail(null)} onCancel={() => setDetail(null)}>
        {detail ? (
          <>
            <div className="media-dialog-head">
              <h2>{detail.asset.name}</h2>
              <button type="button" className="admin-button secondary" onClick={() => setDetail(null)}>Fechar</button>
            </div>
            <div className="media-preview-stage">
              {detail.asset.kind === 'video'
                ? <video src={detail.asset.path} controls preload="metadata" />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={`${detail.asset.path}?w=1280`} alt={detail.asset.name} />}
            </div>
            <p className="media-preview-meta">{detail.asset.kind === 'video' ? 'Vídeo' : 'Imagem'} • {formatSize(detail.asset.size)}{detail.asset.width ? ` • ${detail.asset.width}×${detail.asset.height}` : ''}</p>
            {detail.usages.length === 0 ? <p>Não está em uso: pode ser excluído.</p> : (
              <>
                <p>Em uso em:</p>
                <ul>{detail.usages.map((u) => <li key={`${u.type}-${u.id}-${u.published}`}>{USAGE_LABEL[u.type] ?? u.type}: {u.label} ({u.published ? 'versão publicada' : 'rascunho'})</li>)}</ul>
              </>
            )}
            <p className="media-preview-actions"><a className="admin-button secondary" href={detail.asset.path} download={detail.asset.name}>{DOWNLOAD}Baixar</a></p>
          </>
        ) : null}
      </dialog>
    </section>
  )
}
