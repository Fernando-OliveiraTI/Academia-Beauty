import type { PageDocument } from '@academia/page-schema';
import { SCHEMA_VERSION } from '../schemas-version';
import type * as S from './schemas';
import { checkoutSchema } from './schemas';

export const COURSE_TEMPLATE_KEY = 'course-original';

/** Imagem de capa local: a cópia remota da Shopify do original não é usada (D-004, item 6). */
const COVER = '/site/curso/produto-morena-iluminada.svg';
const LOGO = '/site/curso/logo.svg';

const section = <C,>(id: string, type: string, content: C) => ({
  id, type, schemaVersion: SCHEMA_VERSION, visibility: { enabled: true }, settings: {}, content: content as Record<string, unknown>,
});

const header: S.HeaderContent = {
  brandLead: 'ACADEMIA', brandAccent: 'BEAUTY', brandLabel: 'Academia Beauty, voltar ao início', logoSrc: LOGO,
  navLabel: 'Seções da página',
  nav: [
    { label: 'O curso', href: '#beneficios' }, { label: 'Conteúdo', href: '#conteudo' },
    { label: 'Instrutor', href: '#instrutor' }, { label: 'Dúvidas', href: '#faq' },
  ],
  ctaLabel: 'Garantir acesso',
};

const hero: S.HeroContent = {
  eyebrow: 'Curso online · Corte & cor',
  titleLead: 'Morena', titleAccent: 'Iluminada.',
  lead: 'A metodologia de corte de Lukas Campos para valorizar o efeito da morena iluminada: mais movimento, leveza e brilho na coloração que você já entrega.',
  byInitials: 'LC', byPrefix: 'com', byName: 'Lukas Campos', bySuffix: '· 15 anos de carreira, equipe ROM CONCEPT',
  ctaLabel: 'Quero garantir meu acesso',
  secondary: { label: 'Ver o conteúdo', href: '#conteudo' },
  trust: [
    { icon: 'bolt', label: 'Acesso imediato' }, { icon: 'shield', label: 'Garantia de 7 dias' }, { icon: 'lock', label: 'Pagamento seguro' },
  ],
  image: { src: COVER, alt: 'Capa do curso Morena Iluminada: cabelo castanho com mechas iluminadas em tons de caramelo e dourado' },
  frameKicker: 'Academia Beauty', frameTitle: 'Morena Iluminada', frameBadge: 'Lukas Campos',
  huds: [{ kicker: 'Carreira', accent: '15', value: 'anos' }, { kicker: 'Comunidade', value: '53,6 mil' }],
  toneScale: {
    ariaLabel: 'Escala de tons de castanho a loiro trabalhada na morena iluminada',
    steps: ['4', '5', '6', '7', '8', '9'], from: 'Base castanha', to: 'Reflexo iluminado',
  },
};

const facts: S.FactsContent = {
  ariaLabel: 'Informações principais do curso',
  items: [
    { label: 'Formato', value: 'Online' }, { label: 'Método', value: 'Teoria + prática' },
    { label: 'Para', value: 'Cabeleireiros e coloristas' }, { label: 'Acesso', value: 'Imediato, na área de membros' },
  ],
};

const benefits: S.BenefitsContent = {
  eyebrow: 'Por que este curso',
  title: 'A cor fica linda. O corte precisa acompanhar.',
  quoteBefore: 'Uma morena iluminada só aparece de verdade quando o corte',
  quoteEmphasis: 'abre espaço para a luz',
  quoteAfter: ': movimento nas pontas, camadas no lugar certo e contraste que se revela a cada passo da cliente.',
  cards: [
    { icon: 'sun', title: 'Mais brilho na cor', text: 'Técnicas de corte que potencializam o brilho e a naturalidade da coloração.' },
    { icon: 'face', title: 'Corte sob medida', text: 'Como adaptar o corte ao formato do rosto e ao estilo de cada cliente.' },
    { icon: 'scissors', title: 'Contraste que aparece', text: 'Estratégias para destacar o contraste e a luminosidade dos cabelos.' },
    { icon: 'gem', title: 'Acabamento premium', text: 'Dicas profissionais para resultados modernos, elegantes e personalizados.' },
  ],
};

