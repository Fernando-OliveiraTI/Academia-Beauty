export type Connection = { instrumentationKey: string; trackUrl: string }

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Domínios oficiais de ingestão do Application Insights; qualquer outro destino é recusado. */
const ALLOWED_HOST_SUFFIXES = ['.applicationinsights.azure.com', '.applicationinsights.azure.cn', '.applicationinsights.us', '.visualstudio.com']
const DEFAULT_ENDPOINT = 'https://dc.services.visualstudio.com'

/**
 * Lê a connection string (`InstrumentationKey=...;IngestionEndpoint=https://...`). Retorna null se estiver
 * ausente ou inválida: a telemetria fica desligada em vez de enviar para um destino inesperado.
 */
export function parseConnectionString(raw: string | undefined): Connection | null {
  const value = raw?.trim()
  if (!value) return null
  const parts = new Map<string, string>()
  for (const piece of value.split(';')) {
    const at = piece.indexOf('=')
    if (at > 0) parts.set(piece.slice(0, at).trim().toLowerCase(), piece.slice(at + 1).trim())
  }
  const key = parts.get('instrumentationkey')
  if (!key || !GUID.test(key)) return null
  let endpoint: URL
  try {
    endpoint = new URL(parts.get('ingestionendpoint') || DEFAULT_ENDPOINT)
  } catch {
    return null
  }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) return null
  const host = endpoint.hostname.toLowerCase()
  if (!ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return null
  return { instrumentationKey: key.toLowerCase(), trackUrl: `${endpoint.origin}/v2/track` }
}
