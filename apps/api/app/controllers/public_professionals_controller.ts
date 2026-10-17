import type { HttpContext } from '@adonisjs/core/http'
import ProfessionalService from '#services/professional_service'

/** Leitura pública: só profissionais publicados, sempre a partir do snapshot da versão vigente. */
export default class PublicProfessionalsController {
  async showcase() {
    return { items: await ProfessionalService.showcase() }
  }

  async show({ params, response }: HttpContext) {
    const slug = String(params.slug)
    if (!/^[a-z0-9-]{3,80}$/.test(slug)) return response.notFound({ message: 'Não encontrado' })
    const professional = await ProfessionalService.published(slug)
    if (!professional) return response.notFound({ message: 'Não encontrado' })
    return professional
  }
}
