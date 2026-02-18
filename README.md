# DEM-DIVERSOES

Catalogo online de locacao para festas, com area publica (site), carrinho/checkout por WhatsApp e painel administrativo protegido por Firebase Auth.

## Visao geral

Este projeto e um site estatico com JavaScript vanilla. A persistencia do catalogo nao fica no codigo: os dados vem de uma API em Google Apps Script que le/escreve em Google Sheets.  
No admin, as imagens sobem para Cloudinary com assinatura gerada no backend (Apps Script).

Fluxo de alto nivel:

1. Site publico consulta produtos via `doGet` do Apps Script (JSON), com opcao de feed CSV para Meta.
2. Usuario navega, filtra, adiciona itens no carrinho (localStorage).
3. Checkout monta mensagem e redireciona para WhatsApp.
4. Admin autenticado no Firebase faz CRUD no catalogo via `doPost`.
5. Apps Script grava no Google Sheets e integra com Cloudinary.

## Stack e dependencias externas

- Frontend: HTML5, CSS3, JavaScript (sem framework).
- Carrosseis: Splide (`@splidejs/splide` via CDN).
- Icones: Font Awesome (via CDN).
- Auth admin: Firebase Auth v8 (`firebase-app`, `firebase-auth`).
- Backend API: Google Apps Script (Web App).
- Banco principal: Google Sheets.
- Midia: Cloudinary.
- Tracking: Meta Pixel (`fbq`).

## Estrutura de pastas

```text
.
├── index.html            # Home publica (catalogo + FAQ)
├── produto.html          # Pagina de produto (detalhe + recomendados)
├── checkout.html         # Checkout (resumo + envio para WhatsApp)
├── privacy.html          # Politica de privacidade
├── script.js             # Logica principal do site publico/produto
├── cart.js               # API de carrinho (localStorage)
├── checkout.js           # Fluxo do checkout
├── privacy.js            # Nav mobile + badge + ano no footer
├── style.css             # Estilos do site publico
└── admin/
    ├── login.html        # Login admin
    ├── index.html        # Gerenciar itens (listar/editar/excluir)
    ├── novoitem.html     # Adicionar item
    ├── admin.html        # Pagina legada de adicionar item
    ├── script.js         # Logica completa do admin
    ├── style.css         # Estilos do admin
    ├── config.js         # Config runtime do admin (firebase + apiUrl)
    ├── config.sample.js  # Modelo sem credenciais
    ├── Código.gs         # Backend Apps Script (CRUD + Cloudinary)
    └── appsscript.json   # Manifesto Apps Script (scopes/runtime)
```

## Rotas e paginas

- `/index.html`: home publica.
- `/produto.html?id=<ID>`: detalhe de um item.
- `/checkout.html`: checkout/carrinho.
- `/privacy.html`: pagina legal.
- `/admin/login.html`: login admin.
- `/admin/index.html`: gestao de itens.
- `/admin/novoitem.html`: cadastro de novo item.

Links cruzados:

- No admin existe link para `Site publico`.
- No footer publico existe link discreto para `Gerenciador`.

## Site publico: funcionalidades

## Catalogo e busca

- Carrega produtos do Apps Script (`script.js`).
- Aceita normalizacao de campos (ex.: `id/Id/ID`, `preco/Preco/Preco`).
- Separa `Decorações` em carrossel proprio na home.
- Busca por nome, descricao, categoria e subcategorias.
- Home usa render inicial limitado (`HOME_INITIAL_LIMIT = 18`) e render completo adiado para performance.

## Carrinho

- Implementado em `cart.js`.
- Chave de armazenamento: `dm_cart`.
- Estrutura por item: `{ id, nome, preco, qty }`.
- Atualiza badge em todos os elementos com `data-cart-badge`.
- Fallback em memoria caso `localStorage` esteja indisponivel.

## Pagina de produto

- Le `id` via query string.
- Monta galeria principal + thumbs + lightbox.
- Monta CTA para WhatsApp e checkout com `products=<id>:1`.
- Permite adicionar ao carrinho direto na pagina.
- Renderiza recomendados por score:
  - +3 mesma categoria.
  - +1 por subcategoria em comum.

## SEO e tracking

