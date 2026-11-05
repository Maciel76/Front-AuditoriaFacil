<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { animate, stagger } from "@/vendor/animejs/anime.esm.min.js";
import api from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import DispositivoCard from "@/components/DispositivoCard.vue";
import "@/styles/dispositivos.css";

const auth = useAuthStore();
const ui = useUiStore();
const lojas = ref([]);
const lojaSelecionada = ref("");
const lojaId = computed(() => auth.isSuperAdmin ? lojaSelecionada.value : auth.loja?._id || auth.usuario?.loja?._id || auth.usuario?.loja || "");
const nomeLoja = computed(() => auth.isSuperAdmin ? lojas.value.find((loja) => loja._id === lojaId.value)?.nome : auth.loja?.nome);
const items = ref([]);
const carregando = ref(false);
const erro = ref("");
const erroLojas = ref("");
const filtro = ref("TODOS");
const busca = ref("");
const atualizadoEm = ref(null);
const grid = ref(null);
const avisoDialog = ref(null);
const avisoBase = ref(null);
const observacao = ref("");
const salvandoAviso = ref(false);
const erroAviso = ref("");
const conflitoAviso = ref(false);
const salvandoBases = ref(new Set());
const salvando = computed(() => salvandoBases.value.size > 0);
const labels = { TODOS: "Todas as bases", LIVRE: "Livres", EM_USO: "Em uso", AVISO: "Aviso" };
const ciclo = ["LIVRE", "EM_USO", "AVISO"];
const filas = new Map();
let requestId = 0, timer, entrada;
let disposed = false;

function normalizarStatus(status) { return status === "OCUPADO" ? "EM_USO" : ciclo.includes(status) ? status : "LIVRE"; }
function proximoStatus(status) { return normalizarStatus(status) === "EM_USO" ? "LIVRE" : "EM_USO"; }
const contagem = computed(() => Object.fromEntries(Object.keys(labels).map((status) => [status, status === "TODOS" ? items.value.length : items.value.filter((item) => item.status === status).length])));
function normalizar(texto) { return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
const filtrados = computed(() => items.value.filter((item) =>
  (filtro.value === "TODOS" || item.status === filtro.value) &&
  normalizar(`Base ${String(item.base).padStart(2, "0")}`).includes(normalizar(busca.value.trim()))));
const horaAtualizacao = computed(() => atualizadoEm.value?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));

async function carregar(animar = false, silencioso = false) {
  const currentRequest = ++requestId;
  if (!lojaId.value) { items.value = []; carregando.value = false; return; }
  if (!silencioso) carregando.value = true;
  try {
    const { data } = await api.get("/dispositivos", { params: { lojaId: lojaId.value } });
    if (disposed || currentRequest !== requestId) return;
    items.value = data.items.map((item) => {
      const fila = filas.get(item.base);
      // A background refresh must not replace an unconfirmed click.
      if (fila?.loja === lojaId.value) return items.value.find((atual) => atual.base === item.base) || item;
      return { ...item, status: normalizarStatus(item.status) };
    });
    atualizadoEm.value = new Date();
    erro.value = "";
    carregando.value = false;
    if (animar) {
      await nextTick();
      if (!disposed && currentRequest === requestId && grid.value && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        entrada?.revert();
        entrada = animate(grid.value.querySelectorAll(".device-card"), {
          opacity: [0, 1], scale: [0.96, 1], duration: 500,
          delay: stagger(22), ease: "out(3)",
        });
      }
    }
  } catch (error) {
    if (!disposed && currentRequest === requestId) erro.value = error.response?.data?.error || "Não foi possível carregar as bases. Tente atualizar o painel.";
  } finally {
    if (!disposed && currentRequest === requestId) carregando.value = false;
  }
}

