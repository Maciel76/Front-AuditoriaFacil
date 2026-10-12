<script setup>
import { computed } from "vue";
import CapaLottie from "@/components/CapaLottie.vue";

const props = defineProps({ fundo: { type: Object, default: null } });
const efeitos = {
  "fundo-aurora": "aurora", "fundo-nebulosa": "nebulosa", "fundo-dourado": "dourado",
  "fundo-estrelas": "estrelas", "fundo-oceano": "oceano", "fundo-matrix": "matrix",
  "fundo-crepusculo": "crepusculo", "fundo-chamas": "chamas", "fundo-prisma": "prisma",
};
const efeito = computed(() => efeitos[props.fundo?.codigo]);
</script>

<template>
  <CapaLottie v-if="['fundo-copa-2026', 'fundo-natal'].includes(fundo?.codigo)" :key="fundo.codigo" :codigo="fundo.codigo" />
  <div v-else-if="efeito" class="fundo-animado" :class="`fundo-efeito-${efeito}`" aria-hidden="true">
    <div class="fundo-luz luz-a" />
    <div class="fundo-luz luz-b" />
    <div class="fundo-particulas">
      <i v-for="n in 12" :key="n" :style="{ '--n': n, left: `${(n * 37) % 100}%`, top: `${(n * 23) % 100}%` }" />
    </div>
  </div>
</template>

