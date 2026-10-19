'use client'

import { useId, useRef, useState, type DragEvent } from 'react'
import type { MediaAsset, MediaKind } from '@academia/contracts'
import { mediaIdOf } from '@academia/page-schema'
import { apiUpload } from '@/lib/api-client'
import { MediaDropzone } from './media-dropzone'
import { MediaLibrary } from './media-library'
import { useDialogSync } from './use-dialog'

const ACCEPT: Record<MediaKind, string> = {
  image: 'image/jpeg,image/png,image/webp,image/avif',
  video: 'video/mp4,video/quicktime,video/webm',
}

const errorText = (status: number, data: unknown): string => {
  if (status === 413) return 'Arquivo grande demais.'
  if (status === 403) return 'Você não tem permissão para enviar arquivos.'
  if (status === 0) return 'Sem conexão com o servidor. Tente novamente.'
  const message = (data as { message?: string } | null)?.message
  return message ?? 'Não foi possível enviar este arquivo.'
}

/**
 * Campo de imagem (ou vídeo) do editor: mostra o arquivo atual e um botão "Editar" para trocar,
 * por arrastar e soltar ou por seleção. O caminho do arquivo nunca aparece. Também aceita soltar direto sobre a miniatura.
 */
export function ImageField({ label, value, onChange, onPickAsset, onClear, error: fieldError, kind = 'image', disabled }: {
  label: string
  value: string
  onChange: (next: string) => void
  onPickAsset?: (asset: MediaAsset) => void
  /** Campo opcional: mostra "Remover" quando há arquivo. */
  onClear?: () => void
  error?: string
  kind?: MediaKind
  disabled?: boolean
}) {
  const titleId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<'upload' | 'library'>('upload')
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useDialogSync(dialogRef, editing)

  const mediaId = mediaIdOf(value)
  const previewSrc = mediaId ? `/media/${mediaId}?w=480` : value
  const accepts = (file: File) => (kind === 'video' ? file.type.startsWith('video/') : file.type.startsWith('image/'))

  async function send(file: File | undefined) {
    if (!file || disabled) return
    if (!accepts(file)) { setError(kind === 'video' ? 'Envie um vídeo (MP4 ou WebM).' : 'Envie uma imagem (JPG, PNG, WebP ou AVIF).'); return }
    setBusy(true)
    setError(null)
    const res = await apiUpload<MediaAsset>('/admin/media', file)
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
    if (!res.ok || !res.data) { setError(errorText(res.status, res.data)); return }
    onChange(res.data.path)
    onPickAsset?.(res.data)
    setEditing(false)
  }

  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); void send(e.dataTransfer.files[0]) }
  const dragProps = disabled ? {} : {
    onDragOver: (e: DragEvent) => { e.preventDefault(); setOver(true) },
    onDragLeave: () => setOver(false),
    onDrop,
  }

  return (
    <div className="sf-field img-field">
      <span className="ds-label">{label}</span>
      <div className="img-preview" data-over={over || undefined} data-busy={busy || undefined} {...dragProps}>
        {value ? (
          kind === 'video'
            ? <video src={value} muted playsInline preload="metadata" aria-label={`${label} atual`} />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={previewSrc} alt={`${label} atual`} />
        ) : <span className="img-empty">Sem {kind === 'video' ? 'vídeo' : 'imagem'}</span>}
        {over ? <span className="img-drop-hint">Solte para enviar</span> : null}
        {busy ? <span className="img-drop-hint">Enviando…</span> : null}
        {onClear && value ? <button type="button" className="img-edit img-clear" disabled={disabled} aria-label={`Remover ${label}`} onClick={onClear}>Remover</button> : null}
        <button type="button" className="img-edit" disabled={disabled} aria-label={`Editar ${label}`} onClick={() => { setError(null); setTab('upload'); setEditing(true) }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.500 3.500a2.100 2.100 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
          Editar
        </button>
      </div>
      {(error || fieldError) && !editing ? <small role="alert" className="form-error">{error ?? fieldError}</small> : null}

      <dialog ref={dialogRef} className="media-dialog img-dialog" aria-labelledby={titleId} onClose={() => setEditing(false)} onCancel={() => setEditing(false)}>
        {editing ? (
          <>
            <div className="img-dialog-head">
              <h2 id={titleId}>Trocar {label.toLowerCase()}</h2>
              <button type="button" className="img-close" aria-label="Fechar" onClick={() => setEditing(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div className="img-tabs" role="tablist" aria-label="Origem do arquivo">
              <button type="button" role="tab" aria-selected={tab === 'upload'} onClick={() => setTab('upload')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4m0 0L8 8m4-4 4 4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
                Enviar arquivo
              </button>
              <button type="button" role="tab" aria-selected={tab === 'library'} onClick={() => setTab('library')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.600" /><path d="m21 16-5-5-8 8" /></svg>
                Escolher da biblioteca
              </button>
            </div>
            {tab === 'upload' ? (
              <MediaDropzone inputRef={fileRef} accept={ACCEPT[kind]} busy={busy} compact onFiles={(files) => void send(files?.[0])}
                noun={kind === 'video' ? 'seu vídeo' : 'sua imagem'} buttonLabel="Selecionar arquivo"
                hint={kind === 'video' ? <>MP4, MOV ou WebM até 60 MB.</> : <>JPG, PNG, WebP ou AVIF até 15 MB.<br />Imagens ganham versões otimizadas automaticamente.</>} />
            ) : null}
            {error ? <p role="alert" className="form-error">{error}</p> : null}
            <div className="img-library">
              <MediaLibrary mode="pick" kind={kind} upload={false} currentPath={value} title="Ou escolha um arquivo já enviado" onPick={(asset) => { onChange(asset.path); onPickAsset?.(asset); setEditing(false) }} />
            </div>
          </>
        ) : null}
      </dialog>
    </div>
  )
}
