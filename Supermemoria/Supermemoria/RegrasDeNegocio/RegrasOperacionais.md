# Regras Operacionais

## Tipos de auditoria suportados

- ETIQUETA
- PRESENCA
- RUPTURA

## Matriz de classificacao

### Etiqueta

| Situacao              | Conforme | Pontos | Conta para taxa | Conta no total auditavel |
| --------------------- | -------- | ------ | --------------- | ------------------------ |
| Atualizado            | true     | 1      | Sim             | Sim                      |
| Desatualizado         | false    | -1     | Sim             | Sim                      |
| Lido sem estoque      | true     | 0.2    | Sim             | Sim                      |
| Lido nao pertence     | false    | -0.2   | Sim             | Sim                      |
| Nao lidos com estoque | false    | 0      | Nao             | Sim                      |
| Sem Estoque           | null     | 0      | Nao             | Nao                      |

**Calculo da taxaConformidade ETIQUETA:**

- `totalLidos` = itens com `conta:true` = Atualizado + Desatualizado + Lido sem estoque + Lido nao pertence (itens fisicamente lidos)
- `totalItensAuditaveis` = itens com `conforme != null` = totalLidos + Nao lidos com estoque (exclui Sem Estoque)
- `taxaConformidade` = `totalLidos / totalItensAuditaveis * 100` = **% de cobertura: qual fracao dos itens auditaveis foi efetivamente lida**
- Em KPIs operacionais de produtos n/auditados, ETIQUETA deve contar apenas a situacao `Nao lidos com estoque`.

### Presenca

| Situacao                   | Conforme | Pontos | Conta para taxa |
| -------------------------- | -------- | ------ | --------------- |
| Com Presenca e com Estoque | true     | 1      | Sim             |
| Sem Presenca e Com Estoque | false    | -1     | Sim             |
| Com Presenca e sem Estoque | true     | 0.3    | Sim             |
| Sem Presenca e Sem Estoque | null     | 0      | Nao             |
| Lido nao pertence          | false    | -0.2   | Sim             |

**Calculo da taxaConformidade PRESENCA:**

- `taxaConformidade` = `totalConformes / totalLidos * 100` = % de itens lidos que estao conformes
- Em KPIs operacionais de produtos n/auditados, PRESENCA deve contar a situacao `Sem Presenca e Com Estoque`; `Sem Presenca e Sem Estoque` nao entra.

### Ruptura

| Situacao                   | Conforme | Pontos | Conta para taxa |
| -------------------------- | -------- | ------ | --------------- |
| Sem Presenca e Com Estoque | false    | -2     | Sim             |
| Com Presenca e com Estoque | true     | 1      | Sim             |
| Com Presenca e sem Estoque | true     | 0.3    | Sim             |
| Sem Presenca e Sem Estoque | null     | 0      | Nao             |
| Lido nao pertence          | false    | -0.2   | Sim             |

**Calculo da taxaConformidade RUPTURA:**

- `taxaConformidade` = `totalConformes / totalLidos * 100` = % de itens lidos que estao conformes
- Em KPIs operacionais de produtos n/auditados, RUPTURA deve contar a situacao `Sem Presenca e Com Estoque`; `Sem Presenca e Sem Estoque` nao entra.

## Regra de tipo da auditoria

- O sistema tenta detectar o tipo usando nome da sheet, nome do arquivo e distribuicao de situacoes.
- Se o usuario informar tipo no upload, esse override manual tem prioridade.
- Arquivo de ruptura com nome contendo ruptura vence a heuristica padrao de presenca.

## Regra de data oficial

- A data da auditoria e o dia mais frequente encontrado na coluna **auditadoEm** de cada linha da planilha.
- O valor persistido e truncado para o inicio do dia (00:00 UTC).
- A data do upload **nao interfere** — a data vem do conteudo da planilha.
- Consequencia: planilhas de datas passadas (dias, semanas, meses atras) podem ser enviadas a qualquer momento e serao indexadas na data correta, alimentando todos os periodos analiticos retroativamente.
- Nao ha restricao de data minima ou maxima: o sistema aceita qualquer data presente na coluna auditadoEm.