<style>
/* Isola a camada decorativa atrás do conteúdo, sem interceptar os cliques. */
.fundo-personalizado { position: relative; isolation: isolate; }
.fundo-animado { position: absolute; inset: 0; z-index: -1; border-radius: inherit; overflow: hidden; pointer-events: none; contain: paint; }
.fundo-luz { position: absolute; inset: -50%; opacity: .65; background: radial-gradient(ellipse at 35% 40%, var(--fundo-cor-a, #22d3ee) 0%, transparent 48%); animation: fundo-orbita 10s ease-in-out infinite alternate; }
.fundo-luz.luz-b { background: radial-gradient(ellipse at 65% 60%, var(--fundo-cor-b, #8b5cf6) 0%, transparent 45%); animation: fundo-orbita 13s ease-in-out -6s infinite alternate-reverse; opacity: .5; }
.fundo-particulas { position: absolute; inset: 0; }
.fundo-particulas i { position: absolute; width: 3px; height: 3px; border-radius: 50%; background: var(--fundo-cor-a, #22d3ee); box-shadow: 0 0 9px currentColor; color: var(--fundo-cor-a, #22d3ee); opacity: .8; animation: fundo-flutuar calc(4s + var(--n) * .4s) ease-in-out calc(var(--n) * -.7s) infinite alternate; }
.fundo-efeito-aurora .fundo-luz { background: repeating-linear-gradient(110deg, transparent 0 12%, #10b98155 18%, #22d3ee99 25%, transparent 35%); filter: blur(16px); animation-duration: 8s; }
.fundo-efeito-nebulosa .fundo-luz { filter: blur(12px); animation-duration: 14s; }
.fundo-efeito-dourado .luz-a { background: linear-gradient(110deg, transparent 40%, #fbbf2488 49%, #fff3 50%, transparent 60%); animation: fundo-varredura 5s ease-in-out infinite; }
.fundo-efeito-estrelas .fundo-luz { opacity: .2; }
.fundo-efeito-estrelas .fundo-particulas i { background: #dbeafe; color: #93c5fd; animation: fundo-estrela calc(3s + var(--n) * .3s) ease-in-out calc(var(--n) * -.8s) infinite; }
.fundo-efeito-estrelas .fundo-particulas::after { content: ""; position: absolute; top: 15%; left: 100%; width: 100px; height: 2px; background: linear-gradient(90deg, transparent, #93c5fd); transform: rotate(-25deg); animation: fundo-meteoro 6s linear infinite; }
.fundo-efeito-oceano .fundo-luz { inset: 10% -45% -100%; border-radius: 42%; background: #06b6d455; animation: fundo-onda 9s linear infinite; }
.fundo-efeito-oceano .luz-b { inset: 35% -40% -100%; background: #2563eb66; animation-duration: 14s; animation-direction: reverse; }
.fundo-efeito-oceano .fundo-particulas i { width: 7px; height: 7px; background: transparent; border: 1px solid #67e8f9; animation: fundo-subir 7s linear calc(var(--n) * -.65s) infinite; }
.fundo-efeito-matrix .fundo-luz { opacity: .13; }
.fundo-efeito-matrix .fundo-particulas i { top: -80% !important; width: 2px; height: 75%; border-radius: 0; background: linear-gradient(transparent, #22c55e66, #86efac); box-shadow: 0 0 10px #22c55e66; animation: fundo-chuva calc(2s + var(--n) * .12s) linear calc(var(--n) * -.4s) infinite; }
.fundo-efeito-crepusculo .luz-a { background: radial-gradient(circle at 50% 60%, #fbbf24aa 0 9%, #fb718566 17%, transparent 42%); animation: fundo-sol 9s ease-in-out infinite alternate; }
.fundo-efeito-crepusculo .luz-b { background: repeating-linear-gradient(0deg, transparent 0 35px, #fb718533 36px 38px); animation: fundo-orbita 12s ease-in-out infinite alternate; }
.fundo-efeito-chamas .fundo-luz { inset: 0 -40% -100%; background: radial-gradient(ellipse at 50% 80%, #fbbf24bb, #f9731699 30%, transparent 65%); animation: fundo-chama 3s ease-in-out infinite alternate; }
.fundo-efeito-chamas .luz-b { animation-delay: -1.5s; animation-direction: alternate-reverse; }
.fundo-efeito-chamas .fundo-particulas i { background: #fbbf24; color: #f97316; animation: fundo-subir calc(3s + var(--n) * .2s) linear calc(var(--n) * -.45s) infinite; }
.fundo-efeito-prisma .luz-a { background: conic-gradient(from 0deg, #22d3ee88, #a78bfa88, #ec489988, #fbbf2488, #22d3ee88); filter: blur(20px); animation: fundo-girar 16s linear infinite; }
.fundo-efeito-prisma .luz-b { opacity: .2; }
@keyframes fundo-orbita { from { transform: translate(-12%, -10%) rotate(-12deg) scale(.9); } to { transform: translate(12%, 12%) rotate(18deg) scale(1.1); } }
@keyframes fundo-flutuar { from { transform: translate(0, 14px); opacity: .25; } to { transform: translate(15px, -24px); opacity: .9; } }
@keyframes fundo-varredura { 0% { transform: translateX(-45%); } 100% { transform: translateX(45%); } }
@keyframes fundo-estrela { 0%, 100% { transform: translateY(8px) scale(.6); opacity: .15; } 50% { transform: translateY(-8px) scale(1.4); opacity: 1; } }
@keyframes fundo-meteoro { 0%, 55% { transform: translate(0, 0) rotate(-25deg); opacity: 0; } 60% { opacity: 1; } 85%, 100% { transform: translate(-600px, 220px) rotate(-25deg); opacity: 0; } }
@keyframes fundo-onda { to { transform: rotate(360deg); } }
@keyframes fundo-subir { from { transform: translateY(100px); opacity: 0; } 30% { opacity: .8; } to { transform: translate(18px, -200px); opacity: 0; } }
@keyframes fundo-chuva { to { transform: translateY(300%); } }
@keyframes fundo-sol { from { transform: translate(-10%, 12%) scale(.9); } to { transform: translate(10%, -10%) scale(1.1); } }
@keyframes fundo-chama { from { transform: translate(-8%, 12%) scaleX(.85); } to { transform: translate(8%, -10%) scaleX(1.15); } }
@keyframes fundo-girar { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .fundo-animado *, .fundo-animado *::after { animation: none !important; } }
</style>
