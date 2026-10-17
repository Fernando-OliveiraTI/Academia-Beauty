import BaseDocumentsController from '#controllers/base_documents_controller'
import { COURSE_KIND } from '#services/document_service'

export default class AdminCourseDocumentsController extends BaseDocumentsController {
  protected kind = COURSE_KIND
  protected resource = 'course' as const
}
