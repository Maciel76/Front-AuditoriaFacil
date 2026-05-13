<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import api from "@/services/api";
import Loader from "@/components/Loader.vue";
import PeriodoSelector from "@/components/PeriodoSelector.vue";
import ColaboradorAvatar from "@/components/ColaboradorAvatar.vue";
import RankingModeSelector from "@/components/RankingModeSelector.vue";
import RankingMediaCard from "@/components/RankingMediaCard.vue";
import MetaBadge from "@/components/MetaBadge.vue";
import { useAuthStore } from "@/stores/auth";
import { exportarAreaComoImagem, slugArquivo } from "@/utils/captureExport";
import {
  LABELS_PERIODO,
  LABELS_TIPO,
  MODOS_RANKING_COLABORADORES,
  obterModo,
  ordenarItens,
  metaBatida,
} from "@/utils/rankingModes";

const auth = useAuthStore();

const RANKING_COLABORADORES_LOJA_STORAGE_KEY =
  "na_ranking_colaboradores_superadmin_loja";
const RANKING_COLABORADORES_MODO_STORAGE_KEY = "na_ranking_colaboradores_modo";

const periodo = ref("1d");
const dataInicio = ref("");
const dataFim = ref("");
const tipo = ref("");
const modoId = ref(
  localStorage.getItem(RANKING_COLABORADORES_MODO_STORAGE_KEY) || "pontuacao",
);
const carregando = ref(true);
const items = ref([]);
const lojas = ref([]);
const lojaSelecionada = ref("");
const captureArea = ref(null);
const exportando = ref(false);
const metaPercentualRestante = ref(2);

const labelsPeriodo = LABELS_PERIODO;
const labelsTipo = LABELS_TIPO;
const modos = MODOS_RANKING_COLABORADORES;
const modoAtivo = computed(() => obterModo(modos, modoId.value));

const podeEscolherLoja = computed(() => auth.isSuperAdmin);

const paramsEscopoLoja = computed(() => {
  if (!podeEscolherLoja.value) return {};
  if (!lojaSelecionada.value) return {};
  return { lojaId: lojaSelecionada.value };
});

function tipoSugeridoHoje() {
  const diaSemana = new Date().getDay();
  if (diaSemana === 1 || diaSemana === 4) return "ETIQUETA";
  if (diaSemana === 2) return "PRESENCA";
  if (diaSemana === 3) return "RUPTURA";
  return "";
}

async function carregarLojas() {
  if (!podeEscolherLoja.value) return;
  try {
    const { data } = await api.get("/lojas");
    lojas.value = (data?.items || []).filter((loja) => loja?.ativa !== false);
  } catch {
    lojas.value = [];
  }
}

async function carregar() {
  carregando.value = true;
  try {
    const paramsBase = {
      periodo: periodo.value,
      ...paramsEscopoLoja.value,
    };

    if (periodo.value === "custom" && dataInicio.value && dataFim.value) {
      paramsBase.dataInicio = dataInicio.value;
      paramsBase.dataFim = dataFim.value;
    }

    const carregarRanking = async (tipoSelecionado) => {
      const params = {
        ...paramsBase,
        tipo: tipoSelecionado || undefined,
      };
      const { data } = await api.get("/metricas/ranking/colaboradores", {
        params,
      });
      return data.items || [];
    };

    const itensAtuais = await carregarRanking(tipo.value);

    if (
      periodo.value === "1d" &&
      tipo.value &&
      tipo.value === tipoSugeridoHoje() &&
      !itensAtuais.length
    ) {
      tipo.value = "";
      items.value = await carregarRanking("");
      return;
    }

    items.value = itensAtuais;
  } finally {
    carregando.value = false;
  }
}

onMounted(async () => {
  tipo.value = tipoSugeridoHoje();
  carregarConfig();
  if (podeEscolherLoja.value) {
    lojaSelecionada.value =
      localStorage.getItem(RANKING_COLABORADORES_LOJA_STORAGE_KEY) || "";
    await carregarLojas();

    if (
      lojaSelecionada.value &&
      !lojas.value.some((loja) => String(loja._id) === lojaSelecionada.value)
    ) {
      lojaSelecionada.value = "";
      localStorage.removeItem(RANKING_COLABORADORES_LOJA_STORAGE_KEY);
    }
  }

  await carregar();
});

