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

| Metodo | Rota                  | Auth               | Escopo             | Corpo ou query principal                  | Funcao                                                             |
| ------ | --------------------- | ------------------ | ------------------ | ----------------------------------------- | ------------------------------------------------------------------ |
| GET    | /api/lojas            | Usuario            | Role-dependente    | -                                         | SUPER_ADMIN recebe todas; demais recebem a propria                 |
| GET    | /api/lojas/me         | Usuario            | Loja obrigatoria   | lojaId opcional para super admin          | Retorna loja do escopo                                             |
| GET    | /api/lojas/catalogo   | Usuario            | Global autenticado | -                                         | Lista lojas ativas com campos publicos para navegacao e descoberta |
| POST   | /api/lojas/:id/avatar | Usuario autorizado | Role/tenant        | multipart avatar                          | Atualiza a foto publica da loja                                    |
| POST   | /api/lojas            | SUPER_ADMIN        | Nenhum             | nome, slug, codigo, cidade, estado, metas | Cria loja                                                          |
| PUT    | /api/lojas/:id        | Usuario autorizado | Role/tenant        | campos parciais de loja                   | Atualiza loja; nao super admin so pode a propria                   |
| DELETE | /api/lojas/:id        | SUPER_ADMIN        | Nenhum             | -                                         | Desativa loja                                                      |

## Grupo Usuarios

| Metodo | Rota              | Auth               | Escopo          | Corpo ou query principal         | Funcao                                                   |
| ------ | ----------------- | ------------------ | --------------- | -------------------------------- | -------------------------------------------------------- |
| GET    | /api/usuarios     | Usuario            | Loja ou global  | lojaId opcional para super admin | Lista usuarios do escopo                                 |
| POST   | /api/usuarios     | Usuario            | Role-dependente | nome, email, senha, role, lojaId | Cria usuario; nao super admin nao pode criar SUPER_ADMIN |
| PUT    | /api/usuarios/:id | Usuario autorizado | Tenant          | nome, senha, ativo, role         | Atualiza usuario                                         |
| DELETE | /api/usuarios/:id | Usuario autorizado | Tenant          | -                                | Desativa usuario                                         |

## Grupo Colaboradores

| Metodo | Rota                               | Auth                       | Escopo           | Corpo ou query principal          | Funcao                                                |
| ------ | ---------------------------------- | -------------------------- | ---------------- | --------------------------------- | ----------------------------------------------------- |
| GET    | /api/colaboradores/portal/me       | Token colaborador          | Propria loja     | -                                 | Retorna o proprio colaborador do portal               |
| POST   | /api/colaboradores/portal/password | Token colaborador          | Propria loja     | senhaAtual, novaSenha             | Troca senha do portal                                 |
| POST   | /api/colaboradores/:id/avatar      | Usuario ou colaborador     | Proprio recurso  | multipart avatar                  | Atualiza avatar; colaborador so altera a propria foto |
| GET    | /api/colaboradores                 | Usuario                    | Loja obrigatoria | q, page, limit                    | Lista colaboradores                                   |
| POST   | /api/colaboradores                 | SUPER_ADMIN ou STORE_ADMIN | Loja obrigatoria | nome, codigoExterno, cargo, setor | Cria colaborador                                      |
| PUT    | /api/colaboradores/:id             | SUPER_ADMIN ou STORE_ADMIN | Loja obrigatoria | nome, codigoExterno, cargo, setor | Atualiza colaborador sem alterar ativo                |
| DELETE | /api/colaboradores/:id             | SUPER_ADMIN ou STORE_ADMIN | Loja obrigatoria | -                                 | Retorna 403; exclusao de colaborador desabilitada     |
| POST   | /api/colaboradores/:id/usuario     | SUPER_ADMIN ou STORE_ADMIN | Loja obrigatoria | email, senha, nome                | Vincula conta de Usuario a um colaborador             |

## Grupo Auditorias

