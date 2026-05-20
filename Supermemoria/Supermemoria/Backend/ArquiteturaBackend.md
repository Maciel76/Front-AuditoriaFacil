# Arquitetura Backend

## Stack e composicao

- Node.js em ESM
- Express 5
- MongoDB + Mongoose 8
- JWT via jsonwebtoken
- Validacao de payload com Zod
- Hash de senha com bcryptjs
- Upload com Multer
- Datas com dayjs
- Parse de planilhas com xlsx

## Estrutura de backend/src

- server.js: bootstrap da API, middleware global, rotas, healthcheck e servico estatico de uploads.
- config/env.js: leitura de variaveis de ambiente e defaults.
- config/db.js: conexao MongoDB.
- middlewares/: autenticacao, escopo multi-tenant e upload.
- models/: schemas centrais do dominio.
- routes/: handlers HTTP organizados por recurso.
- services/: logica pesada de classificacao, parser, gamificacao e processamento de auditoria.
- utils/: helpers de erro e JWT.

## Ciclo de inicializacao

1. Carrega env.
2. Conecta ao MongoDB.
3. Garante bootstrap de SUPER_ADMIN se ainda nao existir nenhum.
4. Semeia conquistas padrao se a colecao Conquista ainda estiver vazia.
5. Sobe Express com helmet, cors, json parser, urlencoded, morgan e rate limiter.
6. Registra /api/health, /uploads e os grupos de rota.
7. Aplica middleware de 404 e errorMiddleware.

## Middleware global confirmado

- helmet com crossOriginResourcePolicy desativado para nao bloquear uploads estaticos.
- cors com allowlist configuravel por CORS_ORIGIN.
- express.json com limite de 5 MB.
- express-rate-limit: 300 requisicoes por minuto em /api/.
- morgan com formato diferente por ambiente.

## Publicacao atual do backend

- Ambiente de producao confirmado em VPS Ubuntu 24.04.
- Codigo publicado no caminho `/var/www/Back-AuditoriaFacil`.
- Processo Node mantido por PM2 com o nome `flashrub-backend`.
- Porta interna atual: `4100`.
- O backend nao publica HTML proprio em producao; o acesso externo correto passa por `https://flashub.mywire.org/api` e `https://flashub.mywire.org/uploads`.
- O arquivo de Nginx da publicacao atual fica em `/etc/nginx/sites-available/flashub.mywire.org` e o host exposto publica apenas `/api/` e `/uploads/`.
- O Nginx faz redirect de HTTP para HTTPS e usa certificado Let's Encrypt para `flashub.mywire.org`.
- A allowlist atual de CORS em producao inclui `http://localhost:5173` e `https://flashub-auditoria.vercel.app`.
- A base MongoDB usada em producao roda localmente na mesma VPS, acessada por `MONGO_URI` apontando para `localhost:27017`.
- O `JWT_SECRET` de producao foi definido fora do valor padrao de desenvolvimento, invalidando tokens antigos quando houve a rotacao do segredo.

## Padrrao de rotas

Nao existe camada separada de controller. A logica HTTP fica nos proprios arquivos de rota com asyncHandler. O padrao praticado e:

1. Validacao com Zod.
2. Aplicacao de autenticar, escopoLoja e/ou exigirRole.
3. Consulta ou mutacao em models.
4. Resposta JSON simples.

## Autenticacao e autorizacao

### Usuario administrativo

- Middleware: autenticar.
- Payload JWT: sub, role, loja.
- Fonte de identidade: model Usuario.
- Roles validos: SUPER_ADMIN, STORE_ADMIN, COLABORADOR.

### Colaborador do portal

- Middleware: autenticarColaborador.
- Payload JWT: sub, tipo=colaborador, loja.
- Fonte de identidade: model Colaborador.
- Esse token nao deve passar por rotas protegidas apenas por autenticar.

### Escopo multi-tenant

- escopoLoja define req.escopoLojaId.
- SUPER_ADMIN pode informar lojaId em query ou body.
- Usuarios nao super admin sempre ficam presos a propria loja.
- exigirEscopoLoja impede acesso a rotas que precisam de loja resolvida.

