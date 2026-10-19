# Regras do projeto

## Antes de criar ou alterar interface (`apps/web`)

1. **Pesquise antes de criar.** Veja `docs/features/active/ui-consolidation/components.md`, `apps/web/src/components`, `apps/web/src/lib` e `packages/design-system`. Reutilize; estenda; só crie um componente novo com justificativa concreta.
2. **Listas do painel** usam `ListToolbar`, `Pager` (modo `hrefFor` ou `onPageChange`), `ListEmpty` e os helpers de `lib/list-params.ts`.
3. **Período 7/30/90 dias** usa `PeriodFilter` e `parsePeriod`. **Moeda** só por `lib/format.ts`. **Erros de API** por `describeApiError`.
4. **Modais** (`<dialog>`) usam `useDialogSync`; confirmações usam `useConfirm`. Nunca `alert`/`confirm`/`prompt` do navegador.
5. Estilos por tokens (`packages/design-system/src/tokens.css`). Não invente cores, fontes nem espaçamentos; hex novo só com justificativa.
6. Os padrões visuais do painel estão na skill `academia-admin-ui`: siga-a e confira a tela renderizada antes de entregar.

## Antes de modificar um componente compartilhado

Liste todos os consumidores (busca por import), preserve a compatibilidade, rode `pnpm --filter @academia/web typecheck && pnpm --filter @academia/web test` e confira as telas afetadas.

## Refatoração

Consolide lógica e estrutura, não a aparência. Mudança visual só com aprovação explícita do usuário.
