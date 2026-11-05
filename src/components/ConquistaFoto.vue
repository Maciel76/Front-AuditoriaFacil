<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
import { CONQUISTA_MOTION, createConquistaMotion, createFireVariation } from "@/utils/conquistaMotion";
import "@/styles/conquistaFoto.css";

defineOptions({ inheritAttrs: false });
const props = defineProps({
  src: { type: String, required: true },
  alt: { type: String, default: "" },
  tier: { type: String, default: "" },
  color: { type: String, default: "#a855f7" },
  unlocked: { type: Boolean, default: false },
  expanded: { type: Boolean, default: false },
});
const surface = ref(null);
const photograph = ref(null);
const filterId = `conq-fire-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
const size = ref(1);
const photoBounds = ref(null);
// The image previews its rarity even before the achievement is earned. The
// portal's badges and progress remain responsible for the unlock state.
const effectTier = computed(() => String(props.tier || "")
  .trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
const effectEnabled = computed(() => !!props.src && !!CONQUISTA_MOTION[effectTier.value]);
const fire = computed(() => createFireVariation(
  `${filterId}:${props.src}:${effectTier.value}`,
  CONQUISTA_MOTION[effectTier.value]?.rank || 1,
));
const hotColor = computed(() => `color-mix(in srgb, ${props.color} 48%, #fff4e2)`);
let resizeObserver;
let disposeMotion = () => {};

function measurePhoto() {
  const image = photograph.value;
  const host = surface.value;
  if (!image?.naturalWidth || !host) return;
  const rect = image.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  if (!rect.width || !rect.height || !hostRect.width) return;
  const style = getComputedStyle(image);
  const pad = (side) => parseFloat(style[side]) || 0;
  // Match object-fit: contain, including the portal's existing image padding.
  const width = Math.max(0, rect.width - pad("paddingLeft") - pad("paddingRight"));
  const height = Math.max(0, rect.height - pad("paddingTop") - pad("paddingBottom"));
  const fit = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const photoWidth = image.naturalWidth * fit;
  const photoHeight = image.naturalHeight * fit;
  const localScale = host.offsetWidth / hostRect.width;
  photoBounds.value = {
    left: `${((rect.left - hostRect.left + pad("paddingLeft") + (width - photoWidth) / 2) * localScale).toFixed(2)}px`,
    top: `${((rect.top - hostRect.top + pad("paddingTop") + (height - photoHeight) / 2) * localScale).toFixed(2)}px`,
    width: `${(photoWidth * localScale).toFixed(2)}px`,
    height: `${(photoHeight * localScale).toFixed(2)}px`,
  };
  // Quantize to avoid restarting animation for subpixel resize notifications.
  size.value = Math.round(Math.min(2.5, Math.max(0.25, Math.min(photoWidth, photoHeight) * localScale / 150)) * 20) / 20;
}
function refreshMotion() {
  disposeMotion();
  disposeMotion = createConquistaMotion(surface.value, {
    tier: effectTier.value,
    unlocked: effectEnabled.value,
    mode: "fire",
    fireScale: size.value,
    variation: fire.value,
  });
}
onMounted(() => {
  measurePhoto();
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(measurePhoto);
    resizeObserver.observe(surface.value);
    resizeObserver.observe(photograph.value);
  } else window.addEventListener("resize", measurePhoto);
  refreshMotion();
});
watch([effectTier, effectEnabled, () => props.src, size], refreshMotion, { flush: "post" });
watch(() => props.src, () => nextTick(measurePhoto));
onBeforeUnmount(() => {
  disposeMotion();
  resizeObserver?.disconnect();
  window.removeEventListener("resize", measurePhoto);
});
</script>

