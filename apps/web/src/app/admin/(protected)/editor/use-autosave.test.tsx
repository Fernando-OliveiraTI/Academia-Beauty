import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { PageDocument } from '@academia/page-schema'
import type { ApiResult } from '@/lib/api-client'
import { useAutosave } from './use-autosave'

const make = (n: number) => ({ schemaVersion: 1, template: { key: 't', version: 1 }, sections: [], n }) as unknown as PageDocument
const ok = (documentRevision: number): ApiResult<{ documentRevision: number }> => ({ ok: true, status: 200, data: { documentRevision } })
const fail = (status: number, data: unknown = null): ApiResult<never> => ({ ok: false, status, data: data as never })
const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r }); return { promise, resolve } }

type Put = (doc: PageDocument, revision: number) => Promise<ApiResult<{ documentRevision: number; code?: string }>>
function setup(put: Put, extra: { getServer?: () => Promise<ApiResult<{ document: unknown; documentRevision: number }>>; validate?: (d: PageDocument) => boolean } = {}) {
  const initial = make(0)
  return renderHook(
    ({ doc }) => useAutosave({
      doc, initialSaved: initial, initialRevision: 3, enabled: true,
      validate: extra.validate ?? (() => true), put,
      getServer: extra.getServer ?? (async () => ({ ok: false, status: 0, data: null })),
      backoff: (n) => n * 1000,
    }),
    { initialProps: { doc: initial } },
  )
}
const tick = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('useAutosave', () => {
  it('salva depois do debounce e informa "saved"', async () => {
    const put = vi.fn<Put>(async (_d, rev) => ok(rev + 1))
    const { result, rerender } = setup(put)
    rerender({ doc: make(1) })
    expect(result.current.state).toBe('dirty')
    await tick(1300)
    expect(put).toHaveBeenCalledTimes(1)
    expect(put.mock.calls[0]![1]).toBe(3)
    expect(result.current.state).toBe('saved')
    expect(result.current.revisionRef.current).toBe(4)
  })

  it('edição feita durante um salvamento lento é salva logo depois (não fica como "Salvo" com dado pendente)', async () => {
    const first = deferred<ApiResult<{ documentRevision: number }>>()
    const put = vi.fn<Put>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(async (_d, rev) => ok(rev + 1))
    const { result, rerender } = setup(put)
    rerender({ doc: make(1) })
    await tick(1300) // PUT 1 em andamento
    expect(result.current.state).toBe('saving')
    rerender({ doc: make(2) })
    await tick(1300) // o debounce da 2ª edição dispara com o PUT 1 ainda aberto
    expect(put).toHaveBeenCalledTimes(1)
    await act(async () => { first.resolve(ok(4)) })
    expect(result.current.state).not.toBe('saved')
    await tick(300)
    expect(put).toHaveBeenCalledTimes(2)
    expect(put.mock.calls[1]![0]).toMatchObject({ n: 2 })
    expect(put.mock.calls[1]![1]).toBe(4)
    expect(result.current.state).toBe('saved')
  })

  it('falha de rede tenta de novo com espera crescente e termina salvo', async () => {
    const put = vi.fn<Put>().mockResolvedValueOnce(fail(0)).mockResolvedValueOnce(fail(503)).mockImplementation(async (_d, rev) => ok(rev + 1))
    const { result, rerender } = setup(put)
    rerender({ doc: make(1) })
    await tick(1300)
    expect(result.current.state).toBe('error')
    await tick(1000)
    expect(put).toHaveBeenCalledTimes(2)
    expect(result.current.state).toBe('error')
    await tick(2000)
    expect(put).toHaveBeenCalledTimes(3)
    expect(result.current.state).toBe('saved')
  })

  it('401 para as tentativas e retry() retoma', async () => {
    const put = vi.fn<Put>().mockResolvedValueOnce(fail(401)).mockImplementation(async (_d, rev) => ok(rev + 1))
    const { result, rerender } = setup(put)
    rerender({ doc: make(1) })
    await tick(1300)
    expect(result.current.state).toBe('auth')
    await tick(60_000)
    expect(put).toHaveBeenCalledTimes(1)
    await act(async () => { result.current.retry(); await vi.advanceTimersByTimeAsync(10) })
    expect(put).toHaveBeenCalledTimes(2)
    expect(result.current.state).toBe('saved')
  })

  it('403 e arquivado bloqueiam sem insistir', async () => {
    const put403 = vi.fn<Put>(async () => fail(403))
    const a = setup(put403)
    a.rerender({ doc: make(1) })
    await tick(1300)
    expect(a.result.current.state).toBe('forbidden')
    await tick(60_000)
    expect(put403).toHaveBeenCalledTimes(1)

    const putArch = vi.fn<Put>(async () => fail(422, { code: 'archived' }))
    const b = setup(putArch)
    b.rerender({ doc: make(1) })
    await tick(1300)
    expect(b.result.current.state).toBe('archived')
  })

  it('409 com o servidor já igual ao enviado (resposta perdida) vira salvo, não conflito', async () => {
    const sent = make(1)
    const put = vi.fn<Put>(async () => fail(409))
    const getServer = vi.fn(async () => ({ ok: true, status: 200, data: { document: JSON.parse(JSON.stringify(sent)), documentRevision: 4 } }))
    const { result, rerender } = setup(put, { getServer })
    rerender({ doc: sent })
    await tick(1300)
    expect(result.current.state).toBe('saved')
    expect(result.current.revisionRef.current).toBe(4)
  })

  it('409 real (servidor diferente) bloqueia como conflito e não envia mais', async () => {
    const put = vi.fn<Put>(async () => fail(409))
    const getServer = vi.fn(async () => ({ ok: true, status: 200, data: { document: make(99), documentRevision: 7 } }))
    const { result, rerender } = setup(put, { getServer })
    rerender({ doc: make(1) })
    await tick(1300)
    expect(result.current.state).toBe('conflict')
    rerender({ doc: make(2) })
    await tick(5000)
    expect(put).toHaveBeenCalledTimes(1)
  })

  it('voltar (desfazer) ao estado salvo cancela o envio e mostra salvo', async () => {
    const put = vi.fn<Put>(async (_d, rev) => ok(rev + 1))
    const initial = make(0)
    const { result, rerender } = renderHook(
      ({ doc }) => useAutosave({ doc, initialSaved: initial, initialRevision: 1, enabled: true, validate: () => true, put, getServer: async () => fail(0) }),
      { initialProps: { doc: initial } },
    )
    rerender({ doc: make(1) })
    expect(result.current.state).toBe('dirty')
    rerender({ doc: initial })
    expect(result.current.state).toBe('saved')
    await tick(5000)
    expect(put).not.toHaveBeenCalled()
  })

  it('documento inválido nunca é enviado', async () => {
    const put = vi.fn<Put>(async (_d, rev) => ok(rev + 1))
    const { result, rerender } = setup(put, { validate: () => false })
    rerender({ doc: make(1) })
    await tick(5000)
    expect(result.current.state).toBe('invalid')
    expect(put).not.toHaveBeenCalled()
  })

  it('ensureSaved salva e só confirma quando o servidor tem o documento atual', async () => {
    const put = vi.fn<Put>(async (_d, rev) => ok(rev + 1))
    const { result, rerender } = setup(put)
    rerender({ doc: make(1) })
    let saved = false
    await act(async () => { saved = await result.current.ensureSaved() })
    expect(saved).toBe(true)
    expect(put).toHaveBeenCalledTimes(1)
  })

  it('pause() impede o envio durante operações destrutivas', async () => {
    const put = vi.fn<Put>(async (_d, rev) => ok(rev + 1))
    const { result, rerender } = setup(put)
    rerender({ doc: make(1) })
    let resume = () => {}
    act(() => { resume = result.current.pause() })
    await tick(5000)
    expect(put).not.toHaveBeenCalled()
    act(() => { resume() })
    expect(result.current.isSaved()).toBe(false)
  })
})
