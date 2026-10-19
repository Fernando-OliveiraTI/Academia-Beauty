# Componentes e utilitários compartilhados do painel (`apps/web`)

Regra: **consolidar lógica e estrutura, nunca a aparência.** Uma mudança visual precisa de aprovação do usuário.

| Item | Local | Finalidade / props | Usado em |
|---|---|---|---|
| `PeriodFilter`, `parsePeriod`, `PERIOD_DAYS` | `src/components/period-filter.tsx` | Seletor 7/30/90 dias em pílula (`.period-filter`). `value`, `hrefFor(days)`; o período vive na URL. `parsePeriod` valida `?days=` (padrão 30). | Dashboard (`admin/page.tsx`), Perfil do público (`audience-insights.tsx`, em `/admin/checkouts`) |
| `Pager`, `lastPageOf` | `src/components/pager.tsx` | Rodapé numerado. Modo URL (`hrefFor`) ou cliente (`onPageChange`). | Profissionais, Cursos, Checkouts, Webhooks, Biblioteca de mídia |
| `ListToolbar` | `src/components/list-toolbar.tsx` | Busca, abas de situação, ordenação, itens por página (tudo na URL). | Listas de Profissionais, Cursos, Checkouts, Webhooks |
| `ListEmpty` | `src/components/list-empty.tsx` | Estado vazio das listas (título + orientação). | As 4 listas acima |
| `pageOf`, `isPerPage`, `listHref`, `PER_PAGE_VALUES` | `src/lib/list-params.ts` | Leitura/validação de `?page=`, `?perPage=` e montagem da URL de página. | As 4 listas |
| `brl`, `money` | `src/lib/format.ts` | Moeda pt-BR (`money` aceita `null` → "—" e outra moeda). | Wizard de cursos, lista de cursos, `checkout-settings`, `course-payments`, `checkout-sessions`, `audience-insights` |
| `describeApiError` | `src/lib/api-errors.ts` | Mensagem de erro por status HTTP; cada tela passa a mensagem do seu `code`. | Wizards de cursos e profissionais |
| `useDialogSync` | `src/components/use-dialog.ts` | Abre/fecha `<dialog>` modal a partir de um estado (com fallback). | `media-input`, `image-field`, `media-library`, `webhook-deliveries`, `checkout-sessions` |
| `useNotice` | `src/components/use-notice.ts` | Aviso temporário + copiar para a área de transferência. | `webhook-deliveries`, `checkout-sessions` |
| `svg`, `EYE_ICON`, `CLOSE_ICON` | `src/components/icons.tsx` | Envelope SVG de traço (24×24, 1,8) e ícones idênticos entre telas. | `webhook-deliveries`, `checkout-sessions` |
| `useConfirm` | `src/components/confirm-dialog.tsx` | Confirmação no lugar de `window.confirm`. | `RowActions`, editor etc. |
| `RowActions` | `src/components/row-actions.tsx` | Ver, editar e menu (duplicar, despublicar, arquivar, apagar). | Listas de Profissionais e Cursos |
| `Button`, `Field`, `TextArea` | `packages/design-system` | Primitivas do formulário (login e wizards). | Login, wizards |

## O que foi deliberadamente NÃO consolidado

- **Botões:** `ds-button` (design-system, pílula dourada) e `admin-button` (CSS do painel) são visualmente diferentes. Unificar muda a aparência; fica para decisão do usuário.
- **Ícones SVG restantes:** os envelopes diferem em tamanho e traço entre arquivos (16/18/20/24, `strokeWidth` 1,5–2); juntar alteraria o desenho. Só os idênticos foram para `icons.tsx`.
- **Tabelas:** `admin-table` já é a classe comum; colunas e ações são de cada módulo. Um `DataTable` genérico não compensa.
- **Cards e demais estados vazios** (`media-empty`, `dash-empty`, `ai-empty`, `tm-empty`): finalidades e aparências próprias.
- **Datas:** fusos diferentes entre telas (`America/Sao_Paulo` × padrão do navegador) são comportamento atual; não corrigidos aqui.
- **60 dias e período personalizado:** não existem hoje; seriam funcionalidade nova.
- **`packages/page-renderer` (site público):** fora desta auditoria.
