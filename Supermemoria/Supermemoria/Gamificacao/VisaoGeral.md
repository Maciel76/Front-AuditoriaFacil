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
- Guarda `codigo`, `nome`, `descricao`, `icone`, `cor`, `categoria`, `metricaBase`, `tipoAuditoria`, `recorrente`, `tiers`, `ativa` e `ordem`.

### Estado do colaborador usado pela gamificacao

- Model: `backend/src/models/Colaborador.js`
- Campos principais:
  - acumulados globais (`totalItensLidos`, `totalItensConformes`, `totalAuditorias`, `totalItensParticipacaoLoja`, `pontuacao`, `nivel`)
  - `metricasPorTipo.ETIQUETA|PRESENCA|RUPTURA`
  - `conquistas[]`
- Cada item de `conquistas[]` guarda:
  - `codigo`
  - `tierAtual`
  - `tiersDesbloqueados[]`
  - `historicoDesbloqueios[]`
  - `progresso`
  - `desbloqueadaEm`
  - `ultimaAtualizacao`

### Motor de avaliacao

- Service: `backend/src/services/conquistasService.js`
- Responsavel por:
  - carregar conquistas ativas
  - mapear metricas base do colaborador
  - usar o recorte `metricasPorTipo` quando a conquista define `tipoAuditoria`
  - descobrir tiers alcancados
  - somar bonus de XP apenas para tiers novos
  - preparar a resposta enriquecida para o portal

### Normalizacao dos acumulados por tipo

- Service: `backend/src/services/colaboradorMetricas.js`
- Garante a estrutura minima de `metricasPorTipo` para ETIQUETA, PRESENCA e RUPTURA.

### Aplicacao no fluxo real

- Service: `backend/src/services/auditoriaProcessor.js`
- Atualiza acumulados globais e por tipo durante upload e reupload.
- Recalcula o nivel antes e depois de `avaliarConquistas(colab)`.
- Reavalia conquistas tambem quando um colaborador some do reupload.

## Metricas base suportadas hoje

- `totalItensLidos`
- `totalItensConformes`
- `totalAuditorias`
- `totalItensParticipacaoLoja`
- `taxaConformidadeAcumulada`
- `pontuacao`
- `nivel`

## Como uma conquista e avaliada

1. O sistema carrega apenas conquistas `ativas`.
2. Para cada conquista, ele le a `metricaBase` atual do colaborador.
3. Se a definicao possui `tipoAuditoria`, a leitura e feita no recorte correspondente de `metricasPorTipo`.
4. Se a metrica for `totalItensParticipacaoLoja`, o valor usado e o total lido da loja somado apenas nas auditorias em que o colaborador participou.
5. Os tiers sao ordenados por `meta`.
6. Todo tier com `valor >= meta` entra como desbloqueado.
7. O motor compara os tiers calculados com `tiersDesbloqueados` ja persistidos.
8. Cada tier novo soma seu `xpBonus` em `colab.pontuacao`.
9. O estado consolidado substitui `colab.conquistas` e depois o colaborador e salvo pelo processador.

## Seeds padrao confirmados no sistema atual

Se a colecao `Conquista` estiver vazia ao subir o backend, o sistema cria 7 conquistas globais padrao:

- `ITENS_LIDOS`
- `AUDITORIAS`
- `CONFORMIDADE`
- `PONTUACAO`
- `NIVEL`
- `ITENS_CONFORMES`
- `PARTICIPACAO_LOJA`

O conjunto default atual inclui tambem 6 conquistas por tipo, sincronizaveis em bases antigas com `node --env-file=.env scripts/sync-conquistas-padrao.js`:

- `ETIQUETA_ITENS`
- `ETIQUETA_AUDITORIAS`
- `PRESENCA_ITENS`
- `PRESENCA_AUDITORIAS`
- `RUPTURA_ITENS`
- `RUPTURA_AUDITORIAS`

## Limitacoes confirmadas no modelo atual

- O schema aceita 6 tiers fixos: `comum`, `raro`, `epico`, `lendario`, `diamante` e `mitico`.
- O campo `recorrente` existe no cadastro e na UI, mas hoje nao altera a logica de avaliacao.
- O campo `cor` e salvo em `Conquista`, mas o portal usa as cores fixas de `TIER_INFO` por tier na renderizacao principal.
- O motor interpreta apenas `valor >= meta`; regras extras descritas em texto nao sao executadas sozinhas.
- Criar ou editar uma conquista nao dispara recalculo historico automatico em todos os colaboradores.
- No bootstrap do backend, `server.js` agora chama `sincronizarConquistasPadrao()` apos o seed inicial; com isso, bases antigas recebem automaticamente conquistas padrao faltantes e tiers novos no restart/deploy.
- `node --env-file=.env scripts/sync-conquistas-padrao.js` continua disponivel para manutencao manual e ainda pode ser usado antes de `scripts/recompute-acumulados.js` quando for preciso forcar a sincronizacao fora do ciclo normal de deploy.
- `totalItensParticipacaoLoja` nao retroage para colaboradores que nao participaram das auditorias antigas; o acumulado nasce da participacao diaria registrada.

## O que a UI do portal realmente consome

- O backend expoe `GET /api/conquistas/portal/me`.
- O frontend atual, porem, usa `GET /api/metricas/portal/me`, que ja devolve `conquistas` resolvidas junto com metricas e corredores.
- Cada conquista resolvida inclui progresso, proximo tier e historico por tier para alimentar o modal de detalhes do portal sem round-trip adicional.
- A exibicao principal fica em `frontend/src/views/ColaboradorPortal.vue`.
