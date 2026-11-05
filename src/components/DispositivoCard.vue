<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { animate, createScope, stagger } from "@/vendor/animejs/anime.esm.min.js";

const props = defineProps({
  item: { type: Object, required: true },
  salvando: Boolean,
  editavel: { type: Boolean, default: true },
});
defineEmits(["alternar", "aviso"]);
const root = ref(null);
const labels = { LIVRE: "Livre", EM_USO: "Em uso", AVISO: "Aviso" };
const proximos = { LIVRE: "Em uso", EM_USO: "Livre" };
let scope, observer, media;
let loops = [];
let visible = false;

function playback() {
  loops.forEach((loop) => visible && !document.hidden ? loop.resume() : loop.pause());
}

function motion(changed = false) {
  scope?.revert();
  loops = [];
  if (!root.value || media?.matches) return;
  scope = createScope({ root: root.value });
  scope.add(() => {
    if (changed) {
      animate(root.value, { scale: [0.96, 1], duration: 450, ease: "out(3)" });
      animate(".device-handset", { y: [-12, 0], duration: 650, ease: "outElastic(1, .6)" });
    }
    if (props.item.status === "EM_USO") {
      // Staggered wave, adapted from the reference repository's grid examples.
      loops.push(animate(".device-wave i", {
        scaleY: (_, index) => [0.25 + (index % 3) * 0.1, 0.6 + (index % 4) * 0.13],
        duration: 700, delay: stagger(75), alternate: true, loop: true,
        ease: "inOutSine", autoplay: false, frameRate: 30,
      }));
    }
    if (props.item.status !== "LIVRE") {
      loops.push(animate(".device-aura", {
        opacity: [0.18, 0.48], duration: 2100, alternate: true,
        loop: true, ease: "inOutSine", autoplay: false, frameRate: 30,
      }));
      playback();
    }
  });
}

watch(() => props.item.status, () => motion(true), { flush: "post" });
onMounted(() => {
  media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", motionPreference);
  observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; playback(); });
  observer.observe(root.value);
  document.addEventListener("visibilitychange", playback);
  motion();
});
function motionPreference() { motion(); }
onBeforeUnmount(() => {
  scope?.revert();
  observer?.disconnect();
  media?.removeEventListener("change", motionPreference);
  document.removeEventListener("visibilitychange", playback);
});
</script>

<template>
  <article ref="root" class="device-card" :class="`is-${item.status.toLowerCase()}`" :aria-busy="salvando">
    <button type="button" class="device-card-toggle"
      :aria-label="`Base ${String(item.base).padStart(2, '0')}, ${labels[item.status]}${item.status === 'AVISO' ? '. Ver aviso' : editavel ? '. Clique para ' + proximos[item.status] : ''}`"
      :aria-disabled="!editavel && item.status !== 'AVISO'"
      @click="item.status === 'AVISO' ? $emit('aviso', item) : editavel && $emit('alternar', item)"></button>
    <span class="device-card-top"><span>Base {{ String(item.base).padStart(2, '0') }}</span>
      <button type="button" class="device-add-alert" :class="{ active: item.status === 'AVISO' }"
        :disabled="salvando || (!editavel && item.status !== 'AVISO')"
        :aria-label="`${item.status === 'AVISO' ? 'Ver aviso' : 'Adicionar aviso'} da Base ${String(item.base).padStart(2, '0')}`"
        :title="item.status === 'AVISO' ? 'Ver ou editar aviso' : 'Adicionar aviso e observação'"
        @click.stop="$emit('aviso', item)"><fa :icon="salvando ? 'spinner' : 'plus'" :spin="salvando" /></button>
    </span>
    <span class="device-illustration" aria-hidden="true">
      <span class="device-aura"></span>
      <span class="device-dock"><span class="device-dock-slot"></span><span class="device-dock-led"></span></span>
      <span class="device-handset">
        <span class="device-speaker"></span>
        <span class="device-screen"><span class="device-screen-glass"></span>
          <span v-if="item.status === 'EM_USO'" class="device-wave"><i v-for="n in 11" :key="n"></i></span>
          <svg v-else-if="item.status === 'AVISO'" class="device-alert-mark" width="27" height="27" viewBox="0 0 24 24" fill="none"><path d="m12 3 10 17H2L12 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 9v5m0 3v.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <svg v-else class="device-ready" width="23" height="23" viewBox="0 0 24 24" fill="none"><path d="m7 12 3 3 7-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span><span class="device-home"></span>
      </span>
      <span class="device-indicators"><i></i><i></i><i></i></span>
    </span>
    <strong class="device-state">{{ labels[item.status] }}</strong>
    <span v-if="item.status === 'AVISO' && item.observacao" class="device-note" :title="item.observacao">{{ item.observacao }}</span>
  </article>
</template>
