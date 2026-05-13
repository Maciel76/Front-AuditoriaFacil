# Modelos e Schemas

## Visao geral das entidades

O sistema usa MongoDB com Mongoose e concentra o dominio em seis modelos principais: Usuario, Loja, Colaborador, Auditoria, AuditItem e MetricaDiaria.

## Usuario

Arquivo: backend/src/models/Usuario.js

### Campos

- nome: string obrigatoria.
- email: string unica, lowercase, indexada.
- senhaHash: hash bcrypt.
- role: SUPER_ADMIN, STORE_ADMIN ou COLABORADOR.
- loja: referencia opcional para Loja.
- colaborador: referencia opcional para Colaborador.
- avatarUrl: url opcional.
- ativo: boolean.
- ultimoLogin: date.

### Comportamentos

- checarSenha compara senha com bcrypt.
- hashSenha gera hash com 10 rounds.
- toJSON remove senhaHash e __v.

## Loja

Arquivo: backend/src/models/Loja.js

### Campos

- nome, slug, codigo, cidade, estado, endereco, cnpj, avatarUrl.
- ativa: boolean.
- metas.conformidadeEtiqueta default 95.
- metas.conformidadePresenca default 90.
- metas.conformidadeRuptura default 95.
- pontuacao e nivel acumulados.

### Indices

- slug unico.
- indice de texto em nome, slug e codigo.

## Colaborador

Arquivo: backend/src/models/Colaborador.js

### Identidade

- Unicidade por loja + codigoExterno.
- Serve tanto como entidade operacional de planilha quanto como identidade do portal.

### Campos principais

- loja: referencia obrigatoria.
- codigoExterno: matricula ou codigo externo.
- nome, cargo, setor, avatarUrl.
- usuario: referencia opcional a Usuario.
- ativo.
- senhaHash com select false.
- primeiroAcesso.
- pontuacao, nivel, totalAuditorias, totalItensLidos, totalItensConformes.
- conquistas: array de objetos com codigo, nome e conquistadaEm.

### Comportamentos

- checarSenha e hashSenha para o portal.

## Auditoria

Arquivo: backend/src/models/Auditoria.js

### Papel

Representa um upload processado de planilha para uma loja, um tipo e uma data oficial.

### Campos principais

- loja, tipo, data, arquivoOriginal, enviadoPor.
- totais: totalItens, totalLidos, totalConformes, totalNaoConformes.
- taxaConformidade, pontuacao, custoRupturaTotal.
- situacoes como Map.
- topColaboradores como snapshot resumido.
- status: PROCESSANDO, CONCLUIDA, ERRO.
- erro.

### Indice

- loja + tipo + data.

## AuditItem

Arquivo: backend/src/models/AuditItem.js

### Papel

Representa uma linha individual da planilha ja classificada.

### Campos principais

- auditoria, loja, tipo, data.
- codigo, produto, classeRaiz, classe, setor, local.
- colaborador, colaboradorCodigo, colaboradorNome.
- situacao, situacaoAuditoria, auditadoEm, presencaConfirmadaEm, ultimaCompraEm.
- estoqueAtual, estoqueLeitura, diasSemVenda, custoRuptura, residuo, fornecedor.
- conforme e pontos resultantes da classificacao.

### Indices

- auditoria.
- loja + tipo + data.
- loja + colaborador + data.

## MetricaDiaria

Arquivo: backend/src/models/MetricaDiaria.js

### Papel

Materializacao diaria das metricas para evitar agregacao pesada sobre AuditItem em cada leitura analitica.

### Campos principais

- loja obrigatoria.
- colaborador opcional; null representa consolidado por loja.
- tipo e data.
- totalItens, totalLidos, totalConformes, totalNaoConformes.
- taxaConformidade, pontuacao, custoRuptura.
- situacoes como Map.

### Indice unico

- loja + tipo + data + colaborador.

## Relacionamentos

- Loja 1:N Usuario.
- Loja 1:N Colaborador.
- Loja 1:N Auditoria.
- Auditoria 1:N AuditItem.
- Colaborador 1:N MetricaDiaria por dia e tipo.
- Loja 1:N MetricaDiaria consolidada por dia e tipo.

## Ciclo de dados de auditoria

1. Upload cria ou reaproveita Auditoria.
2. Parser gera linhas normalizadas.
3. Cada linha vira AuditItem.
4. Totais do upload atualizam Auditoria.
5. Agregados diarios alimentam MetricaDiaria.
6. Pontuacao acumulada sobe para Colaborador e Loja.

## Persistencia fora do banco

- Avatares: pasta uploads/avatares.
- URL publica: /uploads/avatares/<arquivo>.