## Regra de retroalimentacao historica

- E possivel enviar planilhas de auditorias antigas (ex: todo o historico do ano) em qualquer ordem e em qualquer momento.
- Cada planilha sera processada com a data real da auditoria, populando MetricaDiaria, AuditItem, Colaborador e Loja para aquele dia.
- Apos carregar um lote grande de historico, recomenda-se executar o script de recompute para garantir que os acumulados de Colaborador e Loja fechem corretamente:
  ```
  node --env-file=.env scripts/recompute-acumulados.js
  ```
- O recompute oficial tambem recompõe `metricasPorTipo` e reavalia conquistas usando o motor atual de `conquistasService.js`.
- O script e idempotente: pode ser rodado multiplas vezes sem risco de duplicar dados.

## Regra de idempotencia de upload

- Chave logica do upload: loja + tipo + data.
- Se essa combinacao ja existir, os AuditItems anteriores sao apagados e o upload e reprocessado.
- Essa logica evita duplicidade para reenvios do mesmo dia.
- No banco, o indice `{ loja, tipo, data }` e unico (garantia em nivel de banco alem da logica de aplicacao).
- Para o mesmo dia, o ultimo envio sempre vence — inclusive para datas passadas.
- Se a auditoria dessa chave estiver `CANCELADA`, o reenvio substitui os itens para manter o historico documental, mas as metricas seguem zeradas e nao entram nos acumulados.

## Regra de cancelamento de auditoria

- Apenas `SUPER_ADMIN` pode cancelar auditoria de loja.
- Cancelar nao apaga a Auditoria; o status passa para `CANCELADA` e o historico continua visivel.
- Os `AuditItem` da auditoria ficam com `cancelada: true` e sao ignorados por relatorios e agregacoes analiticas.
- Os registros `MetricaDiaria` da mesma loja, tipo e data sao zerados e marcados como `cancelada: true`.
- A loja e os colaboradores da loja sao recomputados a partir de `MetricaDiaria` nao cancelada, incluindo os acumulados por tipo do colaborador.
- O ranking de lojas ainda recebe a informacao de cancelamento para mostrar alerta, mas sem somar pontos, itens ou conformidade do dia cancelado.

## Regra de pontuacao e nivel

- Pontuacao do colaborador e da loja e acumulativa.
- Nivel = max(1, floor(pontuacao / 500) + 1).
- Nao ha teto de nivel implementado.
- No fluxo real do upload, o nivel do colaborador e recalculado antes e depois da avaliacao de conquistas, porque o `xpBonus` de um tier pode elevar o nivel no mesmo processamento.

## Regras atuais de gamificacao

- As conquistas nao sao mais hardcoded no runtime principal; elas vivem na colecao `Conquista` e sao geridas por SUPER_ADMIN via `/api/conquistas`.
- O motor de avaliacao percorre apenas conquistas `ativas` e compara a `metricaBase` atual do colaborador com cada `meta` de tier.
- Quando a conquista define `tipoAuditoria`, a metrica e lida do recorte `metricasPorTipo` correspondente em vez do acumulado global.
- Quando a conquista usa `totalItensParticipacaoLoja`, o sistema soma o `totalLidos` consolidado da loja somente nas auditorias em que o colaborador teve participacao registrada naquele dia e tipo.
- Um tier e considerado desbloqueado quando `valor >= meta`.
- O bonus de XP (`xpBonus`) e concedido apenas para tiers recem-desbloqueados, nunca para tiers que ja estavam em `tiersDesbloqueados`.
- Cada tier novo tambem registra historico proprio com `nivel`, `desbloqueadoEm`, `meta`, `xpBonus` e `titulo`.
- O estado persistido do colaborador guarda `codigo`, `tierAtual`, `tiersDesbloqueados[]`, `historicoDesbloqueios[]`, `progresso`, `desbloqueadaEm` e `ultimaAtualizacao`.
- O bootstrap do servidor cria um conjunto padrao de 6 conquistas globais somente quando a colecao ainda esta vazia.
- Bases antigas podem receber conquistas padrao novas de forma idempotente com `node --env-file=.env scripts/sync-conquistas-padrao.js`.
- O conjunto default atual inclui tambem 6 conquistas por tipo de auditoria: itens e auditorias para ETIQUETA, PRESENCA e RUPTURA.
- O conjunto default atual inclui tambem a conquista `PARTICIPACAO_LOJA`, que nao herda historico antigo da loja para novos colaboradores: ela avanca apenas quando ha participacao efetiva do colaborador na auditoria correspondente.

