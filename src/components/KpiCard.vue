<script setup>
import { computed } from 'vue';
import AnimatedNumber from './AnimatedNumber.vue';

const props = defineProps({
  label: String,
  value: [String, Number],
  delta: String,
  trend: String,
  icon: { type: String, default: 'gauge' },
  suffix: String,
  formatter: Function,
});

const valorAnimado = computed(() => typeof props.value === 'number' && Number.isFinite(props.value));
</script>
<template>
  <div class="kpi">
    <div class="ico"><fa :icon="icon" /></div>
    <div class="label">{{ label }}</div>
    <div class="value"><AnimatedNumber v-if="valorAnimado" :value="Number(value)" :formatter="formatter" :duration="420" /><template v-else>{{ value }}</template><small v-if="suffix" style="font-size:14px; color: var(--text-dim); margin-left: 4px;">{{ suffix }}</small></div>
    <div v-if="delta" class="delta" :class="trend">
      <fa :icon="trend === 'up' ? 'arrow-trend-up' : 'arrow-trend-down'" /> {{ delta }}
    </div>
  </div>
</template>
