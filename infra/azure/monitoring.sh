#!/usr/bin/env bash
# Provisiona o monitoramento da Academia Beauty no Azure: Log Analytics + Application Insights, connection string nos
# dois Web Apps, verificação de saúde, grupo de ação (e-mail) e alertas.
#
# POR PADRÃO SÓ MOSTRA O QUE FARIA (simulação). Para executar de verdade: `./monitoring.sh --apply`.
# Idempotente: rodar de novo atualiza os mesmos recursos (create = criar ou atualizar).
#
# Requisitos: `az login` na assinatura certa e as extensões `application-insights` e `scheduled-query`
# (`az extension add -n application-insights -n scheduled-query`).
#
# Variáveis (padrões = ambiente descrito em docs/deploy-azure.md):
#   ALERT_EMAIL   obrigatório: quem recebe os alertas
#   RG, LOCATION, API_APP, WEB_APP, WORKSPACE, INSIGHTS
set -euo pipefail

APPLY=false
[ "${1:-}" = "--apply" ] && APPLY=true

RG="${RG:-SGC}"
LOCATION="${LOCATION:-eastus}"
API_APP="${API_APP:-academia-beauty-api}"
WEB_APP="${WEB_APP:-academia-beauty-web}"
WORKSPACE="${WORKSPACE:-academia-beauty-logs}"
INSIGHTS="${INSIGHTS:-academia-beauty-insights}"
ACTION_GROUP="${ACTION_GROUP:-academia-beauty-alertas}"
: "${ALERT_EMAIL:?defina ALERT_EMAIL (quem recebe os alertas)}"

run() {
  if $APPLY; then
    echo "+ ${*:1:7} …" # não imprime o restante (pode conter a connection string)
    "$@"
  else
    echo "[simulação] $*"
  fi
}

# `az ... -o tsv` em simulação devolve um marcador, para os comandos seguintes poderem ser mostrados.
capture() {
  if $APPLY; then "$@"; else echo "<id-simulado>"; fi
}

echo "== 1. Log Analytics e Application Insights (baseado em workspace)"
run az monitor log-analytics workspace create -g "$RG" -n "$WORKSPACE" -l "$LOCATION"
WORKSPACE_ID=$(capture az monitor log-analytics workspace show -g "$RG" -n "$WORKSPACE" --query id -o tsv)
run az monitor app-insights component create -g "$RG" -a "$INSIGHTS" -l "$LOCATION" --kind web --application-type web --workspace "$WORKSPACE_ID"
INSIGHTS_ID=$(capture az monitor app-insights component show -g "$RG" -a "$INSIGHTS" --query id -o tsv)
CONNECTION_STRING=$(capture az monitor app-insights component show -g "$RG" -a "$INSIGHTS" --query connectionString -o tsv)

echo "== 2. Connection string nos dois apps (uma variável por vez: NÃO use --settings @arquivo, ver handoff)"
for app in "$API_APP" "$WEB_APP"; do
  run az webapp config appsettings set -g "$RG" -n "$app" --settings "APPLICATIONINSIGHTS_CONNECTION_STRING=$CONNECTION_STRING" --output none
done

echo "== 3. Verificação de saúde do App Service (instância que não responde é retirada/reiniciada; por isso o site usa o /healthz simples, sem depender da API)"
run az webapp config set -g "$RG" -n "$API_APP" --generic-configurations '{"healthCheckPath": "/health"}' --output none
run az webapp config set -g "$RG" -n "$WEB_APP" --generic-configurations '{"healthCheckPath": "/healthz"}' --output none

echo "== 4. Grupo de ação (e-mail)"
run az monitor action-group create -g "$RG" -n "$ACTION_GROUP" --short-name academia --action email responsavel "$ALERT_EMAIL"
AG_ID=$(capture az monitor action-group show -g "$RG" -n "$ACTION_GROUP" --query id -o tsv)

echo "== 5. Alertas de métrica (plataforma)"
for pair in "api:$API_APP" "web:$WEB_APP"; do
  tag="${pair%%:*}"; app="${pair#*:}"
  app_id=$(capture az webapp show -g "$RG" -n "$app" --query id -o tsv)
  run az monitor metrics alert create -g "$RG" -n "academia-$tag-5xx" --scopes "$app_id" --condition "total Http5xx > 5" \
    --window-size 5m --evaluation-frequency 1m --severity 2 --action "$AG_ID" --description "Mais de 5 respostas 5xx em 5 minutos ($app)"
  run az monitor metrics alert create -g "$RG" -n "academia-$tag-saude" --scopes "$app_id" --condition "avg HealthCheckStatus < 100" \
    --window-size 5m --evaluation-frequency 1m --severity 1 --action "$AG_ID" --description "Verificação de saúde falhando ($app)"
done

echo "== 6. Alertas de consulta (Application Insights; mesmas consultas em docs/observabilidade.md)"
alert() { # nome, severidade, frequência/janela, consulta, limite, descrição
  run az monitor scheduled-query create -g "$RG" -n "$1" --scopes "$INSIGHTS_ID" --severity "$2" \
    --evaluation-frequency "$3" --window-duration "$3" --action-groups "$AG_ID" \
    --condition "count 'q1' > $5" --condition-query q1="$4" --description "$6" --skip-query-validation true
}
alert academia-excecoes 2 5m "exceptions" 3 "Mais de 3 exceções em 5 minutos (API ou site)"
alert academia-lentidao 3 15m "requests | where cloud_RoleName == 'academia-api' and duration > 3000" 10 "Mais de 10 requisições da API acima de 3 s em 15 minutos"
alert academia-login-bloqueado 3 15m "customEvents | where name == 'audit.auth.login_throttled'" 20 "Pico de logins bloqueados (possível tentativa de invasão)"
alert academia-webhook-recusado 2 15m "customEvents | where name == 'webhook.themembers' | where tostring(customDimensions.result) !in ('accepted','duplicate')" 2 "Webhook da The Members recusado (assinatura, configuração ou corpo inválido)"

echo
$APPLY && echo "Pronto. Confira: az monitor app-insights component show -g $RG -a $INSIGHTS. Depois rode no servidor da API: node ace telemetry:check" \
  || echo "Simulação concluída. Nada foi criado. Para executar: ALERT_EMAIL=voce@exemplo.com ./monitoring.sh --apply"