const curriculum: S.CurriculumContent = {
  eyebrow: 'Conteúdo programático',
  title: 'Uma imersão na arte de unir corte e cor.',
  lead: 'Teoria e prática em quatro frentes, na ordem em que você aplica no salão: entender a cor, desenhar o corte, revelar a luz e finalizar.',
  ctaLabel: 'Quero aprender',
  modules: [
    {
      title: 'Corte que potencializa a coloração',
      text: 'Técnicas de corte que realçam o brilho e a naturalidade da cor, pensadas para quem já trabalha com mechas e iluminação.',
      bullets: ['Leitura da coloração antes de cortar', 'Onde tirar peso para a luz aparecer', 'Movimento e leveza nos fios'],
    },
    {
      title: 'Adaptação ao rosto e ao estilo',
      text: 'Como ajustar o corte ao formato do rosto e ao estilo de cada cliente, para que o resultado pareça feito para ela.',
      bullets: ['Diagnóstico de formato de rosto', 'Personalização por estilo e rotina', 'Conversa com a cliente antes do corte'],
    },
    {
      title: 'Contraste e luminosidade',
      text: 'Estratégias para destacar o contraste entre a base castanha e os pontos de luz, criando profundidade e sofisticação.',
      bullets: ['Posicionamento das camadas em relação às mechas', 'Profundidade entre base e reflexo', 'Efeito de luz em movimento'],
    },
    {
      title: 'Finalização e dicas profissionais',
      text: 'Dicas práticas de Lukas para entregar resultados modernos, elegantes e personalizados, e transformar a experiência da cliente.',
      bullets: ['Acabamento que valoriza a cor', 'Como apresentar o resultado', 'Diferenciação no mercado'],
    },
  ],
};

const deliverables: S.DeliverablesContent = {
  eyebrow: 'O que você recebe',
  title: 'Tudo o que precisa para aplicar já no próximo atendimento.',
  items: [
    { title: 'Aulas com a metodologia de Lukas Campos', text: 'O método de corte que ele usa para valorizar a morena iluminada.' },
    { title: 'Demonstrações práticas', text: 'Teoria combinada com execução, para você ver cada decisão acontecer.' },
    { title: 'Guia de adaptação ao rosto', text: 'Como ajustar o corte ao formato do rosto e ao estilo da cliente.' },
    { title: 'Dicas de acabamento', text: 'Detalhes que diferenciam um resultado comum de um resultado premium.' },
    { title: 'Acesso pela área de membros', text: 'Entre com a sua conta Academia Beauty assim que o pagamento for aprovado.' },
  ],
  specsTitle: 'Ficha do curso',
  specs: [
    { label: 'Curso', value: 'Morena Iluminada' }, { label: 'Instrutor', value: 'Lukas Campos' }, { label: 'Formato', value: 'Online' },
    { label: 'Abordagem', value: 'Teoria + prática' }, { label: 'Foco', value: 'Corte para morena iluminada' },
    { label: 'Nível', value: 'Profissional' }, { label: 'Garantia', value: '7 dias' },
  ],
};

const instructor: S.InstructorContent = {
  monogram: 'LC',
  handle: '@lucascam',
  eyebrow: 'Quem ensina',
  title: 'Lukas Campos, especialista em loiros e morenas iluminadas.',
  paragraphs: [
    "Lukas começou há 15 anos, inspirado pelos tios, em um renomado salão na zona sul. Ao lado de Romeu Felipe, elevou sua qualificação e em dois meses se tornou colorista, atendendo nomes como Tassia Naves, Fernanda Souza, Ticiane Pinheiro, Munik Nunes e modelos da Victoria's Secret.",
    'Hoje é um dos principais profissionais da equipe ROM CONCEPT e já ministrou cursos em todo o Brasil e no exterior.',
  ],
  placesLabel: 'Cidades e países onde Lukas já ensinou',
  places: ['Moscou', 'Berlim', 'Istambul', 'Londres', 'EUA', 'Portugal'],
};

const proof: S.ProofContent = {
  eyebrow: 'Prova social',
  title: 'Uma referência que o mercado já acompanha.',
  stats: [
    { value: 15, label: 'anos de carreira' },
    { value: 53.6, suffix: ' mil', label: 'seguidores no Instagram' },
    { value: 6, prefix: '+', label: 'países com cursos' },
  ],
  testimonials: [
    { quote: 'Eu fazia a iluminação certinha e o corte apagava tudo. Depois do curso, as clientes voltam falando do brilho.', name: 'Aluna', role: 'Colorista' },
    { quote: 'A parte de adaptar ao formato do rosto mudou minha consulta. Agora eu explico o porquê de cada camada.', name: 'Aluna', role: 'Cabeleireira' },
    { quote: 'Direto ao ponto, com prática de verdade. Consegui aplicar no salão na mesma semana.', name: 'Aluno', role: 'Hair stylist' },
  ],
  sampleNote: 'Depoimentos de exemplo · substituir pelos reais',
};

const offer: S.OfferContent = {
  eyebrow: 'Oferta',
  title: 'Garanta o curso com 30% de desconto.',
  lead: 'Pagamento único, acesso imediato e 7 dias para testar. Se não for para você, devolvemos o valor.',
  cardTitle: 'Morena Iluminada',
  perks: ['Metodologia completa de corte', 'Cartão, PIX ou boleto', 'Garantia incondicional de 7 dias'],
  ctaLabel: 'Comprar agora',
};

