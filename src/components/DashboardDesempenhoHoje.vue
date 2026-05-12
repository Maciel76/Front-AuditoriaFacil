<script setup>
import { computed, ref, watch } from 'vue';
import api from '@/services/api';
import AppChart from '@/components/AppChart.vue';
import Loader from '@/components/Loader.vue';

const props = defineProps({
  tipo: { type: String, default: '' },
  lojaId: { type: String, default: '' },
});

const carregando = ref(false);
const erro = ref('');
const items = ref([]);

function formatarPontos(valor = 0) {
  return `${Math.round(Number(valor || 0)).toLocaleString('pt-BR')} pts`;
}

function formatarItens(valor = 0) {
  return `${Number(valor || 0).toLocaleString('pt-BR')} itens`;
}

function abreviarNome(nome = '') {
  const texto = String(nome || '').trim();
  if (!texto) return 'Sem nome';
  const partes = texto.split(/\s+/).filter(Boolean);
  return partes[0] || texto;
}

async function carregar() {
  carregando.value = true;
  erro.value = '';

  try {
    const params = { periodo: '1d' };
    if (props.tipo) params.tipo = props.tipo;
    if (props.lojaId) params.lojaId = props.lojaId;

    const { data } = await api.get('/metricas/ranking/colaboradores', { params });
    items.value = Array.isArray(data?.items) ? data.items : [];
  } catch (error) {
    erro.value = error?.response?.data?.error || 'Não foi possível carregar o desempenho de hoje.';
    items.value = [];
  } finally {
    carregando.value = false;
  }
}

const itensOrdenados = computed(() =>
  items.value
    .filter((item) => Number(item?.totalLidos || 0) > 0)
    .slice()
    .sort((a, b) =>
      Number(b?.totalLidos || 0) - Number(a?.totalLidos || 0)
      || Number(b?.pontuacao || 0) - Number(a?.pontuacao || 0)
      || Number(b?.taxaConformidade || 0) - Number(a?.taxaConformidade || 0)
      || String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR'),
    ),
);

const itensExibidos = computed(() => itensOrdenados.value.slice(0, 8));

const chartHeight = computed(() => 320);

const chartData = computed(() => ({
  labels: itensExibidos.value.map((item, index) => `${index + 1}. ${abreviarNome(item.nome)}`),
  datasets: [
    {
      label: 'Itens auditados',
      data: itensExibidos.value.map((item) => Number(item.totalLidos || 0)),
      backgroundColor: itensExibidos.value.map((_, index) => {
        if (index === 0) return '#7c5cff';
        if (index === 1) return 'rgba(124, 92, 255, 0.82)';
        if (index === 2) return 'rgba(124, 92, 255, 0.72)';
        return 'rgba(124, 92, 255, 0.56)';
      }),
      borderColor: itensExibidos.value.map((_, index) =>
        index === 0 ? '#7c5cff' : 'rgba(124, 92, 255, 0.94)',
      ),
      borderWidth: 1,
      borderRadius: 14,
      borderSkipped: false,
      maxBarThickness: 24,
    },
  ],
}));

const chartOptions = computed(() => ({
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        title(context) {
          const item = itensExibidos.value[context[0]?.dataIndex];
          return item?.nome || 'Colaborador';
        },
        label(context) {
          const item = itensExibidos.value[context.dataIndex];
          if (!item) return formatarItens(context.raw);
          return `${formatarItens(item.totalLidos)} · ${formatarPontos(item.pontuacao)}`;
        },
      },
    },
  },
  scales: {
    x: {
      ticks: {
        autoSkip: false,
      },
    },
    y: {
      beginAtZero: true,
      ticks: {
        callback: (value) => Number(value || 0).toLocaleString('pt-BR'),
      },
    },
  },
}));

const liderDoDia = computed(() => itensOrdenados.value[0] || null);

watch([() => props.tipo, () => props.lojaId], carregar, { immediate: true });
</script>

<template>
  <div class="ranking-hoje-card">
    <Loader v-if="carregando" />

    <div v-else-if="erro" class="empty ranking-hoje-state">
      {{ erro }}
    </div>

    <div v-else-if="!itensOrdenados.length" class="empty ranking-hoje-state">
      Sem desempenho de colaboradores neste dia.
    </div>

    <template v-else>
      <div class="ranking-hoje-headline">
        <div class="ranking-hoje-copy">
          <strong>{{ liderDoDia.nome }}</strong>
          <span class="muted">
            lidera o dia com {{ formatarItens(liderDoDia.totalLidos) }} e
            {{ formatarPontos(liderDoDia.pontuacao) }}.
          </span>
        </div>
        <span class="badge ranking-hoje-badge">{{ itensOrdenados.length }} no dia</span>
      </div>

      <AppChart type="bar" :data="chartData" :height="chartHeight" :options="chartOptions" />
    </template>
  </div>
</template>

<style scoped>
.ranking-hoje-card {
  display: grid;
  gap: 14px;
}

.ranking-hoje-state {
  min-height: 220px;
  display: grid;
  place-items: center;
  text-align: center;
}

.ranking-hoje-headline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.ranking-hoje-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.ranking-hoje-copy strong {
  font-size: 15px;
}

.ranking-hoje-copy span {
  font-size: 12px;
}

.ranking-hoje-badge {
  white-space: nowrap;
}
</style>