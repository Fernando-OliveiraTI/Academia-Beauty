/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring session package
  |----------------------------------------------------------
  */
  SESSION_DRIVER: Env.schema.enum(['cookie', 'database', 'memory'] as const),
  ADMIN_EMAIL: Env.schema.string.optional(),
  ADMIN_PASSWORD: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the limiter package
  |----------------------------------------------------------
  */
  LIMITER_STORE: Env.schema.enum(['database', 'memory'] as const),

  /*
  |----------------------------------------------------------
  | Invalidação de cache do site (Next). Sem os dois, é ignorada.
  |----------------------------------------------------------
  */
  REVALIDATE_URL: Env.schema.string.optional(),
  REVALIDATE_SECRET: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Modo A do checkout: domínios (separados por vírgula) para onde o navegador pode ser
  | redirecionado. Vazio = nenhum link de checkout é aceito.
  |----------------------------------------------------------
  */
  CHECKOUT_ALLOWED_HOSTS: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Só fora de produção: `true` faz a leitura pública (site) servir também profissionais e cursos em
  | rascunho, mesmo sem checkout, para testar as páginas. Em produção é ignorada: só publicados.
  |----------------------------------------------------------
  */
  /** Token da API da The Members (somente leitura no servidor; nunca vai ao navegador). */
  TOKEN_THE_MEMBERS: Env.schema.string.optional(),
  /** Segredo do webhook de checkout da The Members (HMAC-SHA256 em `X-Signature`). Sem ele o receptor responde 503. */
  THEMEMBERS_WEBHOOK_SECRET: Env.schema.string.optional(),
  /** URL pública cadastrada no webhook (algumas variantes da assinatura incluem a URL na string assinada). */
  THEMEMBERS_WEBHOOK_URL: Env.schema.string.optional(),
  /**
   * Token secreto na própria URL do webhook (`/webhooks/themembers/<token>`), para quando a The Members não assina a chamada.
   * Mínimo de 24 caracteres. Vale como alternativa à assinatura: qualquer uma das duas autentica.
   */
  THEMEMBERS_WEBHOOK_TOKEN: Env.schema.string.optional(),
  /** Guarda o corpo bruto de cada chamada do webhook (com dados pessoais) para depuração. `false` desliga. Padrão: ligado. */
  THEMEMBERS_LOG_RAW: Env.schema.boolean.optional(),
  /** Registro das visitas ao checkout (código ab_…, navegador, origem, cidade aproximada). `false` desliga. Padrão: ligado. */
  CHECKOUT_SESSIONS_ENABLED: Env.schema.boolean.optional(),
  /** Como o IP é guardado: `full` (padrão), `truncated` (IPv4 /24, IPv6 /48) ou `none`. IP é dado pessoal (LGPD). */
  CHECKOUT_SESSIONS_IP_MODE: Env.schema.enum.optional(['full', 'truncated', 'none'] as const),
  /** Dias de retenção das visitas (1 a 730; padrão 180). */
  CHECKOUT_SESSIONS_RETENTION_DAYS: Env.schema.number.optional(),
  /** Dias de retenção do registro bruto (1 a 365; padrão 30). */
  THEMEMBERS_LOG_RETENTION_DAYS: Env.schema.number.optional(),
  PUBLIC_SHOW_DRAFTS: Env.schema.boolean.optional(),

  /*
  |----------------------------------------------------------
  | Proxies confiáveis (lista de IPs/CIDR separados por vírgula, ou `loopback`) cujo
  | X-Forwarded-For é usado como IP do cliente (limite de login, auditoria). Em produção atrás
  | de proxy/ingress, informe-os; sem isto vale o padrão do Adonis (somente loopback).
  |----------------------------------------------------------
  */
  TRUSTED_PROXIES: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Mídia (Fase 7A). MEDIA_STORAGE_PATH: pasta dos arquivos enviados (padrão: storage/media na API).
  | MEDIA_CDN_HOST: host(s) https (vírgula) aceitos como URL de mídia externa; o site libera o mesmo
  | host no CSP. Vazio = só mídia do próprio site (/site e /media).
  |----------------------------------------------------------
  */
  MEDIA_STORAGE_PATH: Env.schema.string.optional(),
  MEDIA_CDN_HOST: Env.schema.string.optional(),
})
