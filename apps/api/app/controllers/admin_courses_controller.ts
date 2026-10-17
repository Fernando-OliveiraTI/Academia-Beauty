import type { HttpContext } from '@adonisjs/core/http'
import type { ZodType } from 'zod'
import {
  commercialReadiness,
  courseReadiness,
  courseShowcaseSchema,
  createCourseSchema,
  listCoursesQuerySchema,
  updateCommercialSchema,
  updateCourseSchema,
  type CommercialInput,
  type ReadinessIssue,
} from '@academia/contracts'
import Course from '#models/course'
import CommercialConfig from '#models/commercial_config'
import Professional from '#models/professional'
import AuditService from '#services/audit_service'
import CourseService, {
  allowedCheckoutHosts,
  commercialInput,
  courseTags,
  toAdmin,
} from '#services/course_service'
import { DomainError, toDomainError } from '#services/domain_error'
import RevalidationService from '#services/revalidation_service'

/** 422 no formato { message, errors: [{ field, message }] }. */
function parse<T>(schema: ZodType<T>, input: unknown, ctx: HttpContext): T | null {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  ctx.response.unprocessableEntity({
    message: 'Dados inválidos',
    errors: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
  })
  return null
}

function fail(ctx: HttpContext, raw: unknown) {
  const error = toDomainError(raw)
  if (error instanceof DomainError) {
    return ctx.response
      .status(error.status)
      .send({ message: error.message, code: error.code, errors: error.details })
  }
  throw error
}

