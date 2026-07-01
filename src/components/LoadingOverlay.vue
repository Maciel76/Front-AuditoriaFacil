<script setup>
defineProps({
  show: { type: Boolean, default: false },
});
</script>

<template>
  <Transition name="overlay-fade">
    <div v-if="show" class="loading-overlay">
      <div class="loading-dots-grid">
        <div class="ld-dot ld-dot--danger"></div>
        <div class="ld-dot ld-dot--rotate-top ld-dot--primary"></div>
        <div class="ld-dot ld-dot--good ld-dot--sm"></div>
        <div class="ld-dot ld-dot--rotate-right ld-dot--primary"></div>
        <div class="ld-dot ld-dot--warning ld-dot--lg"></div>
        <div class="ld-dot ld-dot--rotate-left ld-dot--primary"></div>
        <div class="ld-dot ld-dot--excellent ld-dot--sm"></div>
        <div class="ld-dot ld-dot--rotate-bottom ld-dot--primary"></div>
        <div class="ld-dot ld-dot--accent ld-dot--sm"></div>
      </div>
      <p class="loading-overlay-text">Atualizando dados...</p>
    </div>
  </Transition>
</template>

<style scoped>
.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 28px;
  background: rgba(11, 15, 26, 0.10);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.loading-overlay-text {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-dim);
  letter-spacing: 0.3px;
}

/* ===== Grid de dots 3x3 ===== */
.loading-dots-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 12px;
  width: 100px;
  height: 100px;
}

/* ===== Dot base ===== */
.ld-dot {
  position: relative;
}

.ld-dot,
.ld-dot::before,
.ld-dot::after {
  animation-duration: 2s;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

.ld-dot::before,
.ld-dot::after {
  aspect-ratio: 1;
  background-color: rgba(255, 255, 255, 0.35);
  border-radius: 50%;
  content: "";
  display: block;
  position: absolute;
  width: 100%;
}

.ld-dot::after {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0);
}

