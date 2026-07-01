<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import api from "@/services/api";
import Loader from "@/components/Loader.vue";
import LoadingOverlay from "@/components/LoadingOverlay.vue";
import KpiCard from "@/components/KpiCard.vue";
import AppChart from "@/components/AppChart.vue";
import PeriodoSelector from "@/components/PeriodoSelector.vue";
import StoreAvatar from "@/components/StoreAvatar.vue";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const route = useRoute();

const periodo = ref("1d");
const dataInicio = ref("");
const dataFim = ref("");
const tipo = ref("");
const carregando = ref(true);
const erro = ref("");
const dados = ref(null);

const labelsTipo = {
  ETIQUETA: "Etiqueta",
  PRESENCA: "Presença",
  RUPTURA: "Ruptura",
};

const coresTipo = {
  ETIQUETA: "#7c5cff",
  PRESENCA: "#22d3ee",
  RUPTURA: "#f59e0b",
};

const campoMetaPorTipo = {
  ETIQUETA: "conformidadeEtiqueta",
  PRESENCA: "conformidadePresenca",
  RUPTURA: "conformidadeRuptura",
};

const labelsPeriodo = {
  "1d": "Hoje",
  semana: "Semana",
  mes: "Mês",
  ano: "Ano",
  tudo: "Histórico",
  custom: "Período personalizado",
};

function formatarInteiro(valor = 0) {
  return Number(valor || 0).toLocaleString("pt-BR");
}

