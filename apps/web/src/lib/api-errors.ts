export type ApiErrorBody = { message?: string; code?: string; errors?: Array<{ field: string; message: string }> }

/**
 * Texto de erro de uma chamada à API para o usuário. `specific` é a mensagem própria da tela para o `code` devolvido
 * (cada formulário tem as suas); sem ela, valem as mensagens padrão por status HTTP.
 */
export function describeApiError(status: number, body: ApiErrorBody | null, specific?: string | null): string {
  if (specific) return specific
  if (status === 0) return 'Sem conexão com o servidor. Verifique a internet e tente novamente.'
  if (status === 401) return 'Sua sessão expirou. Entre novamente (em outra aba) e tente de novo.'
  if (status === 403) return 'Você não tem permissão para esta ação. Recarregue a página.'
  if (status === 422 && body?.message) return body.message
  return 'Não foi possível concluir agora. Tente novamente.'
}
