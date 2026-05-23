<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import api from "@/services/api";
import Loader from "@/components/Loader.vue";
import { useAuthStore } from "@/stores/auth";
import StoreAvatar from "@/components/StoreAvatar.vue";
import PeriodoSelector from "@/components/PeriodoSelector.vue";

const auth = useAuthStore();
const router = useRouter();
const carregando = ref(true);
const atualizando = ref(false);
const erro = ref("");
const busca = ref("");
const periodo = ref("1d");
const dataInicio = ref("");
const dataFim = ref("");
const periodoApi = ref(null);
const items = ref([]);

const labelsTipo = {
  ETIQUETA: "Etiqueta",
  PRESENCA: "Presença",
  RUPTURA: "Ruptura",
};

const labelsPeriodo = {
  "1d": "Hoje",
  semana: "Semana",
  mes: "Mês",
  ano: "Ano",
  tudo: "Histórico",
  custom: "Período personalizado",
};

const resumoVazio = {
  totalAuditorias: 0,
  tiposComAuditoria: 0,
  totalItens: 0,
  totalItensAuditaveis: 0,
  totalLidos: 0,
  totalConformes: 0,
  totalNaoConformes: 0,
  pontuacao: 0,
  custoRuptura: 0,
  taxaConformidade: 0,
  ultimaAuditoriaEm: null,
  porTipo: {
    ETIQUETA: { totalAuditorias: 0 },
    PRESENCA: { totalAuditorias: 0 },
    RUPTURA: { totalAuditorias: 0 },
  },
  ultimaAuditoria: null,
};

