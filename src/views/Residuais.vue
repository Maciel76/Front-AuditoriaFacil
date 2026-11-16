<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import api from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { lerLojaDestinoAuditorias } from "@/utils/auditoriasContext";
import ResidualEtiqueta from "@/components/ResidualEtiqueta.vue";
import "@/styles/residuais.css";

const auth = useAuthStore();
const route = useRoute();
const lojas = ref([]);
const lojaSelecionada = ref(typeof route.query.lojaId === "string" ? route.query.lojaId : "");
const lojaId = computed(() => auth.isSuperAdmin ? lojaSelecionada.value : auth.loja?._id || auth.usuario?.loja?._id || auth.usuario?.loja || "");
const auditoriaSelecionada = ref(typeof route.query.auditoriaId === "string" ? route.query.auditoriaId : "");
const auditorias = ref([]);
const auditoria = ref(null);
const nomeLoja = ref("");
const items = ref([]);
const resumo = ref(null);
const busca = ref("");
const corredor = ref("");
const pagina = ref(1);
const porPagina = 24;
const selecionados = ref(new Set());
const carregando = ref(false);
const carregandoLojas = ref(false);
const erro = ref("");
const erroLojas = ref("");
const preparandoImpressao = ref(false);
const etiquetasImpressao = ref([]);
const cabecalhoImpressao = ref("");
let requestId = 0;
let controller;
let disposed = false;

const numero = (valor) => Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const normalizar = (valor) => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const dataCurta = (valor) => valor ? new Date(valor).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "";
const tipoNome = (tipo) => ({ ETIQUETA: "Etiqueta", PRESENCA: "Presença", RUPTURA: "Ruptura" })[tipo] || tipo;
const locais = computed(() => [...new Set(items.value.map((item) => item.local))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })));
const filtrados = computed(() => {
  const texto = normalizar(busca.value.trim());
  return items.value.filter((item) =>
    (!corredor.value || (item.local || "__sem_local__") === corredor.value) &&
    (!texto || normalizar(`${item.codigo} ${item.produto} ${item.classeRaiz} ${item.classe} ${item.local}`).includes(texto)));
});
const totalPaginas = computed(() => Math.max(1, Math.ceil(filtrados.value.length / porPagina)));
const visiveis = computed(() => filtrados.value.slice((pagina.value - 1) * porPagina, pagina.value * porPagina));
const quantidadeFiltrada = computed(() => filtrados.value.reduce((total, item) => total + item.estoqueAtual, 0));
const selecionadosFiltrados = computed(() => filtrados.value.filter((item) => selecionados.value.has(item.codigo)));
const todosSelecionados = computed(() => filtrados.value.length > 0 && selecionadosFiltrados.value.length === filtrados.value.length);
const podeImprimir = computed(() => !carregando.value && !erro.value && !preparandoImpressao.value);

async function carregar() {
  const id = ++requestId;
  controller?.abort();
  controller = new AbortController();
  items.value = [];
  resumo.value = null;
  auditoria.value = null;
  selecionados.value = new Set();
  pagina.value = 1;
  erro.value = "";
  if (!lojaId.value) { carregando.value = false; return; }
  carregando.value = true;
  try {
    const { data } = await api.get("/residuais", {
      params: { lojaId: lojaId.value, ...(auditoriaSelecionada.value ? { auditoriaId: auditoriaSelecionada.value } : {}) },
      signal: controller.signal,
    });
    if (disposed || id !== requestId) return;
    items.value = data.items;
    resumo.value = data.resumo;
    auditoria.value = data.auditoria;
    auditorias.value = data.auditorias;
    nomeLoja.value = data.loja.nome;
    if (corredor.value && !locais.value.some((local) => (local || "__sem_local__") === corredor.value)) corredor.value = "";
  } catch (error) {
    if (!disposed && id === requestId && error.code !== "ERR_CANCELED") {
      erro.value = error.response?.data?.error || "Não foi possível carregar os residuais. Tente novamente.";
    }
  } finally {
    if (!disposed && id === requestId) carregando.value = false;
  }
}

async function carregarLojas() {
  carregandoLojas.value = true;
  erroLojas.value = "";
  try {
    const { data } = await api.get("/lojas");
    if (disposed) return;
    lojas.value = data.items || [];
    const preferida = lojaSelecionada.value || lerLojaDestinoAuditorias();
    lojaSelecionada.value = lojas.value.some((loja) => loja._id === preferida) ? preferida : lojas.value.length === 1 ? lojas.value[0]._id : "";
  } catch {
    if (!disposed) erroLojas.value = "Não foi possível carregar as lojas.";
  } finally {
    if (!disposed) carregandoLojas.value = false;
  }
}

