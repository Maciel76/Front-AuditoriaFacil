<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import {
  Chart, LineController, BarController, DoughnutController,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement,
  Tooltip, Legend, Filler,
} from 'chart.js';

Chart.register(
  LineController, BarController, DoughnutController,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement,
  Tooltip, Legend, Filler
);

const props = defineProps({
  type: { type: String, default: 'line' },
  data: { type: Object, required: true },
  options: { type: Object, default: () => ({}) },
  height: { type: Number, default: 280 },
});

const canvas = ref(null);
const themeVersion = ref(0);
let chart = null;
let themeObserver = null;

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep(base, override) {
  if (!isObject(base)) return override ?? base;
  if (!isObject(override)) return override ?? base;

  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (Array.isArray(value)) {
      merged[key] = value.slice();
      continue;
    }
    merged[key] = isObject(value) && isObject(merged[key])
      ? mergeDeep(merged[key], value)
      : value;
  }
  return merged;
}

function cssVar(name, fallback) {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function withAlpha(color, alpha) {
  if (!color) return `rgba(124, 92, 255, ${alpha})`;

  if (/^rgba?\(/i.test(color)) {
    const parts = color.match(/[\d.]+/g)?.map(Number);
    if (parts?.length >= 3) return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
  }

  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) hex = hex.split('').map((char) => char + char).join('');
    if (hex.length >= 6) {
      const red = Number.parseInt(hex.slice(0, 2), 16);
      const green = Number.parseInt(hex.slice(2, 4), 16);
      const blue = Number.parseInt(hex.slice(4, 6), 16);
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
  }

  return color;
}

function formatNumber(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return value;
  const maxFractionDigits = Number.isInteger(value) ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  return value.toLocaleString('pt-BR', { maximumFractionDigits: maxFractionDigits });
}

function tooltipValue(context) {
  if (typeof context.parsed === 'number') return context.parsed;
  if (typeof context.parsed?.y === 'number') return context.parsed.y;
  if (typeof context.raw === 'number') return context.raw;
  return context.raw;
}

const theme = computed(() => {
  themeVersion.value;
  return {
    text: cssVar('--text', '#e7ecff'),
    textDim: cssVar('--text-dim', '#9aa3c7'),
    border: cssVar('--border', 'rgba(255,255,255,.08)'),
    borderStrong: cssVar('--border-strong', 'rgba(255,255,255,.16)'),
    surfaceStrong: cssVar('--surface-strong', 'rgba(255,255,255,.07)'),
    panel: cssVar('--bg-2', '#161c30'),
    primary: cssVar('--primary', '#7c5cff'),
    accent: cssVar('--accent', '#22d3ee'),
    warning: cssVar('--warning', '#f59e0b'),
  };
});

const palette = computed(() => [
  theme.value.primary,
  theme.value.accent,
  theme.value.warning,
  '#22c55e',
  '#ef4444',
  '#a78bfa',
]);

function areaFill(color) {
  return (context) => {
    const chartRef = context.chart;
    const chartArea = chartRef?.chartArea;
    if (!chartArea) return withAlpha(color, 0.18);

    const gradient = chartRef.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, withAlpha(color, 0.26));
    gradient.addColorStop(1, withAlpha(color, 0.02));
    return gradient;
  };
}

function datasetBaseColor(dataset, index) {
  if (Array.isArray(dataset.borderColor) && dataset.borderColor[0]) return dataset.borderColor[0];
  if (Array.isArray(dataset.backgroundColor) && dataset.backgroundColor[0]) return dataset.backgroundColor[0];
  return dataset.borderColor || dataset.backgroundColor || palette.value[index % palette.value.length];
}