async function carregarConfig() {
  try {
    const { data } = await api.get("/config");
    if (typeof data?.metaPercentualRestante === "number") {
      metaPercentualRestante.value = data.metaPercentualRestante;
    }
  } catch {
    // mantém default
  }
}

watch(modoId, (v) => {
  localStorage.setItem(RANKING_COLABORADORES_MODO_STORAGE_KEY, v);
});

watch([periodo, tipo, dataInicio, dataFim, lojaSelecionada], () => {
  if (podeEscolherLoja.value) {
    localStorage.setItem(
      RANKING_COLABORADORES_LOJA_STORAGE_KEY,
      lojaSelecionada.value || "",
    );
  }

  if (periodo.value !== "custom" || (dataInicio.value && dataFim.value)) {
    carregar();
  }
});

const itemsOrdenados = computed(() => ordenarItens(items.value, modoAtivo.value));
const topItems = computed(() => itemsOrdenados.value.slice(0, 3));
const itensRestantes = computed(() => itemsOrdenados.value.slice(3));

const podiumCards = computed(() => {
  const cards = topItems.value.map((item, index) => ({
    item,
    rank: index + 1,
  }));
  if (cards.length === 3) return [cards[1], cards[0], cards[2]];
  return cards;
});

function podioMeta(rank) {
  if (rank === 1) return { ico: "trophy", cor: "#f59e0b", titulo: "1º" };
  if (rank === 2) return { ico: "medal", cor: "#94a3b8", titulo: "2º" };
  return { ico: "medal", cor: "#f97316", titulo: "3º" };
}

function formatarItens(total) {
  return `${(total || 0).toLocaleString("pt-BR")} itens`;
}

function formatarPontos(total) {
  return `${Math.round(total || 0).toLocaleString("pt-BR")} pts`;
}

// Valor do modo de ranking selecionado para o item — exibido no destaque.
function valorPrincipal(item) {
  const v = modoAtivo.value.accessor(item);
  if (v == null) return "—";
  return modoAtivo.value.format(v);
}

function bateuMeta(item) {
  return metaBatida(item, metaPercentualRestante.value);
}

function periodoArquivoAtual() {
  return (
    {
      "1d": "hoje",
      semana: "semana",
      mes: "mes",
      ano: "ano",
      tudo: "historico",
      custom: "periodo",
    }[periodo.value] || periodo.value
  );
}

async function compartilhar() {
  if (!captureArea.value || exportando.value) return;

  exportando.value = true;
  try {
    const tipoLabel = tipo.value ? `-${tipo.value.toLowerCase()}` : "";
    const lojaAtual = lojaSelecionada.value
      ? lojas.value.find((loja) => String(loja._id) === lojaSelecionada.value)
      : null;
    const lojaLabel = lojaAtual?.nome ? `-${slugArquivo(lojaAtual.nome)}` : "";

    await exportarAreaComoImagem({
      target: captureArea.value,
      filename: `ranking-colaboradores${lojaLabel}-${periodoArquivoAtual()}${tipoLabel}-${new Date().toISOString().slice(0, 10)}.png`,
      buttonSelector: ".ranking-share-btn",
      classesParaRemover: ["ranking-reveal"],
    });
  } finally {
    exportando.value = false;
  }
}

const subtituloPodio = computed(() => {
  const tipoLabel = tipo.value
    ? labelsTipo[tipo.value] || tipo.value
    : "Todos os tipos";
  const periodoLabel =
    periodo.value === "custom"
      ? `${dataInicio.value || "--"} a ${dataFim.value || "--"}`
      : labelsPeriodo[periodo.value] || periodo.value;

  const lojaLabel = podeEscolherLoja.value
    ? lojaSelecionada.value
      ? lojas.value.find((loja) => String(loja._id) === lojaSelecionada.value)
          ?.nome || "Loja selecionada"
      : "Todas as lojas"
    : "Sua loja";

  return `Loja: ${lojaLabel} · ${modoAtivo.value.label} · Tipo: ${tipoLabel} · Período: ${periodoLabel}`;
});

