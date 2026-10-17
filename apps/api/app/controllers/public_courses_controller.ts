import type { HttpContext } from '@adonisjs/core/http'
import CourseService from '#services/course_service'

/** Leitura pública: só cursos publicados de profissionais publicados, a partir do snapshot. */
export default class PublicCoursesController {
  async show({ params, response }: HttpContext) {
    const slug = String(params.slug)
    if (!/^[a-z0-9-]{3,80}$/.test(slug)) return response.notFound({ message: 'Não encontrado' })
    const course = await CourseService.published(slug)
    if (!course) return response.notFound({ message: 'Não encontrado' })
    return course
  }
}