function alternarProduto(codigo) {
  if (selecionados.value.has(codigo)) selecionados.value.delete(codigo);
  else selecionados.value.add(codigo);
}
function alternarTodos() {
  const remover = todosSelecionados.value;
  for (const item of filtrados.value) {
    if (remover) selecionados.value.delete(item.codigo);
    else selecionados.value.add(item.codigo);
  }
}
function finalizarImpressao() {
  document.body.classList.remove("printing-residuais");
  etiquetasImpressao.value = [];
  preparandoImpressao.value = false;
}
async function imprimir(produtos) {
  if (!podeImprimir.value || !produtos.length) return;
  preparandoImpressao.value = true;
  etiquetasImpressao.value = [...produtos];
  cabecalhoImpressao.value = `${nomeLoja.value} • ${dataCurta(auditoria.value.data)} • ${tipoNome(auditoria.value.tipo)}`;
  try {
    await nextTick();
    if (disposed) return;
    document.body.classList.add("printing-residuais");
    // Aguarda o navegador desenhar todos os SVGs antes de abrir a impressão.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (disposed) return;
    window.print();
  } catch {
    finalizarImpressao();
    erro.value = "Não foi possível abrir a impressão. Atualize a lista e tente novamente.";
  }
}

watch([busca, corredor], () => { pagina.value = 1; });
watch(lojaId, (_atual, anterior) => {
  if (anterior !== undefined) auditoriaSelecionada.value = "";
  auditorias.value = [];
  busca.value = "";
  corredor.value = "";
  carregar();
}, { immediate: true });
onMounted(() => {
  window.addEventListener("afterprint", finalizarImpressao);
  if (auth.isSuperAdmin) carregarLojas();
});
onBeforeUnmount(() => {
  disposed = true;
  ++requestId;
  controller?.abort();
  window.removeEventListener("afterprint", finalizarImpressao);
  finalizarImpressao();
});
</script>