- Open Graph dinamico na pagina de produto.
- JSON-LD de `Product` injetado dinamicamente.
- Meta Pixel com eventos:
  - `PageView` (snippet nas paginas).
  - `ViewContent` (produto).
  - `Search` (busca com debounce).
  - `Contact` (cliques em WhatsApp/Instagram/Facebook/etc).

## Otimizacao de imagem

- URLs Cloudinary recebem transformacoes automaticas no frontend:
  - `f_webp`, `q_auto:good`, `fl_strip_profile`.
  - Tamanhos diferentes para card/produto/thumb.

## Checkout

- Mostra itens do carrinho com alterar quantidade/remover/limpar.
- Suporta parametros de URL:
  - `products=123:2,456:1`
  - `coupon` ou `cupom`
  - `item`, `id`, `preco` (legado/simples)
- Ao enviar, gera mensagem para WhatsApp com itens, data, bairro, cupom e observacoes.

Observacao atual:

- O campo "Seu nome" existe no formulario, mas hoje nao entra no texto final do WhatsApp.

## Admin: funcionalidades

## Autenticacao

- Firebase Auth v8 via email/senha.
- Guard de rota no `admin/script.js`:
  - Deslogado fora de `login.html` -> redireciona para login.
  - Logado em `login.html` -> redireciona para `index.html`.

## Gerenciar itens (`admin/index.html`)

- Lista itens vindos de `getManagerData`.
- Busca local por nome, id, categoria e subcategorias.
- Edicao inline por card.
- Excluir item com confirmacao.
- Reordenacao de imagens por setas.
- Marcacao de imagens para exclusao.

## Adicionar item (`admin/novoitem.html`)

- Formulario com nome, categoria, subcategorias, preco, descricao e imagens.
- Subcategorias carregadas da aba dedicada da planilha.
- Picker de imagem com:
  - clique para selecionar
  - drag-and-drop
  - colar imagem via Ctrl+V/Cmd+V
  - preview e remocao antes do upload

## Upload de imagens (admin)

- Compressao client-side para WebP com alvo de ate ~150KB.
- Obtencao de assinatura segura via Apps Script (`getUploadSignature`).
- Upload direto no endpoint Cloudinary.
- Em edicao:
  - apaga imagens marcadas no Cloudinary
  - envia novas imagens
  - persiste lista final na planilha

## Backend Apps Script (`admin/Código.gs`)

## Endpoints

- `doGet`: publico, retorna JSON de produtos por padrao.
- `doGet?format=meta` (ou `feed=meta`, `meta-csv`, `meta_csv`): retorna feed CSV no padrao Meta Catalog.
- `doPost`: privado, exige token Firebase e roteia por `action`.

## Acoes suportadas em `doPost`

- `getManagerData`: produtos + subcategorias.
- `getNextId`: calcula proximo ID numerico.
- `saveProduct`: cria item.
- `updateProduct`: atualiza item por ID.
- `deleteProduct`: remove item por ID.
- `getUploadSignature`: assinatura Cloudinary.
- `deleteImage`: remove imagem Cloudinary por `public_id`.
- `deleteFolder`: remove pasta Cloudinary.

Resposta padrao:

- Sucesso: `{ "status": "success", "data": ... }`
- Erro: `{ "status": "error", "message": "..." }`

## Feed Meta CSV

Endpoint:

- `https://SEU_WEBAPP_URL/exec?format=meta`

Campos incluidos no CSV:

- `id`, `title`, `description`, `availability`, `quantity_to_sell_on_facebook`
- `condition`, `price`, `link`, `image_link`, `additional_image_link`
- `brand`, `google_product_category`, `product_type`, `item_group_id`

Fallbacks importantes:

- `price`: usa `META_FEED_DEFAULT_PRICE`; se ausente, cai para `1.00 BRL`.
- `image_link`: usa `META_FEED_FALLBACK_IMAGE_URL` quando produto nao tem imagem.
- `google_product_category`: resolve por mapa de categoria; se nao houver match, usa categoria padrao.

## Exemplo de chamada para `doPost`

```json
{
  "action": "getManagerData",
  "payload": {},
  "token": "Bearer <FIREBASE_ID_TOKEN>"
}
```

Observacoes:

- O token pode ser enviado em `body.token`.
- Existe fallback para `token` na query string.
- Resposta sempre vem no envelope `{ status, data }` ou `{ status, message }`.