const visualizacaoKey = computed(() => {
  const ids = itemsOrdenados.value.map((item) => item._id).join("|");
  return `${periodo.value}-${tipo.value}-${modoId.value}-${dataInicio.value}-${dataFim.value}-${lojaSelecionada.value}-${ids}`;
});

const queryPerfilColaborador = computed(() =>
  podeEscolherLoja.value && lojaSelecionada.value
    ? { lojaId: lojaSelecionada.value }
    : undefined,
);
</script>

<template>
  <div ref="captureArea" class="grid gap-3">
    <div class="row toolbar-wrap">
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

      <select
        v-if="podeEscolherLoja"
        v-model="lojaSelecionada"
        class="btn ghost"
        style="padding: 8px 14px; min-width: 230px"
      >
        <option value="">Todas as lojas</option>
        <option v-for="loja in lojas" :key="loja._id" :value="String(loja._id)">
          {{ loja.nome }}
        </option>
      </select>

      <RankingModeSelector v-model="modoId" :modos="modos" />

      <span class="spacer" />
      <button
        class="btn primary dash-share-btn ranking-share-btn"
        :disabled="exportando || carregando"
        :aria-busy="exportando"
        @click="compartilhar"
      >
        <fa icon="share-nodes" />
        Compartilhar
      </button>
    </div>

    <Transition name="ranking-stage" mode="out-in">
      <Loader v-if="carregando" key="loading" />
      <div v-else :key="visualizacaoKey" class="grid gap-3 rankings-stage">
        <div v-if="!itemsOrdenados.length" class="empty">
          Sem dados no período selecionado.
        </div>

        <template v-else>
          

          <section v-if="podiumCards.length" class="podium-section">
            <div class="podium-header">
              <div class="podium-headline">
                <h3 class="mt-0 mb-0">Top Colaboradores</h3>
                <p class="muted podium-copy">{{ subtituloPodio }}</p>
              </div>
            </div>

            <div class="podium-grid" :class="`size-${podiumCards.length}`">
              <article
                v-for="card in podiumCards"
                :key="card.item._id"
                class="podium-card ranking-reveal"
                :class="`rank-${card.rank}`"
                :style="{ animationDelay: `${card.rank * 70}ms` }"
              >
                <div class="podium-rank">{{ podioMeta(card.rank).titulo }}</div>
                <div
                  class="podium-medal"
                  :style="{ color: podioMeta(card.rank).cor }"
                >
                  <fa :icon="podioMeta(card.rank).ico" />
                </div>
                <ColaboradorAvatar
                  class="podium-avatar"
                  :nome="card.item.nome"
                  :avatar-url="card.item.avatarUrl"
                  :size="92"
                  :font-size="30"
                />
                <div class="podium-name">{{ card.item.nome }}</div>
                <div class="podium-detail">
                  #{{ card.item.codigoExterno }} · Nível {{ card.item.nivel }}
                </div>
                <MetaBadge
                  v-if="bateuMeta(card.item)"
                  size="md"
                  class="podium-meta-badge"
                />
                <div class="podium-chip">
                  <fa icon="chart-bar" />
                  <span>{{ valorPrincipal(card.item) }}</span>
                </div>
                <div class="podium-stats">
                  <strong>{{ card.item.taxaConformidade.toFixed(1) }}%</strong>
                  <span>{{ formatarPontos(card.item.pontuacao) }}</span>
                  <span class="muted podium-stats-itens">
                    · {{ formatarItens(card.item.totalLidos) }}
                  </span>
                </div>
              </article>
            </div>
          </section>

          <section v-if="itensRestantes.length" class="rankings-list-section">
            <div class="section-title" style="margin-top: 4px">
              Demais posições
            </div>
            <div class="grid gap-2 rankings-list-grid">
              <div
                v-for="(c, i) in itensRestantes"
                :key="c._id"
                class="card row ranking-row ranking-reveal"
                style="padding: 14px 18px"
                :style="{ animationDelay: `${(i + 1) * 55}ms` }"
              >
                <div style="width: 40px; text-align: center">
                  <span class="muted" style="font-weight: 700">#{{ i + 4 }}</span>
                </div>
                <ColaboradorAvatar
                  :nome="c.nome"
                  :avatar-url="c.avatarUrl"
                  :size="40"
                  :font-size="14"
                />
                <div style="flex: 1; min-width: 0">
                  <div style="font-weight: 600">
                    <RouterLink
                      :to="{ path: `/colaboradores/${c._id}`, query: queryPerfilColaborador }"
                    >
                      {{ c.nome }}
                    </RouterLink>
                    <span
                      class="muted"
                      style="font-weight: 400; margin-left: 8px; font-size: 12px"
                    >
                      #{{ c.codigoExterno }}
                    </span>
                    <MetaBadge v-if="bateuMeta(c)" size="sm" class="row-meta-badge" />
                  </div>
                  <div class="muted" style="font-size: 12px">
                    Nível {{ c.nivel }} ·
                    {{ c.totalLidos.toLocaleString("pt-BR") }} itens ·
                    {{ c.dias }} dias ·
                    {{ c.totalAuditorias || 0 }} auditoria(s)
                  </div>
                </div>
                <div style="width: 130px">
                  <div class="row" style="gap: 8px">
                    <strong>{{ c.taxaConformidade.toFixed(1) }}%</strong>
                  </div>
                  <div class="progress mt-1">
                    <span
                      :style="{
                        width: Math.min(100, c.taxaConformidade) + '%',
                      }"
                    />
                  </div>
                </div>
                <div style="text-align: right; min-width: 110px">
                  <div style="font-size: 18px; font-weight: 700">
                    {{ valorPrincipal(c) }}
                  </div>
                  <div class="muted" style="font-size: 11px">
                    {{ modoAtivo.label }}
                  </div>
                </div>
              </div>
            </div>
          </section>
          <RankingMediaCard
            :items="itemsOrdenados"
            :modo="modoAtivo"
            :meta-percentual-restante="metaPercentualRestante"
            :contexto-label="`${itemsOrdenados.length} colaborador(es) no ranking`"
          />
        </template>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toolbar-wrap {
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.podium-section {
  display: grid;
  gap: 18px;
}

.podium-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
}

