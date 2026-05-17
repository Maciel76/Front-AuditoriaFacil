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
10. auditoriaProcessor garante colaboradores, classifica linhas, persiste AuditItems, atualiza Auditoria, MetricaDiaria, Colaborador e Loja, emitindo progresso por etapa.
11. Frontend recebe o resultado final do job, atualiza o historico filtrado pela loja escolhida e exibe o resumo do processamento.

> **Carregamento de historico**: o sistema aceita planilhas de qualquer data passada. Basta enviar normalmente; cada planilha sera indexada pela data real da auditoria e alimentara todos os periodos (dia, semana, mes, ano, tudo) retroativamente. Apos carregar um lote de historico, executar `scripts/recompute-acumulados.js` garante consistencia dos acumulados.

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
3. Colaborador visualiza dados pessoais, metricas e configuracoes.

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
