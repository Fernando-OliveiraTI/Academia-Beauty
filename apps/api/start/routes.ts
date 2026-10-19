import router from '@adonisjs/core/services/router'
import db from '@adonisjs/lucid/services/db'
import { middleware } from '#start/kernel'

const AuthController = () => import('#controllers/auth_controller')
const AdminProfessionalsController = () => import('#controllers/admin_professionals_controller')
const AdminCoursesController = () => import('#controllers/admin_courses_controller')
const AdminProfessionalDocumentsController = () =>
  import('#controllers/admin_professional_documents_controller')
const AdminCourseDocumentsController = () =>
  import('#controllers/admin_course_documents_controller')
const ThemembersWebhookController = () => import('#controllers/themembers_webhook_controller')
const PublicCoursesController = () => import('#controllers/public_courses_controller')
const PublicProfessionalsController = () => import('#controllers/public_professionals_controller')
const AdminHomeController = () => import('#controllers/admin_home_controller')
const PublicHomeController = () => import('#controllers/public_home_controller')
const AdminMediaController = () => import('#controllers/admin_media_controller')
const PublicMediaController = () => import('#controllers/public_media_controller')
const PublicTrackController = () => import('#controllers/public_track_controller')
const AdminDashboardController = () => import('#controllers/admin_dashboard_controller')

router.get('/health', async ({ response }) => {
  try {
    await db.rawQuery('select 1')
    return { status: 'ok' }
  } catch {
    return response.serviceUnavailable({ status: 'unavailable' })
  }
})

router
  .group(() => {
    router.post('/login', [AuthController, 'login'])
    router.post('/logout', [AuthController, 'logout']).use(middleware.auth())
    router.get('/me', [AuthController, 'me']).use(middleware.auth())
  })
  .prefix('/auth')

// Leitura pública (somente publicados).
router
  .group(() => {
    router.get('/home', [PublicHomeController, 'show'])
    router.get('/professionals', [PublicProfessionalsController, 'showcase'])
    router.get('/professionals/:slug', [PublicProfessionalsController, 'show'])
    router.get('/courses/:slug', [PublicCoursesController, 'show'])
    router.post('/track', [PublicTrackController, 'store'])
  })
  .prefix('/public')

// Webhook de checkout da The Members (servidor→servidor): autenticado por assinatura HMAC, fora do CSRF.
router.post('/webhooks/themembers', [ThemembersWebhookController, 'handle'])

// Painel de indicadores: qualquer usuário autenticado do painel.
router.get('/admin/dashboard', [AdminDashboardController, 'show']).use(middleware.auth())

// Administração de profissionais. Leitura, escrita e publicação têm permissões distintas.
router
  .group(() => {
    router
      .get('/', [AdminProfessionalsController, 'index'])
      .use(middleware.can({ permission: 'professionals.read' }))
    router
      .get('/:id', [AdminProfessionalsController, 'show'])
      .use(middleware.can({ permission: 'professionals.read' }))
    router
      .post('/', [AdminProfessionalsController, 'store'])
      .use(middleware.can({ permission: 'professionals.write' }))
    router
      .post('/:id/duplicate', [AdminProfessionalsController, 'duplicate'])
      .use(middleware.can({ permission: 'professionals.write' }))
    router
      .put('/:id', [AdminProfessionalsController, 'update'])
      .use(middleware.can({ permission: 'professionals.write' }))
    const publish = middleware.can({ permission: 'professionals.publish' })
    router.post('/:id/publish', [AdminProfessionalsController, 'publish']).use(publish)
    router.post('/:id/unpublish', [AdminProfessionalsController, 'unpublish']).use(publish)
    router.post('/:id/archive', [AdminProfessionalsController, 'archive']).use(publish)
    router.delete('/:id', [AdminProfessionalsController, 'destroy']).use(publish)
    router.post('/:id/restore', [AdminProfessionalsController, 'restore']).use(publish)
    router.put('/:id/showcase', [AdminProfessionalsController, 'showcase']).use(publish)
  })
  .prefix('/admin/professionals')
  .where('id', router.matchers.number())

