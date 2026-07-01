<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import ColaboradorAvatar from '@/components/ColaboradorAvatar.vue';
import Loader from '@/components/Loader.vue';
import AppChart from '@/components/AppChart.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const ui = useUiStore();
const auditoria = ref(null);
const itens = ref([]);
const total = ref(0);
const carregando = ref(true);
const filtros = ref({ situacao: '', conforme: '', q: '', page: 1, limit: 50 });
const escopoLojaParams = computed(() => route.query.lojaId ? { lojaId: route.query.lojaId } : {});
const rotaVoltar = computed(() => route.query.lojaId ? { path: '/auditorias', query: { lojaId: route.query.lojaId } } : { path: '/auditorias' });

// Cancelamento
const modalCancelar = ref(false);
const motivoCancelamento = ref('');
const enviandoCancelar = ref(false);

const cancelada = computed(() => auditoria.value?.status === 'CANCELADA');
const processando = computed(() => auditoria.value?.status === 'PROCESSANDO');

const tipoIcone = computed(() => {
  const map = { ETIQUETA: 'tag', PRESENCA: 'user-check', RUPTURA: 'triangle-exclamation' };
  return map[auditoria.value?.tipo] || 'clipboard';
});

const tipoCor = computed(() => {
  const map = { ETIQUETA: '#7c5cff', PRESENCA: '#22d3ee', RUPTURA: '#f97316' };
  return map[auditoria.value?.tipo] || 'var(--text-dim)';
});

const conformidadeCor = computed(() => {
  const t = auditoria.value?.taxaConformidade || 0;
  if (t >= 90) return 'var(--success)';
  if (t >= 70) return 'var(--warning)';
  return 'var(--danger)';
});

const statusBadge = computed(() => {
  if (cancelada.value) return { text: 'Cancelada', klass: 'bad' };
  if (processando.value) return { text: 'Processando', klass: 'warn' };
  if (auditoria.value?.status === 'ERRO') return { text: 'Erro', klass: 'bad' };
  return { text: 'Concluída', klass: 'ok' };
});

const dataFormatada = computed(() => {
  if (!auditoria.value?.data) return '';
  return new Date(auditoria.value.data).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
});

const dataCurta = computed(() => {
  if (!auditoria.value?.data) return '';
  return new Date(auditoria.value.data).toLocaleDateString('pt-BR');
});

const dataHora = (val) => {
  if (!val) return '—';
  return new Date(val).toLocaleString('pt-BR');
};

const arquivoNome = computed(() => {
  return auditoria.value?.arquivoOriginal || '—';
});

const totalItensAuditaveis = computed(() => {
  const sit = auditoria.value?.situacoes || {};
  return Object.values(sit).reduce((s, v) => s + (v || 0), 0);
});

const cobertura = computed(() => {
  const total = totalItensAuditaveis.value;
  if (!total) return 0;
  return ((auditoria.value?.totalLidos || 0) / total) * 100;
});

function abrirCancelar() {
  motivoCancelamento.value = '';
  modalCancelar.value = true;
}

function fecharCancelar() {
  if (enviandoCancelar.value) return;
  modalCancelar.value = false;
  motivoCancelamento.value = '';
}

async function confirmarCancelar() {
  if (!auditoria.value || enviandoCancelar.value) return;
  enviandoCancelar.value = true;
  try {
    const { data } = await api.post(
      `/auditorias/${auditoria.value._id}/cancelar`,
      { motivo: motivoCancelamento.value.trim() },
      { params: escopoLojaParams.value },
    );
    ui.sucesso(data?.mensagem || 'Auditoria cancelada. Métricas removidas dos colaboradores e da loja.');
    modalCancelar.value = false;
    motivoCancelamento.value = '';
    await carregar();
  } catch (e) {
    ui.erro(
      e?.response?.data?.error ||
        e?.message ||
        'Não foi possível cancelar a auditoria.',
    );
  } finally {
    enviandoCancelar.value = false;
  }
}

async function carregar() {
  carregando.value = true;
  try {
    const { data: a } = await api.get('/auditorias/' + route.params.id, { params: escopoLojaParams.value });
    auditoria.value = a;
    await carregarItens();
  } finally { carregando.value = false; }
}

