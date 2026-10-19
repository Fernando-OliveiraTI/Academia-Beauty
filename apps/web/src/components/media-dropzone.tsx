'use client'

import { useRef, useState, type DragEvent, type ReactNode, type RefObject } from 'react'

const icon = (d: ReactNode, size = 18) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
const CLOUD = icon(<><path d="M7 18a4 4 0 0 1-.5-7.970A6 6 0 0 1 18 9a4.500 4.500 0 0 1 0 9" /><path d="m12 12-3 3m3-3 3 3m-3-3v8" /></>, 30)
const UPLOAD = icon(<><path d="M12 16V4m0 0L8 8m4-4 4 4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>)

/** Ilustração do quadro de envio: cartões de imagem, brilho e vídeo empilhados. */
function MediaArt() {
  return (
    <div className="media-art" aria-hidden="true">
      <span className="media-art-card a">{icon(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.600" /><path d="m21 16-5-5-8 8" /></>, 28)}</span>
      <span className="media-art-card b">{icon(<path d="M12 3c3 4 6 6.500 6 10a6 6 0 0 1-12 0c0-3.500 3-6 6-10z" />, 28)}</span>
      <span className="media-art-card c">{icon(<path d="m9 6 9 6-9 6z" fill="currentColor" />, 26)}</span>
    </div>
  )
}

/**
 * Quadro "Arraste e solte seus arquivos aqui" da biblioteca de mídia e da janela de troca de imagem.
 * O `<input type="file">` fica escondido (rótulo "Enviar arquivos") e o botão dourado o aciona.
 */
export function MediaDropzone({ onFiles, accept, multiple = false, busy = false, compact = false, art = false, hint, inputRef, noun = 'seus arquivos', buttonLabel = 'Escolher arquivos' }: {
  onFiles: (files: FileList | null) => void
  accept: string
  multiple?: boolean
  busy?: boolean
  compact?: boolean
  /** Mostra a ilustração à direita (página da biblioteca). */
  art?: boolean
  hint?: ReactNode
  /** "seus arquivos", "sua imagem"…: o trecho destacado do título. */
  noun?: string
  buttonLabel?: string
  inputRef?: RefObject<HTMLInputElement | null>
}) {
  const own = useRef<HTMLInputElement>(null)
  const ref = inputRef ?? own
  const [over, setOver] = useState(false)
  return (
    <div className="media-drop" data-compact={compact || undefined} data-over={over || undefined} data-busy={busy || undefined}
      onDragOver={(e: DragEvent) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={(e: DragEvent) => { e.preventDefault(); setOver(false); if (!busy) onFiles(e.dataTransfer.files) }}>
      <div className="media-drop-main">
        <span className="media-drop-icon" aria-hidden="true">{CLOUD}</span>
        <strong>Arraste e solte <em>{noun}</em> aqui</strong>
        <span className="media-drop-sub">ou clique para selecionar no seu dispositivo</span>
        <input ref={ref} className="sr-only" aria-label="Enviar arquivos" type="file" accept={accept} multiple={multiple} disabled={busy} onChange={(e) => onFiles(e.target.files)} />
        <button type="button" className="admin-button media-drop-btn" disabled={busy} onClick={() => ref.current?.click()}>{UPLOAD}{busy ? 'Enviando…' : buttonLabel}</button>
        {hint ? <small className="media-hint">{hint}</small> : null}
      </div>
      {art ? <MediaArt /> : null}
    </div>
  )
}
