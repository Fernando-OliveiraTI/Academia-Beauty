# Decisões — Academia Beauty Platform

## D-001 — Projeto novo em `~/Academia Beauty` (2026-10-17)
Decisão do usuário: começar do zero nesta pasta. O monorepo `~/Academia` (Next.js + AdonisJS, 4 migrations, esqueleto de editor, `docs/primeira-entrega-arquitetura.md` de 2026-10-15) **não** é a base. Pode ser consultado como referência de ideias, sem ser dependência.

## D-002 — Referências oficiais (2026-10-17)
Os caminhos do briefing não existem como escritos (`~/Downloads/site_academia/` não existe). Mapeamento confirmado:
- Home: `~/Downloads/Site_Academila/Home.html`
- Profissional: `~/Downloads/Site_Academila/Lukas_20.html`
- Curso: `~/Downloads/pagina-navalha/index.html` (+ `css/`, `js/`, `assets/`)
Há cópia idêntica de `Site_Academila` em `~/Academia/Site_Academila`. Os originais não são alterados.

## D-003 — Fidelidade visual com código limpo (2026-10-17)
Reproduzir fielmente layout, animações e interações. Não migrar código Shopify, telemetria, URLs `file://` nem patches CSS obsoletos que não afetem o visual. Qualquer diferença visual inevitável é apontada antes de ser aplicada.

## D-004 — Respostas às pendências da Fase 1 (2026-10-17)
1. Marca: **Academia Beauty**. "Carreira Beauty" deixa de ser usada como nome de marca (a confirmar onde aparece em alt/copy).
2. Fonte da Home: **manter o fallback atual** (sem Gilroy).
3. Defeitos da Home (h1 do hero no mobile, "Marcas" cortado, card órfão no tablet): **corrigir sem desconfigurar o layout aprovado**. Em desktop (>=1280) nada muda; correções só nos breakpoints afetados, listadas e mostradas antes/depois.
4. Canvas "boost" do profissional: **corrigir o bug mantendo o mesmo visual** (referência: o quadro estático atual como baseline do resultado). Pausa fora da viewport/aba oculta e reduced-motion no ticker seguem a mesma regra "mesmo visual".
5. Gap/ordem/estado vazio dos cards de curso: **ajustar** (valores a propor no baseline, sem alterar o card em si).
6. Ativos ausentes e vídeo: **ajustar** (tratamento de placeholder/otimização a propor; arquivos reais a fornecer depois).
7-10. Conteúdo comercial, The Members, storage/CDN/domínio e papéis/MFA: **"OK"**, tratado como "seguir com os padrões do plano; não bloqueia o início". Nenhum endpoint da The Members será presumido: só Modo A (redirecionamento) até haver documentação.

Interpretação a confirmar: "OK" não é aprovação de fase. Nenhuma fase foi autorizada ainda.

## D-005 — Versões e ambiente (2026-10-17)
Node do ambiente é 20.18.3; AdonisJS 7 e seus pacotes (shield 9, limiter 3) exigem Node 24. Adotado **AdonisJS 6.18 + shield 8 + limiter 2 + session 7 + auth 9** e **Next.js 16.4** (Node >= 20.9). Migrar para Adonis 7 exige Node 24 e fica como decisão futura.
Portas do projeto: MySQL **3317** e web **3100**, porque 3307 e 3000 já são usadas por outros projetos da máquina. API em 3333.

## D-006 — Identidade e sessão (2026-10-17)
- Sessão **no servidor** (tabela `sessions`), não em cookie, para que logout e desativação revoguem acesso de fato. Cookie HttpOnly, SameSite=Lax, `secure` em produção.
- CSRF por token XSRF (shield); o navegador fala só com a origem do web, e `/api/*` é proxy para a API (cookies first-party, sem CORS).
- Permissões vivem em `@academia/contracts` (matriz papel→permissões, fonte única para API e web). O banco guarda só `roles` e `user_roles`; **não** há tabelas `permissions`/`role_permissions` (simplificação em relação ao rascunho do plano; revisitar se o cliente exigir permissões editáveis).
- Rate limit de login com store `database` (MySQL) para não exigir Redis agora; Redis fica para quando houver necessidade comprovada.
- Estruturas de catálogo, CMS, mídia e comércio **não** foram criadas na Fase 1: entram nas fases que as usam (3 a 7), evitando modelagem prematura.

## D-007 — Baseline visual (2026-10-17)
Home e Profissional têm canvases e animações em loop: pixel exato não é reproduzível entre execuções. A comparação da Fase 2 deve mascarar a camada de efeitos e usar as métricas de seção (posição/tamanho, determinísticas) como verificação principal. Curso é idêntico pixel a pixel entre execuções.

## D-008 — Fase 2 em sub-fases (2026-10-17)
Autorizada pelo usuário ("seguir para fase 2"). Executada em 2A Curso, 2B Profissional, 2C Home, 2D consolidação, começando pelo Curso por ser a única página reproduzível em pixel (D-007). Mesma estratégia nas três: CSS final medido/portado, componentes React, comparação com o baseline.

## D-009 — Checkout na Fase 2 (2026-10-17)
O checkout do protótipo é um mock de pagamento. Na Fase 2 ele é **apresentação fiel** (resumo, etapas, campos, métodos) com a etapa 1 funcional (máscaras, validação de nome/e-mail/CPF/celular, mesmos textos). A etapa 2 **não lê, valida nem envia** dados de cartão e o botão "Finalizar compra" apenas informa que o pagamento não está disponível. Sem etapa 3, QR fake, gateway mock nem tokenização. O fluxo real (Modo A, redirecionamento) é da Fase 4. Detalhes em `analysis/03-curso.md` seção 7.7.

