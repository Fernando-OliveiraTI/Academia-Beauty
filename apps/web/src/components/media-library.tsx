'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { MediaAsset, MediaKind } from '@academia/contracts'
import { apiGet, apiSend, apiUpload } from '@/lib/api-client'

type List = { items: MediaAsset[]; page: number; perPage: number; total: number }
type Usage = { type: string; id: number; label: string; published: boolean }
type Detail = { asset: MediaAsset; usages: Usage[] }

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,video/mp4,video/quicktime,video/webm'
const KIND_LABEL: Record<string, string> = { '': 'Tudo', image: 'Imagens', video: 'Vídeos' }
const USAGE_LABEL: Record<string, string> = { professional: 'Profissional', course: 'Curso', home: 'Home' }

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
export function MediaLibrary({ mode, kind: forcedKind, onPick }: { mode: 'manage' | 'pick'; kind?: MediaKind; onPick?: (asset: MediaAsset) => void }) {
  const [kind, setKind] = useState<'' | MediaKind>(forcedKind ?? '')
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
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

  const lastPage = list ? Math.max(1, Math.ceil(list.total / list.perPage)) : 1

  return (
    <section className="media-lib" aria-label="Biblioteca de mídia">
      <div className="media-bar">
        <div>
          <label className="ds-label" htmlFor={`${id}-file`}>Enviar arquivos</label>
          <input ref={fileRef} id={`${id}-file`} className="ds-input" type="file" accept={forcedKind === 'image' ? 'image/jpeg,image/png,image/webp,image/avif' : forcedKind === 'video' ? 'video/mp4,video/quicktime,video/webm' : ACCEPT} multiple={mode === 'manage'} disabled={busy} onChange={(e) => void upload(e.target.files)} />
          <small className="media-hint">JPG, PNG, WebP ou AVIF até 15 MB; MP4, MOV ou WebM até 60 MB. Imagens ganham versões otimizadas automaticamente.</small>
        </div>
        <form className="media-filter" role="search" onSubmit={(e) => { e.preventDefault(); setPage(1); setTerm(q.trim()) }}>
          <label className="ds-label" htmlFor={`${id}-q`}>Buscar</label>
          <input id={`${id}-q`} className="ds-input" value={q} maxLength={100} onChange={(e) => setQ(e.target.value)} placeholder="Nome do arquivo" />
          {forcedKind ? null : (
            <>
              <label className="ds-label" htmlFor={`${id}-kind`}>Tipo</label>
              <select id={`${id}-kind`} className="ds-input" value={kind} onChange={(e) => { setPage(1); setKind(e.target.value as '' | MediaKind) }}>
                {Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </>
          )}
          <button type="submit" className="admin-button secondary">Buscar</button>
        </form>
      </div>

      <div aria-live="polite" className="media-status">{notice}</div>
      {loadError || error ? <p role="alert" className="form-error">{error ?? loadError}</p> : null}

      {loading && !list ? <p>Carregando…</p> : list && list.items.length === 0 ? (
        <section className="admin-card"><p>Nenhum arquivo encontrado. Envie o primeiro acima.</p></section>
      ) : (
        <ul className="media-grid">
          {list?.items.map((asset) => (
            <li key={asset.id} className="media-card">
              <MediaThumb asset={asset} />
              <div className="media-meta">
                <strong title={asset.name}>{asset.name}</strong>
                <small>{asset.kind === 'video' ? 'Vídeo' : 'Imagem'} · {formatSize(asset.size)}{asset.width ? ` · ${asset.width}×${asset.height}` : ''}</small>
                {asset.inUse ? <span className="admin-badge published">Em uso</span> : null}
              </div>
              <div className="media-actions">
                {mode === 'pick' ? <button type="button" className="admin-button" onClick={() => onPick?.(asset)}>Usar<span className="sr-only"> {asset.name}</span></button> : (
                  <>
                    <button type="button" className="link-button" onClick={() => void open(asset)} aria-label={`Detalhes de ${asset.name}`}>Detalhes</button>
                    {confirming === asset.id ? (
                      <>
                        <button type="button" className="link-button" disabled={busy} onClick={() => void remove(asset)} aria-label={`Confirmar exclusão de ${asset.name}`}>Confirmar</button>
                        <button type="button" className="link-button" onClick={() => setConfirming(null)}>Cancelar</button>
                      </>
                    ) : <button type="button" className="link-button" onClick={() => setConfirming(asset.id)} aria-label={`Excluir ${asset.name}`}>Excluir</button>}
                  </>
                )}
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

      {detail ? (
        <section className="admin-card media-detail" aria-label={`Detalhes de ${detail.asset.name}`}>
          <h2>{detail.asset.name}</h2>
          <p>Caminho para usar nas páginas: <code>{detail.asset.path}</code></p>
          {detail.usages.length === 0 ? <p>Não está em uso: pode ser excluído.</p> : (
            <>
              <p>Em uso em:</p>
              <ul>{detail.usages.map((u) => <li key={`${u.type}-${u.id}-${u.published}`}>{USAGE_LABEL[u.type] ?? u.type}: {u.label} ({u.published ? 'versão publicada' : 'rascunho'})</li>)}</ul>
            </>
          )}
          <button type="button" className="admin-button secondary" onClick={() => setDetail(null)}>Fechar</button>
        </section>
      ) : null}
    </section>
  )
}
