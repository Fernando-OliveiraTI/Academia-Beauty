'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PageDocument } from '@academia/page-schema'
import type { ApiResult } from '@/lib/api-client'
import { stableStringify } from '@/lib/stable'

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'invalid' | 'conflict' | 'error' | 'auth' | 'forbidden' | 'archived'

type PutBody = { documentRevision: number; code?: string }
type ServerDoc = { document: unknown; documentRevision: number }

export type AutosaveOptions = {
  doc: PageDocument
  /** Estado já salvo no servidor quando o editor abriu. */
  initialSaved: PageDocument
  initialRevision: number
  enabled: boolean
  validate: (doc: PageDocument) => boolean
  put: (doc: PageDocument, revision: number) => Promise<ApiResult<PutBody>>
  getServer: () => Promise<ApiResult<ServerDoc>>
  debounceMs?: number
  /** Espera (ms) antes da n-ésima nova tentativa após falha de rede/5xx. */
  backoff?: (attempt: number) => number
  maxRetries?: number
}

/**
 * Autosave do documento. Garante: (1) nunca dois PUT em paralelo; (2) edição feita durante um salvamento
 * em andamento é salva logo que ele termina (o indicador só diz "Salvo" quando o servidor tem o documento
 * atual); (3) falha de rede/5xx tenta de novo com espera crescente; (4) 401/403/arquivado/conflito param
 * as tentativas e pedem ação; (5) resposta perdida (409 com o documento do servidor igual ao enviado) é
 * tratada como salva, não como conflito.
 */
export function useAutosave(options: AutosaveOptions) {
  const { doc, enabled } = options
  const [state, setStateRaw] = useState<SaveState>('idle')
  const stateRef = useRef<SaveState>('idle')
  const setState = useCallback((next: SaveState) => { stateRef.current = next; setStateRaw(next) }, [])

  const opts = useRef(options)
  opts.current = options
  const docRef = useRef(doc)
  docRef.current = doc

  const savedRef = useRef(options.initialSaved)
  const revisionRef = useRef(options.initialRevision)
  const savingRef = useRef(false)
  const inflight = useRef<Promise<void> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const failures = useRef(0)
  const blocked = useRef(false)
  const paused = useRef(false)

  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null }
  const schedule = (ms: number) => { clear(); timer.current = setTimeout(() => { void run() }, ms) }

  const run = (): Promise<void> => {
    if (inflight.current) return inflight.current
    const p = attempt().finally(() => { inflight.current = null })
    inflight.current = p
    return p
  }

  async function attempt(): Promise<void> {
    const o = opts.current
    if (!o.enabled || blocked.current || paused.current) return
    const snapshot = docRef.current
    if (snapshot === savedRef.current) return
    if (!o.validate(snapshot)) { setState('invalid'); return }

    savingRef.current = true
    setState('saving')
    let next: 'saved' | 'retry' | 'stop' = 'stop'
    let retryIn = 0
    try {
      const res = await o.put(snapshot, revisionRef.current)
      if (res.ok && res.data) {
        revisionRef.current = res.data.documentRevision
        savedRef.current = snapshot
        failures.current = 0
        next = 'saved'
      } else if (res.status === 409) {
        // Resposta perdida? Se o servidor já tem exatamente o que enviamos, adota a revisão dele.
        const server = await o.getServer()
        if (server.ok && server.data && stableStringify(server.data.document) === stableStringify(snapshot)) {
          revisionRef.current = server.data.documentRevision
          savedRef.current = snapshot
          next = 'saved'
        } else {
          blocked.current = true
          setState('conflict')
        }
      } else if (res.status === 401) {
        blocked.current = true
        setState('auth')
      } else if (res.status === 403) {
        blocked.current = true
        setState('forbidden')
      } else if (res.status === 422) {
        if (res.data?.code === 'archived') { blocked.current = true; setState('archived') } else setState('invalid')
      } else {
        failures.current += 1
        if (failures.current <= (o.maxRetries ?? 5)) {
          next = 'retry'
          retryIn = (o.backoff ?? ((n) => Math.min(30_000, 2000 * 2 ** (n - 1))))(failures.current)
        }
        setState('error')
      }
    } finally {
      savingRef.current = false
    }
    if (next === 'saved') {
      if (docRef.current !== savedRef.current) {
        // Houve edição durante o salvamento: salva de novo (sem dizer "Salvo" antes da hora).
        setState('dirty')
        schedule(150)
      } else setState('saved')
    } else if (next === 'retry') schedule(retryIn)
  }

  // Reage a cada mudança do documento: agenda o debounce ou reconhece que voltou ao estado salvo.
  useEffect(() => {
    if (!enabled) return
    if (doc === savedRef.current) {
      clear()
      if (!savingRef.current && ['dirty', 'invalid', 'error'].includes(stateRef.current)) setState('saved')
      return
    }
    if (blocked.current || paused.current) return
    if (!savingRef.current) setState(opts.current.validate(doc) ? 'dirty' : 'invalid')
    schedule(opts.current.debounceMs ?? 1200)
    return clear
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, enabled])

  useEffect(() => clear, [])

  /** Tenta salvar agora e devolve se o servidor tem o documento atual (usado antes de publicar). */
  const ensureSaved = useCallback(async () => {
    for (let i = 0; i < 4; i += 1) {
      clear()
      if (docRef.current === savedRef.current && !savingRef.current) return true
      if (blocked.current) return false
      await run()
    }
    return docRef.current === savedRef.current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Retoma depois de 401/403/conflito resolvido ou erro persistente. */
  const retry = useCallback(() => {
    blocked.current = false
    failures.current = 0
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Suspende o autosave durante uma operação destrutiva (restaurar); devolve a função que retoma. */
  const pause = useCallback(() => {
    paused.current = true
    clear()
    return () => { paused.current = false }
  }, [])

  const isSaved = useCallback(() => docRef.current === savedRef.current && !savingRef.current, [])

  return { state, ensureSaved, retry, pause, isSaved, revisionRef }
}
