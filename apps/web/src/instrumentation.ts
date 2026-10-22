import type { Instrumentation } from 'next'

/** Erros de servidor (páginas, rotas e ações) vão para o Application Insights; só no runtime Node. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const [{ telemetry }, { reportRequestError }] = await Promise.all([import('@/lib/telemetry'), import('@/lib/report-request-error')])
  reportRequestError(telemetry, error as Error & { digest?: string }, request, context)
}
