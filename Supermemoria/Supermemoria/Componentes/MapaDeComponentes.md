# Mapa de Componentes e Views

## Componentes base

### AppChart.vue

- Wrapper central para Chart.js.
- Recebe type, data, options e height.
- Aplica defaults visuais por tipo de grafico, merge profundo de opcoes, normalizacao de datasets e leitura do tema atual.
- Reage a mudancas de tema para manter legibilidade no modo claro e escuro.
- E reutilizado em dashboard, auditoria detalhe, relatorios, ranking de colaboradores, ranking de lojas, perfil do colaborador e portal.

### KpiCard.vue

- Componente curto de exibicao de numero, rotulo, tendencia e icone.
- Usado para destacar KPIs sem replicar markup.

### Loader.vue

- Spinner simples para estados de carregamento.
- E o fallback padrao das views enquanto a API responde.

### StoreAvatar.vue

- Componente visual reutilizavel para representar lojas.
- Renderiza foto publica da loja quando houver avatarUrl e usa iniciais como fallback.

### ColaboradorAvatar.vue

- Componente visual reutilizavel para representar colaboradores.
- Renderiza a foto do colaborador quando houver avatarUrl e cai para iniciais somente como fallback.
- Usa resolverUrlMidia para normalizar URLs relativas de uploads antes de renderizar a imagem.
- E compartilhado entre o app principal e o portal do colaborador para manter exibicao consistente da mesma foto salva em `avatarUrl`.

### PerfilPublicoColaborador.vue

- Componente de conteudo da pagina publica do portal para exibir um colega da mesma loja.
- Recebe resumo do colega para abrir rapidamente e carrega foto, KPIs, conquistas desbloqueadas e historico de leituras por tipo.
- Usa ColaboradorAvatar.vue e AppChart.vue para manter a mesma linguagem visual do restante do sistema.

### InstallPWA.vue

- Componente isolado do prompt de instalacao do app.
- Escuta beforeinstallprompt, posterga o banner por 3 segundos e so exibe CTA quando o navegador liberou a instalacao.
- Quando detecta iPhone fora de standalone, exibe instrucoes de instalacao manual pela opcao Adicionar a Tela de Inicio.
- Bloqueia reexibicao via localStorage e se esconde automaticamente quando o app ja esta em standalone.
- E usado apenas nas etapas publicas de ColaboradorPortal.vue.

### PeriodoSelector.vue

- Controla v-model de periodo.
- Tambem emite dataInicio e dataFim quando o periodo e custom.
- Oferece tabs animadas e painel de datas com transicao.
- Padroes disponiveis: Hoje, Semana, Mes, Ano, Historico e Periodo customizado.

## Layout principal

### AppLayout.vue

- Sidebar com navegacao principal.
- Footer com usuario, alternancia de tema e logout.
- Topbar com titulo derivado da rota e badge do tipo sugerido pelo dia da semana.
- Controle responsivo da sidebar com backdrop para mobile.

## Views operacionais

### Login.vue

- View de entrada do sistema administrativo.
- Encapsula login e onboarding de loja.

### Dashboard.vue

- Painel sintetico da operacao.
- Usa KpiCard, AppChart e PeriodoSelector.
- Dependencia central: GET /metricas/dashboard.
- No periodo `1d`, substitui o grafico de conformidade do card principal por `DashboardDesempenhoHoje.vue`.
- Tambem implementa exportacao visual da tela atual via html2canvas usando clone offscreen da captureArea, com sincronizacao de filtros e copia manual dos canvases de Chart.js para preservar a aparencia real da tela.

### DashboardDesempenhoHoje.vue

- Componente dedicado ao recorte diario de desempenho no Dashboard.
- Consulta GET /metricas/ranking/colaboradores com os filtros atuais de tipo e loja do Dashboard.
- Renderiza barras verticais por quantidade de itens lidos no dia, com eixo X reduzido ao primeiro nome de cada colaborador, e um resumo textual do lider atual.

### Auditorias.vue

- Mescla upload com historico.
- E a principal entrada de dados operacionais do sistema.

### AuditoriaDetalhe.vue

- Faz drill-down do upload em nivel de item auditado.
- Explica a composicao de uma auditoria ja processada.

### RankingColaboradores.vue

