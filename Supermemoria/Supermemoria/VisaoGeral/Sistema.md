# Sistema NovaAuditoria

## O que e o sistema

NovaAuditoria e um sistema SaaS multi-tenant para gestao de auditorias operacionais de loja, com foco em tres frentes de verificacao: Etiqueta, Presenca e Ruptura. O sistema recebe planilhas operacionais, processa as linhas, classifica conformidade por regra, calcula pontuacao e consolida metricas por loja, por colaborador e por periodo.

## Objetivo principal

- Centralizar uploads de auditoria por loja.
- Calcular conformidade e pontuacao automaticamente.
- Exibir historico, dashboards, rankings e relatorios sem depender de analise manual em planilha.
- Permitir um portal self-service para o colaborador consultar seu proprio desempenho, avatar e credenciais.

## Publico-alvo

- SUPER_ADMIN: visao global da operacao, administracao de lojas, ranking agregado entre lojas.
- STORE_ADMIN: operacao de uma loja especifica, upload de planilhas, gestao local de colaboradores e usuarios.
- COLABORADOR: consulta do proprio desempenho via portal e, quando houver conta vinculada, acesso como usuario do sistema.

## Arquitetura macro

### Frontend

- Vue 3.5 com Vite 7.
- Roteamento via Vue Router.
- Estado global via Pinia.
- Consumo de API via Axios.
- Visualizacoes com Chart.js e Vue Chart.js.
- Tema claro/escuro no app principal e tema independente no portal do colaborador.

### Backend

- Node.js com Express 5 em ESM.
- MongoDB via Mongoose 8.
- Autenticacao JWT para usuarios administrativos e JWT separado para colaborador do portal.
- Upload com Multer.
- Validacao de payload com Zod.
- Processamento de planilhas com xlsx.

### Persistencia

- MongoDB armazena entidades operacionais, auditorias, itens detalhados e metricas diarias agregadas.
- Uploads de avatar sao gravados em disco em uploads/avatares e servidos como arquivo estatico.

## Como frontend e backend se comunicam

- O frontend usa a instancia Axios central em frontend/src/services/api.js.
- O token principal do app e persistido em localStorage na chave na_token.
- O portal do colaborador usa um token proprio em localStorage na chave na_portal_token e injeta Authorization manualmente nas chamadas do portal.
- O backend expoe a API em /api e arquivos estaticos em /uploads.

## Funcionalidades principais confirmadas

- Cadastro inicial de loja com criacao automatica de STORE_ADMIN.
- Login administrativo por email e senha.
- CRUD de lojas, usuarios e colaboradores com controle por role.
- Upload de auditoria com override manual de tipo.
- Processamento idempotente: reupload do mesmo dia e tipo substitui os itens antigos.
- Dashboard com KPIs, serie temporal, distribuicao por tipo e ultimas auditorias.
- Rankings de colaboradores e de lojas por periodo e tipo.
- Relatorios de situacoes e classes/setores.
- Perfil detalhado do colaborador no app administrativo.
- Portal do colaborador com fluxo matricula -> selecao de loja -> setup/login -> portal.
- Alteracao de avatar com recorte previo e troca de senha no portal.

## Fluxo principal do usuario

### Fluxo administrativo

1. Usuario faz login em /login.
2. Router guard valida autenticacao e abre o AppLayout.
3. Usuario navega entre dashboard, auditorias, rankings, colaboradores, relatorios e configuracoes.
4. Em upload de auditoria, backend processa planilha, recalcula metricas e devolve resumo.
5. Views seguintes passam a consultar metricas agregadas e detalhes persistidos.

### Fluxo do colaborador

1. Colaborador entra em /portal.
2. Informa matricula.
3. Sistema lista as lojas em que aquela matricula existe.
4. Se for primeiro acesso, define senha. Caso contrario, faz login com senha.
5. O portal carrega dados do proprio colaborador e suas metricas historicas.
6. O colaborador pode alterar foto, alternar tema do portal e trocar a senha.

## Pontos criticos do sistema

- Multi-tenancy depende do middleware escopoLoja e do uso correto de req.escopoLojaId nas queries.
- O portal do colaborador nao pode reutilizar cegamente o middleware de usuario administrativo.
- Periodos historicos devem ser ancorados na ultima data com dados, nao no relogio atual, para evitar dashboards vazios quando a base nao esta sincronizada com hoje.
- O cliente Axios principal nao pode sobrescrever Authorization de chamadas do portal.
- Uploads de auditoria alteram metricas acumuladas; qualquer mudanca no processador afeta dashboards, rankings e perfis.
- A entidade Colaborador e usada tanto como participante das planilhas quanto como conta do portal.

## Fontes de verdade no repositorio

- Frontend: frontend/src
- Backend: backend/src
- Manifestos: frontend/package.json e backend/package.json
- Documentacao resumida original: README.md

## Lacunas e ausencias confirmadas

- Nao ha suite automatizada de testes no repositorio.
- Nao ha scripts de deploy, containerizacao ou backup documentados.
- Nao ha integracoes externas de webhook ou servicos terceiros alem das bibliotecas locais e do MongoDB.