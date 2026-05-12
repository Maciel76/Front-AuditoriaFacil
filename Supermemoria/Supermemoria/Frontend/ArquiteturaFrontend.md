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

Em producao, o bootstrap tambem registra frontend/public/sw.js para habilitar instalacao PWA. O HTML base em frontend/index.html publica o manifest.webmanifest e o icone touch usado pelo prompt de instalacao.

O HTML base em frontend/index.html define a marca publica Flashrub, o favicon em forma de raio e a descricao institucional usada no deploy web.

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
- /lojas e um catalogo autenticado de lojas visivel para qualquer usuario do app principal.
- /lojas/:id abre o perfil analitico publico de uma loja especifica para usuarios autenticados.
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

- baseURL: VITE_API_URL ou, por compatibilidade, VITE_API_BASE; na ausencia de ambas, cai para http://localhost:4000/api.
- Quando a variavel aponta apenas para a origem do backend, o frontend acrescenta /api automaticamente para manter compatibilidade com o backend Express exposto por reverse proxy.
- Convencao atual de ambientes: `frontend/.env` usa `http://localhost:4000` no desenvolvimento local e `frontend/.env.production` usa `https://flashub.mywire.org` no build de producao.
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
- Exibe a marca Flashrub com icone de raio, descricao institucional e atalho para o portal do colaborador.
- Entrar usa POST /auth/login.
- Cadastro de loja usa POST /auth/register-loja.
- Exibe atalho para /portal.

### Dashboard.vue

- Consulta GET /metricas/dashboard.
- Quando o usuario e SUPER_ADMIN, a tela exibe um seletor de loja no topo e propaga `lojaId` para GET /metricas/dashboard e GET /metricas/ultima-data.
- A loja escolhida no Dashboard fica persistida em localStorage na chave na_dashboard_superadmin_loja para manter o contexto analitico entre visitas.
- O contexto de loja escolhido no Dashboard tambem e preservado na navegacao para a listagem e para o detalhe das ultimas auditorias via query string `lojaId`.
- Usa PeriodoSelector com suporte a custom.
- Renderiza cinco KPIs principais, grafico de conformidade com colunas para series esparsas e linha para periodos mais densos, alem da distribuicao por tipo.
- Quando o periodo ativo e `1d`, o card esquerdo troca a serie temporal por `DashboardDesempenhoHoje.vue`, que consulta `GET /metricas/ranking/colaboradores` no mesmo contexto de `tipo` e `lojaId` do dashboard e exibe o desempenho dos colaboradores do dia em barras verticais ordenadas do maior para o menor volume de itens lidos, com desempate por pontuacao.
- Exibe cards detalhados por tipo de auditoria e ultimas auditorias.
- O botao Compartilhar exporta um PNG da area funcional atual do dashboard com os filtros ja aplicados.
- Para manter fidelidade visual no light/dark, a exportacao nao deve capturar o DOM vivo diretamente: o padrao confirmado e clonar a area alvo fora da tela, sincronizar os campos de formulario, copiar os canvases dos graficos, remover estados transitorios de animacao e aplicar explicitamente o data-theme e as CSS vars do tema atual antes de chamar html2canvas.
- O fundo final da captura deve usar os tokens do tema ativo, principalmente --bg-0, --surface e --grad-card, para evitar cards pretos/cinza ou perda do glow no tema claro.
- Os cinco KPIs do topo seguem regra fixa baseada no periodo selecionado: Produtos auditados = soma de totalLidos das auditorias filtradas; Conclusao = media simples de taxaConformidade entre auditorias do periodo; Produtos n/auditados = contagem de AuditItem por situacao operacional (`Nao lidos com estoque` para ETIQUETA e `Sem Presenca e Com Estoque` para PRESENCA/RUPTURA), excluindo `Sem Estoque` e `Sem Presenca e Sem Estoque`; Custo ruptura = soma de custoRupturaTotal apenas das auditorias do tipo RUPTURA no periodo; Total colaboradores = quantidade distinta de colaboradores com totalLidos > 0 no periodo, independente do filtro de tipo.
- Excecao operacional para o filtro `PRESENCA` no Dashboard: o primeiro KPI passa a representar o total de itens considerados na leitura operacional (`Com Presenca e com Estoque` + `Sem Presenca e Com Estoque`), o segundo KPI calcula a conclusao como `Com Presenca e com Estoque / total * 100`, e os rotulos do topo mudam para `Total itens` e `Itens sem presenca` para refletir essa visao.

