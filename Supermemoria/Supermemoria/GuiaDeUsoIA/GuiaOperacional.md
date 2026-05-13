# Guia Operacional da IA

## Objetivo deste guia

Padronizar como a memoria deve ser consultada, atualizada e mantida consistente sempre que houver mudanca no sistema NovaAuditoria.

## Ordem recomendada de consulta

1. Ler [[VisaoGeral/Sistema]] para entender o contexto funcional e arquitetural.
2. Ler a secao especifica que toca a mudanca:
   - frontend em [[Frontend/ArquiteturaFrontend]]
   - backend em [[Backend/ArquiteturaBackend]]
   - rotas em [[Rotas/RotasFrontend]] e [[Rotas/RotasAPI]]
   - banco em [[BancoDeDados/ModelosESchemas]]
   - regras em [[RegrasDeNegocio/RegrasOperacionais]]
3. Ler [[HistoricoDeAlteracoes/2026-05-05]] e demais arquivos futuros do historico para entender o contexto recente.

## Regra de ouro

Nunca atualizar a memoria por suposicao. Primeiro confirmar a mudanca no codigo, depois refletir a mudanca na documentacao.

## Como atualizar a memoria apos uma mudanca

### Quando mexer apenas em frontend

- Atualizar [[Frontend/ArquiteturaFrontend]] se a estrutura, estado, tema, fluxo ou consumo de API mudou.
- Atualizar [[Rotas/RotasFrontend]] se houve nova rota ou alteracao de guarda.
- Atualizar [[Componentes/MapaDeComponentes]] se houve componente ou view nova, removida ou com papel alterado.

### Quando mexer apenas em backend

- Atualizar [[Backend/ArquiteturaBackend]] se mudou middleware, servico, seguranca ou fluxo interno.
- Atualizar [[Rotas/RotasAPI]] se mudou endpoint, auth, payload ou resposta.
- Atualizar [[BancoDeDados/ModelosESchemas]] se mudou schema, indice ou relacionamento.
- Atualizar [[RegrasDeNegocio/RegrasOperacionais]] se mudou regra, heuristica, periodo, pontuacao ou escopo.

### Quando mexer em fluxos ponta a ponta

- Atualizar [[FluxosDoSistema/FluxosPrincipais]].
- Atualizar [[VisaoGeral/Sistema]] se a experiencia principal do usuario mudou.

## Como registrar no historico

Cada lote de alteracoes relevante deve registrar:

- Data.
- O que foi alterado.
- Arquivos afetados.
- Motivo.
- Impacto no sistema.

Se o dia ja possuir arquivo em HistoricoDeAlteracoes, adicionar nova entrada no mesmo arquivo do dia. Se for um novo dia, criar um novo arquivo com a data correspondente.

## Como documentar uma feature nova

1. Identificar a feature no codigo real.
2. Definir se ela altera rota, schema, fluxo, regra, componente ou integracao.
3. Atualizar as secoes minimas tocadas.
4. Registrar no historico.
5. Se houver novo padrao recorrente, atualizar [[PadroesEArquitetura/PadroesDoProjeto]].

## Como evitar inconsistencias

- Conferir nomes exatos de endpoints, chaves de localStorage, roles e nomes de arquivo.
- Nao duplicar comportamento em duas secoes com descricoes divergentes.
- Quando uma regra mudar, revisar rotas, fluxos e visao geral para garantir consistencia textual.
- Quando uma mudanca for apenas visual e nao funcional, evitar alterar descricoes de negocio desnecessariamente.

## Checklist rapido antes de encerrar uma tarefa

- O codigo foi alterado ou validado?
- A secao correta da Super Memoria foi atualizada?
- O historico do dia recebeu registro?
- Existe impacto em endpoint, schema, fluxo ou regra que ainda nao foi refletido?

## Observacoes especificas deste projeto

- Portal do colaborador e app principal possuem autenticacoes distintas.
- Periodos analiticos sao sensiveis a ancora temporal da base.
- Multi-tenant por loja e regra estrutural, nao detalhe opcional.
- AuditoriaProcessor e um ponto central de risco sistêmico.