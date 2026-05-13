<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import api from '@/services/api';
import Loader from '@/components/Loader.vue';
import AppChart from '@/components/AppChart.vue';
import PeriodoSelector from '@/components/PeriodoSelector.vue';

const route = useRoute();
const periodo = ref('1d');
const dataInicio = ref('');
const dataFim = ref('');
const carregando = ref(true);
const dados = ref(null);

async function carregar() {
  carregando.value = true;
  try {
    const params = { periodo: periodo.value };
    if (periodo.value === 'custom' && dataInicio.value && dataFim.value) {
      params.dataInicio = dataInicio.value;
      params.dataFim = dataFim.value;
    }
    const { data } = await api.get(`/metricas/colaboradores/${route.params.id}/perfil`, { params });
    dados.value = data;
  } finally { carregando.value = false; }
}
onMounted(carregar);
watch([periodo, dataInicio, dataFim], () => {
  if (periodo.value !== 'custom' || (dataInicio.value && dataFim.value)) carregar();
});

const corPorTipo = { ETIQUETA: '#7c5cff', PRESENCA: '#22d3ee', RUPTURA: '#f59e0b' };

const serieComoColunas = computed(() => (dados.value?.serie?.length || 0) <= 12);

const serieChart = computed(() => {
  if (!dados.value) return { labels: [], datasets: [] };
  const dias = [...new Set(dados.value.serie.map((x) => x._id.dia))].sort();
  const tipos = ['ETIQUETA', 'PRESENCA', 'RUPTURA'];
  return {
    labels: dias.map((d) => d.slice(5)),
    datasets: tipos.map((t) => {
      const m = new Map();
      dados.value.serie.filter((x) => x._id.tipo === t).forEach((x) => m.set(x._id.dia, x.totalLidos));

      if (serieComoColunas.value) {
        return {
          label: t,
          data: dias.map((d) => m.get(d) ?? 0),
          backgroundColor: corPorTipo[t],
          borderColor: corPorTipo[t],
          borderRadius: 12,
          borderSkipped: false,
          maxBarThickness: 36,
        };
      }

      return {
        label: t,
        data: dias.map((d) => m.get(d) ?? null),
        borderColor: corPorTipo[t],
        tension: 0.35,
        spanGaps: true,
        fill: true,
        pointRadius: 3,
        borderWidth: 2,
      };
    }),
  };
});

const serieChartOptions = computed(() => ({
  plugins: {
    tooltip: {
      callbacks: {
        label: (context) => `${context.dataset.label}: ${Number(context.raw ?? context.parsed?.y ?? 0).toLocaleString('pt-BR')} itens`,
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        precision: 0,
      },
    },
  },
}));
</script>

<template>
  <Loader v-if="carregando" />
  <div v-else-if="dados" class="grid gap-3">
    <RouterLink to="/colaboradores" class="btn ghost" style="width: fit-content;"><fa icon="chevron-right" style="transform: rotate(180deg);" /> Voltar</RouterLink>

    <div class="card glow row" style="padding: 24px;">
      <div class="avatar" style="width: 72px; height: 72px; font-size: 22px;">{{ (dados.colaborador.nome || '?').slice(0,2) }}</div>
      <div style="flex:1">
        <h2 class="mt-0 mb-0">{{ dados.colaborador.nome }}</h2>
        <div class="muted">#{{ dados.colaborador.codigoExterno }} · {{ dados.colaborador.cargo || 'Colaborador' }}</div>
        <div class="row mt-2" style="gap:6px; flex-wrap:wrap;">
          <span v-for="c in dados.colaborador.conquistas" :key="c.codigo" class="badge info"><fa icon="award" /> {{ c.nome }}</span>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 32px; font-weight: 800;">{{ Math.round(dados.colaborador.pontuacao) }}</div>
        <div class="muted">pontos · Nível {{ dados.colaborador.nivel }}</div>
      </div>
    </div>

    <div class="row">
      <PeriodoSelector
        v-model="periodo"
        v-model:dataInicio="dataInicio"
        v-model:dataFim="dataFim"
      />
    </div>

    <div class="kpi-grid">
      <div v-for="t in dados.porTipo" :key="t._id" class="kpi">
        <div class="ico" :style="{ background: corPorTipo[t._id] }"><fa icon="clipboard-check" /></div>
        <div class="label">{{ t._id }}</div>
        <div class="value">{{ t.totalLidos.toLocaleString('pt-BR') }}</div>
        <div class="muted" style="font-size: 12px; margin-top: 4px;">
          {{ t.totalConformes }} conformes · {{ Math.round(t.pontuacao) }} pts
        </div>
      </div>
    </div>

    <div class="card">
      <div class="row mb-2">
        <h3 class="mt-0 mb-0">Itens lidos por dia</h3>
        <span class="spacer" /><fa :icon="serieComoColunas ? 'chart-bar' : 'chart-line'" class="muted" />
      </div>
      <AppChart :type="serieComoColunas ? 'bar' : 'line'" :data="serieChart" :height="320" :options="serieChartOptions" />
    </div>
  </div>
</template>
