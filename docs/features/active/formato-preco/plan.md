# Formato de exibição do preço do curso

**Objetivo:** cada curso escolhe como o valor aparece, em todo lugar que mostra o preço daquele curso: página do curso (hero, oferta), resumo do checkout e cards (página do profissional e Home).

**Formatos** (`priceDisplay`, campo novo da oferta; padrão `full` = comportamento atual, sem mudança visual para cursos existentes):
- `full` — "de R$ X por R$ Y" + selo "N% OFF" (como hoje)
- `from_to` — "de R$ X por R$ Y", sem selo
- `percent_off` — selo "N% OFF" + valor final, sem o preço riscado
- `standard` — só o valor final (preço padrão), sem destacar desconto

Sem desconto (0%), todos mostram só o valor final.

**Onde configurar:** etapa 4 do cadastro (Oferta e checkout) e aba Avançado das seções Oferta/Finalização do editor (`checkout-settings.tsx`); ambos gravam em `PUT /admin/courses/:id/commercial`. Exige `commerce.manage`.

## Fases
1. **Modelo e API** — migração `price_display`, contrato (`priceDisplay` em `commercialInputSchema`/`computedOfferSchema`, ausente = `full`), `PUT /commercial`, snapshot da oferta, cards (`courseCardSchema`, `homeCourseCardSchema`) com `listCents`/`totalCents`/`discountPct`/`priceDisplay`. Testes de API e contratos.
2. **Renderer** — helper único de texto de preço por formato; página do curso (hero e oferta), resumo do checkout e cards do profissional e da Home (itens de seção ganham `priceOld`/`price`, opcionais).
3. **Painel** — seletor "Como mostrar o preço" no wizard e na aba Avançado, com prévia ao vivo; conferir telas renderizadas (1440/390 px).

**Aceite:** curso existente não muda de aparência; trocar o formato muda página, checkout e cards depois de republicar; testes e typecheck passam; telas conferidas.
**Decisão:** o formato vai no snapshot publicado junto com a oferta (publicar aplica); o painel avisa que a mudança só aparece no site depois de publicar.

## Decisão posterior (2026-10-21): campos por formato e preço final digitado
O usuário quis digitar os valores direto, com o campo certo aparecendo conforme o formato: **De/Por** (e Completo) → "De" e "Por"; **% OFF** → preço de tabela e %; **Preço padrão** → um preço. Para o "por" aceitar qualquer valor (ex.: de 297 por 197 = 33,67%), a oferta ganhou `final_cents` (migração `1792240700002`, `finalCents` no contrato). Com `finalCents` ele manda no total e `discount_pct` guarda só o % arredondado (selo). A API recusa "por" maior que "de" e desconto acima de 90%; "por" igual ao "de" = sem desconto. Ao trocar de formato os valores já digitados são levados (ex.: de 200 por 150 → % OFF abre com 25%). Lógica pura em `apps/web/src/lib/price-form.ts` (testada), campos em `components/price-fields.tsx` (wizard e aba Avançado do editor).

## Estado (2026-10-21)
Fases 1–3 implementadas e validadas; **nada commitado**. Migrações `1792240700001` e `1792240700002` aplicadas no MySQL local (ofertas existentes ficaram em `full`, sem `final_cents`).
- Testes: API 211, contratos 37, page-renderer 148, web 116, section-schemas 10, editor-core 22; typecheck e lint sem erros.
- Telas conferidas (1440/390 px): os 4 formatos no wizard (campos por formato, valores levados na troca, mensagens de erro), pré-visualização da página do curso e do card do profissional (a página pública tem cache de 300 s, invalidado na publicação).
- Não verificado: aba Avançado do editor com os campos novos (mesmo componente do wizard), resumo do checkout da Academia (`provider=academia`) com `standard`, Home com desconto.
- Pendente: commit/PR; produção precisa rodar `node ace migration:run --force` (`docs/deploy-azure.md`).