### Auditorias.vue

- Tela mista de upload e historico.
- Upload disponivel apenas para perfis gerenciais.
- Quando o usuario e SUPER_ADMIN, a tela exige escolha explicita da loja de destino antes de habilitar o upload.
- A loja escolhida fica persistida em localStorage na chave na_auditorias_superadmin_loja para manter o contexto operacional entre visitas.
- Permite tipo automatico ou forcado manualmente.
- O card de upload foi redesenhado com layout de status lateral, area principal de drop e preenchimento animado do componente durante o processamento.
- A animacao de processamento em Auditorias.vue simula agua preenchendo o card com ondas em camadas, reflexos, bolhas e medidor circular, usando somente o estado visual do progresso existente.
- Durante upload/processamento, a area principal exibe o stage real retornado pelo backend e um rotador visual com nomes de etapas operacionais para dar sensacao de acompanhamento continuo.
- O frontend combina progresso real de envio do arquivo com polling do status de processamento no backend.
- Para SUPER_ADMIN, GET /auditorias, POST /auditorias/upload e DELETE /auditorias/:id passam lojaId por query string, seguindo o contrato de escopo multi-loja do backend.
- O historico, o resultado do upload e a navegacao para o detalhe da auditoria seguem a loja selecionada.
- Quando o status retornado pelo upload e cancelado, a tela mostra badge/alerta de auditoria cancelada e informa que os dados nao foram contabilizados.
- Consulta GET /auditorias para historico.
- Faz POST /auditorias/upload, consulta GET /auditorias/upload/:jobId/status e DELETE /auditorias/:id.

### AuditoriaDetalhe.vue

- Busca cabecalho da auditoria e itens filtraveis.
- Quando aberto a partir do contexto SUPER_ADMIN, preserva lojaId na query para carregar cabecalho, itens e retorno para a listagem sem perder o escopo.
- Exibe distribuicao por situacao, top colaboradores e tabela detalhada de itens.

### RankingColaboradores.vue

- View dedicada para ranking de colaboradores.
- Usa podium para top 3 e lista para as demais posicoes.
- Aceita filtros de periodo e tipo.
- Quando o usuario e SUPER_ADMIN, exibe seletor de loja com opcao `Todas as lojas` e envia `lojaId` para /metricas/ranking/colaboradores.
- A loja escolhida no ranking de colaboradores para SUPER_ADMIN fica persistida em localStorage na chave na_ranking_colaboradores_superadmin_loja.
- STORE_ADMIN ve apenas colaboradores da propria loja e nao possui seletor de loja.
- Ao abrir em periodo 1d, aplica o mesmo tipo padrao por dia util usado em relatorios (seg/qui etiqueta, ter presenca, qua ruptura) e faz fallback automatico para todos os tipos quando nao houver dados no tipo sugerido.
- O botao `Compartilhar` exporta um PNG fiel ao estado atual da tela, incluindo filtros aplicados e render final dos cards, reutilizando o mesmo padrao de captura estabilizada do Dashboard.

### RankingLojas.vue

- View dedicada para ranking de lojas.
- Usa podium para top 3 e lista para as demais posicoes.
- Aceita filtros de periodo e tipo.
- Fica disponivel para SUPER_ADMIN e STORE_ADMIN.
- Nao possui seletor de loja; ambos enxergam o ranking geral das lojas no periodo/tipo selecionado.
- Destaca lojas com `auditoriasCanceladas > 0` usando alerta no podium e nas linhas da lista, mantendo os valores zerados para a auditoria cancelada.
- O botao `Compartilhar` exporta um PNG fiel ao estado atual da tela, incluindo filtros aplicados e render final dos cards, reutilizando o mesmo padrao de captura estabilizada do Dashboard.

### Lojas.vue

