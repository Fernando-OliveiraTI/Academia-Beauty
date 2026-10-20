# Privacidade e dados pessoais (LGPD)

Inventário do que o sistema guarda, por quê, por quanto tempo e como reduzir. Revise com o encarregado (DPO) antes de ir ao ar.

| Dado | Onde | Finalidade | Retenção (padrão) | Variável | Observações |
|---|---|---|---|---|---|
| E-mail, nome, papel, último acesso | `users` | Acesso ao painel | Enquanto a conta existir | — | Senha só em hash (scrypt); segredo 2FA cifrado; códigos de recuperação em hash |
| IP, navegador, ação | `audit_logs` | Auditoria de segurança | 730 dias | `AUDIT_LOG_RETENTION_DAYS` (90–3650) | Nunca grava senha, token nem corpo de requisição |
| Visitas ao checkout: IP, navegador, SO, país/cidade aproximada, origem, idioma, fuso | `checkout_sessions` | Entender a origem das compras e conferir testes de pagamento | 180 dias | `CHECKOUT_SESSIONS_RETENTION_DAYS` (1–730) | **IP: truncado por padrão em produção** (`CHECKOUT_SESSIONS_IP_MODE`: `full`, `truncated`, `none`) |
| Corpo bruto do webhook da The Members (nome e e-mail do comprador) | `webhook_deliveries` | Depurar integração | 30 dias | `THEMEMBERS_LOG_RETENTION_DAYS` (1–365) | Só administradores veem; `THEMEMBERS_LOG_RAW=false` desliga |
| Eventos de pagamento (comprador mascarado, valor, status) | `payment_events` | Conciliação e confirmação ao comprador | 1825 dias (5 anos) | `PAYMENT_EVENTS_RETENTION_DAYS` (365–3650) | Registro financeiro: o prazo legal pode exigir mais; confirme com a contabilidade |
| Eventos de página (sem IP, sem cookie): hash diário do visitante, aparelho, origem | `page_events` | Métricas do dashboard | 400 dias | `PAGE_EVENTS_RETENTION_DAYS` (30–1095) | O hash muda todo dia, não permite seguir uma pessoa entre dias |
| Sessões e contadores de limite | `sessions`, `rate_limits` | Operação | Até expirarem | — | Limpos pela rotina diária |

## Limpeza

`node ace maintenance:purge` (uma vez ao dia, ver `operacao.md`) apaga tudo que passou da retenção. Sem a rotina, parte da limpeza só acontece "de carona" nas gravações.

## Direitos do titular

Não há tela de atendimento a titulares. Procedimento manual até existir: (1) confirmar a identidade; (2) localizar os registros por e-mail/código de visita em `checkout_sessions`, `webhook_deliveries`, `payment_events` e `audit_logs`; (3) exportar ou apagar com SQL revisado por duas pessoas; (4) registrar o atendimento. Dados de pagamento podem precisar ser mantidos por obrigação legal.

## Pendências de negócio (decisão do cliente)

- Texto da política de privacidade e base legal por finalidade, publicados no site.
- Aviso de coleta no checkout (visita e IP).
- Prazo de retenção financeira.
- Contrato de operador com a The Members e com a hospedagem.