const faq: S.FaqContent = {
  eyebrow: 'Dúvidas frequentes',
  title: 'Antes de você comprar.',
  lead: 'Não encontrou sua dúvida? Fale com a equipe pelo WhatsApp da Academia Beauty.',
  items: [
    { title: 'Como recebo o acesso?', text: 'Assim que o pagamento é aprovado, você recebe um e-mail de confirmação e o curso fica disponível na sua conta Academia Beauty, em “Acessar conta”. No cartão e no PIX a liberação é imediata; no boleto, após a compensação (até 3 dias úteis).' },
    { title: 'Para quem é o curso?', text: 'Para cabeleireiros e coloristas que querem se diferenciar e unir corte e cor para entregar resultados mais modernos e personalizados às clientes.' },
    { title: 'Quais são as formas de pagamento?', text: 'Cartão de crédito em até 6x sem juros, PIX com aprovação na hora ou boleto bancário. Tudo nesta mesma página, sem redirecionamento.' },
    { title: 'E se eu não gostar?', text: 'Você tem 7 dias de garantia. Se o curso não atender às suas expectativas, basta pedir o reembolso nesse prazo e devolvemos 100% do valor.' },
    { title: 'Meus dados de pagamento estão seguros?', text: 'Sim. A conexão é criptografada e os dados do cartão são processados diretamente pelo gateway de pagamento. A Academia Beauty não armazena o número do seu cartão.' },
  ],
};

const checkout: S.CheckoutContent = checkoutSchema.parse({
  eyebrow: 'Checkout seguro',
  title: 'Finalize em menos de um minuto.',
  productName: 'Morena Iluminada',
  productCaption: 'Curso online · Lukas Campos',
  productImage: { src: COVER },
  notice: 'Ambiente de demonstração: nenhum pagamento real é processado. Use o cartão 4111 1111 1111 1111 para simular uma aprovação.',
  seals: [
    { icon: 'lock', label: 'Conexão segura' }, { icon: 'shield', label: '7 dias de garantia' }, { icon: 'bolt', label: 'Acesso imediato' },
  ],
  paymentNote: 'Pagamento criptografado · Garantia de 7 dias',
});

const guarantee: S.GuaranteeContent = {
  sealValue: '7', sealUnit: 'dias',
  ringText: 'GARANTIA INCONDICIONAL · SATISFAÇÃO OU REEMBOLSO · ',
  eyebrow: 'Garantia e segurança',
  title: 'Compre sem risco.',
  lead: 'Você tem 7 dias para assistir, aplicar e decidir. Se não fizer sentido para a sua carreira, devolvemos 100% do valor, sem burocracia.',
  items: [
    { icon: 'lock', label: 'Conexão criptografada (SSL)' }, { icon: 'shield', label: 'Dados do cartão não ficam salvos' },
    { icon: 'bolt', label: 'Liberação automática do acesso' }, { icon: 'check', label: 'Reembolso integral em 7 dias' },
  ],
};

const finalCta: S.FinalCtaContent = {
  eyebrow: 'Última chamada',
  titleLead: 'Sua cor merece um corte à altura.', titleAccent: 'Comece hoje.',
  leadBefore: 'Morena Iluminada com Lukas Campos por', leadAfter: ', com 7 dias de garantia.',
  ctaLabel: 'Quero começar agora',
};

const footer: S.FooterContent = {
  brandLead: 'ACADEMIA', brandAccent: 'BEAUTY', logoSrc: LOGO,
  copyright: 'Todos os direitos reservados © {year} Academia Beauty',
  socialLabel: 'Redes sociais',
  links: [
    { label: 'Instagram', href: 'https://www.instagram.com/lucascam/', external: true },
    { label: 'Facebook', href: '#' }, { label: 'YouTube', href: '#' }, { label: 'TikTok', href: '#' }, { label: 'WhatsApp', href: '#' },
  ],
};

/** Template "Curso Original" v1: o conteúdo e a ordem da página aprovada. */
export const courseOriginalTemplate: PageDocument = {
  schemaVersion: 1,
  template: { key: COURSE_TEMPLATE_KEY, version: 1 },
  sections: [
    section('header', 'course.header', header),
    section('hero', 'course.hero', hero),
    section('facts', 'course.facts', facts),
    section('benefits', 'course.benefits', benefits),
    section('curriculum', 'course.curriculum', curriculum),
    section('deliverables', 'course.deliverables', deliverables),
    section('instructor', 'course.instructor', instructor),
    section('proof', 'course.proof', proof),
    section('offer', 'course.offer', offer),
    section('faq', 'course.faq', faq),
    section('checkout', 'course.checkout', checkout),
    section('guarantee', 'course.guarantee', guarantee),
    section('final-cta', 'course.final-cta', finalCta),
    section('footer', 'course.footer', footer),
    section('sticky-cta', 'course.sticky-cta', { ctaLabel: 'Quero comprar' }),
  ],
};
