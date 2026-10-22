/**
 * Limpeza de dados pessoais e segredos antes de qualquer envio à telemetria (LGPD).
 * Vale para mensagens de erro, pilhas, URLs e propriedades: nada sai do servidor sem passar por aqui.
 */

const RULES: [RegExp, string][] = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]'],
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, '[token]'],
  [/\bBearer\s+[\w.~+/=-]+/gi, 'Bearer [token]'],
  [/\b(password|senha|token|secret|authorization|cookie|signature|assinatura|apikey|api_key)(["']?\s*[=:]\s*["']?)(?:Bearer\s+)?[^\s"',;&]+/gi, '$1$2[redigido]'],
  [/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '[cnpj]'],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[cpf]'],
  [/\b(?:\d[ -]?){13,19}\b/g, '[num]'],
  [/(?<![\w.])(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, '[tel]'],
  [/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[ip]'],
  [/\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b/gi, '[ip]'],
  [/\b[A-Za-z0-9_-]{32,}\b/g, '[token]'],
]

const SENSITIVE_KEY = /pass|senha|token|secret|cookie|authoriz|cpf|cnpj|email|phone|telefone|^ip$|signature|assinatura|card|cartao/i

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function scrubText(text: string, max = 1000): string {
  let out = text
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement)
  return truncate(out, max)
}

/** Remove consulta e fragmento (podem carregar tokens, e-mails ou termos de busca) e limpa o caminho. */
export function scrubUrl(url: string): string {
  const path = url.split(/[?#]/, 1)[0] ?? ''
  return scrubText(path, 300)
}

export type Props = Record<string, string | number | boolean | null | undefined>

/** Propriedades de evento: no máximo 20, chaves curtas, valores limpos; chaves sensíveis nunca levam o valor. */
export function sanitizeProps(props: Props | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!props) return out
  let count = 0
  for (const [rawKey, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue
    if (count >= 20) break
    const key = truncate(rawKey, 64)
    out[key] = SENSITIVE_KEY.test(rawKey) ? '[redigido]' : scrubText(String(value), 512)
    count++
  }
  return out
}
