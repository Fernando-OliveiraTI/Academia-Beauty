/** Política de senha do painel: tamanho, não ser óbvia e não conter o e-mail. Mensagens em pt-BR para o formulário. */
export const PASSWORD_MIN = 12
export const PASSWORD_MAX = 128

const COMMON = new Set([
  'password1234',
  'senha1234567',
  '123456789012',
  'qwertyuiop12',
  'academia1234',
  'academiabeauty',
  'administrador',
  'beauty123456',
])

export function passwordIssues(
  password: string,
  context: { email?: string; fullName?: string | null } = {}
) {
  const issues: string[] = []
  if (password.length < PASSWORD_MIN) issues.push(`Use ao menos ${PASSWORD_MIN} caracteres.`)
  if (password.length > PASSWORD_MAX) issues.push(`Use no máximo ${PASSWORD_MAX} caracteres.`)
  if (issues.length) return issues

  const lower = password.toLowerCase()
  if (new Set(lower).size < 5) issues.push('Use caracteres mais variados.')
  if (COMMON.has(lower)) issues.push('Esta senha é muito comum.')
  const local = context.email?.split('@')[0]?.toLowerCase()
  if (local && local.length >= 4 && lower.includes(local))
    issues.push('A senha não pode conter o seu e-mail.')
  const first = context.fullName?.trim().split(/\s+/)[0]?.toLowerCase()
  if (first && first.length >= 4 && lower.includes(first))
    issues.push('A senha não pode conter o seu nome.')
  if (
    /^(?:0123|1234|abcd|qwer)/.test(lower) &&
    /^[a-z0-9]+$/.test(lower) &&
    !/[A-Z]/.test(password) &&
    !/[^a-z0-9]/i.test(password)
  ) {
    issues.push('Evite sequências como 1234 ou qwerty.')
  }
  return issues
}

/** Senha provisória forte (sem caracteres ambíguos) para contas novas e redefinições feitas por um administrador. */
export function generateTemporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  const body = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
  return `${body.slice(0, 6)}-${body.slice(6, 12)}-${body.slice(12, 18)}`
}
