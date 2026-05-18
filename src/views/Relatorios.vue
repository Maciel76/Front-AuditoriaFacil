<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import ColaboradorAvatar from '@/components/ColaboradorAvatar.vue';
import Loader from '@/components/Loader.vue';
import AppChart from '@/components/AppChart.vue';
import PeriodoSelector from '@/components/PeriodoSelector.vue';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const RELATORIOS_LOJA_STORAGE_KEY = 'na_relatorios_superadmin_loja';

const periodo = ref('1d');
const dataInicio = ref('');
const dataFim = ref('');
const tipo = ref('');
const lojasDisponiveis = ref([]);
const lojaSelecionadaId = ref('');
const carregandoLojas = ref(false);
const erroLojas = ref('');
const carregando = ref(true);
const refreshing = ref(false);
const situacoes = ref([]);
const classes = ref([]);
const corredores = ref([]);
const detalheOverlay = ref(null);
const sincronizandoRotaLoja = ref(false);
const carregamentoInicialConcluido = ref(false);

function tipoSugeridoHoje() {
  const diaSemana = new Date().getDay(); // 0=Dom, 1=Seg, ...
  if (diaSemana === 1 || diaSemana === 4) return 'ETIQUETA';
  if (diaSemana === 2) return 'PRESENCA';
  if (diaSemana === 3) return 'RUPTURA';
  return '';
}

