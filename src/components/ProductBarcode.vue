<script setup>
import JsBarcode from "jsbarcode";
import { computed, nextTick, onMounted, ref, watch } from "vue";

const props = defineProps({
  value: { type: [String, Number], default: "" },
  format: { type: String, default: "CODE128" },
  width: { type: Number, default: 1.45 },
  height: { type: Number, default: 34 },
  fontSize: { type: Number, default: 11 },
});

const barcodeEl = ref(null);
const invalido = ref(false);

const valorNormalizado = computed(() => `${props.value ?? ""}`.trim());
const ariaLabel = computed(() =>
  valorNormalizado.value
    ? `Codigo de barras do produto ${valorNormalizado.value}`
    : "Codigo de barras indisponivel",
);

async function renderBarcode() {
  await nextTick();

  const target = barcodeEl.value;
  invalido.value = false;

  if (!target) return;

  target.innerHTML = "";

  if (!valorNormalizado.value) return;

  try {
    JsBarcode(target, valorNormalizado.value, {
      format: props.format,
      width: props.width,
      height: props.height,
      fontSize: props.fontSize,
      margin: 0,
      textMargin: 4,
      background: "transparent",
      lineColor: "#1f2937",
      displayValue: true,
      valid(isValid) {
        invalido.value = !isValid;
      },
    });

    if (invalido.value) {
      target.innerHTML = "";
    }
  } catch {
    invalido.value = true;
    target.innerHTML = "";
  }
}

onMounted(renderBarcode);

watch(
  () => [props.value, props.format, props.width, props.height, props.fontSize],
  renderBarcode,
  { flush: "post" },
);
</script>

<template>
  <div
    v-if="valorNormalizado"
    class="product-barcode"
    :class="{ invalido }"
    role="img"
    :aria-label="ariaLabel"
  >
    <svg ref="barcodeEl" class="product-barcode-svg" />
    <span v-if="invalido" class="product-barcode-fallback">
      {{ valorNormalizado }}
    </span>
  </div>
</template>

<style scoped>
.product-barcode {
  display: grid;
  gap: 4px;
  width: min(100%, 230px);
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  background: color-mix(in srgb, white 82%, var(--bg-2) 18%);
}

.product-barcode-svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.product-barcode.invalido {
  background: color-mix(in srgb, var(--warning) 10%, white 90%);
  border-color: color-mix(in srgb, var(--warning) 36%, transparent);
}

.product-barcode-fallback {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #92400e;
}
</style>