## Camada de servicos

### services/regras.js

- Mantem a matriz oficial de classificacao e pontuacao por tipo de auditoria.
- Exporta REGRAS e a funcao classificar.

### services/planilhaParser.js

- Le planilhas XLSX, XLSM, XLSB, XLS, CSV e ODS.
- Normaliza colunas por alias.
- Converte datas, horas, numeros e booleanos.
- Extrai usuario no formato matricula + nome.
- Detecta tipo por sheet, nome do arquivo ou situacoes encontradas.
- Decide a data oficial pela ocorrencia mais frequente de auditadoEm.

### services/conquistasService.js

- Mantem cache curto das conquistas ativas para evitar leitura repetida em massa durante uploads.
- Avalia tiers por metricaBase e meta, atualizando `colab.conquistas` in place.
- Quando a definicao possui `tipoAuditoria`, le `metricasPorTipo` do colaborador em vez do acumulado global correspondente.
- Tambem consegue avaliar a metrica `totalItensParticipacaoLoja`, que soma o volume lido pela loja apenas nas auditorias em que o colaborador participou.
- Soma `xpBonus` apenas para tiers recem-desbloqueados.
- Persiste `historicoDesbloqueios` por tier no estado do colaborador, incluindo data, meta, bonus e titulo do marco atingido.
- Faz fallback do historico do portal a partir de `desbloqueadaEm` ou `ultimaAtualizacao` quando encontra estados legados sem historico granular salvo.
- Resolve conquistas enriquecidas para exibicao no portal do colaborador.

### services/conquistasSeed.js

- Cria as conquistas padrao do sistema quando a colecao ainda esta vazia.
- Exporta tambem uma rotina de sincronizacao para inserir conquistas padrao faltantes em bases que ja estavam povoadas.
- O seed e executado no bootstrap do servidor e deixa a manutencao futura para o painel administrativo de conquistas.

### services/colaboradorMetricas.js

- Centraliza a estrutura zerada e a normalizacao de `metricasPorTipo`.
- Garante as chaves `ETIQUETA`, `PRESENCA` e `RUPTURA` com `totalAuditorias`, `totalItensLidos` e `totalItensConformes`.

### services/auditoriaProcessor.js

- E a peca central do sistema.
- Garante colaboradores por loja e matricula.
- Reaproveita auditoria existente para reupload do mesmo dia e tipo.
- Quando a auditoria existente esta `CANCELADA`, aceita o reupload como substituicao documental, mas mantem itens e metricas neutralizados.
- Quando `totalLidos` fica abaixo do limite configurado em `Loja.regrasUpload.minItensLidosAuditoriaValida` (padrao 500), marca a auditoria como `INVALIDA`, nao grava `AuditItem`, remove qualquer `MetricaDiaria` anterior daquele dia/tipo e, em reuploads, recompõe os acumulados da loja a partir das metricas ainda validas.
- Gera AuditItems em massa.
- Calcula totais da auditoria e top colaboradores do upload.
- Gera ou atualiza MetricaDiaria consolidada por loja e por colaborador.
- Mantem acumulados globais e `metricasPorTipo` por colaborador, inclusive quando o reupload remove pessoas do arquivo atual.
- Mantem tambem `totalItensParticipacaoLoja`, usando o `totalLidos` consolidado da loja apenas para quem participou daquele upload.
- Atualiza pontuacao, nivel e conquistas de colaboradores.
- Recalcula o nivel antes e depois de avaliar conquistas, para absorver bonus de XP no mesmo ciclo de upload.
- Atualiza pontuacao e nivel da loja.
- Agora tambem emite etapas e percentual de progresso para o fluxo assíncrono de upload.

### services/auditoriaCancelamento.js

- Centraliza o cancelamento de auditorias de loja.
- Marca Auditoria como `CANCELADA`, marca AuditItems como cancelados, zera MetricaDiaria do dia/tipo/loja e recalcula acumulados da loja e dos colaboradores a partir de metricas nao canceladas.
- Reconstroi tambem `metricasPorTipo` antes de limpar e reavaliar as conquistas do colaborador.
- Reconstroi tambem `totalItensParticipacaoLoja` combinando participacao diaria do colaborador com o total lido consolidado da loja em cada auditoria valida.
- Mantem uma MetricaDiaria consolidada zerada e cancelada para permitir alerta no ranking de lojas.

