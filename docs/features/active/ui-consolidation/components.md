# Componentes e utilitários compartilhados do painel (`apps/web`)

Regra: **consolidar lógica e estrutura, nunca a aparência.** Uma mudança visual precisa de aprovação do usuário.

| Item | Local | Finalidade / props | Usado em |
|---|---|---|---|
| `PeriodFilter`, `parsePeriod`, `PERIOD_DAYS` | `src/components/period-filter.tsx` | Seletor 7/30/90 dias em pílula (`.period-filter`). `value`, `hrefFor(days)`; o período vive na URL. `parsePeriod` valida `?days=` (padrão 30). | Dashboard (`admin/page.tsx`), Perfil do público (`audience-insights.tsx`, em `/admin/checkouts`) |
| `Pager`, `lastPageOf` | `src/components/pager.tsx` | Rodapé numerado. Modo URL (`hrefFor`) ou cliente (`onPageChange`). | Profissionais, Cursos, Checkouts, Webhooks, Biblioteca de mídia |
| `ListToolbar` | `src/components/list-toolbar.tsx` | Busca, abas de situação, ordenação, itens por página (tudo na URL). | Listas de Profissionais, Cursos, Checkouts, Webhooks |
| `ProfessionalFilter` | `src/components/professional-filter.tsx` | Filtro da lista por profissional em cartõezinhos (foto, nome, especialidade); grava `?professionalId=`. Com `ListToolbar filterParams={['professionalId']}` o "Limpar filtros" aparece. | Lista de Cursos |
| `Kpi`, `Card`, `RankBars`, `Split`, `Sparkline`, `Icon`, `Empty`, `Period`, `Avatar`, `DeltaChip` | `src/components/dash-ui.tsx` | Peças dos painéis de números (extraídas do Dashboard sem mudar a aparência). | Dashboard, Insights |
| `InsightsFilters` | `src/components/insights-filters.tsx` | Filtros da área Insights (período livre, profissional, curso, aparelho, origem) na URL. | Insights |
| `ListEmpty` | `src/components/list-empty.tsx` | Estado vazio das listas (título + orientação). | As 4 listas acima |
| `pageOf`, `isPerPage`, `listHref`, `PER_PAGE_VALUES` | `src/lib/list-params.ts` | Leitura/validação de `?page=`, `?perPage=` e montagem da URL de página. | As 4 listas |
| `brl`, `money` | `src/lib/format.ts` | Moeda pt-BR (`money` aceita `null` → "—" e outra moeda). | Lista de cursos, `checkout-settings`, `course-payments`, `checkout-sessions`, `audience-insights` |
| `describeApiError` | `src/lib/api-errors.ts` | Mensagem de erro por status HTTP; cada tela passa a mensagem do seu `code`. | Configurações do editor (`page-settings`) |
| `useDialogSync` | `src/components/use-dialog.ts` | Abre/fecha `<dialog>` modal a partir de um estado (com fallback). | `media-input`, `image-field`, `media-library`, `webhook-deliveries`, `checkout-sessions` |
| `useNotice` | `src/components/use-notice.ts` | Aviso temporário + copiar para a área de transferência. | `webhook-deliveries`, `checkout-sessions` |
| `svg`, `EYE_ICON`, `CLOSE_ICON` | `src/components/icons.tsx` | Envelope SVG de traço (24×24, 1,8) e ícones idênticos entre telas. | `webhook-deliveries`, `checkout-sessions` |
| `useConfirm` | `src/components/confirm-dialog.tsx` | Confirmação no lugar de `window.confirm`. | `RowActions`, editor etc. |
| `RowActions` | `src/components/row-actions.tsx` | Ver, editar e menu (duplicar, despublicar, arquivar, apagar). | Listas de Profissionais e Cursos |
| `Button`, `Field`, `TextArea` | `packages/design-system` | Primitivas do formulário. | Login, Configurações do editor |
| `ProfessionalSettings`, `CourseSettings` | `src/app/admin/(protected)/editor/page-settings.tsx` | Painel **Configurações** do editor: o que não aparece na página (nome, endereço, foto do cartão, ficha do curso, oferta, vitrine, modelo). Grava a partir da versão mais recente do cadastro. | Editor visual |
| `PublishIssues` | `src/app/admin/(protected)/editor/publish-issues.tsx` | Pendências de publicação dentro do editor; cada uma leva à seção/campo ou às Configurações (`locateField` do contracts). | Editor visual |
| `CheckoutSettings` | `src/app/admin/(protected)/editor/checkout-settings.tsx` | Oferta do curso (cria quando não existe): preço, parcelas, checkout, ambiente, ativação. | Configurações do curso |
| `parseBRLToCents`, `maskBRL`, `maskPercent`, `centsToInput` | `src/lib/money-input.ts` | Máscaras de dinheiro/porcentagem sem ponto flutuante. | `price-form`, `price-fields` |

Removidos no editor único (2026-11-16): `wizard-ui`, os assistentes `profissionais/wizard.tsx` e `cursos/wizard.tsx` e seus `form-model`. As rotas `/admin/{profissionais,cursos}/:id` redirecionam ao editor.

## O que foi deliberadamente NÃO consolidado

- **Botões:** `ds-button` (design-system, pílula dourada) e `admin-button` (CSS do painel) são visualmente diferentes. Unificar muda a aparência; fica para decisão do usuário.
- **Ícones SVG restantes:** os envelopes diferem em tamanho e traço entre arquivos (16/18/20/24, `strokeWidth` 1,5–2); juntar alteraria o desenho. Só os idênticos foram para `icons.tsx`.
- **Tabelas:** `admin-table` já é a classe comum; colunas e ações são de cada módulo. Um `DataTable` genérico não compensa.
- **Cards e demais estados vazios** (`media-empty`, `dash-empty`, `ai-empty`, `tm-empty`): finalidades e aparências próprias.
- **Datas:** fusos diferentes entre telas (`America/Sao_Paulo` × padrão do navegador) são comportamento atual; não corrigidos aqui.
- **60 dias e período personalizado:** não existem hoje; seriam funcionalidade nova.
- **`packages/page-renderer` (site público):** fora desta auditoria.