<template>
  <span
    ref="surface"
    class="conq-photo"
    :class="{ 'conq-photo--expanded': expanded, 'conq-photo--lit': effectEnabled }"
    :style="{ '--photo-fire-color': color, '--photo-fire-scale': size }"
  >
    <svg v-if="effectEnabled" class="conq-photo-filter" aria-hidden="true" focusable="false">
      <defs>
        <filter :id="filterId" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
          <!-- 1. Wide, soft light anchors the fire to the photo. -->
          <feGaussianBlur in="SourceAlpha" :stdDeviation="6 * size" result="ambientAlpha" />
          <feFlood :flood-color="color" flood-opacity="0.42" result="ambientColor" />
          <feComposite in="ambientColor" in2="ambientAlpha" operator="in" result="ambient" />

          <!-- 2. Broken outer tongues: noise also modulates transparency. -->
          <feMorphology in="SourceAlpha" operator="dilate" :radius="`${1.1 * size} ${5 * size}`" result="outerFuel" />
          <feTurbulence type="fractalNoise" :baseFrequency="`${fire.frequency / size} ${0.016 / size}`" numOctaves="2" :seed="fire.outerSeed" result="outerNoise" />
          <feComponentTransfer in="outerNoise" result="outerContrast">
            <feFuncR type="linear" slope="2.4" intercept="-0.7" />
            <feFuncG type="linear" slope="2.4" intercept="-0.7" />
          </feComponentTransfer>
          <feOffset class="conq-fire-outer-drift" in="outerContrast" dx="0" dy="0" result="outerFlow" />
          <feDisplacementMap class="conq-fire-outer-warp" in="outerFuel" in2="outerFlow" :scale="fire.strength * size" xChannelSelector="R" yChannelSelector="G" result="outerWarp" />
          <feOffset in="outerWarp" :dy="-6 * size" result="outerRise" />
          <feColorMatrix in="outerFlow" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.9 0.3 0 0 -0.08" result="outerDensity" />
          <feComposite in="outerRise" in2="outerDensity" operator="in" result="outerTexture" />
          <feGaussianBlur in="outerTexture" :stdDeviation="1.15 * size" result="outerAlpha" />
          <feFlood :flood-color="color" flood-opacity="0.86" result="outerColor" />
          <feComposite in="outerColor" in2="outerAlpha" operator="in" result="outerFlame" />

          <!-- 3. A finer, independent hot layer adds depth at the edge. -->
          <feMorphology in="SourceAlpha" operator="dilate" :radius="`${0.7 * size} ${1.8 * size}`" result="innerFuel" />
          <feTurbulence type="turbulence" :baseFrequency="`${0.074 / size} ${0.025 / size}`" numOctaves="1" :seed="fire.innerSeed" result="innerNoise" />
          <feOffset class="conq-fire-inner-drift" in="innerNoise" dx="0" dy="0" result="innerFlow" />
          <feDisplacementMap class="conq-fire-inner-warp" in="innerFuel" in2="innerFlow" :scale="fire.strength * size * 0.4" xChannelSelector="G" yChannelSelector="R" result="innerWarp" />
          <feOffset in="innerWarp" :dy="-2 * size" result="innerRise" />
          <feGaussianBlur in="innerRise" :stdDeviation="0.6 * size" result="innerAlpha" />
          <feFlood :flood-color="hotColor" flood-opacity="0.65" result="innerColor" />
          <feComposite in="innerColor" in2="innerAlpha" operator="in" result="innerFlame" />

          <!-- 4. A narrow light rim keeps the original artwork crisp. -->
          <feMorphology in="SourceAlpha" operator="dilate" :radius="0.65 * size" result="rimAlpha" />
          <feFlood :flood-color="hotColor" flood-opacity="0.5" result="rimColor" />
          <feComposite in="rimColor" in2="rimAlpha" operator="in" result="rim" />
          <feMerge>
            <feMergeNode in="ambient" />
            <feMergeNode in="outerFlame" />
            <feMergeNode in="innerFlame" />
            <feMergeNode in="rim" />
          </feMerge>
        </filter>
      </defs>
    </svg>
    <img
      v-if="effectEnabled"
      v-bind="$attrs"
      :src="src"
      alt=""
      aria-hidden="true"
      class="conq-photo-fire"
      :style="{ filter: `url(#${filterId})` }"
      decoding="async"
      draggable="false"
    />
    <span v-if="effectEnabled" class="conq-photo-embers" :style="photoBounds" aria-hidden="true">
      <span
        v-for="(spark, index) in fire.sparks"
        :key="index"
        class="conq-photo-spark"
        :style="{ left: `${spark.x}%`, top: `${spark.y}%`, '--spark-size': `${spark.size}px` }"
      />
    </span>
    <img ref="photograph" v-bind="$attrs" :src="src" :alt="alt" class="conq-photo-source" draggable="false" @load="measurePhoto" />
  </span>
</template>
