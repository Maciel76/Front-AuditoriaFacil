<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import api from '@/services/api';
import KpiCard from '@/components/KpiCard.vue';
import AppChart from '@/components/AppChart.vue';
import Loader from '@/components/Loader.vue';
import PeriodoSelector from '@/components/PeriodoSelector.vue';
import { RouterLink } from 'vue-router';

const periodo    = ref('1d');
const dataInicio = ref('');
const dataFim    = ref('');
const carregando = ref(true);
const dados      = ref(null);
const semDados   = ref(false);

async function carregar() {
  carregando.value = true;
  semDados.value   = false;
  try {
    const params = { periodo: periodo.value };
    if (periodo.value === 'custom' && dataInicio.value && dataFim.value) {
      params.dataInicio = dataInicio.value;
      params.dataFim    = dataFim.value;
    }
    const { data } = await api.get('/metricas/dashboard', { params });
    dados.value = data;
    // Verifica se o período retornou algum dado
    semDados.value = data.totalGeral.totalLidos === 0;
  } finally {
    carregando.value = false;
  }
}

async function irParaUltimaData() {
  try {
    const { data } = await api.get('/metricas/ultima-data');
    if (data.data) {
      const d = new Date(data.data).toISOString().slice(0, 10);
      periodo.value    = 'custom';
      dataInicio.value = d;
      dataFim.value    = d;
    }
  } catch { /* ignora */ }
}

onMounted(carregar);
watch(periodo, carregar);
watch([dataInicio, dataFim], () => { if (periodo.value === 'custom') carregar(); });

const corPorTipo = { ETIQUETA: '#7c5cff', PRESENCA: '#22d3ee', RUPTURA: '#f59e0b' };

const kpis = computed(() => {
  const d = dados.value;
  if (!d) return [];
  return [
    { label: 'Itens auditados', value: d.totalGeral.totalLidos.toLocaleString('pt-BR'), icon: 'clipboard-check' },
    { label: 'Conformidade', value: d.totalGeral.taxaConformidade.toFixed(1), suffix: '%', icon: 'shield-halved' },
    { label: 'Pontuação total', value: Math.round(d.totalGeral.pontuacao).toLocaleString('pt-BR'), icon: 'star' },
    { label: 'Custo ruptura', value: 'R$\u00a0' + d.totalGeral.custoRuptura.toLocaleString('pt-BR', { maximumFractionDigits: 0 }), icon: 'triangle-exclamation' },
    { label: 'Colaboradores ativos', value: d.colaboradoresAtivos, icon: 'users' },
  ];
});

const conformidadeComoColunas = computed(() => (dados.value?.serie?.length || 0) <= 12);

const serieChart = computed(() => {
  const d = dados.value;
  if (!d?.serie?.length) return { labels: [], datasets: [] };
  const dias   = [...new Set(d.serie.map((x) => x._id.dia))].sort();
  const tipos  = ['ETIQUETA', 'PRESENCA', 'RUPTURA'];
  const datasets = tipos.map((t) => {
    const map = new Map();
    d.serie.filter((x) => x._id.tipo === t).forEach((x) => map.set(x._id.dia, x.taxaConformidade || 0));

    if (conformidadeComoColunas.value) {
      return {
        label: t,
        data: dias.map((dia) => map.get(dia) ?? 0),
        backgroundColor: corPorTipo[t],
        borderColor: corPorTipo[t],
        borderRadius: 16,
        borderSkipped: false,
        maxBarThickness: 40,
      };
    }

    return {
      label: t,
      data: dias.map((dia) => map.get(dia) ?? null),
      borderColor: corPorTipo[t],
      tension: 0.35,
      spanGaps: true,
      fill: true,
      pointRadius: 3,
      borderWidth: 2,
    };
  });
  return { labels: dias.map((d) => d.slice(5)), datasets };
});

