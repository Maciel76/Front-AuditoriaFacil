<script setup>
import { onMounted, onBeforeUnmount, ref } from "vue";
import { carregarLottie } from "@/utils/lottiePlayer";

const props = defineProps({ codigo: { type: String, required: true } });
const capas = {
  "fundo-copa-2026": () => import("@/assets/animations/capa-copa-2026.json"),
  "fundo-natal": () => import("@/assets/animations/capa-natal.json"),
};
const container = ref(null);
let animacao, movimento, observador;
let encerrado = false;
let naTela = true;
function atualizar() {
  if (!animacao?.isLoaded) return;
  if (movimento.matches) animacao.goToAndStop(0, true);
  else if (document.hidden || !naTela) animacao.pause();
  else animacao.play();
}
onMounted(async () => {
  movimento = window.matchMedia("(prefers-reduced-motion: reduce)");
  movimento.addEventListener("change", atualizar);
  document.addEventListener("visibilitychange", atualizar);
  observador = new IntersectionObserver(([entry]) => { naTela = entry.isIntersecting; atualizar(); });
  observador.observe(container.value);
  try {
    const [lottie, arquivo] = await Promise.all([carregarLottie(), capas[props.codigo]()]);
    if (encerrado) return;
    animacao = lottie.loadAnimation({ container: container.value, renderer: "svg", loop: true, autoplay: false,
      animationData: structuredClone(arquivo.default), rendererSettings: { preserveAspectRatio: "xMidYMid slice" } });
    animacao.addEventListener("DOMLoaded", atualizar);
    atualizar();
  } catch { /* O fundo base permanece visível se a animação não carregar. */ }
});
onBeforeUnmount(() => {
  encerrado = true;
  observador?.disconnect();
  animacao?.destroy();
  movimento?.removeEventListener("change", atualizar);
  document.removeEventListener("visibilitychange", atualizar);
});
</script>

<template>
  <div class="fundo-animado capa-copa" aria-hidden="true"><div ref="container" class="capa-copa-player" /></div>
</template>

<style scoped>
.capa-copa-player { width: 100%; height: 100%; opacity: .4; }
.capa-copa::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, color-mix(in srgb, var(--bg-1) 75%, transparent), color-mix(in srgb, var(--bg-1) 20%, transparent)); }
</style>
