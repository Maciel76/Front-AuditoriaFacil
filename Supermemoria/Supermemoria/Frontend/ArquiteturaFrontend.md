# Arquitetura Frontend

## Stack e bootstrap

- Vue 3.5.18
- Vite 7
- Vue Router 4
- Pinia 3
- Axios 1.11
- Chart.js 4 + vue-chartjs
- FontAwesome 6
- Cropper.js 2.1.1

O bootstrap acontece em frontend/src/main.js. O arquivo registra FontAwesome, cria a app Vue, injeta Pinia e router e carrega os estilos globais. O alias @ aponta para frontend/src via vite.config.js.

## Estrutura de pastas

### frontend/src

- App.vue: raiz da aplicacao; carrega auth.carregarMe quando ha token e renderiza RouterView + toasts.
- main.js: inicializacao global.
- router.js: definicao de rotas e guardas.
- services/api.js: cliente Axios compartilhado.
- stores/auth.js: estado de autenticacao do app principal.
- stores/ui.js: toasts e controle de sidebar mobile.
- layouts/AppLayout.vue: shell autenticado da aplicacao.
- components/: componentes reutilizaveis de visualizacao e filtro.
- views/: telas de negocio.
- styles/global.css: design system e estilos globais do app.

## Roteamento e navegacao

- /login e rota publica para login administrativo e cadastro de loja.
- /portal e rota publica para o colaborador.
- / usa AppLayout como casca autenticada e redireciona para /dashboard.
- O router bloqueia qualquer rota com meta.auth quando nao ha token do app principal.
- O router tambem bloqueia acesso a rotas com meta.roles quando o role do usuario nao bate.

## Estado global

### Store auth

- token: lido e persistido em na_token.
- usuario: persistido em na_usuario.
- loja: persistida em na_loja.
- getters: autenticado, isSuperAdmin, isStoreAdmin, isColaborador, podeGerenciar.
- actions: login, registrarLoja, carregarMe, logout, persistir.

### Store ui

- toasts: notificacoes temporarias.
- sidebarAberta: estado da navegacao mobile.
- actions: toast, sucesso, erro, info, dismiss, toggleSidebar, fecharSidebar.

## Cliente de API

frontend/src/services/api.js concentra a configuracao HTTP:

- baseURL: VITE_API_BASE ou http://localhost:4000/api.
- timeout: 60 segundos.
- interceptor de request injeta Bearer do app somente quando o header Authorization ainda nao existe.
- interceptor de response desloga apenas quando uma resposta 401 ocorreu usando o token principal do app, evitando derrubar a sessao do portal do colaborador por engano.

## Tema e persistencia visual

### App principal

- Chave localStorage: na_tema.
- Controle central em AppLayout.vue.
- Temas disponiveis: dark e light.
- O layout sincroniza sidebar e backdrop no mobile.

### Portal do colaborador

- Chave localStorage: na_portal_tema.
- Tema padrao: light.
- O portal aplica tema proprio e restaura o tema anterior do app quando desmonta.

## Views e responsabilidades

### Login.vue

- Abas para Entrar e Cadastrar Loja.
- Entrar usa POST /auth/login.
- Cadastro de loja usa POST /auth/register-loja.
- Exibe atalho para /portal.

### Dashboard.vue

- Consulta GET /metricas/dashboard.
- Usa PeriodoSelector com suporte a custom.
- Renderiza cinco KPIs principais, grafico de conformidade com colunas para series esparsas e linha para periodos mais densos, alem da distribuicao por tipo.
- Exibe cards detalhados por tipo de auditoria e ultimas auditorias.

### Auditorias.vue

- Tela mista de upload e historico.
- Upload disponivel apenas para perfis gerenciais.
- Quando o usuario e SUPER_ADMIN, a tela exige escolha explicita da loja de destino antes de habilitar o upload.
- A loja escolhida fica persistida em localStorage na chave na_auditorias_superadmin_loja para manter o contexto operacional entre visitas.
- Permite tipo automatico ou forcado manualmente.
- O card de upload foi redesenhado com layout de status lateral, area principal de drop e preenchimento animado do componente durante o processamento.
- O frontend combina progresso real de envio do arquivo com polling do status de processamento no backend.
- Para SUPER_ADMIN, GET /auditorias, POST /auditorias/upload e DELETE /auditorias/:id passam lojaId por query string, seguindo o contrato de escopo multi-loja do backend.
- O historico, o resultado do upload e a navegacao para o detalhe da auditoria seguem a loja selecionada.
- Consulta GET /auditorias para historico.
- Faz POST /auditorias/upload, consulta GET /auditorias/upload/:jobId/status e DELETE /auditorias/:id.

### AuditoriaDetalhe.vue