## D-010 — CSS, fontes e isolamento (2026-10-17)
- `course.css` = `style.css` original com todos os seletores prefixados por `.pg-course` (script determinístico), keyframes renomeados `course-*`, blocos de resultado de pagamento e CSS morto removidos, e estilos que eram inline convertidos em classes. Tokens vêm só do design-system.
- Classes genéricas do painel (`.eyebrow`, `.card`) foram renomeadas para `admin-eyebrow`/`admin-card`: o `font:` shorthand do `.eyebrow` do painel vazava para o template e mudava line-height (defeito achado pelo teste visual).
- Geist e Geist Mono (OFL) hospedadas em `apps/web/public/fonts` (variável). Diferença conhecida: os pesos 550/650 do CSS agora renderizam de fato (o Google Fonts do original só entregava pesos discretos).
- Capa do produto: SVG local em vez da imagem remota da Shopify (D-004 item 6). Foto do instrutor ausente: aparece só o monograma, como no original sem o arquivo.

## D-011 — Preço fora do documento (2026-10-17)
O documento da página guarda só copy. Preço, desconto e parcelas entram no renderer por `OfferView` (centavos, vindos do backend). Enquanto não há backend de comércio, `apps/web/src/lib/fixtures.ts` fornece a oferta de exemplo (R$ 250,00, 30%, 6x). Textos como "30% de desconto" no título da oferta e "7 dias de garantia" continuam sendo **copy** do template aprovado: precisam ser revisados com o negócio quando a oferta for dinâmica (ver `analysis/03-curso.md` 1.3).

## D-012 — Método de comparação visual (2026-10-17)
`pnpm --filter @academia/visual-baseline compare <pagina>` abre a rota migrada, repete o procedimento do baseline e compara seção a seção (tolerância 2 px) e em pixels (pixelmatch). O baseline foi capturado **sem** Geist (Google Fonts bloqueado), então por padrão a comparação bloqueia `/fonts/*` para usar a mesma fonte de reserva; `--real-fonts` gera as capturas com Geist para revisão visual.

## D-013 — CSS efetivo por extração (2026-10-17)
Para Profissional (6 patches `!important`) e Home (139 blocos `<style>`) o CSS não é reescrito à mão: `pnpm --filter @academia/visual-baseline extract-css <pagina> --scope <classe> --kf <prefixo> --out <arquivo>` lê o CSSOM da página real no Chrome, descarta regras sem elemento alvo, descarta declarações que nunca vencem (mesmo seletor/@media sobrescrito depois), prefixa os seletores com o wrapper (`.pg-pro`, `.pg-home`), renomeia keyframes e troca `overflow-x:hidden` do `<body>` por `clip`. A cascata e os `!important` restantes são preservados (consolidá-los é opcional, na 2D). Ajustes manuais ficam em `*.extra.css`, importados depois. O wrapper zera o que o `body` do painel herdaria (`line-height`, `font-size`): defeito achado pelo teste visual.

## D-014 — Correções do Profissional (2026-10-17, aplicando D-004 itens 4 e 5)
- Canvas "boost": o `ReferenceError` (`reduce` × `reduced`) foi corrigido e a camada **anima** como o código pretendia; mesmo número de partículas, mesmas cores e densidade do quadro estático. **A confirmar**: se o usuário quiser a camada estática, basta desenhar um único quadro (`createBoostLayer`).
- Os três canvas rodam num único loop `requestAnimationFrame` que **pausa** fora da viewport (IntersectionObserver) e com a aba oculta; os loops CSS do hero pausam via classe `is-offscreen`. Redimensionamento via ResizeObserver. Com reduced-motion: um quadro estático, ticker parado.
- Cursos (D-004 item 5, **proposta a aprovar**): espaçamento de 20px entre cards (mesmo gap da galeria de trabalhos), ordem pela lista publicada, estado vazio = a seção não é renderizada. Com 1 card nada muda.
- Marca: "Carreira Beauty" → "Academia Beauty" no nav, eyebrow e ticker (mesmo número de caracteres: o layout não muda).
- Vídeo: `autoplay` removido (sem `muted` os navegadores já bloqueavam: comportamento visível igual). `video.mp4` (28,6 MB, QuickTime) segue como está; otimização/hospedagem a propor (D-004 item 6).
- Link do Instagram corrigido de `instagram.com/@lucascam` para `instagram.com/lucascam` e com `rel="noopener"`. O link do curso aponta para `/preview/curso`, não para a loja Shopify.
- **Mantido como no original, a confirmar com o negócio**: grafia "Lucas Kampos" no texto da bio × "Lukas Campos" no resto; a tag "30% OFF" do card (virá do catálogo na Fase 4).

