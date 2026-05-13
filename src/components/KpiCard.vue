<script setup>
defineProps({ label: String, value: [String, Number], delta: String, trend: String, icon: { type: String, default: 'gauge' }, suffix: String });
</script>
<template>
  <div class="kpi">
    <div class="ico"><fa :icon="icon" /></div>
    <div class="label">{{ label }}</div>
    <div class="value">{{ value }}<small v-if="suffix" style="font-size:14px; color: var(--text-dim); margin-left: 4px;">{{ suffix }}</small></div>
    <div v-if="delta" class="delta" :class="trend">
      <fa :icon="trend === 'up' ? 'arrow-trend-up' : 'arrow-trend-down'" /> {{ delta }}
    </div>
  </div>
</template>