function formatarMoeda(valor = 0) {
  return `R$ ${Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function formatarPercentual(valor = 0, casas = 1) {
  return `${Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
}

function formatarData(valor) {
  if (!valor) return "Sem data recente";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Sem data recente";
  return data.toLocaleDateString("pt-BR");
}

function localDaLoja(loja) {
  return (
    [loja?.cidade, loja?.estado].filter(Boolean).join(" / ") ||
    "Local não informado"
  );
}

function statusRelatorio(item) {
  const taxa = Number(item?.taxaConformidade || 0);
  if (taxa >= 92)
    return {
      key: "excellent",
      label: "Excelente",
      color: "#22c55e",
      soft: "rgba(34, 197, 94, 0.12)",
    };
  if (taxa >= 80)
    return {
      key: "good",
      label: "Bom",
      color: "#4f9cf0",
      soft: "rgba(79, 156, 240, 0.15)",
    };
  if (taxa >= 65)
    return {
      key: "warn",
      label: "Atenção",
      color: "#f59e0b",
      soft: "rgba(245, 158, 11, 0.16)",
    };
  return {
    key: "critical",
    label: "Crítico",
    color: "#ef4444",
    soft: "rgba(239, 68, 68, 0.14)",
  };
}

function estiloStatus(item) {
  const status = statusRelatorio(item);
  return {
    "--store-accent": status.color,
    "--store-accent-soft": status.soft,
  };
}

function rotaAuditoria(auditoriaId) {
  if (auth.isSuperAdmin && loja.value?._id) {
    return {
      path: `/auditorias/${auditoriaId}`,
      query: { lojaId: loja.value._id },
    };
  }
  return { path: `/auditorias/${auditoriaId}` };
}

function statusAuditoria(auditoria) {
  if (auditoria?.status === "CANCELADA")
    return { label: "Cancelada", classe: "bad" };
  if (auditoria?.status === "ERRO") return { label: "Erro", classe: "bad" };
  if (auditoria?.status === "PROCESSANDO")
    return { label: "Processando", classe: "warn" };
  return { label: "Concluída", classe: "ok" };
}

async function carregar() {
  carregando.value = true;
  erro.value = "";

  try {
    const params = { periodo: periodo.value, tipo: tipo.value || undefined };
    if (periodo.value === "custom" && dataInicio.value && dataFim.value) {
      params.dataInicio = dataInicio.value;
      params.dataFim = dataFim.value;
    }

    const { data } = await api.get(
      `/metricas/lojas/${route.params.id}/perfil`,
      { params },
    );
    dados.value = data;
  } catch (error) {
    dados.value = null;
    erro.value =
      error?.response?.data?.error ||
      "Não foi possível carregar o perfil da loja.";
  } finally {
    carregando.value = false;
  }
}

onMounted(carregar);
watch(() => route.params.id, carregar);
watch([periodo, tipo, dataInicio, dataFim], () => {
  if (periodo.value !== "custom" || (dataInicio.value && dataFim.value))
    carregar();
});

const loja = computed(() => dados.value?.loja || null);

const semDados = computed(() => {
  if (!dados.value) return false;
  return (
    Number(dados.value.totalGeral?.totalLidos || 0) === 0 &&
    !dados.value.ultimasAuditorias?.length
  );
});

const periodoAtivoLabel = computed(() => {
  if (periodo.value === "custom")
    return `${dataInicio.value || "--"} a ${dataFim.value || "--"}`;
  return labelsPeriodo[periodo.value] || periodo.value;
});

const tipoAtivoLabel = computed(() =>
  tipo.value ? labelsTipo[tipo.value] || tipo.value : "Todos os tipos",
);

const kpis = computed(() => {
  if (!dados.value) return [];

  const lista = [
    {
      label: "Itens auditados",
      value: formatarInteiro(dados.value.totalGeral.totalLidos),
      icon: "clipboard-check",
    },
    {
      label: "Conformidade",
      value: Number(dados.value.totalGeral.taxaConformidade || 0).toFixed(1),
      suffix: "%",
      icon: "shield-halved",
    },
    {
      label: "Pontuação",
      value: formatarInteiro(Math.round(dados.value.totalGeral.pontuacao || 0)),
      icon: "star",
    },
    {
      label: "Custo ruptura",
      value: formatarMoeda(dados.value.totalGeral.custoRuptura),
      icon: "triangle-exclamation",
    },
    {
      label: "Colaboradores ativos",
      value: formatarInteiro(dados.value.colaboradoresAtivos || 0),
      icon: "users",
    },
    {
      label: "Auditorias no período",
      value: formatarInteiro(dados.value.auditoriasNoPeriodo || 0),
      icon: "calendar",
    },
  ];
  if (Number(dados.value.auditoriasCanceladasNoPeriodo || 0) > 0) {
    lista.push({
      label: "Auditorias canceladas",
      value: formatarInteiro(dados.value.auditoriasCanceladasNoPeriodo || 0),
      icon: "triangle-exclamation",
    });
  }
  return lista;
});

const panoramaOperacional = computed(() => {
  if (!dados.value) return [];

  return [
    {
      titulo: "Classes monitoradas",
      valor: formatarInteiro(dados.value.classes?.length || 0),
      detalhe: "classes com leitura no período",
    },
    {
      titulo: "Corredores monitorados",
      valor: formatarInteiro(dados.value.corredores?.length || 0),
      detalhe: "corredores com itens auditados",
    },
    {
      titulo: "Última auditoria",
      valor: formatarData(dados.value.ultimasAuditorias?.[0]?.data),
      detalhe: "referência mais recente registrada",
    },
  ];
});

const conformidadeComoColunas = computed(
  () => (dados.value?.serie?.length || 0) <= 12,
);

const tiposDaSerie = computed(() =>
  tipo.value ? [tipo.value] : Object.keys(coresTipo),
);

const serieChart = computed(() => {
  const serie = dados.value?.serie || [];
  if (!serie.length) return { labels: [], datasets: [] };

  const dias = [...new Set(serie.map((item) => item._id.dia))].sort();
  const datasets = tiposDaSerie.value
    .map((tipoAtual) => {
      const mapa = new Map();
      serie
        .filter((item) => item._id.tipo === tipoAtual)
        .forEach((item) => mapa.set(item._id.dia, item.taxaConformidade || 0));

      const data = dias.map((dia) => mapa.get(dia) ?? null);
      if (!data.some((valor) => valor !== null)) return null;

      if (conformidadeComoColunas.value) {
        return {
          label: labelsTipo[tipoAtual] || tipoAtual,
          data,
          backgroundColor: coresTipo[tipoAtual],
          borderColor: coresTipo[tipoAtual],
          borderRadius: 16,
          borderSkipped: false,
          maxBarThickness: 42,
        };
      }

      return {
        label: labelsTipo[tipoAtual] || tipoAtual,
        data,
        borderColor: coresTipo[tipoAtual],
        tension: 0.35,
        spanGaps: true,
        fill: true,
        pointRadius: 3,
        borderWidth: 2,
      };
    })
    .filter(Boolean);

  return {
    labels: dias.map((dia) => dia.slice(5)),
    datasets,
  };
});

const conformidadeChartOptions = computed(() => ({
  plugins: {
    tooltip: {
      callbacks: {
        label: (context) =>
          `${context.dataset.label}: ${Number(context.raw ?? context.parsed?.y ?? 0).toFixed(1)}%`,
      },
    },
  },
  scales: {
    y: {
      min: 0,
      max: 100,
      ticks: {
        callback: (value) => `${value}%`,
      },
    },
  },
}));

const distribTipo = computed(() => {
  if (!dados.value?.totaisPorTipo) return { labels: [], datasets: [] };

  const tipos = Object.keys(dados.value.totaisPorTipo).filter(
    (tipoAtual) =>
      Number(dados.value.totaisPorTipo[tipoAtual]?.totalLidos || 0) > 0,
  );
  return {
    labels: tipos.map((tipoAtual) => labelsTipo[tipoAtual] || tipoAtual),
    datasets: [
      {
        data: tipos.map(
          (tipoAtual) => dados.value.totaisPorTipo[tipoAtual].totalLidos,
        ),
        backgroundColor: tipos.map((tipoAtual) => coresTipo[tipoAtual]),
        borderColor: "transparent",
      },
    ],
  };
});

const tiposResumo = computed(() => {
  if (!dados.value?.totaisPorTipo) return [];

  return Object.entries(dados.value.totaisPorTipo).map(
    ([tipoAtual, resumo]) => {
      const meta = Number(
        loja.value?.metas?.[campoMetaPorTipo[tipoAtual]] || 0,
      );
      const taxa = Number(resumo.taxaConformidade || 0);
      return {
        key: tipoAtual,
        label: labelsTipo[tipoAtual] || tipoAtual,
        meta,
        taxa,
        atingiu: taxa >= meta,
        ...resumo,
      };
    },
  );
});

const chartSituacoes = computed(() => {
  const situacoes = dados.value?.situacoes || [];
  const labels = [...new Set(situacoes.map((item) => item._id.situacao))];
  const tipos = [...new Set(situacoes.map((item) => item._id.tipo))];

  return {
    labels,
    datasets: tipos.map((tipoAtual) => ({
      label: labelsTipo[tipoAtual] || tipoAtual,
      data: labels.map(
        (situacaoAtual) =>
          situacoes.find(
            (item) =>
              item._id.tipo === tipoAtual &&
              item._id.situacao === situacaoAtual,
          )?.total || 0,
      ),
      backgroundColor: coresTipo[tipoAtual] || "#888",
      borderRadius: 8,
    })),
  };
});

const chartSituacoesOptions = computed(() => ({
  scales: {
    x: { stacked: true },
    y: { stacked: true, ticks: { precision: 0 } },
  },
  plugins: {
    legend: { position: "bottom" },
  },
}));

const topClasses = computed(() =>
  [...(dados.value?.classes || [])]
    .sort(
      (a, b) =>
        a.taxaConformidade - b.taxaConformidade ||
        b.naoConformes - a.naoConformes ||
        b.totalLidos - a.totalLidos,
    )
    .slice(0, 6),
);

const topCorredores = computed(() =>
  [...(dados.value?.corredores || [])]
    .sort(
      (a, b) =>
        a.taxaConformidade - b.taxaConformidade ||
        b.custoRuptura - a.custoRuptura ||
        b.totalLidos - a.totalLidos,
    )
    .slice(0, 6),
);
</script>

<template>
  <LoadingOverlay :show="carregando" />
  <div class="store-profile-shell">
    <div class="row store-profile-toolbar">
      <div class="row" style="gap: 10px; flex-wrap: wrap">
        <RouterLink to="/lojas" class="btn ghost">
          <fa icon="chevron-right" style="transform: rotate(180deg)" /> Todas as
          lojas
        </RouterLink>
        <RouterLink
          v-if="auth.isSuperAdmin"
          to="/admin/lojas"
          class="btn ghost"
        >
          <fa icon="gear" /> Administração
        </RouterLink>
      </div>

      <span class="spacer" />

      <PeriodoSelector
        v-model="periodo"
        v-model:dataInicio="dataInicio"
        v-model:dataFim="dataFim"
        :loading="carregando"
      />

      <select v-model="tipo" class="btn ghost" style="padding: 8px 14px">
        <option value="">Todos os tipos</option>
        <option value="ETIQUETA">Etiqueta</option>
        <option value="PRESENCA">Presença</option>
        <option value="RUPTURA">Ruptura</option>
      </select>
    </div>

    <Loader v-if="carregando" />

    <div v-else-if="erro" class="empty">
      {{ erro }}
    </div>

    <template v-else-if="dados && loja">
      <section class="card glow store-hero">
        <div class="store-hero-main">
          <StoreAvatar
            :nome="loja.nome"
            :avatar-url="loja.avatarUrl"
            :size="74"
            :font-size="28"
            class="store-hero-avatar"
          />
          <div class="store-hero-copy">
            <div class="row" style="gap: 8px; flex-wrap: wrap">
              <span class="badge info">Perfil público autenticado</span>
              <span
                v-if="String(loja._id) === String(auth.loja?._id || '')"
                class="badge ok"
                >Sua loja</span
              >
              <span v-if="!loja.ativa" class="badge bad">Inativa</span>
            </div>
            <h2 class="mt-0 mb-0">{{ loja.nome }}</h2>
            <p class="muted store-hero-copyline">
              {{ localDaLoja(loja) }}
              <span v-if="loja.codigo"> · Código {{ loja.codigo }}</span>
            </p>
          </div>
        </div>

        <div class="store-hero-side">
          <div class="store-hero-chip">
            <span class="muted">Período</span>
            <strong>{{ periodoAtivoLabel }}</strong>
          </div>
          <div class="store-hero-chip">
            <span class="muted">Tipo</span>
            <strong>{{ tipoAtivoLabel }}</strong>
          </div>
          <div class="store-hero-chip">
            <span class="muted">Nível</span>
            <strong>{{ loja.nivel || 1 }}</strong>
          </div>
        </div>
      </section>

      <div v-if="semDados" class="empty store-empty-state">
        Não há dados suficientes para este filtro. Tente outro período ou remova
        o filtro de tipo.
      </div>

      <template v-else>
        <div
          v-if="Number(dados.auditoriasCanceladasNoPeriodo || 0) > 0"
          class="store-cancel-alert"
        >
          <fa icon="triangle-exclamation" />
          <span>
            {{ formatarInteiro(dados.auditoriasCanceladasNoPeriodo) }}
            auditoria(s) cancelada(s) neste período. Os dados desses envios
            estão zerados nos cálculos da loja.
          </span>
        </div>

        <div class="kpi-grid">
          <KpiCard v-for="(item, index) in kpis" :key="index" v-bind="item" />
        </div>

        <section class="store-analytics-grid">
          <div class="card store-panel">
            <div class="row mb-2">
              <div>
                <h3 class="mt-0 mb-0">Conformidade ao longo do período</h3>
                <p class="muted store-panel-copy">
                  Série histórica por tipo para acompanhar consistência,
                  oscilações e recuperação operacional.
                </p>
              </div>
              <span class="spacer" />
              <fa
                :icon="conformidadeComoColunas ? 'chart-bar' : 'chart-line'"
                class="muted"
              />
            </div>
            <AppChart
              :type="conformidadeComoColunas ? 'bar' : 'line'"
              :data="serieChart"
              :options="conformidadeChartOptions"
              :height="320"
            />
          </div>

          <div class="card store-panel">
            <div class="row mb-2">
              <div>
                <h3 class="mt-0 mb-0">Mix por tipo</h3>
                <p class="muted store-panel-copy">
                  Quanto do volume auditado veio de etiqueta, presença e ruptura
                  no recorte ativo.
                </p>
              </div>
              <span class="spacer" />
              <fa icon="chart-pie" class="muted" />
            </div>
            <AppChart
              type="doughnut"
              :data="distribTipo"
              :height="320"
              :options="{
                cutout: '68%',
                plugins: { legend: { position: 'bottom' } },
              }"
            />
          </div>
        </section>

        <section class="store-type-grid">
          <article
            v-for="item in tiposResumo"
            :key="item.key"
            class="card glow store-type-card"
            :class="item.totalLidos === 0 ? 'dim-card' : ''"
          >
            <div class="row mb-2">
              <span class="badge" :class="'tipo-' + item.key">{{
                item.label
              }}</span>
              <span class="spacer" />
              <span class="badge" :class="item.atingiu ? 'ok' : 'bad'"
                >Meta {{ formatarPercentual(item.meta, 0) }}</span
              >
            </div>

            <div
              v-if="item.totalLidos === 0"
              class="muted"
              style="font-size: 13px; padding: 8px 0"
            >
              Sem leitura para este tipo no período selecionado.
            </div>

            <template v-else>
              <div class="store-type-rate">
                {{ formatarPercentual(item.taxa, 1) }}
              </div>
              <template v-if="item.key === 'ETIQUETA'">
                <div class="muted" style="font-size: 12px; margin-top: 4px">
                  {{ formatarInteiro(item.totalLidos) }} de
                  {{ formatarInteiro(item.totalItensAuditaveis) }} lidos
                </div>
              </template>
              <template
                v-else-if="item.key === 'RUPTURA' && Number(item.baseContinuidade || 0) > 0"
              >
                <div class="muted" style="font-size: 12px; margin-top: 4px">
                  {{ formatarInteiro(item.concluidosContinuidade) }} de
                  {{ formatarInteiro(item.baseContinuidade) }} concluídos na
                  continuidade
                </div>
              </template>
              <template v-else>
                <div class="muted" style="font-size: 12px; margin-top: 4px">
                  {{ formatarInteiro(item.totalConformes) }} de
                  {{ formatarInteiro(item.totalLidos) }} conformes
                </div>
              </template>
              <div class="progress mt-2">
                <span :style="{ width: Math.min(100, item.taxa) + '%' }" />
              </div>
              <div
                class="row mt-2"
                style="font-size: 12px; align-items: center"
              >
                <span class="muted">Pts</span>
                <strong>{{
                  formatarInteiro(Math.round(item.pontuacao || 0))
                }}</strong>
                <span class="spacer" />
                <span class="muted">Ruptura</span>
                <strong>{{ formatarMoeda(item.custoRuptura) }}</strong>
              </div>
            </template>
          </article>
        </section>

        <section class="store-panorama-grid">
          <div class="card store-panel">
            <div class="row mb-2">
              <div>
                <h3 class="mt-0 mb-0">Distribuição por situação</h3>
                <p class="muted store-panel-copy">
                  Mostra o volume de ocorrências e ajuda a identificar onde a
                  loja está acumulando desvio.
                </p>
              </div>
              <span class="spacer" />
              <span class="badge dim">{{ tipoAtivoLabel }}</span>
            </div>
            <AppChart
              v-if="chartSituacoes.labels.length"
              type="bar"
              :data="chartSituacoes"
              :options="chartSituacoesOptions"
              :height="300"
            />
            <div v-else class="empty">
              Sem situações consolidadas para o filtro atual.
            </div>
          </div>

          <div class="card store-panel">
            <div class="row mb-2">
              <div>
                <h3 class="mt-0 mb-0">Panorama operacional</h3>
                <p class="muted store-panel-copy">
                  KPIs de cobertura para entender profundidade da operação
                  observada no período.
                </p>
              </div>
              <span class="spacer" />
              <fa icon="circle-info" class="muted" />
            </div>

            <div class="store-panorama-cards">
              <article
                v-for="item in panoramaOperacional"
                :key="item.titulo"
                class="store-panorama-card"
              >
                <span class="muted">{{ item.titulo }}</span>
                <strong>{{ item.valor }}</strong>
                <span class="muted">{{ item.detalhe }}</span>
              </article>
            </div>
          </div>
        </section>

        <section class="store-insights-grid">
          <div class="card store-panel">
            <div class="row mb-2">
              <div>
                <h3 class="mt-0 mb-0">Classes que pedem atenção</h3>
                <p class="muted store-panel-copy">
                  Prioridade por pior conformidade, maior volume lido e acúmulo
                  de desvios.
                </p>
              </div>
              <span class="spacer" />
              <span class="badge dim"
                >{{ formatarInteiro(topClasses.length) }} destaques</span
              >
            </div>

            <div v-if="!topClasses.length" class="empty">
              Sem classes com leitura suficiente no período.
            </div>
            <div v-else class="store-insight-list">
              <article
                v-for="item in topClasses"
                :key="item.nome"
                class="store-insight-row"
                :style="estiloStatus(item)"
              >
                <div>
                  <div class="store-insight-title">{{ item.nome }}</div>
                  <div class="muted" style="font-size: 12px">
                    {{ formatarInteiro(item.totalLidos) }} lidos ·
                    {{ formatarInteiro(item.naoConformes) }} desvios
                  </div>
                </div>
                <div class="store-insight-metric">
                  <strong>{{
                    formatarPercentual(item.taxaConformidade, 1)
                  }}</strong>
                  <span>{{ formatarMoeda(item.custoRuptura) }}</span>
                </div>
              </article>
            </div>
          </div>

          <div class="card store-panel">
            <div class="row mb-2">
              <div>
                <h3 class="mt-0 mb-0">Corredores sob atenção</h3>
                <p class="muted store-panel-copy">
                  Ajuda a localizar rapidamente onde o time precisa agir no
                  salão.
                </p>
              </div>
              <span class="spacer" />
              <span class="badge dim"
                >{{ formatarInteiro(topCorredores.length) }} destaques</span
              >
            </div>

            <div v-if="!topCorredores.length" class="empty">
              Sem corredores com leitura suficiente no período.
            </div>
            <div v-else class="store-insight-list">
              <article
                v-for="item in topCorredores"
                :key="item.nome"
                class="store-insight-row"
                :style="estiloStatus(item)"
              >
                <div>
                  <div class="store-insight-title">{{ item.nome }}</div>
                  <div class="muted" style="font-size: 12px">
                    {{ formatarInteiro(item.totalLidos) }} lidos ·
                    {{ formatarInteiro(item.naoConformes) }} desvios
                  </div>
                </div>
                <div class="store-insight-metric">
                  <strong>{{
                    formatarPercentual(item.taxaConformidade, 1)
                  }}</strong>
                  <span>{{ formatarMoeda(item.custoRuptura) }}</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section class="card store-panel">
          <div class="row mb-2">
            <div>
              <h3 class="mt-0 mb-0">Últimas auditorias</h3>
              <p class="muted store-panel-copy">
                Histórico recente para navegar do perfil macro da loja para o
                detalhe operacional de cada envio.
              </p>
            </div>
            <span class="spacer" />
            <span class="badge dim"
              >{{
                formatarInteiro(dados.ultimasAuditorias.length)
              }}
              registros</span
            >
          </div>

          <div v-if="!dados.ultimasAuditorias.length" class="empty">
            Nenhuma auditoria encontrada para a loja.
          </div>
          <div v-else class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Data</th>
                  <th>Itens</th>
                  <th>Conformidade</th>
                  <th>Pontuação</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="auditoria in dados.ultimasAuditorias"
                  :key="auditoria._id"
                >
                  <td>
                    <span class="badge" :class="'tipo-' + auditoria.tipo">{{
                      auditoria.tipo
                    }}</span>
                    <span
                      class="badge audit-status-badge"
                      :class="statusAuditoria(auditoria).classe"
                    >
                      {{ statusAuditoria(auditoria).label }}
                    </span>
                  </td>
                  <td>{{ formatarData(auditoria.data) }}</td>
                  <td>
                    {{ formatarInteiro(auditoria.totalLidos) }} /
                    {{ formatarInteiro(auditoria.totalItens) }}
                  </td>
                  <td>
                    {{ formatarPercentual(auditoria.taxaConformidade, 1) }}
                  </td>
                  <td>
                    {{ formatarInteiro(Math.round(auditoria.pontuacao || 0)) }}
                  </td>
                  <td class="text-right">
                    <RouterLink
                      :to="rotaAuditoria(auditoria._id)"
                      class="btn ghost"
                      title="Ver auditoria"
                      ><fa icon="eye"
                    /></RouterLink>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.store-profile-shell {
  display: grid;
  gap: 18px;
}

