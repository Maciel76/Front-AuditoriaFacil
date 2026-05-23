# Rotas API

## Base

- Prefixo padrao: /api
- Healthcheck: GET /api/health
- Arquivos estaticos: /uploads

## Convencoes gerais

- A maioria das rotas protegidas usa Bearer token JWT.
- Rotas multi-tenant dependem de req.escopoLojaId resolvido por escopoLoja.
- SUPER_ADMIN pode informar lojaId para agir em outro tenant nas rotas que usam escopoLoja.

## Grupo Auth

| Metodo | Rota                       | Auth    | Escopo                    | Corpo ou query principal     | Funcao                                                                  |
| ------ | -------------------------- | ------- | ------------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| POST   | /api/auth/register-loja    | Nao     | Nenhum                    | loja, admin                  | Cria loja e primeiro STORE_ADMIN                                        |
| POST   | /api/auth/login            | Nao     | Nenhum                    | email, senha                 | Login do app principal                                                  |
| GET    | /api/auth/me               | Usuario | Usuario                   | -                            | Retorna usuario autenticado e loja vinculada                            |
| GET    | /api/auth/portal/verificar | Nao     | Colaborador por matricula | matricula, opcional lojaSlug | Descobre lojas disponiveis para matricula ou valida uma loja especifica |
| POST   | /api/auth/portal/setup     | Nao     | Colaborador               | matricula, lojaSlug, senha   | Primeiro acesso do portal; define senha e emite token de colaborador    |
| POST   | /api/auth/portal/login     | Nao     | Colaborador               | matricula, lojaSlug, senha   | Login do portal do colaborador                                          |

## Grupo Lojas

| Metodo | Rota                  | Auth               | Escopo             | Corpo ou query principal                  | Funcao                                                                  |
| ------ | --------------------- | ------------------ | ------------------ | ----------------------------------------- | ----------------------------------------------------------------------- |
| GET    | /api/lojas            | Usuario            | Role-dependente    | -                                         | SUPER_ADMIN recebe todas; demais recebem a propria                      |
| GET    | /api/lojas/me         | Usuario            | Loja obrigatoria   | lojaId opcional para super admin          | Retorna loja do escopo                                                  |
| GET    | /api/lojas/catalogo   | Usuario            | Global autenticado | periodo, dataInicio, dataFim              | Lista lojas ativas com campos publicos e resumo operacional por periodo |
| POST   | /api/lojas/:id/avatar | Usuario autorizado | Role/tenant        | multipart avatar                          | Atualiza a foto publica da loja                                         |
| POST   | /api/lojas            | SUPER_ADMIN        | Nenhum             | nome, slug, codigo, cidade, estado, metas | Cria loja                                                               |
| PUT    | /api/lojas/:id        | Usuario autorizado | Role/tenant        | campos parciais de loja                   | Atualiza loja; nao super admin so pode a propria                        |
| DELETE | /api/lojas/:id        | SUPER_ADMIN        | Nenhum             | -                                         | Desativa loja                                                           |

## Grupo Usuarios

| Metodo | Rota                   | Auth               | Escopo          | Corpo ou query principal         | Funcao                                                            |
| ------ | ---------------------- | ------------------ | --------------- | -------------------------------- | ----------------------------------------------------------------- |
| GET    | /api/usuarios          | Usuario            | Loja ou global  | lojaId opcional para super admin | Lista usuarios do escopo                                          |
| POST   | /api/usuarios          | Usuario            | Role-dependente | nome, email, senha, role, lojaId | Cria usuario; nao super admin nao pode criar SUPER_ADMIN          |
| PUT    | /api/usuarios/me/senha | Usuario            | Propria conta   | senhaAtual, senhaNova            | Troca a senha do usuario autenticado com validacao da senha atual |
| PUT    | /api/usuarios/:id      | Usuario autorizado | Tenant          | nome, senha, ativo, role         | Atualiza usuario                                                  |
| DELETE | /api/usuarios/:id      | Usuario autorizado | Tenant          | -                                | Desativa usuario                                                  |

## Grupo Colaboradores

