# Fluxos Principais do Sistema

## Fluxo 1 - Cadastro inicial de loja

1. Usuario acessa /login e alterna para a aba de cadastro.
2. Frontend envia POST /api/auth/register-loja com bloco loja e bloco admin.
3. Backend cria Loja.
4. Backend cria Usuario STORE_ADMIN vinculado a essa loja.
5. Backend assina token e devolve usuario + loja.
6. Frontend persiste autenticacao e entra na aplicacao.

## Fluxo 2 - Login administrativo

1. Usuario informa email e senha.
2. Frontend chama POST /api/auth/login.
3. Backend valida Usuario e senhaHash.
4. Backend retorna token, usuario e loja.
5. Store auth persiste dados e App.vue tenta carregar /auth/me nas proximas montagens.

## Fluxo 3 - Upload de auditoria

1. Usuario gerencial abre Auditorias.vue.
2. Se o usuario for SUPER_ADMIN, escolhe explicitamente a loja de destino antes de habilitar o upload; esse contexto tambem passa a reger o historico da tela.
3. Usuario seleciona arquivo e pode informar tipo manual.
4. Frontend envia multipart para POST /api/auditorias/upload.
5. Quando o usuario e SUPER_ADMIN, o frontend envia lojaId por query string para garantir o escopo correto antes do multer.
6. Backend valida role, arquivo e escopo de loja, cria um job em memoria e devolve jobId.
7. Frontend acompanha o progresso em duas fases: envio do arquivo e processamento do job.
8. Frontend consulta GET /api/auditorias/upload/:jobId/status ate o status final.
9. planilhaParser normaliza linhas e detecta tipo/data. A data e extraida da coluna auditadoEm (dia mais frequente) — nao da data do upload.
10. auditoriaProcessor garante colaboradores, classifica linhas, persiste AuditItems, atualiza Auditoria, MetricaDiaria, Colaborador e Loja, mantem acumulados globais, por tipo e de participacao da loja, e emite progresso por etapa.
11. Se a chave loja + tipo + data ja estiver cancelada, o processador substitui os itens, mantem a auditoria como `CANCELADA`, zera as metricas e devolve resultado com `cancelada: true`.
12. Frontend recebe o resultado final do job, atualiza o historico filtrado pela loja escolhida e exibe o resumo do processamento ou o aviso de cancelamento.

> **Carregamento de historico**: o sistema aceita planilhas de qualquer data passada. Basta enviar normalmente; cada planilha sera indexada pela data real da auditoria e alimentara todos os periodos (dia, semana, mes, ano, tudo) retroativamente. Apos carregar um lote de historico, executar `scripts/recompute-acumulados.js` garante consistencia dos acumulados globais, dos recortes por tipo, dos contadores de participacao da loja e das conquistas avaliadas pelo motor atual.

## Fluxo 4 - Dashboard e analytics

1. View chama /api/metricas/dashboard com periodo.
2. metricas.routes resolve o intervalo usando a ultima data disponivel.
3. Backend agrega MetricaDiaria consolidada e busca ultimas auditorias.
4. Frontend renderiza KPI cards, graficos e cards por tipo.

## Fluxo 5 - Ranking

1. Usuario escolhe periodo e tipo.
2. Frontend consulta /api/metricas/ranking/colaboradores ou /api/metricas/ranking/lojas.
3. Backend agrega MetricaDiaria e junta dados de Colaborador ou Loja.
4. Frontend renderiza podium e tabela.

## Fluxo 6 - Relatorios

1. Usuario escolhe periodo e tipo em Relatorios.vue.
2. Frontend dispara /api/metricas/relatorios/situacoes e /api/metricas/relatorios/setores em paralelo.
3. Backend agrega dados por situacao e por classe/setor.
4. Frontend exibe graficos e tabela detalhada.

## Fluxo 7 - Configuracoes administrativas

1. View carrega /api/lojas/me e /api/usuarios.
2. Usuario edita dados da loja e salva com PUT /api/lojas/:id.
3. Quando desejar, envia a foto publica da loja com POST /api/lojas/:id/avatar.
4. Usuario cria novo usuario com POST /api/usuarios.
5. Usuario desativa perfis com DELETE /api/usuarios/:id.

## Fluxo 8 - Portal do colaborador

### Etapa buscar

1. Colaborador acessa /portal.
2. Informa matricula.
3. Frontend chama GET /api/auth/portal/verificar.
4. Backend procura a matricula em todas as lojas ativas e devolve a lista.

### Etapa selecionar

1. Frontend ordena lojas, privilegiando a query opcional ?loja.
2. Usuario escolhe a loja.
3. Frontend decide entre setup e login pelo campo primeiroAcesso.

### Etapa setup

1. Frontend envia POST /api/auth/portal/setup.
2. Backend salva senhaHash no Colaborador e troca primeiroAcesso para false.
3. Backend devolve token de colaborador.

### Etapa login

1. Frontend envia POST /api/auth/portal/login.
2. Backend valida senha do Colaborador e emite token do portal.

### Etapa portal