function iniciais(nome) {
  return (nome || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase();
}

const labelsPeriodo = {
  '1d': 'Hoje',
  semana: 'Semana',
  mes: 'Mês',
  ano: 'Ano',
  tudo: 'Histórico',
  custom: 'Período personalizado',
};

const labelsTipo = {
  ETIQUETA: 'Etiqueta',
  PRESENCA: 'Presença',
  RUPTURA: 'Ruptura',
};

const coresTipo = {
  ETIQUETA: '#7c5cff',
  PRESENCA: '#22d3ee',
  RUPTURA: '#f59e0b',
};

function paramsEscopoLoja(extra = {}) {
  if (auth.isSuperAdmin && lojaSelecionadaId.value) {
    return { ...extra, lojaId: lojaSelecionadaId.value };
  }
  return { ...extra };
}

function persistirLojaSelecionada() {
  if (!auth.isSuperAdmin) return;
  if (lojaSelecionadaId.value) {
    localStorage.setItem(RELATORIOS_LOJA_STORAGE_KEY, lojaSelecionadaId.value);
    return;
  }
  localStorage.removeItem(RELATORIOS_LOJA_STORAGE_KEY);
}

async function sincronizarRotaLoja() {
  if (!auth.isSuperAdmin) return;

  const lojaAtualNaRota = typeof route.query.lojaId === 'string' ? route.query.lojaId : '';
  const proximaLojaId = lojaSelecionadaId.value || '';
  if (lojaAtualNaRota === proximaLojaId) return;

  const query = { ...route.query };
  if (proximaLojaId) query.lojaId = proximaLojaId;
  else delete query.lojaId;

  sincronizandoRotaLoja.value = true;
  try {
    await router.replace({ query });
  } finally {
    sincronizandoRotaLoja.value = false;
  }
}

async function carregarLojasRelatorios() {
  if (!auth.isSuperAdmin) return;

  carregandoLojas.value = true;
  erroLojas.value = '';
  try {
    const { data } = await api.get('/lojas');
    lojasDisponiveis.value = (data.items || []).filter((loja) => loja.ativa !== false);

    const lojaDaRota = typeof route.query.lojaId === 'string' ? route.query.lojaId : '';
    const lojaSalva = localStorage.getItem(RELATORIOS_LOJA_STORAGE_KEY) || '';
    const lojaInicial =
      lojasDisponiveis.value.find((loja) => loja._id === lojaDaRota)
      || lojasDisponiveis.value.find((loja) => loja._id === lojaSalva)
      || null;

    lojaSelecionadaId.value = lojaInicial?._id || '';
    persistirLojaSelecionada();
    await sincronizarRotaLoja();
  } catch (error) {
    erroLojas.value = error?.response?.data?.error || 'Não foi possível carregar as lojas.';
    lojasDisponiveis.value = [];
    lojaSelecionadaId.value = '';
    persistirLojaSelecionada();
    await sincronizarRotaLoja();
  } finally {
    carregandoLojas.value = false;
  }
}

async function trocarLojaSelecionada() {
  persistirLojaSelecionada();
  await sincronizarRotaLoja();
  await carregar();
}

async function carregar() {
  if (carregamentoInicialConcluido.value) refreshing.value = true;
  else carregando.value = true;
  detalheOverlay.value = null;
  try {
    const paramsBase = paramsEscopoLoja({ periodo: periodo.value });
    if (periodo.value === 'custom' && dataInicio.value && dataFim.value) {
      paramsBase.dataInicio = dataInicio.value;
      paramsBase.dataFim = dataFim.value;
    }

    const carregarRelatorios = async (tipoSelecionado) => {
      const params = { ...paramsBase, tipo: tipoSelecionado || undefined };
      const [situacoesResp, classesResp, corredoresResp] = await Promise.all([
        api.get('/metricas/relatorios/situacoes', { params }),
        api.get('/metricas/relatorios/classes', { params }),
        api.get('/metricas/relatorios/corredores', { params }),
      ]);

      return {
        situacoes: situacoesResp.data.items || [],
        classes: classesResp.data.items || [],
        corredores: corredoresResp.data.items || [],
      };
    };

    const respostaAtual = await carregarRelatorios(tipo.value);

    let dadosFinais = respostaAtual;

    // Regra padrão: em seg/ter/qua/qui inicia no tipo sugerido do dia.
    // Se não houver dados para esse tipo no dia, volta automaticamente para "Todos os tipos".
    const semDados = !respostaAtual.situacoes.length && !respostaAtual.classes.length && !respostaAtual.corredores.length;
    if (
      periodo.value === '1d'
      && tipo.value
      && tipo.value === tipoSugeridoHoje()
      && semDados
    ) {
      tipo.value = '';
      dadosFinais = await carregarRelatorios('');
    }

    situacoes.value = dadosFinais.situacoes;
    classes.value = dadosFinais.classes;
    corredores.value = dadosFinais.corredores;
  } finally {
    carregamentoInicialConcluido.value = true;
    carregando.value = false;
    refreshing.value = false;
  }
}

onMounted(async () => {
  tipo.value = tipoSugeridoHoje();
  if (auth.isSuperAdmin) await carregarLojasRelatorios();
  await carregar();
});

function aoPressionarTecla(event) {
  if (event.key === 'Escape' && detalheOverlay.value) fecharOverlay();
}

onMounted(() => {
  if (typeof window !== 'undefined') window.addEventListener('keydown', aoPressionarTecla);
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', aoPressionarTecla);
  if (typeof document !== 'undefined') document.body.style.overflow = '';
});

watch([periodo, tipo, dataInicio, dataFim], () => {
  if (periodo.value !== 'custom' || (dataInicio.value && dataFim.value)) carregar();
});

watch(() => route.query.lojaId, async (novoValor) => {
  if (!auth.isSuperAdmin || sincronizandoRotaLoja.value || carregandoLojas.value) return;

  const lojaDaRota = typeof novoValor === 'string' ? novoValor : '';
  const lojaValida = lojaDaRota && lojasDisponiveis.value.some((loja) => loja._id === lojaDaRota);
  const proximaLojaId = lojaValida ? lojaDaRota : '';
  if (proximaLojaId === lojaSelecionadaId.value) return;

  lojaSelecionadaId.value = proximaLojaId;
  persistirLojaSelecionada();
  await sincronizarRotaLoja();
  await carregar();
});

watch(detalheOverlay, (valor) => {
  if (typeof document === 'undefined') return;
  document.body.style.overflow = valor ? 'hidden' : '';
});

function somar(items, key) {
  return items.reduce((total, item) => total + Number(item?.[key] || 0), 0);
}

function formatarInteiro(valor = 0) {
  return Number(valor || 0).toLocaleString('pt-BR');
}

function formatarMoeda(valor = 0) {
  return `R$ ${Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

function formatarPercentual(valor = 0, casas = 1) {
  return `${Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
}

function formatarData(valor) {
  if (!valor) return 'Sem data recente';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return 'Sem data recente';
  return data.toLocaleDateString('pt-BR');
}

function statusRelatorio(item) {
  const taxa = Number(item?.taxaConformidade || 0);
  if (taxa >= 92) {
    return { key: 'excellent', label: 'Excelente', color: '#22c55e', soft: 'rgba(34, 197, 94, 0.14)' };
  }
  if (taxa >= 80) {
    return { key: 'good', label: 'Bom', color: '#4f9cf0', soft: 'rgba(79, 156, 240, 0.16)' };
  }
  if (taxa >= 65) {
    return { key: 'warn', label: 'Atenção', color: '#f59e0b', soft: 'rgba(245, 158, 11, 0.16)' };
  }
  return { key: 'critical', label: 'Crítico', color: '#ef4444', soft: 'rgba(239, 68, 68, 0.15)' };
}

function estiloStatus(item) {
  const status = statusRelatorio(item);
  return {
    '--report-accent': status.color,
    '--report-accent-soft': status.soft,
  };
}

function descricaoTipos(item) {
  if (!item?.tipos?.length) return 'Sem tipo identificado';
  if (item.tipos.length === 1) return labelsTipo[item.tipos[0]] || item.tipos[0];
  return `${item.tipos.length} tipos no período`;
}

function abrirOverlay(item, dimensao) {
  detalheOverlay.value = {
    ...item,
    dimensao,
  };
}

function fecharOverlay() {
  detalheOverlay.value = null;
}

function tituloDimensao(dimensao) {
  return dimensao === 'classe' ? 'classe' : 'corredor';
}

function colaboradoresLimitados(item, limite = 8) {
  return (item?.colaboradores || []).slice(0, limite);
}

function restantesColaboradores(item, limite = 8) {
  const total = Number(item?.totalColaboradores || item?.colaboradores?.length || 0);
  return Math.max(0, total - limite);
}

const possuiDados = computed(() => situacoes.value.length || classes.value.length || corredores.value.length);

const periodoAtivoLabel = computed(() => {
  if (periodo.value === 'custom') return `${dataInicio.value || '--'} a ${dataFim.value || '--'}`;
  return labelsPeriodo[periodo.value] || periodo.value;
});

const tipoAtivoLabel = computed(() => (tipo.value ? labelsTipo[tipo.value] || tipo.value : 'Todos os tipos'));

const fonteResumo = computed(() => (classes.value.length ? classes.value : corredores.value));

const resumoOperacional = computed(() => {
  const base = fonteResumo.value;
  const totalLidos = somar(base, 'totalLidos');
  const totalItens = somar(base, 'totalItens');
  const totalConformes = somar(base, 'conformes');
  const taxaMedia = totalLidos ? (totalConformes / totalLidos) * 100 : 0;

  return [
    { titulo: 'Classes mapeadas', valor: formatarInteiro(classes.value.length), detalhe: 'classes com leitura no período', tone: 'primary' },
    { titulo: 'Corredores monitorados', valor: formatarInteiro(corredores.value.length), detalhe: 'corredores com itens auditados', tone: 'accent' },
    { titulo: 'Itens lidos', valor: formatarInteiro(totalLidos), detalhe: `${formatarInteiro(totalItens)} itens considerados`, tone: 'success' },
    { titulo: 'Conformidade média', valor: formatarPercentual(taxaMedia, 1), detalhe: `${formatarInteiro(totalConformes)} conformes no período`, tone: 'info' },
    { titulo: 'Custo de ruptura', valor: formatarMoeda(somar(base, 'custoRuptura')), detalhe: 'soma operacional do período', tone: 'warning' },
  ];
});

const chartSituacoes = computed(() => {
  const labels = [...new Set(situacoes.value.map((item) => item._id.situacao))];
  const tipos = [...new Set(situacoes.value.map((item) => item._id.tipo))];

  return {
    labels,
    datasets: tipos.map((tipoAtual) => ({
      label: labelsTipo[tipoAtual] || tipoAtual,
      data: labels.map((situacaoAtual) => situacoes.value.find((item) => item._id.tipo === tipoAtual && item._id.situacao === situacaoAtual)?.total || 0),
      backgroundColor: coresTipo[tipoAtual] || '#888',
      borderRadius: 8,
    })),
  };
});

const chartSituacoesOptions = computed(() => ({
  scales: {
    x: { stacked: true },
    y: { stacked: true, ticks: { precision: 0 } },
  },
}));

const topClassesPorVolume = computed(() => [...classes.value]
  .sort((a, b) => b.totalLidos - a.totalLidos || b.totalItens - a.totalItens || a.nome.localeCompare(b.nome, 'pt-BR'))
  .slice(0, 8));

const chartClasses = computed(() => ({
  labels: topClassesPorVolume.value.map((item) => item.nome),
  datasets: [
    {
      label: 'Itens lidos',
      data: topClassesPorVolume.value.map((item) => item.totalLidos),
      backgroundColor: '#5b8cff',
      borderRadius: 10,
    },
    {
      label: 'Não conformes',
      data: topClassesPorVolume.value.map((item) => item.naoConformes),
      backgroundColor: '#f59e0b',
      borderRadius: 10,
    },
  ],
}));

const chartClassesOptions = computed(() => ({
  indexAxis: 'y',
  scales: {
    x: { ticks: { precision: 0 } },
    y: { ticks: { autoSkip: false } },
  },
}));

const classesOrdenadas = computed(() => [...classes.value]
  .sort((a, b) => {
    const prioridade = (item) => {
      const status = statusRelatorio(item).key;
      if (status === 'critical') return 0;
      if (status === 'warn') return 1;
      if (status === 'good') return 2;
      return 3;
    };

    return prioridade(a) - prioridade(b)
      || a.taxaConformidade - b.taxaConformidade
      || b.naoConformes - a.naoConformes
      || b.totalLidos - a.totalLidos
      || a.nome.localeCompare(b.nome, 'pt-BR');
  }));

const corredoresOrdenados = computed(() => [...corredores.value]
  .sort((a, b) => b.taxaConformidade - a.taxaConformidade || b.totalLidos - a.totalLidos || a.nome.localeCompare(b.nome, 'pt-BR')));
</script>

<template>
  <div class="grid gap-3">
    <div class="row reports-toolbar">
      <PeriodoSelector
        v-model="periodo"
        v-model:dataInicio="dataInicio"
        v-model:dataFim="dataFim"
      />
      <select v-model="tipo" class="btn ghost" style="padding: 8px 14px;">
        <option value="">Todos os tipos</option>
        <option value="ETIQUETA">Etiqueta</option>
        <option value="PRESENCA">Presença</option>
        <option value="RUPTURA">Ruptura</option>
      </select>
      <select
        v-if="auth.isSuperAdmin"
        v-model="lojaSelecionadaId"
        class="btn ghost"
        style="padding: 8px 14px; min-width: 240px;"
        :disabled="carregandoLojas"
        @change="trocarLojaSelecionada"
      >
        <option value="">Todas as lojas</option>
        <option v-for="loja in lojasDisponiveis" :key="loja._id" :value="loja._id">{{ loja.nome }}</option>
      </select>
      <span v-if="refreshing" class="badge dim reports-loading-pill">
        <span class="reports-loading-dot"></span>
        Atualizando...
      </span>
      <span v-if="auth.isSuperAdmin && erroLojas" class="badge bad">{{ erroLojas }}</span>
    </div>

    <Loader v-if="carregando" />

    <div v-else :class="['reports-content', { 'reports-refreshing': refreshing }]">
      <div v-if="!possuiDados" class="empty">
        Não há dados suficientes para montar os relatórios desse período.
      </div>

      <template v-else>
      <section class="report-summary-grid">
        <article
          v-for="card in resumoOperacional"
          :key="card.titulo"
          class="card report-summary-card"
          :class="`tone-${card.tone}`"
        >
          <span class="report-summary-label">{{ card.titulo }}</span>
          <strong class="report-summary-value">{{ card.valor }}</strong>
          <span class="report-summary-detail">{{ card.detalhe }}</span>
        </article>
      </section>

      <section class="report-panorama-grid">
        <div class="card report-panel">
          <div class="report-panel-head">
            <div>
              <h3 class="mt-0 mb-0">Distribuição por situação</h3>
              <p class="muted report-panel-copy">Resumo do volume de ocorrências por tipo dentro do período filtrado.</p>
            </div>
            <span class="badge dim">{{ tipoAtivoLabel }}</span>
          </div>
          <AppChart type="bar" :data="chartSituacoes" :options="chartSituacoesOptions" :height="320" />
        </div>

        <div class="card report-panel">
          <div class="report-panel-head">
            <div>
              <h3 class="mt-0 mb-0">Classes com maior leitura</h3>
              <p class="muted report-panel-copy">Panorama das classes mais movimentadas, comparando itens lidos com desvios encontrados.</p>
            </div>
            <span class="badge dim">{{ periodoAtivoLabel }}</span>
          </div>
          <AppChart type="bar" :data="chartClasses" :options="chartClassesOptions" :height="320" />
        </div>
      </section>

      <section class="card report-panel">
        <div class="report-panel-head">
          <div>
            <h3 class="mt-0 mb-0">Relatório por corredor</h3>
            <p class="muted report-panel-copy">Lista todos os corredores auditados com conformidade, volume lido e custo de ruptura.</p>
          </div>
          <span class="badge dim">{{ formatarInteiro(corredoresOrdenados.length) }} corredores</span>
        </div>

        <div class="corridor-grid">
          <article
            v-for="item in corredoresOrdenados"
            :key="item.nome"
            class="corridor-card"
            :class="`status-${statusRelatorio(item).key}`"
            :style="estiloStatus(item)"
            @click="abrirOverlay(item, 'corredor')"
            @keydown.enter.prevent="abrirOverlay(item, 'corredor')"
            @keydown.space.prevent="abrirOverlay(item, 'corredor')"
            role="button"
            tabindex="0"
          >
            <div class="corridor-head">
              <div class="corridor-mark">
                <fa icon="chart-bar" />
              </div>

              <div class="corridor-copy">
                <div class="corridor-name">{{ item.nome }}</div>
                <div class="corridor-rate">{{ formatarPercentual(item.taxaConformidade, 2) }}</div>
              </div>

              <span class="report-status-pill" :class="`status-${statusRelatorio(item).key}`">
                {{ statusRelatorio(item).label }}
              </span>
            </div>

            <div class="corridor-progress">
              <span :style="{ width: Math.min(100, Math.max(0, item.taxaConformidade || 0)) + '%' }"></span>
            </div>

            <div class="corridor-footnote">{{ formatarPercentual(item.taxaConformidade, 2) }} concluído · {{ descricaoTipos(item) }}</div>

            <div class="corridor-stats">
              <span><strong>{{ formatarInteiro(item.totalLidos) }}</strong> lidos</span>
              <span><strong>{{ formatarInteiro(item.totalItens) }}</strong> itens</span>
              <span><strong>{{ formatarInteiro(item.naoConformes) }}</strong> desvios</span>
            </div>

            <div class="corridor-toggle muted">
              <fa icon="up-right-and-down-left-from-center" />
              Ver detalhes
            </div>
          </article>
        </div>
      </section>

      <section class="card report-panel">
        <div class="report-panel-head">
          <div>
            <h3 class="mt-0 mb-0">Relatório por classe</h3>
            <p class="muted report-panel-copy">Visão operacional completa das classes, priorizando os pontos com maior necessidade de ação.</p>
          </div>
          <span class="badge dim">{{ formatarInteiro(classesOrdenadas.length) }} classes</span>
        </div>

        <div class="table-wrap report-table-wrap">
          <table class="table report-table">
            <thead>
              <tr>
                <th>Classe</th>
                <th>Desempenho</th>
                <th>Total itens</th>
                <th>Itens lidos</th>
                <th>Não conformes</th>
                <th>Custo ruptura</th>
                <th>Status</th>
                <th>Colaboradores</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="item in classesOrdenadas" :key="item.nome">
              <tr :style="estiloStatus(item)">
                <td>
                  <div class="class-cell">
                    <strong>{{ item.nome }}</strong>
                    <span class="muted">{{ descricaoTipos(item) }}</span>
                  </div>
                </td>
                <td>
                  <div class="class-progress-wrap">
                    <div class="class-progress-bar">
                      <span :style="{ width: Math.min(100, Math.max(0, item.taxaConformidade || 0)) + '%' }"></span>
                    </div>
                    <strong>{{ formatarPercentual(item.taxaConformidade, 1) }}</strong>
                  </div>
                </td>
                <td>{{ formatarInteiro(item.totalItens) }}</td>
                <td>{{ formatarInteiro(item.totalLidos) }}</td>
                <td>{{ formatarInteiro(item.naoConformes) }}</td>
                <td>{{ formatarMoeda(item.custoRuptura) }}</td>
                <td>
                  <span class="report-status-pill" :class="`status-${statusRelatorio(item).key}`">
                    {{ statusRelatorio(item).label }}
                  </span>
                </td>
                <td>
                  <button class="btn ghost class-collab-toggle" @click="abrirOverlay(item, 'classe')">
                    <fa icon="up-right-and-down-left-from-center" />
                    Ver mais
                  </button>
                </td>
              </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>
      </template>
    </div>

    <Teleport to="body">
      <Transition name="detail-overlay" appear>
        <div v-if="detalheOverlay" class="global-overlay-backdrop" @click="fecharOverlay">
          <div class="global-overlay-panel card glow" :style="estiloStatus(detalheOverlay)" @click.stop>
            <div class="global-overlay-hero">
              <div class="overlay-hero-mark">
                <fa icon="chart-bar" />
              </div>

              <div class="overlay-hero-copy">
                <span class="badge dim">Relatório por {{ tituloDimensao(detalheOverlay.dimensao) }}</span>
                <h3 class="mt-0 mb-0">{{ detalheOverlay.nome }}</h3>
                <p class="muted overlay-copy">{{ descricaoTipos(detalheOverlay) }} · {{ periodoAtivoLabel }}</p>
              </div>

              <div class="overlay-hero-side">
                <span class="report-status-pill" :class="`status-${statusRelatorio(detalheOverlay).key}`">
                  {{ statusRelatorio(detalheOverlay).label }}
                </span>
                <strong class="overlay-hero-rate">{{ formatarPercentual(detalheOverlay.taxaConformidade, 2) }}</strong>
                <button class="btn ghost overlay-close-btn" @click="fecharOverlay">
                  <fa icon="xmark" /> Fechar
                </button>
              </div>
            </div>

            <div class="overlay-metrics-grid">
              <div class="overlay-metric-card">
                <span class="overlay-metric-label">Total de itens</span>
                <strong class="overlay-metric-value">{{ formatarInteiro(detalheOverlay.totalItens) }}</strong>
              </div>
              <div class="overlay-metric-card">
                <span class="overlay-metric-label">Itens auditados</span>
                <strong class="overlay-metric-value">{{ formatarInteiro(detalheOverlay.totalLidos) }}</strong>
              </div>
              <div class="overlay-metric-card">
                <span class="overlay-metric-label">Itens corretos</span>
                <strong class="overlay-metric-value">{{ formatarInteiro(detalheOverlay.conformes) }}</strong>
              </div>
              <div class="overlay-metric-card">
                <span class="overlay-metric-label">Pendentes de leitura</span>
                <strong class="overlay-metric-value">{{ formatarInteiro(detalheOverlay.semLeitura) }}</strong>
              </div>
              <div class="overlay-metric-card">
                <span class="overlay-metric-label">Custo de ruptura</span>
                <strong class="overlay-metric-value">{{ formatarMoeda(detalheOverlay.custoRuptura) }}</strong>
              </div>
            </div>

            <div class="overlay-section">
              <div class="overlay-section-head">
                <strong><fa icon="circle-info" /> Visão operacional</strong>
              </div>
              <div class="corridor-meta overlay-meta-grid">
                <span>Itens com desvio: <strong>{{ formatarInteiro(detalheOverlay.naoConformes) }}</strong></span>
                <span>Última auditoria: <strong>{{ formatarData(detalheOverlay.ultimaAuditoriaEm) }}</strong></span>
                <span>Colaboradores ativos: <strong>{{ formatarInteiro(detalheOverlay.totalColaboradores || detalheOverlay.colaboradores?.length || 0) }}</strong></span>
              </div>
            </div>

            <div class="overlay-section collab-box">
              <div class="collab-title">
                <fa icon="users" />
                Colaboradores que leram neste {{ tituloDimensao(detalheOverlay.dimensao) }}
                <span class="muted">({{ formatarInteiro(detalheOverlay.totalColaboradores || detalheOverlay.colaboradores?.length || 0) }})</span>
              </div>
              <div v-if="!(detalheOverlay.colaboradores || []).length" class="muted">Sem colaboradores com leitura registrada neste período.</div>
              <div v-else class="collab-list overlay-collab-grid">
                <div v-for="col in colaboradoresLimitados(detalheOverlay, 18)" :key="`${detalheOverlay.nome}-${col.codigoExterno}-${col.nome}`" class="collab-chip overlay-collab-card">
                  <div class="overlay-collab-head">
                    <ColaboradorAvatar class="overlay-collab-avatar" :nome="col.nome" :avatar-url="col.avatarUrl" :size="48" :font-size="16" />
                    <div class="overlay-collab-copy">
                      <strong>{{ col.nome }}</strong>
                      <span class="muted">#{{ col.codigoExterno }}</span>
                    </div>
                  </div>
                  <div class="overlay-collab-stats muted">
                    <span><strong>{{ formatarInteiro(col.totalLidos) }}</strong> lidos</span>
                    <span><strong>{{ formatarInteiro(col.naoConformes) }}</strong> desvios</span>
                    <span><strong>{{ formatarInteiro(col.conformes) }}</strong> corretos</span>
                  </div>
                </div>
                <span v-if="restantesColaboradores(detalheOverlay, 18) > 0" class="collab-chip more overlay-collab-card more-card">
                  +{{ formatarInteiro(restantesColaboradores(detalheOverlay, 18)) }} colaboradores
                </span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.reports-toolbar {
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.reports-content {
  display: grid;
  gap: 16px;
  transition: opacity 0.2s ease, filter 0.2s ease;
}

.reports-refreshing {
  opacity: 0.58;
  filter: blur(1.4px);
  pointer-events: none;
}

.reports-loading-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.reports-loading-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--primary);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 45%, transparent);
  animation: reportsPulse 0.95s ease-out infinite;
}

