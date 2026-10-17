import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { courseDataSchema, type CourseData } from '@academia/contracts'
import env from '#start/env'
import Course from '#models/course'
import Professional from '#models/professional'
import User from '#models/user'
import CourseService from '#services/course_service'

/**
 * Conteúdo do curso aprovado (Curso Original). Só entra o que está no material aprovado:
 * garantia, FAQ e depoimentos dependem de decisão do negócio e ficam de fora até lá.
 */
const morena: CourseData = courseDataSchema.parse({
  title: 'Morena Iluminada',
  lead: 'A metodologia de corte de Lukas Campos para valorizar o efeito da morena iluminada: mais movimento, leveza e brilho na coloração que você já entrega.',
  modality: 'online',
  level: 'profissional',
  audience: 'Cabeleireiros e coloristas',
  coverSrc: '/site/curso/produto-morena-iluminada.svg',
  coverAlt:
    'Capa do curso Morena Iluminada: cabelo castanho com mechas iluminadas em tons de caramelo e dourado',
  benefits: [
    {
      title: 'Mais brilho na cor',
      text: 'Técnicas de corte que potencializam o brilho e a naturalidade da coloração.',
    },
    {
      title: 'Corte sob medida',
      text: 'Como adaptar o corte ao formato do rosto e ao estilo de cada cliente.',
    },
    {
      title: 'Contraste que aparece',
      text: 'Estratégias para destacar o contraste e a luminosidade dos cabelos.',
    },
    {
      title: 'Acabamento premium',
      text: 'Dicas profissionais para resultados modernos, elegantes e personalizados.',
    },
  ],
  modules: [
    {
      title: 'Corte que potencializa a coloração',
      text: 'Técnicas de corte que realçam o brilho e a naturalidade da cor, pensadas para quem já trabalha com mechas e iluminação.',
      bullets: [
        'Leitura da coloração antes de cortar',
        'Onde tirar peso para a luz aparecer',
        'Movimento e leveza nos fios',
      ],
    },
    {
      title: 'Adaptação ao rosto e ao estilo',
      text: 'Como ajustar o corte ao formato do rosto e ao estilo de cada cliente, para que o resultado pareça feito para ela.',
      bullets: [
        'Diagnóstico de formato de rosto',
        'Personalização por estilo e rotina',
        'Conversa com a cliente antes do corte',
      ],
    },
    {
      title: 'Contraste e luminosidade',
      text: 'Estratégias para destacar o contraste entre a base castanha e os pontos de luz, criando profundidade e sofisticação.',
      bullets: [
        'Posicionamento das camadas em relação às mechas',
        'Profundidade entre base e reflexo',
        'Efeito de luz em movimento',
      ],
    },
    {
      title: 'Finalização e dicas profissionais',
      text: 'Dicas práticas de Lukas para entregar resultados modernos, elegantes e personalizados, e transformar a experiência da cliente.',
      bullets: [
        'Acabamento que valoriza a cor',
        'Como apresentar o resultado',
        'Diferenciação no mercado',
      ],
    },
  ],
  deliverables: [
    {
      title: 'Aulas com a metodologia de Lukas Campos',
      text: 'O método de corte que ele usa para valorizar a morena iluminada.',
    },
    {
      title: 'Demonstrações práticas',
      text: 'Teoria combinada com execução, para você ver cada decisão acontecer.',
    },
    {
      title: 'Guia de adaptação ao rosto',
      text: 'Como ajustar o corte ao formato do rosto e ao estilo da cliente.',
    },
    {
      title: 'Dicas de acabamento',
      text: 'Detalhes que diferenciam um resultado comum de um resultado premium.',
    },
    {
      title: 'Acesso pela área de membros',
      text: 'Entre com a sua conta Academia Beauty assim que o pagamento for aprovado.',
    },
  ],
})

/**
 * Somente desenvolvimento. O link de checkout é um endereço fictício dentro do domínio de
 * exemplo de `CHECKOUT_ALLOWED_HOSTS`; nenhum pagamento real existe. Idempotente.
 */
export default class extends BaseSeeder {
  static environment = ['development']

  async run() {
    if (env.get('NODE_ENV') !== 'development') return
    if (await Course.findBy('slug', 'morena-iluminada')) return
    const lukas = await Professional.findBy('slug', 'lukas-campos')
    if (!lukas) return
    const admin = await User.findBy('email', env.get('ADMIN_EMAIL')?.toLowerCase() ?? '')
    const actorId = admin?.id ?? 0

    const course = await CourseService.create(lukas.id, 'morena-iluminada', morena, actorId)
    await CourseService.saveCommercial(
      course.id,
      {
        listCents: 25000,
        discountPct: 30,
        maxInstallments: 6,
        checkoutUrl: 'https://pay.example.com/morena-iluminada',
        environment: 'sandbox',
        active: true,
        revision: 0,
      },
      actorId
    )
    await CourseService.publish(course.id, actorId)
  }
}