## D-015 — Home (2026-10-17)
- Mesma estratégia do Profissional (D-013): CSS extraído (1.402 regras → 724 mantidas, 511 declarações mortas removidas), wrapper `.pg-home`, e `:root`/`html` mapeados para o próprio `<html>` (a regra `html{font-size:calc(var(--font-body-scale)*62.5%)}` precisa ler as variáveis: base do `rem` = 10px, como no original).
- Efeitos do hero (boldfx, ribbons, energy, telemetria + video-style) viram componentes client-only com valores aleatórios gerados após a montagem. O parallax do mouse só roda `requestAnimationFrame` enquanto há movimento a assentar (o original mantinha o loop para sempre). Os 3 canvas reutilizam o código do Profissional (`fx/`); na Home o boost sempre animou (lá `reduced` estava certo). Todos pausam fora da viewport/aba oculta (D-004 item 4).
- Marca: texto "Carreira Beauty" → "Academia Beauty" (alt do hero, parágrafo de Benefícios). A palavra decorativa **CARREIRA** do CTA ("virar carreira") foi mantida: é o termo, não a marca. O bloco do rodapé que o CSS esconde (`.cb-footer-top/bottom`, com "Carreira Beauty") **não foi migrado**.
- Slider de profissionais: mesmo comportamento (setas, snap, autoplay de 4 s que rebobina) com limpeza ao desmontar. Acréscimos de acessibilidade: pausa com foco de teclado (`:focus-visible`), com aba oculta e com reduced-motion. A lista vem do documento (qualquer quantidade; sem itens a seção some).
- Links `file://`/Shopify reescritos: Lukas → `/preview/profissional`; demais profissionais → `/profissionais/<slug>` e cursos → `/cursos/<slug>` (rotas que nascem nas Fases 3 e 4; hoje 404); âncoras internas com `#id`; "Acessar conta" ficou `#` até a definição do login público. O slug do curso 1 foi normalizado para o título (o original usava `tecnica-da-navalha-moderna`): **confirmar**.
- Camadas escondidas pelos patches (`cb-noise`, `cb-orb`, `cb-lettering`, `cb-scanline`) continuam no DOM para o CSS extraído seguir válido; podem ser removidas na 2D junto com as regras que as tocam.

## D-016 — Correções da Home (2026-10-17, D-004 item 3; **valores a aprovar**)
Todas em `home.extra.css`, só abaixo de 1000px (1440 e 1280 inalterados), desligáveis com `html[data-baseline]`. Antes/depois em `review/home-fixes/`.
1. **h1 do hero**: um patch antigo fazia o título crescer ao estreitar (38,5px a 900 → 76,8px a 768, 62 a 620, 58 a 390). Passa a `clamp(34px, 5.2vw, 38.5px)` em ≤899px (900px e acima não mudam).
2. **Marcas**: título `nowrap` e parágrafo de largura fixa estouravam a tela em ≤900px (parágrafo também a 999px). Passam a quebrar linha.
3. **Card órfão**: com 2 colunas e 3 itens, o último ocupa a linha inteira (Cursos 721–1024px, Benefícios 681–999px).

## D-017 — Fase 3: modelo de profissionais e publicação (2026-10-17)
Autorizada pelo usuário ("seguir próxima fase"). Desvios conscientes do plano.md §4, **a confirmar**:
- **Rascunho = linha de `professionals` (`data` JSON + `revision`)**; cada publicação grava um **snapshot imutável** do `data` em `professional_versions` (com `template_key/version`). O site lê só o snapshot da versão vigente (`published_version`). Despublicar/arquivar zera a versão vigente e preserva o histórico.
- O snapshot guarda **dados validados, não HTML nem o documento montado**: `buildProfessionalDocument(data)` (função pura em `page-renderer`) monta o documento sobre o template na hora de renderizar. Motivo: a API não precisa importar React/renderer, e o schema do documento continua sendo validado pelo `PageRenderer`. Consequência: mudar o template (versão) altera páginas já publicadas; o editor visual (Fase 5) introduz documentos próprios por página.
- Trabalhos e parágrafos ficam em JSON no próprio `data`, não em tabelas (`professional_works`, certificações, redes sociais): simplicidade enquanto não há consulta por esses itens. Reavaliar na Fase 5/7.
- `pages`/`page_drafts`/`page_versions` genéricos **não** foram criados agora (entram com o CMS, Fase 5/7).
- Concorrência otimista: `PUT` exige `revision`; divergente → 409. Slug único, imutável depois da primeira publicação; slugs reservados (`admin`, `api`, `preview`, `cursos`, `profissionais`, `novo`).
- Publicar exige cadastro completo (`publishReadiness`, mesma regra no assistente e no servidor). Rascunho pode ser salvo incompleto (só nome e especialidade obrigatórios).
- Permissões: `professionals.read/write/publish` (já existiam). Vitrine da Home (`home_visible`, `home_order`), publicar, despublicar, arquivar e restaurar exigem `publish`. Tudo auditado (`professional.*`).
- **Agendamento de publicação** (plan.md §7) e exclusão definitiva ficam fora: só arquivar. Imagens/vídeo ainda são **URLs** (`/site/...` ou `https://`): upload entra com mídia (Fase 7).
- Vitrine: no máximo 24 itens (limite do schema da Home); ordem `home_order`, depois nome.

