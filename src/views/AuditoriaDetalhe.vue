<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import api from '@/services/api';
import Loader from '@/components/Loader.vue';
import AppChart from '@/components/AppChart.vue';

const route = useRoute();
const auditoria = ref(null);
const itens = ref([]);
const total = ref(0);
const carregando = ref(true);
const filtros = ref({ situacao: '', conforme: '', q: '', page: 1, limit: 50 });
const escopoLojaParams = computed(() => route.query.lojaId ? { lojaId: route.query.lojaId } : {});
const rotaVoltar = computed(() => route.query.lojaId ? { path: '/auditorias', query: { lojaId: route.query.lojaId } } : { path: '/auditorias' });

async function carregar() {
  carregando.value = true;
  try {
    const { data: a } = await api.get('/auditorias/' + route.params.id, { params: escopoLojaParams.value });
    auditoria.value = a;
    await carregarItens();
  } finally { carregando.value = false; }
}
async function carregarItens() {
  const { data } = await api.get(`/auditorias/${route.params.id}/itens`, { params: { ...filtros.value, ...escopoLojaParams.value } });
  itens.value = data.items;
  total.value = data.total;
}
onMounted(carregar);
watch(() => filtros.value.page, carregarItens);

const distribChart = computed(() => {
  if (!auditoria.value) return { labels: [], datasets: [] };
  const sit = auditoria.value.situacoes || {};
  const labels = Object.keys(sit);
  return {
    labels,
    datasets: [{
      label: 'Itens', data: labels.map((l) => sit[l]),
      backgroundColor: ['#7c5cff','#22d3ee','#f59e0b','#22c55e','#ef4444','#a78bfa'],
      borderRadius: 8,
    }],
  };
});
</script>

<template>
  <Loader v-if="carregando" />
  <div v-else-if="auditoria" class="grid gap-3">
    <RouterLink :to="rotaVoltar" class="btn ghost" style="width: fit-content;"><fa icon="chevron-right" style="transform: rotate(180deg);" /> Voltar</RouterLink>

    <div class="card glow">
      <div class="row">
        <span class="badge" :class="'tipo-' + auditoria.tipo">{{ auditoria.tipo }}</span>
        <h2 class="mt-0 mb-0">{{ new Date(auditoria.data).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) }}</h2>
        <span class="spacer" />
        <span class="badge ok">{{ auditoria.taxaConformidade.toFixed(1) }}%</span>
      </div>
      <div class="kpi-grid mt-3">
        <div class="kpi"><div class="label">Total itens</div><div class="value">{{ auditoria.totalItens.toLocaleString('pt-BR') }}</div></div>
        <div class="kpi"><div class="label">Lidos</div><div class="value">{{ auditoria.totalLidos.toLocaleString('pt-BR') }}</div></div>
        <div class="kpi"><div class="label">Conformes</div><div class="value">{{ auditoria.totalConformes.toLocaleString('pt-BR') }}</div></div>
        <div class="kpi"><div class="label">Não conformes</div><div class="value">{{ auditoria.totalNaoConformes.toLocaleString('pt-BR') }}</div></div>
        <div class="kpi"><div class="label">Pontuação</div><div class="value">{{ Math.round(auditoria.pontuacao) }}</div></div>
        <div class="kpi" v-if="auditoria.custoRupturaTotal"><div class="label">Custo ruptura</div><div class="value">R$ {{ auditoria.custoRupturaTotal.toLocaleString('pt-BR',{ maximumFractionDigits: 0 }) }}</div></div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 2fr 1fr;">
      <div class="card">
        <h3 class="mt-0">Distribuição por situação</h3>
        <AppChart type="bar" :data="distribChart" :height="280" />
      </div>
      <div class="card">
        <h3 class="mt-0">Top colaboradores</h3>
        <div v-if="!auditoria.topColaboradores?.length" class="empty">Sem dados</div>
        <div v-else class="grid" style="gap: 10px;">
          <div v-for="(c, i) in auditoria.topColaboradores" :key="c.colaborador" class="row card" style="padding: 10px 14px;">
            <div class="avatar">{{ (c.nome || '?').slice(0, 2) }}</div>
            <div style="flex:1;">
              <div style="font-weight:600;">{{ c.nome }}</div>
              <div class="muted" style="font-size:12px;">{{ c.itens }} itens · {{ c.conformes }} conformes</div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:700;">{{ Math.round(c.pontuacao) }}</div>
              <div class="muted" style="font-size: 11px;">#{{ i + 1 }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="row mb-2">
        <h3 class="mt-0 mb-0">Itens da auditoria</h3>
        <span class="spacer" />
        <input v-model="filtros.q" placeholder="Buscar produto/código..." style="background:rgba(0,0,0,.25);border:1px solid var(--border);border-radius:10px;padding:8px 12px;color:white;" @keyup.enter="filtros.page=1; carregarItens()" />
        <select v-model="filtros.situacao" @change="filtros.page=1; carregarItens()" class="btn ghost" style="padding:8px 12px;">
          <option value="">Todas situações</option>
          <option v-for="s in Object.keys(auditoria.situacoes || {})" :key="s" :value="s">{{ s }}</option>
        </select>
        <select v-model="filtros.conforme" @change="filtros.page=1; carregarItens()" class="btn ghost" style="padding:8px 12px;">
          <option value="">Todos</option>
          <option value="true">Conformes</option>
          <option value="false">Não conformes</option>
        </select>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Código</th><th>Produto</th><th>Classe</th><th>Local</th><th>Colaborador</th><th>Situação</th><th>Conf.</th></tr></thead>
          <tbody>
            <tr v-for="i in itens" :key="i._id">
              <td>{{ i.codigo }}</td>
              <td style="max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ i.produto }}</td>
              <td><span class="muted">{{ i.classeRaiz }}</span></td>
              <td><span class="muted">{{ i.local }}</span></td>
              <td>{{ i.colaboradorNome || '—' }}</td>
              <td><span class="badge dim">{{ i.situacao }}</span></td>
              <td>
                <span v-if="i.conforme === true" class="badge ok"><fa icon="check" /></span>
                <span v-else-if="i.conforme === false" class="badge bad"><fa icon="xmark" /></span>
                <span v-else class="badge dim">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="row mt-2">
        <span class="muted">{{ total.toLocaleString('pt-BR') }} item(ns)</span>
        <span class="spacer" />
        <button class="btn ghost" :disabled="filtros.page <= 1" @click="filtros.page--">Anterior</button>
        <span class="muted">Página {{ filtros.page }}</span>
        <button class="btn ghost" :disabled="filtros.page * filtros.limit >= total" @click="filtros.page++">Próxima</button>
      </div>
    </div>
  </div>
</template>
