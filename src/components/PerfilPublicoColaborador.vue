<script setup>
import { computed } from "vue";
import AppChart from "@/components/AppChart.vue";
import ColaboradorAvatar from "@/components/ColaboradorAvatar.vue";
import Loader from "@/components/Loader.vue";

const props = defineProps({
  carregando: { type: Boolean, default: false },
  erro: { type: String, default: "" },
  perfil: { type: Object, default: () => null },
  colegaResumo: { type: Object, default: () => null },
});

const corPorTipo = {
  ETIQUETA: "#7c5cff",
  PRESENCA: "#22d3ee",
  RUPTURA: "#f59e0b",
};

const tierInfo = {
  comum: { label: "Comum", cor: "#94a3b8" },
  raro: { label: "Raro", cor: "#3b82f6" },
  epico: { label: "Épico", cor: "#a855f7" },
  lendario: { label: "Lendário", cor: "#f59e0b" },
  mitico: { label: "Mítico", cor: "#ef4444" },
};

const labelPorTipo = {
  ETIQUETA: "Etiqueta",
  PRESENCA: "Presença",
  RUPTURA: "Ruptura",
};

const colaborador = computed(
  () => props.perfil?.colaborador || props.colegaResumo || null,
);

const porTipo = computed(() => props.perfil?.porTipo || []);
const serie = computed(() => props.perfil?.serie || []);

const conquistasDesbloqueadas = computed(() =>
  (props.perfil?.conquistas || [])
    .filter((conquista) => conquista.desbloqueada)
    .map((conquista) => {
      const tierSlug = normalizarTier(conquista.tierAtual);
      const tierAtual = tierInfo[tierSlug] || tierInfo.comum;

      return {
        ...conquista,
        tierSlug,
        tierLabel: conquista.tierAtualLabel || tierAtual.label,
        tierColor: conquista.tierAtualCor || tierAtual.cor,
      };
    }),
);

const resumoTipos = computed(() => {
  const mapa = new Map(porTipo.value.map((item) => [item._id, item]));

  return ["ETIQUETA", "PRESENCA", "RUPTURA"].map((tipo) => {
    const item = mapa.get(tipo) || {};
    const totalLidos = Number(item.totalLidos || 0);
    const totalConformes = Number(item.totalConformes || 0);
    const taxaConformidade =
      totalLidos > 0
        ? Number(((totalConformes / totalLidos) * 100).toFixed(1))
        : 0;

    return {
      tipo,
      label: labelPorTipo[tipo],
      totalLidos,
      pontuacao: Number(item.pontuacao || 0),
      taxaConformidade,
    };
  });
});

const temResumoTipos = computed(() =>
  resumoTipos.value.some((item) => item.totalLidos > 0),
);

const serieComoColunas = computed(() => serie.value.length <= 12);

const serieChart = computed(() => {
  if (!serie.value.length) return { labels: [], datasets: [] };

  const dias = [...new Set(serie.value.map((item) => item._id.dia))].sort();
  const datasets = ["ETIQUETA", "PRESENCA", "RUPTURA"]
    .map((tipo) => {
      const mapa = new Map();
      serie.value
        .filter((item) => item._id.tipo === tipo)
        .forEach((item) =>
          mapa.set(item._id.dia, Number(item.totalLidos || 0)),
        );

      const data = dias.map((dia) => mapa.get(dia) ?? null);
      const possuiDados = data.some((valor) => Number(valor || 0) > 0);
      if (!possuiDados) return null;

      if (serieComoColunas.value) {
        return {
          label: labelPorTipo[tipo],
          data,
          backgroundColor: corPorTipo[tipo],
          borderColor: corPorTipo[tipo],
          borderRadius: 12,
          borderSkipped: false,
          maxBarThickness: 34,
        };
      }

      return {
        label: labelPorTipo[tipo],
        data,
        borderColor: corPorTipo[tipo],
        backgroundColor: `${corPorTipo[tipo]}33`,
        tension: 0.35,
        spanGaps: true,
        fill: true,
        pointRadius: 3,
        borderWidth: 2,
      };
    })
    .filter(Boolean);

  return {
    labels: dias.map((dia) => dia.slice(5)),
    datasets,
  };
});

const temSerie = computed(() => serieChart.value.datasets.length > 0);