## D-018 — Rotas públicas e cache (2026-10-17)
- `/profissionais/[slug]` e `/` (Home com vitrine real) passam a existir; `/` deixou de ser o placeholder. **Continuam `noindex`** (layout raiz) até a Fase 8. Os cursos da Home seguem estáticos (links `/cursos/*` ainda 404 até a Fase 4). **A confirmar**: expor `/` publicamente já agora, ou manter só `/preview/home` até a Fase 7.
- Cache: `fetch(..., { cache: 'force-cache', next: { tags, revalidate: 300 } })`. O `force-cache` é obrigatório (sem ele páginas dinâmicas não cacheiam e a tag não faz efeito). A API avisa `POST /internal/revalidate` do web (segredo compartilhado `REVALIDATE_SECRET` ≥ 24 caracteres, comparação em tempo constante) com `revalidateTag(tag, { expire: 0 })`: **`'max'` serviria conteúdo antigo na primeira visita** (verificado). Falha na invalidação não desfaz a publicação; o `revalidate` de 300 s corrige sozinho.
- Tags: `professionals` (vitrine) e `professional:{slug}`.
- Pré-visualização do rascunho: `/admin/preview/profissionais/[id]` (exige sessão com `professionals.read`; mostra o que falta se o cadastro estiver incompleto, pois o renderer recusa documentos inválidos).
- O body parser JSON do Adonis passou a **não** converter `""` em `null` (`convertEmptyStringsToNull: false`): quebrava os campos opcionais vazios do assistente.
- Seed de desenvolvimento (`professionals_seeder`): Lukas Campos publicado (conteúdo da página aprovada, incluindo a grafia ainda pendente) e os outros 4 da Home como rascunho com só nome e foto (`specialty: 'A definir'`), pois não há dados reais deles.

## D-019 — Fase 4: cursos e comércio, Modo A (2026-10-17; texto redigido na revisão, a confirmar)
Registrada depois da implementação (estava só no handoff). Valores ainda a confirmar com o negócio:
- **Oferta dentro do snapshot**: a publicação grava conteúdo + oferta; preço/parcelas só mudam ao republicar. Exceção (D-022): **pausar vendas** (`active=false`) vale na hora na página pública, sem republicar; o preço continua o do snapshot.
- **Parcela arredondada para baixo** (29,16 × 29,17 do protótipo) e parcela mínima de R$ 5,00.
- **`commerce.manage` só do papel admin**: editor escreve e publica o curso, mas não altera preço nem link de checkout.
- **Curso só publica com profissional publicado**; a leitura pública confere de novo (despublicar o profissional tira os cursos do ar).
- **Modo A (redirecionamento)**: o link precisa ser `https` de domínio de `CHECKOUT_ALLOWED_HOSTS`; validado na escrita, na publicação e na leitura pública. Desde D-022 a lista vale para o **host exato**; subdomínios exigem curinga explícito (`*.dominio.com`).
- Home de cursos segue estática até a Fase 7; conteúdo comercial do curso 1 (garantia, FAQ, depoimentos, "30% de desconto", link real) depende do negócio.

## D-020 — Fase 5: documento próprio por página (2026-10-17; **a aprovar antes da 5B**)
Autorizada pelo usuário (opção "b"). Troca o modelo de D-017 (documento derivado de `data`) por documento editável, de forma retrocompatível:
- **`document` nulo = comportamento atual** (`build*Document(data)`). Nada muda para páginas já publicadas até alguém editar no editor.
- Ao editar pela primeira vez, o documento é semeado de `build*Document(data)` e passa a ser gravado em `professionals.document` / `courses.document` (JSON, com `document_revision` para concorrência otimista). Cada publicação grava o documento no snapshot imutável (`*_versions.document`).
- **Partes dinâmicas continuam do catálogo**, não do documento: cards de cursos do profissional, oferta/preço do curso e vitrine da Home são reinjetados na renderização (`refreshDynamic`), então preço e cursos publicados nunca ficam congelados no JSON editado.
- **Trade-off assumido**: depois de personalizada no editor, edições do assistente (`data`) não alteram as seções do documento. A UI avisa e oferece "Restaurar do cadastro" (descarta o documento). Alternativa descartada: overrides parciais sobre `build(data)` (merge profundo frágil, difícil de validar e de desfazer).
- O editor só opera sobre seções do registry; sem HTML/CSS/JS livre. Documento sempre validado por `parsePageDocument` no cliente (UX) e no servidor (autoridade).
- Regras de edição ficam em `packages/editor-core` (puro, sem React): seções únicas (nav, hero, footer…), mover só dentro da mesma região do template, limite de histórico.
- Fora da 5: upload de mídia (Fase 7), agendamento, edição colaborativa em tempo real (só detecção de conflito por revisão).

## D-021 — Fase 5: implementação do editor (2026-10-17)
Aprovada D-020 pelo usuário. Decisões de implementação, a confirmar na revisão:
- **Pacote `@academia/section-schemas`** (compilado em `dist`, como o contracts): schemas Zod das seções, catálogo (`SECTION_META`: tipo, rótulo, região, obrigatória), `validatePageDocument` e `editorRules`. Motivo: a API só consome pacotes compilados e não pode importar React; assim a validação autoritativa no servidor e o editor usam a mesma fonte. `page-renderer` reexporta os schemas (imports antigos intactos) e um teste garante que catálogo e registry de componentes cobrem os mesmos tipos/regiões. `@academia/page-schema` passou a ser compilado (`dist`) pelo mesmo motivo.
- **Todas as seções são únicas** (sem duplicar): os componentes têm âncoras/ids fixos (`#trabalhos`, `#cursos`…). Obrigatórias: `*.hero` e `course.offer`. Mover só dentro da mesma região do template (topo/conteúdo/rodapé/flutuante). "Adicionar" reinsere uma seção removida, com conteúdo derivado do cadastro atual.
- **Seções dinâmicas**: a visibilidade de `professional.courses` é definida pelo catálogo (só aparece se houver cursos publicados) e o editor mostra "automática". Preço, parcelas e link de checkout nunca estão no documento (`ctx.offer`/`ctx.checkout`).
- **API**: `GET/PUT/DELETE /admin/{professionals,courses}/:id/document`, `GET .../document/versions`, `POST .../document/versions/:v/restore`. Permissões `*.read` para ler e `*.write` para gravar/restaurar (publicar segue `*.publish`). Restaurar versão devolve ao rascunho cadastro **e** documento (a oferta do curso não é restaurada). Gravar o documento só muda o rascunho: não invalida cache. Auditoria `*.document.save|reset|restore_version` sem o conteúdo.
- **Pré-visualização**: iframe same-origin `/admin/preview/{profissionais,cursos}/:id/live` com `postMessage` (origem e `source` verificados, documento validado antes de renderizar). **CSP**: `frame-ancestors 'self'` e `X-Frame-Options: SAMEORIGIN` somente nessas duas rotas; todo o resto segue `'none'`/`DENY`.
- **Autosave** com debounce de 1,2 s, só de documento válido; conflito (409) bloqueia o salvamento e pede recarga; `beforeunload` avisa se houver pendência. Desfazer/refazer agrupa a digitação (1 s) e vale por sessão (não persiste).
- **hasUnpublishedChanges** passa a considerar `document_revision` vs `published_document_revision`.