@keyframes reportsPulse {
  0% {
    transform: scale(0.9);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 42%, transparent);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 10px color-mix(in srgb, var(--primary) 0%, transparent);
  }
  100% {
    transform: scale(0.92);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 0%, transparent);
  }
}

.report-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 14px;
}

.report-summary-card {
  position: relative;
  overflow: hidden;
  display: grid;
  gap: 8px;
  min-height: 132px;
  background: linear-gradient(160deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
}

.report-summary-card::after {
  content: '';
  position: absolute;
  inset: auto -28px -44px auto;
  width: 120px;
  height: 120px;
  border-radius: 999px;
  background: var(--summary-glow, rgba(124, 92, 255, 0.16));
  filter: blur(6px);
}

.report-summary-card.tone-primary { --summary-glow: rgba(124, 92, 255, 0.18); }
.report-summary-card.tone-accent { --summary-glow: rgba(34, 211, 238, 0.18); }
.report-summary-card.tone-success { --summary-glow: rgba(34, 197, 94, 0.18); }
.report-summary-card.tone-info { --summary-glow: rgba(91, 140, 255, 0.18); }
.report-summary-card.tone-warning { --summary-glow: rgba(245, 158, 11, 0.2); }

.report-summary-label,
.report-summary-value,
.report-summary-detail {
  position: relative;
  z-index: 1;
}

.report-summary-label {
  color: var(--text-dim);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: .08em;
  font-weight: 700;
}

.report-summary-value {
  font-size: clamp(24px, 3vw, 32px);
  line-height: 1;
}

.report-summary-detail {
  color: var(--text-dim);
  font-size: 13px;
}

.report-panorama-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.report-panel {
  display: grid;
  gap: 18px;
}

.report-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.report-panel-copy {
  margin: 6px 0 0;
  font-size: 13px;
}

.corridor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.corridor-card {
  --report-accent: var(--primary);
  --report-accent-soft: rgba(124, 92, 255, 0.14);
  position: relative;
  overflow: hidden;
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--report-accent) 28%, var(--border));
  background: linear-gradient(180deg, var(--report-accent-soft), rgba(255,255,255,0.02));
  box-shadow: var(--shadow-sm);
  cursor: pointer;
}

