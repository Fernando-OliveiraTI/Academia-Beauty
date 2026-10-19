import type { HttpContext } from '@adonisjs/core/http'
import { z, type ZodType } from 'zod'
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
  providerOf,
  courseTags,
  toAdmin,
} from '#services/course_service'
import { DomainError, toDomainError } from '#services/domain_error'
import ThemembersSyncService from '#services/themembers_sync_service'
import RevalidationService from '#services/revalidation_service'
import { applySort } from '#services/list_sort'

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

const themembersLinkSchema = z.object({
  externalCourseId: z
    .string()
    .trim()
    .min(1, 'Informe o ID da The Members')
    .max(128)
    .regex(/^[A-Za-z0-9_.:-]+$/, 'Use apenas letras, números e _ . : -'),
})

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
  /** Resumo do que a sincronização com a The Members mudaria (não grava nada). */
  async themembersPreview(ctx: HttpContext) {
    try {
      return await new ThemembersSyncService().preview()
    } catch (error) {
      return fail(ctx, error)
    }
  }

  /** Aplica o resumo: nome e valor da The Members nos cursos vinculados. */
  async themembersApply(ctx: HttpContext) {
    const actor = ctx.auth.getUserOrFail()
    try {
      const results = await new ThemembersSyncService().apply(actor.id)
      for (const r of results.filter((x) => x.applied.length)) {
        await AuditService.record(ctx, {
          action: 'course.themembers.sync',
          actorId: actor.id,
          resourceType: 'course',
          resourceId: r.courseId,
          metadata: { applied: r.applied },
        })
      }
      return { results }
    } catch (error) {
      return fail(ctx, error)
    }
  }

  /** Grava só o ID da The Members de um curso (botão "Salvar" do modal de sincronização). */
  async themembersLink(ctx: HttpContext) {
    const input = parse(themembersLinkSchema, ctx.request.body(), ctx)
    if (!input) return
    const actor = ctx.auth.getUserOrFail()
    try {
      const { course, config, previous } = await new ThemembersSyncService().link(
        Number(ctx.params.id),
        input.externalCourseId,
        actor.id
      )
      await AuditService.record(ctx, {
        action: 'course.themembers.link',
        actorId: actor.id,
        resourceType: 'course',
        resourceId: course.id,
        metadata: { revision: config.revision, previous, next: config.externalCourseId },
      })
      return { courseId: course.id, externalCourseId: config.externalCourseId }
    } catch (error) {
      return fail(ctx, error)
    }
  }

  /** Remove o vínculo com a The Members (botão "Remover vínculo" do modal de sincronização). */
  async themembersUnlink(ctx: HttpContext) {
    const actor = ctx.auth.getUserOrFail()
    try {
      const { course, config, previous } = await new ThemembersSyncService().unlink(
        Number(ctx.params.id),
        actor.id
      )
      if (previous) {
        await AuditService.record(ctx, {
          action: 'course.themembers.unlink',
          actorId: actor.id,
          resourceType: 'course',
          resourceId: course.id,
          metadata: { revision: config.revision, previous },
        })
      }
      return { courseId: course.id, externalCourseId: '' }
    } catch (error) {
      return fail(ctx, error)
    }
  }

  async index(ctx: HttpContext) {
    const query = parse(listCoursesQuerySchema, ctx.request.qs(), ctx)
    if (!query) return
    const filtered = () => {
      const builder = Course.query()
      if (query.professionalId) builder.where('professional_id', query.professionalId)
      if (query.q) {
        const like = `%${escapeLike(query.q)}%`
        builder.where((q) =>
          q
            .whereRaw("title like ? escape '\\\\'", [like])
            .orWhereRaw("slug like ? escape '\\\\'", [like])
            .orWhereIn('professional_id', (sub) =>
              sub.from('professionals').select('id').whereRaw("name like ? escape '\\\\'", [like])
            )
        )
      }
      return builder
    }
    const builder = filtered()
    applySort(builder, String(ctx.request.input('sort') ?? ''), 'title')
    if (query.status) builder.where('status', query.status)
    else builder.whereNot('status', 'archived')
    const countRows = await filtered().groupBy('status').select('status').count('* as total')
    const counts = { draft: 0, published: 0, archived: 0 }
    for (const row of countRows) {
      counts[row.status as keyof typeof counts] = Number(row.$extras.total)
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
        counts,
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

  async duplicate(ctx: HttpContext) {
    const actor = ctx.auth.getUserOrFail()
    try {
      const course = await CourseService.duplicate(Number(ctx.params.id), actor.id)
      // Preço, desconto e parcelas vão junto só para quem gerencia a oferta; sem link e inativa (nunca vende por engano).
      const offer = await CommercialConfig.query().where('course_id', Number(ctx.params.id)).first()
      if (offer && actor.permissions.includes('commerce.manage')) {
        await CourseService.saveCommercial(
          course.id,
          {
            listCents: offer.listCents,
            discountPct: offer.discountPct,
            maxInstallments: offer.maxInstallments,
            checkoutUrl: '',
            provider: providerOf(offer.provider),
            externalCourseId: '', // a cópia não herda IDs externos
            environment: offer.environment,
            active: false,
            revision: 0,
          },
          actor.id
        )
      }
      await AuditService.record(ctx, {
        action: 'course.duplicate',
        actorId: actor.id,
        resourceType: 'course',
        resourceId: course.id,
        metadata: { slug: course.slug, sourceId: Number(ctx.params.id) },
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

  async destroy(ctx: HttpContext) {
    const actor = ctx.auth.getUserOrFail()
    try {
      const gone = await CourseService.destroy(Number(ctx.params.id))
      await AuditService.record(ctx, {
        action: 'course.delete',
        actorId: actor.id,
        resourceType: 'course',
        resourceId: gone.id,
        metadata: { slug: gone.slug, title: gone.title },
      })
      const professional = await Professional.find(gone.professionalId)
      if (professional)
        await RevalidationService.revalidate(courseTags(gone.slug, professional.slug))
      return ctx.response.noContent()
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
