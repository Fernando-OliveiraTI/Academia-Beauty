import { z } from 'zod';
import { plainTextSchema as text, safeMediaSchema, safeUrlSchema } from '@academia/page-schema';

export const ICON_NAMES = [
  'check', 'shield', 'lock', 'bolt', 'card', 'pix', 'barcode', 'star', 'arrow',
  'scissors', 'face', 'sun', 'gem', 'info', 'alert', 'chev', 'user',
] as const;
export const iconSchema = z.enum(ICON_NAMES);
export type IconName = z.infer<typeof iconSchema>;

const link = z.object({ label: text(60), href: safeUrlSchema });
const image = z.object({ src: safeMediaSchema, alt: text(300) });

export const headerSchema = z.object({
  brandLead: text(30),
  brandAccent: text(30),
  brandLabel: text(120),
  logoSrc: safeMediaSchema,
  navLabel: text(60),
  nav: z.array(link).min(1).max(8),
  ctaLabel: text(40),
  /** Menu principal do site (sempre no topo); ausente = Início, Profissionais, Cursos. O `nav` acima vira o menu lateral desta página. */
  siteLinks: z.array(link).max(5).optional(),
  /** Botão da conta no menu principal; ausente = "ACESSAR CONTA" → /admin/login. */
  account: link.optional(),
  /** Oculta o item "Mais cursos" (menu lateral) que leva aos outros cursos do profissional. */
  hideBackLink: z.boolean().optional(),
});

export const heroSchema = z.object({
  eyebrow: text(80),
  titleLead: text(40),
  titleAccent: text(40),
  lead: text(400),
  byInitials: text(4),
  byPrefix: text(20),
  byName: text(60),
  bySuffix: text(120),
  ctaLabel: text(60),
  secondary: link,
  trust: z.array(z.object({ icon: iconSchema, label: text(60) })).max(5),
  image,
  frameKicker: text(40),
  frameTitle: text(60),
  frameBadge: text(40),
  huds: z.array(z.object({ kicker: text(30), accent: text(12).optional(), value: text(30) })).max(2),
  toneScale: z.object({
    ariaLabel: text(200),
    steps: z.array(text(3)).length(6),
    from: text(40),
    to: text(40),
  }).optional(),
});

export const factsSchema = z.object({
  ariaLabel: text(120),
  items: z.array(z.object({ label: text(30), value: text(80) })).min(1).max(4),
});

export const benefitsSchema = z.object({
  eyebrow: text(60),
  title: text(160),
  /** Citação opcional (o template aprovado a traz; cursos criados no painel não). */
  quoteBefore: text(300).optional(),
  quoteEmphasis: text(120).optional(),
  quoteAfter: text(300).optional(),
  cards: z.array(z.object({ icon: iconSchema, title: text(60), text: text(200) })).min(1).max(4),
});

const accordionItem = z.object({ title: text(120), text: text(600), bullets: z.array(text(120)).max(6).optional() });

export const curriculumSchema = z.object({
  eyebrow: text(60),
  title: text(160),
  lead: text(400),
  ctaLabel: text(40),
  modules: z.array(accordionItem).min(1).max(12),
});

export const deliverablesSchema = z.object({
  eyebrow: text(60),
  title: text(160),
  items: z.array(z.object({ title: text(100), text: text(200) })).min(1).max(8),
  specsTitle: text(60),
  specs: z.array(z.object({ label: text(40), value: text(80) })).max(10),
});

export const instructorSchema = z.object({
  monogram: text(4),
  /** Retrato opcional: sem ele aparece só o monograma. */
  photo: image.optional(),
  handle: text(40),
  eyebrow: text(60),
  title: text(160),
  paragraphs: z.array(text(1200)).min(1).max(6),
  placesLabel: text(120),
  places: z.array(text(30)).max(12),
});

export const proofSchema = z.object({
  eyebrow: text(60),
  title: text(160),
  stats: z.array(z.object({
    value: z.number().nonnegative(),
    prefix: text(4).optional(),
    suffix: text(12).optional(),
    label: text(60),
  })).max(4),
  testimonials: z.array(z.object({ quote: text(300), name: text(60), role: text(60) })).max(6),
  /** Aviso de depoimentos de exemplo: remover quando houver depoimentos reais. */
  sampleNote: text(120).optional(),
});

