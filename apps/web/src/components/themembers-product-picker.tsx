'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { mediaSrc } from '@academia/page-renderer'

export type PickerProduct = { id: string; title: string; coverSrc: string | null }

type Props = {
  products: PickerProduct[]
  /** ID digitado ou escolhido (um ID que bate com um produto vira o cartão do produto). */
  value: string
  onChange: (id: string) => void
  /** Produtos já escolhidos em outra linha: aparecem indisponíveis. */
  takenIds?: ReadonlySet<string>
  disabled?: boolean
  label: string
}

const Thumb = ({ product }: { product: PickerProduct }) =>
  product.coverSrc ? (
    <img src={mediaSrc(product.coverSrc, 160)} alt="" width={60} height={48} loading="lazy" />
  ) : (
    <i aria-hidden="true">{product.title.trim().charAt(0).toUpperCase()}</i>
  )

const Svg = ({ children, size = 16, sw = 1.8 }: { children: React.ReactNode; size?: number; sw?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)

/**
 * Campo de ID da The Members: dá para digitar o ID direto ou abrir a lista de produtos (miniatura + nome + ID),
 * que tem busca própria. Escolher um produto vira um cartão com um × para trocar.
 */
export function ProductPicker({ products, value, onChange, takenIds, disabled, label }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [active, setActive] = useState(0)

  const selected = products.find((p) => p.id === value.trim()) ?? null
  const query = term.trim().toLowerCase()
  const options = useMemo(
    () => (query ? products.filter((p) => p.title.toLowerCase().includes(query) || p.id.toLowerCase().includes(query)) : products),
    [products, query],
  )

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])
  useEffect(() => setActive(0), [query])

  function toggle() {
    setTerm('')
    setActive(0)
    setOpen((v) => !v)
  }
  useEffect(() => { if (open) search.current?.focus() }, [open])

  function choose(product: PickerProduct) {
    if (takenIds?.has(product.id)) return
    onChange(product.id)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'Escape') {
      // fecha só a lista: sem isso o Esc também fecharia o modal
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (options.length) setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
    } else if (e.key === 'Enter' && options[active]) {
      e.preventDefault()
      choose(options[active])
    }
  }

  return (
    <div className={`tm-pick${open ? ' is-open' : ''}`} ref={root} onKeyDown={onKeyDown}>
      {selected ? (
        <div className="tm-pick-chosen">
          <span className="tm-pick-thumb"><Thumb product={selected} /></span>
          <span className="tm-pick-text"><b>{selected.title}</b><small>{selected.id}</small></span>
          <button type="button" className="tm-pick-btn" onClick={() => onChange('')} disabled={disabled} aria-label="Remover produto escolhido"><Svg size={14} sw={2}><path d="M6 6l12 12M18 6L6 18" /></Svg></button>
        </div>
      ) : (
        <div className="tm-pick-field">
          <input
            className="tm-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={label}
            placeholder="Digite o ID ou escolha"
            maxLength={128}
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
          />
          <button type="button" className="tm-pick-btn" onClick={toggle} disabled={disabled} aria-label="Escolher um produto da The Members" aria-haspopup="listbox" aria-expanded={open}><Svg><path d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} /></Svg></button>
        </div>
      )}
      {open && !selected ? (
        <div className="tm-pick-pop">
          <label className="tm-pick-search">
            <Svg size={18}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></Svg>
            <input
              ref={search}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar produto por nome ou ID…"
              aria-label="Buscar produto por nome ou ID"
              aria-controls={listId}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <ul className="tm-pick-list" id={listId} role="listbox" aria-label="Produtos da The Members">
            {options.length ? options.map((p, n) => {
              const taken = takenIds?.has(p.id)
              return (
                <li key={p.id} role="option" aria-selected={n === active} aria-disabled={taken || undefined} className={`tm-pick-opt${n === active ? ' active' : ''}${taken ? ' taken' : ''}`} onPointerEnter={() => setActive(n)} onClick={() => choose(p)}>
                  <span className="tm-pick-thumb"><Thumb product={p} /></span>
                  <span className="tm-pick-text"><b>{p.title}</b><small>{p.id}</small></span>
                  {taken ? <em>Em uso</em> : n === active ? <span className="tm-pick-check"><Svg size={18} sw={2}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg></span> : null}
                </li>
              )
            }) : <li className="tm-pick-empty" role="option" aria-selected="false">{products.length ? 'Nenhum produto encontrado.' : 'Nenhum produto disponível. Digite o ID.'}</li>}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