## Modelo de dados na planilha

Aba principal (`SHEET_NAME`, hoje `Página1`):

1. Coluna A: `id`
2. Coluna B: `nome`
3. Coluna C: `categoria`
4. Coluna D: `subcategorias` (string separada por virgula)
5. Coluna E: `preco`
6. Coluna F: `descricao`
7. Coluna G: `imagens` (URLs separadas por virgula)
8. Coluna H: reservada/nao usada no frontend atual

Aba de subcategorias (`SUBCATEGORIES_SHEET`, hoje `Subcategorias`):

1. Coluna A: uma subcategoria por linha (a partir da linha 2).

## Configuracao

## 1) Config local do admin

Arquivo: `admin/config.js`

Copie de `admin/config.sample.js` e preencha:

- `firebase.apiKey`
- `firebase.authDomain`
- `firebase.projectId`
- `firebase.storageBucket`
- `firebase.messagingSenderId`
- `firebase.appId`
- `apiUrl` (URL do Web App do Apps Script)

## 2) Apps Script

Arquivo: `admin/Código.gs` e propriedades do script.

Defina:

- Constantes de planilha (`SPREADSHEET_ID`, nomes de abas).
- Script Properties:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
  - `CLOUDINARY_BASE_FOLDER` (opcional)
  - `SITE_BASE_URL` (opcional, usado no link do feed)
  - `FEED_CURRENCY` (opcional, padrao `BRL`)
  - `META_FEED_AVAILABILITY` (opcional, padrao `in stock`)
  - `META_FEED_CONDITION` (opcional, padrao `new`)
  - `META_FEED_BRAND` (opcional)
  - `META_FEED_FALLBACK_IMAGE_URL` (opcional)
  - `META_FEED_DEFAULT_PRICE` (opcional)
  - `META_FEED_DEFAULT_QUANTITY` (opcional)

Deploy esperado:

1. Deploy como Web App.
2. Permitir acesso para quem vai chamar (frontend/admin).
3. Atualizar URL no `apiUrl` do admin e nas URLs hardcoded do site publico.

## 3) Firebase

- Habilitar Email/Password no Firebase Authentication.
- Criar usuarios administradores.
- Garantir que `projectId` em `config.js` bate com a validacao do Apps Script (`dem-admin` no codigo atual).

## Executar localmente

Como e site estatico, basta servidor HTTP simples na raiz:

```bash
python3 -m http.server 8080
```

Acessos:

- Publico: `http://localhost:8080/index.html`
- Admin: `http://localhost:8080/admin/login.html`

## Deploy

- Qualquer host estatico funciona (ex.: Vercel, Netlify, GitHub Pages).
- O `admin/` e servido como parte do mesmo projeto estatico.
- O backend real continua no Apps Script.

## Seguranca e pontos de atencao

- `doGet` e publico por design (catalogo aberto).
- `doPost` valida token Firebase (issuer, audience e expiracao).
- Existe funcao de verificacao de assinatura JWT, mas a linha que bloqueia assinatura invalida esta comentada no momento.
- `projectId` para validacao de token esta fixo como `dem-admin` em `admin/Código.gs`.
- O repositorio atualmente nao ignora explicitamente `admin/config.js`; revise politica de versionamento de configuracao.
- Use CORS e permissoes de deploy do Apps Script de forma restritiva para o necessario.

## Arquivos legados e observacoes tecnicas

- `admin/admin.html` e uma tela antiga de cadastro. O fluxo principal atual usa `admin/novoitem.html`.
- `admin/script.js` instancia `firestore` e `storage`, mas o CRUD principal usa Apps Script + Sheets.
- Nao ha suite de testes automatizados no repositorio hoje.

## Checklist rapido de validacao manual

1. Home carrega produtos e busca funciona.
2. Produto abre por `?id=` e adiciona ao carrinho.
3. Carrinho atualiza badge e quantidades.
4. Checkout gera mensagem correta no WhatsApp.
5. Login admin autentica e protege rotas.
6. Cadastro admin cria item com imagens.
7. Edicao admin atualiza dados e imagens.
8. Exclusao remove item da planilha (e pasta/imagens quando aplicavel).
9. `doGet?format=meta` retorna CSV valido para ingestao no Meta Catalog.

## Licenca

Sem licenca definida no repositorio ate o momento.
