import { describe, expect, it, vi } from 'vitest'
import type { Telemetry } from '@academia/telemetry'
import { reportRequestError } from './report-request-error'

describe('reportRequestError', () => {
  it('envia a exceção com rota, tipo e digest, e nada da requisição além do método', () => {
    const trackException = vi.fn()
    const error = Object.assign(new Error('falhou'), { digest: 'abc123' })
    reportRequestError({ trackException } as unknown as Telemetry, error, { path: '/cursos/x?email=a@b.com', method: 'GET' }, { routePath: '/cursos/[slug]', routeType: 'render', routerKind: 'App Router', renderSource: 'react-server-components' })
    expect(trackException).toHaveBeenCalledWith({
      error,
      operationId: 'abc123',
      properties: { route: 'GET /cursos/[slug]', routeType: 'render', routerKind: 'App Router', renderSource: 'react-server-components', digest: 'abc123' },
    })
    expect(JSON.stringify(trackException.mock.calls)).not.toContain('a@b.com')
  })
})