## D-022 — Correções da revisão independente das Fases 0–5 (2026-10-17, autorizadas pelo usuário)
Relatório: `review/review-fases-0-5.md`. Respostas do usuário: links externos **permitidos** (com `rel`), mídia **só `/site/`** até a Fase 7, API atrás de proxy com `TRUSTED_PROXIES`.
- **Documento validado no servidor como no editor**: seção obrigatória presente, cada tipo no máximo uma vez, `settings` vazio estrito, variante `[a-z0-9-]`, teto de 512 KB e profundidade 12; revalidado ao **publicar** (profissional e curso).
- **URLs**: sem espaço/controle/barra invertida (`/\host` e tab/LF eram contornos de `//host`); **mídia** (imagem, vídeo, logo, capa) aceita só caminho interno `/site/...` (contracts e section-schemas). Links externos `https` seguem permitidos nos links do documento; cada salvamento audita os **hosts externos** linkados.
- **Builders cortam texto no limite do schema** (`clip`), alinhados ao contrato; teste com todos os campos no máximo.
- **Renderer**: menu do curso só aceita âncoras `#id`; checkout de demonstração não renderiza em curso real (Modo A); CTA respeita `tabIndex` e a barra fixa fica `inert` fora da tela; efeitos de "revelar" observam seções adicionadas depois (MutationObserver); reduced-motion cobre o hero do Profissional e a rolagem; chaves de lista incluem o índice; `TEMPLATES` por `Object.hasOwn`; imagens do slider/logos/cartões com `loading="lazy"`.
- **Editor**: autosave reescrito como hook testado (fila após salvamento em andamento, retry com espera crescente, 401/403/arquivado/conflito param e pedem ação, resposta perdida não vira falso conflito, publicar garante salvo antes); restauração de versão exige a revisão do cadastro; `SchemaForm` trata campos opcionais (limpar remove a chave; objeto opcional com adicionar/remover) e números (limites do schema; vazio não vira 0); assistentes avisam quando a página foi personalizada.
- **API**: `ER_DUP_ENTRY` → 409; auditoria nunca derruba a requisição; chave do limitador de login com hash; auditoria de falhas/bloqueios sem flood; `TRUSTED_PROXIES` (`trustProxy`); `debug` só em dev/teste; CORS sem refletir origem; allowlist de checkout por host exato; sandbox bloqueado em produção; pausar vendas imediato; `restoreVersion` confere `revision` do cadastro; `versions()` sem carregar JSON; segredo de revalidação < 24 caracteres é recusado com log.
- **Web**: `apiSend` nunca lança (status 0 em falha de rede); rotas públicas validam o formato do slug antes de chamar a API e usam ISR (`revalidate`); `error.tsx`; `getCurrentUser` com cache por requisição; `live-preview` só aceita o quadro pai.
- **Não feito / decisão pendente**: gatilhos de MySQL para imutabilidade dos snapshots exigem `SUPER`/`log_bin_trust_function_creators` (infra): mantida a imutabilidade por convenção da aplicação, testada; **migração do AdonisJS 6 → 7** (2 avisos moderados do `pnpm audit`) e `braces` (sem versão corrigida, só cadeia de build) pendentes de decisão; botão de pausa do autoplay do slider e dimensões de imagem (CLS) não alterados para não mudar o visual aprovado sem autorização; comparação por pixel agora aceita `--max-diff`, mas os limites reais dependem de nova rodada visual.

### D-022 — respostas do usuário às pendências (2026-10-17)
- **AdonisJS 6 → 7 e `braces`**: migrar **depois, se necessário**; nada a fazer agora.
- **Gatilhos MySQL de imutabilidade dos snapshots**: **deixar como está** (imutabilidade pela aplicação, testada).
- **Pausa do autoplay e dimensões de imagem (CLS)**: o usuário vai **verificar o visual antes** e avisa; não alterar até lá.
- **Comparação visual por pixel (`--max-diff`)**: será feita **em breve**, a pedido do usuário.

## D-023 — Aprovações e escopo da Fase 7 (2026-10-17)
Aprovadas pelo usuário, como estão: D-017, D-018, D-019, D-020, D-021 e a revisão independente (D-022). Ajustes virão após teste em tela.
Escopo da Fase 7 (aguarda autorização explícita para iniciar):
- Storage de mídia **local atrás de interface**; CDN depois (Fase 8). CSP abre ao host `MEDIA_CDN_HOST` (vazio = só mesmo domínio); schema de mídia aceita `/site/`, `/media/` e `https://` desse host (resolve M9).
- Inclui: 7A mídia (modelo, upload, derivados), 7B Home como documento + vitrine de cursos dinâmica, 7C templates adicionais (Autoridade, Vídeo, Conversão, Imersivo, Premium), 7D validação e review-context.
- Fora: agendamento de publicação.
- Git inicializado (branch `main`, remote `origin` = github.com/Fernando-OliveiraTI/Academia-Beauty); sem commit/push até autorização.

