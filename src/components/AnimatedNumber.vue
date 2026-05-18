<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps({
  value: { type: Number, default: 0 },
  duration: { type: Number, default: 440 },
  formatter: {
    type: Function,
    default: (valor) => Number(valor || 0).toLocaleString('pt-BR', {
      maximumFractionDigits: Number.isInteger(valor) ? 0 : 1,
    }),
  },
});

const exibido = ref(Number(props.value || 0));
let animacaoId = 0;

function cancelarAnimacao() {
  if (!animacaoId) return;
  cancelAnimationFrame(animacaoId);
  animacaoId = 0;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function animarPara(proximoValor) {
  cancelarAnimacao();

  const destino = Number(proximoValor || 0);
  if (!Number.isFinite(destino)) {
    exibido.value = 0;
    return;
  }

  const origem = Number(exibido.value || 0);
  if (origem === destino || props.duration <= 0) {
    exibido.value = destino;
    return;
  }

  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    exibido.value = destino;
    return;
  }

  const inicio = performance.now();
  const diferenca = destino - origem;

  const passo = (agora) => {
    const progresso = Math.min((agora - inicio) / props.duration, 1);
    exibido.value = origem + (diferenca * easeOutCubic(progresso));

    if (progresso < 1) {
      animacaoId = requestAnimationFrame(passo);
      return;
    }

    exibido.value = destino;
    animacaoId = 0;
  };

  animacaoId = requestAnimationFrame(passo);
}

watch(() => props.value, animarPara, { immediate: true });

onBeforeUnmount(cancelarAnimacao);

const texto = computed(() => props.formatter(exibido.value));
</script>

<template>
  <span>{{ texto }}</span>
</template>