const withoutUrl = ({ checkoutUrl: _url, ...rest }: CommercialInput) => rest

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`)

/** Tudo que falta para publicar: conteúdo, oferta e profissional publicado. */
function readinessOf(
  course: Course,
  professional: Professional,
  commercial: CommercialConfig | null
) {
  const issues: ReadinessIssue[] = [
    ...courseReadiness(course.data),
    ...commercialReadiness(commercial ? commercialInput(commercial) : null, allowedCheckoutHosts()),
  ]
  if (professional.status !== 'published') {
    issues.push({
      field: 'professionalId',
      message: 'Publique o profissional deste curso primeiro',
    })
  }
  return issues
}

async function respond(course: Course) {
  const { professional, commercial } = await CourseService.hydrate(course)
  return {
    ...toAdmin(course, professional.name, commercial),
    readiness: readinessOf(course, professional, commercial),
  }
}

export default class AdminCoursesController {
  async index(ctx: HttpContext) {
    const query = parse(listCoursesQuerySchema, ctx.request.qs(), ctx)
    if (!query) return
    const builder = Course.query().orderBy('updated_at', 'desc').orderBy('id', 'desc')
    if (query.status) builder.where('status', query.status)
    else builder.whereNot('status', 'archived')
    if (query.professionalId) builder.where('professional_id', query.professionalId)
    if (query.q) {
      const like = `%${escapeLike(query.q)}%`
      builder.where((q) =>
        q
          .whereRaw("title like ? escape '\\\\'", [like])
          .orWhereRaw("slug like ? escape '\\\\'", [like])
      )
    }
    const page = await builder.paginate(query.page, query.perPage)
    const rows = page.all()
    const professionalRows = await Professional.query().whereIn('id', [
      ...new Set(rows.map((c) => c.professionalId)),
    ])
    const professionals = new Map(professionalRows.map((p) => [p.id, p.name] as const))
    const configRows = await CommercialConfig.query().whereIn(
      'course_id',
      rows.map((c) => c.id)
    )
    const configs = new Map(configRows.map((c) => [c.courseId, c] as const))
    return {
      items: rows.map((c) =>
        toAdmin(c, professionals.get(c.professionalId) ?? '', configs.get(c.id) ?? null)
      ),
      meta: {
        total: page.total,
        page: page.currentPage,
        perPage: page.perPage,
        lastPage: page.lastPage,
      },
    }
  }

  async show(ctx: HttpContext) {
    const course = await Course.find(ctx.params.id)
    if (!course) return ctx.response.notFound({ message: 'Curso não encontrado' })
    return respond(course)
  }

  async store(ctx: HttpContext) {
    const input = parse(createCourseSchema, ctx.request.body(), ctx)
    if (!input) return
    const actor = ctx.auth.getUserOrFail()
    try {
      const course = await CourseService.create(
        input.professionalId,
        input.slug,
        input.data,
        actor.id
      )
      await AuditService.record(ctx, {
        action: 'course.create',
        actorId: actor.id,
        resourceType: 'course',
        resourceId: course.id,
        metadata: { slug: course.slug, professionalId: course.professionalId },
      })
      return ctx.response.created(await respond(course))
    } catch (error) {
      return fail(ctx, error)
    }
  }

  async update(ctx: HttpContext) {
    const input = parse(updateCourseSchema, ctx.request.body(), ctx)
    if (!input) return
    const actor = ctx.auth.getUserOrFail()
    try {
      const course = await CourseService.update(Number(ctx.params.id), input, actor.id)
      await AuditService.record(ctx, {
        action: 'course.update',
        actorId: actor.id,
        resourceType: 'course',
        resourceId: course.id,
        metadata: { revision: course.revision },
      })
      return respond(course)
    } catch (error) {
      return fail(ctx, error)
    }
  }

  /** Preço e link de checkout: exige `commerce.manage` (a rota aplica a permissão). */
  async commercial(ctx: HttpContext) {
    const input = parse(updateCommercialSchema, ctx.request.body(), ctx)
    if (!input) return
    const actor = ctx.auth.getUserOrFail()
    try {
      const { config, previous } = await CourseService.saveCommercial(
        Number(ctx.params.id),
        input,
        actor.id
      )
      const host = config.checkoutUrl ? new URL(config.checkoutUrl).hostname : ''
      await AuditService.record(ctx, {
        action: 'course.commercial.update',
        actorId: actor.id,
        resourceType: 'course',
        resourceId: config.courseId,
        // O link completo não vai para o log (pode carregar identificadores); só o domínio.
        metadata: {
          revision: config.revision,
          previous: previous ? withoutUrl(previous) : null,
          next: withoutUrl(commercialInput(config)),
          checkoutHost: host,
        },
      })
      const course = await Course.findOrFail(config.courseId)
      // Pausar/retomar vendas vale na página pública sem republicar: invalida o cache do curso.
      if (course.status === 'published') await this.#revalidate(course)
      return respond(course)
    } catch (error) {
      return fail(ctx, error)
    }
  }

  async publish(ctx: HttpContext) {
    const actor = ctx.auth.getUserOrFail()
    try {
      const course = await CourseService.publish(Number(ctx.params.id), actor.id)
      await AuditService.record(ctx, {
        action: 'course.publish',
        actorId: actor.id,
        resourceType: 'course',
        resourceId: course.id,
        metadata: { version: course.publishedVersion },
      })
      await this.#revalidate(course)
      return respond(course)
    } catch (error) {
      return fail(ctx, error)
    }
  }

  async unpublish(ctx: HttpContext) {
    return this.#transition(ctx, 'unpublish')
  }
  async archive(ctx: HttpContext) {
    return this.#transition(ctx, 'archive')
  }
  async restore(ctx: HttpContext) {
    return this.#transition(ctx, 'restore')
  }

  async showcase(ctx: HttpContext) {
    const input = parse(courseShowcaseSchema, ctx.request.body(), ctx)
    if (!input) return
    const actor = ctx.auth.getUserOrFail()
    try {
      const course = await CourseService.setShowcase(Number(ctx.params.id), input, actor.id)
      await AuditService.record(ctx, {
        action: 'course.showcase',
        actorId: actor.id,
        resourceType: 'course',
        resourceId: course.id,
        metadata: input,
      })
      await this.#revalidate(course)
      return respond(course)
    } catch (error) {
      return fail(ctx, error)
    }
  }

  async #transition(ctx: HttpContext, action: 'unpublish' | 'archive' | 'restore') {
    const actor = ctx.auth.getUserOrFail()
    try {
      const course = await CourseService.transition(Number(ctx.params.id), action, actor.id)
      await AuditService.record(ctx, {
        action: `course.${action}`,
        actorId: actor.id,
        resourceType: 'course',
        resourceId: course.id,
      })
      await this.#revalidate(course)
      return respond(course)
    } catch (error) {
      return fail(ctx, error)
    }
  }

  async #revalidate(course: Course) {
    const professional = await Professional.find(course.professionalId)
    if (professional)
      await RevalidationService.revalidate(courseTags(course.slug, professional.slug))
  }
}
