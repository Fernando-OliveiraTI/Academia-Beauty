import { createHash, randomBytes } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { fileTypeFromBuffer } from 'file-type'
import sharp from 'sharp'
import {
  MEDIA_IMAGE_TYPES,
  MEDIA_LIMITS,
  MEDIA_VIDEO_TYPES,
  MEDIA_WIDTHS,
  type ListMediaQuery,
  type MediaAsset,
} from '@academia/contracts'
import { DomainError } from '#services/domain_error'
import { LocalMediaStorage, type MediaStorage } from '#services/media/storage'
import env from '#start/env'

const IMAGE_TYPES: readonly string[] = MEDIA_IMAGE_TYPES
const VIDEO_TYPES: readonly string[] = MEDIA_VIDEO_TYPES
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

let storage: MediaStorage | null = null
/** Provedor de armazenamento. Hoje local; troca por objeto (S3/R2) na Fase 8 sem tocar no resto. */
export function mediaStorage(): MediaStorage {
  storage ??= new LocalMediaStorage(
    env.get('MEDIA_STORAGE_PATH')
      ? app.makePath(env.get('MEDIA_STORAGE_PATH') as string)
      : app.makePath('storage/media')
  )
  return storage
}
export function useMediaStorage(next: MediaStorage | null) {
  storage = next
}

type AssetRow = {
  id: string
  kind: 'image' | 'video'
  original_name: string
  mime: string
  size: number
  width: number | null
  height: number | null
  storage_key: string
  created_at: Date | string
}

export const MEDIA_ID_RE = /\/media\/([0-9a-f]{32})/g

