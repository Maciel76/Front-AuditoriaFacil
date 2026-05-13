<script setup>
import { onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

const auth = useAuthStore();
const ui = useUiStore();

onMounted(() => {
  if (auth.token) auth.carregarMe();
});
</script>

<template>
  <RouterView />
  <div class="toast-wrap">
    <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="t.tipo">
      <fa :icon="t.tipo === 'ok' ? 'check' : t.tipo === 'err' ? 'xmark' : 'circle-info'" />
      <span>{{ t.mensagem }}</span>
    </div>
  </div>
</template>
