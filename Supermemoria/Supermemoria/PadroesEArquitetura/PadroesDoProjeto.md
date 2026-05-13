# Padroes do Projeto

## Padrao arquitetural geral

- SPA Vue no frontend.
- API REST monolitica em Express no backend.
- Mongoose como camada de persistencia.
- Services dedicados para logica pesada de negocio e transformacao de dados.
- Rotas com handlers inline para operacoes CRUD e agregacoes.

## Padroes de nomenclatura

- Views em PascalCase com responsabilidade por tela.
- Stores em minusculo no nome do arquivo e defineStore com nome curto.
- Rotas backend agrupadas por recurso em <recurso>.routes.js.
- Models em PascalCase refletindo o nome da entidade.

## Padrao de autenticacao

- App principal: token em na_token, identidade via Usuario.
- Portal: token em na_portal_token, identidade via Colaborador.
- Nunca assumir que um Bearer token serve para ambos os fluxos.

## Padrao de multi-tenant

- Toda rota sensivel a tenant deve usar escopoLoja.
- Toda query dependente de tenant deve usar req.escopoLojaId ou req.usuario.loja.
- SUPER_ADMIN pode agir globalmente ou informar lojaId.

## Padrao de analytics

- Leitura pesada deve preferir MetricaDiaria sempre que possivel.
- AuditItem fica reservado a drill-down detalhado e relatorios de base.
- Periodos devem usar a ancora da ultima data disponivel quando o objetivo for historico operacional.

## Padrao de upload e processamento

- O parser normaliza tudo para um shape canonico antes da persistencia.
- A classificacao vem sempre de services/regras.js.
- O processamento deve permanecer idempotente para a chave loja + tipo + data.

## Padrao de frontend

- Views consomem api.js diretamente; nao ha camada adicional de query client.
- Pinia e usada apenas para auth e UI global, nao para todos os dados de tela.
- PeriodoSelector e o componente padrao para filtros temporais.
- AppLayout concentra comportamento de shell, navegacao, tema e responsividade.

## Padrao de documentacao desta memoria

- Registrar apenas comportamento confirmado no codigo.
- Se algo estiver em implementacao parcial, marcar como parcial e citar a fonte.
- Toda feature nova deve atualizar pelo menos:
  - a visao geral, quando impactar fluxo principal
  - a secao especifica de frontend ou backend
  - rotas, quando houver novo endpoint ou nova rota de UI
  - banco, quando houver schema novo ou alterado
  - regras de negocio, quando houver mudanca de regra
  - historico de alteracoes

## Antipadroes a evitar

- Reutilizar middleware de usuario em fluxo do portal do colaborador.
- Sobrescrever Authorization em chamadas que ja definiram token manualmente.
- Calcular periodos historicos apenas com base em hoje.
- Alterar parser sem revisar regras, processor e contratos de metricas.

## Ausencias arquiteturais relevantes

- Sem testes automatizados.
- Sem fila ou processamento assíncrono externo para uploads.
- Sem observabilidade estruturada alem de morgan e logs simples.
- Sem versionamento formal de API.