async function carregarLojas() {
  erroLojas.value = "";
  try {
    const { data } = await api.get("/lojas");
    if (disposed) return;
    lojas.value = data.items || [];
    if (lojas.value.length === 1) lojaSelecionada.value = lojas.value[0]._id;
  } catch { if (!disposed) erroLojas.value = "Não foi possível carregar as lojas."; }
}

function mudarStatus(item) {
  if (item.status === "AVISO") return abrirAviso(item);
  if (!auth.podeGerenciar || !lojaId.value) return;
  // Queue each base separately so rapid clicks keep their order on slow connections.
  let fila = filas.get(item.base);
  if (!fila) {
    fila = { base: item.base, loja: lojaId.value, confirmado: { ...item }, pendentes: 0, executando: false };
    filas.set(item.base, fila);
  }
  fila.pendentes++;
  ++requestId;
  carregando.value = false;
  items.value = items.value.map((atual) => atual.base === item.base ? { ...atual, status: proximoStatus(atual.status) } : atual);
  salvandoBases.value.add(item.base);
  if (!fila.executando) salvarFila(fila);
}

async function salvarFila(fila) {
  fila.executando = true;
  let falhou = false;
  try {
    while (fila.pendentes > 0) {
      const { data } = await api.patch(`/dispositivos/${fila.base}/status`, {
        revision: fila.confirmado.revision,
      }, { params: { lojaId: fila.loja } });
      fila.confirmado = data;
      fila.pendentes--;
      if (!disposed && lojaId.value === fila.loja) {
        ++requestId;
        carregando.value = false;
        items.value = items.value.map((item) => item.base === fila.base ? { ...data, status: fila.pendentes ? item.status : data.status } : item);
        atualizadoEm.value = new Date();
      }
    }
  } catch (error) {
    falhou = true;
    if (!disposed && lojaId.value === fila.loja) {
      items.value = items.value.map((item) => item.base === fila.base ? fila.confirmado : item);
      ui.erro(error.response?.status === 409
        ? `Base ${String(fila.base).padStart(2, "0")} alterada em outro acesso. Confira o estado atualizado e clique novamente.`
        : `Não foi possível salvar a Base ${String(fila.base).padStart(2, "0")}. Tente novamente.`);
    }
  } finally {
    if (filas.get(fila.base) === fila) filas.delete(fila.base);
    salvandoBases.value.delete(fila.base);
    if (falhou && !disposed && lojaId.value === fila.loja) carregar(false, true);
  }
}

async function abrirAviso(item) {
  if (salvandoBases.value.has(item.base) || (!auth.podeGerenciar && item.status !== "AVISO")) return;
  avisoBase.value = { ...item };
  observacao.value = item.observacao || "";
  erroAviso.value = "";
  conflitoAviso.value = false;
  await nextTick();
  avisoDialog.value?.showModal();
}
function fecharAviso() { if (!salvandoAviso.value) avisoDialog.value?.close(); }
function fecharForaAviso(event) {
  if (event.target !== avisoDialog.value) return;
  const rect = avisoDialog.value.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) fecharAviso();
}
async function salvarAviso(ativo = true) {
  if (salvandoAviso.value || conflitoAviso.value || !auth.podeGerenciar || !avisoBase.value) return;
  const base = avisoBase.value.base;
  const lojaAtual = lojaId.value;
  salvandoAviso.value = true;
  salvandoBases.value.add(base);
  erroAviso.value = "";
  ++requestId;
  carregando.value = false;
  try {
    const { data } = await api.patch(`/dispositivos/${base}/aviso`, {
      revision: avisoBase.value.revision, ativo, observacao: ativo ? observacao.value : "",
    }, { params: { lojaId: lojaAtual } });
    if (disposed || lojaAtual !== lojaId.value) return;
    ++requestId;
    carregando.value = false;
    items.value = items.value.map((item) => item.base === base ? data : item);
    atualizadoEm.value = new Date();
    avisoDialog.value.close();
    ui.sucesso(ativo ? "Aviso salvo." : "Aviso removido.");
  } catch (error) {
    if (!disposed && lojaAtual === lojaId.value) {
      erroAviso.value = error.response?.data?.error || "Não foi possível salvar o aviso. Tente novamente.";
      conflitoAviso.value = error.response?.status === 409;
    }
  } finally {
    salvandoBases.value.delete(base);
    salvandoAviso.value = false;
  }
}
async function reabrirAvisoAtual() {
  const base = avisoBase.value.base;
  await carregar();
  const item = items.value.find((atual) => atual.base === base);
  if (!erro.value && item) abrirAviso(item);
  else erroAviso.value = erro.value;
}

