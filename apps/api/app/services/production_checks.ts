export type ConfigLike = Record<string, string | boolean | number | undefined>

export type ConfigReport = { errors: string[]; warnings: string[] }

const text = (value: ConfigLike[string]) => (value === undefined ? '' : String(value))

/**
 * Confere a configuração para produção. `errors` impedem a subida (a aplicação rodaria insegura ou perderia dados);
 * `warnings` são avisos nos logs. Função pura: recebe as variáveis lidas do ambiente.
 */
export function evaluateProductionConfig(env: ConfigLike): ConfigReport {
  const errors: string[] = []
  const warnings: string[] = []

  if (text(env.APP_KEY).length < 32)
    errors.push('APP_KEY deve ter ao menos 32 caracteres (cifra sessões, cookies e segredos 2FA).')
  if (env.SESSION_DRIVER !== 'database') {
    errors.push(
      'SESSION_DRIVER deve ser "database" em produção (sessão em memória some a cada reinício; em cookie não é revogável).'
    )
  }
  if (env.LIMITER_STORE !== 'database') {
    errors.push(
      'LIMITER_STORE deve ser "database" em produção (limites de login e de endpoints públicos precisam ser compartilhados).'
    )
  }
  const revalidate = text(env.REVALIDATE_SECRET)
  if (revalidate && revalidate.length < 24)
    errors.push('REVALIDATE_SECRET, se definido, precisa de ao menos 24 caracteres.')
  if (!revalidate)
    warnings.push(
      'REVALIDATE_SECRET não definido: publicar só atualiza o site público em até 300 s.'
    )
  const webhookToken = text(env.THEMEMBERS_WEBHOOK_TOKEN)
  if (webhookToken && webhookToken.length < 24)
    errors.push('THEMEMBERS_WEBHOOK_TOKEN, se definido, precisa de ao menos 24 caracteres.')

  if (!text(env.TRUSTED_PROXIES)) {
    warnings.push(
      'TRUSTED_PROXIES vazio: atrás de proxy/Next em outro contêiner, todos os visitantes parecem ter o mesmo IP (limites de login e de endpoints públicos passam a valer para todos juntos).'
    )
  }
  if (env.REQUIRE_2FA_FOR_ADMINS !== true)
    warnings.push(
      'REQUIRE_2FA_FOR_ADMINS não está ligado: administradores podem entrar só com senha.'
    )
  if (env.PUBLIC_SHOW_DRAFTS === true)
    warnings.push('PUBLIC_SHOW_DRAFTS=true é ignorado em produção; remova a variável.')
  if (text(env.ADMIN_PASSWORD))
    warnings.push(
      'ADMIN_PASSWORD ainda está definida: use só no primeiro seed e remova do ambiente.'
    )
  if (text(env.ADMIN_EMAIL).endsWith('@academia.local'))
    warnings.push('ADMIN_EMAIL usa o domínio de desenvolvimento (@academia.local).')
  if (!text(env.CHECKOUT_ALLOWED_HOSTS))
    warnings.push('CHECKOUT_ALLOWED_HOSTS vazio: nenhum link de checkout será aceito.')

  return { errors, warnings }
}
