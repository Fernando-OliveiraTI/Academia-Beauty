/**
 * Pagamentos recebidos do webhook de checkout da The Members, já tratados para o painel. O corpo bruto nunca sai da API
 * (só o resumo); nome e e-mail do comprador chegam mascarados.
 */

/** Status tratado de um pagamento/pedido. */
export const PAYMENT_STATUS_LABEL: Readonly<Record<string, string>> = {
  approved: 'Aprovado',
  failed: 'Recusado',
  refunded: 'Reembolsado',
  charged_back: 'Chargeback',
  pending_refund: 'Reembolso pendente',
  processing: 'Cartão em processamento',
  pending: 'Aguardando pagamento',
  completed: 'Pedido concluído',
  canceled: 'Pedido cancelado',
  expired: 'Pedido expirado',
  granted: 'Acesso liberado',
  revoked: 'Acesso revogado',
  abandoned: 'Carrinho abandonado',
};

/** Evento original da The Members. */
export const PAYMENT_EVENT_LABEL: Readonly<Record<string, string>> = {
  'transaction.approved': 'Pagamento aprovado',
  'transaction.failed': 'Pagamento recusado',
  'transaction.refunded': 'Pagamento reembolsado',
  'transaction.charged_back': 'Chargeback',
  'transaction.pending_refund': 'Reembolso pendente',
  'transaction.payment_cc_initiated': 'Pagamento com cartão iniciado',
  'transaction.pix_generated': 'Pix gerado',
  'transaction.boleto_generated': 'Boleto gerado',
  'order.completed': 'Pedido concluído',
  'order.canceled': 'Pedido cancelado',
  'order.expired': 'Pedido expirado',
  'release.access': 'Acesso liberado',
  'revoke.access': 'Acesso revogado',
  abandoned: 'Carrinho abandonado',
};

export const PAYMENT_METHOD_LABEL: Readonly<Record<string, string>> = {
  credit_card: 'Cartão de crédito',
  pix: 'Pix',
  boleto: 'Boleto',
};

/** Tom visual do status no painel: `ok`, `bad`, `warn` ou `neutral`. */
export type PaymentTone = 'ok' | 'bad' | 'warn' | 'neutral';
export const paymentTone = (status: string | null): PaymentTone => {
  if (status === 'approved' || status === 'completed' || status === 'granted') return 'ok';
  if (status === 'failed' || status === 'charged_back' || status === 'refunded' || status === 'revoked') return 'bad';
  if (status === 'pending' || status === 'processing' || status === 'pending_refund' || status === 'abandoned') return 'warn';
  return 'neutral';
};

export type PaymentEventItem = {
  id: number;
  /** ID da transação na The Members: junta as etapas (pendente, aprovado, reembolso…) de uma mesma compra. */
  transactionId: string | null;
  event: string;
  kind: string;
  status: string | null;
  paymentMethod: string | null;
  amountCents: number | null;
  currency: string | null;
  instalments: number | null;
  cardBrand: string | null;
  buyerName: string | null;
  buyerEmail: string | null;
  occurredAt: string;
  receivedAt: string;
};

/** Situação atual das transações do curso (o último evento de cada transação vale). */
export type PaymentsSummary = {
  transactions: number;
  approved: number;
  approvedCents: number;
  /** Compras: transações que chegaram a ser aprovadas, mesmo as reembolsadas depois (a compra não some). */
  purchased: number;
  purchasedCents: number;
  /** Valor das transações hoje reembolsadas (reembolso pendente, reembolsado ou chargeback). */
  refundedCents: number;
  refunded: number;
  failed: number;
  pending: number;
};

export type CoursePayments = {
  /** O segredo do webhook está configurado no servidor? Sem ele o receptor recusa tudo. */
  webhookConfigured: boolean;
  /** Caminho do receptor na API (o painel monta a URL pública com o domínio do site). */
  webhookPath: string;
  /** Há token secreto configurado para a URL (`<webhookPath>/<token>`)? O token nunca sai do servidor. */
  webhookTokenConfigured: boolean;
  /** ID do produto na The Members vinculado ao curso (vazio = sem vínculo, nenhum evento chega aqui). */
  externalCourseId: string;
  summary: PaymentsSummary;
  items: PaymentEventItem[];
  /** Eventos de transação de produtos sem curso vinculado (qualquer curso): ajuda a achar ID errado. */
  unmatchedTransactions: number;
};