## D-024 — Fase 7A: biblioteca de mídia (2026-10-17)
- **Armazenamento local atrás da interface `MediaStorage`** (`apps/api/storage/media`, ou `MEDIA_STORAGE_PATH`); S3/R2 entra na Fase 8 implementando a mesma interface. Chaves geradas pelo servidor, validadas (`[a-z0-9/_.-]`, sem `..`) e conferidas contra a raiz.
- **Upload**: multipart em `POST /admin/media` (permissão `media.manage`, CSRF; bodyparser em modo manual só nessa rota). Tipo real pela assinatura (`file-type`), nunca pelo nome/`Content-Type`: JPG/PNG/WebP/AVIF até 15 MB e MP4/WebM até 60 MB; **SVG recusado** (pode ter script). QuickTime (`ftyp qt`, vídeos de celular e o `video.mp4` atual do site) entra como `video/mp4`. Imagem é decodificada por completo (corrompida/disfarçada falha), com limite de lado (12000 px) e de pixels (80 MP).
- **Derivados síncronos no envio** (sem fila: só admin, volume baixo): WebP e AVIF nas larguras 320/640/960/1440/2048, nunca maiores que a original. O **original fica guardado e nunca é servido** (evita vazar EXIF); vídeo é servido como enviado (**sem poster/transcodificação**: não há ffmpeg no ambiente; limitação registrada).
- **Entrega** `GET /media/:id[?w=]` (público, id imutável): derivado negociado por `Accept` (AVIF > WebP), menor largura ≥ `w`; `Cache-Control: public, max-age=31536000, immutable`, `nosniff`, ETag/304, `Range` para vídeo. O `force_json_response` agora preserva o `Accept` original em `x-original-accept`. O site repassa `/media/:id` à API por rewrite; `experimental.proxyClientMaxBodySize: 70mb` (padrão do Next cortava o corpo em 10 MB e derrubava o envio de vídeo).
- **Caminho de mídia no documento/cadastro** (`isSafeMediaPath`, fonte única em `page-schema`, reutilizada por `contracts`): `/site/...`, `/media/<id32hex>` ou `https://` **de host listado em `MEDIA_CDN_HOST`** (vírgula; vazio = nenhum). Fecha o M9: o CSP (`img-src`/`media-src`) abre ao mesmo host. API e site leem a mesma variável (o site a expõe ao navegador como `NEXT_PUBLIC_MEDIA_CDN_HOST`). Antes qualquer `/x` passava; agora só esses três formatos.
- **Uso calculado sob demanda, sem tabela `media_usages`** (desvio do plano.md): varre rascunhos e snapshots publicados vigentes de profissionais e cursos (e da Home, na 7B) atrás de `/media/<id>`. Evita tabela defasada em dezenas de pontos de escrita; custo irrelevante no volume do painel. Versões antigas (histórico) **não** bloqueiam exclusão: restaurar uma versão antiga pode mostrar imagem quebrada. Excluir arquivo em uso → 409 `in_use` com a lista.
- **Renderer**: `mediaSrc(src, largura)` acrescenta `?w=` às imagens da biblioteca (cartão de 96 px não baixa 3000 px); `/site` e CDN ficam como estão.
- **Editor/assistentes**: `MediaInput` (campo de texto + botão "Biblioteca" com seletor em `<dialog>`, envio direto e miniatura) em todos os campos `src` do `SchemaForm` e nos campos de imagem/vídeo dos assistentes de profissional e curso; escolher vídeo ajusta o `type` do `<source>`. Página `/admin/midia` (listar, enviar, ver usos, excluir com confirmação).
- Segurança: auditoria `media.upload`/`media.delete` sem conteúdo; nome do arquivo higienizado (sem caminho nem marcação); sem rate limit específico de envio (só sessão + permissão + limites de tamanho).

## D-025 — Fase 7B: Home como documento e vitrine de cursos dinâmica (2026-10-17)
- **Home = página única (`home_pages`, id 1) com `home_versions` imutáveis**, no mesmo formato de `professionals`/`professional_versions` para reaproveitar o `DocumentService` (`HOME_KIND`, `data` fixo `{"name":"Home"}`). `document` nulo = Home derivada do template original (comportamento anterior). A linha id 1 é criada pela migração **e sob demanda** (`ensureHomeRow`, `insert ignore`): sobrevive a `truncate`/restauração parcial.
- **API**: `GET /admin/home` (estado), `GET|PUT|DELETE /admin/home/document`, `GET /admin/home/document/versions`, `POST /admin/home/document/versions/:v/restore`, `POST /admin/home/publish`; permissões `pages.read|write|publish` (já existiam; editor tem as três, viewer só lê). `GET /public/home` devolve o documento publicado (ou nulo) e as vitrines atuais. Auditoria `home.publish`, `home.document.*`; publicar invalida as tags `home`, `professionals` e `courses`.
- **Partes dinâmicas continuam do catálogo** (como `professional.courses`): `home.professionals` e `home.courses` são reinjetadas em toda renderização (`resolveHomeDocument`) e só aparecem se houver itens; o editor mostra "automática" e não deixa ocultá-las. Cursos da vitrine = publicados, `showcase_visible` e de profissional publicado, com título/capa do snapshot (`CourseService.homeCards`, até 12). **Fim dos cartões estáticos/404**: os três cursos fixos do template deixaram de ser usados em `/`; com zero cursos publicados a seção some (decisão: preferível a link quebrado).
- **Site**: `/` lê `loadHome()`; um documento publicado que deixe de validar cai no template original (e vai ao log) em vez de derrubar a Home. Editor `/admin/editor/home` (mesmo `Editor`, `kind: 'home'`, "Restaurar padrão" no lugar de "Restaurar do cadastro"; restaurar versão não envia `dataRevision`); quadro `/admin/preview/home/live` com a mesma regra de CSP/`frame-ancestors` das outras prévias. Menu "Home" para quem tem `pages.read`.
- Uso de mídia (D-024) passou a incluir o rascunho e o snapshot vigente da Home.