.podium-headline {
  display: grid;
  gap: 4px;
  justify-items: center;
}

.podium-copy {
  margin: 6px 0 0;
  font-size: 13px;
}

.rankings-list-section {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
}

.rankings-list-grid {
  align-content: start;
}

.podium-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: stretch;
  gap: 18px;
}

.podium-card {
  position: relative;
  flex: 1 1 250px;
  max-width: 320px;
  min-height: 320px;
  padding: 30px 22px 24px;
  border-radius: 24px;
  border: 1px solid var(--border-strong);
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.08),
    rgba(255, 255, 255, 0.03)
  );
  box-shadow: var(--shadow);
  text-align: center;
  transition:
    transform 0.26s ease,
    box-shadow 0.26s ease,
    border-color 0.2s ease,
    filter 0.26s ease;
  will-change: transform, opacity;
}

.podium-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  filter: saturate(1.06);
}

.podium-card.rank-1 {
  background: linear-gradient(
    180deg,
    rgba(245, 158, 11, 0.2),
    rgba(245, 158, 11, 0.08)
  );
  border-color: rgba(245, 158, 11, 0.55);
  transform: translateY(-10px);
}

.podium-card.rank-1:hover {
  transform: translateY(-14px);
}

.podium-card.rank-2 {
  background: linear-gradient(
    180deg,
    rgba(148, 163, 184, 0.16),
    rgba(148, 163, 184, 0.06)
  );
  border-color: rgba(148, 163, 184, 0.45);
}

.podium-card.rank-3 {
  background: linear-gradient(
    180deg,
    rgba(249, 115, 22, 0.16),
    rgba(249, 115, 22, 0.06)
  );
  border-color: rgba(249, 115, 22, 0.45);
}