.corridor-card:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--report-accent) 70%, white);
  outline-offset: 2px;
}

.corridor-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--report-accent);
}

.corridor-head {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
}

.corridor-mark {
  width: 54px;
  height: 54px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: rgba(255,255,255,.62);
  color: var(--report-accent);
  font-size: 22px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.28);
}

.corridor-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.corridor-name {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: .02em;
  text-transform: uppercase;
}

.corridor-rate {
  color: var(--report-accent);
  font-size: clamp(20px, 2.4vw, 32px);
  line-height: 1;
  font-weight: 800;
}

.corridor-progress,
.class-progress-bar {
  height: 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.24);
  overflow: hidden;
}

.corridor-progress span,
.class-progress-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--report-accent);
}

.corridor-footnote {
  color: var(--text-dim);
  font-size: 13px;
}

.corridor-stats,
.corridor-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  color: var(--text-dim);
}

.corridor-stats strong,
.corridor-meta strong {
  color: var(--text);
}

.corridor-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  width: fit-content;
}

.collab-box,
.class-detail-content {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--report-accent) 22%, var(--border));
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
}

.collab-title,
.class-detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 13px;
}

.collab-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
}

.collab-chip {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(148, 163, 184, 0.12);
  border: 1px solid rgba(148, 163, 184, 0.14);
  min-width: 0;
  font-size: 12px;
}