## D-026 — Fase 7C: modelos adicionais de página do Profissional (2026-10-17)
- **Escopo**: "Autoridade, Vídeo, Conversão, Imersivo e Premium" foram implementados como **modelos de página do Profissional** (não de Curso nem de Home). Todos usam as seções `professional.*`; diferem em **composição** (quais seções e ordem), **textos padrão** (derivados do cadastro) e **tema visual** (`data-tpl` no wrapper `.pg-pro`, CSS em `professional.templates.css`; o Original não tem regras próprias, então o CSS aprovado ficou intocado).
- **Duas seções novas** no catálogo: `professional.stats` (Números: até 4 itens) e `professional.cta` (Chamada: botão para `#cursos` ou Instagram). Os números vêm só do cadastro (anos, seguidores, trabalhos, cursos publicados); item sem dado não aparece e, sem nenhum, a seção some. A chamada leva aos cursos se houver; senão ao Instagram; sem nenhum, some.
- Composição: Original (nav, hero, bio, trabalhos, vídeo, cursos, rodapé); **Autoridade** (números logo após o topo, depois bio); **Vídeo** (vídeo grande logo após o topo); **Conversão** (cursos e chamada escura logo após o topo); **Imersivo** (galeria de trabalhos grande e escura primeiro); **Premium** (preto e dourado, traço fino, números e chamada discreta).
- **Modelo por profissional**: coluna `professionals.template_key` (padrão `professional-original`); o snapshot já guardava `template_key`. Escolha no assistente (etapa Identidade, com "Ver exemplo" em `/preview/modelos/<key>`, rota pública `noindex` como as demais `/preview/*`). **Trocar de modelo só é possível enquanto a página não foi personalizada** (`document` nulo); depois, 422 `template_locked` ("Restaurar do cadastro" libera). O documento salvo/publicado precisa ter o `template.key` do profissional (422 caso contrário). Restaurar uma versão restaura também o modelo dela.
- Catálogo de modelos (chave, rótulo, descrição) em `@academia/section-schemas` (`PROFESSIONAL_TEMPLATES`); as chaves também estão em `@academia/contracts` e um teste garante que são iguais. Curso e Home seguem com um único modelo cada (não pedido).
- Pendente de decisão do negócio: rótulos/descrições dos modelos, se Curso e Home também ganham modelos, e remover/proteger `/preview/modelos/*` na Fase 8 (junto com `/preview/*`).

## D-027 — Instabilidade dos testes de API (2026-10-17)
- Os testes de API falhavam de forma intermitente na suíte inteira (FK em `user_roles`, cascata de falhas; ~1 em 6 execuções já na base da Fase 6). Causa: o `testUtils.db().truncate()` do Adonis dispara TRUNCATEs em conexões diferentes do pool e um deles podia correr durante o teste seguinte. `tests/helpers.ts` ganhou `truncateAll()` (uma conexão, sequencial, FK desligada só nela), usado pela suíte de concorrência. Antes: 1 falha em 6; depois: 8 execuções seguidas, 97/97. A orientação de "rodar uma suíte de API por vez" deixou de ser necessária.
- Também havia dois `bin/test.js` de sessões anteriores ainda vivos segurando conexões ao banco de teste; eram processos do ambiente, encerrados.