| Metodo | Rota                               | Auth                       | Escopo           | Corpo ou query principal                                             | Funcao                                                                                |
| ------ | ---------------------------------- | -------------------------- | ---------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| GET    | /api/colaboradores/portal/me       | Token colaborador          | Propria loja     | -                                                                    | Retorna o proprio colaborador do portal                                               |
| POST   | /api/colaboradores/portal/password | Token colaborador          | Propria loja     | senhaAtual, novaSenha                                                | Troca senha do portal                                                                 |
| POST   | /api/colaboradores/:id/avatar      | Usuario ou colaborador     | Proprio recurso  | multipart avatar (imagem ate 5 MB, lojaId opcional para SUPER_ADMIN) | Atualiza avatar; colaborador so altera a propria foto e admin respeita escopo da loja |
| GET    | /api/colaboradores                 | Usuario                    | Loja ou global   | q, page, limit, lojaId opcional                                      | Lista colaboradores; SUPER_ADMIN pode consultar tudo ou filtrar uma loja              |
| POST   | /api/colaboradores                 | SUPER_ADMIN ou STORE_ADMIN | Loja obrigatoria | nome, codigoExterno, cargo, setor                                    | Cria colaborador                                                                      |
| PUT    | /api/colaboradores/:id             | SUPER_ADMIN ou STORE_ADMIN | Loja obrigatoria | nome, codigoExterno, cargo, setor                                    | Atualiza colaborador sem alterar ativo                                                |
| DELETE | /api/colaboradores/:id             | SUPER_ADMIN ou STORE_ADMIN | Loja obrigatoria | -                                                                    | Retorna 403; exclusao de colaborador desabilitada                                     |
| POST   | /api/colaboradores/:id/usuario     | SUPER_ADMIN ou STORE_ADMIN | Loja obrigatoria | email, senha, nome                                                   | Vincula conta de Usuario a um colaborador                                             |

## Grupo Conquistas

| Metodo | Rota                           | Auth                         | Escopo              | Corpo ou query principal                                                                               | Funcao                                                                           |
| ------ | ------------------------------ | ---------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| GET    | /api/conquistas/meta           | Usuario ou token colaborador | Nenhum              | -                                                                                                      | Retorna tiers, categorias, metricas e tipos de auditoria suportados              |
| GET    | /api/conquistas/portal/me      | Token colaborador            | Proprio colaborador | -                                                                                                      | Resolve conquistas do colaborador com progresso, requisitos e historico por tier |
| GET    | /api/conquistas                | Usuario                      | Global autenticado  | ativa, categoria, tipoAuditoria                                                                        | Lista definicoes de conquistas                                                   |
| POST   | /api/conquistas                | SUPER_ADMIN                  | Nenhum              | codigo, nome, descricao, icone, categoria, metricaBase, tipoAuditoria, recorrente, tiers, ativa, ordem | Cria uma nova conquista configuravel                                             |
| PUT    | /api/conquistas/:id            | SUPER_ADMIN                  | Nenhum              | campos parciais da conquista, incluindo tipoAuditoria                                                  | Atualiza conquista existente e invalida cache                                    |
| DELETE | /api/conquistas/:id            | SUPER_ADMIN                  | Nenhum              | -                                                                                                      | Remove conquista                                                                 |
| POST   | /api/conquistas/:id/recalcular | SUPER_ADMIN                  | Nenhum              | -                                                                                                      | Invalida cache das definicoes; nao faz recalculo historico em massa              |

## Grupo Auditorias