- Busca cabecalho da auditoria e itens filtraveis.
- Quando aberto a partir do contexto SUPER_ADMIN, preserva lojaId na query para carregar cabecalho, itens e retorno para a listagem sem perder o escopo.
- Exibe distribuicao por situacao, top colaboradores e tabela detalhada de itens.

### Rankings.vue

- Alterna entre ranking de colaboradores e ranking de lojas.
- Usa podium para top 3.
- O selo superior do podium usa contraste por colocacao no topo do card, com leitura ajustada no tema claro para ouro, prata e bronze.
- Aceita filtros de periodo e tipo.
- Ao abrir em periodo 1d, aplica o mesmo tipo padrao por dia util usado em relatorios (seg/qui etiqueta, ter presenca, qua ruptura) e faz fallback automatico para todos os tipos quando nao houver dados no tipo sugerido.
- Ranking de lojas so faz sentido para SUPER_ADMIN.

### Colaboradores.vue

- Busca colaboradores por nome ou matricula.
- Lista cards compactos com avatar, nivel, pontos e conformidade; as conquistas ficam restritas ao perfil detalhado para reduzir altura e ruido visual na grade.
- O card inteiro abre o perfil do colaborador e a listagem nao exibe mais botoes dedicados de ver perfil ou exclusao.
- Permite criacao para perfis com permissao, sem expor desativacao na listagem.

### ColaboradorPerfil.vue

- Consulta GET /metricas/colaboradores/:id/perfil.
- Exibe resumo do colaborador, conquistas, pontos, nivel e grafico por periodo com alternancia automatica entre colunas e linha conforme a densidade da serie.

### Relatorios.vue

- Consulta simultaneamente /metricas/relatorios/situacoes, /metricas/relatorios/classes e /metricas/relatorios/corredores.
- Permite filtrar por periodo, custom range e tipo.
- Exibe cards-resumo operacionais, grafico de situacoes, panorama das classes com maior leitura, grade completa por corredor e tabela operacional por classe.
- Ao abrir em periodo 1d, aplica tipo padrao por dia util (seg/qui etiqueta, ter presenca, qua ruptura) e faz fallback automatico para todos os tipos quando nao existir dado para o tipo sugerido.
- Os cards de corredor usam visual resumido por padrao e expandem detalhes (conformes, sem leitura, ruptura e ultima auditoria) ao clique, com porcentagem reduzida para preservar hierarquia com o status.
- Ao expandir corredor ou classe, a tela lista os colaboradores que efetivamente leram produtos naquela dimensao no periodo filtrado.
- A expansão de detalhes no relatório por corredor foi convertida para overlay dentro do card, evitando quebra de layout da grade ao abrir informações extras.
- A visualização detalhada por corredor/classe agora abre em overlay global fullscreen com fundo escurecido, sobrepondo toda a tela para leitura focada.
- A modal de detalhes segue a identidade visual do app com hero superior, cards internos e transição animada de entrada/saída, em vez de um painel neutro genérico.

### Configuracoes.vue

- Consulta dados da loja atual em /lojas/me.
- Permite editar dados cadastrais e metas da loja via PUT /lojas/:id.
- Lista usuarios em /usuarios.
- Permite criar usuarios e desativa-los.

### AdminLojas.vue

- View exclusiva de super admin.
- Lista lojas via GET /lojas.
- Permite criar via POST /lojas e desativar via DELETE /lojas/:id.

### ColaboradorPortal.vue

- Tela mais complexa do frontend.
- Controla etapas buscar, selecionar, setup, login e portal.
- Busca lojas por matricula em /auth/portal/verificar.
- Define senha em /auth/portal/setup.
- Faz login em /auth/portal/login.
- Carrega perfil em /colaboradores/portal/me.
- Carrega metricas em /metricas/portal/me.
- Faz upload de avatar em /colaboradores/:id/avatar.
- Troca senha em /colaboradores/portal/password.
- Usa Cropper.js para recorte antes do upload.
- O grafico historico do portal alterna automaticamente entre colunas e linha conforme a quantidade de pontos no periodo.


## Componentes reutilizados

- PeriodoSelector.vue: tabs animadas para 1d, semana, mes, ano, tudo e custom.
- AppChart.vue: wrapper central de Chart.js com defaults por tipo, merge profundo de opcoes, adaptacao ao tema e normalizacao visual de datasets.
- KpiCard.vue: card curto para metricas numericas.
- Loader.vue: estado de carregamento.

## Chaves de localStorage confirmadas

- na_token
- na_usuario
- na_loja
- na_tema
- na_portal_token
- na_portal_tema
- na_auditorias_superadmin_loja

## Dependencias de dados do frontend

- Toda a aplicacao autenticada depende do token principal e do endpoint /auth/me para hidratar usuario e loja.
- Todas as telas analiticas dependem de MetricaDiaria, acessada indiretamente pelas rotas de metricas.
- O portal do colaborador depende de um token diferente, nao compartilhado com a store auth principal.