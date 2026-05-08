# Gamificacao do Colaborador

Esta pasta centraliza a documentacao do sistema de conquistas, XP e niveis do colaborador.

## Navegacao desta pasta

- [[Gamificacao/VisaoGeral]]
- [[Gamificacao/FluxoDoColaborador]]
- [[Gamificacao/AdministracaoDeConquistas]]

## O que esta documentado aqui

- O que hoje vale como XP no sistema.
- Como o colaborador sobe de nivel.
- Como as conquistas sao avaliadas, persistidas e exibidas no portal.
- Como o SUPER_ADMIN cria, edita, desativa ou remove conquistas.
- Quais limitacoes e cuidados operacionais existem na implementacao atual.

## Fontes primarias confirmadas no codigo

- `backend/src/models/Conquista.js`
- `backend/src/models/Colaborador.js`
- `backend/src/services/conquistasService.js`
- `backend/src/services/conquistasSeed.js`
- `backend/src/services/auditoriaProcessor.js`
- `backend/src/routes/conquistas.routes.js`
- `backend/src/routes/metricas.routes.js`
- `frontend/src/views/AdminConquistas.vue`
- `frontend/src/views/ColaboradorPortal.vue`

## Relacoes com a Supermemoria principal

- Regras resumidas em [[RegrasDeNegocio/RegrasOperacionais]]
- Fluxo ponta a ponta em [[FluxosDoSistema/FluxosPrincipais]]
- Rotas em [[Rotas/RotasAPI]] e [[Rotas/RotasFrontend]]
- Models em [[BancoDeDados/ModelosESchemas]]
