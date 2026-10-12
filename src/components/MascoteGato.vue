<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { carregarLottie } from "@/utils/lottiePlayer";

const props = defineProps({ previa: { type: Boolean, default: false } });
const container = ref(null);
const visivel = ref(false);
const falhou = ref(false);
let animacao;
let temporizador;
let encerrado = false;
let movimentoReduzido;

function parar() {
  clearTimeout(temporizador);
  animacao?.pause();
}

function alternar(mostrar) {
  parar();
  if (encerrado || document.hidden || !animacao?.isLoaded) return;
  visivel.value = mostrar;
  if (movimentoReduzido.matches) {
    visivel.value = true;
    animacao.goToAndStop(0, true);
    return;
  }
  if (mostrar) animacao.goToAndPlay(0, true);
  if (!props.previa) temporizador = setTimeout(() => alternar(!mostrar), mostrar ? 5000 : 10000);
}

function retomar() {
  if (document.hidden) parar();
  else alternar(true);
}

onMounted(async () => {
  movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)");
  movimentoReduzido.addEventListener("change", retomar);
  document.addEventListener("visibilitychange", retomar);
  try {
    const [lottie, arquivo] = await Promise.all([
      carregarLottie(), import("@/assets/animations/loader-cat.json"),
    ]);
    if (encerrado) return;
    animacao = lottie.loadAnimation({
      container: container.value,
      renderer: "svg",
      loop: true,
      autoplay: false,
      animationData: structuredClone(arquivo.default),
      rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
    });
    animacao.addEventListener("DOMLoaded", retomar);
    animacao.addEventListener("data_failed", () => { falhou.value = true; parar(); });
    if (animacao.isLoaded) retomar();
  } catch {
    if (!encerrado) falhou.value = true;
  }
});

onBeforeUnmount(() => {
  encerrado = true;
  parar();
  animacao?.destroy();
  movimentoReduzido?.removeEventListener("change", retomar);
  document.removeEventListener("visibilitychange", retomar);
});
</script>

<template>
  <div class="mascote-gato" :data-visivel="visivel && !falhou" :aria-hidden="!visivel || falhou">
    <div ref="container" class="mascote-gato-player" :class="{ visivel: visivel && !falhou }" role="img" aria-label="Gatinho Companheiro" />
    <small v-if="falhou && previa" class="muted">Prévia indisponível</small>
  </div>
</template>

<style scoped>
.mascote-gato { width: 140px; height: 100px; max-width: 100%; margin-left: auto; pointer-events: none; }
.mascote-gato-player { width: 100%; height: 100%; opacity: 0; transition: opacity .35s; }
.mascote-gato-player.visivel { opacity: 1; }
@media (prefers-reduced-motion: reduce) { .mascote-gato-player { transition: none; } }
</style>