.store-profile-toolbar {
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.store-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 20px;
  align-items: center;
  overflow: hidden;
}

.store-hero-main {
  display: flex;
  gap: 18px;
  align-items: center;
  min-width: 0;
}

.store-hero-avatar {
  box-shadow: 0 22px 40px rgba(32, 60, 90, 0.24);
}

.store-hero-copy {
  min-width: 0;
  display: grid;
  gap: 8px;
}

.store-hero-copy h2 {
  font-size: clamp(24px, 3vw, 34px);
}

.store-hero-copyline {
  margin: 0;
  font-size: 14px;
}

.store-hero-side {
  display: grid;
  grid-template-columns: repeat(3, minmax(120px, 1fr));
  gap: 12px;
}

.store-hero-chip {
  display: grid;
  gap: 4px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
}

.store-hero-chip strong {
  font-size: 16px;
}

.store-empty-state {
  padding: 72px 20px;
}

.store-cancel-alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid rgba(239, 68, 68, 0.32);
  border-radius: 12px;
  color: #fecaca;
  background: rgba(239, 68, 68, 0.11);
  font-size: 13px;
  font-weight: 700;
}

[data-theme="light"] .store-cancel-alert {
  color: #991b1b;
  background: rgba(254, 226, 226, 0.9);
}

