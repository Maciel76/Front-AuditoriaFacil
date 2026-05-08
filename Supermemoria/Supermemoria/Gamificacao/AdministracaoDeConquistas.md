# Administracao de Conquistas

## Onde o SUPER_ADMIN administra isso

- Rota frontend: `/admin/conquistas`
- View: `frontend/src/views/AdminConquistas.vue`
- Menu: item `Conquistas` no `AppLayout.vue`, visivel apenas para `SUPER_ADMIN`

## APIs usadas pela tela administrativa

- `GET /api/conquistas`
- `GET /api/conquistas/meta`
- `POST /api/conquistas`
- `PUT /api/conquistas/:id`
- `DELETE /api/conquistas/:id`

## Campos que o admin edita hoje

- `codigo`: identificador unico em caixa alta; e a chave que liga a definicao ao estado salvo no colaborador.
- `nome`: nome exibido nas telas.
- `descricao`: texto descritivo da conquista.
- `icone`: emoji principal da conquista.
- `cor`: campo persistido no model, mas sem papel central na renderizacao atual do portal.
- `categoria`: agrupamento visual/semantico.
- `metricaBase`: o numero que sera comparado com as metas dos tiers.
- `recorrente`: marcador semantico exibido na UI administrativa.
- `ativa`: controla se a conquista entra ou nao no motor de avaliacao.
- `ordem`: influencia listagem e cache ordenado das conquistas ativas.
- `tiers[]`: conjunto de marcos com `nivel`, `meta`, `xpBonus` e `titulo`.

## Como criar uma conquista nova

1. Entrar como `SUPER_ADMIN`.
2. Abrir `/admin/conquistas`.
3. Clicar em `Nova conquista`.
4. Definir um `codigo` unico, estavel e em formato `A_Z_0_9`.
5. Escolher a `metricaBase` que realmente representa a progressao desejada.
6. Preencher os tiers em ordem crescente de meta.
7. Informar `xpBonus` apenas nos tiers que devem premiar XP extra.
8. Salvar.

## Como editar uma conquista existente

- A tela abre a definicao atual em modal.
- O backend aceita `PUT` parcial e volta a ordenar os tiers por `meta` quando necessario.
- Toda mutacao invalida o cache de conquistas ativas.

## Como desativar versus excluir

### Desativar

- Mantem o documento no banco.
- A conquista para de ser carregada como `ativa`.
- O portal deixa de resolvela no fluxo principal enquanto estiver inativa.

### Excluir

- Remove o documento da colecao `Conquista`.
- Deve ser usado com mais cuidado, porque a definicao deixa de existir por completo.

## Cuidados operacionais importantes

### Nao trocar `codigo` sem planejar migracao

- O estado de cada colaborador e indexado por `codigo`.
- Se o codigo mudar, o motor passa a tratar a conquista como uma definicao nova.
- Isso pode levar a reprocessamento inesperado do estado e novo credito de `xpBonus` em avaliacao futura.

### `recorrente` nao muda a logica hoje

- O campo existe e aparece na UI administrativa.
- O motor atual nao tem ramificacoes diferentes para recorrente ou nao recorrente.

### `cor` nao governa o visual principal do portal

- O portal usa as cores fixas de tier retornadas por `TIER_INFO`.
- Se precisar de cor por conquista, isso ainda exige evolucao especifica no backend/frontend.

### Criar ou editar nao recalcula todo mundo automaticamente

- Nao existe rotina nativa de reavaliacao em massa de todos os colaboradores.
- `POST /api/conquistas/:id/recalcular` so invalida cache de definicoes.
- O comportamento consolidado acontece quando `avaliarConquistas(colab)` roda novamente no fluxo de upload.

### Regras extras em texto nao sao executadas

- O texto da descricao pode explicar a intencao de negocio.
- O motor real usa apenas `metricaBase` e `meta`.
- Se precisar de condicao adicional obrigatoria, isso precisa virar codigo.

## Como validar uma conquista nova depois de salvar

1. Conferir se ela aparece em `/admin/conquistas` com os tiers corretos.
2. Confirmar se ficou `ativa`.
3. Processar uma nova auditoria que toque um colaborador elegivel.
4. Abrir o portal do colaborador e verificar destaque, progresso ou desbloqueio.

## Documento relacionado

- Conceitos gerais: [[Gamificacao/VisaoGeral]]
- Fluxo do colaborador: [[Gamificacao/FluxoDoColaborador]]
