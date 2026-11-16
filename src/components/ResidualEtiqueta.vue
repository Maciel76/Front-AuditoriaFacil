<script setup>
import QrcodeVue from "qrcode.vue";

defineProps({ produto: { type: Object, required: true } });
const numero = (valor) => valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
</script>

<template>
  <article class="residual-etiqueta" :aria-label="`Produto ${produto.codigo}, estoque ${numero(produto.estoqueAtual)}`">
    <div class="residual-etiqueta-qr" role="img" :aria-label="`QR code do produto ${produto.codigo}`">
      <QrcodeVue :value="produto.codigo" :size="104" :margin="4" level="M" render-as="svg" background="#ffffff" foreground="#000000" />
    </div>
    <div class="residual-etiqueta-info">
      <strong class="residual-etiqueta-codigo">{{ produto.codigo }}</strong>
      <p class="residual-etiqueta-nome">{{ produto.produto }}</p>
      <span class="residual-etiqueta-local">{{ produto.local || 'Sem corredor' }}</span>
    </div>
    <div class="residual-etiqueta-qtd">
      <span>Qtd.</span>
      <strong>{{ numero(produto.estoqueAtual) }}</strong>
    </div>
  </article>
</template>

<style scoped>
.residual-etiqueta {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 10px;
  color: #111;
  background: #fff;
  border: 1px solid #d5d9df;
  border-radius: 8px;
  min-width: 0;
}
.residual-etiqueta-qr { display: flex; width: 104px; height: 104px; }
.residual-etiqueta-qr :deep(svg) { display: block; width: 100%; height: 100%; }
.residual-etiqueta-info { min-width: 0; }
.residual-etiqueta-codigo { display: block; overflow-wrap: anywhere; font-size: 15px; line-height: 1.3; }
.residual-etiqueta-nome { margin: 5px 0; font-size: 12px; line-height: 1.4; overflow-wrap: anywhere; }
.residual-etiqueta-local { font-size: 11px; color: #525b65; }
.residual-etiqueta-qtd { align-self: start; display: grid; justify-items: center; gap: 2px; padding: 5px 7px; background: #f1f3f5; border: 1px solid #d5d9df; border-radius: 5px; }
.residual-etiqueta-qtd span { font-size: 10px; }
.residual-etiqueta-qtd strong { font-size: 20px; line-height: 1.1; }
@media print {
  .residual-etiqueta { grid-template-columns: 25mm minmax(0, 1fr) auto; gap: 1mm; padding: 2mm; border-radius: 1mm; break-inside: avoid; page-break-inside: avoid; }
  .residual-etiqueta-qr { width: 25mm; height: 25mm; }
  .residual-etiqueta-codigo { font-size: 10pt; }
  .residual-etiqueta-nome { font-size: 8pt; }
  .residual-etiqueta-local { font-size: 7pt; }
  .residual-etiqueta-qtd { padding: 1mm; }
  .residual-etiqueta-qtd strong { font-size: 13pt; }
}
</style>
