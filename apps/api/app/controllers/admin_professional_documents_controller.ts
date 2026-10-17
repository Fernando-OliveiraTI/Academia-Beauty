import BaseDocumentsController from '#controllers/base_documents_controller'
import { PROFESSIONAL_KIND } from '#services/document_service'

export default class AdminProfessionalDocumentsController extends BaseDocumentsController {
  protected kind = PROFESSIONAL_KIND
  protected resource = 'professional' as const
}
