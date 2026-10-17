/** Fetch do navegador para a API (via proxy /api) com proteção CSRF por cookie XSRF-TOKEN. */
function readXsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

async function ensureXsrfToken(): Promise<string | null> {
  let token = readXsrfToken()
  if (!token) {
    try {
      await fetch('/api/health', { credentials: 'same-origin' }) // a resposta define o cookie XSRF-TOKEN
    } catch {
      return null
    }
    token = readXsrfToken()
  }
  return token
}

export type ApiResult<T> = { ok: boolean; status: number; data: T | null }

/**
 * Qualquer verbo com CSRF. Nunca lança: falha de rede devolve `{ ok: false, status: 0 }` e respostas
 * sem corpo (204) ou não-JSON (erro de proxy) devolvem `data: null`; o chamador decide pelo status.
 */
export async function apiSend<T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const token = await ensureXsrfToken()
    const res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json', ...(token ? { 'x-xsrf-token': token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    let data: T | null = null
    try {
      data = text ? (JSON.parse(text) as T) : null
    } catch {
      data = null
    }
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: null }
  }
}

/** Envio de arquivo (multipart) com CSRF. Nunca lança; `data` traz o corpo JSON (sucesso ou erro da API). */
export async function apiUpload<T>(path: string, file: File): Promise<ApiResult<T>> {
  try {
    const token = await ensureXsrfToken()
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { accept: 'application/json', ...(token ? { 'x-xsrf-token': token } : {}) },
      body: form,
    })
    const text = await res.text()
    let data: T | null = null
    try {
      data = text ? (JSON.parse(text) as T) : null
    } catch {
      data = null
    }
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: null }
  }
}

/** GET autenticado (cookie de sessão) no navegador. Nunca lança. */
export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api${path}`, { credentials: 'same-origin', headers: { accept: 'application/json' }, cache: 'no-store' })
    const text = await res.text()
    let data: T | null = null
    try {
      data = text ? (JSON.parse(text) as T) : null
    } catch {
      data = null
    }
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: null }
  }
}

/** Compatibilidade: antigo POST sem corpo de erro tipado. */
export const apiPost = <T>(path: string, body?: unknown) => apiSend<T>('POST', path, body)
