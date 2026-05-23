# Cancelamento de Auditorias de Loja

## Objetivo

O cancelamento neutraliza uma auditoria ja enviada para uma loja, tipo e dia. A auditoria permanece no historico com status `CANCELADA`, mas seus dados deixam de contar em metricas, rankings, relatorios, perfis e acumulados.

## Quem pode cancelar

- `SUPER_ADMIN` e `STORE_ADMIN`.
- Auditorias ja enviadas podem ser canceladas no historico em `Auditorias.vue`.
- Auditorias do dia ainda sem planilha podem ser canceladas preventivamente em `AdminLojas.vue`.
- O frontend envia `lojaId` por query string para manter o escopo multi-loja do backend.

## Endpoint

- `POST /api/auditorias/:id/cancelar`
- `POST /api/auditorias/cancelar-dia`
- Auth: usuario do app principal.
- Role: `SUPER_ADMIN` ou `STORE_ADMIN`.
- Escopo: loja obrigatoria via `escopoLoja`.

## O que o backend faz

1. Busca a auditoria pelo `_id` e pela loja do escopo.
2. Marca `Auditoria.status = CANCELADA` e grava `canceladaEm`, `canceladaPor` e `motivoCancelamento`.
3. Marca todos os `AuditItem` da auditoria com `cancelada: true`.
4. Zera os documentos `MetricaDiaria` da mesma loja, tipo e data, incluindo consolidado da loja e metricas por colaborador.
5. Mantem um registro consolidado de `MetricaDiaria` com valores zerados e `cancelada: true`, para que o ranking de lojas consiga mostrar alerta no dia/periodo.
6. Recalcula acumulados da loja e dos colaboradores da loja a partir de `MetricaDiaria` nao cancelada.
7. Reavalia conquistas dos colaboradores durante o recompute para reconstruir o estado atual com base nos acumulados restantes.

### Cancelamento preventivo sem planilha

- `POST /api/auditorias/cancelar-dia` recebe `lojaId`, `tipo`, `data` (`YYYY-MM-DD`) e motivo opcional.
- Se nao existir auditoria para a chave `loja + tipo + data`, cria uma `Auditoria` ja com `status=CANCELADA`, totais zerados e `arquivoOriginal="Cancelamento manual sem planilha"`.
- Tambem cria/atualiza a `MetricaDiaria` consolidada zerada e cancelada para que o ranking de lojas conte o cancelamento.
- Se ja existir auditoria ativa para a chave, retorna 409 e orienta cancelar pelo historico de auditorias, evitando cancelar upload real por engano.

## Como reupload se comporta depois do cancelamento

- A chave logica continua sendo loja + tipo + data.
- Se uma planilha for reenviada para uma auditoria ja cancelada, o processador recebe os dados, substitui os itens antigos, mantem os novos `AuditItem` como `cancelada: true` e nao soma metricas ou acumulados.
- O job de upload termina como `done`, mas o resultado retorna `cancelada: true`, `metricasIgnoradas: true` e uma mensagem avisando que a auditoria esta cancelada.

## Como as telas refletem

### Auditorias.vue

- O resultado do upload mostra status de auditoria cancelada quando o backend retorna `cancelada: true`.
- O historico exibe badge `Cancelada` para auditorias com status `CANCELADA`.

### LojaPerfil.vue

- Mostra badge de status nas ultimas auditorias.
- Mostra um alerta quando existem auditorias canceladas no periodo ativo.

### RankingLojas.vue

- O backend retorna `auditoriasCanceladas` por loja no periodo.
- A UI destaca lojas com cancelamento usando alerta vermelho/amarelo no podium e na lista.
- O seletor de modo inclui `Mais cancelamentos`, ordenando lojas por `auditoriasCanceladas`.

### AdminLojas.vue

- Cada card de loja ativa exibe um botao para cancelar a auditoria do dia sem planilha.
- O modal permite escolher data, tipo e motivo, chamando `POST /api/auditorias/cancelar-dia` com `lojaId`.

## Regra de calculo

- `AuditItem.cancelada = true` fica fora de agregacoes analiticas baseadas em itens.
- `MetricaDiaria.cancelada = true` fica fora dos acumulados de dashboard, ranking de colaboradores, perfil de colaborador e perfil de loja.
- Ranking de lojas le tambem metricas canceladas zeradas para poder exibir o alerta da loja, sem somar pontuacao ou itens.
- Auditorias com `status = CANCELADA` ficam fora de contagens e medias operacionais de dashboard/perfil, mas continuam visiveis no historico.

## Arquivos fonte principais

- `backend/src/models/Auditoria.js`
- `backend/src/models/AuditItem.js`
- `backend/src/models/MetricaDiaria.js`
- `backend/src/services/auditoriaCancelamento.js`
- `backend/src/services/auditoriaProcessor.js`
- `backend/src/routes/auditorias.routes.js`
- `backend/src/routes/metricas.routes.js`
- `backend/src/routes/lojas.routes.js`
- `frontend/src/views/Auditorias.vue`
- `frontend/src/views/Lojas.vue`
- `frontend/src/views/LojaPerfil.vue`
- `frontend/src/views/RankingLojas.vue`
