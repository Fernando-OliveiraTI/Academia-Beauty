import { createReadStream } from 'node:fs'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import type { Readable } from 'node:stream'

/**
 * Armazenamento dos arquivos de mídia. A implementação local grava em disco; um provedor de objeto
 * (S3/R2) entra na Fase 8 implementando esta mesma interface. As chaves são geradas pelo servidor.
 */
export interface MediaStorage {
  put(key: string, data: Buffer): Promise<void>
  /** `end` é inclusivo, como no cabeçalho Range. */
  read(key: string, range?: { start: number; end: number }): Readable
  size(key: string): Promise<number>
  delete(key: string): Promise<void>
}

const KEY = /^[a-z0-9][a-z0-9/_.-]*$/

export class LocalMediaStorage implements MediaStorage {
  readonly #root: string

  constructor(root: string) {
    this.#root = resolve(root)
  }

  #path(key: string) {
    // Chave só com [a-z0-9/_.-], sem "..": confere de novo o caminho final para nunca sair da raiz.
    if (!KEY.test(key) || key.includes('..') || key.includes('//'))
      throw new Error('Chave de mídia inválida')
    const full = resolve(join(this.#root, key))
    if (!full.startsWith(this.#root + sep)) throw new Error('Chave de mídia inválida')
    return full
  }

  async put(key: string, data: Buffer) {
    const full = this.#path(key)
    await mkdir(dirname(full), { recursive: true })
    await writeFile(full, data, { flag: 'wx' })
  }

  read(key: string, range?: { start: number; end: number }) {
    return createReadStream(this.#path(key), range)
  }

  async size(key: string) {
    const info = await stat(this.#path(key))
    return info.size
  }

  async delete(key: string) {
    await rm(this.#path(key), { force: true })
  }
}