export const offerSchema = z.object({
  eyebrow: text(60),
  title: text(160),
  lead: text(300),
  cardTitle: text(80),
  perks: z.array(text(100)).max(6),
  ctaLabel: text(40),
});

export const faqSchema = z.object({
  eyebrow: text(60),
  title: text(160),
  lead: text(300),
  items: z.array(z.object({ title: text(160), text: text(800) })).min(1).max(20),
});

/** Tipos de campo do comprador: cada um traz máscara e validação próprias (nunca regex ou HTML livres). */
export const BUYER_FIELD_TYPES = ['name', 'text', 'email', 'cpf', 'phone'] as const;

const buyerFieldSchema = z.object({
  type: z.enum(BUYER_FIELD_TYPES),
  label: text(60),
  placeholder: text(80).default(''),
  help: text(60).default(''),
  required: z.boolean().default(true),
});

const paymentMethodSchema = z.object({ title: text(30), sub: text(40), info: text(240) });

/** Textos padrão do checkout. Valem para documentos salvos antes de existirem os campos novos (sem migração de versão). */
export const CHECKOUT_DEFAULTS = {
  stepData: 'Seus dados', stepPayment: 'Pagamento', stepConfirmation: 'Confirmação',
  summaryTitle: 'Seu pedido', summaryProduct: 'Produto', summaryDiscount: 'Desconto', summaryTotal: 'Total',
  dataTitle: 'Seus dados', dataLead: 'O acesso ao curso será enviado para este e-mail.',
  buyerFields: [
    { type: 'name', label: 'Nome completo', placeholder: 'Como está no seu documento', help: '', required: true },
    { type: 'email', label: 'E-mail', placeholder: 'voce@email.com', help: '', required: true },
    { type: 'cpf', label: 'CPF', placeholder: '000.000.000-00', help: 'para a nota fiscal', required: true },
    { type: 'phone', label: 'Celular com DDD', placeholder: '(11) 90000-0000', help: '', required: true },
  ] as Array<z.output<typeof buyerFieldSchema>>,
  dataButton: 'Continuar para o pagamento', dataNote: 'Seus dados estão protegidos',
  paymentTitle: 'Forma de pagamento', paymentLead: 'Escolha como prefere pagar.',
  methods: [
    { title: 'Cartão', sub: 'parcelado sem juros', info: 'Você escolhe as parcelas no ambiente seguro de pagamento.' },
    { title: 'PIX', sub: 'aprovação na hora', info: 'Ao finalizar, você gera um QR Code PIX. O acesso é liberado assim que o pagamento é confirmado.' },
    { title: 'Boleto', sub: 'até 3 dias úteis', info: 'O boleto vence em 3 dias úteis. A liberação acontece após a compensação bancária.' },
  ],
  paymentButton: 'Revisar pedido', paymentNote: 'Pagamento criptografado', paymentBack: 'Voltar e editar meus dados',
  confirmTitle: 'Tudo certo!', confirmLead: 'Você será levado ao ambiente seguro de pagamento para concluir a compra.',
  confirmButton: 'Ir para o pagamento seguro', confirmBack: 'Voltar',
  confirmUnavailable: 'A compra deste curso está temporariamente indisponível.',
  // Retorno do pagamento no checkout embutido (The Members): a página acompanha o webhook e mostra o resultado.
  paidTitle: 'Pagamento confirmado!', paidText: 'Enviamos os dados de acesso para o seu e-mail. Você já pode fechar esta página.',
  processingText: 'Processando o pagamento…',
  waitingPix: 'Aguardando o pagamento do Pix. A confirmação aparece aqui assim que ele for pago.',
  waitingBoleto: 'Aguardando a compensação do boleto. Avisaremos por e-mail quando for confirmado.',
  failedText: 'O pagamento não foi aprovado. Tente novamente com outro cartão ou outra forma de pagamento.',
  refundedText: 'Este pagamento foi reembolsado.',
} as const;
const D = CHECKOUT_DEFAULTS;