const serieChartOptions = computed(() => ({
  plugins: {
    tooltip: {
      callbacks: {
        label: (context) =>
          `${context.dataset.label}: ${formatNum(
            context.raw ?? context.parsed?.y ?? 0,
          )} itens`,
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { precision: 0 },
    },
  },
}));

function formatNum(valor) {
  return Number(valor || 0).toLocaleString("pt-BR");
}

function formatPct(valor) {
  return `${Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
}

function normalizarTier(valor) {
  const tier = String(valor || "comum")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return tierInfo[tier] ? tier : "comum";
}
</script>

<template>
  <section class="perfil-publico-page">
    <header v-if="colaborador" class="perfil-publico-hero">
      <div class="perfil-publico-hero-main">
        <span class="perfil-publico-tag">
          <fa icon="users" /> Perfil da equipe
        </span>

        <div class="perfil-publico-hero-copy">
          <ColaboradorAvatar
            :nome="colaborador.nome"
            :avatar-url="colaborador.avatarUrl"
            :size="96"
            :font-size="30"
          />

          <div>
            <strong>{{ colaborador.nome }}</strong>
            <small class="muted">{{
              colaborador.cargo || "Equipe da loja"
            }}</small>
          </div>
        </div>
      </div>
    </header>

    <div v-if="carregando" class="perfil-publico-state card-state">
      <Loader />
      <span class="muted">Carregando perfil público...</span>
    </div>

    <div v-else-if="erro" class="perfil-publico-state card-state error">
      {{ erro }}
    </div>

    <div v-else-if="!perfil" class="perfil-publico-state card-state">
      Selecione um colega para ver os detalhes.
    </div>

    <div v-else class="perfil-publico-body">
      <section v-if="temResumoTipos" class="perfil-publico-section card-state">
        <div class="perfil-publico-section-head">
          <h4><fa icon="chart-line" /> Resultados por tipo</h4>
        </div>

        <div class="perfil-publico-tipos">
          <article
            v-for="item in resumoTipos"
            :key="item.tipo"
            class="perfil-publico-tipo-card"
            :style="{ '--tipo-cor': corPorTipo[item.tipo] }"
          >
            <span class="perfil-publico-tipo-label">{{ item.label }}</span>
            <strong>{{ formatNum(item.totalLidos) }} itens</strong>
            <small class="muted"
              >{{ formatPct(item.taxaConformidade) }} de conformidade</small
            >
            <span class="perfil-publico-tipo-xp">
              <fa icon="bolt" /> {{ formatNum(item.pontuacao) }} XP
            </span>
          </article>
        </div>
      </section>

      <section class="perfil-publico-section card-state">
        <div class="perfil-publico-section-head">
          <h4><fa icon="trophy" /> Conquistas desbloqueadas</h4>
          <span class="perfil-publico-counter">
            {{ formatNum(conquistasDesbloqueadas.length) }}
          </span>
        </div>

        <div
          v-if="!conquistasDesbloqueadas.length"
          class="perfil-publico-empty"
        >
          Este colega ainda está construindo a coleção de conquistas.
        </div>

        <div v-else class="perfil-publico-conquistas">
          <article
            v-for="conquista in conquistasDesbloqueadas"
            :key="conquista.codigo"
            class="perfil-publico-conquista"
            :class="`tier-${conquista.tierSlug}`"
            :style="{ '--tier-cor': conquista.tierColor }"
          >
            <div class="perfil-publico-conquista-icon">
              {{ conquista.icone || "🏅" }}
            </div>

            <div class="perfil-publico-conquista-copy">
              <span class="perfil-publico-conquista-tier">
                <span class="perfil-publico-conquista-tier-dot" />
                {{ conquista.tierLabel }}
              </span>
              <strong>{{ conquista.nome }}</strong>
              <small class="muted">
                {{ formatNum(conquista.totalTiersDesbloqueados || 0) }}/{{
                  formatNum(conquista.totalTiers || 0)
                }}
                tiers
              </small>
            </div>
          </article>
        </div>
      </section>

      <section v-if="temSerie" class="perfil-publico-section card-state">
        <div class="perfil-publico-section-head">
          <h4><fa icon="chart-bar" /> Histórico de leituras</h4>
        </div>

        <AppChart
          :type="serieComoColunas ? 'bar' : 'line'"
          :data="serieChart"
          :height="220"
          :options="serieChartOptions"
        />
      </section>
    </div>
  </section>
</template>

<style scoped>
.perfil-publico-page {
  display: grid;
  gap: 16px;
}

.perfil-publico-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #7c5cff;
  background: rgba(124, 92, 255, 0.12);
}

.perfil-publico-hero {
  border-radius: 28px;
  border: 1px solid var(--border);
  padding: 22px;
  background:
    radial-gradient(
      440px 220px at 0% 0%,
      rgba(124, 92, 255, 0.22),
      transparent 72%
    ),
    radial-gradient(
      420px 220px at 100% 0%,
      rgba(34, 211, 238, 0.14),
      transparent 70%
    ),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--surface-strong) 92%, transparent),
      color-mix(in srgb, var(--surface) 94%, transparent)
    );
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.1);
}

.perfil-publico-hero-main {
  display: grid;
  gap: 18px;
}

.perfil-publico-hero-copy {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 16px;
  align-items: center;
}

.perfil-publico-hero-copy strong {
  display: block;
  margin-bottom: 4px;
  font-size: clamp(1.2rem, 2vw, 1.7rem);
}

.perfil-publico-state {
  min-height: 220px;
  display: grid;
  place-items: center;
  gap: 12px;
  text-align: center;
}

.card-state {
  border-radius: 24px;
  border: 1px solid var(--border);
  padding: 20px;
  background: color-mix(in srgb, var(--surface-strong) 90%, transparent);
}

.perfil-publico-state.error,
.perfil-publico-empty {
  color: #f87171;
}

.perfil-publico-body {
  display: grid;
  gap: 18px;
}

.perfil-publico-card,
.perfil-publico-tipo-card,
.perfil-publico-conquista {
  border-radius: 22px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
}

.perfil-publico-section {
  display: grid;
  gap: 14px;
}

.perfil-publico-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.perfil-publico-section-head h4 {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.perfil-publico-counter {
  min-width: 34px;
  height: 34px;
  padding: 0 10px;
  border-radius: 999px;
  display: inline-grid;
  place-items: center;
  font-weight: 700;
  background: rgba(124, 92, 255, 0.12);
  color: #7c5cff;
}

.perfil-publico-tipos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.perfil-publico-tipo-card {
  padding: 18px;
  display: grid;
  gap: 6px;
  border-top: 3px solid var(--tipo-cor);
}

.perfil-publico-tipo-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--tipo-cor);
}

.perfil-publico-tipo-xp {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #f59e0b;
}

.perfil-publico-conquistas {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.perfil-publico-conquista {
  --tier-cor: #94a3b8;
  position: relative;
  overflow: hidden;
  padding: 16px;
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 12px;
  align-items: center;
  border-color: color-mix(in srgb, var(--tier-cor) 22%, var(--border));
  background:
    radial-gradient(
      circle at 0% 0%,
      color-mix(in srgb, var(--tier-cor) 24%, transparent),
      transparent 64%
    ),
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--surface) 84%, var(--tier-cor) 16%),
      color-mix(in srgb, var(--surface-strong) 92%, transparent)
    );
  box-shadow: 0 12px 28px color-mix(in srgb, var(--tier-cor) 12%, transparent);
}

.perfil-publico-conquista-icon {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  font-size: 24px;
  color: #fff;
  background: linear-gradient(
    135deg,
    var(--tier-cor),
    color-mix(in srgb, var(--tier-cor) 58%, #000)
  );
  box-shadow: 0 10px 24px color-mix(in srgb, var(--tier-cor) 34%, transparent);
}

.perfil-publico-conquista-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.perfil-publico-conquista-tier {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--tier-cor);
}

.perfil-publico-conquista-tier-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tier-cor);
  box-shadow: 0 0 12px color-mix(in srgb, var(--tier-cor) 45%, transparent);
}

.perfil-publico-conquista-copy strong {
  font-size: 14px;
}

.perfil-publico-conquista-copy .muted {
  color: color-mix(in srgb, var(--text-dim) 88%, var(--tier-cor) 12%);
}

.perfil-publico-empty {
  padding: 18px;
  border-radius: 18px;
  border: 1px dashed var(--border);
  text-align: center;
  background: color-mix(in srgb, var(--surface) 76%, transparent);
}

@media (max-width: 720px) {
  .perfil-publico-hero,
  .card-state {
    padding: 16px;
  }

  .perfil-publico-hero {
    border-radius: 24px;
  }

  .perfil-publico-hero-copy {
    grid-template-columns: 1fr;
    justify-items: start;
  }

  .perfil-publico-summary,
  .perfil-publico-tipos,
  .perfil-publico-conquistas {
    grid-template-columns: 1fr;
  }
}
</style>