| Metodo | Rota                                 | Auth                       | Escopo               | Corpo ou query principal                 | Funcao                                                                 |
| ------ | ------------------------------------ | -------------------------- | -------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| GET    | /api/auditorias/regras               | Usuario                    | Nenhum               | -                                        | Retorna matriz REGRAS                                                  |
| POST   | /api/auditorias/upload               | SUPER_ADMIN ou STORE_ADMIN | Loja obrigatoria     | multipart arquivo, opcional tipo         | Cria job de processamento de auditoria e devolve jobId                 |
| GET    | /api/auditorias/upload/:jobId/status | Usuario autenticado        | Mesmo usuario do job | jobId                                    | Consulta progresso, etapa, resultado final ou erro do upload           |
| GET    | /api/auditorias                      | Usuario                    | Loja obrigatoria     | tipo, dataInicio, dataFim, page, limit   | Lista auditorias                                                       |
| GET    | /api/auditorias/:id                  | Usuario                    | Loja obrigatoria     | -                                        | Retorna cabecalho da auditoria                                         |
| GET    | /api/auditorias/:id/itens            | Usuario                    | Loja obrigatoria     | situacao, conforme, q, page, limit       | Pagina itens detalhados                                                |
| POST   | /api/auditorias/cancelar-dia         | SUPER_ADMIN                | Loja obrigatoria     | tipo, data, motivo opcional, lojaId      | Cria cancelamento do dia sem planilha enviada                          |
| POST   | /api/auditorias/:id/cancelar         | SUPER_ADMIN ou STORE_ADMIN | Loja obrigatoria     | motivo opcional, lojaId para SUPER_ADMIN | Cancela auditoria da loja, zera metricas do dia e recalcula acumulados |
| DELETE | /api/auditorias/:id                  | SUPER_ADMIN ou STORE_ADMIN | Loja obrigatoria     | -                                        | Remove auditoria e seus itens                                          |

## Grupo Metricas

| Metodo | Rota                                              | Auth              | Escopo                         | Corpo ou query principal                            | Funcao                                                                  |
| ------ | ------------------------------------------------- | ----------------- | ------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------- |
| GET    | /api/metricas/portal/me                           | Token colaborador | Proprio colaborador            | periodo, dataInicio, dataFim                        | Perfil analitico do portal                                              |
| GET    | /api/metricas/portal/me/colegas                   | Token colaborador | Propria loja                   | -                                                   | Lista colegas ativos da mesma loja para o portal                        |
| GET    | /api/metricas/portal/me/colegas/:id/perfil        | Token colaborador | Propria loja                   | periodo, tipo, dataInicio, dataFim                  | Perfil publico resumido de um colega da mesma loja                      |
| GET    | /api/metricas/portal/me/auditoria-do-dia          | Token colaborador | Propria loja                   | origem opcional = hoje ou anterior                  | Resumo da auditoria atual do portal; a anterior so e aberta sob demanda |
| GET    | /api/metricas/portal/me/auditoria-do-dia/corredor | Token colaborador | Propria loja                   | auditoriaId, local                                  | Detalhe de um corredor especifico da auditoria exibida no portal        |
| GET    | /api/metricas/dashboard                           | Usuario           | Loja ou global                 | periodo, dataInicio, dataFim                        | Dashboard consolidado                                                   |
| GET    | /api/metricas/ultima-data                         | Usuario           | Loja ou global                 | lojaId opcional                                     | Ultima data com dados em MetricaDiaria                                  |
| GET    | /api/metricas/ranking/colaboradores               | Usuario           | Loja ou global conforme escopo | periodo, tipo, dataInicio, dataFim                  | Ranking de colaboradores                                                |
| GET    | /api/metricas/ranking/lojas                       | Usuario           | Global                         | periodo, tipo, dataInicio, dataFim                  | Ranking de lojas                                                        |
| GET    | /api/metricas/lojas/:id/perfil                    | Usuario           | Loja explicita por id          | periodo, tipo, dataInicio, dataFim                  | Perfil analitico publico de uma loja                                    |
| GET    | /api/metricas/colaboradores/:id/perfil            | Usuario           | Loja opcional                  | periodo, tipo, dataInicio, dataFim                  | Perfil analitico do colaborador                                         |
| GET    | /api/metricas/relatorios/situacoes                | Usuario           | Loja ou global                 | periodo, tipo, dataInicio, dataFim, lojaId opcional | Relatorio por situacao                                                  |
| GET    | /api/metricas/relatorios/classes                  | Usuario           | Loja ou global                 | periodo, tipo, dataInicio, dataFim, lojaId opcional | Relatorio agregado por classe                                           |
| GET    | /api/metricas/relatorios/corredores               | Usuario           | Loja ou global                 | periodo, tipo, dataInicio, dataFim, lojaId opcional | Relatorio agregado por corredor/local                                   |
| GET    | /api/metricas/relatorios/setores                  | Usuario           | Loja ou global                 | periodo, tipo, dataInicio, dataFim, lojaId opcional | Alias legado do relatorio agregado por classe                           |