| Metodo | Rota                                 | Auth                       | Escopo               | Corpo ou query principal               | Funcao                                                       |
| ------ | ------------------------------------ | -------------------------- | -------------------- | -------------------------------------- | ------------------------------------------------------------ |
| GET    | /api/auditorias/regras               | Usuario                    | Nenhum               | -                                      | Retorna matriz REGRAS                                        |
| POST   | /api/auditorias/upload               | SUPER_ADMIN ou STORE_ADMIN | Loja obrigatoria     | multipart arquivo, opcional tipo       | Cria job de processamento de auditoria e devolve jobId       |
| GET    | /api/auditorias/upload/:jobId/status | Usuario autenticado        | Mesmo usuario do job | jobId                                  | Consulta progresso, etapa, resultado final ou erro do upload |
| GET    | /api/auditorias                      | Usuario                    | Loja obrigatoria     | tipo, dataInicio, dataFim, page, limit | Lista auditorias                                             |
| GET    | /api/auditorias/:id                  | Usuario                    | Loja obrigatoria     | -                                      | Retorna cabecalho da auditoria                               |
| GET    | /api/auditorias/:id/itens            | Usuario                    | Loja obrigatoria     | situacao, conforme, q, page, limit     | Pagina itens detalhados                                      |
| DELETE | /api/auditorias/:id                  | SUPER_ADMIN ou STORE_ADMIN | Loja obrigatoria     | -                                      | Remove auditoria e seus itens                                |

## Grupo Metricas

| Metodo | Rota                                   | Auth              | Escopo                         | Corpo ou query principal           | Funcao                                        |
| ------ | -------------------------------------- | ----------------- | ------------------------------ | ---------------------------------- | --------------------------------------------- |
| GET    | /api/metricas/portal/me                | Token colaborador | Proprio colaborador            | periodo, dataInicio, dataFim       | Perfil analitico do portal                    |
| GET    | /api/metricas/dashboard                | Usuario           | Loja ou global                 | periodo, dataInicio, dataFim       | Dashboard consolidado                         |
| GET    | /api/metricas/ultima-data              | Usuario           | Loja ou global                 | lojaId opcional                    | Ultima data com dados em MetricaDiaria        |
| GET    | /api/metricas/ranking/colaboradores    | Usuario           | Loja ou global conforme escopo | periodo, tipo, dataInicio, dataFim | Ranking de colaboradores                      |
| GET    | /api/metricas/ranking/lojas            | Usuario           | Global                         | periodo, tipo, dataInicio, dataFim | Ranking de lojas                              |
| GET    | /api/metricas/lojas/:id/perfil         | Usuario           | Loja explicita por id          | periodo, tipo, dataInicio, dataFim | Perfil analitico publico de uma loja          |
| GET    | /api/metricas/colaboradores/:id/perfil | Usuario           | Loja opcional                  | periodo, dataInicio, dataFim       | Perfil analitico do colaborador               |
| GET    | /api/metricas/relatorios/situacoes     | Usuario           | Loja ou global                 | periodo, tipo, dataInicio, dataFim | Relatorio por situacao                        |
| GET    | /api/metricas/relatorios/classes       | Usuario           | Loja ou global                 | periodo, tipo, dataInicio, dataFim | Relatorio agregado por classe                 |
| GET    | /api/metricas/relatorios/corredores    | Usuario           | Loja ou global                 | periodo, tipo, dataInicio, dataFim | Relatorio agregado por corredor/local         |
| GET    | /api/metricas/relatorios/setores       | Usuario           | Loja ou global                 | periodo, tipo, dataInicio, dataFim | Alias legado do relatorio agregado por classe |

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
- /api/metricas/ranking/lojas nao esta explicitamente protegida por exigirRole no backend; a restricao principal hoje aparece no frontend.
- /api/metricas/lojas/:id/perfil nao depende de escopoLoja; ele recebe a loja por id, mas continua exigindo autenticacao no app principal.
- As rotas do portal em colaboradores.routes.js estao posicionadas antes de router.use(autenticar) para aceitar o token proprio do colaborador.
