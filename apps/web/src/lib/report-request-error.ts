import type { Telemetry } from '@academia/telemetry'

type RequestInfo = { path: string; method: string }
type ErrorContext = { routePath: string; routeType: string; routerKind: string; renderSource?: string }

/**
 * Erro de servidor do Next (renderização, rota ou ação) → exceção na telemetria. Leva só o padrão da rota,
 * o tipo e o método: nada de cabeçalhos, cookies, consulta da URL nem corpo.
 */
export function reportRequestError(telemetry: Telemetry, error: Error & { digest?: string }, request: RequestInfo, context: ErrorContext) {
  telemetry.trackException({
    error,
    operationId: error.digest,
    properties: {
      route: `${request.method} ${context.routePath}`,
      routeType: context.routeType,
      routerKind: context.routerKind,
      renderSource: context.renderSource,
      digest: error.digest,
    },
  })
}
