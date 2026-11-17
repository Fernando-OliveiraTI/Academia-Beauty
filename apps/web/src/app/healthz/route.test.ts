import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

afterEach(() => vi.unstubAllGlobals())

const shallow = () => GET(new Request('http://site/healthz'))
const deep = () => GET(new Request('http://site/healthz?deep=1'))

describe('GET /healthz (padrão: só o processo do site)', () => {
  it('200 sem consultar a API: uma queda da API não pode reiniciar o site', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('API fora'))
    vi.stubGlobal('fetch', fetch)
    const res = await shallow()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('GET /healthz?deep=1 (também a API)', () => {
  it('200 quando a API responde', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
    const res = await deep()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok', api: 'ok' })
  })
  it('503 quando a API responde erro', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })))
    const res = await deep()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ status: 'unavailable', api: 'unavailable' })
  })
  it('503 quando a API não responde (rede ou tempo esgotado), sem vazar o erro', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:3333')))
    const res = await deep()
    expect(res.status).toBe(503)
    expect(JSON.stringify(await res.json())).not.toContain('10.0.0.5')
  })
})