- Catalogo autenticado de lojas ativas.
- Consulta GET /lojas/catalogo com filtro de periodo, usando PeriodoSelector no topo.
- A lista exibe nome, localizacao, nivel, status operacional, total de auditorias por tipo, itens lidos, conformidade, pontuacao do periodo, custo de ruptura quando existir e ultima auditoria dentro do recorte ativo.
- Para `SUPER_ADMIN`, cada card pode cancelar a ultima auditoria ativa do periodo chamando POST /auditorias/:id/cancelar com lojaId, usando o snapshot `ultimaAuditoria` retornado pelo catalogo.
- A tela nao exibe mais metas base nos cards do catalogo; metas continuam no perfil analitico da loja e nas configuracoes.
- Permite buscar por nome, codigo, cidade ou slug e abrir o perfil analitico de qualquer loja.

### LojaPerfil.vue

- Consulta GET /metricas/lojas/:id/perfil.
- Reutiliza a linguagem de Dashboard e Relatorios para mostrar KPIs, serie de conformidade, distribuicao por tipo, situacoes, classes e corredores criticos, metas por tipo e ultimas auditorias.
- Exibe o detalhe de auditoria apenas quando o usuario realmente possui acesso ao tenant da loja ou quando e SUPER_ADMIN.
- Exibe status das ultimas auditorias e alerta quando existem cancelamentos no periodo, mas a acao de cancelamento ficou centralizada em Lojas.vue.
- Quando ha auditorias canceladas no periodo, mostra alerta e KPI dedicado para deixar claro que esses dados foram neutralizados.

### Colaboradores.vue

- Busca colaboradores por nome ou matricula.
- Quando o usuario e SUPER_ADMIN, a listagem pode operar em escopo global e exibe um dropdown de lojas ativas com a opcao `Todas as lojas` para alternar entre visao consolidada e tenant especifico.
- A loja escolhida em Colaboradores.vue fica persistida em localStorage na chave na_colaboradores_superadmin_loja.
- No modo `Todas as lojas`, o SUPER_ADMIN pode consultar todos os colaboradores de todas as lojas e cada card exibe a loja de origem para dar contexto.
- O cadastro de novo colaborador para SUPER_ADMIN continua dependente de uma loja especifica; com `Todas as lojas` selecionado, a tela permanece apenas em modo de consulta.
- Lista cards compactos com avatar, nivel, pontos e conformidade; quando o colaborador possui avatarUrl a foto real aparece em vez das iniciais. As conquistas ficam restritas ao perfil detalhado para reduzir altura e ruido visual na grade.
- O card inteiro abre o perfil do colaborador e a listagem nao exibe mais botoes dedicados de ver perfil ou exclusao.
- Permite criacao para perfis com permissao, sem expor desativacao na listagem.

### ColaboradorPerfil.vue

- Consulta GET /metricas/colaboradores/:id/perfil.
- Quando aberto a partir da listagem filtrada de SUPER_ADMIN, preserva `lojaId` na query para manter o retorno coerente ao contexto anterior.
- Para STORE_ADMIN e SUPER_ADMIN, a tela tambem permite editar nome, matricula, cargo, setor e foto do colaborador no proprio perfil.
- O upload da foto do colaborador usa recorte previo com Cropper.js 2.1.1 e guia visual circular para manter o avatar padronizado.
- A foto administrativa e salva no mesmo campo `avatarUrl` consumido pelo portal do colaborador, evitando divergencia entre os dois pontos de acesso.
- Exibe resumo do colaborador, conquistas, pontos, nivel e grafico por periodo, com filtro adicional por tipo de auditoria (`Todos os tipos`, ETIQUETA, PRESENCA e RUPTURA) e alternancia automatica entre colunas e linha conforme a densidade da serie.
- Quando um tipo selecionado nao possui leituras para o colaborador no periodo, a tela mostra o KPI daquele tipo zerado e um estado vazio no grafico, evitando reutilizar visualmente dados de outro tipo.

### Relatorios.vue