<template>
  <section class="residuais-page" :aria-busy="carregando">
    <div class="residuais-heading">
      <div>
        <h2>Residuais para conferência</h2>
        <p class="muted">Localize os produtos e bipe o QR code com o coletor.</p>
      </div>
      <button class="btn primary" :disabled="!podeImprimir || !filtrados.length" @click="imprimir(filtrados)">
        <fa :icon="preparandoImpressao ? 'spinner' : 'print'" :spin="preparandoImpressao" />
        {{ preparandoImpressao ? 'Preparando etiquetas…' : `Imprimir filtrados (${numero(filtrados.length)})` }}
      </button>
    </div>

    <div class="residuais-regras" aria-label="Critérios dos residuais">
      <span><fa icon="calendar" /> Mais de 10 dias sem venda</span>
      <span><fa icon="boxes-stacked" /> Estoque maior que 0 e menor que 10</span>
      <span><fa icon="filter" /> Exclui bazar, cigarro, whisky e vinho</span>
    </div>

    <div class="card residuais-filtros">
      <label v-if="auth.isSuperAdmin" class="residuais-campo">
        <span>Loja</span>
        <select v-model="lojaSelecionada" aria-label="Loja" :disabled="carregandoLojas || preparandoImpressao">
          <option value="">{{ carregandoLojas ? 'Carregando lojas…' : 'Selecione uma loja' }}</option>
          <option v-for="loja in lojas" :key="loja._id" :value="loja._id">{{ loja.nome }}</option>
        </select>
      </label>
      <label class="residuais-campo residuais-campo-auditoria">
        <span>Auditoria de referência</span>
        <select v-model="auditoriaSelecionada" aria-label="Auditoria de referência" :disabled="!lojaId || carregando || preparandoImpressao" @change="carregar">
          <option value="">Mais recente com estoque e dias sem venda</option>
          <option v-for="item in auditorias" :key="item._id" :value="item._id">
            {{ dataCurta(item.data) }} · {{ tipoNome(item.tipo) }} · {{ item.arquivoOriginal || 'Planilha' }}{{ item.temDadosResiduais === false ? ' (sem dados para residuais)' : '' }}
          </option>
        </select>
      </label>
      <button class="btn ghost residuais-atualizar" :disabled="!lojaId || carregando || preparandoImpressao" @click="carregar">
        <fa icon="rotate" :spin="carregando" /> Atualizar
      </button>
    </div>

    <div v-if="erroLojas" class="residuais-erro" role="alert">
      <span>{{ erroLojas }}</span>
      <button class="btn ghost" @click="carregarLojas">Tentar novamente</button>
    </div>
    <div v-if="erro" class="residuais-erro" role="alert">
      <span>{{ erro }}</span>
      <button class="btn ghost" @click="carregar">Tentar novamente</button>
    </div>
    <div v-else-if="!lojaId" class="empty">
      <fa icon="store" />
      <h3>{{ auth.isSuperAdmin ? 'Selecione uma loja' : 'Nenhuma loja vinculada' }}</h3>
      <p class="muted">Os residuais são consultados por loja.</p>
    </div>
    <div v-else-if="carregando" class="empty" role="status">
      <fa icon="spinner" spin />
      <p>Filtrando os produtos da auditoria…</p>
    </div>
    <div v-else-if="!auditoria" class="empty">
      <fa icon="clipboard-check" />
      <h3>Nenhuma auditoria concluída nesta loja</h3>
      <p class="muted">Importe uma planilha com estoque atual e dias sem venda para gerar os residuais.</p>
      <RouterLink v-if="auth.podeGerenciar" :to="{ path: '/auditorias', query: { lojaId } }" class="btn primary">Ir para auditorias</RouterLink>
    </div>
    <template v-else>
      <div class="residuais-origem">
        <div>
          <strong>{{ nomeLoja }}</strong>
          <span>{{ dataCurta(auditoria.data) }} · {{ tipoNome(auditoria.tipo) }}</span>
          <small class="muted">{{ auditoria.arquivoOriginal }}</small>
        </div>
        <p class="muted">Estoque e dias sem venda conforme a planilha desta auditoria.</p>
      </div>
      <p v-if="resumo?.semDados" class="residuais-sem-dados muted">
        {{ numero(resumo.semDados) }} produto(s) sem estoque ou dias sem venda informados ficaram fora da lista.
      </p>

      <div class="residuais-busca">
        <label class="residuais-campo residuais-campo-busca">
          <span>Buscar produto</span>
          <input v-model="busca" type="search" placeholder="Código, descrição ou classe" />
        </label>
        <label class="residuais-campo">
          <span>Corredor</span>
          <select v-model="corredor" aria-label="Corredor">
            <option value="">Todos os corredores</option>
            <option v-for="local in locais" :key="local" :value="local || '__sem_local__'">{{ local || 'Sem corredor' }}</option>
          </select>
        </label>
      </div>

      <div class="residuais-lista-cabecalho" aria-live="polite">
        <div class="residuais-totais">
          <strong>{{ numero(filtrados.length) }} produto(s)</strong>
          <span class="muted">{{ numero(quantidadeFiltrada) }} em estoque</span>
        </div>
        <div v-if="filtrados.length" class="residuais-selecao">
          <label class="residuais-check">
            <input type="checkbox" :checked="todosSelecionados" :indeterminate="selecionadosFiltrados.length > 0 && !todosSelecionados" @change="alternarTodos" />
            Selecionar filtrados
          </label>
          <button class="btn ghost" :disabled="!podeImprimir || !selecionadosFiltrados.length" @click="imprimir(selecionadosFiltrados)">
            <fa icon="print" /> Selecionados ({{ numero(selecionadosFiltrados.length) }})
          </button>
        </div>
      </div>

      <div v-if="!filtrados.length" class="empty">
        <fa icon="boxes-stacked" />
        <h3>{{ items.length ? 'Nenhum produto corresponde à busca' : 'Nenhum residual nesta auditoria' }}</h3>
        <p class="muted">{{ items.length ? 'Tente outro código, descrição ou corredor.' : 'Nenhum produto atende a todos os critérios dos residuais.' }}</p>
        <button v-if="busca || corredor" class="btn ghost" @click="busca = ''; corredor = ''">Limpar busca e corredor</button>
      </div>
      <div v-else class="residuais-grid">
        <div v-for="item in visiveis" :key="item.codigo" class="residuais-produto" :class="{ selecionado: selecionados.has(item.codigo) }">
          <div class="residuais-produto-topo">
            <label class="residuais-check">
              <input type="checkbox" :checked="selecionados.has(item.codigo)" :aria-label="`Selecionar produto ${item.codigo}`" @change="alternarProduto(item.codigo)" />
              {{ numero(item.diasSemVenda) }} dias sem venda
            </label>
          </div>
          <ResidualEtiqueta :produto="item" />
          <p class="residuais-produto-classe muted">{{ [item.classeRaiz, item.classe].filter(Boolean).join(' / ') || 'Sem classe informada' }}</p>
        </div>
      </div>

      <nav v-if="totalPaginas > 1" class="residuais-paginacao" aria-label="Páginas de residuais">
        <button class="btn ghost" :disabled="pagina === 1" @click="pagina--">Anterior</button>
        <span class="muted">Página {{ pagina }} de {{ totalPaginas }}</span>
        <button class="btn ghost" :disabled="pagina === totalPaginas" @click="pagina++">Próxima</button>
      </nav>
      <p v-if="filtrados.length" class="residuais-rodape muted">O QR code contém somente o código do produto. A impressão inclui todos os filtrados ou selecionados, mesmo em outras páginas. Use papel A4, escala 100%, ou salve como PDF.</p>
    </template>
  </section>

  <Teleport to="body">
    <div v-if="etiquetasImpressao.length" class="residuais-print">
      <header class="residuais-print-cabecalho">
        <strong>Residuais</strong>
        <span>{{ cabecalhoImpressao }} · {{ etiquetasImpressao.length }} produto(s)</span>
      </header>
      <div class="residuais-print-grid">
        <ResidualEtiqueta v-for="item in etiquetasImpressao" :key="item.codigo" :produto="item" />
      </div>
    </div>
  </Teleport>
</template>