function normalizar(valor = "") {
  return valor
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatarInteiro(valor = 0) {
  return Number(valor || 0).toLocaleString("pt-BR");
}

function formatarPercentual(valor = 0) {
  return `${Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatarMoeda(valor = 0) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatarData(valor) {
  if (!valor) return "Sem auditoria no período";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Sem auditoria no período";
  return data.toLocaleDateString("pt-BR");
}

function localizacaoLoja(loja) {
  const local = [loja?.cidade, loja?.estado].filter(Boolean).join(" / ");
  return [loja?.codigo, local].filter(Boolean).join(" ") || "Local não informado";
}

function resumoLoja(loja) {
  return loja?.resumoPeriodo || resumoVazio;
}

function custoRupturaLoja(loja) {
  const resumo = resumoLoja(loja);
  return Number(
    resumo.porTipo?.RUPTURA?.custoRupturaOperacional ??
      resumo.custoRupturaOperacionalRuptura ??
      resumo.porTipo?.RUPTURA?.custoRuptura ??
      0,
  );
}

function ultimaAuditoriaLoja(loja) {
  return resumoLoja(loja).ultimaAuditoria || null;
}

function auditoriasPorTipo(loja) {
  const resumo = resumoLoja(loja);
  return Object.entries(labelsTipo).map(([key, label]) => ({
    key,
    label,
    total: Number(resumo.porTipo?.[key]?.totalAuditorias || 0),
  }));
}

function larguraConformidade(loja) {
  return `${Math.max(0, Math.min(100, Number(resumoLoja(loja).taxaConformidade || 0)))}%`;
}

function abrirLoja(lojaId) {
  router.push(`/lojas/${lojaId}`);
}

async function carregar() {
  const primeiraCarga = !periodoApi.value;
  carregando.value = primeiraCarga;
  atualizando.value = !primeiraCarga;
  erro.value = "";

  try {
    const params = { periodo: periodo.value };
    if (periodo.value === "custom" && dataInicio.value && dataFim.value) {
      params.dataInicio = dataInicio.value;
      params.dataFim = dataFim.value;
    }

    const { data } = await api.get("/lojas/catalogo", { params });
    items.value = data.items || [];
    periodoApi.value = data.periodo || null;
  } catch (error) {
    erro.value =
      error?.response?.data?.error || "Não foi possível carregar as lojas.";
  } finally {
    carregando.value = false;
    atualizando.value = false;
  }
}

onMounted(carregar);
watch([periodo, dataInicio, dataFim], () => {
  if (periodo.value !== "custom" || (dataInicio.value && dataFim.value)) {
    carregar();
  }
});

const periodoAtivoLabel = computed(() => {
  if (periodo.value === "custom") {
    return `${dataInicio.value || "--"} a ${dataFim.value || "--"}`;
  }
  return labelsPeriodo[periodo.value] || periodo.value;
});

const resumoCatalogo = computed(() => {
  const base = items.value.reduce(
    (acc, loja) => {
      const resumo = resumoLoja(loja);
      acc.totalLojas += 1;
      acc.totalAuditorias += Number(resumo.totalAuditorias || 0);
      acc.totalLidos += Number(resumo.totalLidos || 0);
      acc.totalConformes += Number(resumo.totalConformes || 0);
      acc.totalNaoConformes += Number(resumo.totalNaoConformes || 0);
      acc.totalItensAuditaveis += Number(resumo.totalItensAuditaveis || 0);
      acc.lojasComAuditoria += Number(resumo.totalAuditorias || 0) > 0 ? 1 : 0;

      const etiqueta = resumo.porTipo?.ETIQUETA || {};
      acc.numeradorConformidade += Number(etiqueta.totalLidos || 0);
      acc.denominadorConformidade += Number(etiqueta.totalItensAuditaveis || 0);

      for (const tipo of ["PRESENCA", "RUPTURA"]) {
        const tipoResumo = resumo.porTipo?.[tipo] || {};
        acc.numeradorConformidade += Number(tipoResumo.totalConformes || 0);
        acc.denominadorConformidade += Number(tipoResumo.totalLidos || 0);
      }
      return acc;
    },
    {
      totalLojas: 0,
      lojasComAuditoria: 0,
      totalAuditorias: 0,
      totalItensAuditaveis: 0,
      totalLidos: 0,
      totalConformes: 0,
      totalNaoConformes: 0,
      numeradorConformidade: 0,
      denominadorConformidade: 0,
    },
  );

  base.taxaConformidade =
    base.denominadorConformidade > 0
      ? (base.numeradorConformidade / base.denominadorConformidade) * 100
      : 0;
  return base;
});

const lojasFiltradas = computed(() => {
  const termo = normalizar(busca.value);
  return [...items.value]
    .filter((item) => {
      if (!termo) return true;
      const alvo = normalizar(
        [item.nome, item.slug, item.codigo, item.cidade, item.estado]
          .filter(Boolean)
          .join(" "),
      );
      return alvo.includes(termo);
    })
    .sort((a, b) => {
      const aPropria = String(a._id) === String(auth.loja?._id || "");
      const bPropria = String(b._id) === String(auth.loja?._id || "");
      if (aPropria !== bPropria) return aPropria ? -1 : 1;

      const resumoA = resumoLoja(a);
      const resumoB = resumoLoja(b);
      if (resumoA.totalAuditorias !== resumoB.totalAuditorias) {
        return resumoB.totalAuditorias - resumoA.totalAuditorias;
      }
      if (resumoA.totalLidos !== resumoB.totalLidos) {
        return resumoB.totalLidos - resumoA.totalLidos;
      }
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
});
</script>

<template>
  <div class="stores-shell">
    <div class="row stores-toolbar">
      <div>
        <h3 class="mt-0 mb-0">Catálogo de lojas</h3>
        <p class="muted stores-copy">
          Leituras, auditorias por tipo e resultado das lojas no período.
        </p>
      </div>
      <span class="spacer" />
      <PeriodoSelector
        v-model="periodo"
        v-model:dataInicio="dataInicio"
        v-model:dataFim="dataFim"
      />
      <input
        v-model="busca"
        class="stores-search"
        placeholder="Buscar por nome, código, cidade ou slug"
      />
      <RouterLink v-if="auth.isSuperAdmin" to="/admin/lojas" class="btn ghost">
        <fa icon="gear" /> Administração
      </RouterLink>
    </div>

    <div v-if="!carregando && !erro" class="stores-summary-grid">
      <article class="stores-summary-item">
        <span class="muted">Período</span>
        <strong>{{ periodoAtivoLabel }}</strong>
      </article>
      <article class="stores-summary-item">
        <span class="muted">Lojas com auditoria</span>
        <strong>
          {{ formatarInteiro(resumoCatalogo.lojasComAuditoria) }} /
          {{ formatarInteiro(resumoCatalogo.totalLojas) }}
        </strong>
      </article>
      <article class="stores-summary-item">
        <span class="muted">Auditorias</span>
        <strong>{{ formatarInteiro(resumoCatalogo.totalAuditorias) }}</strong>
      </article>
      <article class="stores-summary-item">
        <span class="muted">Itens lidos</span>
        <strong>{{ formatarInteiro(resumoCatalogo.totalLidos) }}</strong>
      </article>
      <article class="stores-summary-item">
        <span class="muted">Conformidade</span>
        <strong>{{
          formatarPercentual(resumoCatalogo.taxaConformidade)
        }}</strong>
      </article>
      <span v-if="atualizando" class="badge info stores-refresh">
        Atualizando...
      </span>
    </div>

    <Loader v-if="carregando" />

    <div v-else-if="erro" class="empty">
      {{ erro }}
    </div>

    <div v-else-if="!lojasFiltradas.length" class="empty">
      Nenhuma loja encontrada para o filtro informado.
    </div>

    <div v-else class="stores-grid" :class="{ 'is-refreshing': atualizando }">
      <article
        v-for="loja in lojasFiltradas"
        :key="loja._id"
        class="card store-card glow"
        role="link"
        tabindex="0"
        @click="abrirLoja(loja._id)"
        @keydown.enter.prevent="abrirLoja(loja._id)"
        @keydown.space.prevent="abrirLoja(loja._id)"
      >
        <div class="row store-card-head">
          <StoreAvatar
            :nome="loja.nome"
            :avatar-url="loja.avatarUrl"
            :size="52"
            :font-size="18"
            class="store-card-avatar"
          />

          <div style="flex: 1; min-width: 0">
            <div class="store-card-title">{{ loja.nome }}</div>
            <div class="muted store-card-subtitle">
              {{ localizacaoLoja(loja) }}
            </div>
          </div>

          <span
            v-if="String(loja._id) === String(auth.loja?._id || '')"
            class="badge ok"
            >Sua loja</span
          >
        </div>

        <div class="store-card-stats">
          <div class="store-card-stat store-card-stat-main">
            <span class="muted">Itens lidos</span>
            <strong>{{ formatarInteiro(resumoLoja(loja).totalLidos) }}</strong>
          </div>
        </div>

        <div class="store-card-progress">
          <span :style="{ width: larguraConformidade(loja) }" />
        </div>

        <div class="store-card-types">
          <span
            v-for="tipoItem in auditoriasPorTipo(loja)"
            :key="tipoItem.key"
            class="store-type-pill"
            :class="`tipo-${tipoItem.key}`"
          >
            <span>{{ tipoItem.label }}</span>
            <strong>{{ formatarInteiro(tipoItem.total) }}</strong>
          </span>
        </div>

        <div class="store-card-insights">
          <span class="muted">
            Última: {{ formatarData(resumoLoja(loja).ultimaAuditoriaEm) }}
          </span>
          <span v-if="ultimaAuditoriaLoja(loja)?.tipo" class="muted">
            {{
              labelsTipo[ultimaAuditoriaLoja(loja).tipo] ||
              ultimaAuditoriaLoja(loja).tipo
            }}
          </span>
          <span v-if="custoRupturaLoja(loja)" class="muted">
            Ruptura {{ formatarMoeda(custoRupturaLoja(loja)) }}
          </span>
          <span v-if="resumoLoja(loja).tiposComAuditoria" class="muted">
            {{ formatarInteiro(resumoLoja(loja).tiposComAuditoria) }} tipos com
            auditoria
          </span>
        </div>

        <div class="row store-card-footer">
          <span class="muted">Ver perfil analítico</span>
          <span class="spacer" />
          <fa icon="chevron-right" />
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.stores-shell {
  display: grid;
  gap: 18px;
}

.stores-toolbar {
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.stores-copy {
  margin: 6px 0 0;
  max-width: 620px;
}

.stores-search {
  min-width: min(100%, 320px);
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  color: var(--text);
}

.stores-summary-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

.stores-summary-item {
  display: grid;
  gap: 4px;
  min-height: 74px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

.stores-summary-item strong {
  font-size: 18px;
}

.stores-refresh {
  position: absolute;
  right: 8px;
  top: -32px;
}

.stores-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.stores-grid.is-refreshing {
  opacity: 0.72;
  filter: blur(1px);
  pointer-events: none;
}

.store-card {
  display: grid;
  gap: 14px;
  color: inherit;
  cursor: pointer;
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease;
}

.store-card:hover,
.store-card:focus-visible {
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
  border-color: var(--border-strong);
}

.store-card-avatar {
  width: 52px;
  height: 52px;
  font-weight: 700;
}

.store-card-head {
  align-items: flex-start;
  gap: 12px;
}

.store-card-title {
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.store-card-subtitle {
  font-size: 13px;
  margin-top: 4px;
}

.store-card-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.store-card-stat {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
}

.store-card-stat-main {
  grid-column: span 3;
  grid-template-columns: 1fr auto;
  align-items: center;
}

.store-card-stat-main .muted {
  grid-column: 1;
}

.store-card-stat-main strong {
  grid-column: 2;
  grid-row: 1 / span 2;
  font-size: 24px;
}

.store-card-stats strong {
  font-size: 14px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.store-card-progress {
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
}

.store-card-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--grad-primary);
  min-width: 0;
}

.store-card-types {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.store-type-pill {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 9px 10px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
}

.store-type-pill span {
  color: var(--text-dim);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.store-type-pill strong {
  font-size: 16px;
}

.store-type-pill.tipo-ETIQUETA {
  border-color: rgba(124, 92, 255, 0.28);
}

.store-type-pill.tipo-PRESENCA {
  border-color: rgba(34, 211, 238, 0.26);
}

.store-type-pill.tipo-RUPTURA {
  border-color: rgba(245, 158, 11, 0.28);
}

.store-card-insights {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  font-size: 12px;
}

.store-card-footer {
  align-items: center;
  color: var(--text-dim);
}

@media (max-width: 720px) {
  .stores-search {
    width: 100%;
  }

  .stores-grid {
    grid-template-columns: 1fr;
  }

  .store-card-stats,
  .store-card-types {
    grid-template-columns: 1fr;
  }

  .store-card-stat-main {
    grid-column: span 1;
  }

  .store-card-stat-main strong {
    grid-column: 1;
    grid-row: auto;
  }

  .stores-refresh {
    position: static;
    width: fit-content;
  }
}
</style>
