'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { mediaSrc } from '@academia/page-renderer'

export type FilterProfessional = { id: number; name: string; specialty?: string; photo?: string }

/**
 * Filtro da lista por profissional: cartõezinhos com foto e nome (mesma ideia do seletor de "Novo curso"), em vez de
 * um `<select>` sem imagem. Grava `?professionalId=` na URL (a API já filtra) e volta à página 1.
 */
export function ProfessionalFilter({ professionals, param = 'professionalId' }: { professionals: readonly FilterProfessional[]; param?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, start] = useTransition()
  const active = params.get(param) ?? ''

  const choose = (id: string) => {
    const next = new URLSearchParams(params.toString())
    if (id) next.set(param, id)
    else next.delete(param)
    next.delete('page')
    start(() => router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false }))
  }

  if (professionals.length === 0) return null
  return (
    <div className="pf" role="group" aria-label="Filtrar por profissional" data-pending={pending || undefined}>
      <button type="button" className="pf-chip pf-all" aria-pressed={active === ''} onClick={() => choose('')}>Todos os profissionais</button>
      {professionals.map((p) => (
        <button key={p.id} type="button" className="pf-chip" aria-pressed={active === String(p.id)} onClick={() => choose(active === String(p.id) ? '' : String(p.id))} title={p.specialty ? `${p.name} · ${p.specialty}` : p.name}>
          <Photo src={p.photo} name={p.name} />
          <span className="pf-text"><strong>{p.name}</strong>{p.specialty ? <small>{p.specialty}</small> : null}</span>
        </button>
      ))}
    </div>
  )
}

/** Foto redonda (é pessoa); sem arquivo ou se falhar ao carregar, a inicial do nome. */
function Photo({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <span className="pf-initial" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
  // A falha pode acontecer antes da hidratação: confere ao montar.
  const check = (img: HTMLImageElement | null) => { if (img?.complete && img.naturalWidth === 0) setFailed(true) }
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={check} src={mediaSrc(src, 96)} alt="" width={28} height={28} loading="lazy" onError={() => setFailed(true)} />
}
