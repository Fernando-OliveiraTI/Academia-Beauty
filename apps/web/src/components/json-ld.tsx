import { jsonLd } from '@/lib/seo'

/** Dados estruturados (schema.org) da página. Sem dados (ex.: sem `SITE_URL`) não emite nada. */
export function JsonLd({ data }: { data: object | null }) {
  if (!data) return null
  // JSON serializado com `<` escapado (jsonLd); é bloco de dados, o navegador não o executa.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
}
