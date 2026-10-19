'use client'

import { useState } from 'react'
import type { AdminCourse } from '@academia/contracts'
import { mediaSrc } from '@academia/page-renderer'
import { apiSend } from '@/lib/api-client'
import { TemplateGallery, type PickResult } from '@/components/template-gallery'
import { emptyCourseData } from '../form-model'

const randomSuffix = () => Math.random().toString(36).slice(2, 8).padEnd(6, '0')

const TEMPLATES = [
  { key: 'course-original', label: 'Curso Clássico', kind: 'Curso', description: 'O modelo comercial da Academia Beauty com hero, benefícios, conteúdo, instrutor, oferta, FAQ e checkout.' },
] as const

async function createDraft(professionalId: number): Promise<PickResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await apiSend<AdminCourse>('POST', '/admin/courses', {
      professionalId,
      slug: `novo-curso-${randomSuffix()}`,
      data: { ...emptyCourseData, title: 'Novo curso' },
    })
    if (res.ok && res.data) return { href: `/admin/editor/cursos/${res.data.id}` }
    if (res.status === 409) continue
    if (res.status === 401) return { error: 'Sua sessão expirou. Entre novamente e tente de novo.' }
    if (res.status === 403) return { error: 'Você não tem permissão para criar cursos.' }
    if (res.status === 0) return { error: 'Sem conexão com o servidor. Tente novamente.' }
    return { error: 'Não foi possível criar agora. Tente novamente.' }
  }
  return { error: 'Não foi possível gerar um endereço único. Tente novamente.' }
}

export function CourseTemplateGallery({ professionals }: { professionals: ReadonlyArray<{ id: number; name: string; photo: string; specialty: string }> }) {
  const [professionalId, setProfessionalId] = useState<number | ''>(professionals.length === 1 ? professionals[0]!.id : '')
  return (
    <>
      <fieldset className="pro-picker">
        <legend>Profissional responsável pelo curso</legend>
        <div className="pro-grid">
          {professionals.map((p) => (
            <label className="pro-card" key={p.id} data-selected={professionalId === p.id || undefined}>
              <input type="radio" name="professional" value={p.id} checked={professionalId === p.id} onChange={() => setProfessionalId(p.id)} />
              {p.photo
                ? <img src={mediaSrc(p.photo, 320)} alt="" width={72} height={72} loading="lazy" />
                : <span className="pro-avatar" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>}
              <span className="pro-name">{p.name}</span>
              <small>{p.specialty}</small>
            </label>
          ))}
        </div>
      </fieldset>
      <TemplateGallery
        templates={TEMPLATES}
        disabled={professionalId === ''}
        onPick={() => (professionalId === '' ? Promise.resolve({ error: 'Selecione o profissional.' }) : createDraft(professionalId))}
        hint="Todo conteúdo é validado e renderizado por componentes registrados, sem HTML ou scripts livres."
      />
    </>
  )
}
