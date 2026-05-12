# Rotas Frontend

## Router principal

Arquivo fonte: frontend/src/router.js

## Guardas globais

- Rotas com meta.auth exigem autenticacao pelo token do app principal.
- Rotas com meta.publica redirecionam usuario autenticado para /dashboard quando a rota e /login.
- Rotas com meta.roles exigem que auth.usuario.role esteja entre os roles declarados.

## Tabela de rotas

| Caminho                   | Nome                  | Auth       | Role extra               | Componente               | Funcao                                                     |
| ------------------------- | --------------------- | ---------- | ------------------------ | ------------------------ | ---------------------------------------------------------- |
| /login                    | login                 | Nao        | Nenhum                   | Login.vue                | Login administrativo e cadastro de loja                    |
| /portal                   | portal                | Nao        | Nenhum                   | ColaboradorPortal.vue    | Portal self-service do colaborador                         |
| /portal/colegas/:colegaId | portal-colega-perfil  | Nao        | Nenhum                   | ColaboradorPortal.vue    | Pagina de perfil publico de um colega dentro do portal     |
| /                         | shell                 | Sim        | Nenhum                   | AppLayout.vue            | Casca autenticada da aplicacao                             |
| /dashboard                | dashboard             | Sim        | Nenhum                   | Dashboard.vue            | KPIs gerais, serie e ultimas auditorias                    |
| /lojas                    | lojas                 | Sim        | Nenhum                   | Lojas.vue                | Catalogo autenticado de lojas                              |
| /lojas/:id                | loja-perfil           | Sim        | Nenhum                   | LojaPerfil.vue           | Perfil analitico publico de uma loja                       |
| /auditorias               | auditorias            | Sim        | Nenhum                   | Auditorias.vue           | Upload e historico                                         |
| /auditorias/:id           | auditoria-detalhe     | Sim        | Nenhum                   | AuditoriaDetalhe.vue     | Detalhe e itens da auditoria                               |
| /rankings                 | redirect              | Sim        | Nenhum                   | redirect                 | Redireciona para /rankings/colaboradores                   |
| /rankings/colaboradores   | ranking-colaboradores | Sim        | SUPER_ADMIN, STORE_ADMIN | RankingColaboradores.vue | Ranking de colaboradores por periodo, tipo e loja opcional |
| /rankings/lojas           | ranking-lojas         | Sim        | SUPER_ADMIN, STORE_ADMIN | RankingLojas.vue         | Ranking geral de lojas por periodo e tipo                  |
| /colaboradores            | colaboradores         | Sim        | Nenhum                   | Colaboradores.vue        | Gestao e consulta de colaboradores                         |
| /colaboradores/:id        | colaborador-perfil    | Sim        | Nenhum                   | ColaboradorPerfil.vue    | Perfil analitico do colaborador                            |
| /relatorios               | relatorios            | Sim        | Nenhum                   | Relatorios.vue           | Relatorios por situacao e setor                            |
| /configuracoes            | configuracoes         | Sim        | Nenhum                   | Configuracoes.vue        | Dados da loja e usuarios                                   |
| /admin/lojas              | admin-lojas           | Sim        | SUPER_ADMIN              | AdminLojas.vue           | CRUD de lojas                                              |
| /admin/conquistas         | admin-conquistas      | Sim        | SUPER_ADMIN              | AdminConquistas.vue      | CRUD de conquistas, tiers e bonus de XP                    |
| /:pathMatch(._)_          | fallback              | Dependente | Nenhum                   | redirect                 | Redireciona para /dashboard                                |

## Fluxo de navegacao do app principal

1. App.vue monta e tenta auth.carregarMe se existir token.
2. Router libera /login ou /portal sem token.
3. Rotas autenticadas sempre carregam AppLayout.vue.
4. AppLayout mostra navegacao lateral e RouterView interno.
5. Mudanca de rota fecha sidebar mobile automaticamente.

## Observacoes importantes

- /portal nao usa a store auth do app principal; ele controla sessao por conta propria.
- /portal/colegas/:colegaId reutiliza o mesmo fluxo do portal e depende do token `na_portal_token` ja presente no navegador para resolver o perfil publico do colega.
- /rankings/colaboradores, /rankings/lojas, /admin/lojas e /admin/conquistas usam meta.roles no frontend.
- /lojas e /lojas/:id ficam disponiveis para todos os perfis autenticados do app principal.
- O redirecionamento padrao cai em /dashboard, portanto qualquer nova rota deve considerar esse comportamento.