- Interface de comparacao exclusiva para colaboradores.
- Implementa podium para as tres primeiras posicoes e lista para as demais.
- Recebe filtro de tipo e periodo e, para SUPER_ADMIN, filtro adicional de loja.
- Oculta os modos `Maior pontuacao` e `Maior % de conformidade` na selecao de ranking de colaboradores.
- Nos modos de custo, usa `custoRupturaEvitado` para ranquear o valor que cada colaborador evitou nas leituras de RUPTURA.
- Tambem exporta um print fiel da tela atual por meio do util compartilhado de captura.

### RankingLojas.vue

- Interface de comparacao exclusiva para lojas.
- Implementa podium para as tres primeiras posicoes e lista para as demais.
- Recebe filtro de tipo e periodo, sem filtro de loja.
- Nos modos de custo, usa `custoRupturaEvitado` para ranquear o valor evitado pelas lojas nas leituras de RUPTURA.
- Inclui o modo `Mais cancelamentos`, baseado em `auditoriasCanceladas`.
- Tambem exporta um print fiel da tela atual por meio do util compartilhado de captura.

### Lojas.vue

- Catalogo autenticado de lojas ativas.
- Funciona como diretorio de entrada para os perfis analiticos publicos das lojas.
- Usa PeriodoSelector para filtrar o resumo operacional dos cards por periodo.
- Cada card resume nome, localizacao com codigo antes da cidade, itens lidos, auditorias por tipo, ultima auditoria e custo operacional de RUPTURA quando houver; os blocos pequenos de auditorias totais, conformidade e pontuacao do periodo nao aparecem mais no card.
- Os badges de slug/codigo, nivel/status operacional e o botao de cancelar auditoria nao aparecem mais no card do catalogo.

### LojaPerfil.vue

- Drill-down analitico de uma loja especifica.
- Reaproveita AppChart, KpiCard e PeriodoSelector para unir leitura executiva do dashboard com recortes operacionais de relatorios.
- Mantem badges e alerta de auditorias canceladas, sem concentrar a acao de cancelamento.

### Colaboradores.vue

- Catalogo de colaboradores do tenant.
- Mistura consulta de desempenho com administracao basica.

### ColaboradorPerfil.vue

- Drill-down analitico de um colaborador especifico.
- Usa serie por dia e totais por tipo, com filtros de periodo e tipo de auditoria.
- Agora tambem concentra edicao administrativa de dados cadastrais e foto do colaborador.

### Relatorios.vue

- Gera visoes agregadas por situacao e por classe/setor.
- E a tela mais orientada a analise operacional detalhada.

### Configuracoes.vue

- Une dados cadastrais da loja com administracao de usuarios.
- Funciona como painel administrativo de tenant.
- Agora concentra tambem o envio da foto publica da loja.

### AdminLojas.vue

- Catalogo global de lojas.
- Visivel apenas para super admin.
- Cada card tambem serve como atalho para o perfil publico autenticado da loja.
- Em lojas ativas, oferece acao de cancelamento preventivo da auditoria do dia quando ainda nao houve upload.

### ColaboradorPortal.vue

