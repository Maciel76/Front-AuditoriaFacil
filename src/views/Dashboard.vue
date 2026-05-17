<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import api from '@/services/api';
import KpiCard from '@/components/KpiCard.vue';
import AppChart from '@/components/AppChart.vue';
import Loader from '@/components/Loader.vue';
import PeriodoSelector from '@/components/PeriodoSelector.vue';
import { RouterLink } from 'vue-router';
import html2canvas from 'html2canvas';

const periodo     = ref('1d');
const dataInicio  = ref('');
const dataFim     = ref('');
const tipo        = ref('');
const carregando  = ref(true);
const refreshing  = ref(false);
const captureArea = ref(null);
const exportando  = ref(false);
const dataKey     = ref(0);
const dados       = ref(null);
const semDados    = ref(false);

async function carregar() {
  if (dados.value) refreshing.value = true;
  else carregando.value = true;
  semDados.value   = false;
  try {
    const params = { periodo: periodo.value };
    if (periodo.value === 'custom' && dataInicio.value && dataFim.value) {
      params.dataInicio = dataInicio.value;
      params.dataFim    = dataFim.value;
    }
    if (tipo.value) params.tipo = tipo.value;
    const { data } = await api.get('/metricas/dashboard', { params });
    dados.value = data;
    semDados.value = data.totalGeral.totalLidos === 0;
    dataKey.value++;
  } finally {
    carregando.value = false;
    refreshing.value = false;
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
watch(tipo, carregar);
watch([dataInicio, dataFim], () => { if (periodo.value === 'custom') carregar(); });

const corPorTipo = { ETIQUETA: '#7c5cff', PRESENCA: '#22d3ee', RUPTURA: '#f59e0b' };

const kpis = computed(() => {
  const d = dados.value;
  if (!d) return [];
  const isEtiqueta = tipo.value === 'ETIQUETA';
  const cardItens = isEtiqueta
    ? { label: 'Etiquetas lidas', value: d.totalGeral.totalLidos.toLocaleString('pt-BR'), icon: 'clipboard-check' }
    : { label: 'Itens auditados', value: d.totalGeral.totalLidos.toLocaleString('pt-BR'), icon: 'clipboard-check' };
  const cardPontuacao = isEtiqueta
    ? { label: 'Desatualizadas', value: Number(d.totalDesatualizados || 0).toLocaleString('pt-BR'), icon: 'tag' }
    : { label: 'Pontuação total', value: Math.round(d.totalGeral.pontuacao).toLocaleString('pt-BR'), icon: 'star' };
  const cardRuptura = isEtiqueta
    ? { label: 'Não lidas c/ estoque', value: Number(d.totalNaoLidos || 0).toLocaleString('pt-BR'), icon: 'eye-slash' }
    : { label: 'Custo ruptura', value: 'R$\u00a0' + d.totalGeral.custoRuptura.toLocaleString('pt-BR', { maximumFractionDigits: 0 }), icon: 'triangle-exclamation' };
  return [
    cardItens,
    { label: 'Conformidade', value: d.totalGeral.taxaConformidade.toFixed(1), suffix: '%', icon: 'shield-halved' },
    cardPontuacao,
    cardRuptura,
    { label: 'Colaboradores ativos', value: d.colaboradoresAtivos, icon: 'users' },
  ];
});

const conformidadeComoColunas = computed(() => (dados.value?.serie?.length || 0) <= 12);

const tiposDaSerie = computed(() =>
  tipo.value ? [tipo.value] : ['ETIQUETA', 'PRESENCA', 'RUPTURA'],
);

const serieChart = computed(() => {
  const d = dados.value;
  if (!d?.serie?.length) return { labels: [], datasets: [] };
  const dias   = [...new Set(d.serie.map((x) => x._id.dia))].sort();
  const datasets = tiposDaSerie.value.map((t) => {
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
  }).filter((ds) => ds.data.some((v) => v !== null && v !== 0));
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

async function esperarCapturaEstavel() {
  await nextTick();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function sincronizarCamposDeFormulario(originalRoot, clonedRoot) {
  const originalFields = originalRoot.querySelectorAll('input, select, textarea');
  const clonedFields = clonedRoot.querySelectorAll('input, select, textarea');

  originalFields.forEach((field, index) => {
    const clonedField = clonedFields[index];
    if (!clonedField) return;

    clonedField.value = field.value;
    if ('checked' in field) clonedField.checked = field.checked;
  });
}

function copiarCanvases(originalRoot, clonedRoot) {
  const originalCanvases = originalRoot.querySelectorAll('canvas');
  const clonedCanvases = clonedRoot.querySelectorAll('canvas');

  originalCanvases.forEach((canvas, index) => {
    const clonedCanvas = clonedCanvases[index];
    if (!clonedCanvas) return;

    clonedCanvas.width = canvas.width;
    clonedCanvas.height = canvas.height;
    clonedCanvas.style.width = `${canvas.clientWidth}px`;
    clonedCanvas.style.height = `${canvas.clientHeight}px`;

    const context = clonedCanvas.getContext('2d');
    if (context) context.drawImage(canvas, 0, 0);
  });
}

function limparEstadosTransitorios(clonedRoot) {
  clonedRoot.querySelectorAll('*').forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.style.animation = 'none';
    node.style.transition = 'none';
    node.style.caretColor = 'transparent';
  });

  clonedRoot.querySelector('.dash-refreshing')?.classList.remove('dash-refreshing');

  const shareButton = clonedRoot.querySelector('.dash-share-btn');
  if (shareButton) {
    shareButton.removeAttribute('disabled');
    shareButton.setAttribute('aria-busy', 'false');
  }
}

function aplicarTemaAtualNoClone(container) {
  const temaAtual = document.documentElement.getAttribute('data-theme') || 'dark';
  const rootStyles = getComputedStyle(document.documentElement);
  const bodyStyles = getComputedStyle(document.body);
  const themeVars = [
    '--bg-0',
    '--bg-1',
    '--bg-2',
    '--bg-3',
    '--surface',
    '--surface-strong',
    '--border',
    '--border-strong',
    '--text',
    '--text-dim',
    '--text-mute',
    '--primary',
    '--primary-2',
    '--accent',
    '--success',
    '--warning',
    '--danger',
    '--grad-primary',
    '--grad-warm',
    '--grad-success',
    '--grad-card',
    '--radius-sm',
    '--radius',
    '--radius-lg',
    '--shadow-sm',
    '--shadow',
    '--shadow-lg',
  ];

  container.setAttribute('data-theme', temaAtual);

  themeVars.forEach((name) => {
    const value = rootStyles.getPropertyValue(name).trim();
    if (value) container.style.setProperty(name, value);
  });

  container.style.color = rootStyles.getPropertyValue('--text').trim() || bodyStyles.color;
  container.style.backgroundColor = rootStyles.getPropertyValue('--bg-0').trim() || bodyStyles.backgroundColor || '#ffffff';
  container.style.backgroundImage = bodyStyles.backgroundImage !== 'none' ? bodyStyles.backgroundImage : 'none';
  container.style.backgroundPosition = bodyStyles.backgroundPosition;
  container.style.backgroundSize = bodyStyles.backgroundSize;
  container.style.backgroundRepeat = bodyStyles.backgroundRepeat;
}

async function compartilhar() {
  if (!captureArea.value || exportando.value) return;

  exportando.value = true;
  let tempContainer = null;

  try {
    const target = captureArea.value;
    await esperarCapturaEstavel();

    const targetRect = target.getBoundingClientRect();
    const rootStyles = getComputedStyle(document.documentElement);

    tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-20000px';
    tempContainer.style.top = '0';
    tempContainer.style.width = `${Math.ceil(targetRect.width)}px`;
    tempContainer.style.maxWidth = 'none';
    tempContainer.style.padding = '0';
    tempContainer.style.margin = '0';
    tempContainer.style.boxSizing = 'border-box';
    tempContainer.style.overflow = 'visible';
    aplicarTemaAtualNoClone(tempContainer);

    const clonedTarget = target.cloneNode(true);
    clonedTarget.style.width = '100%';
    clonedTarget.style.maxWidth = 'none';
    clonedTarget.style.overflow = 'visible';

    tempContainer.appendChild(clonedTarget);
    document.body.appendChild(tempContainer);

    sincronizarCamposDeFormulario(target, clonedTarget);
    copiarCanvases(target, clonedTarget);
    limparEstadosTransitorios(clonedTarget);
    await esperarCapturaEstavel();

    const canvas = await html2canvas(tempContainer, {
      backgroundColor: rootStyles.getPropertyValue('--bg-0').trim() || '#ffffff',
      useCORS: true,
      allowTaint: true,
      logging: false,
      imageTimeout: 15000,
      scale: Math.max(2, window.devicePixelRatio || 1),
      width: Math.ceil(tempContainer.scrollWidth),
      height: Math.ceil(tempContainer.scrollHeight),
      scrollX: 0,
      scrollY: 0,
    });

    const link = document.createElement('a');
    const periodoLabel = {
      '1d': 'hoje',
      '7d': 'semana',
      '30d': 'mes',
      '365d': 'ano',
      'all': 'historico',
      'custom': 'periodo',
    }[periodo.value] || periodo.value;
    const tipoLabel = tipo.value ? '-' + tipo.value.toLowerCase() : '';

    link.download = `dashboard-${periodoLabel}${tipoLabel}-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } finally {
    if (tempContainer?.parentNode) tempContainer.parentNode.removeChild(tempContainer);
    exportando.value = false;
  }
}

const taxaCentro = computed(() => {
  const d = dados.value;
  if (!d) return null;
  if (tipo.value && d.totaisPorTipo[tipo.value]?.totalLidos > 0) {
    return d.totaisPorTipo[tipo.value].taxaConformidade;
  }
  return d.totalGeral.taxaConformidade;
});
</script>

<template>
  <div ref="captureArea" class="grid gap-3">
    <div class="row">
      <PeriodoSelector
        v-model="periodo"
        v-model:dataInicio="dataInicio"
        v-model:dataFim="dataFim"
      />
      <select v-model="tipo" class="btn ghost" style="padding: 8px 14px">
        <option value="">Todos os tipos</option>
        <option value="ETIQUETA">Etiqueta</option>
        <option value="PRESENCA">Presença</option>
        <option value="RUPTURA">Ruptura</option>
      </select>
      <span class="spacer" />
      <button class="btn primary dash-share-btn" :disabled="exportando" :aria-busy="exportando" @click="compartilhar">
        <fa icon="share-nodes" />
        Compartilhar
      </button>
    </div>

    <Loader v-if="carregando" />

    <!-- Estado vazio: sem dados no período -->
    <template v-else-if="semDados && !refreshing">
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

    <template v-else-if="dados">
      <div :class="['dash-content', { 'dash-refreshing': refreshing }]">
      <!-- KPIs -->
      <div class="kpi-grid" :key="'kpi-' + dataKey">
        <KpiCard v-for="(k, i) in kpis" :key="k.label" v-bind="k" class="dash-kpi-item" :style="{ animationDelay: i * 55 + 'ms' }" />
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
          <div style="position: relative;">
            <AppChart type="doughnut" :data="distribTipo" :height="300"
              :options="{ cutout: '65%', plugins: { legend: { position: 'bottom' } } }" />
            <Transition name="dash-fade">
              <div v-if="taxaCentro !== null" :key="taxaCentro" style="
                position: absolute; top: 0; left: 0; right: 0;
                height: calc(100% - 36px);
                display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                pointer-events: none;
              ">
                <span style="font-size: 26px; font-weight: 800; line-height: 1;">{{ (100 - taxaCentro).toFixed(1) }}%</span>
                <span style="font-size: 11px; opacity: .55; margin-top: 3px;">restante</span>
              </div>
            </Transition>
          </div>
        </div>
      </div>

      <!-- Cards por tipo -->
      <div class="grid dash-tipo-grid" :key="'tipo-' + dataKey" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
        <div v-for="(t, key, i) in dados.totaisPorTipo" :key="key" class="card glow dash-tipo-item" :class="t.totalLidos === 0 ? 'dim-card' : ''" :style="{ animationDelay: i * 70 + 'ms' }">
          <div class="row mb-2">
            <span class="badge" :class="'tipo-' + key">{{ key }}</span>
            <span class="spacer" />
            <span class="muted" style="font-size: 12px;">{{ t.dias }} dia(s)</span>
          </div>
          <div v-if="t.totalLidos === 0" class="muted" style="font-size: 13px; padding: 8px 0;">Sem dados neste período</div>
          <template v-else>
            <div style="font-size: 30px; font-weight: 700;">{{ t.taxaConformidade.toFixed(1) }}%</div>
            <div class="muted" style="font-size: 12px; margin-top: 2px;">
              <template v-if="key === 'ETIQUETA'">
                {{ t.totalLidos.toLocaleString('pt-BR') }} de {{ t.totalItensAuditaveis.toLocaleString('pt-BR') }} lidos
              </template>
              <template v-else>
                {{ t.totalConformes.toLocaleString('pt-BR') }} de {{ t.totalLidos.toLocaleString('pt-BR') }} conformes
              </template>
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
      </div>
    </template>
  </div>
</template>

<style scoped>
.dash-content {
  display: grid;
  gap: 16px;
  transition: opacity 0.2s ease, filter 0.2s ease;
}

.dash-refreshing {
  opacity: 0.45;
  filter: blur(1.5px);
  pointer-events: none;
}

/* KPI cards stagger */
.dash-kpi-item {
  animation: dashSlideUp 0.35s ease both;
}

/* Tipo cards stagger */
.dash-tipo-item {
  animation: dashSlideUp 0.38s ease both;
}

@keyframes dashSlideUp {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Centro do doughnut */
.dash-fade-enter-active,
.dash-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.dash-fade-enter-from,
.dash-fade-leave-to {
  opacity: 0;
  transform: scale(0.88);
}
</style>
