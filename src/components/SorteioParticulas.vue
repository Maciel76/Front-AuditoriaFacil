<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { carregarLottie } from '@/utils/lottiePlayer';

const container = ref(null);
let animacao;
let movimento;
let encerrado = false;

function atualizar() {
  if (!animacao?.isLoaded) return;
  if (movimento.matches) animacao.goToAndStop(0, true);
  else if (document.hidden) animacao.pause();
  else animacao.play();
}

onMounted(async () => {
  movimento = window.matchMedia('(prefers-reduced-motion: reduce)');
  movimento.addEventListener('change', atualizar);
  document.addEventListener('visibilitychange', atualizar);
  try {
    const [lottie, arquivo] = await Promise.all([
      carregarLottie(),
      import('@/assets/animations/sorteio-confeti.json'),
    ]);
    if (encerrado) return;
    const dados = structuredClone(arquivo.default);
    // O arquivo enviado já possui os dois canhões espelhados. Mantém apenas
    // os laterais para abrir a celebração em volta do card do vencedor.
    dados.layers = dados.layers.filter(layer =>
      ['cannon (small - left)', 'cannon (small - right)'].includes(layer.nm),
    );
    animacao = lottie.loadAnimation({
      container: container.value,
      renderer: 'svg',
      loop: true,
      autoplay: false,
      animationData: dados,
      rendererSettings: { preserveAspectRatio: 'none', focusable: false },
    });
    animacao.addEventListener('DOMLoaded', atualizar);
    atualizar();
  } catch {
    // A celebração em CSS continua disponível se o player não carregar.
  }
});

onBeforeUnmount(() => {
  encerrado = true;
  animacao?.destroy();
  movimento?.removeEventListener('change', atualizar);
  document.removeEventListener('visibilitychange', atualizar);
});
</script>

<template>
  <div class="sorteio-particulas" aria-hidden="true"><div ref="container" class="sorteio-particulas-player" /></div>
</template>

<style scoped>
.sorteio-particulas { position: absolute; inset: 0; z-index: 1; pointer-events: none; overflow: hidden; }
.sorteio-particulas-player { width: 100%; height: 100%; filter: drop-shadow(0 0 5px #f6cd7a55); }
.sorteio-particulas-player :deep(svg) { display: block; width: 100%; height: 100%; }
@media (prefers-reduced-motion: reduce) { .sorteio-particulas { display: none; } }
</style>
