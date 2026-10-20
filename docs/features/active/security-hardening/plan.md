# Endurecimento de segurança e profissionalização

Origem: revisão de 2026-10-19 (relatório na conversa; itens numerados abaixo). Escopo autorizado pelo usuário: todos os itens.
Regras: sem commit/deploy sem autorização; mudança visual do painel segue a skill `academia-admin-ui`; testes antes de concluir cada fase.

| Fase | Itens | Conteúdo | Estado |
|---|---|---|---|
| 1 | 1, 10 | Auditoria de dependências no CI (com exceções justificadas), lint do web, Dependabot, varredura de segredos, `SECURITY.md` | **concluída** (Adonis: ver Fase 7) |
| 2 | 2, 3 | Limites de login por IP e por e-mail; gestão de usuários; troca de senha; 2FA (TOTP); revogação de sessões | **concluída** |
| 3 | 4, 5 | HSTS no web; CSP com nonce (sem `unsafe-inline` em script) | **concluída** (painel; site público mantém `unsafe-inline`, ver S-002) |
| 4 | 7, 8, 9 | Rate limit público compartilhado; retenção agendada (comando `ace`); limites de corpo | **concluída** |
| 5 | 6, 11, 13 | Dockerfiles, compose de produção de exemplo, backup/restore, redação de logs, validação de segredos em produção | **concluída** (monitoramento externo: pendente, ver operacao.md) |
| 6 | 12 + baixos | LGPD (IP truncado em produção, política), remover `/admin/ping`, testes de listas/modais, docs | **concluída** (texto jurídico da política: pendente do cliente) |
| 7 | 1 (Adonis) | **Migração AdonisJS 6 → 7 (exige Node 24): decisão do usuário, ver decisions.md** | aguarda decisão |
