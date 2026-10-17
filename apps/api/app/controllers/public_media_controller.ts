import type { HttpContext } from '@adonisjs/core/http'
import MediaService, { mediaStorage } from '#services/media_service'

const RANGE = /^bytes=(\d*)-(\d*)$/

/**
 * Entrega pública de `/media/<id>`. O conteúdo de um id nunca muda, então o cache é imutável.
 * Imagem: derivado negociado por `Accept` e `?w=`. Vídeo: arquivo original com suporte a Range.
 */
export default class PublicMediaController {
  async show({ params, request, response }: HttpContext) {
    const w = Number(request.input('w'))
    const file = await MediaService.resolveFile(params.id, {
      w: Number.isInteger(w) && w > 0 && w <= 4096 ? w : undefined,
      accept: request.header('x-original-accept'),
    })
    if (!file) return response.notFound({ message: 'Arquivo não encontrado' })

    response.header('content-type', file.mime)
    response.header('x-content-type-options', 'nosniff')
    response.header('cache-control', 'public, max-age=31536000, immutable')
    response.header('vary', 'Accept')
    response.header('etag', file.etag)
    response.header('content-disposition', 'inline')
    response.header('cross-origin-resource-policy', 'same-site')
    if (request.header('if-none-match') === file.etag) return response.status(304).send('')

    if (file.kind === 'video') {
      response.header('accept-ranges', 'bytes')
      const header = request.header('range')
      if (header) {
        const m = RANGE.exec(header)
        const start = m && m[1] !== '' ? Number(m[1]) : Number.NaN
        const end = m && m[2] !== '' ? Number(m[2]) : file.size - 1
        const suffix = m && m[1] === '' && m[2] !== '' ? Number(m[2]) : null
        const from = suffix !== null ? Math.max(0, file.size - suffix) : start
        const to = suffix !== null ? file.size - 1 : Math.min(end, file.size - 1)
        if (
          !m ||
          !Number.isInteger(from) ||
          !Number.isInteger(to) ||
          from > to ||
          from >= file.size
        ) {
          response.header('content-range', `bytes */${file.size}`)
          return response.status(416).send('')
        }
        response.status(206)
        response.header('content-range', `bytes ${from}-${to}/${file.size}`)
        response.header('content-length', String(to - from + 1))
        return response.stream(mediaStorage().read(file.key, { start: from, end: to }))
      }
    }
    response.header('content-length', String(file.size))
    return response.stream(mediaStorage().read(file.key))
  }
}
