<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { CONQUISTA_MOTION, createConquistaMotion } from "@/utils/conquistaMotion";
import "@/styles/conquistaMotion.css";

const props = defineProps({
  tag: { type: String, default: "div" },
  tier: { type: String, default: "" },
  color: { type: String, default: "#94a3b8" },
  unlocked: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
});

const surface = ref(null);
const material = computed(() => CONQUISTA_MOTION[props.tier]);
const particles = computed(() => {
  const count = material.value?.particles || 0;
  return props.compact ? Math.min(3, count) : count;
});
let disposeMotion = () => {};
function refreshMotion() {
  disposeMotion();
  disposeMotion = createConquistaMotion(surface.value, {
    tier: props.tier,
    unlocked: props.unlocked,
    compact: props.compact,
  });
}
onMounted(refreshMotion);
watch(
  [() => props.tier, () => props.unlocked, () => props.compact],
  refreshMotion,
  { flush: "post" },
);
onBeforeUnmount(() => disposeMotion());
</script>

<template>
  <component
    :is="tag"
    ref="surface"
    class="conq-motion-surface"
    :class="[`tier-${tier || 'locked'}`, { locked: !unlocked }]"
    :style="{ '--tier-cor': color }"
  >
    <div v-if="unlocked && material" class="conq-fx" aria-hidden="true">
      <span class="conq-fx-aura" />
      <span class="conq-fx-orbit" />
      <span class="conq-fx-facets" />
      <span class="conq-fx-sheen" />
      <span class="conq-fx-flash" />
      <span
        v-for="index in particles"
        :key="index"
        class="conq-fx-particle"
        :style="{
          left: `${8 + (((index - 1) * 19) % 86)}%`,
          top: `${22 + (((index - 1) * 23) % 64)}%`,
          '--particle-size': `${(index - 1) % 3 === 0 ? 4 : 2}px`,
        }"
      />
    </div>
    <slot />
  </component>
</template>