.collab-chip.more {
  place-content: center;
  font-weight: 700;
}

.class-collab-toggle {
  padding: 6px 10px;
  font-size: 12px;
}

.global-overlay-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 20px;
  background:
    radial-gradient(1200px 700px at 8% -10%, rgba(124,92,255,.22), transparent 58%),
    radial-gradient(1000px 640px at 100% 10%, rgba(34,211,238,.16), transparent 56%),
    rgba(4, 8, 22, 0.68);
  backdrop-filter: blur(10px);
}

.global-overlay-panel {
  position: relative;
  overflow: hidden;
  width: min(980px, 96vw);
  max-height: min(86vh, 860px);
  overflow: auto;
  display: grid;
  gap: 18px;
  padding: 22px;
  border-radius: 26px;
  border: 1px solid color-mix(in srgb, var(--report-accent) 32%, var(--border));
  background:
    linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02)),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-2) 92%, var(--report-accent-soft)), var(--bg-1));
  box-shadow: var(--shadow-lg);
}

.global-overlay-panel::before {
  content: '';
  position: absolute;
  inset: -30% auto auto -10%;
  width: 300px;
  height: 300px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--report-accent) 16%, transparent);
  filter: blur(26px);
  pointer-events: none;
}

.global-overlay-panel::after {
  content: '';
  position: absolute;
  inset: auto -10% -34% auto;
  width: 260px;
  height: 260px;
  border-radius: 999px;
  background: rgba(34, 211, 238, 0.08);
  filter: blur(30px);
  pointer-events: none;
}

