# Reclassificar tipo • Cancelar auditoria • Aviso "Sem leituras"

> Funcionalidades adicionadas à view **Auditorias.vue** para dar mais controle sobre o histórico de uploads. Cancelar já existia no backend; este documento consolida o estado final após a adição da reclassificação, da UI dos novos botões e do aviso de auditoria sem leituras.

## Visão geral

No histórico de auditorias (`/auditorias`) cada linha agora oferece **quatro ações** para administradores (`SUPER_ADMIN` e `STORE_ADMIN`):

| Ação | Ícone | Quando aparece | O que faz |
|------|-------|----------------|-----------|
| Ver detalhes | `eye` | Sempre | Abre `AuditoriaDetalhe.vue` |
| Reclassificar tipo | `shuffle` | Status ≠ `CANCELADA` | Reavalia todos os itens com as regras do novo tipo |
| Cancelar auditoria | `ban` | Status ≠ `CANCELADA` | Marca como `CANCELADA` e zera as métricas |
| Excluir | `trash` | Sempre | Remove auditoria e seus `AuditItem` |

Além disso, quando uma auditoria foi processada mas **nenhum colaborador realizou leituras** (`totalLidos === 0`), um badge amarelo **"Sem leituras"** aparece na coluna de tipo para sinalizar que o upload pode ser um candidato a cancelamento.

## Reclassificar tipo

### Regra de negócio
- Reaproveita os `AuditItem` já gravados — não exige reupload da planilha.
- Cada item é reavaliado por `classificar(novoTipo, situacao)` (`backend/src/services/regras.js`). Os campos `conforme`, `pontos` e o `tipo` do item são reescritos.
- A `Auditoria` recebe o novo `tipo`, totais recalculados (`totalLidos`, `totalConformes`, `totalNaoConformes`, `taxaConformidade`, `pontuacao`, `custoRupturaTotal`, `situacoes`, `topColaboradores`).
- `MetricaDiaria` antiga `(loja, tipoAntigo, data)` é apagada e recriada para o novo tipo (loja + por colaborador).
- `recomputarAcumuladosLoja()` é chamado para refazer pontuação/nível dos colaboradores e da loja e reavaliar conquistas.

### Conflitos tratados
- **Auditoria cancelada** → bloqueada com HTTP 409.
- **Mesmo tipo** → retorna a própria auditoria sem alterações.
- **Já existe auditoria do novo tipo na mesma loja e data** → HTTP 409 (`AuditoriaSchema` tem índice único `loja+tipo+data`). O modal exibe esse aviso preventivo.
- **Tipo inválido** → HTTP 400.

### Endpoint
```
PATCH /api/auditorias/:id/reclassificar
Body: { "tipo": "ETIQUETA" | "PRESENCA" | "RUPTURA" }
```
Permissões: `SUPER_ADMIN` ou `STORE_ADMIN` com escopo da loja.

## Cancelar auditoria

A rota já existia (`POST /api/auditorias/:id/cancelar`) mas agora é exposta diretamente no histórico através de um modal com campo de motivo opcional.

- Marca `Auditoria.status = CANCELADA`, guarda `canceladaEm`, `canceladaPor`, `motivoCancelamento`.
- Marca todos os `AuditItem` da auditoria com `cancelada: true`.
- Zera todas as `MetricaDiaria` do par `(loja, tipo, data)` e seta `cancelada: true`.
- Recalcula acumulados da loja (`recomputarAcumuladosLoja`).
- Reupload de planilha no mesmo dia/tipo **mantém o flag de cancelamento** (`auditoriaProcessor.js` já trata `auditoriaCancelada`), então a auditoria fica em estado cancelado mesmo após upload novo, até ser reativada via reupload manual.

## Aviso "Sem leituras"

Helper `semLeitura(a)` em `Auditorias.vue`:
- Retorna `true` quando `a.status` é uma auditoria já concluída e `a.totalLidos === 0`.
- Renderiza um badge amarelo com ícone de alerta na coluna de tipo, com tooltip explicando que nenhum colaborador realizou leituras.

## Arquivos modificados

### Backend
- **`backend/src/services/auditoriaReclassificacao.js`** *(novo)* — implementa `reclassificarAuditoria()` com revalidação de itens, recriação de `MetricaDiaria` e chamada a `recomputarAcumuladosLoja`.
- **`backend/src/routes/auditorias.routes.js`** — nova rota `PATCH /:id/reclassificar` com validação de tipo e captura de erros tipados (`status`).

### Frontend
- **`frontend/src/views/Auditorias.vue`** — novos estados, funções `abrirCancelar`, `confirmarCancelar`, `abrirReclassificar`, `confirmarReclassificar`, helper `semLeitura`, dois modais (`audit-modal-backdrop` + `audit-modal`), badge "Sem leituras" e dois botões adicionais na coluna de ações. Estilos para `.audit-modal*`, `.btn.warn` e `.audit-actions` incluídos.

## Impacto nos cálculos

| Métrica/Coleção | Impacto |
|-----------------|---------|
| `MetricaDiaria` da loja e por colaborador | Reclassificar: deletadas e recriadas com o novo tipo. Cancelar: zeradas e marcadas `cancelada: true`. |
| `Colaborador.pontuacao / nivel / totalAuditorias / metricasPorTipo` | Recalculados via `recomputarAcumuladosLoja` em ambos os casos. |
| `Loja.pontuacao / nivel` | Idem. |
| `Conquista` por colaborador | Reavaliadas dentro de `recomputarAcumuladosLoja` (`avaliarConquistas`). |
| `Ranking` (colaboradores e lojas) | Reflete imediatamente pois lê dos modelos atualizados. |
| `Dashboard` / `Relatorios` | Já filtravam por `cancelada: { $ne: true }` em `MetricaDiaria`, portanto auditorias canceladas somem dos cálculos. Reclassificadas continuam aparecendo, mas no tipo correto. |

## Pontos de atenção / problemas evitados

- **Índice único `loja+tipo+data`**: a reclassificação detecta o conflito antes de salvar e devolve mensagem clara — usuário precisa cancelar/excluir o duplicado antes.
- **Auditoria em estado `CANCELADA`**: não é reclassificável (poderia gerar inconsistência em métricas zeradas). Necessário reupload primeiro.
- **Itens com `situacao` desconhecida no novo tipo**: caem em `{ conforme: null, pontos: 0, conta: false }` — não geram exceção.
- **Custo de ruptura**: recalculado durante a reclassificação, então auditorias movidas para/de `RUPTURA` ajustam o custo automaticamente.
- **Reupload em auditoria cancelada**: comportamento já existente (manter cancelamento) foi preservado — não foi alterado pela reclassificação.

## Como testar

1. Subir uma planilha de **Presença**.
2. No histórico, clicar em **Reclassificar** (`shuffle`), escolher **Ruptura** e confirmar. Verificar que pontuação, conformidade e custo de ruptura mudaram, e que o ranking reflete o ajuste.
3. Tentar reclassificar de novo para o mesmo tipo de uma outra auditoria existente no mesmo dia → deve falhar com mensagem clara.
4. Subir uma planilha vazia (sem leituras). Conferir o badge **Sem leituras** na linha.
5. Clicar em **Cancelar**, opcionalmente preencher motivo, confirmar. Verificar que a linha ganha status `Cancelada`, métricas do dia somem do dashboard e ranking, e os botões de reclassificar/cancelar desaparecem.
6. Excluir a auditoria cancelada — fluxo de exclusão segue inalterado.