function normalizeDatasets(datasets = []) {
  return datasets.map((dataset, index) => {
    const color = datasetBaseColor(dataset, index);
    const values = Array.isArray(dataset.data)
      ? dataset.data.filter((item) => item !== null && item !== undefined)
      : [];

    if (props.type === 'line') {
      const sparseSeries = values.length <= 1;
      return {
        ...dataset,
        borderColor: dataset.borderColor || color,
        backgroundColor: dataset.backgroundColor || areaFill(color),
        borderWidth: dataset.borderWidth ?? 3,
        fill: dataset.fill ?? true,
        tension: dataset.tension ?? 0.35,
        spanGaps: dataset.spanGaps ?? true,
        pointRadius: dataset.pointRadius ?? (sparseSeries ? 5 : 3),
        pointHoverRadius: dataset.pointHoverRadius ?? (sparseSeries ? 8 : 6),
        pointHitRadius: dataset.pointHitRadius ?? 18,
        pointBorderWidth: dataset.pointBorderWidth ?? 2,
        pointBackgroundColor: dataset.pointBackgroundColor || color,
        pointBorderColor: dataset.pointBorderColor || theme.value.panel,
      };
    }

    if (props.type === 'bar') {
      return {
        ...dataset,
        backgroundColor: dataset.backgroundColor || withAlpha(color, 0.82),
        hoverBackgroundColor: dataset.hoverBackgroundColor || color,
        borderColor: dataset.borderColor || withAlpha(color, 0.96),
        borderWidth: dataset.borderWidth ?? 0,
        borderRadius: dataset.borderRadius ?? 12,
        borderSkipped: dataset.borderSkipped ?? false,
        maxBarThickness: dataset.maxBarThickness ?? 42,
        categoryPercentage: dataset.categoryPercentage ?? 0.74,
        barPercentage: dataset.barPercentage ?? 0.86,
      };
    }

    if (props.type === 'doughnut') {
      return {
        ...dataset,
        backgroundColor: dataset.backgroundColor || (dataset.data || []).map((_, colorIndex) => palette.value[colorIndex % palette.value.length]),
        borderColor: dataset.borderColor || theme.value.panel,
        borderWidth: dataset.borderWidth ?? 0,
        hoverOffset: dataset.hoverOffset ?? 10,
        spacing: dataset.spacing ?? 4,
      };
    }

    return dataset;
  });
}

const chartData = computed(() => ({
  ...props.data,
  datasets: normalizeDatasets(props.data?.datasets || []),
}));

const chartOptions = computed(() => mergeDeep({
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 520,
    easing: 'easeOutCubic',
  },
  interaction: props.type === 'doughnut'
    ? { mode: 'nearest', intersect: true }
    : { mode: 'index', intersect: false },
  layout: {
    padding: { top: 6, right: 8, bottom: 4, left: 2 },
  },
  plugins: {
    legend: {
      display: !!chartData.value?.datasets?.length,
      position: props.type === 'doughnut' ? 'bottom' : 'top',
      labels: {
        color: theme.value.textDim,
        usePointStyle: true,
        pointStyle: props.type === 'line' ? 'circle' : 'rectRounded',
        boxWidth: 10,
        boxHeight: 10,
        padding: 16,
        font: { size: 12, weight: 600 },
      },
    },
    tooltip: {
      backgroundColor: theme.value.panel,
      borderColor: theme.value.borderStrong,
      borderWidth: 1,
      padding: 12,
      titleColor: theme.value.text,
      bodyColor: theme.value.text,
      displayColors: true,
      usePointStyle: true,
      callbacks: {
        label(context) {
          const prefix = context.dataset?.label ? `${context.dataset.label}: ` : '';
          return `${prefix}${formatNumber(tooltipValue(context))}`;
        },
      },
    },
  },
  elements: {
    line: {
      cubicInterpolationMode: 'monotone',
    },
    point: {
      hoverBorderWidth: 3,
    },
  },
  scales: props.type === 'doughnut' ? undefined : {
    x: {
      offset: props.type === 'bar',
      border: { display: false },
      grid: { display: false },
      ticks: {
        color: theme.value.textDim,
        padding: 8,
        maxRotation: 0,
      },
    },
    y: {
      beginAtZero: true,
      grace: props.type === 'line' ? '8%' : 0,
      border: { display: false },
      grid: {
        color: withAlpha(theme.value.borderStrong, 0.55),
      },
      ticks: {
        color: theme.value.textDim,
        padding: 8,
      },
    },
  },
}, props.options || {}));

function montar() {
  if (!canvas.value) return;

  if (!chart || chart.config.type !== props.type) {
    if (chart) chart.destroy();
    chart = new Chart(canvas.value, {
      type: props.type,
      data: chartData.value,
      options: chartOptions.value,
    });
    return;
  }

  chart.data = chartData.value;
  chart.options = chartOptions.value;
  chart.update();
}

onMounted(() => {
  montar();
  themeObserver = new MutationObserver(() => {
    themeVersion.value += 1;
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
});

watch([chartData, chartOptions, () => props.type, () => themeVersion.value], montar, { deep: true });

onBeforeUnmount(() => {
  if (themeObserver) themeObserver.disconnect();
  if (chart) chart.destroy();
});
</script>
<template>
  <div :style="{ height: height + 'px', position: 'relative' }">
    <canvas ref="canvas" />
  </div>
</template>