.podium-rank {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  min-width: 58px;
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--bg-3);
  border: 1px solid var(--border);
  color: var(--text);
  font-weight: 800;
  font-size: 22px;
  line-height: 1;
}

.podium-card.rank-1 .podium-rank {
  color: #ecb133;
}

.podium-card.rank-2 .podium-rank {
  color: #64748b;
}

.podium-card.rank-3 .podium-rank {
  color: #c2410c;
}

.podium-medal {
  margin-top: 6px;
  font-size: 40px;
}

.podium-avatar {
  margin: 14px auto 16px;
  box-shadow:
    0 0 0 4px rgba(255, 255, 255, 0.88),
    0 12px 30px rgba(0, 0, 0, 0.18);
}

.podium-name {
  font-size: 18px;
  font-weight: 800;
  line-height: 1.2;
  text-transform: uppercase;
  text-wrap: balance;
}

.podium-detail {
  margin-top: 8px;
  color: var(--text-dim);
  font-size: 13px;
}

.podium-chip {
  width: fit-content;
  margin: 18px auto 10px;
  padding: 10px 16px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.72);
  color: #374151;
  font-weight: 700;
}

.podium-stats {
  display: flex;
  justify-content: center;
  gap: 12px;
  align-items: center;
  color: var(--text-dim);
  font-size: 13px;
}

.podium-stats strong {
  color: var(--text);
}

.podium-stats-itens {
  font-size: 12px;
}

.podium-meta-badge {
  margin-top: 8px;
}

.row-meta-badge {
  margin-left: 8px;
  vertical-align: middle;
}

.ranking-stage-enter-active,
.ranking-stage-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.28s ease,
    filter 0.28s ease;
}

.ranking-stage-enter-from,
.ranking-stage-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.99);
  filter: blur(6px);
}

.ranking-reveal {
  opacity: 0;
  animation: rankReveal 0.48s cubic-bezier(0.21, 1, 0.32, 1) forwards;
}

.ranking-row {
  transition:
    transform 0.22s ease,
    border-color 0.22s ease,
    background-color 0.22s ease;
}

.ranking-row:hover {
  transform: translateY(-2px);
}

:global([data-theme="light"]) .rankings-list-section {
  background: rgba(255, 255, 255, 0.82);
  border-color: rgba(89, 108, 165, 0.16);
}

@keyframes rankReveal {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

:global([data-theme="light"]) .podium-card {
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.94),
    rgba(255, 255, 255, 0.82)
  );
}

:global([data-theme="light"]) .podium-card.rank-1 {
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.96),
    rgba(255, 255, 255, 0.88)
  );
}

:global([data-theme="light"]) .podium-card.rank-2 {
  background: linear-gradient(
    180deg,
    rgba(226, 232, 240, 0.84),
    rgba(255, 255, 255, 0.9)
  );
}

:global([data-theme="light"]) .podium-card.rank-3 {
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.96),
    rgba(255, 255, 255, 0.88)
  );
  border-color: rgba(148, 163, 184, 0.36);
}

:global([data-theme="light"]) .podium-card.rank-1 .podium-rank {
  background: rgba(255, 255, 255, 0.98);
  border-color: rgba(217, 119, 6, 0.28);
  color: #b45309;
}

:global([data-theme="light"]) .podium-card.rank-2 .podium-rank {
  background: linear-gradient(
    180deg,
    rgba(248, 250, 252, 0.98),
    rgba(226, 232, 240, 0.95)
  );
  border-color: rgba(100, 116, 139, 0.22);
  color: #64748b;
}

:global([data-theme="light"]) .podium-card.rank-3 .podium-rank {
  background: rgba(255, 255, 255, 0.98);
  border-color: rgba(194, 65, 12, 0.22);
  color: #c2410c;
}

@media (max-width: 960px) {
  .podium-card.rank-1 {
    transform: none;
  }

  .podium-card.rank-1:hover,
  .podium-card:hover,
  .ranking-row:hover {
    transform: none;
  }

  .podium-grid.size-3 .podium-card {
    max-width: none;
  }
}
</style>