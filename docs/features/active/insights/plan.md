# Insights de cursos (engajamento e vendas)

Status: **F1–F5 implementadas e validadas** (2026-11-17). Decisões em D-040.

## Objetivo
Área "Insights" no painel para acompanhar, por curso e por profissional, o funil completo:
visitas à página → tempo na página → cliques em comprar → checkout aberto → venda aprovada/concluída,
com filtros por profissional, curso, período (datas livres) e outros recortes. Depois, cada profissional
entra com login próprio e vê só os próprios cursos.

## O que já existe (aproveitar)
- `page_events` (D-0xx, Fase 4/7): `view`, `cta` (clique em comprar) e `checkout` (checkout aberto) por página
  (`resource_type` + `slug`), visitante único por hash diário (sem cookie e sem IP guardado), aparelho e origem.
- `checkout_sessions` (D-036): cada abertura do checkout embutido, ligada ao pagamento pelo `ref`.
- `payment_events` (webhook The Members): status (approved, refunded, charged_back…), valor, forma, `course_id`.
- Dashboard (`DashboardService.overview`): funil por curso e top profissionais/cursos, só 7/30/90 dias, sem vendas.
- Componentes: `PeriodFilter`, `ProfessionalFilter` (cartões), listas e `audience-insights`.

## Lacunas
1. Tempo na página não é medido.
2. Vendas (webhook) não aparecem junto do funil; não há receita por curso/profissional.
3. Sem filtro por profissional/curso nem intervalo de datas livre.
4. Sem papel "profissional" nem restrição de dados por profissional.

## Fases propostas (cada uma só com autorização)
- **F1 — Tempo na página.** O rastreador da página pública mede o tempo **com a aba visível** e envia ao sair
  (`sendBeacon` no `pagehide`/`visibilitychange`), como `duration_ms` ligado à visita. Tetos contra valores absurdos
  (ex.: 30 min). Sem cookie, sem IP (mesmo modelo de `page_events`). Migração com coluna nova.
- **F2 — Consulta de insights (API).** `GET /admin/insights` com filtros `from`, `to`, `professionalId`, `courseId`
  (e depois aparelho/origem): totais, funil por curso, série diária, ranking, tempo médio/mediano, vendas aprovadas,
  receita, reembolsos/estornos, conversões (visita→clique, clique→checkout, checkout→venda). Testes de consulta.
- **F3 — Tela Insights.** Menu "Insights": filtros (cartões de profissional, curso, período com presets e datas
  livres), indicadores, funil, ranking de cursos, série por dia e tabela por curso. Padrão visual do painel.
- **F4 — Login do profissional.** Papel novo `professional` ligado a um profissional; vê só Insights (e, se desejado,
  a própria página) com os dados restritos aos próprios cursos, imposto no servidor. Convite/criação pelo admin.
- **F5 — Validação, E2E e revisão.**

## Decisões (tomadas — ver D-040)
1. "Mais clicados": contar **visitas à página do curso** (recomendado) ou também cliques nos cartões do curso na Home/página do profissional?
2. Venda "concluída": **aprovada pelo webhook** (recomendado), descontando reembolsos/estornos?
3. O profissional vê **valores (receita)** ou só **quantidades**? Dados do comprador ficam fora (LGPD).
4. Filtros além de data/profissional/curso: aparelho, origem (Instagram, Google…), forma de pagamento?
5. Ordem: F1–F3 primeiro e F4 (login) depois, ou login junto?
