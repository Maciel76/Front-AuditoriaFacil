# Super Memoria NovaAuditoria

Este cofre e a memoria viva do sistema NovaAuditoria. A documentacao abaixo foi organizada para servir como referencia tecnica persistente do frontend, backend, banco de dados, fluxos e regras de negocio.

## Navegacao principal

- [[VisaoGeral/Sistema]]
- [[Frontend/ArquiteturaFrontend]]
- [[Backend/ArquiteturaBackend]]
- [[Rotas/RotasFrontend]]
- [[Rotas/RotasAPI]]
- [[Componentes/MapaDeComponentes]]
- [[BancoDeDados/ModelosESchemas]]
- [[RegrasDeNegocio/RegrasOperacionais]]
- [[Auditorias/CancelamentoDeAuditorias]]
- [[Gamificacao/Bem-vindo]]
- [[Integracoes/DependenciasEIntegracoes]]
- [[FluxosDoSistema/FluxosPrincipais]]
- [[PadroesEArquitetura/PadroesDoProjeto]]
- [[HistoricoDeAlteracoes/2026-05-05]]
- [[GuiaDeUsoIA/GuiaOperacional]]

## Regras desta memoria

- Esta documentacao deve ser atualizada sempre que houver mudanca relevante em codigo, fluxo, endpoint, schema, regra ou integracao.
- O historico de alteracoes deve registrar data, o que mudou, arquivos afetados, motivo e impacto.
- Em caso de duvida, o codigo fonte continua sendo a fonte primaria; esta memoria deve refletir exatamente o que foi confirmado no repositorio.
- Nao inventar comportamento. Quando algo nao estiver claro, registrar a lacuna de forma explicita.

## Escopo documentado

- Frontend Vue 3 com Vite, Pinia, Vue Router, Axios, Chart.js e portal do colaborador.
- Backend Node.js com Express 5, Mongoose, JWT, Multer, parser de planilha e agregacao de metricas.
- Banco MongoDB com isolamento multi-tenant por loja.
- Fluxos de login admin, upload de auditorias, dashboards, rankings, relatorios e portal self-service.
