import HomeService from '#services/home_service'

/** Leitura pública da Home: snapshot publicado + vitrines atuais de profissionais e cursos. */
export default class PublicHomeController {
  async show() {
    return HomeService.publicView()
  }
}
