// A mesma composição é usada na prévia da loja e nos dois perfis.
// A base acompanha o tema do portal para preservar a leitura dos textos.
const fundos = {
  "fundo-natal": { background: "linear-gradient(135deg, color-mix(in srgb, #dc2626 15%, var(--bg-1)), color-mix(in srgb, #16a34a 12%, var(--bg-1)))", borderColor: "#dc262666" },
  "fundo-copa-2026": { background: "linear-gradient(135deg, color-mix(in srgb, #16a34a 18%, var(--bg-1)), var(--bg-1))", borderColor: "#22c55e66" },
  "fundo-estrelas": { background: "linear-gradient(135deg, color-mix(in srgb, #1d4ed8 25%, var(--bg-1)), var(--bg-1))", borderColor: "#60a5fa66", "--fundo-cor-a": "#93c5fd", "--fundo-cor-b": "#6366f1" },
  "fundo-oceano": { background: "linear-gradient(135deg, color-mix(in srgb, #0891b2 20%, var(--bg-1)), var(--bg-1))", borderColor: "#06b6d466", "--fundo-cor-a": "#67e8f9", "--fundo-cor-b": "#2563eb" },
  "fundo-matrix": { background: "linear-gradient(135deg, color-mix(in srgb, #166534 20%, var(--bg-1)), var(--bg-1))", borderColor: "#22c55e66", "--fundo-cor-a": "#4ade80", "--fundo-cor-b": "#166534" },
  "fundo-crepusculo": { background: "linear-gradient(135deg, color-mix(in srgb, #f97316 18%, var(--bg-1)), color-mix(in srgb, #a855f7 18%, var(--bg-1)))", borderColor: "#fb718566", "--fundo-cor-a": "#fbbf24", "--fundo-cor-b": "#fb7185" },
  "fundo-chamas": { background: "linear-gradient(135deg, color-mix(in srgb, #dc2626 20%, var(--bg-1)), var(--bg-1))", borderColor: "#f9731666", "--fundo-cor-a": "#fbbf24", "--fundo-cor-b": "#f97316" },
  "fundo-prisma": { background: "linear-gradient(135deg, color-mix(in srgb, #8b5cf6 15%, var(--bg-1)), var(--bg-1))", borderColor: "#c084fc66", "--fundo-cor-a": "#ec4899", "--fundo-cor-b": "#22d3ee" },
  "fundo-aurora": {
    background: "radial-gradient(ellipse at 100% 0%, #22d3ee55, transparent 65%), radial-gradient(ellipse at 0% 100%, #10b98155, transparent 65%), linear-gradient(135deg, color-mix(in srgb, #10b981 12%, var(--bg-1)), var(--bg-1))",
    borderColor: "#10b98166",
  },
  "fundo-nebulosa": {
    "--fundo-cor-a": "#ec4899", "--fundo-cor-b": "#8b5cf6",
    background: "radial-gradient(ellipse at 90% 10%, #ec489955, transparent 60%), radial-gradient(ellipse at 10% 90%, #8b5cf666, transparent 65%), linear-gradient(135deg, color-mix(in srgb, #a855f7 14%, var(--bg-1)), var(--bg-1))",
    borderColor: "#a855f766",
  },
  "fundo-dourado": {
    "--fundo-cor-a": "#fbbf24", "--fundo-cor-b": "#f59e0b",
    background: "radial-gradient(ellipse at 100% 0%, #fbbf2466, transparent 60%), repeating-linear-gradient(135deg, #f59e0b0a 0px, #f59e0b0a 16px, transparent 16px, transparent 32px), linear-gradient(135deg, color-mix(in srgb, #f59e0b 15%, var(--bg-1)), var(--bg-1))",
    borderColor: "#f59e0b66",
  },
};

export function estiloFundoPerfil(fundo) {
  return fundos[fundo?.codigo] || {};
}
