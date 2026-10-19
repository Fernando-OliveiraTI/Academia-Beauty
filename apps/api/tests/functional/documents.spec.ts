/* eslint-disable @unicorn/no-await-expression-member -- encadear `(await req).body()` mantém os testes legíveis */
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { makeUser } from '#tests/helpers'
import { DomainError, toDomainError } from '#services/domain_error'

type Client = import('@japa/api-client').ApiClient
type User = Awaited<ReturnType<typeof makeUser>>

const professionalData = (name = 'Ana Souza') => ({
  name,
  specialty: 'Hair',
  tagline: 'Técnica e carreira.',
  experienceYears: 10,
  instagramHandle: '@ana',
  instagramFollowers: '10 mil',
  instagramUrl: 'https://instagram.com/ana',
  portraitSrc: '/site/profissional/lukas_perfil.png',
  cardPhotoSrc: '/site/home/lukas-campos.png',
  bio: ['Trajetória de dez anos.'],
  works: [],
})

const section = (id: string, type: string, content: object) => ({
  id,
  type,
  schemaVersion: 1,
  visibility: { enabled: true },
  settings: {},
  content,
})

const bio = (text = 'Texto do editor.') =>
  section('bio', 'professional.bio', {
    tickerUnit: 'ANA • ',
    sectionIndex: '01 / TRAJETÓRIA',
    titleLead: 'Uma carreira',
    titleStrong: 'técnica.',
    paragraphs: [text],
    instagram: { handle: '@ana', followers: '10 mil', href: 'https://instagram.com/ana' },
  })

const hero = () =>
  section('hero', 'professional.hero', {
    eyebrow: 'Profissional / Academia Beauty',
    nameFirst: 'Ana',
    nameAccent: 'Souza.',
    sub: 'Técnica e carreira.',
    meta: [],
    portrait: { src: '/site/profissional/lukas_perfil.png', alt: 'Ana Souza' },
    hud: { label: 'Expert / Hair', accent: '10', value: 'anos' },
  })

/** Documento válido: o hero é obrigatório; as demais seções variam por teste. */
const proDoc = (...sections: object[]) => ({
  schemaVersion: 1,
  template: { key: 'professional-original', version: 1 },
  sections: [hero(), ...(sections.length ? sections : [bio()])],
})

const courseSections = () => [
  section('hero', 'course.hero', {
    eyebrow: 'Curso online',
    titleLead: 'Morena',
    titleAccent: 'Iluminada.',
    lead: 'A metodologia de corte para valorizar a cor.',
    byInitials: 'AS',
    byPrefix: 'com',
    byName: 'Ana Souza',
    bySuffix: 'Hair',
    ctaLabel: 'Quero entrar',
    secondary: { label: 'Ver conteúdo', href: '#conteudo' },
    trust: [],
    image: { src: '/site/curso/produto-morena-iluminada.svg', alt: 'Capa' },
    frameKicker: 'Curso',
    frameTitle: 'Morena Iluminada',
    frameBadge: 'Online',
    huds: [],
  }),
  section('offer', 'course.offer', {
    eyebrow: 'Oferta',
    title: 'Entre agora',
    lead: 'Condição especial.',
    cardTitle: 'Acesso completo',
    perks: [],
    ctaLabel: 'Quero entrar',
  }),
]

const courseDoc = (...extra: object[]) => ({
  schemaVersion: 1,
  template: { key: 'course-original', version: 1 },
  sections: [...courseSections(), ...extra],
})

let seq = 0
const slug = () => `doc-${Date.now()}-${++seq}`

function api(client: Client, user: User) {
  const call = (method: 'post' | 'put' | 'delete', path: string, body?: object) => {
    const req = client[method](path).withCsrfToken().loginAs(user)
    return body ? req.json(body) : req
  }
  return {
    get: (path: string) => client.get(path).loginAs(user),
    post: (path: string, body?: object) => call('post', path, body),
    put: (path: string, body?: object) => call('put', path, body),
    del: (path: string, body?: object) => call('delete', path, body),
  }
}

