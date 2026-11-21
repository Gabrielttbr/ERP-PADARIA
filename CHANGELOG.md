# Changelog

All notable changes to Sistema PDV are documented here.

This project adheres to [Semantic Versioning](https://semver.org/) and [Conventional Commits](https://www.conventionalcommits.org/).

---

## [Não lançado]

## [1.4.0] — 2026-11-21

### Added
- **Chave de acesso mensal**: o sistema só funciona com uma chave válida, gerada
  pelo dono com `backend/gerar_chave_acesso.py` (35 dias por padrão). Faltando
  5 dias aparece o aviso para regularizar o pagamento; vencida, o sistema
  bloqueia até a chave nova ser colada (tela de bloqueio ou Configurações →
  Chave de acesso). Quem atualiza sem chave tem 5 dias para ativar uma chave
- **GiroNegócios / Sistema PDV**: novo nome e identidade visual, sem foco só em
  padaria
- **Atalho da área de trabalho abre em tela cheia** e a versão instalada aparece
  em Configurações
- **Instalador e atualizador do Windows** (`INSTALAR_SISTEMA.bat` /
  `ATUALIZAR_SISTEMA.bat`) com backup do banco antes de atualizar
- **Venda por peso/volume** no PDV (modal de quantidade em kg/l) e produto
  **Diverso (999)** para itens não cadastrados, garantido em toda instalação
- **Máscara monetária (R$)** em todos os campos de valor e navegação por setas
  no PDV (produtos e formas de pagamento)
- Ícone de informação com a descrição de cada indicador do dashboard
- Testes E2E (Playwright) dos fluxos principais: PDV, caixa, dashboard,
  relatórios, estoque e configurações
- **Fabricante/marca** no cadastro de produto (além do fornecedor/distribuidor)
- **Importação do XML da NF-e** em Compras: lê fornecedor e itens do XML que o
  fornecedor manda junto da mercadoria, casa produto existente por código de
  barras/SKU, mostra uma prévia pra conferir antes de lançar a compra
- **Exportar/Importar Excel** do catálogo de produtos, com atualização em lote
  (casa por id/código de barras/SKU); a quantidade em estoque nunca é alterada
  pela importação — só por compra ou ajuste, preservando a auditoria
- Migração automática e idempotente de colunas novas em produção (o projeto não
  usa Alembic; até então uma coluna nova exigia intervenção manual no banco)
- **Conciliação bancária**: importação de extrato OFX (com dedupe por FITID),
  sugestão automática de PIX/dinheiro por valor+data, e conciliação manual do
  que sobrar
- **Contratos de cartão**: cadastro de operadora (Stone/Cielo/Rede/etc.) e taxa
  por bandeira/tipo/parcelas, com cálculo do valor líquido esperado e prazo de
  recebimento
- **Relatório Dinâmico**: tabela dinâmica de vendas (dimensão + métrica à
  escolha do usuário) com exportação em Excel
- **PDV com cara de sistema de verdade**: leitor de código de barras liga direto
  no carrinho (o hook já existia mas não estava em uso), atalhos de teclado
  (F2/F4/F9/Del/Esc), barra de status (operador/caixa/horário)
- **PDV: visual escuro estilo CPlug** — segunda rodada do redesenho, com
  referência real (badges coloridos de ação rápida, produtos com foto, lista
  de venda com miniatura) e cliente vinculável à venda
- **PDV: terminal full-screen de verdade** — terceira rodada: tirado de dentro
  do layout do sistema (sem menu lateral/topbar), ocupando a tela inteira
  como um PDV de mercado de verdade, com saída discreta pro painel

### Fixed
- Barra de status do PDV ficava com dado antigo do caixa logo após abrir a
  sessão (cache do React Query não era invalidado)
- Datas gravadas e exibidas no horário de São Paulo (antes saíam 3h adiantadas)
- Pagamento em dinheiro menor que o total não fecha mais a venda, e o troco é
  gravado corretamente
- Erros de validação da API não deixam mais a tela em branco
- Resumo do caixa por forma de pagamento; o valor esperado conta só o dinheiro
- Cupom impresso em duas linhas por item, sem cortar o total
- Instalador falhava ao criar o banco (faltava o greenlet); atualizador para o
  servidor antes do backup e interrompe em caso de erro

### Security
- XML da NF-e é lido com `defusedxml` (proteção contra XML bomb/XXE), não o
  `xml.etree.ElementTree` puro
- Acesso de demonstração escondido da tela de login fora do ambiente de
  desenvolvimento

## [1.3.0] — 2026-07-27

### Added
- **Suíte de testes automatizados** (o projeto não tinha nenhum): **pytest** no backend cobrindo a lógica crítica do PDV (cálculo de venda, troco, desconto, baixa e estorno de estoque, fechamento de caixa e KPIs do dashboard, com SQLite em memória) e **vitest** no frontend (formatação de moeda e carrinho, garantindo paridade de cálculo com o backend) — 32 testes no total
- **Suporte cross-platform Windows + Linux/macOS**: scripts `instalar.sh` / `iniciar.sh` / `atualizar.sh` equivalentes aos `.bat`, e matriz de CI Ubuntu + Windows provando a portabilidade

### Changed
- **CI com gate de testes obrigatório**: o build da imagem e a publicação no release só ocorrem se `pytest` e `vitest` passarem (antes o `docker-publish` subia a imagem no release sem rodar teste nenhum)
- `APP_DEBUG` agora **desligado por padrão** (Swagger/OpenAPI e stack traces só com opt-in explícito)
- Versão do app FastAPI sincronizada (estava fixa em `1.0.0`)

### Security
- `config.py` **recusa iniciar em produção** (`APP_ENV=production`) com `JWT_SECRET_KEY` fraco/de exemplo ou com menos de 32 caracteres
- CI ganhou **scan de segurança**: `bandit` (análise estática, bloqueante) + `pip-audit` e `npm audit` (dependências, informativos)

---

## [1.2.0] — 2026-07-20

### Added
- Módulo de Clientes com histórico de compras e programa de fidelidade
- Módulo de Notificações in-app (sino no header, alertas automáticos de estoque)
- Perfil `sync_pdv` no model Usuario + dependency `require_sync` (permite `sync_pdv` ou `admin`) para as rotas de sincronização com o PDV offline

### Security
- Removida credencial hardcoded de `create_super_admin.py`
- Validação do conteúdo real da imagem (não só extensão) no upload de logo
- `npm audit fix` (ws, react-router)

### Fixed
- Imports não usados removidos (ruff)

### Docs
- README com badges (CI, licença, release, demo), seção de capturas de tela e link da demo ao vivo

---

## [1.1.0] — 2026-06-28

### Added
- **Compras** — página frontend completa: listagem com KPIs, criação de pedido por fornecedor, recebimento com entrada automática no estoque
- **Docs interna** — página de documentação do sistema para todos os perfis
- **Admin Central** — painel do `super_admin` para gerenciar clientes e instâncias
- **PWA** — manifest.json, favicon SVG e meta tags para instalação como app

### Changed
- Dashboard reimplementado com KPIs expandidos (margem real, ticket médio, curva ABC, produtos abaixo do mínimo)
- Estoque com indicador visual de alerta de estoque crítico e ordenação por urgência
- Auditoria com filtros avançados (período, usuário, ação) e modal de detalhes
- Sidebar atualizada com grupos Operação/Gestão/Sistema, links de Admin e Docs, e BottomNav mobile
- Login redesenhado com nova identidade visual
- Nova identidade visual: logos SVG, design system CSS com variáveis de cor

### Fixed
- 88 erros de lint no backend (ruff): imports não usados, comparações `== True`/`== None`, lambda como def, inline if
- Tipagem TypeScript estrita nos callbacks `onError` do react-query

### Security
- Backend rodando como não-root (UID 10001) no Dockerfile

---

## [1.0.0] — 2026-06-27

### Added
- **PDV** — frente de caixa completa com suporte a leitor de código de barras, pagamento misto (Dinheiro/Crédito/Débito/PIX/Vale), desconto por item/venda e impressão de cupom ESC/POS
- **Estoque** — CRUD de produtos com foto, código de barras, SKU, preço de custo/venda, unidade de medida e estoque mínimo; ajuste manual (entrada, saída, perda, inventário)
- **Controle de Caixa** — abertura com fundo inicial, sangria, suprimento, fechamento com totalização por forma de pagamento
- **Compras** — registro de ordens de compra por fornecedor com entrada automática no estoque
- **Dashboard** — KPIs em tempo real, gráfico de vendas 30 dias, curva ABC, alertas de estoque mínimo
- **Relatórios** — vendas por período, movimentações de estoque, exportação PDF e Excel
- **Auditoria** — log imutável de todas as operações sensíveis
- **Categorias hierárquicas** — subcategorias com validação de ciclo
- **Perfis de acesso** — `super_admin`, `admin`, `gerente`, `caixa`, `estoquista`
- **PWA** — manifest.json e meta tags para instalação como app
- **Multi-tenant Docker** — `docker-compose.yml` parametrizado + script `deploy/new-client.sh`
- **Instalador Windows** — `INSTALAR_SISTEMA.bat` instala tudo do zero em uma nova máquina

### Security
- Backend roda como usuário não-root (UID 10001) no Dockerfile
- JWT com access token de 8h + refresh token de 7 dias
- Auditoria imutável via API (sem endpoint de delete)
- Swagger desabilitado em `APP_DEBUG=false`

---

## [0.x] — Desenvolvimento inicial

Projeto em desenvolvimento interno. Sem releases públicas.

---

[Unreleased]: https://github.com/AlexandreAlan/ERP-PADARIA/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/AlexandreAlan/ERP-PADARIA/compare/v1.0.0...v1.2.0
[1.1.0]: https://github.com/AlexandreAlan/ERP-PADARIA/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/AlexandreAlan/ERP-PADARIA/releases/tag/v1.0.0
