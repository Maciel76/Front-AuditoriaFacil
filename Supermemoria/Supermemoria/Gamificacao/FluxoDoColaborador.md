# Fluxo do Colaborador em Conquistas, XP e Nivel

## Fluxo runtime de subida de nivel

1. Um upload entra por `POST /api/auditorias/upload`.
2. `auditoriaProcessor.js` classifica cada item e acumula os pontos operacionais do colaborador.
3. O processador atualiza os acumulados do colaborador:
   - `totalItensLidos`
   - `totalItensConformes`
   - `totalAuditorias`
   - `pontuacao`
   - `totalItensParticipacaoLoja`
   - `metricasPorTipo.ETIQUETA|PRESENCA|RUPTURA`
4. O nivel e recalculado com base na pontuacao acumulada atual.
5. O processador chama `await avaliarConquistas(colab)`.
6. Quando a conquista define `tipoAuditoria`, o motor usa o recorte correspondente dentro de `metricasPorTipo`.
7. Quando a conquista usa `totalItensParticipacaoLoja`, o motor soma o volume lido da loja apenas nas auditorias em que o colaborador teve participacao registrada.
8. Se novos tiers forem desbloqueados, o `xpBonus` correspondente e somado em `colab.pontuacao`.
9. O nivel e recalculado de novo para absorver esse bonus no mesmo ciclo.
10. O colaborador e salvo com o novo estado de conquistas e nivel.

## Fluxo especial de reupload

- Quando a auditoria do mesmo dia e tipo e reenviada, o processador reverte a contribuicao anterior antes de aplicar a nova.
- Isso evita duplicidade em `pontuacao`, `totalItensLidos`, `totalItensConformes`, `totalAuditorias` e nos acumulados de `metricasPorTipo`.
- Se um colaborador desaparece do reupload, a contribuicao anterior dele tambem e revertida e as conquistas sao reavaliadas antes de salvar.
- Depois da reversao, a nova pontuacao e processada normalmente e o colaborador volta a passar pelo calculo de nivel e conquistas.

## Fluxo de exibicao no portal

1. O colaborador autentica em `/portal`.
2. `ColaboradorPortal.vue` carrega `GET /api/colaboradores/portal/me` para dados pessoais.
3. Em seguida, carrega `GET /api/metricas/portal/me?periodo=tudo`.
4. `metricas.routes.js` monta o perfil analitico e chama `resolverConquistasPortal(colab)`.
5. O payload retorna `conquistas` ja prontas para a UI, com:
   - `tierAtual`
   - `tierAtualLabel`
   - `tierAtualCor`
   - `proximoTier`
   - `progresso`
   - `progressoPct`
   - `totalTiersDesbloqueados`
   - `desbloqueada`
   - `desbloqueadaEm`
   - `historicoDesbloqueios[]`
6. O frontend usa esse material em duas areas principais:
   - aba `inicio`: nivel, barra de XP e 4 conquistas em destaque
   - aba `conquistas`: grade completa com filtros por categoria e status
   - modal de detalhe: descricao completa, data de obtencao, requisitos por tier e historico de desbloqueio

## Como o portal ordena as conquistas

- Destaques priorizam conquistas desbloqueadas.
- Em empate, prioriza quem possui mais tiers desbloqueados.
- A tela completa permite filtrar por categoria e por status (`todas`, `desbloqueadas`, `bloqueadas`).

## O que acontece quando o SUPER_ADMIN cria uma conquista nova

- A definicao nova passa a existir imediatamente na colecao `Conquista`.
- O portal so passa a ter um estado persistido dessa conquista quando o colaborador voltar a ser avaliado por `avaliarConquistas(colab)`.
- Como nao existe recalc historico em massa hoje, colaboradores antigos podem precisar de novo ciclo de processamento para consolidar o desbloqueio corretamente.
- Se a mudanca for a introducao de conquistas padrao novas em uma base antiga, primeiro e preciso sincronizar a colecao com `node --env-file=.env scripts/sync-conquistas-padrao.js`.
- No caso da conquista de participacao, pode ser necessario rodar `scripts/recompute-acumulados.js` para preencher `totalItensParticipacaoLoja` a partir do historico ja salvo.

## Implicacao pratica importante

- Se uma nova conquista for criada quando o colaborador ja ultrapassou a meta, o portal pode refletir progresso bruto antes de o estado persistido ser atualizado pelo motor de avaliacao.
- Para operacao diaria, trate o upload seguinte que tocar aquele colaborador como o ciclo natural de consolidacao.
- O mesmo vale para conquistas por tipo: sem novo ciclo de upload, cancelamento ou recompute, o estado persistido ainda nao conhece o recorte novo.

## Documento relacionado

- Visao geral e regras: [[Gamificacao/VisaoGeral]]
- Como criar e editar conquistas: [[Gamificacao/AdministracaoDeConquistas]]