async function newProfessional(a: ReturnType<typeof api>) {
  const created = await a.post('/admin/professionals', { slug: slug(), data: professionalData() })
  created.assertStatus(201)
  return { id: created.body().id as number, slug: created.body().slug as string }
}

test.group('Documento de página · profissionais', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('RBAC: sem sessão 401; viewer lê mas não escreve; CSRF obrigatório', async ({ client }) => {
    const viewer = await makeUser('viewer')
    const editor = await makeUser('editor')
    const p = await newProfessional(api(client, editor))
    ;(await client.get(`/admin/professionals/${p.id}/document`)).assertStatus(401)
    ;(await api(client, viewer).get(`/admin/professionals/${p.id}/document`)).assertStatus(200)
    ;(
      await api(client, viewer).put(`/admin/professionals/${p.id}/document`, {
        document: proDoc(),
        revision: 0,
      })
    ).assertStatus(403)
    ;(
      await client
        .put(`/admin/professionals/${p.id}/document`)
        .loginAs(editor)
        .json({ document: proDoc(), revision: 0 })
    ).assertStatus(403)
  })

  test('página nunca personalizada: document nulo e revisão 0', async ({ client, assert }) => {
    const a = api(client, await makeUser('editor'))
    const p = await newProfessional(a)
    const res = await a.get(`/admin/professionals/${p.id}/document`)
    res.assertStatus(200)
    assert.isNull(res.body().document)
    assert.equal(res.body().documentRevision, 0)
    assert.equal(res.body().templateKey, 'professional-original')
    assert.equal((await a.get(`/admin/professionals/${p.id}`)).body().documentRevision, 0)
  })

  test('salva, incrementa a revisão e devolve o documento', async ({ client, assert }) => {
    const a = api(client, await makeUser('editor'))
    const p = await newProfessional(a)
    const saved = await a.put(`/admin/professionals/${p.id}/document`, {
      document: proDoc(),
      revision: 0,
    })
    saved.assertStatus(200)
    assert.equal(saved.body().documentRevision, 1)
    const read = (await a.get(`/admin/professionals/${p.id}/document`)).body()
    assert.equal(read.documentRevision, 1)
    assert.equal(read.document.sections[1].content.paragraphs[0], 'Texto do editor.')
  })

  test('conflito de revisão: 409 e nada é gravado', async ({ client, assert }) => {
    const a = api(client, await makeUser('editor'))
    const p = await newProfessional(a)
    ;(
      await a.put(`/admin/professionals/${p.id}/document`, { document: proDoc(), revision: 0 })
    ).assertStatus(200)
    const stale = await a.put(`/admin/professionals/${p.id}/document`, {
      document: proDoc(bio('Outro texto')),
      revision: 0,
    })
    stale.assertStatus(409)
    assert.equal(stale.body().code, 'revision_conflict')
    const read = (await a.get(`/admin/professionals/${p.id}/document`)).body()
    assert.equal(read.document.sections[1].content.paragraphs[0], 'Texto do editor.')
  })

  test('recusa documento inválido (422): conteúdo, tipo, template, marcação, URL, id duplicado', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('editor'))
    const p = await newProfessional(a)
    const put = (document: unknown) =>
      a.put(`/admin/professionals/${p.id}/document`, { document, revision: 0 })

    const badContent = section('bio', 'professional.bio', { titleLead: 'x' })
    ;(await put(proDoc(badContent))).assertStatus(422)
    ;(await put(proDoc(section('x', 'professional.inexistente', {})))).assertStatus(422)
    ;(await put(proDoc(section('x', 'course.sticky-cta', { ctaLabel: 'a' })))).assertStatus(422)
    ;(await put({ ...proDoc(), template: { key: 'course-original', version: 1 } })).assertStatus(
      422
    )
    ;(await put({ ...proDoc(), template: { key: 'desconhecido', version: 1 } })).assertStatus(422)
    ;(await put(proDoc(bio('<script>alert(1)</script>')))).assertStatus(422)
    const js = bio()
    ;(js.content as { instagram: { href: string } }).instagram.href = 'javascript:alert(1)'
    ;(await put(proDoc(js))).assertStatus(422)
    ;(await put(proDoc(bio(), { ...hero(), id: 'hero-2' }))).assertStatus(422) // tipo único repetido
    ;(await put('texto')).assertStatus(422)
    const res = await put(proDoc(badContent))
    assert.equal(res.body().code, 'invalid_document')
    assert.isAbove(res.body().errors.length, 0)
    assert.equal((await a.get(`/admin/professionals/${p.id}/document`)).body().documentRevision, 0)
  })

  test('arquivado não aceita edição; inexistente é 404', async ({ client }) => {
    const a = api(client, await makeUser('editor'))
    const p = await newProfessional(a)
    ;(await a.post(`/admin/professionals/${p.id}/archive`)).assertStatus(200)
    ;(
      await a.put(`/admin/professionals/${p.id}/document`, { document: proDoc(), revision: 0 })
    ).assertStatus(422)
    ;(await a.get('/admin/professionals/999999/document')).assertStatus(404)
    ;(
      await a.put('/admin/professionals/999999/document', { document: proDoc(), revision: 0 })
    ).assertStatus(404)
  })

  test('restaurar do cadastro descarta o documento e conta como alteração', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('editor'))
    const p = await newProfessional(a)
    await a.put(`/admin/professionals/${p.id}/document`, { document: proDoc(), revision: 0 })
    ;(await a.del(`/admin/professionals/${p.id}/document`, { revision: 0 })).assertStatus(409)
    const reset = await a.del(`/admin/professionals/${p.id}/document`, { revision: 1 })
    reset.assertStatus(200)
    assert.equal(reset.body().documentRevision, 2)
    assert.isNull((await a.get(`/admin/professionals/${p.id}/document`)).body().document)
  })

  test('publicar grava o documento no snapshot; o público só vê o publicado; alterar depois marca pendência', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('editor'))
    const p = await newProfessional(a)
    ;(await a.get(`/public/professionals/${p.slug}`)).assertStatus(404)
    await a.put(`/admin/professionals/${p.id}/document`, { document: proDoc(), revision: 0 })
    const pub = await a.post(`/admin/professionals/${p.id}/publish`)
    pub.assertStatus(200)
    assert.isFalse(pub.body().hasUnpublishedChanges)

    const pubic = (await client.get(`/public/professionals/${p.slug}`)).body()
    assert.equal(pubic.document.sections[1].content.paragraphs[0], 'Texto do editor.')

    await a.put(`/admin/professionals/${p.id}/document`, {
      document: proDoc(bio('Rascunho novo')),
      revision: 1,
    })
    assert.isTrue((await a.get(`/admin/professionals/${p.id}`)).body().hasUnpublishedChanges)
    const still = (await client.get(`/public/professionals/${p.slug}`)).body()
    assert.equal(still.document.sections[1].content.paragraphs[0], 'Texto do editor.')

    const snap = await db.from('professional_versions').where('professional_id', p.id).first()
    assert.isNotNull(snap.document)
  })

  test('sem personalização o público recebe document nulo (comportamento anterior)', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('editor'))
    const p = await newProfessional(a)
    await a.post(`/admin/professionals/${p.id}/publish`)
    const pub = (await client.get(`/public/professionals/${p.slug}`)).body()
    assert.isNull(pub.document)
  })

  test('histórico de versões e restauração para o rascunho (versão publicada é imutável)', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('editor'))
    const p = await newProfessional(a)
    await a.put(`/admin/professionals/${p.id}/document`, { document: proDoc(), revision: 0 })
    await a.post(`/admin/professionals/${p.id}/publish`)
    await a.put(`/admin/professionals/${p.id}/document`, {
      document: proDoc(bio('v2')),
      revision: 1,
    })
    await a.post(`/admin/professionals/${p.id}/publish`)

    const list = (await a.get(`/admin/professionals/${p.id}/document/versions`)).body().items
    assert.deepEqual(
      list.map((v: { version: number }) => v.version),
      [2, 1]
    )
    assert.isTrue(list[0].current)
    assert.isTrue(list[1].hasDocument)

    const restored = await a.post(`/admin/professionals/${p.id}/document/versions/1/restore`, {
      revision: 2,
    })
    restored.assertStatus(200)
    assert.equal(restored.body().documentRevision, 3)
    const read = (await a.get(`/admin/professionals/${p.id}/document`)).body()
    assert.equal(read.document.sections[1].content.paragraphs[0], 'Texto do editor.')
    const detail = (await a.get(`/admin/professionals/${p.id}`)).body()
    assert.isTrue(detail.hasUnpublishedChanges)
    assert.equal(detail.revision, 2 + 0)

    ;(
      await a.post(`/admin/professionals/${p.id}/document/versions/99/restore`, { revision: 3 })
    ).assertStatus(404)
    ;(
      await a.post(`/admin/professionals/${p.id}/document/versions/1/restore`, { revision: 0 })
    ).assertStatus(409)
    // a versão 2 continua intacta no histórico
    const v2 = await db
      .from('professional_versions')
      .where('professional_id', p.id)
      .where('version', 2)
      .first()
    const doc = typeof v2.document === 'string' ? JSON.parse(v2.document) : v2.document
    assert.equal(doc.sections[1].content.paragraphs[0], 'v2')
  })

  test('auditoria registra salvar, restaurar do cadastro e restaurar versão sem gravar o conteúdo', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('editor'))
    const p = await newProfessional(a)
    await a.put(`/admin/professionals/${p.id}/document`, { document: proDoc(), revision: 0 })
    await a.del(`/admin/professionals/${p.id}/document`, { revision: 1 })
    const rows = await db
      .from('audit_logs')
      .where('resource_type', 'professional')
      .where('resource_id', String(p.id))
    const actions = rows.map((r) => r.action)
    assert.include(actions, 'professional.document.save')
    assert.include(actions, 'professional.document.reset')
    assert.notInclude(JSON.stringify(rows), 'Texto do editor.')
  })
})

