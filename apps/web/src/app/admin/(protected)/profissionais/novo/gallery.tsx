'use client'

import type { AdminProfessional } from '@academia/contracts'
import { PROFESSIONAL_TEMPLATES } from '@academia/section-schemas'
import { apiSend } from '@/lib/api-client'
import { TemplateGallery, type PickResult } from '@/components/template-gallery'
import { emptyProfessionalData } from '../form-model'

const randomSuffix = () => Math.random().toString(36).slice(2, 8).padEnd(6, '0')

/** Cria o rascunho com dados mínimos (a publicação exige o restante) e abre o editor visual. */
async function createDraft(templateKey: string): Promise<PickResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await apiSend<AdminProfessional>('POST', '/admin/professionals', {
      slug: `novo-profissional-${randomSuffix()}`,
      data: { ...emptyProfessionalData, name: 'Novo profissional', specialty: 'Especialidade' },
      templateKey,
    })
    if (res.ok && res.data) return { href: `/admin/editor/profissionais/${res.data.id}` }
    if (res.status === 409) continue // slug já existe: tenta outro
    if (res.status === 401) return { error: 'Sua sessão expirou. Entre novamente e tente de novo.' }
    if (res.status === 403) return { error: 'Você não tem permissão para criar profissionais.' }
    if (res.status === 0) return { error: 'Sem conexão com o servidor. Tente novamente.' }
    return { error: 'Não foi possível criar agora. Tente novamente.' }
  }
  return { error: 'Não foi possível gerar um endereço único. Tente novamente.' }
}

export function ProfessionalTemplateGallery() {
  return (
    <TemplateGallery
      templates={PROFESSIONAL_TEMPLATES.map((t) => ({ key: t.key, label: t.label, description: t.description, kind: 'Profissional' }))}
      onPick={createDraft}
      hint="Todo conteúdo é validado e renderizado por componentes registrados, sem HTML ou scripts livres."
    />
  )
}