- Consulta simultaneamente /metricas/relatorios/situacoes, /metricas/relatorios/classes e /metricas/relatorios/corredores.
- Permite filtrar por periodo, custom range e tipo.
- Quando o usuario e SUPER_ADMIN, a tela tambem exibe um seletor de loja com a opcao `Todas as lojas` e propaga `lojaId` para as consultas de relatorio.
- A loja escolhida em Relatorios.vue fica persistida em localStorage na chave na_relatorios_superadmin_loja.
- Ao trocar tipo, periodo ou loja depois da carga inicial, a view mantém os dados atuais visíveis com estado de refresh suave e indicador `Atualizando...`, em vez de desmontar toda a tela com Loader completo.
- Exibe cards-resumo operacionais, grafico de situacoes, panorama das classes com maior leitura, grade completa por corredor e tabela operacional por classe.
- Ao abrir em periodo 1d, aplica tipo padrao por dia util (seg/qui etiqueta, ter presenca, qua ruptura) e faz fallback automatico para todos os tipos quando nao existir dado para o tipo sugerido.
- Os cards de corredor usam visual resumido por padrao e expandem detalhes (conformes, sem leitura, ruptura e ultima auditoria) ao clique, com porcentagem reduzida para preservar hierarquia com o status.
- Ao expandir corredor ou classe, a tela lista os colaboradores que efetivamente leram produtos naquela dimensao no periodo filtrado.
- A expansão de detalhes no relatório por corredor foi convertida para overlay dentro do card, evitando quebra de layout da grade ao abrir informações extras.
- A visualização detalhada por corredor/classe agora abre em overlay global fullscreen com fundo escurecido, sobrepondo toda a tela para leitura focada.
- A modal de detalhes segue a identidade visual do app com hero superior, cards internos e transição animada de entrada/saída, em vez de um painel neutro genérico.

### Configuracoes.vue

- Consulta dados da loja atual em /lojas/me.
- Para SUPER_ADMIN, exibe um card de seguranca da conta com troca da propria senha usando senha atual + nova senha + confirmacao.
- Permite editar dados cadastrais e metas da loja via PUT /lojas/:id.
- Permite enviar avatar da loja via POST /lojas/:id/avatar, sincronizando a foto no estado autenticado do app.
- O upload do avatar da loja usa recorte previo com Cropper para ajustar enquadramento e posicao antes do envio final.
- Como o projeto esta em Cropper.js 2.1.1, a exportacao da imagem final e feita pela selecao ativa via $toCanvas, com guia visual circular no modal para facilitar o enquadramento da foto da loja.
- Lista usuarios em /usuarios.
- Permite criar usuarios e desativa-los.

### AdminLojas.vue

- View exclusiva de super admin.
- Lista lojas via GET /lojas.
- Cada card tambem abre o perfil analitico publico da loja correspondente.
- Os cards usam a foto da loja quando houver avatarUrl, caindo para iniciais quando nao houver imagem.
- Permite criar via POST /lojas e desativar via DELETE /lojas/:id.

### AdminConquistas.vue

- View exclusiva de super admin para administrar conquistas do sistema de gamificacao.
- Consulta GET /conquistas e GET /conquistas/meta para listar definicoes, categorias e metricas disponiveis.
- Permite criar, editar, ativar/desativar e excluir conquistas via modal com tiers progressivos, usando POST, PUT e DELETE em /conquistas.
- No tema claro, o modal de criacao/edicao usa superfices mais opacas para preservar contraste em fundo, campos e linhas de tier.

### ColaboradorPortal.vue

