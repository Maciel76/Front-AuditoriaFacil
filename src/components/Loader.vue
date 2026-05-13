<script setup>
defineProps({ rows: { type: Number, default: 4 } });
</script>
<template>
  <div class="grid">
    <div v-for="i in rows" :key="i" class="skeleton" :style="{ height: '38px' }" />
  </div>
</template>
