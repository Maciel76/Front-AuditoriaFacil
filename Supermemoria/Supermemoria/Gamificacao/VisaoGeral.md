# Visao Geral da Gamificacao

## O que o sistema chama de XP hoje

- No codigo atual, XP e a mesma grandeza de `pontuacao` do colaborador.
- Essa pontuacao vem de duas fontes:
  1. pontos operacionais gerados pelos itens de auditoria classificados como contaveis
  2. bonus de XP (`xpBonus`) concedido ao desbloquear tiers novos de conquista

## Formula atual de nivel

- `nivel = max(1, floor(pontuacao / 500) + 1)`
- Faixas praticas:
  - 0 a 499 pontos = nivel 1
  - 500 a 999 pontos = nivel 2
  - 1000 a 1499 pontos = nivel 3
- Nao existe teto de nivel implementado no runtime atual.

## Onde cada parte vive

### Definicao mestre da conquista

- Model: `backend/src/models/Conquista.js`
- Guarda `codigo`, `nome`, `descricao`, `icone`, `cor`, `categoria`, `metricaBase`, `recorrente`, `tiers`, `ativa` e `ordem`.

### Estado da conquista no colaborador

- Model: `backend/src/models/Colaborador.js`
- Campo: `conquistas[]`
- Cada item guarda:
  - `codigo`
  - `tierAtual`
  - `tiersDesbloqueados[]`
  - `progresso`
  - `desbloqueadaEm`
  - `ultimaAtualizacao`

### Motor de avaliacao

- Service: `backend/src/services/conquistasService.js`
- Responsavel por:
  - carregar conquistas ativas
  - mapear metricas base do colaborador
  - descobrir tiers alcancados
  - somar bonus de XP apenas para tiers novos
  - preparar a resposta enriquecida para o portal

### Aplicacao no fluxo real

- Service: `backend/src/services/auditoriaProcessor.js`
- O colaborador sobe de nivel no mesmo processamento do upload, porque o nivel e recalculado antes e depois de `avaliarConquistas(colab)`.

## Metricas base suportadas hoje

- `totalItensLidos`
- `totalItensConformes`
- `totalAuditorias`
- `taxaConformidadeAcumulada`
- `pontuacao`
- `nivel`

## Como uma conquista e avaliada

1. O sistema carrega apenas conquistas `ativas`.
2. Para cada conquista, ele le a `metricaBase` atual do colaborador.
3. Os tiers sao ordenados por `meta`.
4. Todo tier com `valor >= meta` entra como desbloqueado.
5. O motor compara os tiers calculados com `tiersDesbloqueados` ja persistidos.
6. Cada tier novo soma seu `xpBonus` em `colab.pontuacao`.
7. O estado consolidado substitui `colab.conquistas` e depois o colaborador e salvo pelo processador.

## Seeds padrao confirmados no bootstrap

Se a colecao `Conquista` estiver vazia ao subir o backend, o sistema cria 6 conquistas padrao:

- `ITENS_LIDOS`
- `AUDITORIAS`
- `CONFORMIDADE`
- `PONTUACAO`
- `NIVEL`
- `ITENS_CONFORMES`

## O que a UI do portal realmente consome

- O backend expoe `GET /api/conquistas/portal/me`.
- O frontend atual, porem, usa `GET /api/metricas/portal/me`, que ja devolve `conquistas` resolvidas junto com metricas e corredores.
- A exibicao principal fica em `frontend/src/views/ColaboradorPortal.vue`.

## Limitacoes e cuidados confirmados no codigo atual

- O campo `recorrente` existe no cadastro e na UI, mas hoje nao altera a logica de avaliacao. Ele e semantico/descritivo.
- O campo `cor` e salvo em `Conquista`, mas o portal usa as cores fixas de `TIER_INFO` por tier na renderizacao principal.
- O motor atual interpreta apenas `valor >= meta`. Regras extras descritas somente em texto nao sao executadas.
- Criar ou editar uma conquista nao dispara recalculo historico automatico em todos os colaboradores.
- `POST /api/conquistas/:id/recalcular` atualmente apenas invalida o cache das definicoes.
- O runtime oficial da gamificacao esta em `conquistasService.js` e `auditoriaProcessor.js`; nao use scripts legados como fonte primaria de documentacao.

## Documento relacionado

- Fluxo ponta a ponta: [[Gamificacao/FluxoDoColaborador]]
- Operacao administrativa: [[Gamificacao/AdministracaoDeConquistas]]