const conformidadeChartOptions = computed(() => ({
  plugins: {
    tooltip: {
      callbacks: {
        label: (context) => `${context.dataset.label}: ${Number(context.raw ?? context.parsed?.y ?? 0).toFixed(1)}%`,
      },
    },
  },
  scales: {
    x: {
      stacked: false,
    },
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
  const d = dados.value;
  if (!d) return { labels: [], datasets: [] };
  const tipos = Object.keys(d.totaisPorTipo).filter((t) => d.totaisPorTipo[t].totalLidos > 0);
  if (!tipos.length) return { labels: [], datasets: [] };
  return {
    labels: tipos,
    datasets: [{
      data: tipos.map((t) => d.totaisPorTipo[t].totalLidos),
      backgroundColor: tipos.map((t) => corPorTipo[t]),
      borderColor: 'transparent',
      borderWidth: 3,
    }],
  };
});
</script>

<template>
  <div class="grid gap-3">
    <div class="row">
      <PeriodoSelector
        v-model="periodo"
        v-model:dataInicio="dataInicio"
        v-model:dataFim="dataFim"
      />
      <span class="spacer" />
      <RouterLink to="/auditorias" class="btn primary">
        <fa icon="cloud-arrow-up" /> Enviar planilha
      </RouterLink>
    </div>

    <Loader v-if="carregando" />

    <!-- Estado vazio: sem dados no período -->
    <template v-else-if="semDados">
      <div class="empty" style="padding: 80px 20px;">
        <fa icon="chart-line" style="font-size: 48px; opacity:.25; display:block; margin: 0 auto 20px;" />
        <h3 style="margin: 0 0 8px;">Nenhum dado para este período</h3>
        <p class="muted" style="margin: 0 0 20px; font-size: 14px;">
          Selecione outro período ou navegue até a data da última auditoria disponível.
        </p>
        <button class="btn primary" @click="irParaUltimaData">
          <fa icon="calendar" /> Ver última auditoria
        </button>
      </div>
    </template>

    <template v-else>
      <!-- KPIs -->
      <div class="kpi-grid">
        <KpiCard v-for="(k, i) in kpis" :key="i" v-bind="k" />
      </div>

      <!-- Charts -->
      <div class="grid" style="grid-template-columns: 2fr 1fr; gap: 16px;">
        <div class="card">
          <div class="row mb-2">
            <h3 class="mt-0 mb-0">Conformidade ao longo do período</h3>
            <span class="spacer" /><fa :icon="conformidadeComoColunas ? 'chart-bar' : 'chart-line'" class="muted" />
          </div>
          <AppChart :type="conformidadeComoColunas ? 'bar' : 'line'" :data="serieChart" :height="300"
            :options="conformidadeChartOptions" />
        </div>
        <div class="card">
          <div class="row mb-2">
            <h3 class="mt-0 mb-0">Por tipo</h3>
            <span class="spacer" /><fa icon="chart-pie" class="muted" />
          </div>
          <AppChart type="doughnut" :data="distribTipo" :height="300"
            :options="{ cutout: '65%', plugins: { legend: { position: 'bottom' } } }" />
        </div>
      </div>

      <!-- Cards por tipo -->
      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
        <div v-for="(t, key) in dados.totaisPorTipo" :key="key" class="card glow" :class="t.totalLidos === 0 ? 'dim-card' : ''">
          <div class="row mb-2">
            <span class="badge" :class="'tipo-' + key">{{ key }}</span>
            <span class="spacer" />
            <span class="muted" style="font-size: 12px;">{{ t.dias }} dia(s)</span>
          </div>
          <div v-if="t.totalLidos === 0" class="muted" style="font-size: 13px; padding: 8px 0;">Sem dados neste período</div>
          <template v-else>
            <div style="font-size: 30px; font-weight: 700;">{{ t.taxaConformidade.toFixed(1) }}%</div>
            <div class="muted" style="font-size: 12px; margin-top: 2px;">
              {{ t.totalConformes.toLocaleString('pt-BR') }} de {{ t.totalLidos.toLocaleString('pt-BR') }} conformes
            </div>
            <div class="progress mt-2"><span :style="{ width: Math.min(100, t.taxaConformidade) + '%' }" /></div>
            <div class="row mt-2" style="font-size: 12px;">
              <span class="muted">Pts</span>
              <strong>{{ Math.round(t.pontuacao) }}</strong>
              <span class="spacer" />
              <span v-if="t.custoRuptura > 0" class="badge bad">
                R$ {{ t.custoRuptura.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) }}
              </span>
            </div>
          </template>
        </div>
      </div>

      <!-- Últimas auditorias -->
      <div class="card">
        <div class="row mb-2">
          <h3 class="mt-0 mb-0">Últimas auditorias</h3>
          <span class="spacer" />
          <RouterLink to="/auditorias" class="btn ghost">Ver todas <fa icon="chevron-right" /></RouterLink>
        </div>
        <div v-if="!dados.ultimasAuditorias?.length" class="empty">Nenhuma auditoria enviada ainda.</div>
        <div v-else class="table-wrap">
          <table class="table">
            <thead>
              <tr><th>Tipo</th><th>Data</th><th>Itens</th><th>Conformidade</th><th>Pontuação</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="a in dados.ultimasAuditorias" :key="a._id">
                <td><span class="badge" :class="'tipo-' + a.tipo">{{ a.tipo }}</span></td>
                <td>{{ new Date(a.data).toLocaleDateString('pt-BR') }}</td>
                <td>{{ a.totalLidos?.toLocaleString('pt-BR') }} / {{ a.totalItens?.toLocaleString('pt-BR') }}</td>
                <td>{{ a.taxaConformidade?.toFixed(1) }}%</td>
                <td>{{ Math.round(a.pontuacao || 0) }}</td>
                <td class="text-right">
                  <RouterLink :to="`/auditorias/${a._id}`" class="btn ghost"><fa icon="eye" /></RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