### scripts/sync-conquistas-padrao.js

- Conecta no banco e chama a sincronizacao idempotente das conquistas padrao.
- Serve para inserir novas conquistas default em ambientes que ja tinham a colecao `Conquista` populada.

## Rotas backend por responsabilidade

### auth.routes.js

- Cadastro de loja com admin.
- Login do app principal.
- Endpoint /me.
- Fluxo completo do portal do colaborador: verificar matricula, setup e login.

### auditorias.routes.js

- Exibe regras da auditoria.
- Recebe upload, cria job em memoria, dispara processamento em background e expoe consulta de status por jobId.
- Lista auditorias, retorna detalhe, pagina itens, cancela auditoria de loja para SUPER_ADMIN e remove auditoria.

### colaboradores.routes.js

- Cadastro e edicao administrativa de colaboradores, com exclusao/desativacao bloqueada no backend.
- Autenticacao mista para avatar.
- Self-service do portal em /portal/me e /portal/password.

### conquistas.routes.js

- Exponibiliza metadados de tiers, categorias, metricas e tipos de auditoria suportados.
- Lista definicoes de conquistas e oferece CRUD restrito a SUPER_ADMIN, incluindo filtro por `tipoAuditoria`.
- Exponibiliza uma rota dedicada para resolver conquistas do proprio colaborador do portal, incluindo progresso, proximo tier e historico por tier.
- Invalida o cache das conquistas apos mutacoes administrativas.

### lojas.routes.js

- Lista lojas conforme role.
- Retorna a loja ativa do escopo.
- Cria, atualiza e desativa lojas.

### usuarios.routes.js

- Lista usuarios no escopo.
- Cria usuario respeitando role do solicitante.
- Exponibiliza PUT /api/usuarios/me/senha para troca da propria senha com validacao da senha atual e bloqueio de reutilizacao da senha vigente.
- Atualiza nome, senha, role e ativo.
- Remove logicamente por ativo=false.

### metricas.routes.js

- Dashboard, ultima data, rankings, perfil de colaborador, relatorios e perfil do portal.
- Faz agregacoes diretamente sobre MetricaDiaria e AuditItem.
- Usa uma funcao de periodo ancorada na ultima data existente na base.
- Os relatorios operacionais usam AuditItem para agregar dimensoes como situacao, classeRaiz e local, permitindo leituras por classe e por corredor sem depender de MetricaDiaria.
- Nas agregacoes por classe/corredor, o backend tambem devolve colaboradores por dimensao (total lido, conformes e nao conformes) para alimentar o drill-down da tela de relatorios.
- O portal agora expoe uma rota resumida da auditoria do dia e uma rota de detalhe por corredor, evitando carregar historico completo de corredores em `GET /metricas/portal/me`.
- A rota resumida da auditoria do dia responde somente a auditoria atual por padrao; a auditoria anterior so e carregada quando o frontend envia `origem=anterior`.
- O calculo de progresso por corredor reaplica a mesma regra de classificacao usada no `auditoriaProcessor`, mantendo coerencia entre itens auditaveis, itens lidos e conformidade no modal do portal.

## Seguranca e validacoes

- Senhas com bcrypt de 10 rounds.
- JWT configurado por JWT_SECRET e JWT_EXPIRES.
- Rate limiting global na API.
- Payloads principais validados com Zod.
- Upload de planilhas restringe extensoes e mimetypes.
- Upload de avatar aceita apenas image/\* e limita a 5 MB.

## Arquivos fora do runtime principal

- backend/scripts/testParser.mjs: teste local do parser sem depender de MongoDB.
- backend/.env.example: referencia de configuracao.

## Ponto estrutural importante

O backend depende fortemente do model MetricaDiaria para leitura analitica. Uploads e reuploads mudam o historico agregado; por isso, qualquer alteracao em auditoriaProcessor.js afeta dashboards, rankings, relatorios e perfis do colaborador.