- Tela mais complexa do frontend.
- Controla etapas buscar, selecionar, setup, login e portal.
- Renderiza InstallPWA.vue apenas nas etapas publicas do portal, nunca dentro do estado autenticado.
- O banner de instalacao captura beforeinstallprompt, segura a exibicao por 3 segundos, nao aparece em standalone e grava a primeira exibicao em localStorage para nao insistir novamente no mesmo navegador/usuario.
- No iPhone, quando o navegador nao fornece prompt nativo, o mesmo banner troca o CTA por instrucoes curtas para usar Compartilhar -> Adicionar a Tela de Inicio.
- Busca lojas por matricula em /auth/portal/verificar.
- Define senha em /auth/portal/setup.
- Faz login em /auth/portal/login.
- Carrega perfil em /colaboradores/portal/me.
- Carrega metricas em /metricas/portal/me.
- Carrega a lista de colegas em /metricas/portal/me/colegas e abre o perfil publico de cada colega em uma pagina dedicada do portal, resolvida por /metricas/portal/me/colegas/:id/perfil.
- Faz upload de avatar em /colaboradores/:id/avatar.
- Passou a renderizar a foto do colaborador pelo mesmo componente ColaboradorAvatar.vue usado no app principal, garantindo resolucao correta de `avatarUrl` relativo a uploads.
- O modal de recorte do portal foi alinhado ao fluxo do ColaboradorPerfil.vue e agora usa Cropper.js 2.1.1 com selecao circular e exportacao via `$toCanvas`.
- Exibe avatar da loja na etapa de selecao da unidade e nos resumos de setup/login quando a loja possuir foto configurada.
- Troca senha em /colaboradores/portal/password.
- Usa Cropper.js para recorte antes do upload.
- A aba `Inicio` exibe no topo os colegas ativos da mesma loja, com cards redesenhados que mostram nome curto, cargo e KPIs resumidos e navegam para `/portal/colegas/:colegaId` ao abrir o perfil publico com foto, conquistas desbloqueadas e resultados analiticos resumidos.
- As conquistas agora abrem um modal de detalhes ao clique/toque, com descricao completa, data de obtencao, requisitos por tier e historico de desbloqueio.
- O overlay de detalhes da conquista usa ajustes locais no tema claro para manter contraste sobre backdrop blur.
- O grafico historico do portal alterna automaticamente entre colunas e linha conforme a quantidade de pontos no periodo.
- A aba `Corredores` deixou de depender do payload historico de `GET /metricas/portal/me` e passou a delegar essa experiencia ao componente `AuditoriaDodia.vue`.

### AuditoriaDodia.vue

- Componente dedicado da aba `Corredores` do portal.
- Consulta `GET /metricas/portal/me/auditoria-do-dia` para mostrar somente a auditoria em andamento hoje e exibe a auditoria anterior apenas quando o colaborador aciona o botao de consulta manual.
- Quando precisa abrir a anterior, chama a mesma rota com `origem=anterior`, mantendo a auditoria do dia como comportamento padrao.
- Divide a tela entre `Meus corredores` e `Demais corredores`, destacando o corredor mais recentemente movimentado pelo colaborador.
- Ao abrir um corredor, consulta `GET /metricas/portal/me/auditoria-do-dia/corredor` para montar o modal com participantes, progresso e itens.

## Componentes reutilizados

- PeriodoSelector.vue: tabs animadas para 1d, semana, mes, ano, tudo e custom.
- AppChart.vue: wrapper central de Chart.js com defaults por tipo, merge profundo de opcoes, adaptacao ao tema e normalizacao visual de datasets.
- KpiCard.vue: card curto para metricas numericas.
- Loader.vue: estado de carregamento.
- StoreAvatar.vue: renderer reutilizavel do avatar da loja com fallback para iniciais quando nao ha foto.
- StoreAvatar.vue tambem normaliza URLs relativas de uploads para o host correto da API antes de renderizar a imagem.
- StoreAvatar.vue usa elemento img real com object-fit cover e fallback para iniciais quando a URL falha, garantindo exibicao consistente do avatar da loja em LojaPerfil, Lojas, RankingLojas, AdminLojas, AppLayout e portal.
- captureExport.js: util compartilhado para exportar uma area da tela com html2canvas usando clone fora do viewport, sincronizacao de inputs/selects, copia de canvases e aplicacao explicita do tema atual.

## Chaves de localStorage confirmadas

- na_token
- na_usuario
- na_loja
- na_tema
- na_portal_token
- na_portal_tema
- na_portal_pwa_install_prompt_seen (com sufixo opcional da matricula quando o usuario ja foi identificado)
- na_auditorias_superadmin_loja
- na_ranking_colaboradores_superadmin_loja

## Dependencias de dados do frontend

- Toda a aplicacao autenticada depende do token principal e do endpoint /auth/me para hidratar usuario e loja.
- Todas as telas analiticas dependem de MetricaDiaria, acessada indiretamente pelas rotas de metricas.
- O portal do colaborador depende de um token diferente, nao compartilhado com a store auth principal.