async function carregarItens() {
  const { data } = await api.get(`/auditorias/${route.params.id}/itens`, {
    params: { ...filtros.value, ...escopoLojaParams.value }
  });
  itens.value = data.items;
  total.value = data.total;
}

onMounted(carregar);
watch(() => filtros.value.page, carregarItens);
watch(() => filtros.value.situacao, () => { filtros.value.page = 1; carregarItens(); });
watch(() => filtros.value.conforme, () => { filtros.value.page = 1; carregarItens(); });

const distribChart = computed(() => {
  if (!auditoria.value) return { labels: [], datasets: [] };
  const sit = auditoria.value.situacoes || {};
  const labels = Object.keys(sit);
  return {
    labels,
    datasets: [{
      label: 'Itens',
      data: labels.map((l) => sit[l]),
      backgroundColor: ['#7c5cff', '#22d3ee', '#f59e0b', '#22c55e', '#ef4444', '#a78bfa'],
      borderRadius: 8,
    }],
  };
});

const topColaboradoresComIndice = computed(() => {
  return (auditoria.value?.topColaboradores || []).map((c, i) => ({
    ...c,
    posicao: i + 1,
    medalha: i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`,
  }));
});

const itensTemDados = computed(() => itens.value.length > 0);
</script>

<template>
  <Loader v-if="carregando" />
  <div v-else-if="auditoria" class="grid gap-4 audit-detail">
    <!-- Navegação -->
    <div class="row" style="justify-content: space-between; align-items: center;">
      <RouterLink :to="rotaVoltar" class="btn ghost">
        <fa icon="chevron-left" /> Voltar para auditorias
      </RouterLink>
      <div class="row gap-2">
        <button
          v-if="auth.podeGerenciar && !cancelada"
          class="btn ghost warn"
          @click="abrirCancelar"
        >
          <fa icon="ban" /> Cancelar auditoria
        </button>
      </div>
    </div>

    <!-- Banner de cancelamento -->
    <div v-if="cancelada" class="cancel-banner">
      <div class="cancel-banner-icon"><fa icon="triangle-exclamation" /></div>
      <div class="cancel-banner-text">
        <strong>Esta auditoria foi cancelada</strong>
        <p>
          Todas as métricas foram removidas dos colaboradores e da loja.
          Nenhum dado desta auditoria conta para pontuação, ranking ou
          conformidade. Os registros abaixo são mantidos apenas para
          consulta histórica.
        </p>
        <div v-if="auditoria.motivoCancelamento" class="cancel-banner-motivo">
          <span class="muted">Motivo:</span> {{ auditoria.motivoCancelamento }}
        </div>
      </div>
    </div>

    <!-- Card Principal: Cabeçalho + KPIs -->
    <div class="card glow audit-hero" :class="{ canceled: cancelada }">
      <!-- Cabeçalho -->
      <div class="audit-hero-head">
        <div class="audit-hero-icon" :style="{ background: tipoCor + '22', color: tipoCor }">
          <fa :icon="tipoIcone" />
        </div>
        <div class="audit-hero-info">
          <div class="row gap-2 mb-1">
            <span class="badge" :class="'tipo-' + auditoria.tipo">{{ auditoria.tipo }}</span>
            <span class="badge" :class="statusBadge.klass">{{ statusBadge.text }}</span>
            <span v-if="processando" class="badge warn"><fa icon="spinner" spin /> Processando</span>
          </div>
          <h1 class="mt-0 mb-0">{{ dataFormatada }}</h1>
          <div class="row gap-3 mt-1 muted" style="font-size: 13px;">
            <span v-if="auditoria.lojaNome"><fa icon="store" /> {{ auditoria.lojaNome }}</span>
            <span><fa icon="file-excel" /> {{ arquivoNome }}</span>
          </div>
        </div>
        <div class="audit-hero-score">
          <div class="audit-hero-score-value" :style="{ color: conformidadeCor }">
            {{ cancelada ? '0.0' : auditoria.taxaConformidade?.toFixed(1) }}%
          </div>
          <div class="audit-hero-score-label">Conformidade</div>
        </div>
      </div>

      <!-- KPIs -->
      <div class="kpi-grid audit-kpi-grid">
        <div class="kpi" :class="{ zerada: cancelada }">
          <div class="ico"><fa icon="list" /></div>
          <div class="label">Total itens</div>
          <div class="value">{{ (cancelada ? 0 : auditoria.totalItens).toLocaleString('pt-BR') }}</div>
        </div>
        <div class="kpi" :class="{ zerada: cancelada }">
          <div class="ico"><fa icon="eye" /></div>
          <div class="label">Itens lidos</div>
          <div class="value">{{ (cancelada ? 0 : auditoria.totalLidos).toLocaleString('pt-BR') }}</div>
          <div v-if="!cancelada" class="delta muted">{{ cobertura.toFixed(0) }}% de cobertura</div>
        </div>
        <div class="kpi" :class="{ zerada: cancelada }">
          <div class="ico"><fa icon="check-circle" /></div>
          <div class="label">Conformes</div>
          <div class="value">{{ (cancelada ? 0 : auditoria.totalConformes).toLocaleString('pt-BR') }}</div>
        </div>
        <div class="kpi" :class="{ zerada: cancelada }">
          <div class="ico"><fa icon="xmark-circle" /></div>
          <div class="label">Não conformes</div>
          <div class="value">{{ (cancelada ? 0 : auditoria.totalNaoConformes).toLocaleString('pt-BR') }}</div>
        </div>
        <div class="kpi" :class="{ zerada: cancelada }">
          <div class="ico"><fa icon="bolt" /></div>
          <div class="label">Pontuação</div>
          <div class="value">{{ cancelada ? 0 : Math.round(auditoria.pontuacao) }}</div>
          <div class="suffix">pts</div>
        </div>
        <div class="kpi" :class="{ zerada: cancelada }">
          <div class="ico"><fa icon="money-bill" /></div>
          <div class="label">Custo ruptura</div>
          <div class="value" v-if="cancelada || !auditoria.custoRupturaTotal">—</div>
          <div class="value" v-else>R$ {{ auditoria.custoRupturaTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) }}</div>
        </div>
      </div>
    </div>

    <!-- Grade: Gráfico + Top Colaboradores -->
    <div class="grid audit-content-grid">
      <div class="card">
        <div class="card-head">
          <h3 class="mt-0 mb-0"><fa icon="chart-bar" /> Distribuição por situação</h3>
        </div>
        <AppChart v-if="!cancelada" type="bar" :data="distribChart" :height="280" />
        <div v-else class="empty" style="min-height: 280px; display: grid; place-items: center;">
          <div style="text-align: center;">
            <fa icon="chart-bar" style="font-size: 36px; opacity: 0.3;" />
            <p class="muted mt-2">Gráfico indisponível — auditoria cancelada</p>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h3 class="mt-0 mb-0"><fa icon="users" /> Top colaboradores</h3>
          <span v-if="topColaboradoresComIndice.length" class="badge dim">{{ topColaboradoresComIndice.length }} participantes</span>
        </div>
        <div v-if="!topColaboradoresComIndice.length" class="empty">Nenhum colaborador registrado</div>
        <div v-else class="top-colab-list">
          <div
            v-for="c in topColaboradoresComIndice"
            :key="c.colaborador"
            class="top-colab-item"
            :class="{ canceled: cancelada }"
          >
            <div class="top-colab-rank">{{ c.medalha }}</div>
            <ColaboradorAvatar :nome="c.nome" :avatar-url="c.avatarUrl" :size="38" :font-size="13" />
            <div class="top-colab-info">
              <div class="top-colab-nome">{{ c.nome }}</div>
              <div class="muted top-colab-meta">
                {{ cancelada ? 0 : c.itens }} itens · {{ cancelada ? 0 : c.conformes }} conformes
              </div>
            </div>
            <div class="top-colab-pts">
              <strong>{{ cancelada ? 0 : Math.round(c.pontuacao) }}</strong>
              <span class="muted">pts</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Metadados -->
    <div class="card audit-meta-card">
      <h3 class="mt-0 mb-2"><fa icon="info-circle" /> Informações da auditoria</h3>
      <div class="audit-meta-grid">
        <div class="audit-meta-item">
          <span class="audit-meta-label">Arquivo original</span>
          <span class="audit-meta-value"><fa icon="file-excel" /> {{ arquivoNome }}</span>
        </div>
        <div class="audit-meta-item">
          <span class="audit-meta-label">Loja</span>
          <span class="audit-meta-value">
            <fa icon="store" /> {{ auditoria.lojaNome || '—' }}
          </span>
        </div>
        <div class="audit-meta-item">
          <span class="audit-meta-label">Enviado por</span>
          <span class="audit-meta-value">
            <fa icon="user" /> {{ auditoria.enviadoPorNome || '—' }}
          </span>
        </div>
        <div class="audit-meta-item">
          <span class="audit-meta-label">Data de envio</span>
          <span class="audit-meta-value">
            <fa icon="clock" /> {{ dataHora(auditoria.createdAt) }}
          </span>
        </div>
        <div class="audit-meta-item">
          <span class="audit-meta-label">Última atualização</span>
          <span class="audit-meta-value">
            <fa icon="rotate" /> {{ dataHora(auditoria.updatedAt) }}
          </span>
        </div>
        <div class="audit-meta-item">
          <span class="audit-meta-label">Status</span>
          <span class="audit-meta-value">
            <span class="badge" :class="statusBadge.klass">{{ statusBadge.text }}</span>
          </span>
        </div>
        <template v-if="cancelada">
          <div class="audit-meta-item">
            <span class="audit-meta-label">Cancelada em</span>
            <span class="audit-meta-value">
              <fa icon="ban" /> {{ dataHora(auditoria.canceladaEm) }}
            </span>
          </div>
          <div class="audit-meta-item">
            <span class="audit-meta-label">Cancelada por</span>
            <span class="audit-meta-value">
              <fa icon="user" /> {{ auditoria.canceladaPorNome || '—' }}
            </span>
          </div>
          <div v-if="auditoria.motivoCancelamento" class="audit-meta-item audit-meta-full">
            <span class="audit-meta-label">Motivo do cancelamento</span>
            <span class="audit-meta-value">{{ auditoria.motivoCancelamento }}</span>
          </div>
        </template>
      </div>
    </div>

    <!-- Itens da auditoria -->
    <div class="card">
      <div class="card-head">
        <h3 class="mt-0 mb-0"><fa icon="box" /> Itens da auditoria</h3>
        <span class="badge dim">{{ total.toLocaleString('pt-BR') }} item(ns)</span>
      </div>

      <!-- Filtros -->
      <div class="audit-filters row mb-3">
        <div class="audit-search-wrap">
          <fa icon="search" class="audit-search-icon" />
          <input
            v-model="filtros.q"
            placeholder="Buscar por código, produto ou colaborador..."
            class="audit-search-input"
            @keyup.enter="filtros.page = 1; carregarItens()"
          />
        </div>
        <select v-model="filtros.situacao" class="btn ghost" style="padding: 8px 12px;">
          <option value="">Todas situações</option>
          <option v-for="s in Object.keys(auditoria.situacoes || {})" :key="s" :value="s">{{ s }}</option>
        </select>
        <select v-model="filtros.conforme" class="btn ghost" style="padding: 8px 12px;">
          <option value="">Todos os status</option>
          <option value="true">Conformes</option>
          <option value="false">Não conformes</option>
        </select>
      </div>

      <div v-if="!itensTemDados && !carregando" class="empty">
        Nenhum item encontrado com os filtros atuais.
      </div>

      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Produto</th>
              <th>Classe</th>
              <th>Setor</th>
              <th>Colaborador</th>
              <th>Situação</th>
              <th class="text-center">Conf.</th>
              <th class="text-right">Pontos</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="i in itens"
              :key="i._id"
              :class="{ 'item-cancelado': i.cancelada }"
            >
              <td class="mono">{{ i.codigo }}</td>
              <td class="td-produto" :title="i.produto">{{ i.produto || '—' }}</td>
              <td><span class="badge dim">{{ i.classeRaiz || '—' }}</span></td>
              <td><span class="muted">{{ i.setor || i.local || '—' }}</span></td>
              <td>{{ i.colaboradorNome || '—' }}</td>
              <td><span class="badge dim">{{ i.situacao || '—' }}</span></td>
              <td class="text-center">
                <span v-if="i.conforme === true" class="badge ok"><fa icon="check" /></span>
                <span v-else-if="i.conforme === false" class="badge bad"><fa icon="xmark" /></span>
                <span v-else class="badge dim">—</span>
              </td>
              <td class="text-right mono muted">{{ i.pontos ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginação -->
      <div class="row mt-3 audit-pagination" v-if="total > filtros.limit">
        <button class="btn ghost" :disabled="filtros.page <= 1" @click="filtros.page--">
          <fa icon="chevron-left" /> Anterior
        </button>
        <span class="muted">Página {{ filtros.page }} de {{ Math.ceil(total / filtros.limit) }}</span>
        <button
          class="btn ghost"
          :disabled="filtros.page * filtros.limit >= total"
          @click="filtros.page++"
        >
          Próxima <fa icon="chevron-right" />
        </button>
      </div>
    </div>

    <!-- Modal: Cancelar auditoria -->
    <Transition name="fade">
      <div
        v-if="modalCancelar"
        class="audit-modal-backdrop"
        @click.self="fecharCancelar"
      >
        <div class="audit-modal card">
          <h3 class="mt-0 mb-1"><fa icon="ban" /> Cancelar auditoria</h3>
          <p class="muted mt-0">
            A auditoria continuará registrada no histórico, mas será marcada
            como <strong>cancelada</strong>. Todas as métricas, pontuações e
            rankings serão <strong>recalculados</strong> removendo a contribuição
            desta auditoria dos colaboradores e da loja.
          </p>
          <div v-if="auditoria" class="audit-modal-target">
            <span class="badge" :class="'tipo-' + auditoria.tipo">{{ auditoria.tipo }}</span>
            <span class="muted">·</span>
            <strong>{{ dataCurta }}</strong>
            <span class="muted">·</span>
            <span>{{ arquivoNome }}</span>
          </div>
          <div class="field mt-2">
            <label>Motivo (opcional)</label>
            <textarea
              v-model="motivoCancelamento"
              rows="3"
              placeholder="Ex.: planilha de teste, dia sem leitura, duplicidade…"
              :disabled="enviandoCancelar"
            />
          </div>
          <div class="row mt-2 gap-2" style="justify-content: flex-end">
            <button
              class="btn ghost"
              :disabled="enviandoCancelar"
              @click="fecharCancelar"
            >
              Manter ativa
            </button>
            <button
              class="btn warn"
              :disabled="enviandoCancelar"
              @click="confirmarCancelar"
            >
              <fa
                :icon="enviandoCancelar ? 'spinner' : 'ban'"
                :spin="enviandoCancelar"
              />
              Cancelar auditoria
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>

  <!-- Estado: auditoria não encontrada -->
  <div v-else-if="!carregando" class="empty" style="min-height: 50vh; display: grid; place-items: center;">
    <div style="text-align: center;">
      <fa icon="file-circle-question" style="font-size: 48px; opacity: 0.3;" />
      <h3 class="mt-3">Auditoria não encontrada</h3>
      <p class="muted">Verifique o link ou volte para a lista de auditorias.</p>
      <RouterLink to="/auditorias" class="btn ghost mt-2">Ver histórico</RouterLink>
    </div>
  </div>
</template>

<style scoped>
/* ============ Layout geral ============ */
.audit-detail {
  max-width: 100%;
}

/* ============ Banner de cancelamento ============ */
.cancel-banner {
  display: flex;
  gap: 14px;
  padding: 16px 20px;
  border-radius: var(--radius);
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.32);
  align-items: flex-start;
}
.cancel-banner-icon {
  font-size: 24px;
  color: var(--danger);
  flex-shrink: 0;
  margin-top: 2px;
}
.cancel-banner-text strong {
  color: #fca5a5;
  font-size: 15px;
}
.cancel-banner-text p {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.5;
}
.cancel-banner-motivo {
  margin-top: 8px;
  font-size: 13px;
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.1);
  padding: 6px 10px;
  border-radius: 8px;
  display: inline-block;
}
.cancel-banner-motivo .muted {
  color: rgba(252, 165, 165, 0.7);
}

/* ============ Hero card ============ */
.audit-hero {
  padding: 22px 24px;
  transition: opacity 0.3s;
}
.audit-hero.canceled {
  opacity: 0.78;
}
.audit-hero-head {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.audit-hero-icon {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  font-size: 22px;
  flex-shrink: 0;
}
.audit-hero-info {
  flex: 1;
  min-width: 200px;
}
.audit-hero-info h1 {
  font-size: 22px;
  text-transform: capitalize;
}
.audit-hero-score {
  text-align: right;
  flex-shrink: 0;
}
.audit-hero-score-value {
  font-size: 36px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -1px;
}
.audit-hero-score-label {
  font-size: 12px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

/* ============ KPIs ============ */
.audit-kpi-grid {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
  grid-template-columns: repeat(6, 1fr);
}
.kpi.zerada {
  opacity: 0.45;
}
.kpi.zerada .value {
  text-decoration: line-through;
  text-decoration-color: rgba(239, 68, 68, 0.4);
}
.kpi .ico {
  font-size: 14px;
  color: var(--text-mute);
  margin-bottom: 2px;
}
.kpi .suffix {
  font-size: 12px;
  color: var(--text-dim);
}

/* ============ Conteúdo: gráfico + colaboradores ============ */
.audit-content-grid {
  grid-template-columns: 2fr 1fr;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 14px;
}
.card-head h3 {
  margin: 0;
  font-size: 15px;
}

/* Top colaboradores */
.top-colab-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.top-colab-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  transition: background 0.15s;
}
.top-colab-item:hover {
  background: rgba(255, 255, 255, 0.06);
}
.top-colab-item.canceled {
  opacity: 0.5;
}
.top-colab-rank {
  font-size: 18px;
  width: 28px;
  text-align: center;
  flex-shrink: 0;
}
.top-colab-info {
  flex: 1;
  min-width: 0;
}
.top-colab-nome {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.top-colab-meta {
  font-size: 11px;
}
.top-colab-pts {
  text-align: right;
  flex-shrink: 0;
}
.top-colab-pts strong {
  font-size: 16px;
}
.top-colab-pts span {
  font-size: 10px;
  display: block;
}

/* ============ Metadados ============ */
.audit-meta-card {
  padding: 18px 22px;
}
.audit-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px 24px;
}
.audit-meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.audit-meta-full {
  grid-column: 1 / -1;
}
.audit-meta-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-mute);
  font-weight: 600;
}
.audit-meta-value {
  font-size: 13px;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ============ Filtros da tabela ============ */
.audit-filters {
  flex-wrap: wrap;
  gap: 8px;
}
.audit-search-wrap {
  position: relative;
  flex: 1;
  min-width: 200px;
}
.audit-search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-mute);
  font-size: 13px;
  pointer-events: none;
}
.audit-search-input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 12px 8px 34px;
  color: var(--text);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}
.audit-search-input:focus {
  border-color: var(--primary);
}
.audit-search-input::placeholder {
  color: var(--text-mute);
}

/* ============ Tabela ============ */
.td-produto {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mono {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 12px;
}
.item-cancelado {
  opacity: 0.5;
}
.text-center {
  text-align: center;
}
.text-right {
  text-align: right;
}
.audit-pagination {
  justify-content: center;
  align-items: center;
  gap: 10px;
}

/* ============ Modal ============ */
.audit-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(8, 13, 26, 0.62);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  z-index: 80;
  padding: 16px;
}
.audit-modal {
  width: min(100%, 480px);
  padding: 22px;
  display: grid;
  gap: 4px;
}
.audit-modal-target {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border);
  margin-top: 8px;
}
.btn.ghost.warn {
  color: #f59e0b;
}
.btn.warn {
  background: rgba(245, 158, 11, 0.18);
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.4);
}
.btn.warn:hover {
  background: rgba(245, 158, 11, 0.28);
}

/* ============ Responsivo ============ */
@media (max-width: 900px) {
  .audit-hero-head {
    flex-direction: column;
    align-items: flex-start;
  }
  .audit-hero-score {
    text-align: left;
  }
  .audit-kpi-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .audit-content-grid {
    grid-template-columns: 1fr;
  }
  .audit-meta-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 640px) {
  .audit-kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .audit-hero-info h1 {
    font-size: 18px;
  }
  .audit-hero-score-value {
    font-size: 28px;
  }
}
</style>
