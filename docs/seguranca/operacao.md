# Operação: deploy, backup, rotinas e incidentes

## Imagens e ambiente

- Imagens: `infra/docker/api.Dockerfile` e `infra/docker/web.Dockerfile` (contexto = raiz do repositório). Exemplo completo de produção em `infra/containers/docker-compose.prod.example.yml`.
- **A API recusa subir em produção** com configuração insegura (`start/production_checks.ts`): `APP_KEY` < 32 caracteres, `SESSION_DRIVER` ≠ `database`, `LIMITER_STORE` ≠ `database`, segredos curtos. Avisos nos logs: sem `TRUSTED_PROXIES`, sem `REQUIRE_2FA_FOR_ADMINS`, `ADMIN_PASSWORD` ainda no ambiente.
- **`TRUSTED_PROXIES` é obrigatório na prática**: o navegador fala com o Next, que repassa à API. Sem a faixa de IP do Next, todos os visitantes parecem ter o IP dele e os limites de login (por IP) passam a valer para todos juntos.
- Termine o TLS num proxy reverso na frente do `web`. O Next envia HSTS e CSP.
- Segredos só em variáveis de ambiente/gestor de segredos. Nunca no repositório. Rotação: gere o valor novo, atualize API e web juntos (`REVALIDATE_SECRET` precisa ser igual nos dois), reinicie.

## Primeiro acesso

```
docker compose ... run --rm api node ace migration:run --force
docker compose ... run --rm api node ace db:seed --files database/seeders/initial_seeder.ts   # usa ADMIN_EMAIL/ADMIN_PASSWORD (12+ caracteres)
```
Depois do seed **remova `ADMIN_PASSWORD` do ambiente**, entre, ative a verificação em duas etapas em *Minha conta* e crie os demais usuários em *Usuários* (a senha provisória é exibida uma vez; a pessoa troca no primeiro acesso). Com `REQUIRE_2FA_FOR_ADMINS=true`, administradores só acessam a própria conta até ativar o 2FA.

## Rotinas (cron do servidor)

| Frequência | Comando | O que faz |
|---|---|---|
| Diária | `docker compose ... run --rm api node ace maintenance:purge` | Retenção de dados (ver `privacidade.md`) |
| Diária | `MYSQL_ROOT_PASSWORD=... infra/backup/backup.sh` | Dump do MySQL + mídia, com verificação e retenção de 14 dias |
| Diária | Copiar `BACKUP_DIR` para fora do servidor (armazenamento de objetos com versionamento) | Um backup no mesmo disco não é backup |

**Ensaio de restauração:** faça trimestralmente `infra/backup/restore.sh` num ambiente de teste e confira login, uma página publicada e uma imagem. Backup nunca restaurado não conta. Metas sugeridas: RPO 24 h, RTO 4 h (ajuste ao contrato).

## Incidentes

- **Conta comprometida:** em *Usuários* → *Redefinir senha* e *Encerrar sessões* (encerra tudo na hora); se houver 2FA, *Remover verificação em 2 etapas* e refazer. Consulte `audit_logs` (`auth.*`, `user.*`).
- **Pessoa perdeu o celular:** usar um código de recuperação no login; sem eles, outro administrador remove o 2FA dela.
- **Último administrador trancado fora:** com acesso ao servidor, `node ace repl`/SQL para zerar `totp_*` do usuário e redefinir a senha; registre o procedimento.
- **Bloqueio de login (429):** expira em 15 minutos. Para liberar antes: apague a linha correspondente em `rate_limits`.
- **Vazamento de segredo:** rotacione o segredo (acima), invalide sessões (`UPDATE users SET session_epoch = session_epoch + 1`), revise auditoria e comunique conforme a LGPD (prazo razoável à ANPD e aos titulares).

## Monitoramento

Implementado na Fase 8B com Azure Application Insights: ver [`docs/observabilidade.md`](../observabilidade.md) (o que é coletado, privacidade, como ligar, alertas e consultas). Os logs seguem em JSON no stdout (cookies, tokens e senhas são redigidos) e ficam no *Log stream* do App Service; a centralização deles (*Diagnostic settings*) e o monitor de falha do backup e de disco ainda não foram configurados. Defina quem recebe os alertas (`ALERT_EMAIL` do `infra/azure/monitoring.sh`).
