<script setup>
import { computed } from "vue";
import { calcularMedia, metaBatida } from "@/utils/rankingModes";

const props = defineProps({
  items: { type: Array, required: true },
  modo: { type: Object, required: true },
  // Limiar (em %) para considerar meta de auditoria batida (restante <= limiar)
  metaPercentualRestante: { type: Number, default: 2 },
  // Texto auxiliar exibido no rodapé do card (ex.: "10 lojas").
  contextoLabel: { type: String, default: "" },
});

const media = computed(() => calcularMedia(props.items, props.modo));
const mediaFormatada = computed(() => {
  if (media.value == null) return "—";
  return props.modo.format ? props.modo.format(media.value) : String(media.value);
});

const metasAtingidas = computed(
  () =>
    (props.items || []).filter((item) =>
      metaBatida(item, props.metaPercentualRestante),
    ).length,
);

// Mostra a contagem de meta só quando alguma das ordenações analíticas
// referentes a conclusão/restante tem dados disponíveis.
const temDadosMeta = computed(() =>
  (props.items || []).some((item) => item?.percentualRestante != null),
);
</script>

<template>
  <section class="ranking-summary card" aria-live="polite">
    <div class="ranking-summary-main">
      <div class="ranking-summary-label">
        <fa icon="chart-line" />
        <span>Média do ranking</span>
      </div>
      <div class="ranking-summary-value">{{ mediaFormatada }}</div>
      <div class="ranking-summary-modo">{{ modo.label }}</div>
    </div>

    <div v-if="temDadosMeta" class="ranking-summary-meta">
      <div class="meta-pill" :class="{ ok: metasAtingidas > 0 }">
        <fa icon="bullseye" />
        <span>
          <strong>{{ metasAtingidas }}</strong>
          /
          {{ (items || []).length }}
        </span>
        bateram a meta
      </div>
      <div class="muted meta-helper">
        Meta: restante ≤ {{ metaPercentualRestante }}% para concluir
      </div>
    </div>

    <div v-if="contextoLabel" class="ranking-summary-ctx muted">
      {{ contextoLabel }}
    </div>
  </section>
</template>

<style scoped>
.ranking-summary {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: linear-gradient(
    180deg,
    rgba(99, 102, 241, 0.14),
    rgba(99, 102, 241, 0.04)
  );
}

.ranking-summary-main {
  display: grid;
  gap: 4px;
}

.ranking-summary-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-dim);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
}

.ranking-summary-value {
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
}

.ranking-summary-modo {
  color: var(--text-dim);
  font-size: 13px;
}

.ranking-summary-meta {
  display: grid;
  justify-items: end;
  gap: 4px;
  text-align: right;
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-weight: 700;
  font-size: 13px;
}

.meta-pill.ok {
  background: rgba(34, 197, 94, 0.18);
  border-color: rgba(34, 197, 94, 0.42);
  color: #bbf7d0;
}

:global([data-theme="light"]) .meta-pill.ok {
  color: #166534;
}

.meta-pill strong {
  font-size: 16px;
  color: var(--text);
}

.meta-helper {
  font-size: 11px;
}

.ranking-summary-ctx {
  grid-column: 1 / -1;
  font-size: 12px;
}

@media (max-width: 600px) {
  .ranking-summary {
    grid-template-columns: 1fr;
  }
  .ranking-summary-meta {
    justify-items: start;
    text-align: left;
  }
}
</style>