/* ===== Cores dos dots ===== */
.ld-dot--primary::before,
.ld-dot--primary::after {
  background-color: var(--primary, #7c5cff);
}

.ld-dot--accent::before,
.ld-dot--accent::after {
  background-color: var(--accent, #22d3ee);
}

.ld-dot--warning::before,
.ld-dot--warning::after {
  background-color: var(--warning, #f59e0b);
}

.ld-dot--danger::before,
.ld-dot--danger::after {
  background-color: var(--danger, #ef4444);
}

.ld-dot--good::before,
.ld-dot--good::after {
  background-color: #4f9cf0;
}

.ld-dot--excellent::before,
.ld-dot--excellent::after {
  background-color: var(--success, #22c55e);
}

.ld-dot--gradient::before,
.ld-dot--gradient::after {
  background: linear-gradient(135deg, var(--primary, #7c5cff), var(--accent, #22d3ee));
}

/* ===== Tamanhos de onda ===== */
.ld-dot--lg::after {
  width: 500%;
}

.ld-dot--sm::after {
  width: 167%;
}

/* ===== Rotações nos dots pares ===== */
.ld-dot--rotate-top {
  animation-name: ld-rotate;
  transform-origin: 50% 200%;
}

.ld-dot--rotate-right {
  animation-name: ld-rotate;
  transform-origin: 200% 50%;
}

.ld-dot--rotate-left {
  animation-name: ld-rotate;
  transform-origin: -100% 50%;
}

.ld-dot--rotate-bottom {
  animation-name: ld-rotate;
  transform-origin: 50% -100%;
}

/* ===== Escalas individuais por posição ===== */
.ld-dot:nth-child(1)::before { animation-name: ld-scale1; }
.ld-dot:nth-child(2)::before { animation-name: ld-scale2; }
.ld-dot:nth-child(3)::before { animation-name: ld-scale3; }
.ld-dot:nth-child(4)::before { animation-name: ld-scale4; }
.ld-dot:nth-child(5)::before { animation-name: ld-scale5; }
.ld-dot:nth-child(6)::before { animation-name: ld-scale6; }
.ld-dot:nth-child(7)::before { animation-name: ld-scale7; }
.ld-dot:nth-child(8)::before { animation-name: ld-scale8; }
.ld-dot:nth-child(9)::before { animation-name: ld-scale9; }

/* Ondas nos dots ímpares (3, 5=centro, 7, 9) */
.ld-dot:nth-child(3)::after  { animation-name: ld-wave3; }
.ld-dot:nth-child(5)::after  { animation-name: ld-wave5a, ld-wave5b; }
.ld-dot:nth-child(7)::after  { animation-name: ld-wave7; }
.ld-dot:nth-child(9)::after  { animation-name: ld-wave9; }

/* ===== Transição de entrada/saída ===== */
.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.3s ease;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

/* ===== Keyframes ===== */
@keyframes ld-rotate {
  from, 22% { animation-timing-function: ease-out; transform: rotate(-45deg); }
  37%, to   { transform: rotate(0); }
}

@keyframes ld-scale1 {
  from, 36% { transform: translate(0, 0) scale(0); }
  50%, 71%  { transform: translate(0, 0) scale(1); }
  87%, to   { transform: translate(75%, 75%) scale(0); }
}

@keyframes ld-scale2 {
  from, 25% { animation-timing-function: ease-out; transform: translate(0, 0) scale(0); }
  40%, 71%  { transform: translate(0, 0) scale(1); }
  87%, to   { transform: translate(0, -100%) scale(0); }
}

@keyframes ld-scale3 {
  from, 27% { animation-timing-function: ease-in; transform: translate(0, 0) scale(0); }
  45%, 71%  { transform: translate(0, 0) scale(1); }
  87%, to   { transform: translate(-75%, 75%) scale(0); }
}

@keyframes ld-scale4 {
  from, 28% { animation-timing-function: ease-out; transform: translate(0, 0) scale(0); }
  43%, 71%  { transform: translate(0, 0) scale(1); }
  87%, to   { transform: translate(-100%, 0) scale(0); }
}

@keyframes ld-scale5 {
  from, 9%, to { transform: scale(0); }
  26%          { transform: scale(1.17); }
  41%, 75%     { transform: scale(1); }
}

@keyframes ld-scale6 {
  from, 22% { animation-timing-function: ease-out; transform: translate(0, 0) scale(0); }
  37%, 71%  { transform: translate(0, 0) scale(1); }
  87%, to   { transform: translate(100%, 0) scale(0); }
}

@keyframes ld-scale7 {
  from, 36% { animation-timing-function: ease-in; transform: translate(0, 0) scale(0); }
  53%, 71%  { transform: translate(0, 0) scale(1); }
  87%, to   { transform: translate(75%, -75%) scale(0); }
}

@keyframes ld-scale8 {
  from, 24% { animation-timing-function: ease-out; transform: translate(0, 0) scale(0); }
  39%, 71%  { transform: translate(0, 0) scale(1); }
  87%, to   { transform: translate(0, 100%) scale(0); }
}

@keyframes ld-scale9 {
  from, 32% { animation-timing-function: ease-in; transform: translate(0, 0) scale(0); }
  49%, 71%  { transform: translate(0, 0) scale(1); }
  87%, to   { transform: translate(-75%, -75%) scale(0); }
}

@keyframes ld-wave3 {
  from       { visibility: hidden; }
  45%        { opacity: 1; transform: translate(-50%, -50%) scale(0.6); visibility: hidden; }
  61%, to    { opacity: 0; transform: translate(-50%, -50%) scale(1); }
}

@keyframes ld-wave5a {
  from       { transform: translate(-50%, -50%) scale(0.2); }
  8%         { transform: translate(-50%, -50%) scale(0.8); }
  25%, to    { transform: translate(-50%, -50%) scale(1); }
}

@keyframes ld-wave5b {
  from, 25%, to { opacity: 0; }
  8%            { opacity: 0.5; }
}

@keyframes ld-wave7 {
  from       { visibility: hidden; }
  53%        { opacity: 1; transform: translate(-50%, -50%) scale(0.6); visibility: hidden; }
  69%, to    { opacity: 0; transform: translate(-50%, -50%) scale(1); }
}

@keyframes ld-wave9 {
  from       { visibility: hidden; }
  49%        { opacity: 1; transform: translate(-50%, -50%) scale(0.6); visibility: hidden; }
  65%, to    { opacity: 0; transform: translate(-50%, -50%) scale(1); }
}

/* Tema claro */
:global([data-theme="light"]) .loading-overlay {
  background: rgba(237, 244, 255, 0.10);
}

:global([data-theme="light"]) .ld-dot::before,
:global([data-theme="light"]) .ld-dot::after {
  background-color: rgba(26, 30, 53, 0.25);
}

:global([data-theme="light"]) .ld-dot--primary::before,
:global([data-theme="light"]) .ld-dot--primary::after {
  background-color: var(--primary, #6d5cff);
}

:global([data-theme="light"]) .ld-dot--accent::before,
:global([data-theme="light"]) .ld-dot--accent::after {
  background-color: var(--accent, #06b6d4);
}

:global([data-theme="light"]) .ld-dot--warning::before,
:global([data-theme="light"]) .ld-dot--warning::after {
  background-color: var(--warning, #f59e0b);
}

:global([data-theme="light"]) .ld-dot--danger::before,
:global([data-theme="light"]) .ld-dot--danger::after {
  background-color: var(--danger, #ef4444);
}

:global([data-theme="light"]) .ld-dot--good::before,
:global([data-theme="light"]) .ld-dot--good::after {
  background-color: #4f9cf0;
}

:global([data-theme="light"]) .ld-dot--excellent::before,
:global([data-theme="light"]) .ld-dot--excellent::after {
  background-color: var(--success, #22c55e);
}

:global([data-theme="light"]) .ld-dot--gradient::before,
:global([data-theme="light"]) .ld-dot--gradient::after {
  background: linear-gradient(135deg, var(--primary, #6d5cff), var(--accent, #06b6d4));
}
</style>