test.group('Documento de página · cursos', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function newCourse(a: ReturnType<typeof api>) {
    const pro = await newProfessional(a)
    const created = await a.post('/admin/courses', {
      professionalId: pro.id,
      slug: slug(),
      data: {
        title: 'Morena Iluminada',
        lead: 'A metodologia de corte para valorizar a cor.',
        modality: 'online',
        level: 'profissional',
        workloadHours: 8,
        audience: 'Cabeleireiros e coloristas',
        coverSrc: '/site/curso/produto-morena-iluminada.svg',
        coverAlt: 'Capa do curso',
        benefits: [{ title: 'Mais brilho', text: 'Cortes que realçam a cor.' }],
        modules: [
          { title: 'Corte e cor', text: 'Leitura da coloração.', bullets: ['Diagnóstico'] },
        ],
        deliverables: [{ title: 'Aulas', text: 'Método completo.' }],
        faq: [],
        testimonials: [],
        guaranteeDays: null,
      },
    })
    created.assertStatus(201)
    return created.body().id as number
  }

  test('salva, lê, concorrência, template trocado e RBAC', async ({ client, assert }) => {
    const a = api(client, await makeUser('editor'))
    const viewer = api(client, await makeUser('viewer'))
    const id = await newCourse(a)
    ;(await client.get(`/admin/courses/${id}/document`)).assertStatus(401)
    ;(
      await viewer.put(`/admin/courses/${id}/document`, { document: courseDoc(), revision: 0 })
    ).assertStatus(403)
    ;(await viewer.get(`/admin/courses/${id}/document`)).assertStatus(200)

    ;(
      await a.put(`/admin/courses/${id}/document`, { document: proDoc(), revision: 0 })
    ).assertStatus(422)
    const saved = await a.put(`/admin/courses/${id}/document`, {
      document: courseDoc(),
      revision: 0,
    })
    saved.assertStatus(200)
    assert.equal(saved.body().documentRevision, 1)
    ;(
      await a.put(`/admin/courses/${id}/document`, { document: courseDoc(), revision: 0 })
    ).assertStatus(409)
    assert.equal((await a.get(`/admin/courses/${id}`)).body().documentRevision, 1)
    ;(await a.del(`/admin/courses/${id}/document`, { revision: 1 })).assertStatus(200)
  })
})

