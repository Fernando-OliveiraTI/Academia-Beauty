# Handoff — Insights (D-040)

**Fase:** F1–F5 concluídas (2026-11-17). Branch `feat/editor-unico` (sem commit).

## Entregue
- API: `GET /admin/insights` (`InsightsService`, `AdminInsightsController`), evento `time` em `/public/track`, papel `professional` + `users.professional_id`, permissões `insights.read`/`insights.all`, Dashboard exige `professionals.read`, gestão de usuários com vínculo ao profissional.
- Web: `/admin/insights` (indicadores, gráfico, funil até a venda, tabela por curso, aparelhos, origem), filtros na URL, menu "Insights", login de profissional cai direto nos Insights, cartões de profissional em Usuários, rastreador com tempo visível (a cada 15 s + ao ocultar/sair), `dash-ui` compartilhado.
- Migrações: `1792240800001_add_duration_to_page_events`, `1792240800002_add_professional_to_users` (aplicadas no banco local).

## Testes (2026-11-17)
- API 233 ✔ (6 novos em `insights.spec.ts`: tempo, funil/vendas/fuso, filtros, escopo do profissional, permissões, vínculo) · contracts 51 ✔ · web vitest 138 ✔ (`insights.test.ts`, `page-tracker.test.tsx`) · typecheck/lint ok.
- E2E: 13/13 ✔ incluindo o novo `e2e:insights`; registros `e2e-*` não aumentam.
- Telas conferidas (admin 1440/390, login de profissional restrito) no banco local; logins de teste criados ali foram desativados.

## Pendências
- Produção: rodar as 2 migrações no deploy; o tempo na página só começa a contar depois disso.
- Política de privacidade: citar a medição de tempo (anônima, sem cookie).
- Futuro (não feito): comparação com o período anterior, exportar CSV, convite por e-mail do login do profissional.