export const checkoutSchema = z.object({
  eyebrow: text(60),
  title: text(160),
  productName: text(80),
  productCaption: text(80),
  productImage: z.object({ src: safeMediaSchema }),
  notice: text(300),
  seals: z.array(z.object({ icon: iconSchema, label: text(40) })).length(3),
  stepData: text(30).default(D.stepData),
  stepPayment: text(30).default(D.stepPayment),
  stepConfirmation: text(30).default(D.stepConfirmation),
  summaryTitle: text(30).default(D.summaryTitle),
  summaryProduct: text(30).default(D.summaryProduct),
  summaryDiscount: text(30).default(D.summaryDiscount),
  summaryTotal: text(30).default(D.summaryTotal),
  dataTitle: text(60).default(D.dataTitle),
  dataLead: text(160).default(D.dataLead),
  buyerFields: z.array(buyerFieldSchema).min(1).max(8).default(D.buyerFields),
  dataButton: text(50).default(D.dataButton),
  dataNote: text(80).default(D.dataNote),
  paymentTitle: text(60).default(D.paymentTitle),
  paymentLead: text(160).default(D.paymentLead),
  methods: z.array(paymentMethodSchema).length(3).default(D.methods.map((m) => ({ ...m }))),
  paymentButton: text(50).default(D.paymentButton),
  paymentNote: text(100).default(D.paymentNote),
  paymentBack: text(60).default(D.paymentBack),
  confirmTitle: text(60).default(D.confirmTitle),
  confirmLead: text(240).default(D.confirmLead),
  confirmButton: text(60).default(D.confirmButton),
  confirmBack: text(40).default(D.confirmBack),
  confirmUnavailable: text(160).default(D.confirmUnavailable),
  paidTitle: text(60).default(D.paidTitle),
  paidText: text(240).default(D.paidText),
  processingText: text(100).default(D.processingText),
  waitingPix: text(200).default(D.waitingPix),
  waitingBoleto: text(200).default(D.waitingBoleto),
  failedText: text(200).default(D.failedText),
  refundedText: text(160).default(D.refundedText),
});

export const guaranteeSchema = z.object({
  sealValue: text(4),
  sealUnit: text(12),
  ringText: text(80),
  eyebrow: text(60),
  title: text(100),
  lead: text(400),
  items: z.array(z.object({ icon: iconSchema, label: text(80) })).max(6),
});

export const finalCtaSchema = z.object({
  eyebrow: text(60),
  titleLead: text(120),
  titleAccent: text(60),
  leadBefore: text(120),
  leadAfter: text(120),
  ctaLabel: text(40),
});

export const footerSchema = z.object({
  brandLead: text(30),
  brandAccent: text(30),
  logoSrc: safeMediaSchema,
  copyright: text(120),
  socialLabel: text(60),
  links: z.array(z.object({ label: text(30), href: safeUrlSchema, external: z.boolean().optional() })).max(8),
});

export const stickyCtaSchema = z.object({ ctaLabel: text(40) });

export type HeaderContent = z.infer<typeof headerSchema>;
export type HeroContent = z.infer<typeof heroSchema>;
export type FactsContent = z.infer<typeof factsSchema>;
export type BenefitsContent = z.infer<typeof benefitsSchema>;
export type CurriculumContent = z.infer<typeof curriculumSchema>;
export type DeliverablesContent = z.infer<typeof deliverablesSchema>;
export type InstructorContent = z.infer<typeof instructorSchema>;
export type ProofContent = z.infer<typeof proofSchema>;
export type OfferContent = z.infer<typeof offerSchema>;
export type FaqContent = z.infer<typeof faqSchema>;
export type CheckoutContent = z.infer<typeof checkoutSchema>;
export type GuaranteeContent = z.infer<typeof guaranteeSchema>;
export type FinalCtaContent = z.infer<typeof finalCtaSchema>;
export type FooterContent = z.infer<typeof footerSchema>;
export type StickyCtaContent = z.infer<typeof stickyCtaSchema>;
