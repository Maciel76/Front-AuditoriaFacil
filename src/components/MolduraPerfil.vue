<script setup>
import { computed, useId, ref, watch } from "vue";
const props = defineProps({ moldura: { type: Object, default: null } });
const gradienteId = `moldura-orbital-${useId()}`;
const animada = computed(() => props.moldura?.codigo === "moldura-neon-orbital");
const elementoAnimado = ref(null);
const tamanho = ref({ largura: 1000, altura: 400 });
watch(elementoAnimado, (elemento, anterior, limpar) => {
  if (!elemento) return;
  const atualizar = () => {
    tamanho.value = { largura: elemento.clientWidth, altura: elemento.clientHeight };
  };
  atualizar();
  const observer = new ResizeObserver(atualizar);
  observer.observe(elemento);
  limpar(() => observer.disconnect());
});
const borda = computed(() => {
  const moldura = props.moldura;
  if (!moldura) return null;
  if (moldura.codigo === "moldura-neon-amarela") {
    return { borderImageSource: "url('/images/molduras/neon-amarela.png')", borderImageSlice: "300", borderBlockWidth: "var(--moldura-espessura)" };
  }
  if (moldura.codigo === "moldura-neon-rosa") {
    return { borderImageSource: "url('/images/molduras/neon-rosa.png')", borderImageSlice: "280 300", borderBlockWidth: "calc(var(--moldura-espessura) * 280 / 300)" };
  }
  if (moldura.codigo === "moldura-neon-imperial") {
    return { borderImageSource: "url('/images/molduras/neon-imperial.png')", borderImageSlice: "200 240", borderBlockWidth: "calc(var(--moldura-espessura) * 200 / 240)" };
  }
  if (moldura.codigo === "moldura-neon-roxo-ciano") {
    return { borderImageSource: "url('/images/molduras/neon-roxo-ciano.svg')", borderImageSlice: "180 200", borderBlockWidth: "calc(var(--moldura-espessura) * 180 / 200)" };
  }
  if (!/^\/images\/molduras\/conquista-[a-z-]+\.svg$/.test(moldura.imagemUrl || "")) return null;
  return { borderImageSource: `url('${moldura.imagemUrl}')`, borderImageSlice: "100" };
});
</script>

<template>
  <span v-if="animada" ref="elementoAnimado" class="moldura-orbital" aria-hidden="true">
    <svg :viewBox="`0 0 ${tamanho.largura} ${tamanho.altura}`" focusable="false">
      <defs>
        <linearGradient :id="gradienteId" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#c084fc" />
          <stop offset=".45" stop-color="#7c3aed" />
          <stop offset=".7" stop-color="#22d3ee" />
          <stop offset="1" stop-color="#a5f3fc" />
        </linearGradient>
      </defs>
      <rect class="orbital-base" x="8" y="8" :width="Math.max(0, tamanho.largura - 16)" :height="Math.max(0, tamanho.altura - 16)" rx="24" :stroke="`url(#${gradienteId})`" />
      <rect class="orbital-inner" x="15" y="15" :width="Math.max(0, tamanho.largura - 30)" :height="Math.max(0, tamanho.altura - 30)" rx="20" />
      <rect class="orbital-trail orbital-purple" x="8" y="8" :width="Math.max(0, tamanho.largura - 16)" :height="Math.max(0, tamanho.altura - 16)" rx="24" pathLength="100" />
      <rect class="orbital-trail orbital-cyan" x="8" y="8" :width="Math.max(0, tamanho.largura - 16)" :height="Math.max(0, tamanho.altura - 16)" rx="24" pathLength="100" />
      <g class="orbital-gems" :fill="`url(#${gradienteId})`" stroke="#e0f2fe" stroke-width="1.5">
        <path v-for="(coin, index) in [[24, 24], [tamanho.largura - 24, 24], [24, tamanho.altura - 24], [tamanho.largura - 24, tamanho.altura - 24]]" :key="index" :transform="`translate(${coin[0]} ${coin[1]})`" d="M0-10 10 0 0 10-10 0Z" />
      </g>
    </svg>
  </span>
  <span v-else-if="borda" class="moldura-perfil" :style="borda" aria-hidden="true" />
</template>

<style scoped>
.moldura-perfil {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  --moldura-espessura: clamp(30px, 5vw, 44px);
  border: var(--moldura-espessura) solid transparent;
  border-image-repeat: repeat;
}
.moldura-orbital {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  border-radius: inherit;
}
.moldura-orbital svg { display: block; width: 100%; height: 100%; overflow: visible; }
.moldura-orbital rect { fill: none; vector-effect: non-scaling-stroke; }
.orbital-base { stroke-width: 5; opacity: .8; }
.orbital-inner { stroke: #a78bfa; stroke-width: 1; opacity: .45; }
.orbital-trail { stroke-width: 4; stroke-linecap: round; stroke-dasharray: 8 92; animation: orbital-circuit 6s linear infinite; }
.orbital-purple { stroke: #e9d5ff; filter: drop-shadow(0 0 5px #a855f7); }
.orbital-cyan { stroke: #cffafe; filter: drop-shadow(0 0 5px #22d3ee); animation-delay: -3s; }
.orbital-gems { animation: orbital-pulse 3s ease-in-out infinite alternate; }
@keyframes orbital-circuit { to { stroke-dashoffset: -100; } }
@keyframes orbital-pulse { from { opacity: .6; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .orbital-trail, .orbital-gems { animation: none; }
  .orbital-cyan { stroke-dashoffset: -50; }
}
</style>