## Periodos suportados no backend

- 1d
- hoje
- semana
- 7d
- mes
- 30d
- 90d
- ano
- tudo
- custom com dataInicio e dataFim

## Observacoes criticas

- A ancora temporal usa a ultima data existente na base para evitar telas vazias quando nao ha dados do dia atual.
- GET /api/metricas/ranking/colaboradores retorna `custoRupturaEvitado`, soma de `AuditItem.custoRuptura` dos itens lidos em auditorias RUPTURA por colaborador no periodo.
- GET /api/metricas/ranking/lojas retorna `custoRupturaEvitado`, soma de `AuditItem.custoRuptura` dos itens lidos em auditorias RUPTURA por loja no periodo.
- GET /api/metricas/dashboard retorna `cardsResumo` para os cinco KPIs do topo. Em geral, `cardsResumo.mediaConclusao` e media simples de `Auditoria.taxaConformidade` no periodo filtrado; quando `tipo=PRESENCA`, `cardsResumo.produtosAuditados` passa a ser a soma das situacoes `Com Presenca e com Estoque` + `Sem Presenca e Com Estoque` e `cardsResumo.mediaConclusao` passa a usar `Com Presenca e com Estoque / total * 100`. `cardsResumo.custoRupturaRuptura` sempre soma apenas auditorias do tipo RUPTURA no periodo; `cardsResumo.totalColaboradores` ignora o filtro de tipo e conta colaboradores distintos com leitura no periodo.
- GET /api/lojas/catalogo retorna `periodo` e `items`; cada loja ativa recebe `resumoPeriodo` com total de auditorias, auditorias por tipo, itens lidos, conformidade, pontuacao, custo ruptura e ultima auditoria dentro do periodo filtrado.
- Auditorias canceladas permanecem no historico com `status=CANCELADA`, mas ficam fora das metricas. `GET /api/metricas/ranking/lojas` retorna `auditoriasCanceladas` para a UI destacar lojas com cancelamento no periodo e alimentar o modo `Mais cancelamentos`.
- O frontend atual do portal consome `GET /api/metricas/portal/me` para metricas e conquistas resolvidas, `GET /api/metricas/portal/me/colegas` para a lista de equipe e `GET /api/metricas/portal/me/colegas/:id/perfil` para montar a pagina `/portal/colegas/:colegaId`; a aba `Corredores` continua usando `GET /api/metricas/portal/me/auditoria-do-dia` e `GET /api/metricas/portal/me/auditoria-do-dia/corredor` para evitar carregar historico completo de corredores no payload principal.
- Em `GET /api/metricas/portal/me/auditoria-do-dia`, a query `origem=anterior` e a unica forma de consultar a auditoria anterior; sem a query, a resposta fica restrita ao contexto do dia atual.
- `GET /api/conquistas/meta` entrega `tiposAuditoria` para a tela administrativa montar conquistas globais ou restritas a um tipo.
- O mesmo `GET /api/conquistas/meta` tambem passa a refletir a metrica `totalItensParticipacaoLoja`, usada pela conquista recorrente de participacao na leitura total da loja.
- O array `conquistas` retornado ao portal inclui `desbloqueadaEm`, `proximoTier` e `historicoDesbloqueios[]`; cada item do historico traz `nivel`, `label`, `cor`, `meta`, `xpBonus`, `titulo` e `desbloqueadoEm` para a UI abrir o detalhe da conquista sem nova chamada.
- /api/metricas/ranking/lojas permanece sem exigirRole explicito na rota, mas o retorno agora e global para SUPER_ADMIN e STORE_ADMIN; perfis fora desse escopo continuam restritos a propria loja.
- /api/metricas/lojas/:id/perfil nao depende de escopoLoja; ele recebe a loja por id, mas continua exigindo autenticacao no app principal.
- As rotas do portal em colaboradores.routes.js estao posicionadas antes de router.use(autenticar) para aceitar o token proprio do colaborador.