.global-overlay-hero,
.overlay-metrics-grid,
.overlay-section {
  position: relative;
  z-index: 1;
}

.global-overlay-hero {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr) auto;
  gap: 18px;
  align-items: start;
}

.overlay-hero-mark {
  width: 74px;
  height: 74px;
  border-radius: 22px;
  display: grid;
  place-items: center;
  color: white;
  font-size: 28px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--report-accent) 72%, white), var(--report-accent));
  box-shadow: 0 16px 34px color-mix(in srgb, var(--report-accent) 28%, transparent);
}

.overlay-hero-copy {
  display: grid;
  gap: 8px;
}

.overlay-hero-copy h3 {
  font-size: clamp(28px, 4vw, 38px);
  line-height: 1.02;
  letter-spacing: -.03em;
}

.overlay-hero-side {
  display: grid;
  gap: 10px;
  justify-items: end;
}

.overlay-hero-rate {
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1;
  color: var(--report-accent);
}

.overlay-metrics-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.overlay-metric-card,
.overlay-section {
  background: rgba(255,255,255,.04);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 14px;
}

.overlay-metric-card {
  display: grid;
  gap: 8px;
}

.overlay-metric-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--text-dim);
  font-weight: 700;
}

.overlay-metric-value {
  font-size: 20px;
  line-height: 1.1;
}

