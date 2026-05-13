# Dependencias e Integracoes

## Banco e persistencia

### MongoDB

- Banco primario do sistema.
- Consumido pelo backend via Mongoose.
- Configurado por MONGO_URI.

### Sistema de arquivos local

- Uploads de avatar sao persistidos em uploads/avatares.
- O backend expoe esses arquivos via express.static em /uploads.

## Integracoes internas entre camadas

### Frontend -> Backend

- HTTP REST via Axios.
- Base padrao: http://localhost:4000/api.
- Consumo autenticado por Bearer token.

### Backend -> Parser

- Processamento de planilha com biblioteca xlsx.
- Formatos aceitos: xlsx, xlsm, xlsb, xls, csv, ods.

## Bibliotecas principais do backend

| Biblioteca | Papel no sistema |
| --- | --- |
| express | API HTTP e roteamento |
| mongoose | Modelagem e acesso ao MongoDB |
| zod | Validacao de payload |
| bcryptjs | Hash e verificacao de senha |
| jsonwebtoken | Emissao e validacao de JWT |
| multer | Upload de planilha e avatar |
| xlsx | Leitura de arquivos tabulares |
| dayjs | Calculo de periodos e parse de datas |
| helmet | Headers de seguranca |
| cors | Politica de origem |
| express-rate-limit | Protecao basica contra abuso |
| morgan | Log HTTP |

## Bibliotecas principais do frontend

| Biblioteca | Papel no sistema |
| --- | --- |
| vue | UI reativa |
| vue-router | Rotas da SPA |
| pinia | Estado global |
| axios | Cliente HTTP |
| chart.js | Graficos |
| vue-chartjs | Integracao Vue + Chart.js |
| cropperjs | Recorte de avatar |
| html2canvas | Renderizacao HTML em canvas para funcionalidades futuras ou existentes de exportacao |
| jspdf | Geracao de PDF |
| qrcode.vue | QR code |
| lodash | Utilitarios |
| vue-virtual-scroller | Renderizacao eficiente de listas extensas |
| fontawesome | Iconografia |

## Variaveis de ambiente confirmadas

### Backend

- MONGO_URI
- PORT
- NODE_ENV
- CORS_ORIGIN
- JWT_SECRET
- JWT_EXPIRES
- UPLOAD_MAX_MB
- BOOTSTRAP_ADMIN_EMAIL
- BOOTSTRAP_ADMIN_PASSWORD
- BOOTSTRAP_ADMIN_NAME

### Frontend

- VITE_API_BASE

## Integracoes ausentes ou nao encontradas

- Nao ha gateway externo de pagamento.
- Nao ha servico de notificacao push, email ou SMS implementado.
- Nao ha webhooks, filas ou broker de mensagens.
- Nao ha armazenamento em nuvem para uploads.
- Nao ha containerizacao ou CI/CD documentados no repositorio.

## Dependencias de navegacao e estado do navegador

- localStorage para tokens, usuario, loja e preferencia de tema.
- confirm nativo do navegador em operacoes destrutivas de UI.

## Risco operacional de integracao

- A comunicacao entre app principal e portal exige isolamento de token no frontend.
- Qualquer alteracao no schema de planilha precisa manter alinhamento com o parser e com as regras de negocio.