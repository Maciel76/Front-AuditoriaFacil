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
- services/: logica pesada de classificacao, parser e processamento de auditoria.
- utils/: helpers de erro e JWT.

## Ciclo de inicializacao

1. Carrega env.
2. Conecta ao MongoDB.
3. Garante bootstrap de SUPER_ADMIN se ainda nao existir nenhum.
4. Sobe Express com helmet, cors, json parser, urlencoded, morgan e rate limiter.
5. Registra /api/health, /uploads e os grupos de rota.
6. Aplica middleware de 404 e errorMiddleware.

## Middleware global confirmado

- helmet com crossOriginResourcePolicy desativado para nao bloquear uploads estaticos.
- cors com allowlist configuravel por CORS_ORIGIN.
- express.json com limite de 5 MB.
- express-rate-limit: 300 requisicoes por minuto em /api/.
- morgan com formato diferente por ambiente.

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

### services/auditoriaProcessor.js

- E a peca central do sistema.
- Garante colaboradores por loja e matricula.
- Reaproveita auditoria existente para reupload do mesmo dia e tipo.
- Gera AuditItems em massa.
- Calcula totais da auditoria e top colaboradores do upload.
- Gera ou atualiza MetricaDiaria consolidada por loja e por colaborador.
- Atualiza pontuacao, nivel e conquistas de colaboradores.
- Atualiza pontuacao e nivel da loja.
- Agora tambem emite etapas e percentual de progresso para o fluxo assíncrono de upload.

## Rotas backend por responsabilidade

### auth.routes.js

- Cadastro de loja com admin.
- Login do app principal.
- Endpoint /me.
- Fluxo completo do portal do colaborador: verificar matricula, setup e login.

### auditorias.routes.js

- Exibe regras da auditoria.
- Recebe upload, cria job em memoria, dispara processamento em background e expoe consulta de status por jobId.
- Lista auditorias, retorna detalhe, pagina itens e remove auditoria.

### colaboradores.routes.js

- Cadastro e edicao administrativa de colaboradores, com exclusao/desativacao bloqueada no backend.
- Autenticacao mista para avatar.
- Self-service do portal em /portal/me e /portal/password.

### lojas.routes.js

- Lista lojas conforme role.
- Retorna a loja ativa do escopo.
- Cria, atualiza e desativa lojas.

### usuarios.routes.js

- Lista usuarios no escopo.
- Cria usuario respeitando role do solicitante.
- Atualiza nome, senha, role e ativo.
- Remove logicamente por ativo=false.

### metricas.routes.js

- Dashboard, ultima data, rankings, perfil de colaborador, relatorios e perfil do portal.
- Faz agregacoes diretamente sobre MetricaDiaria e AuditItem.
- Usa uma funcao de periodo ancorada na ultima data existente na base.
- Os relatorios operacionais usam AuditItem para agregar dimensoes como situacao, classeRaiz e local, permitindo leituras por classe e por corredor sem depender de MetricaDiaria.
- Nas agregacoes por classe/corredor, o backend tambem devolve colaboradores por dimensao (total lido, conformes e nao conformes) para alimentar o drill-down da tela de relatorios.

## Seguranca e validacoes

- Senhas com bcrypt de 10 rounds.
- JWT configurado por JWT_SECRET e JWT_EXPIRES.
- Rate limiting global na API.
- Payloads principais validados com Zod.
- Upload de planilhas restringe extensoes e mimetypes.
- Upload de avatar aceita apenas image/* e limita a 5 MB.

## Arquivos fora do runtime principal

- backend/scripts/testParser.mjs: teste local do parser sem depender de MongoDB.
- backend/.env.example: referencia de configuracao.

## Ponto estrutural importante

O backend depende fortemente do model MetricaDiaria para leitura analitica. Uploads e reuploads mudam o historico agregado; por isso, qualquer alteracao em auditoriaProcessor.js afeta dashboards, rankings, relatorios e perfis do colaborador.