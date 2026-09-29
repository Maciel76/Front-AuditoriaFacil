// Nome de cada painel que a loja manda para os grupos do WhatsApp.
// As chaves são as mesmas que o backend usa em whatsappCompartilhamento.js: é
// por elas que o resultado do envio volta, painel a painel.

export const TITULOS_PAINEL = {
  dashboard: "Dashboard",
  ranking: "Ranking de colaboradores",
  "relatorio-corredor": "Relatório por corredor",
  "relatorio-classe": "Relatório por classe",
};

export function tituloPainel(chave) {
  return TITULOS_PAINEL[chave] || chave || "Painel";
}
