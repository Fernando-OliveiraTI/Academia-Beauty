# Decisões

## S-001 — Advisories de dependências (2026-10-19)
- `@adonisjs/http-server` ≤ 8.2.2 / `@adonisjs/core` < 7.3.1 (3 moderadas: open redirect por parâmetro de rota não codificado e ReDoS no roteador): a correção só existe na linha AdonisJS 7, que exige **Node ≥ 24** e troca a major de auth, lucid, session, shield, limiter e cors. O projeto usa Node 20 e AdonisJS 6.21 (a última 6.x, com http-server 7.8.1). Não é um simples bump. Exposição real: o código não usa `redirect` com parâmetros de rota (só um redirect estático no `guest_middleware`); o ReDoS do roteador é mitigado limitando o tamanho de URL no proxy. **Migração tratada como Fase 7, só com aprovação.**
- `braces` ≤ 3.0.3 (alta, DoS por recursão): sem versão corrigida publicada; vem de `assembler > cpy > micromatch`, ferramenta de build, que só processa padrões do próprio repositório; não executa em produção. Aceito e listado no `audit-ci` com validade.

## S-002 — CSP: nonce no painel, `unsafe-inline` no site público (2026-10-19)
O CSP por nonce exige renderização dinâmica em todas as páginas e desliga ISR/cache (guia oficial do Next). O painel (`/admin/*`) já é dinâmico e guarda a sessão: recebe CSP estrito por nonce em `src/proxy.ts` (`script-src 'self' 'nonce-…' 'strict-dynamic'`; `style-src-attr 'unsafe-inline'` só para atributos `style=""`). O site público é estático/ISR (`force-cache`, tags): mantém `script-src 'unsafe-inline'`, mitigado por `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, sem HTML bruto no renderer e URLs validadas (`isSafeUrl`). Alternativa futura: SRI experimental do Next (hash de scripts) para tirar o `unsafe-inline` do site sem perder cache.

## S-003 — Limites de login (2026-10-19)
Três escopos (par IP+e-mail 5, IP 20, e-mail 10, por 15 min), contando só falhas. Trade-off: o limite por e-mail permite a um atacante bloquear o dono da conta por 15 min com 10 tentativas; aceito (ele não consegue entrar, e o bloqueio expira). Atrás de proxy, `TRUSTED_PROXIES` é obrigatório, senão o limite por IP vale para todos juntos.

## S-004 — 2FA e sessões (2026-10-19)
TOTP próprio (RFC 6238, SHA-1, 6 dígitos, janela ±1, passo já usado é recusado), segredo cifrado com a `APP_KEY`, 10 códigos de recuperação de uso único (hash). 2FA opcional por conta; `REQUIRE_2FA_FOR_ADMINS=true` o exige dos administradores (recomendado em produção, aviso nos logs se desligado). Revogação por "época de sessão" (`users.session_epoch`), independente do store de sessão: troca/redefinição de senha, desativação, mudança de papel e "encerrar sessões" invalidam todas as sessões da conta na hora. Sessões abertas antes desta versão continuam válidas até a primeira revogação (época 0).

## S-005 — Limites dos endpoints públicos (2026-10-19)
Os três contadores em memória viraram `IpRateLimit` sobre o limiter do Adonis (store `database` em produção): valem entre instâncias e reinícios. Custo: uma escrita em `rate_limits` por chamada pública (a coleta de visitas já escreve em `page_events`). Linhas vencidas são apagadas por `maintenance:purge`.