.overlay-section {
  display: grid;
  gap: 12px;
}

.overlay-section-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.overlay-meta-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.overlay-collab-grid {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.overlay-collab-card {
  background: rgba(255,255,255,.05);
}

.overlay-collab-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.overlay-collab-avatar {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: white;
  font-weight: 800;
  font-size: 13px;
  background: var(--grad-primary);
  flex-shrink: 0;
}

.overlay-collab-copy {
  display: grid;
  gap: 2px;
}

.overlay-collab-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
}

.overlay-collab-stats strong {
  color: var(--text);
}

.more-card {
  place-content: center;
  text-align: center;
}

.global-overlay-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.overlay-copy {
  margin: 6px 0 0;
  font-size: 13px;
}

.overlay-close-btn {
  padding: 7px 12px;
}

.report-status-pill {
  width: fit-content;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .03em;
  text-transform: uppercase;
}

.report-status-pill.status-excellent {
  background: rgba(34, 197, 94, 0.14);
  color: #22c55e;
}

.report-status-pill.status-good {
  background: rgba(79, 156, 240, 0.16);
  color: #4f9cf0;
}

.report-status-pill.status-warn {
  background: rgba(245, 158, 11, 0.16);
  color: #f59e0b;
}

.report-status-pill.status-critical {
  background: rgba(239, 68, 68, 0.14);
  color: #ef4444;
}

