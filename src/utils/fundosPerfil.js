// A mesma composição é usada na prévia da loja e nos dois perfis.
// A base acompanha o tema do portal para preservar a leitura dos textos.
const fundos = {
  "fundo-aurora": {
    background: "radial-gradient(ellipse at 100% 0%, #22d3ee55, transparent 65%), radial-gradient(ellipse at 0% 100%, #10b98155, transparent 65%), linear-gradient(135deg, color-mix(in srgb, #10b981 12%, var(--bg-1)), var(--bg-1))",
    borderColor: "#10b98166",
  },
  "fundo-nebulosa": {
    background: "radial-gradient(ellipse at 90% 10%, #ec489955, transparent 60%), radial-gradient(ellipse at 10% 90%, #8b5cf666, transparent 65%), linear-gradient(135deg, color-mix(in srgb, #a855f7 14%, var(--bg-1)), var(--bg-1))",
    borderColor: "#a855f766",
  },
  "fundo-dourado": {
    background: "radial-gradient(ellipse at 100% 0%, #fbbf2466, transparent 60%), repeating-linear-gradient(135deg, #f59e0b0a 0px, #f59e0b0a 16px, transparent 16px, transparent 32px), linear-gradient(135deg, color-mix(in srgb, #f59e0b 15%, var(--bg-1)), var(--bg-1))",
    borderColor: "#f59e0b66",
  },
};

export function estiloFundoPerfil(fundo) {
  return fundos[fundo?.codigo] || {};
}
