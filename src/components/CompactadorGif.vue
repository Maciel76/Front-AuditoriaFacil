<script setup>
import { onBeforeUnmount, ref } from "vue";
import { compactarGif, formatarTamanho } from "@/utils/compactarGif";

const ocupado = ref(false);
const progresso = ref("");
const erro = ref("");
const resultado = ref(null);
const url = ref("");

async function selecionar(event) {
  const file = event.target.files?.[0];
  if (!file || ocupado.value) return;
  ocupado.value = true;
  erro.value = "";
  resultado.value = null;
  URL.revokeObjectURL(url.value);
  url.value = "";
  try {
    resultado.value = await compactarGif(file, (texto) => { progresso.value = texto; });
    url.value = URL.createObjectURL(resultado.value.file);
  } catch (e) {
    erro.value = e.message || "Não foi possível compactar o GIF.";
  } finally {
    ocupado.value = false;
    event.target.value = "";
  }
}
onBeforeUnmount(() => URL.revokeObjectURL(url.value));
</script>

<template>
  <section class="card compactador-gif" aria-label="Compactar GIF para baixar" :aria-busy="ocupado">
    <div>
      <h3><fa icon="file-lines" /> Compactar GIF para baixar</h3>
      <p class="muted">Reduz resolução e cores, mantendo a animação. Compactação no navegador, antes de enviar ao servidor. Originais de até 50 MB; busca arquivos de até 512 KB.</p>
    </div>
    <label class="btn ghost compactador-seletor" :class="{ ocupado }">
      <fa :icon="ocupado ? 'spinner' : 'upload'" :spin="ocupado" />
      {{ ocupado ? progresso : 'Selecionar GIF para compactar' }}
      <input type="file" accept="image/gif,.gif" hidden :disabled="ocupado" @change="selecionar" />
    </label>
    <div v-if="resultado" class="compactador-resultado" aria-live="polite">
      <img :src="url" alt="Prévia do GIF compactado" width="96" height="96" />
      <div>
        <p><strong>{{ formatarTamanho(resultado.originalSize) }} → {{ formatarTamanho(resultado.size) }}</strong></p>
        <p class="muted">{{ resultado.reducao > 0 ? `${resultado.reducao}% menor` : 'O arquivo já estava otimizado; mantivemos o menor tamanho.' }}</p>
        <p v-if="!resultado.atingiuAlvo" class="muted">Melhor tamanho obtido. GIFs longos podem ultrapassar 512 KB.</p>
        <a class="btn primary" :href="url" :download="resultado.file.name">Baixar GIF compactado</a>
      </div>
    </div>
    <p v-if="erro" class="badge bad" role="alert">{{ erro }}</p>
  </section>
</template>

<style scoped>
.compactador-gif { display: grid; gap: 12px; }
.compactador-gif h3, .compactador-gif p { margin: 0 0 6px; }
.compactador-gif .muted { font-size: 13px; }
.compactador-seletor { width: fit-content; max-width: 100%; cursor: pointer; }
.compactador-seletor.ocupado { opacity: .7; cursor: wait; }
.compactador-resultado { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; }
.compactador-resultado img { object-fit: contain; border-radius: 12px; background: var(--bg); }
</style>