// eslint-disable-next-line no-control-regex
const UNSAFE_NAME_CHARS = /[\u0000-\u001f\u007f<>"'`]/g

/** Nome seguro para exibição: sem caminho, sem marcação, sem controle. */
export function cleanName(raw: string | undefined) {
  const base = (raw ?? 'arquivo').split(/[\\/]/).pop() ?? 'arquivo'
  const cleaned = base.replace(UNSAFE_NAME_CHARS, '').trim().slice(0, 120)
  return cleaned || 'arquivo'
}

export function toDto(row: AssetRow, inUse: boolean): MediaAsset {
  return {
    id: row.id,
    kind: row.kind,
    name: row.original_name,
    mime: row.mime,
    size: row.size,
    width: row.width,
    height: row.height,
    path: `/media/${row.id}`,
    createdAt: new Date(row.created_at).toISOString(),
    inUse,
  }
}

const asText = (value: unknown) =>
  value === null || value === undefined
    ? ''
    : typeof value === 'string'
      ? value
      : JSON.stringify(value)

export type MediaUsage = {
  type: 'professional' | 'course' | 'home'
  id: number
  label: string
  published: boolean
}

export default class MediaService {
  /**
   * Valida e grava um arquivo. O tipo vem da assinatura dos bytes; imagens são decodificadas por
   * completo (arquivo corrompido ou disfarçado falha aqui) e ganham derivados webp/avif.
   */
  static async upload(input: { buffer: Buffer; originalName?: string; userId: number }) {
    const { buffer } = input
    if (buffer.length === 0) throw new DomainError(422, 'empty_file', 'O arquivo está vazio')
    const detected = await fileTypeFromBuffer(buffer)
    // Vídeos de celular e o vídeo atual do site são contêineres QuickTime (`ftyp qt`) com H.264: os navegadores
    // os tocam como MP4, então entram (e são servidos) como MP4.
    const mime = detected?.mime === 'video/quicktime' ? 'video/mp4' : detected?.mime
    if (!mime || !(IMAGE_TYPES.includes(mime) || VIDEO_TYPES.includes(mime))) {
      throw new DomainError(
        422,
        'unsupported_type',
        'Tipo de arquivo não aceito. Use JPG, PNG, WebP ou AVIF (imagem) ou MP4 ou WebM (vídeo).'
      )
    }
    const kind = IMAGE_TYPES.includes(mime) ? 'image' : 'video'
    const limit = kind === 'image' ? MEDIA_LIMITS.imageBytes : MEDIA_LIMITS.videoBytes
    if (buffer.length > limit) {
      throw new DomainError(
        422,
        'too_large',
        `Arquivo acima do limite de ${limit / 1024 / 1024} MB`
      )
    }

    const id = randomBytes(16).toString('hex')
    const prefix = `${id.slice(0, 2)}/${id}`
    const ext = EXT[mime] as string
    const written: string[] = []
    const put = async (key: string, data: Buffer) => {
      await mediaStorage().put(key, data)
      written.push(key)
    }

    let width: number | null = null
    let height: number | null = null
    const variants: {
      format: 'webp' | 'avif'
      width: number
      height: number
      size: number
      key: string
    }[] = []

    try {
      if (kind === 'image') {
        const pipeline = () =>
          sharp(buffer, { limitInputPixels: MEDIA_LIMITS.imagePixels, failOn: 'error' }).rotate()
        let meta
        try {
          meta = await pipeline().toBuffer({ resolveWithObject: true })
        } catch {
          throw new DomainError(422, 'invalid_image', 'Imagem inválida ou corrompida')
        }
        width = meta.info.width
        height = meta.info.height
        if (width > MEDIA_LIMITS.imageSide || height > MEDIA_LIMITS.imageSide) {
          throw new DomainError(
            422,
            'image_too_big',
            `Imagem acima de ${MEDIA_LIMITS.imageSide}px de lado`
          )
        }
        const top = Math.min(width, MEDIA_WIDTHS[MEDIA_WIDTHS.length - 1])
        const widths = [...new Set([...MEDIA_WIDTHS.filter((w) => w < top), top])]
        for (const w of widths) {
          for (const format of ['webp', 'avif'] as const) {
            const resized = pipeline().resize({ width: w, withoutEnlargement: true })
            const out = await (
              format === 'webp'
                ? resized.webp({ quality: 82 })
                : resized.avif({ quality: 55, effort: 2 })
            ).toBuffer({ resolveWithObject: true })
            const key = `${prefix}/${w}.${format}`
            await put(key, out.data)
            variants.push({
              format,
              width: out.info.width,
              height: out.info.height,
              size: out.data.length,
              key,
            })
          }
        }
      }
      // O original fica guardado (reprocessamento futuro); imagens nunca são servidas a partir dele.
      const originalKey = `${prefix}/original.${ext}`
      await put(originalKey, buffer)

      await db.transaction(async (trx) => {
        await trx.table('media_assets').insert({
          id,
          kind,
          original_name: cleanName(input.originalName),
          mime,
          size: buffer.length,
          width,
          height,
          sha256: createHash('sha256').update(buffer).digest('hex'),
          storage_key: originalKey,
          created_by: input.userId,
          created_at: new Date(),
        })
        for (const v of variants) {
          await trx.table('media_variants').insert({
            asset_id: id,
            format: v.format,
            width: v.width,
            height: v.height,
            size: v.size,
            storage_key: v.key,
          })
        }
      })
    } catch (error) {
      await Promise.all(
        written.map((key) =>
          mediaStorage()
            .delete(key)
            .catch(() => {})
        )
      )
      throw error
    }
    const row = (await db.from('media_assets').where('id', id).first()) as AssetRow
    return toDto(row, false)
  }

  /** Onde cada arquivo aparece: rascunhos e versões publicadas vigentes (histórico antigo não conta). */
  static async usageMap(): Promise<Map<string, MediaUsage[]>> {
    const map = new Map<string, MediaUsage[]>()
    const add = (text: string, usage: MediaUsage) => {
      for (const m of text.matchAll(MEDIA_ID_RE)) {
        const list = map.get(m[1] as string) ?? []
        if (
          !list.some(
            (u) => u.type === usage.type && u.id === usage.id && u.published === usage.published
          )
        ) {
          list.push(usage)
        }
        map.set(m[1] as string, list)
      }
    }
    for (const [type, table, versions, fk, label] of [
      ['professional', 'professionals', 'professional_versions', 'professional_id', 'name'],
      ['course', 'courses', 'course_versions', 'course_id', 'title'],
    ] as const) {
      const rows = await db.from(table).select('id', label, 'data', 'document', 'published_version')
      for (const r of rows) {
        const base = { type, id: r.id as number, label: String(r[label]) }
        add(asText(r.data) + asText(r.document), { ...base, published: false })
        if (r.published_version) {
          const v = await db
            .from(versions)
            .where(fk, r.id)
            .where('version', r.published_version)
            .first()
          if (v) add(asText(v.data) + asText(v.document), { ...base, published: true })
        }
      }
    }
    // Home: rascunho e snapshot vigente.
    const home = await db.from('home_pages').where('id', 1).first()
    if (home) {
      const base = { type: 'home' as const, id: 1, label: 'Home' }
      add(asText(home.document), { ...base, published: false })
      if (home.published_version) {
        const v = await db
          .from('home_versions')
          .where('home_id', 1)
          .where('version', home.published_version)
          .first()
        if (v) add(asText(v.document), { ...base, published: true })
      }
    }
    return map
  }

  static async list(query: ListMediaQuery) {
    const builder = db.from('media_assets').orderBy('created_at', 'desc').orderBy('id', 'desc')
    if (query.kind) builder.where('kind', query.kind)
    if (query.q) {
      builder.whereRaw("original_name like ? escape '\\\\'", [
        `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`,
      ])
    }
    const page = await builder.paginate(query.page, query.perPage)
    const usage = await MediaService.usageMap()
    return {
      items: page.all().map((r: AssetRow) => toDto(r, usage.has(r.id))),
      page: page.currentPage,
      perPage: page.perPage,
      total: page.total,
    }
  }

  static async usagesOf(id: string) {
    const map = await MediaService.usageMap()
    return map.get(id) ?? []
  }

  static async get(id: string) {
    const row = (await db.from('media_assets').where('id', id).first()) as AssetRow | undefined
    if (!row) throw new DomainError(404, 'not_found', 'Arquivo não encontrado')
    const usages = await MediaService.usagesOf(id)
    return { asset: toDto(row, usages.length > 0), usages }
  }

  static async remove(id: string) {
    const row = (await db.from('media_assets').where('id', id).first()) as AssetRow | undefined
    if (!row) throw new DomainError(404, 'not_found', 'Arquivo não encontrado')
    const usages = await MediaService.usagesOf(id)
    if (usages.length) {
      throw new DomainError(409, 'in_use', 'O arquivo está em uso e não pode ser excluído', usages)
    }
    const variants = await db.from('media_variants').where('asset_id', id).select('storage_key')
    await db.from('media_assets').where('id', id).delete()
    for (const key of [row.storage_key, ...variants.map((v) => v.storage_key as string)]) {
      await mediaStorage()
        .delete(key)
        .catch(() => {})
    }
    return row
  }

  /**
   * Escolhe o arquivo a servir. Imagem: menor derivado com largura >= `w` (ou o maior se não houver `w`),
   * em AVIF quando o navegador aceita, senão WebP. Vídeo: o próprio arquivo.
   */
  static async resolveFile(id: string, opts: { w?: number; accept?: string }) {
    const row = (await db.from('media_assets').where('id', id).first()) as AssetRow | undefined
    if (!row) return null
    if (row.kind === 'video') {
      return {
        key: row.storage_key,
        mime: row.mime,
        size: row.size,
        etag: `"${id}"`,
        kind: row.kind,
      }
    }
    const wantAvif = /image\/avif/i.test(opts.accept ?? '')
    const rows = await db.from('media_variants').where('asset_id', id).orderBy('width', 'asc')
    const pool = rows.filter((v) => v.format === (wantAvif ? 'avif' : 'webp'))
    if (pool.length === 0) return null
    const pick =
      (opts.w ? pool.find((v) => v.width >= (opts.w as number)) : undefined) ??
      pool[pool.length - 1]
    return {
      key: pick.storage_key as string,
      mime: `image/${pick.format}`,
      size: pick.size as number,
      etag: `"${id}-${pick.width}-${pick.format}"`,
      kind: row.kind,
    }
  }
}
