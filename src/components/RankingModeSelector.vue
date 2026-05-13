<script setup>
import { computed } from "vue";

const props = defineProps({
  modelValue: { type: String, required: true },
  modos: { type: Array, required: true },
});
defineEmits(["update:modelValue"]);

// Agrupa modos por categoria para popular um <optgroup> e tornar a lista
// legível mesmo com muitos rankings disponíveis.
const grupos = computed(() => {
  const map = new Map();
  for (const modo of props.modos) {
    const grupo = modo.grupo || "Outros";
    if (!map.has(grupo)) map.set(grupo, []);
    map.get(grupo).push(modo);
  }
  return [...map.entries()].map(([nome, itens]) => ({ nome, itens }));
});
</script>

<template>
  <select
    class="btn ghost ranking-mode-select"
    :value="modelValue"
    @change="$emit('update:modelValue', $event.target.value)"
    aria-label="Tipo de ranking"
  >
    <optgroup v-for="grupo in grupos" :key="grupo.nome" :label="grupo.nome">
      <option v-for="modo in grupo.itens" :key="modo.id" :value="modo.id">
        {{ modo.label }}
      </option>
    </optgroup>
  </select>
</template>

<style scoped>
.ranking-mode-select {
  padding: 8px 14px;
  min-width: 230px;
}
</style>