test.group('Documento de página · regras impostas pelo servidor', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('recusa documento sem a seção obrigatória, vazio, com tipo repetido, settings livres e mídia externa', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('editor'))
    const p = await newProfessional(a)
    const put = (document: unknown) =>
      a.put(`/admin/professionals/${p.id}/document`, { document, revision: 0 })

    const noHero = { ...proDoc(), sections: [bio()] }
    const res = await put(noHero)
    res.assertStatus(422)
    assert.include(JSON.stringify(res.body()), 'obrigatória')
    ;(await put({ ...proDoc(), sections: [] })).assertStatus(422)
    ;(await put(proDoc(bio(), { ...hero(), id: 'hero-2' }))).assertStatus(422) // tipo único repetido
    ;(
      await put({ ...proDoc(), sections: [{ ...hero(), settings: { qualquer: 'coisa' } }] })
    ).assertStatus(422)
    const external = hero()
    ;(external.content as { portrait: { src: string } }).portrait.src =
      'https://cdn.exemplo.com/a.png'
    ;(await put({ ...proDoc(), sections: [external] })).assertStatus(422)
    const slash = bio()
    ;(slash.content as { instagram: { href: string } }).instagram.href = '/\\evil.com'
    ;(await put(proDoc(slash))).assertStatus(422)
    // documento enorme ou fundo demais
    const big = bio('x'.repeat(1100))
    ;(big.content as { paragraphs: string[] }).paragraphs = Array.from({ length: 6 }, () =>
      'x'.repeat(1200)
    )
    const many = {
      ...proDoc(),
      extra: {
        a: { b: { c: { d: { e: { f: { g: { h: { i: { j: { k: { l: { m: 1 } } } } } } } } } } } },
      },
    }
    ;(await put(many)).assertStatus(422)
  })

  test('auditoria do salvamento registra os hosts externos linkados', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('editor'))
    const p = await newProfessional(a)
    await a.put(`/admin/professionals/${p.id}/document`, { document: proDoc(), revision: 0 })
    const row = await db
      .from('audit_logs')
      .where('action', 'professional.document.save')
      .where('resource_id', String(p.id))
      .first()
    const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
    assert.deepEqual(meta.externalHosts, ['instagram.com'])
  })

  test('restaurar versão com a revisão do cadastro desatualizada: 409 e nada muda', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('editor'))
    const p = await newProfessional(a)
    await a.put(`/admin/professionals/${p.id}/document`, { document: proDoc(), revision: 0 })
    await a.post(`/admin/professionals/${p.id}/publish`)
    const detail = (await a.get(`/admin/professionals/${p.id}`)).body()
    // outra pessoa edita o cadastro depois
    ;(
      await a.put(`/admin/professionals/${p.id}`, {
        data: { ...detail.data, tagline: 'Mudou' },
        revision: detail.revision,
      })
    ).assertStatus(200)
    const stale = await a.post(`/admin/professionals/${p.id}/document/versions/1/restore`, {
      revision: 1,
      dataRevision: detail.revision,
    })
    stale.assertStatus(409)
    assert.equal((await a.get(`/admin/professionals/${p.id}`)).body().data.tagline, 'Mudou')
    ;(
      await a.post(`/admin/professionals/${p.id}/document/versions/1/restore`, {
        revision: 1,
        dataRevision: detail.revision + 1,
      })
    ).assertStatus(200)
  })

  test('publicar revalida o documento salvo (schema pode ter mudado)', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('editor'))
    const p = await newProfessional(a)
    await a.put(`/admin/professionals/${p.id}/document`, { document: proDoc(), revision: 0 })
    // simula um documento que deixou de ser válido depois de salvo (ex.: regra nova)
    await db
      .from('professionals')
      .where('id', p.id)
      .update({ document: JSON.stringify({ ...proDoc(), sections: [bio()] }) })
    const res = await a.post(`/admin/professionals/${p.id}/publish`)
    res.assertStatus(422)
    assert.equal(res.body().code, 'invalid_document')
  })

  test('histórico informa hasDocument sem carregar o JSON', async ({ client, assert }) => {
    const a = api(client, await makeUser('editor'))
    const p = await newProfessional(a)
    await a.post(`/admin/professionals/${p.id}/publish`)
    const items = (await a.get(`/admin/professionals/${p.id}/document/versions`)).body().items
    assert.isFalse(items[0].hasDocument)
  })
})

