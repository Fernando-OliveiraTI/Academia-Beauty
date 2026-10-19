import type { HttpContext } from '@adonisjs/core/http'
import type { ZodType } from 'zod'
import {
  createProfessionalSchema,
  listProfessionalsQuerySchema,
  publishReadiness,
  showcaseSchema,
  updateProfessionalSchema,
} from '@academia/contracts'
import Professional from '#models/professional'
import AuditService from '#services/audit_service'
import ProfessionalService, {
  DomainError,
  toDomainError,
  professionalTags,
  toAdmin,
} from '#services/professional_service'
import CourseService from '#services/course_service'
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

/**
 * As páginas de curso exibem dados do profissional e só existem enquanto ele está publicado:
 * publicar, despublicar ou arquivar também invalida o cache dos cursos publicados dele.
 */
async function withCourseTags(p: Professional) {
  const slugs = await CourseService.publishedSlugsOf(p.id)
  return [...professionalTags(p.slug), ...slugs.map((s) => `course:${s}`)]
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`)

export default class AdminProfessionalsController {
  async index(ctx: HttpContext) {
    const query = parse(listProfessionalsQuerySchema, ctx.request.qs(), ctx)
    if (!query) return
    // A busca vale para a lista e para as contagens por situação (que ignoram só o filtro de situação).
    const filtered = () => {
      const builder = Professional.query()
      if (query.q) {
        const like = `%${escapeLike(query.q)}%`
        builder.where((q) =>
          q
            .whereRaw("name like ? escape '\\\\'", [like])
            .orWhereRaw("slug like ? escape '\\\\'", [like])
        )
      }
      return builder
    }
    const builder = filtered()
    applySort(builder, String(ctx.request.input('sort') ?? ''), 'name')
    if (query.status) builder.where('status', query.status)
    else builder.whereNot('status', 'archived')
    const countRows = await filtered().groupBy('status').select('status').count('* as total')
    const counts = { draft: 0, published: 0, archived: 0 }
    for (const row of countRows) {
      counts[row.status as keyof typeof counts] = Number(row.$extras.total)
    }
    const page = await builder.paginate(query.page, query.perPage)
    return {
      items: page.all().map(toAdmin),
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
    const p = await Professional.find(ctx.params.id)
    if (!p) return ctx.response.notFound({ message: 'Profissional não encontrado' })
    return { ...toAdmin(p), readiness: publishReadiness(p.data) }
  }

  async store(ctx: HttpContext) {
    const input = parse(createProfessionalSchema, ctx.request.body(), ctx)
    if (!input) return
    const actor = ctx.auth.getUserOrFail()
    try {
      const p = await ProfessionalService.create(
        input.slug,
        input.data,
        actor.id,
        input.templateKey
      )
      await AuditService.record(ctx, {
        action: 'professional.create',
        actorId: actor.id,
        resourceType: 'professional',
        resourceId: p.id,
        metadata: { slug: p.slug, templateKey: p.templateKey },
      })
      return ctx.response.created({ ...toAdmin(p), readiness: publishReadiness(p.data) })
    } catch (error) {
      return fail(ctx, error)
    }
  }

  async duplicate(ctx: HttpContext) {
    const actor = ctx.auth.getUserOrFail()
    try {
      const p = await ProfessionalService.duplicate(Number(ctx.params.id), actor.id)
      await AuditService.record(ctx, {
        action: 'professional.duplicate',
        actorId: actor.id,
        resourceType: 'professional',
        resourceId: p.id,
        metadata: { slug: p.slug, sourceId: Number(ctx.params.id) },
      })
      return ctx.response.created({ ...toAdmin(p), readiness: publishReadiness(p.data) })
    } catch (error) {
      return fail(ctx, error)
    }
  }

  async update(ctx: HttpContext) {
    const input = parse(updateProfessionalSchema, ctx.request.body(), ctx)
    if (!input) return
    const actor = ctx.auth.getUserOrFail()
    try {
      const p = await ProfessionalService.update(Number(ctx.params.id), input, actor.id)
      await AuditService.record(ctx, {
        action: 'professional.update',
        actorId: actor.id,
        resourceType: 'professional',
        resourceId: p.id,
        metadata: { revision: p.revision },
      })
      return { ...toAdmin(p), readiness: publishReadiness(p.data) }
    } catch (error) {
      return fail(ctx, error)
    }
  }

  async publish(ctx: HttpContext) {
    const actor = ctx.auth.getUserOrFail()
    try {
      const p = await ProfessionalService.publish(Number(ctx.params.id), actor.id)
      await AuditService.record(ctx, {
        action: 'professional.publish',
        actorId: actor.id,
        resourceType: 'professional',
        resourceId: p.id,
        metadata: { version: p.publishedVersion },
      })
      await RevalidationService.revalidate(await withCourseTags(p))
      return toAdmin(p)
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
    const input = parse(showcaseSchema, ctx.request.body(), ctx)
    if (!input) return
    const actor = ctx.auth.getUserOrFail()
    try {
      const p = await ProfessionalService.setShowcase(Number(ctx.params.id), input, actor.id)
      await AuditService.record(ctx, {
        action: 'professional.showcase',
        actorId: actor.id,
        resourceType: 'professional',
        resourceId: p.id,
        metadata: input,
      })
      await RevalidationService.revalidate(professionalTags(p.slug))
      return toAdmin(p)
    } catch (error) {
      return fail(ctx, error)
    }
  }

  async destroy(ctx: HttpContext) {
    const actor = ctx.auth.getUserOrFail()
    try {
      const gone = await ProfessionalService.destroy(Number(ctx.params.id))
      await AuditService.record(ctx, {
        action: 'professional.delete',
        actorId: actor.id,
        resourceType: 'professional',
        resourceId: gone.id,
        metadata: { slug: gone.slug, name: gone.name },
      })
      await RevalidationService.revalidate(professionalTags(gone.slug))
      return ctx.response.noContent()
    } catch (error) {
      return fail(ctx, error)
    }
  }

  async #transition(ctx: HttpContext, action: 'unpublish' | 'archive' | 'restore') {
    const actor = ctx.auth.getUserOrFail()
    try {
      const p = await ProfessionalService.transition(Number(ctx.params.id), action, actor.id)
      await AuditService.record(ctx, {
        action: `professional.${action}`,
        actorId: actor.id,
        resourceType: 'professional',
        resourceId: p.id,
      })
      await RevalidationService.revalidate(await withCourseTags(p))
      return toAdmin(p)
    } catch (error) {
      return fail(ctx, error)
    }
  }
}
