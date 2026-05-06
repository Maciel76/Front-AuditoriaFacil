<script setup>
import { computed, ref, onMounted, watch } from "vue";
import api from "@/services/api";
import Loader from "@/components/Loader.vue";
import PeriodoSelector from "@/components/PeriodoSelector.vue";
import { useAuthStore } from "@/stores/auth";
import StoreAvatar from "@/components/StoreAvatar.vue";
import { RouterLink } from "vue-router";
import { resolverUrlMidia } from "@/utils/media";

const auth = useAuthStore();
const aba = ref("colaboradores");
const periodo = ref("1d");
const dataInicio = ref("");
const dataFim = ref("");
const tipo = ref("");
const carregando = ref(true);
const items = ref([]);

function tipoSugeridoHoje() {
  const diaSemana = new Date().getDay(); // 0=Dom, 1=Seg, ...
  if (diaSemana === 1 || diaSemana === 4) return "ETIQUETA";
  if (diaSemana === 2) return "PRESENCA";
  if (diaSemana === 3) return "RUPTURA";
  return "";
}

const labelsPeriodo = {
  "1d": "Hoje",
  semana: "Semana",
  mes: "Mês",
  ano: "Ano",
  tudo: "Histórico",
  custom: "Período personalizado",
};

const labelsTipo = {
  ETIQUETA: "Etiqueta",
  PRESENCA: "Presença",
  RUPTURA: "Ruptura",
};

