// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { HEARTBEAT_MS, PageTracker } from './page-tracker'

type Sent = { kind: string; durationMs?: number; referrer?: string }
let sent: Sent[] = []
const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  sent = []
  vi.useFakeTimers()
  // O relógio falso avança o Date; o tracker mede com performance.now().
  vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
  setVisibility('visible')
  // Captura síncrona do corpo enviado (o Blob do jsdom não é lido com o relógio falso).
  vi.stubGlobal('Blob', class { parts: string[]; constructor(parts: string[]) { this.parts = parts } })
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: (_url: string, blob: { parts: string[] }) => { sent.push(JSON.parse(blob.parts[0]!)); return true },
  })
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('PageTracker · tempo na página', () => {
  it('envia o tempo visível a cada 15 s e ao ocultar a aba; com a aba oculta não conta', async () => {
    const { unmount } = render(<PageTracker type="course" slug="morena" />)
    vi.advanceTimersByTime(HEARTBEAT_MS)
    setVisibility('hidden') // fecha o trecho (sem tempo novo desde o último envio)
    vi.advanceTimersByTime(60_000) // oculta: nada conta
    setVisibility('visible')
    vi.advanceTimersByTime(5_000)
    unmount() // sair fecha o último trecho
    expect(sent.filter((s) => s.kind === 'time')).toHaveLength(2)
    const times = sent.filter((s) => s.kind === 'time').map((s) => s.durationMs)
    expect(times[0]).toBeGreaterThanOrEqual(HEARTBEAT_MS - 50)
    expect(times[1]).toBeGreaterThanOrEqual(4_950)
    expect(times[1]).toBeLessThan(6_000)
    expect(sent[0]?.kind).toBe('view')
  })
})