### Observacoes importantes da implementacao atual

- O campo `recorrente` existe no cadastro e na UI administrativa, mas hoje nao altera o algoritmo de avaliacao; ele funciona como semantica de configuracao e exibicao.
- O campo `cor` e salvo na definicao da conquista, mas o portal usa as cores fixas de tier (`TIER_INFO`) para renderizacao principal.
- O motor atual nao interpreta regras extras descritas apenas no texto da conquista; a avaliacao real usa somente a metrica base e as metas dos tiers.
- O modelo atual trabalha com 6 tiers fixos (`comum`, `raro`, `epico`, `lendario`, `diamante`, `mitico`); qualquer expansao para mais degraus exige mudar schema, validacao e estado persistido.
- `scripts/sync-conquistas-padrao.js` consegue acrescentar tiers padrao faltantes nas conquistas standard ja salvas, mas a reavaliacao persistida dos colaboradores continua dependendo de novo processamento ou de `scripts/recompute-acumulados.js`.
- Nao existe recalculo historico automatico em massa quando uma conquista e criada ou alterada.
- `POST /api/conquistas/:id/recalcular` atualmente invalida cache, mas nao reavalia todos os colaboradores.
- A metrica `totalItensParticipacaoLoja` depende do cruzamento entre a linha diaria do colaborador e a linha consolidada da loja no mesmo `loja + tipo + data`; por isso recompute e cancelamento precisam recalcular esse acumulado junto com as demais metricas.

> Documentacao detalhada: [[Gamificacao/Bem-vindo]]

## Regras de multi-tenant

- Cada colaborador pertence a exatamente uma loja.
- Cada usuario nao super admin opera preso a sua loja.
- SUPER_ADMIN pode assumir escopo de loja por lojaId.
- Rotas de colaborador do portal usam req.escopoLojaId derivado do proprio token.

## Regras do portal do colaborador

- Login usa matricula e senha, nao email.
- A matricula pode existir em varias lojas; o frontend precisa apresentar a selecao.
- Primeiro acesso exige definicao de senha.
- O token do portal e diferente do token do app principal.
- O colaborador so pode trocar a propria senha e a propria foto.

## Regra de avatar

- O portal permite recortar a imagem antes do upload.
- O backend aceita apenas arquivos image/\* ate 5 MB.
- Ao salvar novo avatar, o arquivo antigo do colaborador e removido do disco quando existe.

## Regra de periodos analiticos

- Os endpoints de metricas ancoram o periodo na ultima data disponivel com dados.
- Isso corrige casos em que a base historica esta desfasada em relacao ao dia atual e evita dashboards ou rankings vazios.

## Regra de ranking

- Ranking de colaboradores agrega MetricaDiaria por colaborador.
- Ranking de lojas agrega MetricaDiaria consolidada com colaborador null.
- Ordenacao principal por pontuacao desc.
- Ranking de lojas tambem expõe `auditoriasCanceladas` para sinalizar auditorias neutralizadas no periodo.

## Regra de configuracoes administrativas

- STORE_ADMIN pode editar a propria loja e administrar usuarios locais.
- SUPER_ADMIN pode criar e desativar lojas, alem de operar globalmente.
