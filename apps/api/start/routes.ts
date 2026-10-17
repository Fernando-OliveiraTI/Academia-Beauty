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
const PublicCoursesController = () => import('#controllers/public_courses_controller')
const PublicProfessionalsController = () => import('#controllers/public_professionals_controller')

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
    router.get('/professionals', [PublicProfessionalsController, 'showcase'])
    router.get('/professionals/:slug', [PublicProfessionalsController, 'show'])
    router.get('/courses/:slug', [PublicCoursesController, 'show'])
  })
  .prefix('/public')

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
      .put('/:id', [AdminProfessionalsController, 'update'])
      .use(middleware.can({ permission: 'professionals.write' }))
    const publish = middleware.can({ permission: 'professionals.publish' })
    router.post('/:id/publish', [AdminProfessionalsController, 'publish']).use(publish)
    router.post('/:id/unpublish', [AdminProfessionalsController, 'unpublish']).use(publish)
    router.post('/:id/archive', [AdminProfessionalsController, 'archive']).use(publish)
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
      .get('/:id', [AdminCoursesController, 'show'])
      .use(middleware.can({ permission: 'courses.read' }))
    router
      .post('/', [AdminCoursesController, 'store'])
      .use(middleware.can({ permission: 'courses.write' }))
    router
      .put('/:id', [AdminCoursesController, 'update'])
      .use(middleware.can({ permission: 'courses.write' }))
    router
      .put('/:id/commercial', [AdminCoursesController, 'commercial'])
      .use(middleware.can({ permission: 'commerce.manage' }))
    const publish = middleware.can({ permission: 'courses.publish' })
    router.post('/:id/publish', [AdminCoursesController, 'publish']).use(publish)
    router.post('/:id/unpublish', [AdminCoursesController, 'unpublish']).use(publish)
    router.post('/:id/archive', [AdminCoursesController, 'archive']).use(publish)
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

/** Exemplo mínimo de rota protegida por permissão; os módulos reais entram nas fases 3 e 4. */
router
  .get('/admin/ping', async () => ({ ok: true }))
  .use(middleware.can({ permission: 'pages.write' }))
