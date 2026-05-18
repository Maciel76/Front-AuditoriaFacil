<script setup>
import { computed, ref, watch } from 'vue';
import { resolverUrlMidia } from '@/utils/media';

const props = defineProps({
  nome: { type: String, default: '' },
  avatarUrl: { type: String, default: '' },
  size: { type: Number, default: 36 },
  fontSize: { type: Number, default: 13 },
});

const falhouCarregamento = ref(false);

const urlAvatar = computed(() => resolverUrlMidia(props.avatarUrl));

watch(urlAvatar, () => {
  falhouCarregamento.value = false;
});

const possuiImagem = computed(() => !!urlAvatar.value && !falhouCarregamento.value);

const estilo = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${props.fontSize}px`,
}));

const iniciais = computed(() =>
  (props.nome || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase(),
);

function marcarFalha() {
  falhouCarregamento.value = true;
}
</script>

<template>
  <div class="avatar colaborador-avatar" :style="estilo">
    <img
      v-if="possuiImagem"
      :src="urlAvatar"
      :alt="nome ? `Foto do colaborador ${nome}` : 'Foto do colaborador'"
      class="colaborador-avatar-image"
      @error="marcarFalha"
    />
    <span v-else class="colaborador-avatar-fallback">{{ iniciais }}</span>
  </div>
</template>

<style scoped>
.colaborador-avatar {
  position: relative;
  overflow: hidden;
  background: var(--grad-primary);
}

.colaborador-avatar-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.colaborador-avatar-fallback {
  line-height: 1;
}
</style>