/** Rótulos do resultado de cada chamada do webhook (módulo simples: usado por componente de servidor e de cliente). */
export const RESULT_LABEL: Record<string, string> = {
  accepted: 'Aceita',
  duplicate: 'Repetida',
  invalid_signature: 'Assinatura inválida',
  invalid_payload: 'Evento não reconhecido',
  not_configured: 'Segredo não configurado',
  empty_body: 'Corpo vazio',
}