.store-analytics-grid,
.store-panorama-grid,
.store-insights-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.store-type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.store-panel {
  display: grid;
  gap: 16px;
}

.store-panel-copy {
  margin: 6px 0 0;
  font-size: 13px;
}

.store-type-card {
  display: grid;
  gap: 8px;
}

.store-type-rate {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.store-panorama-cards {
  display: grid;
  gap: 12px;
}

.store-panorama-card {
  display: grid;
  gap: 4px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
}

.store-panorama-card strong {
  font-size: 18px;
}

.store-insight-list {
  display: grid;
  gap: 12px;
}

.store-insight-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--store-accent) 45%, transparent);
  background: linear-gradient(
    135deg,
    var(--store-accent-soft),
    rgba(255, 255, 255, 0.02)
  );
}

.store-insight-title {
  font-weight: 700;
}

.store-insight-metric {
  display: grid;
  justify-items: end;
  gap: 4px;
  font-size: 13px;
}

.store-insight-metric strong {
  font-size: 20px;
}

.audit-status-badge {
  margin-left: 6px;
}

@media (max-width: 1100px) {
  .store-hero {
    grid-template-columns: 1fr;
  }

  .store-hero-side,
  .store-analytics-grid,
  .store-panorama-grid,
  .store-insights-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .store-profile-toolbar {
    align-items: stretch;
  }

  .store-hero-main {
    align-items: flex-start;
  }

  .store-hero-side {
    grid-template-columns: 1fr;
  }

  .store-insight-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .store-insight-metric {
    justify-items: start;
  }
}
</style>
