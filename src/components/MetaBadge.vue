<script setup>
defineProps({
  size: { type: String, default: "md" }, // sm | md
  title: { type: String, default: "Meta de auditoria batida" },
});
</script>

<template>
  <!-- <span
    class="meta-badge"
    :class="`meta-badge-${size}`"
    :title="title"
    aria-label="Meta batida"
  >
    <fa icon="bullseye" />
    <span>Meta batida</span>
  </span> -->
</template>

<style scoped>
.meta-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.16);
  border: 1px solid rgba(34, 197, 94, 0.4);
  color: #bbf7d0;
  font-weight: 800;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.meta-badge-sm {
  padding: 3px 8px;
  font-size: 10px;
}

:global([data-theme="light"]) .meta-badge {
  color: #166534;
  background: rgba(187, 247, 208, 0.7);
}
</style>