- Fluxo publico e independente do app principal.
- Centraliza autenticacao por matricula, selecao de loja, setup/login, visualizacao de metricas e configuracoes pessoais.
- Renderiza InstallPWA.vue apenas antes do login, mantendo o prompt de instalacao restrito a rota /portal e fora da experiencia autenticada.
- Usa o mesmo campo `avatarUrl` do colaborador e o mesmo padrao de crop do perfil administrativo para upload e exibicao da foto.
- Mantem `ConquistaCard` como componente local via render function e cada card abre um modal com descricao, requisitos e historico de desbloqueio da conquista.
- A logica de conquista resolve a imagem por tier especifico (`tierAtualImagem`, `tiers[].imagemUrl` ou fallback estatico) e reutiliza isso no card, no hero do modal e nas listas de requisitos e historico; sem imagem, o fallback continua sendo o `icone` da conquista.
- Os cards de conquista da grade principal foram simplificados: nao exibem mais a lista de chips de todos os tiers e a descricao/progresso ocupam a largura total abaixo do topo com icone e titulo, evitando espaco morto ao lado esquerdo.
- O modal de detalhe da conquista nao exibe mais a grade superior de cards-resumo; o foco fica direto na lista de requisitos, e os tiers desbloqueados recebem um fundo esverdeado para sinalizar conclusao visual imediata.
- A aba `Inicio` passou a abrir com uma lista de colegas ativos da mesma loja e cada card navega para a pagina `/portal/colegas/:colegaId`, onde `PerfilPublicoColaborador.vue` renderiza o perfil publico do colega.
- `PerfilPublicoColaborador.vue` exibe no topo do perfil publico o nivel do colega, total de auditorias realizadas e total acumulado de itens lidos, alem das conquistas e do historico analitico.
- As conquistas exibidas em `PerfilPublicoColaborador.vue` tambem disparam o mesmo modal de detalhes usado na grade principal do portal; assim, ao visitar um colega, o colaborador consegue abrir a conquista e ver o progresso, requisitos por tier e historico daquele colega.
- No mobile, o hero de `PerfilPublicoColaborador.vue` preserva a foto do colega, compacta a tipografia e reorganiza os indicadores em grade responsiva para evitar quebra ruim e sobras de espaco em telas estreitas.
- Ao abrir um perfil publico em `ColaboradorPortal.vue`, a topbar superior mostra apenas o contexto `Perfil público`; o nome do colega fica concentrado no card de apresentacao para evitar duplicidade visual.
- Os indicadores do hero em `PerfilPublicoColaborador.vue` foram simplificados para um resumo menor, com fundo transparente, sem bordas e icones compactos.
- No mobile, a grade de conquistas em `PerfilPublicoColaborador.vue` fecha em 2 cards por linha com icone e tipografia reduzidos, evitando cortes laterais e excesso de altura por card.
- E o ponto de contato principal do colaborador final com o sistema.

### AuditoriaDodia.vue

- Componente isolado da aba `Corredores` do portal.
- Carrega a auditoria do dia em endpoint proprio e deixa a auditoria anterior atras de um botao explicito, evitando misturar a operacao atual com historico.
- Exibe `Meus corredores` e `Demais corredores`, destaca o corredor atual do colaborador e abre modal sob demanda com equipe e itens do corredor.
- O painel-resumo superior com status/data/contadores foi removido para deixar a tela mais limpa; a expansao de `Demais corredores` continua disponivel no proprio cabecalho da secao.
- No modal de itens, quando a auditoria e do tipo `ETIQUETA`, exibe tambem o filtro `Desatualizadas`, baseado em `item.situacao === "Desatualizado"`.
- Os cards de corredores seguem o visual clean de `Relatorios.vue`, com status coloridos por faixa de desempenho (`Excelente`, `Bom`, `Atenção`, `Crítico`) em verde, azul, amarelo e vermelho.

## Relacoes entre componentes

- App.vue envolve o router e o sistema de toast.
- AppLayout.vue envolve todas as views autenticadas.
- PeriodoSelector.vue alimenta Dashboard, Relatorios, RankingColaboradores, RankingLojas, ColaboradorPerfil e portal do colaborador.
- AppChart.vue aparece em todas as views analiticas.
- InstallPWA.vue depende do evento beforeinstallprompt do navegador e e renderizado dentro de ColaboradorPortal.vue apenas enquanto o fluxo esta fora do estado autenticado.
- Em iPhone, InstallPWA.vue usa deteccao local de iOS para substituir o CTA nativo por instrucoes manuais de instalacao no banner.
- AuditoriaDodia.vue depende das rotas exclusivas do portal e e renderizado dentro de ColaboradorPortal.vue apenas quando a aba `Corredores` esta ativa.
- Em AuditoriaDodia.vue, a secao `Demais corredores` fica recolhida por padrao para priorizar os corredores do proprio colaborador; a expansao pode ser feita pelo card-resumo ou pelo cabecalho com seta.
- PerfilPublicoColaborador.vue depende das rotas exclusivas do portal para listar colegas e resolver o perfil publico de um colaborador da mesma loja dentro de uma rota dedicada do proprio portal.

## Dependencias funcionais importantes

- PeriodoSelector depende de contratos de periodo aceitos pelo backend.
- ColaboradorPortal depende de rotas exclusivas do portal e nao deve reutilizar store auth.
- Configuracoes depende de /lojas/me e /usuarios.
- RankingColaboradores, RankingLojas e Dashboard dependem da integridade de MetricaDiaria.
- LojaPerfil depende de /metricas/lojas/:id/perfil e combina MetricaDiaria, Auditoria e AuditItem em uma unica tela.
