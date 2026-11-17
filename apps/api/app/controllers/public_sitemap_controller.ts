import SitemapService from '#services/sitemap_service'

/** Lista de URLs publicadas para o sitemap do site (só slugs e data de atualização). */
export default class PublicSitemapController {
  async index() {
    return SitemapService.entries()
  }
}
