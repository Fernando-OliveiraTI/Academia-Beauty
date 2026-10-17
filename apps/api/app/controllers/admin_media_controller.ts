import { Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { HttpContext } from '@adonisjs/core/http'
import { listMediaQuerySchema, MEDIA_LIMITS } from '@academia/contracts'
import AuditService from '#services/audit_service'
import { DomainError, toDomainError } from '#services/domain_error'
import MediaService from '#services/media_service'

function fail(ctx: HttpContext, raw: unknown) {
  const error = toDomainError(raw)
  if (error instanceof DomainError) {
    return ctx.response
      .status(error.status)
      .send({ message: error.message, code: error.code, errors: error.details })
  }
  throw error
}

/** Teto do corpo do envio: o maior tipo aceito mais folga para o envelope multipart. */
const MAX_BODY = MEDIA_LIMITS.videoBytes + 1024 * 1024

class TooLarge extends Error {}

/** Biblioteca de mídia. Tudo exige `media.manage`; o corpo é lido aqui (bodyparser em modo manual). */
export default class AdminMediaController {
  async index(ctx: HttpContext) {
    const query = listMediaQuerySchema.safeParse(ctx.request.qs())
    if (!query.success) {
      return ctx.response.unprocessableEntity({
        message: 'Dados inválidos',
        errors: query.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      })
    }
    return MediaService.list(query.data)
  }

  async show(ctx: HttpContext) {
    try {
      return await MediaService.get(ctx.params.id)
    } catch (error) {
      return fail(ctx, error)
    }
  }

  async store(ctx: HttpContext) {
    const { request, response } = ctx
    const declared = Number(request.header('content-length') ?? 0)
    if (declared > MAX_BODY) {
      return response.status(413).send({ message: 'Arquivo grande demais', code: 'too_large' })
    }
    let buffer: Buffer | null = null
    let originalName: string | undefined
    try {
      request.multipart.onFile('file', { size: MAX_BODY }, async (part) => {
        originalName = part.file.clientName
        const chunks: Buffer[] = []
        let total = 0
        await pipeline(
          part,
          new Writable({
            write(chunk: Buffer, _enc, cb) {
              total += chunk.length
              if (total > MEDIA_LIMITS.videoBytes) return cb(new TooLarge())
              chunks.push(chunk)
              cb()
            },
          })
        )
        buffer = Buffer.concat(chunks)
      })
      await request.multipart.process()
    } catch (error) {
      if (error instanceof TooLarge) {
        return response.status(413).send({ message: 'Arquivo grande demais', code: 'too_large' })
      }
      return response.status(422).send({ message: 'Envio inválido', code: 'invalid_upload' })
    }
    if (!buffer) {
      return response
        .status(422)
        .send({ message: 'Envie um arquivo no campo "file"', code: 'no_file' })
    }

    const actor = ctx.auth.getUserOrFail()
    try {
      const asset = await MediaService.upload({ buffer, originalName, userId: actor.id })
      await AuditService.record(ctx, {
        action: 'media.upload',
        actorId: actor.id,
        resourceType: 'media',
        resourceId: asset.id,
        metadata: { kind: asset.kind, mime: asset.mime, size: asset.size },
      })
      return response.created(asset)
    } catch (error) {
      return fail(ctx, error)
    }
  }

  async destroy(ctx: HttpContext) {
    const actor = ctx.auth.getUserOrFail()
    try {
      const row = await MediaService.remove(ctx.params.id)
      await AuditService.record(ctx, {
        action: 'media.delete',
        actorId: actor.id,
        resourceType: 'media',
        resourceId: row.id,
        metadata: { kind: row.kind, mime: row.mime },
      })
      return ctx.response.noContent()
    } catch (error) {
      return fail(ctx, error)
    }
  }
}
