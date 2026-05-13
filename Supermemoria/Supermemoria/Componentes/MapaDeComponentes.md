# Mapa de Componentes e Views

## Componentes base

### AppChart.vue

- Wrapper central para Chart.js.
- Recebe type, data, options e height.
- Aplica defaults visuais por tipo de grafico, merge profundo de opcoes, normalizacao de datasets e leitura do tema atual.
- Reage a mudancas de tema para manter legibilidade no modo claro e escuro.
- E reutilizado em dashboard, auditoria detalhe, relatorios, rankings, perfil do colaborador e portal.

### KpiCard.vue

- Componente curto de exibicao de numero, rotulo, tendencia e icone.
- Usado para destacar KPIs sem replicar markup.

### Loader.vue

- Spinner simples para estados de carregamento.
- E o fallback padrao das views enquanto a API responde.

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

### Auditorias.vue

- Mescla upload com historico.
- E a principal entrada de dados operacionais do sistema.

### AuditoriaDetalhe.vue

- Faz drill-down do upload em nivel de item auditado.
- Explica a composicao de uma auditoria ja processada.

### Rankings.vue

- Interface de comparacao.
- Implementa podium para as tres primeiras posicoes e lista para as demais.
- Recebe filtro de tipo e periodo, com transicoes visuais entre estados.

### Colaboradores.vue

- Catalogo de colaboradores do tenant.
- Mistura consulta de desempenho com administracao basica.

### ColaboradorPerfil.vue

- Drill-down analitico de um colaborador especifico.
- Usa serie por dia e totais por tipo.

### Relatorios.vue

- Gera visoes agregadas por situacao e por classe/setor.
- E a tela mais orientada a analise operacional detalhada.

### Configuracoes.vue

- Une dados cadastrais da loja com administracao de usuarios.
- Funciona como painel administrativo de tenant.

### AdminLojas.vue

- Catalogo global de lojas.
- Visivel apenas para super admin.

### ColaboradorPortal.vue

- Fluxo publico e independente do app principal.
- Centraliza autenticacao por matricula, selecao de loja, setup/login, visualizacao de metricas e configuracoes pessoais.
- E o ponto de contato principal do colaborador final com o sistema.

## Relacoes entre componentes

- App.vue envolve o router e o sistema de toast.
- AppLayout.vue envolve todas as views autenticadas.
- PeriodoSelector.vue alimenta Dashboard, Relatorios, Rankings, ColaboradorPerfil e portal do colaborador.
- AppChart.vue aparece em todas as views analiticas.

## Dependencias funcionais importantes

- PeriodoSelector depende de contratos de periodo aceitos pelo backend.
- ColaboradorPortal depende de rotas exclusivas do portal e nao deve reutilizar store auth.
- Configuracoes depende de /lojas/me e /usuarios.
- Rankings e Dashboard dependem da integridade de MetricaDiaria.