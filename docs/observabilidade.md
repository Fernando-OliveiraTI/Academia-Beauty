# Observabilidade (Fase 8B)

Monitoramento por **Azure Application Insights**, ligado por uma única variável. Sem ela, nada é enviado e nada muda.

## O que é coletado

| Origem | Dado | Como |
|---|---|---|
| API | Toda requisição concluída: `MÉTODO /padrão/da/rota`, status, duração (o `/health` não entra) | evento `http:request_completed` do Adonis (`start/telemetry.ts`) |
| API | Exceções de servidor (5xx ou erro inesperado), com a rota | `app/exceptions/handler.ts` |
| API | Eventos de auditoria: só o nome (`audit.auth.login_failed`, `audit.course.publish`…) e o tipo de recurso | `AuditService` |
| API | Desfecho de cada chamada do webhook da The Members (`webhook.themembers`: `result`, `status`, `event`) | `themembers_webhook_controller.ts` |
| Site | Erros de renderização, rota ou ação do servidor (rota, tipo, `digest`) | `src/instrumentation.ts` |
| Site | Saúde: `GET /healthz` (o site está de pé; é o que o App Service usa) e `GET /healthz?deep=1` (também a API e o banco; para monitores) | `src/app/healthz/route.ts` |

**Não é coletado:** latência por página do site, erros do navegador (JavaScript no cliente), dependências (consultas ao MySQL), métricas de CPU/memória (essas já existem no App Service).

## Privacidade (LGPD)

Tudo passa por `packages/telemetry/src/scrub.ts` antes de sair do servidor:

- **Nunca enviados:** IP, cookies, cabeçalhos, corpo de requisição, e-mail e id do usuário, consulta da URL (`?…`) e metadados da auditoria.
- A URL é sempre o **padrão da rota** (`/cursos/:slug`), nunca o endereço real.
- Mensagens de erro e pilhas têm mascarados: e-mail, CPF, CNPJ, cartão, telefone, IP, JWT, `Bearer …`, `senha=`/`token=`/`secret=`/`authorization=`/`cookie=` e sequências longas (≥ 32 caracteres, como ids de mídia e segredos).
- Propriedades com nome sensível (`email`, `cpf`, `token`, `senha`, `ip`, `cookie`…) saem como `[redigido]`; no máximo 20 por evento.
- Só envia para os domínios oficiais de ingestão (`*.applicationinsights.azure.com` etc., por HTTPS); qualquer outro destino desliga a telemetria.
- Retenção: a do espaço de trabalho (Log Analytics). O padrão é 30 dias; ajuste no portal conforme a política de privacidade.

## Segurança e robustez

- Nunca lança nem atrasa uma resposta: fila em memória (até 500 itens), envio em lote a cada 10 s, nova tentativa com espera crescente, e descarta o mais antigo se encher.
- Uma connection string com erro **não derruba** a API: avisa no log e fica desligada.
- Erros 4xx (login errado, 404, validação) aparecem como requisições, mas **não** como exceção nem como falha.

## Como ligar

1. Crie os recursos (precisa do seu ok; custa por volume de dados): `ALERT_EMAIL=voce@exemplo.com infra/azure/monitoring.sh` mostra o plano (simulação). Com `--apply` executa: Log Analytics, Application Insights, a variável nos dois apps, verificação de saúde (`/health` e `/healthz`), grupo de ação por e-mail e 8 alertas. **O script foi escrito e checado contra a ajuda do `az`, mas ainda não foi executado.**
2. Ou manualmente: crie o Application Insights (modo espaço de trabalho) e defina em **cada** Web App a variável `APPLICATIONINSIGHTS_CONNECTION_STRING` (uma por vez, `--settings NOME=valor`; nunca `@arquivo`).
3. Opcional: `TELEMETRY_REQUEST_SAMPLING=0.5` na API envia metade das requisições (erros e eventos nunca são amostrados).
4. Confira: no console do App Service da API (SSH) rode `node ace telemetry:check`. Mostra se o serviço aceitou um evento de teste; ele aparece como `telemetry.check` em alguns minutos.
5. No log de subida da API deve aparecer `telemetria ligada (Application Insights)`. Em produção sem a variável aparece o aviso `telemetria desligada`.

## Alertas

| Alerta | Condição | Severidade |
|---|---|---|
| `academia-{api,web}-saude` | verificação de saúde do App Service abaixo de 100% | 1 |
| `academia-{api,web}-5xx` | mais de 5 respostas 5xx em 5 min | 2 |
| `academia-excecoes` | mais de 3 exceções em 5 min | 2 |
| `academia-webhook-recusado` | 2 ou mais chamadas do webhook recusadas em 15 min | 2 |
| `academia-lentidao` | mais de 10 requisições da API acima de 3 s em 15 min | 3 |
| `academia-login-bloqueado` | mais de 20 `audit.auth.login_throttled` em 15 min | 3 |

Limiares são ponto de partida: ajuste depois de uma semana de tráfego real. **Valide as consultas no portal (Logs) assim que chegarem os primeiros dados**: o script cria os alertas sem validar a consulta (a tabela ainda não existe num recurso novo).

## Consultas úteis (Application Insights → Logs)

```kusto
// Taxa de erro e latência por rota (API)
requests | where cloud_RoleName == 'academia-api'
| summarize total = count(), falhas = countif(success == false), p95 = percentile(duration, 95) by name
| order by falhas desc

// Exceções recentes
exceptions | where timestamp > ago(24h)
| project timestamp, cloud_RoleName, type, outerMessage, route = tostring(customDimensions.route)
| order by timestamp desc

// Desfecho do webhook da The Members
customEvents | where name == 'webhook.themembers'
| summarize n = count() by result = tostring(customDimensions.result), status = tostring(customDimensions.status)

// Logins bloqueados / falhos por hora
customEvents | where name in ('audit.auth.login_failed', 'audit.auth.login_throttled')
| summarize n = count() by name, bin(timestamp, 1h)
```

## Quando um alerta dispara

1. **Saúde:** abra `https://<site>/healthz?deep=1` e `https://<api>/health`. 503 no `deep` com a API ok = o site não alcança a API (`API_ORIGIN`). 503 na API = banco (ver `docs/seguranca/operacao.md`). A verificação do App Service no site usa o `/healthz` simples, de propósito: assim uma queda da API não faz o Azure reiniciar o site.
2. **5xx / exceções:** consulta de exceções acima; `route` e `digest` levam ao ponto do erro. Se começou com um deploy, veja `docs/deploy-azure.md` (reverter a imagem).
3. **Webhook recusado:** `result` diz o motivo (`invalid_signature`, `not_configured`, `empty_body`…). A tela Webhooks do painel mostra o corpo bruto.
4. **Logins bloqueados:** consulte a tabela `audit_logs` (ações `auth.login_failed`/`auth.login_throttled`, com o IP; ainda não há tela para isso). Se for ataque, restrinja o acesso no Azure (Networking).

## Limites conhecidos

- Não há rastreio distribuído (o site não propaga o id de operação à API) nem coleta de dependências (MySQL).
- Erros do navegador não são capturados.
- Os logs em `stdout` seguem só no *Log stream* do App Service; para centralizá-los configure *Diagnostic settings* do Web App para o mesmo espaço de trabalho (não incluído no script).
- Sem teste contra um recurso real: o cliente foi validado com um serviço simulado e o comando `telemetry:check` serve para confirmar com o recurso de verdade.
