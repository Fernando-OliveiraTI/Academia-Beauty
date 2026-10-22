import 'server-only'
import { createTelemetry } from '@academia/telemetry'

/**
 * Telemetria do site (Azure Application Insights). Só no servidor Node; desligada sem
 * `APPLICATIONINSIGHTS_CONNECTION_STRING`. Erros de renderização chegam por `instrumentation.ts`.
 */
export const telemetry = createTelemetry({
  connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
  role: 'academia-web',
  version: process.env.APP_VERSION,
  onError: (message) => console.warn(message),
})
