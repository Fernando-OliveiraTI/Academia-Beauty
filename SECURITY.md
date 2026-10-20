# Política de segurança

## Como reportar uma vulnerabilidade

Não abra uma issue pública. Envie os detalhes (passos para reproduzir, impacto, versão/commit) por e-mail para o responsável pelo projeto (contato definido pela Academia Beauty) ou use o recurso "Report a vulnerability" do GitHub neste repositório.
Respondemos em até 5 dias úteis e coordenamos a divulgação depois da correção.

## Escopo e práticas

- Autenticação por sessão no servidor, CSRF, RBAC por permissão e auditoria de ações administrativas.
- Dados pessoais (IP, nome e e-mail de compradores) são guardados com retenção limitada; ver `docs/seguranca/privacidade.md`.
- Dependências verificadas no CI (`pnpm audit:prod`), segredos varridos por gitleaks e atualizações semanais via Dependabot.
- Exceções de auditoria e riscos aceitos estão em `docs/features/active/security-hardening/decisions.md`.

## Versões suportadas

Somente a branch `main`.
