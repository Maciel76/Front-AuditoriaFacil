// Utilitários compartilhados pelos rankings (Lojas e Colaboradores).
// Centraliza definição dos modos de ordenação, cálculo de médias e formatação,
// para manter a feature sustentável: novos rankings são adicionados aqui.

export const LABELS_PERIODO = {
  "1d": "Hoje",
  semana: "Semana",
  mes: "Mês",
  ano: "Ano",
  tudo: "Histórico",
  custom: "Período personalizado",
};

export const LABELS_TIPO = {
  ETIQUETA: "Etiqueta",
  PRESENCA: "Presença",
  RUPTURA: "Ruptura",
};

// Acessores reutilizáveis nas métricas (recebem item bruto do backend).
const acc = {
  pontuacao: (i) => Number(i?.pontuacao || 0),
  totalLidos: (i) => Number(i?.totalLidos || 0),
  taxaConformidade: (i) => Number(i?.taxaConformidade || 0),
  percentualConclusao: (i) =>
    i?.percentualConclusao == null ? null : Number(i.percentualConclusao),
  percentualRestante: (i) =>
    i?.percentualRestante == null ? null : Number(i.percentualRestante),
  custoRuptura: (i) => Number(i?.custoRuptura || 0),
  custoRupturaEvitado: (item) => Number(item?.custoRupturaEvitado || 0),
  auditoriasCanceladas: (item) => Number(item?.auditoriasCanceladas || 0),
  totalAuditorias: (i) => Number(i?.totalAuditorias || 0),
  auditoriasEtiqueta: (i) => Number(i?.auditoriasPorTipo?.ETIQUETA || 0),
  auditoriasPresenca: (i) => Number(i?.auditoriasPorTipo?.PRESENCA || 0),
  auditoriasRuptura: (i) => Number(i?.auditoriasPorTipo?.RUPTURA || 0),
  dias: (i) => Number(i?.dias || 0),
  totalConformes: (i) => Number(i?.totalConformes || 0),
};

function fmtInt(v) {
  return Math.round(Number(v) || 0).toLocaleString("pt-BR");
}

function fmtPct(v) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return `${Number(v).toFixed(1)}%`;
}