test('violação de índice único (corrida de slug) vira 409 e não 500', ({ assert }) => {
  const mapped = toDomainError({ code: 'ER_DUP_ENTRY' })
  assert.instanceOf(mapped, DomainError)
  assert.equal((mapped as DomainError).status, 409)
  const other = new Error('outro')
  assert.strictEqual(toDomainError(other), other)
})

test.group('Documento de página · seções repetidas e fundo (9B/9C)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('tipo repetível pode aparecer até 4 vezes; a 5ª é recusada (422) e nada é salvo', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('editor'))
    const p = await newProfessional(a)
    const copies = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ ...bio(), id: i === 0 ? 'bio' : `bio-${i + 1}` }))
    const ok = await a.put(`/admin/professionals/${p.id}/document`, {
      document: proDoc(...copies(4)),
      revision: 0,
    })
    ok.assertStatus(200)
    const over = await a.put(`/admin/professionals/${p.id}/document`, {
      document: proDoc(...copies(5)),
      revision: 1,
    })
    over.assertStatus(422)
    assert.include(JSON.stringify(over.body()), 'acima do limite')
    assert.equal((await a.get(`/admin/professionals/${p.id}/document`)).body().documentRevision, 1)
  })

  test('fundo da seção: tons permitidos salvam; valor livre e seção sem suporte são recusados', async ({
    client,
    assert,
  }) => {
    const a = api(client, await makeUser('editor'))
    const p = await newProfessional(a)
    const put = (document: unknown, revision: number) =>
      a.put(`/admin/professionals/${p.id}/document`, { document, revision })
    const saved = await put(proDoc({ ...bio(), settings: { background: 'gold' } }), 0)
    saved.assertStatus(200)
    const back = await a.get(`/admin/professionals/${p.id}/document`)
    assert.equal(back.body().document.sections[1].settings.background, 'gold')
    // Trajetória tem texto escuro: tom escuro seria ilegível.
    const wrong = await put(proDoc({ ...bio(), settings: { background: 'dark' } }), 1)
    wrong.assertStatus(422)
    assert.include(JSON.stringify(wrong.body()), 'não combina')
    ;(await put(proDoc({ ...bio(), settings: { background: '#ff0000' } }), 1)).assertStatus(422)
    ;(await put(proDoc({ ...bio(), settings: { background: 'url(x)' } }), 1)).assertStatus(422)
    const onHero = await put(
      { ...proDoc(), sections: [{ ...hero(), settings: { background: 'dark' } }, bio()] },
      1
    )
    onHero.assertStatus(422)
    assert.include(JSON.stringify(onHero.body()), 'não aceita fundo')
  })
})