## D-028 — Checkout próprio do Curso (2026-10-17; 10A implementada, aguardando conferência em tela)
Decididas pelo usuário: (1) o botão final **redireciona ao link** de checkout do curso (Modo A), sem gravar dados do comprador no nosso banco; (2) **textos no editor** (`pages.write`); **preço, desconto, parcelas e link só `commerce.manage`** (admin), como em D-019; (3) **campos do comprador totalmente configuráveis**.
- Limites propostos para os campos (a confirmar): 1 a 8 campos; tipos `text`, `email`, `cpf`, `phone`; `id` único e estável por campo; rótulo/placeholder/ajuda com tamanho máximo; validação e máscara por tipo no cliente. Sem tipos livres (regex, HTML) para não abrir XSS nem ReDoS.
- **Dados do comprador em Modo A**: o formulário valida, mas, sem documentação do provedor, nada é enviado nem guardado (parâmetros de URL com dados pessoais não serão presumidos). Ou seja, até a Fase 6 o preenchimento serve para a experiência e para a Fase 6 enviar ao provedor; o provedor ainda pedirá os dados dele. Se o usuário quiser capturar leads, é outra decisão (LGPD, tabela, consentimento).
- Etapa 3 (Confirmação) não existe em redirecionamento: a confirmação acontece no provedor.
- Compatibilidade: `course.checkout` sobe para `schemaVersion` 2 com migração; documentos publicados e rascunhos antigos continuam válidos.
- **Aprovado pelo usuário**: dados do comprador descartados até a Fase 6; **3 etapas** (Dados → Pagamento → Confirmação). Em Modo A a etapa 2 só informa as formas de pagamento (sem campos de cartão) e a etapa 3 mostra o botão "Ir para o pagamento seguro" (link validado do curso; sem link = indisponível).
- **Implementação (diferente do proposto)**: sem alta de `schemaVersion` (a versão é global; subir quebraria as outras seções). Campos novos de `course.checkout` têm `.default()` (`CHECKOUT_DEFAULTS`) e `resolveCourseDocument` preenche documentos antigos. Campos do comprador: `buyerFields` (1 a 8; tipos `name|text|email|cpf|phone`; rótulo, exemplo, ajuda, obrigatório). Ids dos campos no DOM: `buyer-<índice>`.
- A seção Checkout agora é renderizada sempre que visível (antes sumia em Modo A e desalinhava a ligação seção↔preview do editor). O botão de compra rola até o checkout quando ele existe e, sem ele, vai direto ao link. Selo de garantia do checkout só diz "N dias de garantia" se o curso tem garantia.
- **Documentos de curso já salvos** com a seção Checkout oculta continuam ocultos até ligar a visibilidade (aba Avançado).

## D-029 — Duplicar profissional e curso (2026-10-17)
`POST /admin/professionals/:id/duplicate` (`professionals.write`) e `POST /admin/courses/:id/duplicate` (`courses.write`): rascunho novo com dados, modelo e documento do editor; nome/título com " (cópia)"; slug `<slug>-copia[-n]`. Não copia publicação, versões, vitrine, cursos do profissional nem link de checkout. A oferta (preço, desconto, parcelas) só vai junto se o usuário tem `commerce.manage`, sempre **inativa e sem link**. Auditoria `*.duplicate`. UI: "Duplicar" no menu das listas e em "Mais ações" do editor.

## D-030 — Checkout da The Members embutido por iframe, escolhido por curso (2026-10-19)
Pedido do usuário: testar o checkout da The Members dentro da página, mantendo o da Academia disponível. **Experimento; nenhuma API da The Members é presumida** (só uma URL https embutida).
- Oferta ganhou `provider`: `academia` (padrão; formulário em 3 etapas + redirecionamento, o que já existia) ou `themembers` (iframe com a URL de `checkoutUrl`). Coluna `commercial_configs.provider` já existia (valores antigos `redirect` valem como Academia, sem migração); o snapshot guarda `provider` (ausente = Academia).
- `GET /public/courses/:slug` devolve `checkout.mode`: `redirect` | `embed`. O renderer, em `embed`, troca o formulário/etapas por um `<iframe>` (`sandbox`, `allow="payment *"`, só `https://`); sem URL válida mostra "compra indisponível". O botão de compra rola até o iframe.
- A URL do iframe passa pela mesma validação do Modo A (https + `CHECKOUT_ALLOWED_HOSTS`). O CSP do site ganhou `frame-src 'self' <hosts>`, lido de `CHECKOUT_ALLOWED_HOSTS` **também no ambiente do web** (rebuild/restart ao mudar).
- Troca de provedor vale na página pública só ao republicar (como o preço); "Pausar vendas" continua imediato.
- Limites conhecidos: o iframe só funciona se a The Members permitir ser embutida (`X-Frame-Options`/`frame-ancestors` do lado deles) e se aceitarem nosso domínio; conclusão da compra não é detectada (sem evento/webhook); o rastreio conta o clique em comprar, não o pagamento. Fase 6 (Modo B/webhooks) segue não autorizada.

## D-031 — 9B (Estilo: Fundo) e 9C (criar/duplicar seções) (2026-10-19)
- **Escopo decidido pelo usuário:** 9B só **Fundo**; 9C texto/destaque, vídeo/galeria, CTA e FAQ/depoimentos.
- **Tons por esquema de cores (descoberto na conferência em tela):** a Trajetória do Profissional é texto escuro sobre fundo claro; um tom escuro a deixava ilegível. Por isso `settings.background` aceita seis tons e o catálogo (`backgroundSchemeOf`/`backgroundsFor`) liga cada seção ao seu esquema: escuro → `surface`, `dark`, `glow`; claro → `white`, `paper`, `gold`. O esquema foi medido nas páginas renderizadas (varia por modelo no Trabalhos do Profissional). A API recusa tom de outro esquema.
- **Home sem fundo editável:** alterna seções claras/escuras com cores de texto fixas e CSS por `#id`; trocar o fundo quebraria o contraste. Reavaliar se o negócio quiser.
- **Repetíveis e limites:** 9 tipos (ver plan.md), 4 por tipo e 30 por documento. Ids de DOM da instância n>1 com sufixo `--n` (o `-n` colidiria com ids de itens de acordeão). Seções que dependem de `#id` no CSS ou de ids fixos ficam únicas.
- **Invólucro de fundo:** `.pg-bg` com `display: contents`, só quando há tom (HTML idêntico ao anterior sem escolha); o editor liga a seção ao DOM pelo filho do invólucro (`section-dom.ts`). As regras CSS usam `!important` no filho direto para vencer os fundos próprios das seções.
- **Duplicar × adicionar outra:** "Duplicar" copia conteúdo e fundo; "Outra «seção»" nasce com o conteúdo padrão do cadastro e sem tom.