.report-table-wrap {
  overflow-x: auto;
}

.report-table tbody tr {
  transition: background-color .18s ease;
}

.report-table tbody tr:hover {
  background: color-mix(in srgb, var(--report-accent-soft) 70%, transparent);
}

.class-cell {
  display: grid;
  gap: 4px;
}

.class-progress-wrap {
  display: grid;
  gap: 8px;
  min-width: 160px;
}

.class-progress-wrap strong {
  font-size: 13px;
}

:global([data-theme="light"]) .report-summary-card {
  background: linear-gradient(180deg, rgba(255,255,255,.94), rgba(255,255,255,.82));
}

:global([data-theme="light"]) .corridor-card {
  background: linear-gradient(180deg, rgba(255,255,255,.95), color-mix(in srgb, var(--report-accent-soft) 52%, white));
}

:global([data-theme="light"]) .global-overlay-backdrop {
  background: rgba(28, 36, 61, 0.36);
}

:global([data-theme="light"]) .global-overlay-panel {
  background: linear-gradient(180deg, color-mix(in srgb, white 91%, var(--report-accent-soft)), white);
}

:global([data-theme="light"]) .overlay-metric-card,
:global([data-theme="light"]) .overlay-section,
:global([data-theme="light"]) .collab-box,
:global([data-theme="light"]) .overlay-collab-card {
  background: rgba(255,255,255,.72);
}

.detail-overlay-enter-active,
.detail-overlay-leave-active {
  transition: opacity .28s ease;
}

.detail-overlay-enter-active .global-overlay-panel,
.detail-overlay-leave-active .global-overlay-panel {
  transition: transform .34s cubic-bezier(.21, 1, .32, 1), opacity .34s ease, filter .34s ease;
}

.detail-overlay-enter-from,
.detail-overlay-leave-to {
  opacity: 0;
}

.detail-overlay-enter-from .global-overlay-panel,
.detail-overlay-leave-to .global-overlay-panel {
  opacity: 0;
  transform: translateY(18px) scale(.96);
  filter: blur(10px);
}

:global([data-theme="light"]) .corridor-mark {
  background: rgba(231, 237, 255, 0.88);
}

@media (max-width: 1080px) {
  .report-panorama-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .corridor-head {
    grid-template-columns: 54px minmax(0, 1fr);
  }

  .report-status-pill {
    grid-column: 1 / -1;
  }

  .global-overlay-backdrop {
    padding: 10px;
  }

  .global-overlay-panel {
    width: 100%;
    max-height: 92vh;
    padding: 12px;
  }

  .global-overlay-hero {
    grid-template-columns: 1fr;
  }

  .overlay-hero-side {
    justify-items: start;
  }

  .overlay-metrics-grid,
  .overlay-meta-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
