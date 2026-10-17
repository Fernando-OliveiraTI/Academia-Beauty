# Morena Iluminada · página de produto

Abra `index.html` no navegador. Não precisa de build nem de dependências (só as fontes Geist e Geist Mono do Google Fonts).

## Estrutura
- `index.html`: página completa (header, hero, benefícios, conteúdo, entrega, instrutor, prova social, oferta, FAQ, checkout, garantia, CTA final, footer, CTA fixo no mobile).
- `css/style.css`: design system (tokens em `:root`) e componentes.
- `js/script.js`: interações e checkout (máscaras, validação, etapas, confirmação). Preços em `PRODUCT` no topo do arquivo.
- `js/gateway.js`: camada de integração com o gateway de pagamento, hoje em modo `mock`.
- `assets/`: logo, favicon e capa de reserva (usada se a imagem da Shopify não carregar).

## Antes de publicar
1. Troque os depoimentos de exemplo (seção `#depoimentos`) por depoimentos reais e remova o selo "Depoimentos de exemplo".
2. Coloque a foto do instrutor em `assets/lukas-perfil.jpg` (sem ela, aparece o monograma LC).
3. Confira preço, desconto e parcelas em `PRODUCT` (`js/script.js`).
4. Preencha os links de redes sociais no footer.
5. Remova o aviso "Ambiente de demonstração" do checkout quando o gateway real estiver ligado.

## Integração de pagamento
Siga os passos no topo de `js/gateway.js`: tokenizar o cartão com o SDK do gateway, criar o pedido no seu backend (`endpoint`) e chamar `CheckoutGateway.configure({ mode: 'live' })`. O número do cartão nunca vai para o seu servidor, só o token.

No modo demonstração: cartão `4111 1111 1111 1111` aprova, cartão terminado em `0002` (ex.: `4000 0000 0000 0002`) é recusado. Use um CPF válido de teste, como `529.982.247-25`.
