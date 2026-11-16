# Editor visual como único lugar de edição (profissional e curso)

Status: **F1–F3 concluídas e F4 parcial** (2026-11-16). Aprovado pelo usuário ("implementar"); decisão D-039. Falta: E2E (ver handoff.md).

## Objetivo
Publicar e completar profissionais e cursos sem sair do editor visual. Ao clicar em **Publicar** com pendências,
o editor leva à seção da página onde o item falta e foca o campo; o usuário preenche ali e publica.
O "modo cadastro" (assistente/formulário em `/admin/profissionais/:id` e `/admin/cursos/:id`) deixa de existir no painel.

## Situação atual (código)
- Dois lugares guardam conteúdo: `data` (cadastro, `professionalDataSchema`/`courseDataSchema`) e `document`
  (página do editor, D-020). O documento é semeado de `build*Document(data)` na 1ª edição; depois, editar um não altera o outro.
- A publicação valida **só `data`** (`publishReadiness`, `courseReadiness`, `commercialReadiness`).
  Preencher "O que você recebe" na página não resolve a pendência `deliverables`.
- Com pendência, o editor redireciona para `registryHref?pendencias=1` (`editor.tsx` → `publish`).
- O editor já sabe selecionar seção e focar campo (`pendingFocus` + `data-field-path`).
- `data` também alimenta o que **não é seção da página**: nome e slug, especialidade, foto do cartão da Home,
  cards de cursos, SEO/JSON-LD (Fase 8A), página do curso (retrato e anos do instrutor), vitrine, modelo da página.
  Oferta/checkout já tem tela no editor (`checkout-settings.tsx`).

## Abordagem proposta
1. **Campos de conteúdo moram nas seções.** Cada pendência é mapeada para (seção, campo) do documento.
   Ao salvar, o editor também grava o valor no cadastro (`data`), por um mapeamento único e testado
   (`page-renderer`: documento → campos de `data`). Assim SEO, cards, vitrine e página do curso continuam
   lendo `data` sem mudança, e a regra de publicação fica a mesma.
2. **O que não é seção vai para um painel "Configurações da página" dentro do editor**: nome, endereço (slug),
   especialidade, Instagram, foto do cartão da Home, descrição para buscadores, vitrine, modelo;
   no curso: título, endereço, profissional, oferta/checkout (reaproveita `CheckoutSettings`).
3. **Publicar com pendência**: lista as pendências no editor; clicar em uma seleciona a seção (ou abre o painel de
   configurações) e foca o campo. Sem redirecionar.
4. **Criar** profissional/curso: o "Novo" pede só o mínimo (nome/título e endereço) e abre direto no editor.
5. **Remover** os assistentes (`wizard.tsx`, `form-model.ts`, rotas `[id]` e `novo` de cadastro) e o botão
   "Restaurar do cadastro"; listas passam a abrir o editor. Links antigos `/admin/profissionais/:id` redirecionam ao editor.

## Fases (cada uma só com autorização)
- **F1 — Mapeamento e decisões**: tabela pendência → (seção, campo) para profissional e curso; definir o que vai
  para "Configurações da página"; registrar decisão (substitui o trade-off de D-020). Critério: tabela aprovada.
- **F2 — Sincronização documento → cadastro**: função pura + testes; salvar do editor atualiza `data` na mesma operação
  (API, com revisão/concorrência e auditoria). Critério: testes de ida e volta; publicar valida o que está na página.
- **F3 — Pendências no editor**: painel de pendências, navegação até seção/campo, painel "Configurações da página".
  Critério: publicar um profissional e um curso incompletos só pelo editor, conferido na tela renderizada.
- **F4 — Criação direta no editor e remoção do cadastro**: "Novo" mínimo, redirecionamentos, remoção dos assistentes,
  testes E2E ajustados. Critério: nenhum caminho do painel leva ao cadastro; typecheck, testes e E2E verdes.
- **F5 — Validação e review-context**.

## Riscos
- Documentos já personalizados podem divergir do `data` atual: na F2, decidir qual vale na primeira sincronização
  (proposta: o documento, que é o que o site mostra).
- Campos derivados com formatação (ex.: anos "15 anos" no selo do hero) precisam de campo estruturado na seção,
  não texto livre, para virar `experienceYears`.
- Mudança visual relevante no painel: exige aprovação explícita (CLAUDE.md).

## Decisões tomadas
1. Abordagem aprovada: a seção grava no cadastro (regra de publicação inalterada). Quando página e cadastro divergem, vale a página.
2. Home fora do escopo (já é só documento).
3. Trabalhos e vídeo também sincronizados (sem isso, trocar o modelo perderia o que foi editado na página).
4. Curso: publicar devolve todas as pendências juntas, inclusive profissional não publicado e sandbox em produção.