function fmtMoeda(v) {
  return `R$ ${Number(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtPontos(v) {
  return `${fmtInt(v)} pts`;
}

// Modos comuns aos dois rankings.
const MODOS_COMUNS = [
  {
    id: "pontuacao",
    label: "Maior pontuação",
    desc: "Soma de pontos no período",
    grupo: "Desempenho",
    direction: "desc",
    accessor: acc.pontuacao,
    format: fmtPontos,
    unidade: "pts",
  },
  {
    id: "lidos_desc",
    label: "Mais itens lidos",
    desc: "Total de itens auditados",
    grupo: "Volume",
    direction: "desc",
    accessor: acc.totalLidos,
    format: (v) => `${fmtInt(v)} itens`,
    unidade: "itens",
  },
  {
    id: "conformidade_desc",
    label: "Maior % de conformidade",
    desc: "Maior taxa de conformidade",
    grupo: "Desempenho",
    direction: "desc",
    accessor: acc.taxaConformidade,
    format: fmtPct,
    unidade: "%",
  },
  {
    id: "conclusao_desc",
    label: "Maior % de conclusão",
    desc: "Itens lidos sobre auditáveis",
    grupo: "Conclusão",
    direction: "desc",
    accessor: acc.percentualConclusao,
    format: fmtPct,
    unidade: "%",
    requer: "percentualConclusao",
  },
  {
    id: "restante_asc",
    label: "Menor % restante",
    desc: "Itens que faltam para concluir",
    grupo: "Conclusão",
    direction: "asc",
    accessor: acc.percentualRestante,
    format: fmtPct,
    unidade: "%",
    requer: "percentualRestante",
  },
  {
    id: "restante_desc",
    label: "Maior % restante",
    desc: "Lojas mais distantes da meta",
    grupo: "Conclusão",
    direction: "desc",
    accessor: acc.percentualRestante,
    format: fmtPct,
    unidade: "%",
    requer: "percentualRestante",
  },
  {
    id: "custo_ruptura_desc",
    label: "Maior custo de ruptura",
    desc: "Custo total de ruptura no período",
    grupo: "Ruptura",
    direction: "desc",
    accessor: acc.custoRuptura,
    format: fmtMoeda,
    unidade: "R$",
  },
  {
    id: "custo_ruptura_asc",
    label: "Menor custo de ruptura",
    desc: "Menor exposição a perdas",
    grupo: "Ruptura",
    direction: "asc",
    accessor: acc.custoRuptura,
    format: fmtMoeda,
    unidade: "R$",
  },
  {
    id: "auditorias_total_desc",
    label: "Mais auditorias",
    desc: "Total de auditorias realizadas",
    grupo: "Volume",
    direction: "desc",
    accessor: acc.totalAuditorias,
    format: (v) => `${fmtInt(v)} auditorias`,
    unidade: "auditorias",
  },
  {
    id: "auditorias_etiqueta_desc",
    label: "Mais auditorias de Etiqueta",
    desc: "Volume de auditorias ETIQUETA",
    grupo: "Volume",
    direction: "desc",
    accessor: acc.auditoriasEtiqueta,
    format: (v) => `${fmtInt(v)} etiqueta`,
    unidade: "auditorias",
  },
  {
    id: "auditorias_presenca_desc",
    label: "Mais auditorias de Presença",
    desc: "Volume de auditorias PRESENCA",
    grupo: "Volume",
    direction: "desc",
    accessor: acc.auditoriasPresenca,
    format: (v) => `${fmtInt(v)} presença`,
    unidade: "auditorias",
  },
  {
    id: "auditorias_ruptura_desc",
    label: "Mais auditorias de Ruptura",
    desc: "Volume de auditorias RUPTURA",
    grupo: "Volume",
    direction: "desc",
    accessor: acc.auditoriasRuptura,
    format: (v) => `${fmtInt(v)} ruptura`,
    unidade: "auditorias",
  },
];

const MODOS_COLABORADORES_EXTRA = [
  {
    id: "dias_desc",
    label: "Mais dias atuando",
    desc: "Dias com auditoria registrada",
    grupo: "Engajamento",
    direction: "desc",
    accessor: acc.dias,
    format: (v) => `${fmtInt(v)} dias`,
    unidade: "dias",
  },
  {
    id: "conformes_desc",
    label: "Mais itens conformes",
    desc: "Volume absoluto de conformes",
    grupo: "Volume",
    direction: "desc",
    accessor: acc.totalConformes,
    format: (v) => `${fmtInt(v)} conformes`,
    unidade: "itens",
  },
];

const MODOS_RANKING_COLABORADORES_OCULTOS = new Set([
  "pontuacao",
  "conformidade_desc",
]);

function usarCustoRupturaEvitado(modo) {
  if (modo.id === "custo_ruptura_desc") {
    return {
      ...modo,
      label: "Maior custo evitado",
      desc: "Custo dos itens lidos em auditorias de Ruptura",
      accessor: acc.custoRupturaEvitado,
    };
  }

  if (modo.id === "custo_ruptura_asc") {
    return {
      ...modo,
      label: "Menor custo evitado",
      desc: "Menor valor evitado nas leituras de Ruptura",
      accessor: acc.custoRupturaEvitado,
    };
  }

  return modo;
}

const MODOS_COLABORADORES_BASE = MODOS_COMUNS.filter(
  (modo) => !MODOS_RANKING_COLABORADORES_OCULTOS.has(modo.id),
).map(usarCustoRupturaEvitado);

const MODOS_LOJAS_EXTRA = [
  {
    id: "cancelamentos_desc",
    label: "Mais cancelamentos",
    desc: "Auditorias canceladas no período",
    grupo: "Cancelamentos",
    direction: "desc",
    accessor: acc.auditoriasCanceladas,
    format: (v) => `${fmtInt(v)} cancelamento(s)`,
    unidade: "cancelamentos",
  },
];

export const MODOS_RANKING_LOJAS = [
  ...MODOS_COMUNS.map(usarCustoRupturaEvitado),
  ...MODOS_LOJAS_EXTRA,
];
export const MODOS_RANKING_COLABORADORES = [
  ...MODOS_COLABORADORES_BASE,
  ...MODOS_COLABORADORES_EXTRA,
];

export function obterModo(modos, id) {
  return modos.find((m) => m.id === id) || modos[0];
}

// Ordena os itens copiando para um novo array e usando o accessor do modo.
// Itens com valor nulo (ex.: % conclusão sem itens auditáveis) caem para o
// final, independente da direção, para evitar empates artificiais no topo.
export function ordenarItens(items, modo) {
  if (!Array.isArray(items) || !modo) return Array.isArray(items) ? items : [];
  const dir = modo.direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const va = modo.accessor(a);
    const vb = modo.accessor(b);
    const aNull = va == null || Number.isNaN(va);
    const bNull = vb == null || Number.isNaN(vb);
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    if (va === vb) return 0;
    return va > vb ? dir : -dir;
  });
}

// Calcula média simples do valor do modo selecionado para os itens visíveis.
// Retorna null se não houver dados numéricos.
export function calcularMedia(items, modo) {
  if (!Array.isArray(items) || !items.length || !modo) return null;
  const valores = items
    .map((i) => modo.accessor(i))
    .filter((v) => v != null && !Number.isNaN(Number(v)));
  if (!valores.length) return null;
  const soma = valores.reduce((acc, v) => acc + Number(v), 0);
  return soma / valores.length;
}

// Determina se o item bateu a meta de auditoria (percentual restante <=
// limiar configurado). Retorna false quando o cálculo de % restante não é
// possível para o item (ex.: tipo sem itens auditáveis).
export function metaBatida(item, limiar) {
  const restante = acc.percentualRestante(item);
  if (restante == null) return false;
  return restante <= Number(limiar || 0);
}

// Para compor a chave reativa que invalida a transição visual após filtros.
export function chaveItensVisivel(items) {
  return (items || []).map((i) => i._id).join("|");
}

export const formatters = { fmtInt, fmtPct, fmtMoeda, fmtPontos };