1. Frontend carrega /api/colaboradores/portal/me.
2. Frontend carrega /api/metricas/portal/me?periodo=tudo.
3. Frontend carrega `GET /api/metricas/portal/me/colegas` para listar os colegas ativos da mesma loja logo no topo da aba `Inicio`.
4. Backend resolve conquistas do colaborador com base no estado atual e nas definicoes ativas.
5. Ao tocar em um colega, o portal navega para `/portal/colegas/:colegaId` e chama `GET /api/metricas/portal/me/colegas/:id/perfil` para montar uma pagina dedicada com foto, conquistas desbloqueadas, KPIs e historico de leituras do colaborador selecionado.
6. Quando a aba `Corredores` e aberta, o componente `AuditoriaDodia.vue` consulta `GET /api/metricas/portal/me/auditoria-do-dia` para carregar apenas a auditoria mais recente da loja.
7. Se nao houver auditoria hoje, o backend devolve apenas o aviso e a informacao de que existe uma auditoria anterior disponivel.
8. Quando o colaborador toca em `Ver auditoria anterior`, o frontend chama `GET /api/metricas/portal/me/auditoria-do-dia?origem=anterior` para abrir essa consulta manualmente.
9. O componente separa `Meus corredores` dos `Demais corredores` e destaca o corredor mais recentemente movimentado pelo colaborador.
10. Ao tocar em um corredor, o portal chama `GET /api/metricas/portal/me/auditoria-do-dia/corredor` para abrir um modal com progresso, participantes e itens daquele corredor.
11. Ao tocar em uma conquista, o portal abre um modal com descricao completa, data de obtencao, requisitos por tier e historico de desbloqueio.

## Fluxo 9 - Avatar do colaborador

1. Usuario escolhe um arquivo de imagem no portal.
2. Frontend abre Cropper.js e permite recorte.
3. Frontend converte o resultado e envia multipart para /api/colaboradores/:id/avatar.
4. Backend valida ownership, salva novo arquivo e remove avatar antigo quando existe.
5. Frontend atualiza perfil local.

## Fluxo 10 - Troca de senha do portal

1. Colaborador preenche senha atual e nova senha.
2. Frontend chama POST /api/colaboradores/portal/password.
3. Backend valida a senha atual e grava novo hash.
4. Frontend exibe feedback de sucesso ou erro.

## Fluxo 11 - Catalogo e perfil publico de loja

1. Usuario autenticado abre /lojas.
2. Frontend consulta GET /api/lojas/catalogo para listar lojas ativas com campos publicos.
3. Usuario escolhe uma loja e navega para /lojas/:id.
4. Frontend envia GET /api/metricas/lojas/:id/perfil com periodo, tipo e datas custom quando necessario.
5. Backend agrega MetricaDiaria, AuditItem, Auditoria e Colaborador apenas para a loja solicitada.
6. Frontend renderiza KPIs, serie de conformidade, distribuicao por tipo, situacoes, destaques por classe e corredor e ultimas auditorias.
7. Quando o usuario nao tem acesso ao tenant da loja, o perfil continua visivel, mas o link para o detalhe da auditoria permanece restrito.

## Fluxo 12 - Gamificacao, XP e niveis do colaborador

1. Um upload em /api/auditorias/upload passa pelo auditoriaProcessor.
2. O processador classifica os itens, soma a pontuacao operacional do colaborador e atualiza seus acumulados globais (`totalItensLidos`, `totalItensConformes`, `totalAuditorias`, `pontuacao`), por tipo (`metricasPorTipo`) e de participacao (`totalItensParticipacaoLoja`).
3. O nivel e recalculado pela formula `max(1, floor(pontuacao / 500) + 1)`.
4. Em seguida, `avaliarConquistas(colab)` percorre todas as conquistas ativas e compara a `metricaBase` atual do colaborador com as metas de cada tier, usando o recorte por tipo quando a definicao pedir `tipoAuditoria` e usando o acumulado de participacao quando a conquista acompanhar o volume lido da loja com presenca do colaborador.
5. Tiers recem-desbloqueados concedem `xpBonus`, que e somado em `colab.pontuacao` uma unica vez por tier novo.
6. O nivel e recalculado novamente depois do bonus de XP, garantindo que uma conquista tambem possa subir o nivel no mesmo ciclo.
7. O estado persistido em `colab.conquistas` guarda codigo, tier atual, tiers desbloqueados, historico por tier, progresso e timestamps.
8. No portal, `GET /api/metricas/portal/me` chama `resolverConquistasPortal` e devolve a lista pronta para UI com progresso, proximo tier, labels, cores e historico de desbloqueio.
9. A aba Inicio mostra nivel, barra de XP e conquistas em destaque; a aba Conquistas mostra a lista completa com filtros por categoria e status, e cada card abre um modal detalhado.
10. A manutencao das definicoes fica no painel `/admin/conquistas`, exclusivo de SUPER_ADMIN, com suporte a conquistas globais ou restritas a ETIQUETA, PRESENCA ou RUPTURA.

> Documentacao detalhada: [[Gamificacao/Bem-vindo]]

## Fluxo 13 - Cancelamento de auditoria da loja

1. SUPER_ADMIN abre o catalogo de lojas em `/lojas`.
2. No card da loja, clica para cancelar a ultima auditoria ativa do periodo.
3. Frontend chama `POST /api/auditorias/:id/cancelar` com `lojaId` por query string.
4. Backend valida role, escopo e existencia da auditoria.
5. Backend marca a Auditoria como `CANCELADA`, marca AuditItems como `cancelada: true`, zera MetricaDiaria da loja/tipo/data e recalcula acumulados da loja e dos colaboradores, inclusive o recorte `metricasPorTipo` e o acumulado `totalItensParticipacaoLoja` usado pela conquista de participacao.
6. Catalogo e perfil da loja passam a refletir a ausencia da auditoria ativa e o alerta de cancelamentos no periodo.
7. Ranking de lojas recebe `auditoriasCanceladas` e destaca a loja com alerta, sem somar itens, pontos ou conformidade da auditoria cancelada.

> Documentacao detalhada: [[Auditorias/CancelamentoDeAuditorias]]