async function carregar() {
  carregando.value = true;
  try {
    const url =
      aba.value === "lojas"
        ? "/metricas/ranking/lojas"
        : "/metricas/ranking/colaboradores";
    const paramsBase = { periodo: periodo.value };
    if (periodo.value === "custom" && dataInicio.value && dataFim.value) {
      paramsBase.dataInicio = dataInicio.value;
      paramsBase.dataFim = dataFim.value;
    }

    const carregarRanking = async (tipoSelecionado) => {
      const params = { ...paramsBase, tipo: tipoSelecionado || undefined };
      const { data } = await api.get(url, { params });
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
  await carregar();
});

watch([aba, periodo, tipo, dataInicio, dataFim], () => {
  if (periodo.value !== "custom" || (dataInicio.value && dataFim.value))
    carregar();
});

function medalha(i) {
  if (i === 0) return { ico: "trophy", cor: "#fbbf24" };
  if (i === 1) return { ico: "medal", cor: "#94a3b8" };
  if (i === 2) return { ico: "medal", cor: "#a16207" };
  return null;
}

const topItems = computed(() => items.value.slice(0, 3));
const itensRestantes = computed(() => items.value.slice(3));

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

function avatarStyle(item) {
  return item?.avatarUrl
    ? {
        backgroundImage: `url(${resolverUrlMidia(item.avatarUrl)})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {};
}

function iniciais(nome) {
  return (nome || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();
}

function detalhePodio(item) {
  if (aba.value === "lojas") {
    const local = [item.cidade, item.estado].filter(Boolean).join(" / ");
    return local || `Nivel ${item.nivel}`;
  }
  return `#${item.codigoExterno} · Nivel ${item.nivel}`;
}

function formatarItens(total) {
  return `${(total || 0).toLocaleString("pt-BR")} itens`;
}

function formatarPontos(total) {
  return `${Math.round(total || 0).toLocaleString("pt-BR")} pts`;
}

const tituloPodio = computed(() =>
  aba.value === "lojas" ? "Top Lojas" : "Top Colaboradores",
);

const subtituloPodio = computed(() => {
  const tipoLabel = tipo.value
    ? labelsTipo[tipo.value] || tipo.value
    : "Todos os tipos";
  const periodoLabel =
    periodo.value === "custom"
      ? `${dataInicio.value || "--"} a ${dataFim.value || "--"}`
      : labelsPeriodo[periodo.value] || periodo.value;

  return `Tipo: ${tipoLabel} · Período: ${periodoLabel}`;
});

const visualizacaoKey = computed(() => {
  const ids = items.value.map((item) => item._id).join("|");
  return `${aba.value}-${periodo.value}-${tipo.value}-${dataInicio.value}-${dataFim.value}-${ids}`;
});
</script>

<template>
  <div class="grid gap-3">
    <div class="row">
      <div class="tabs">
        <button
          :class="{ active: aba === 'colaboradores' }"
          @click="aba = 'colaboradores'"
        >
          <fa icon="users" /> Colaboradores
        </button>
        <button
          v-if="auth.isSuperAdmin"
          :class="{ active: aba === 'lojas' }"
          @click="aba = 'lojas'"
        >
          <fa icon="store" /> Lojas
        </button>
      </div>
      <span class="spacer" />
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
    </div>

    <Transition name="ranking-stage" mode="out-in">
      <Loader v-if="carregando" key="loading" />
      <div v-else :key="visualizacaoKey" class="grid gap-3 rankings-stage">
        <div v-if="!items.length" class="empty">
          Sem dados no período selecionado.
        </div>

        <template v-else-if="aba === 'colaboradores'">
          <section v-if="podiumCards.length" class="podium-section">
            <div class="podium-header">
              <div class="podium-headline">
                <h3 class="mt-0 mb-0">{{ tituloPodio }}</h3>
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
                <div class="podium-avatar" :style="avatarStyle(card.item)">
                  <span v-if="!card.item.avatarUrl">{{
                    iniciais(card.item.nome)
                  }}</span>
                </div>
                <div class="podium-name">{{ card.item.nome }}</div>
                <div class="podium-detail">{{ detalhePodio(card.item) }}</div>
                <div class="podium-chip">
                  <fa icon="chart-bar" />
                  <span>{{ formatarItens(card.item.totalLidos) }}</span>
                </div>
                <div class="podium-stats">
                  <strong>{{ card.item.taxaConformidade.toFixed(1) }}%</strong>
                  <span>{{ formatarPontos(card.item.pontuacao) }}</span>
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
                  <span class="muted" style="font-weight: 700"
                    >#{{ i + 4 }}</span
                  >
                </div>
                <div class="avatar">{{ (c.nome || "?").slice(0, 2) }}</div>
                <div style="flex: 1; min-width: 0">
                  <div style="font-weight: 600">
                    <RouterLink :to="`/colaboradores/${c._id}`">{{
                      c.nome
                    }}</RouterLink>
                    <span
                      class="muted"
                      style="
                        font-weight: 400;
                        margin-left: 8px;
                        font-size: 12px;
                      "
                      >#{{ c.codigoExterno }}</span
                    >
                  </div>
                  <div class="muted" style="font-size: 12px">
                    Nível {{ c.nivel }} ·
                    {{ c.totalLidos.toLocaleString("pt-BR") }} itens ·
                    {{ c.dias }} dias
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
                <div style="text-align: right; min-width: 80px">
                  <div style="font-size: 22px; font-weight: 700">
                    {{ Math.round(c.pontuacao) }}
                  </div>
                  <div class="muted" style="font-size: 11px">pontos</div>
                </div>
              </div>
            </div>
          </section>
        </template>

        <template v-else>
          <section v-if="podiumCards.length" class="podium-section">
            <div class="podium-header">
              <div class="podium-headline">
                <h3 class="mt-0 mb-0">{{ tituloPodio }}</h3>
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
                <StoreAvatar
                  :nome="card.item.nome"
                  :avatar-url="card.item.avatarUrl"
                  :size="92"
                  :font-size="30"
                  class="podium-avatar podium-avatar-store"
                />
                <div class="podium-name">{{ card.item.nome }}</div>
                <div class="podium-detail">{{ detalhePodio(card.item) }}</div>
                <div class="podium-chip">
                  <fa icon="chart-bar" />
                  <span>{{ formatarItens(card.item.totalLidos) }}</span>
                </div>
                <div class="podium-stats">
                  <strong>{{ card.item.taxaConformidade.toFixed(1) }}%</strong>
                  <span>{{ formatarPontos(card.item.pontuacao) }}</span>
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
                v-for="(l, i) in itensRestantes"
                :key="l._id"
                class="card row ranking-row ranking-reveal"
                style="padding: 14px 18px"
                :style="{ animationDelay: `${(i + 1) * 55}ms` }"
              >
                <div style="width: 40px; text-align: center">
                  <span class="muted" style="font-weight: 700"
                    >#{{ i + 4 }}</span
                  >
                </div>
                <StoreAvatar
                  :nome="l.nome"
                  :avatar-url="l.avatarUrl"
                  :size="36"
                  :font-size="13"
                />
                <div style="flex: 1; min-width: 0">
                  <div style="font-weight: 600">
                    {{ l.nome }}
                    <span
                      class="muted"
                      style="font-weight: 400; font-size: 12px"
                      >{{ l.cidade }} {{ l.estado ? "/" + l.estado : "" }}</span
                    >
                  </div>
                  <div class="muted" style="font-size: 12px">
                    Nível {{ l.nivel }} ·
                    {{ l.totalLidos.toLocaleString("pt-BR") }} itens
                  </div>
                </div>
                <div style="width: 130px">
                  <strong>{{ l.taxaConformidade.toFixed(1) }}%</strong>
                  <div class="progress mt-1">
                    <span
                      :style="{
                        width: Math.min(100, l.taxaConformidade) + '%',
                      }"
                    />
                  </div>
                </div>
                <div style="text-align: right; min-width: 100px">
                  <div style="font-size: 22px; font-weight: 700">
                    {{ Math.round(l.pontuacao) }}
                  </div>
                  <div class="muted" style="font-size: 11px">pontos</div>
                </div>
              </div>
            </div>
          </section>
        </template>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
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
  color: #b45309;
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
  width: 92px;
  height: 92px;
  margin: 14px auto 16px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: var(--grad-primary);
  color: white;
  font-size: 38px;
  font-weight: 800;
  text-transform: uppercase;
  box-shadow:
    0 0 0 4px rgba(255, 255, 255, 0.88),
    0 12px 30px rgba(0, 0, 0, 0.18);
}

.podium-avatar-store {
  font-size: 34px;
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
  background: rgba(255, 255, 255, 0.58);
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
    rgba(254, 240, 138, 0.72),
    rgba(255, 255, 255, 0.9)
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
    rgba(255, 237, 213, 0.92),
    rgba(255, 255, 255, 0.92)
  );
}

:global([data-theme="light"]) .podium-card.rank-1 .podium-rank {
  background: linear-gradient(
    180deg,
    rgba(255, 251, 235, 0.98),
    rgba(254, 240, 138, 0.95)
  );
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
  background: linear-gradient(
    180deg,
    rgba(255, 247, 237, 0.98),
    rgba(254, 215, 170, 0.95)
  );
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