watch(lojaId, () => {
  fecharAviso();
  items.value = [];
  atualizadoEm.value = null;
  erro.value = "";
  filtro.value = "TODOS";
  busca.value = "";
  carregar(true);
});
onMounted(() => {
  if (auth.isSuperAdmin) carregarLojas();
  if (lojaId.value) carregar(true);
  timer = setInterval(() => {
    if (!document.hidden && lojaId.value && !salvando.value && !carregando.value) carregar(false, true);
  }, 30000);
});
onBeforeUnmount(() => { disposed = true; ++requestId; clearInterval(timer); entrada?.revert(); avisoDialog.value?.close(); });
</script>

<template>
  <section class="devices-page">
    <div class="devices-heading">
      <div><h2>Um lugar para cada dispositivo.</h2><p>{{ auth.podeGerenciar ? 'Clique na base para alternar livre e em uso. Use o + para adicionar um aviso.' : 'Acompanhe o status das 35 bases da loja.' }}</p></div>
      <div class="devices-heading-actions">
        <label v-if="auth.isSuperAdmin" class="devices-store"><span>Loja</span><select v-model="lojaSelecionada" aria-label="Loja" :disabled="salvando"><option value="">Selecione uma loja</option><option v-for="loja in lojas" :key="loja._id" :value="loja._id">{{ loja.nome }}</option></select></label>
        <span v-else class="devices-store-name"><fa icon="store" /> {{ nomeLoja || 'Minha loja' }}</span>
        <button class="devices-refresh" type="button" :disabled="!lojaId || carregando || salvando" @click="carregar()"><fa icon="rotate" :spin="carregando" /><span>Atualizar</span></button>
      </div>
    </div>

    <div v-if="erroLojas" class="devices-alert" role="alert">{{ erroLojas }} <button type="button" @click="carregarLojas">Tentar novamente</button></div>
    <div v-if="erro" class="devices-alert" role="alert"><fa icon="triangle-exclamation" /> {{ erro }} <button :disabled="carregando || salvando" type="button" @click="carregar()">Tentar novamente</button></div>

    <div v-if="!lojaId" class="devices-choose">
      <fa icon="mobile-screen-button" /><h3>{{ auth.isSuperAdmin ? 'Escolha uma loja para começar' : 'Vincule uma loja ao seu usuário' }}</h3>
      <p>As bases e os dispositivos são organizados por loja.</p>
    </div>

    <div v-else class="devices-board" :aria-busy="carregando">
      <div class="devices-board-heading"><div><span class="devices-board-icon"><fa icon="mobile-screen-button" /></span><div><h3>Painel de dispositivos</h3><span>{{ nomeLoja || 'Minha loja' }} <span aria-hidden="true">/</span> 35 bases</span></div></div><span class="devices-sync" role="status">{{ salvando ? 'Salvando…' : carregando ? 'Atualizando…' : horaAtualizacao ? `Salvo às ${horaAtualizacao}` : 'Aguardando atualização' }}</span></div>

      <div class="devices-toolbar">
        <div class="devices-filters" role="group" aria-label="Filtrar por situação">
          <button v-for="(label, key) in labels" :key="key" type="button" :class="[{ active: filtro === key }, `filter-${key.toLowerCase()}`]" :aria-pressed="filtro === key" @click="filtro = key"><i v-if="key !== 'TODOS'"></i>{{ label }}<span>{{ contagem[key] }}</span></button>
        </div>
        <label class="devices-search"><fa icon="magnifying-glass" /><input v-model="busca" type="search" aria-label="Buscar base" placeholder="Buscar base" /></label>
      </div>

      <div v-if="carregando && !items.length" class="devices-loading" role="status"><fa icon="spinner" spin /> Carregando as bases da loja…</div>
      <template v-else-if="items.length">
        <div ref="grid" class="devices-grid"><DispositivoCard v-for="item in filtrados" :key="item.base" :item="item" :salvando="salvandoBases.has(item.base)" :editavel="auth.podeGerenciar" @alternar="mudarStatus" @aviso="abrirAviso" /></div>
        <div v-if="!filtrados.length" class="devices-no-results"><fa icon="magnifying-glass" /><h3>Nenhuma base encontrada</h3><p>Tente outro número ou situação.</p><button type="button" @click="busca = ''; filtro = 'TODOS'">Limpar filtros</button></div>
        <div class="devices-board-footer"><span>{{ filtrados.length }} de {{ items.length }} bases <span aria-hidden="true">·</span> {{ auth.podeGerenciar ? 'Clique para mudar o status' : 'Visualização dos status' }}</span><span><fa icon="rotate" /> Atualização a cada 30 s</span></div>
      </template>
    </div>
    <dialog ref="avisoDialog" class="device-warning-dialog" aria-labelledby="device-warning-title" @click="fecharForaAviso" @cancel="salvandoAviso && $event.preventDefault()" @close="avisoBase = null">
      <form v-if="avisoBase" @submit.prevent="salvarAviso(true)">
        <div class="device-warning-heading"><div><span>Base {{ String(avisoBase.base).padStart(2, '0') }}</span><h3 id="device-warning-title"><fa icon="triangle-exclamation" /> {{ avisoBase.status === 'AVISO' ? 'Aviso da base' : 'Adicionar aviso' }}</h3></div><button type="button" class="device-warning-close" aria-label="Fechar aviso" :disabled="salvandoAviso" @click="fecharAviso"><fa icon="xmark" /></button></div>
        <label class="device-warning-field" for="device-warning-note">Observação <span v-if="auth.podeGerenciar">(opcional)</span></label>
        <textarea id="device-warning-note" v-model="observacao" rows="5" maxlength="1000" :readonly="!auth.podeGerenciar" :disabled="salvandoAviso" placeholder="Ex.: Tela danificada, precisa de manutenção." autofocus></textarea>
        <div class="device-warning-count">{{ observacao.length }}/1000</div>
        <p v-if="auth.podeGerenciar" class="device-warning-hint">{{ avisoBase.status === 'AVISO' ? 'Ao remover o aviso, a base volta ao status anterior.' : 'Ao salvar, a base ficará vermelha com o status Aviso.' }}</p>
        <div v-if="erroAviso" class="device-warning-error" role="alert">{{ erroAviso }}<button v-if="conflitoAviso" type="button" :disabled="carregando" @click="reabrirAvisoAtual">Reabrir aviso atual</button></div>
        <div class="device-warning-footer"><button v-if="auth.podeGerenciar && avisoBase.status === 'AVISO'" type="button" class="device-warning-remove" :disabled="salvandoAviso || conflitoAviso" @click="salvarAviso(false)">Remover aviso</button><button type="button" class="device-warning-cancel" :disabled="salvandoAviso" @click="fecharAviso">{{ auth.podeGerenciar ? 'Cancelar' : 'Fechar' }}</button><button v-if="auth.podeGerenciar" type="submit" class="device-warning-save" :disabled="salvandoAviso || conflitoAviso"><fa :icon="salvandoAviso ? 'spinner' : 'check'" :spin="salvandoAviso" /> {{ salvandoAviso ? 'Salvando…' : 'Salvar aviso' }}</button></div>
      </form>
    </dialog>
  </section>
</template>