// Administração de cursos. A oferta (preço e checkout) tem permissão própria: `commerce.manage`.
router
  .group(() => {
    router
      .get('/', [AdminCoursesController, 'index'])
      .use(middleware.can({ permission: 'courses.read' }))
    router
      .get('/themembers/preview', [AdminCoursesController, 'themembersPreview'])
      .use(middleware.can({ permission: 'commerce.manage' }))
    router
      .post('/themembers/sync', [AdminCoursesController, 'themembersApply'])
      .use(middleware.can({ permission: 'commerce.manage' }))
    router
      .get('/:id', [AdminCoursesController, 'show'])
      .use(middleware.can({ permission: 'courses.read' }))
    router
      .post('/', [AdminCoursesController, 'store'])
      .use(middleware.can({ permission: 'courses.write' }))
    router
      .post('/:id/duplicate', [AdminCoursesController, 'duplicate'])
      .use(middleware.can({ permission: 'courses.write' }))
    router
      .put('/:id', [AdminCoursesController, 'update'])
      .use(middleware.can({ permission: 'courses.write' }))
    router
      .get('/:id/payments', [AdminCoursesController, 'payments'])
      .use(middleware.can({ permission: 'commerce.manage' }))
    router
      .put('/:id/themembers-id', [AdminCoursesController, 'themembersLink'])
      .use(middleware.can({ permission: 'commerce.manage' }))
    router
      .delete('/:id/themembers-id', [AdminCoursesController, 'themembersUnlink'])
      .use(middleware.can({ permission: 'commerce.manage' }))
    router
      .put('/:id/commercial', [AdminCoursesController, 'commercial'])
      .use(middleware.can({ permission: 'commerce.manage' }))
    const publish = middleware.can({ permission: 'courses.publish' })
    router.post('/:id/publish', [AdminCoursesController, 'publish']).use(publish)
    router.post('/:id/unpublish', [AdminCoursesController, 'unpublish']).use(publish)
    router.post('/:id/archive', [AdminCoursesController, 'archive']).use(publish)
    router.delete('/:id', [AdminCoursesController, 'destroy']).use(publish)
    router.post('/:id/restore', [AdminCoursesController, 'restore']).use(publish)
    router.put('/:id/showcase', [AdminCoursesController, 'showcase']).use(publish)
  })
  .prefix('/admin/courses')
  .where('id', router.matchers.number())

// Documento de página do editor visual (D-020): leitura e escrita do rascunho.
router
  .group(() => {
    router
      .get('/:id/document', [AdminProfessionalDocumentsController, 'show'])
      .use(middleware.can({ permission: 'professionals.read' }))
    router
      .get('/:id/document/versions', [AdminProfessionalDocumentsController, 'versions'])
      .use(middleware.can({ permission: 'professionals.read' }))
    const write = middleware.can({ permission: 'professionals.write' })
    router.put('/:id/document', [AdminProfessionalDocumentsController, 'save']).use(write)
    router.delete('/:id/document', [AdminProfessionalDocumentsController, 'clear']).use(write)
    router
      .post('/:id/document/versions/:version/restore', [
        AdminProfessionalDocumentsController,
        'restoreVersion',
      ])
      .use(write)
  })
  .prefix('/admin/professionals')
  .where('id', router.matchers.number())
  .where('version', router.matchers.number())

// Documento de página do editor visual (D-020): leitura e escrita do rascunho.
router
  .group(() => {
    router
      .get('/:id/document', [AdminCourseDocumentsController, 'show'])
      .use(middleware.can({ permission: 'courses.read' }))
    router
      .get('/:id/document/versions', [AdminCourseDocumentsController, 'versions'])
      .use(middleware.can({ permission: 'courses.read' }))
    const write = middleware.can({ permission: 'courses.write' })
    router.put('/:id/document', [AdminCourseDocumentsController, 'save']).use(write)
    router.delete('/:id/document', [AdminCourseDocumentsController, 'clear']).use(write)
    router
      .post('/:id/document/versions/:version/restore', [
        AdminCourseDocumentsController,
        'restoreVersion',
      ])
      .use(write)
  })
  .prefix('/admin/courses')
  .where('id', router.matchers.number())
  .where('version', router.matchers.number())

// Home (Fase 7B): documento único. Leitura exige `pages.read`; salvar/restaurar, `pages.write`; publicar, `pages.publish`.
router
  .group(() => {
    router
      .get('/', [AdminHomeController, 'state'])
      .use(middleware.can({ permission: 'pages.read' }))
    router
      .get('/document', [AdminHomeController, 'show'])
      .use(middleware.can({ permission: 'pages.read' }))
    router
      .get('/document/versions', [AdminHomeController, 'versions'])
      .use(middleware.can({ permission: 'pages.read' }))
    const write = middleware.can({ permission: 'pages.write' })
    router.put('/document', [AdminHomeController, 'save']).use(write)
    router.delete('/document', [AdminHomeController, 'clear']).use(write)
    router
      .post('/document/versions/:version/restore', [AdminHomeController, 'restoreVersion'])
      .use(write)
    router
      .post('/publish', [AdminHomeController, 'publish'])
      .use(middleware.can({ permission: 'pages.publish' }))
  })
  .prefix('/admin/home')
  .where('version', router.matchers.number())

// Biblioteca de mídia (Fase 7A). Entrega pública por id imutável; administração exige `media.manage`.
router.get('/media/:id', [PublicMediaController, 'show']).where('id', /^[0-9a-f]{32}$/)
router
  .group(() => {
    router.get('/', [AdminMediaController, 'index'])
    router.post('/', [AdminMediaController, 'store'])
    router.get('/:id', [AdminMediaController, 'show'])
    router.delete('/:id', [AdminMediaController, 'destroy'])
  })
  .prefix('/admin/media')
  .where('id', /^[0-9a-f]{32}$/)
  .use(middleware.can({ permission: 'media.manage' }))

/** Exemplo mínimo de rota protegida por permissão; os módulos reais entram nas fases 3 e 4. */
router
  .get('/admin/ping', async () => ({ ok: true }))
  .use(middleware.can({ permission: 'pages.write' }))
