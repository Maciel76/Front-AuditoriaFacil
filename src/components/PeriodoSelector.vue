<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '1d' },
  dataInicio:  { type: String, default: '' },
  dataFim:     { type: String, default: '' },
  loading:     { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'update:dataInicio', 'update:dataFim']);

const opcoes = [
  { v: '1d',     l: 'Hoje' },
  { v: 'semana', l: 'Semana' },
  { v: 'mes',    l: 'Mês' },
  { v: 'ano',    l: 'Ano' },
  { v: 'tudo',   l: 'Histórico' },
  { v: 'custom', l: 'Período' },
];

const valor = computed({
  get: () => props.modelValue || '1d',
  set: (v) => emit('update:modelValue', v),
});

const transicaoKey = computed(() => `${valor.value}-${props.dataInicio}-${props.dataFim}`);

const dInicio = ref(props.dataInicio || hoje());
const dFim    = ref(props.dataFim    || hoje());

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

watch(dInicio, (v) => emit('update:dataInicio', v));
watch(dFim,    (v) => emit('update:dataFim', v));
watch(() => props.dataInicio, (v) => { if (v) dInicio.value = v; });
watch(() => props.dataFim,    (v) => { if (v) dFim.value    = v; });
</script>

<template>
  <div class="periodo-wrap">
    <div class="tabs tabs-animadas">
      <button
        v-for="o in opcoes"
        :key="o.v"
        :class="{ active: valor === o.v }"
        @click="valor = o.v"
      >{{ o.l }}</button>
    </div>

    <Transition name="periodo-panel" mode="out-in">
      <div v-if="valor === 'custom'" :key="transicaoKey" class="date-range card-range">
        <input type="date" :value="dInicio" @change="dInicio = $event.target.value" class="date-inp" />
        <span class="muted">→</span>
        <input type="date" :value="dFim"    @change="dFim    = $event.target.value" class="date-inp" />
      </div>
    </Transition>

    <Transition name="periodo-panel">
      <span v-if="loading" class="periodo-loading">
        Atualizando
        <span class="periodo-dot" style="animation-delay: 0s">.</span>
        <span class="periodo-dot" style="animation-delay: .2s">.</span>
        <span class="periodo-dot" style="animation-delay: .4s">.</span>
      </span>
    </Transition>
  </div>
</template>

<style scoped>
.periodo-wrap { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

.tabs-animadas {
  position: relative;
  overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
}

.tabs-animadas button {
  position: relative;
  transition: transform .18s ease, color .18s ease, background-color .22s ease, box-shadow .22s ease;
}

.tabs-animadas button:hover {
  transform: translateY(-1px);
}

.tabs-animadas button.active {
  animation: pulseTab .28s ease;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-range {
  padding: 8px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: linear-gradient(180deg, var(--surface), rgba(255,255,255,.02));
  box-shadow: var(--shadow-sm);
}

.date-inp {
  background: var(--surface-strong);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  padding: 7px 12px;
  color: var(--text);
  font-size: 13px;
  font-family: inherit;
  transition: border-color .2s ease, box-shadow .2s ease, transform .16s ease, background-color .2s ease;
}

.date-inp:hover {
  transform: translateY(-1px);
}

.date-inp:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(124,92,255,.16);
}

.periodo-panel-enter-active,
.periodo-panel-leave-active {
  transition: opacity .24s ease, transform .24s ease, filter .24s ease;
}

.periodo-panel-enter-from,
.periodo-panel-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(.985);
  filter: blur(4px);
}

@keyframes pulseTab {
  0% { transform: scale(.96); }
  70% { transform: scale(1.02); }
  100% { transform: scale(1); }
}

.periodo-loading {
  font-size: 12px;
  color: var(--text-dim);
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.periodo-dot {
  animation: periodoDotPulse 1.4s ease-in-out infinite;
  font-weight: 700;
}

@keyframes periodoDotPulse {
  0%, 80%, 100% { opacity: 0.2; }
  40% { opacity: 1; }
}

@media (max-width: 700px) {
  .periodo-wrap {
    align-items: stretch;
  }

  .card-range {
    width: 100%;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .date-inp {
    flex: 1 1 150px;
  }
}
</style>
