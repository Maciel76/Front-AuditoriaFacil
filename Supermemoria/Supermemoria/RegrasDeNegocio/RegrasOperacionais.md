# Regras Operacionais

## Tipos de auditoria suportados

- ETIQUETA
- PRESENCA
- RUPTURA

## Matriz de classificacao

### Etiqueta

| Situacao | Conforme | Pontos | Conta para taxa | Conta no total auditavel |
| --- | --- | --- | --- | --- |
| Atualizado | true | 1 | Sim | Sim |
| Desatualizado | false | -1 | Sim | Sim |
| Lido sem estoque | true | 0.2 | Sim | Sim |
| Lido nao pertence | false | -0.2 | Sim | Sim |
| Nao lidos com estoque | false | 0 | Nao | Sim |
| Sem Estoque | null | 0 | Nao | Nao |

**Calculo da taxaConformidade ETIQUETA:**
- `totalLidos` = itens com `conta:true` = Atualizado + Desatualizado + Lido sem estoque + Lido nao pertence (itens fisicamente lidos)
- `totalItensAuditaveis` = itens com `conforme != null` = totalLidos + Nao lidos com estoque (exclui Sem Estoque)
- `taxaConformidade` = `totalLidos / totalItensAuditaveis * 100` = **% de cobertura: qual fracao dos itens auditaveis foi efetivamente lida**
- Em KPIs operacionais de produtos n/auditados, ETIQUETA deve contar apenas a situacao `Nao lidos com estoque`.

### Presenca

| Situacao | Conforme | Pontos | Conta para taxa |
| --- | --- | --- | --- |
| Com Presenca e com Estoque | true | 1 | Sim |
| Sem Presenca e Com Estoque | false | -1 | Sim |
| Com Presenca e sem Estoque | true | 0.3 | Sim |
| Sem Presenca e Sem Estoque | null | 0 | Nao |
| Lido nao pertence | false | -0.2 | Sim |

**Calculo da taxaConformidade PRESENCA:**
- `taxaConformidade` = `totalConformes / totalLidos * 100` = % de itens lidos que estao conformes
- Em KPIs operacionais de produtos n/auditados, PRESENCA deve contar a situacao `Sem Presenca e Com Estoque`; `Sem Presenca e Sem Estoque` nao entra.

### Ruptura

| Situacao | Conforme | Pontos | Conta para taxa |
| --- | --- | --- | --- |
| Sem Presenca e Com Estoque | false | -2 | Sim |
| Com Presenca e com Estoque | true | 1 | Sim |
| Com Presenca e sem Estoque | true | 0.3 | Sim |
| Sem Presenca e Sem Estoque | null | 0 | Nao |
| Lido nao pertence | false | -0.2 | Sim |

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
- O script e idempotente: pode ser rodado multiplas vezes sem risco de duplicar dados.

## Regra de idempotencia de upload

- Chave logica do upload: loja + tipo + data.
- Se essa combinacao ja existir, os AuditItems anteriores sao apagados e o upload e reprocessado.
- Essa logica evita duplicidade para reenvios do mesmo dia.
- No banco, o indice `{ loja, tipo, data }` e unico (garantia em nivel de banco alem da logica de aplicacao).
- Para o mesmo dia, o ultimo envio sempre vence — inclusive para datas passadas.

## Regra de pontuacao e nivel

- Pontuacao do colaborador e da loja e acumulativa.
- Nivel = max(1, floor(pontuacao / 500) + 1).
- Nao ha teto de nivel implementado.

## Conquistas automaticas

- PRIMEIRA_AUDITORIA quando totalAuditorias >= 1.
- CEM_LIDOS quando totalItensLidos >= 100.
- MIL_LIDOS quando totalItensLidos >= 1000.
- DEZ_MIL_LIDOS quando totalItensLidos >= 10000.
- CONFORMIDADE_95 quando totalItensLidos >= 200 e taxa acumulada >= 95%.
- NIVEL_5 quando nivel >= 5.

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
- O backend aceita apenas arquivos image/* ate 5 MB.
- Ao salvar novo avatar, o arquivo antigo do colaborador e removido do disco quando existe.

## Regra de periodos analiticos

- Os endpoints de metricas ancoram o periodo na ultima data disponivel com dados.
- Isso corrige casos em que a base historica esta desfasada em relacao ao dia atual e evita dashboards ou rankings vazios.

## Regra de ranking

- Ranking de colaboradores agrega MetricaDiaria por colaborador.
- Ranking de lojas agrega MetricaDiaria consolidada com colaborador null.
- Ordenacao principal por pontuacao desc.

## Regra de configuracoes administrativas

- STORE_ADMIN pode editar a propria loja e administrar usuarios locais.
- SUPER_ADMIN pode criar e desativar lojas, alem de operar globalmente.