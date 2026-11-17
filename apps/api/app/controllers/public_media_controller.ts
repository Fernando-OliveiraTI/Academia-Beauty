import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
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
    // Registro existe, arquivo não (armazenamento trocado, cópia incompleta): 404. Sem esta checagem a leitura falhava
    // fora do ciclo da requisição e o erro não tratado derrubava o processo da API inteiro.
    const stored = await mediaStorage()
      .size(file.key)
      .then(() => true)
      .catch(() => false)
    if (!stored) return response.notFound({ message: 'Arquivo não encontrado' })

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
        return response.stream(safeRead(file.key, { start: from, end: to }))
      }
    }
    response.header('content-length', String(file.size))
    return response.stream(safeRead(file.key))
  }
}

/** Leitura com o erro sempre tratado: se o arquivo sumir no meio do envio, encerra só esta resposta. */
function safeRead(key: string, range?: { start: number; end: number }) {
  const stream = mediaStorage().read(key, range)
  stream.on('error', (error) => {
    logger.warn({ err: error, key }, 'falha ao ler arquivo de mídia')
    stream.destroy()
  })
  return stream
}
