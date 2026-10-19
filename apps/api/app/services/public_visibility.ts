import env from '#start/env'

/**
 * Só fora de produção: a leitura pública também serve profissionais e cursos em rascunho (e cursos
 * sem checkout ativo), para testar as páginas sem publicar. Em produção a variável é ignorada.
 */
export const showDraftsPublicly = () =>
  env.get('NODE_ENV') !== 'production' && env.get('PUBLIC_SHOW_DRAFTS', false)

/** Situações visíveis na leitura pública. */
export const publicStatuses = () => (showDraftsPublicly() ? ['published', 'draft'] : ['published'])
