/** Erro de regra de negócio com status HTTP e código estável para o cliente. */
export class DomainError extends Error {
  constructor(
    public readonly status: 404 | 409 | 422 | 502 | 503,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
  }
}

/** Violação de índice único do MySQL (corrida em slug etc.) vira 409 em vez de 500. */
export function toDomainError(error: unknown): unknown {
  const e = error as { code?: string; sqlMessage?: string } | null
  if (e && e.code === 'ER_DUP_ENTRY') {
    return new DomainError(409, 'slug_taken', 'Este slug já está em uso')
  }
  return error
}
