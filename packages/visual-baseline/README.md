# @academia/visual-baseline

Baseline visual das três referências aprovadas (Home, Profissional, Curso), copiadas em `references/` (somente leitura, hashes em `references/MANIFEST.sha256`).

- `pnpm capture:update` regrava `baseline/` (screenshots full-page + métricas JSON) em 1440, 1024, 900, 768, 620 e 390 px.
- `pnpm capture` grava em `output/` (ignorado pelo git) para comparação.
- Rede externa é bloqueada; os hosts bloqueados ficam em cada JSON (`blockedHosts`).
- `Math.random` usa semente fixa. Mesmo assim, Home e Profissional têm canvases e animações em loop: o pixel exato **não é reproduzível** nessas páginas. Comparações da Fase 2 devem mascarar a camada de efeitos do hero e usar `sections` (posição/tamanho) como verificação determinística. A página do Curso é idêntica pixel a pixel entre execuções.
- `activeAnimations` pode variar em ±1 entre execuções; não usar como igualdade estrita.
