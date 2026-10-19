'use client'

import { useId, useRef, useState, type ChangeEvent } from 'react'
import type { MediaAsset, MediaKind } from '@academia/contracts'
import { mediaIdOf } from '@academia/page-schema'
import { MediaLibrary } from './media-library'
import { useDialogSync } from './use-dialog'

/** Janela modal (elemento `dialog` nativo: foco preso e Esc fecham) com a biblioteca para escolher um arquivo. */
export function MediaPicker({ open, kind, onPick, onClose }: { open: boolean; kind?: MediaKind; onPick: (asset: MediaAsset) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useDialogSync(ref, open)
  return (
    <dialog ref={ref} className="media-dialog" aria-labelledby={titleId} onClose={onClose} onCancel={onClose}>
      {open ? (
        <>
          <div className="media-dialog-head">
            <h2 id={titleId}>Biblioteca de mídia</h2>
            <button type="button" className="admin-button secondary" onClick={onClose}>Fechar</button>
          </div>
          <MediaLibrary mode="pick" kind={kind} onPick={(a) => { onPick(a); onClose() }} />
        </>
      ) : null}
    </dialog>
  )
}

/**
 * Campo de caminho de mídia com botão para escolher da biblioteca. O texto continua editável (caminhos
 * `/site/...`); a validação final é do schema. `onPickAsset` recebe o arquivo para quem quiser preencher mais campos.
 */
export function MediaInput({ label, value, onChange, onPickAsset, kind, disabled, error, id: idProp }: {
  label: string
  value: string
  onChange: (next: string) => void
  onPickAsset?: (asset: MediaAsset) => void
  kind?: MediaKind
  disabled?: boolean
  error?: string
  id?: string
}) {
  const auto = useId()
  const id = idProp ?? auto
  const [open, setOpen] = useState(false)
  const isLibrary = mediaIdOf(value) !== null
  return (
    <div className="sf-field media-input">
      <label htmlFor={id} className="ds-label">{label}</label>
      <div className="media-input-row">
        <input id={id} className="ds-input" type="text" inputMode="url" autoComplete="off" maxLength={2048} value={value} disabled={disabled} aria-invalid={error ? true : undefined}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} />
        <button type="button" className="admin-button secondary" disabled={disabled} onClick={() => setOpen(true)}>Biblioteca<span className="sr-only">: {label}</span></button>
      </div>
      {isLibrary && kind !== 'video' ? <img className="media-input-preview" src={`${value.split('?')[0]}?w=320`} alt="" /> : null}
      {error ? <small role="alert" className="form-error">{error}</small> : null}
      <MediaPicker open={open} kind={kind} onClose={() => setOpen(false)} onPick={(asset) => { onChange(asset.path); onPickAsset?.(asset) }} />
    </div>
  )
}
