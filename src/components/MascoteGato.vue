<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { carregarLottie } from "@/utils/lottiePlayer";

const props = defineProps({
  previa: { type: Boolean, default: false },
  codigo: { type: String, default: "mascote-gato" },
});
const mascotes = {
  "mascote-fogo": { nome: "Foguinho", carregar: () => import("@/assets/animations/mascote-fogo.json") },
  "mascote-gato-chorando": { nome: "Gatinho Chorão", carregar: () => import("@/assets/animations/mascote-gato-chorando.json") },
  "mascote-foguete": { nome: "Foguete Explorador", carregar: () => import("@/assets/animations/mascote-foguete.json") },
  "mascote-panda": { nome: "Panda Brincalhão", carregar: () => import("@/assets/animations/mascote-panda.json") },
  "mascote-coelho": { nome: "Coelhinho Flutuante", carregar: () => import("@/assets/animations/mascote-coelho.json") },
  "mascote-dragao": { nome: "Dragãozinho Caminhante", carregar: () => import("@/assets/animations/mascote-dragao.json") },
  "mascote-capivara": { nome: "Capivara Zen", carregar: () => import("@/assets/animations/mascote-capivara.json") },
  "mascote-totoro": { nome: "Totoro Caminhante", carregar: () => import("@/assets/animations/totoro-walk.json") },
  "mascote-cachorro": { nome: "Cachorrinho Feliz", carregar: () => import("@/assets/animations/cachorrinho-feliz.json") },
  "mascote-robo": { nome: "Robozinho Faísca", carregar: () => import("@/assets/animations/mascote-robo.json") },
  "mascote-raposa": { nome: "Raposa Astuta", enquadramento: "170 120 172 270", carregar: () => import("@/assets/animations/mascote-raposa.json") },
  "mascote-pinguim": { nome: "Pinguim Geladinho", carregar: () => import("@/assets/animations/mascote-pinguim.json") },
  "mascote-astronauta": { nome: "Astro, o Explorador", enquadramento: "100 100 400 400", carregar: () => import("@/assets/animations/mascote-astronauta.json") },
  "mascote-gato": { nome: "Gatinho Companheiro", carregar: () => import("@/assets/animations/loader-cat.json") },
  "mascote-saltitante": { nome: "Mascote Saltitante", carregar: () => import("@/assets/animations/mascote-saltitante.json") },
};
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
  if (!props.previa) temporizador = setTimeout(() => alternar(!mostrar), mostrar ? 7000 : 10000);
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
      carregarLottie(), mascotes[props.codigo].carregar(),
    ]);
    if (encerrado) return;
    animacao = lottie.loadAnimation({
      container: container.value,
      renderer: "svg",
      loop: true,
      autoplay: false,
      animationData: structuredClone(arquivo.default),
      rendererSettings: { preserveAspectRatio: "xMidYMid meet", viewBoxSize: mascotes[props.codigo].enquadramento },
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
  <div class="mascote-gato" :data-visivel="visivel && !falhou">
    <div ref="container" class="mascote-gato-player" :class="{ visivel: visivel && !falhou }" :aria-hidden="!visivel || falhou" role="img" :aria-label="mascotes[codigo]?.nome || 'Mascote'" />
    <div v-if="$slots.fallback" class="mascote-fallback" :class="{ visivel: !visivel || falhou }" :aria-hidden="visivel && !falhou"><slot name="fallback" /></div>
    <small v-if="falhou && previa" class="muted">Prévia indisponível</small>
  </div>
</template>

<style scoped>
.mascote-gato { position: relative; width: 140px; height: 100px; max-width: 100%; margin-left: auto; pointer-events: none; }
.mascote-fallback { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; transform: scale(.88); transition: opacity .5s ease, transform .5s ease; }
.mascote-fallback.visivel { opacity: 1; transform: scale(1); }
.mascote-gato-player { width: 100%; height: 100%; opacity: 0; transform: scale(.88); transition: opacity .5s ease, transform .5s ease; }
.mascote-gato-player.visivel { opacity: 1; transform: scale(var(--mascote-escala, 1)); }
@media (prefers-reduced-motion: reduce) { .mascote-gato-player, .mascote-fallback { transition: none; } }
</style>
