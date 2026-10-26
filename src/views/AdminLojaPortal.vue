<script setup>
import { computed, onMounted, ref } from "vue";
import api from "@/services/api";
import Loader from "@/components/Loader.vue";
import MascoteGato from "@/components/MascoteGato.vue";
import { estiloFundoPerfil } from "@/utils/fundosPerfil";
import MolduraPerfil from "@/components/MolduraPerfil.vue";
import FundoAnimado from "@/components/FundoAnimado.vue";
import AdminMoedasPortal from "@/components/AdminMoedasPortal.vue";

const catalogo = ref([]);
const carregando = ref(false);
const salvando = ref(false);
const erro = ref("");
const sucesso = ref("");
const categoria = ref("todos");
const categorias = [
  { codigo: "todos", nome: "Todos" },
  { codigo: "mascote", nome: "Mascotes" },
  { codigo: "fundo", nome: "Fundos" },
  { codigo: "moldura", nome: "Molduras" },
  { codigo: "titulo", nome: "Títulos" },
];
const visiveis = computed(() => catalogo.value.filter((item) => categoria.value === "todos" || item.categoria === categoria.value));
const alterados = computed(() => catalogo.value.filter((item) => item.novoPreco !== item.preco));
const invalido = computed(() => catalogo.value.some((item) => !Number.isInteger(item.novoPreco) || item.novoPreco < 0 || item.novoPreco > 1000000000));
const formatar = (valor) => Number(valor).toLocaleString("pt-BR");

function aplicarCatalogo(itens) {
  catalogo.value = itens.map((item) => ({ ...item, novoPreco: item.preco }));
}

async function carregar() {
  carregando.value = true;
  erro.value = "";
  try {
    const { data } = await api.get("/admin/loja-portal");
    aplicarCatalogo(data.catalogo);
  } catch (e) {
    erro.value = e.response?.data?.error || "Não foi possível carregar os preços da loja.";
  } finally {
    carregando.value = false;
  }
}

async function salvar() {
  if (salvando.value || invalido.value || !alterados.value.length) return;
  salvando.value = true;
  erro.value = "";
  sucesso.value = "";
  try {
    const { data } = await api.put("/admin/loja-portal", {
      itens: alterados.value.map((item) => ({ codigo: item.codigo, preco: item.novoPreco })),
    });
    aplicarCatalogo(data.catalogo);
    sucesso.value = "Preços salvos! Os novos valores já estão disponíveis na loja dos colaboradores.";
  } catch (e) {
    erro.value = e.response?.data?.error || "Não foi possível salvar os preços. Tente novamente.";
  } finally {
    salvando.value = false;
  }
}

function descartar() {
  catalogo.value.forEach((item) => { item.novoPreco = item.preco; });
  sucesso.value = "";
}
onMounted(carregar);
</script>

<template>
  <main class="app-content admin-loja">
    <AdminMoedasPortal />
    <section class="card cabecalho">
      <div>
        <span class="eyebrow"><fa icon="store" /> LOJA DO PORTAL</span>
        <h2>Preços dos itens</h2>
        <p class="muted">Defina quantas moedas os colaboradores precisam para comprar cada item.</p>
        <p class="muted regra">Os valores são globais para todas as lojas. Alterações valem para novas compras; itens já comprados permanecem na coleção.</p>
      </div>
      <span class="badge info">{{ catalogo.length }} itens no catálogo</span>
    </section>

    <p v-if="erro" class="card mensagem erro" role="alert">{{ erro }} <button v-if="!catalogo.length" class="btn ghost small" :disabled="carregando" @click="carregar">Tentar novamente</button></p>
    <p v-if="sucesso" class="badge ok mensagem" role="status">{{ sucesso }}</p>
    <Loader v-if="carregando" :rows="4" />

    <form v-else-if="catalogo.length" @submit.prevent="salvar" @input="sucesso = ''">
      <nav class="filtros" aria-label="Categorias de itens">
        <button v-for="filtro in categorias" :key="filtro.codigo" type="button" class="btn ghost" :class="{ ativo: categoria === filtro.codigo }" :aria-pressed="categoria === filtro.codigo" @click="categoria = filtro.codigo">{{ filtro.nome }}</button>
      </nav>
      <section class="catalogo" aria-label="Preços do catálogo">
        <article v-for="item in visiveis" :key="item.codigo" class="card produto">
          <div class="previa fundo-personalizado" :style="item.categoria === 'fundo' ? estiloFundoPerfil(item) : { color: item.cor, background: `color-mix(in srgb, ${item.cor} 12%, transparent)` }">
            <MolduraPerfil v-if="item.categoria === 'moldura'" :moldura="item" />
            <FundoAnimado v-if="item.categoria === 'fundo'" :fundo="item" />
            <MascoteGato v-if="item.categoria === 'mascote'" :key="item.codigo" :codigo="item.codigo" previa />
            <fa v-else :icon="item.icone" class="icone" />
            <strong>{{ item.nome }}</strong>
          </div>
          <div class="info">
            <small class="muted">{{ item.tipo }}</small>
            <h3>{{ item.nome }}</h3>
            <p class="muted descricao">{{ item.descricao }}</p>
            <label :for="'preco-' + item.codigo"><fa icon="coins" /> Preço em moedas</label>
            <input :id="'preco-' + item.codigo" v-model.number="item.novoPreco" type="number" min="0" max="1000000000" step="1" required :disabled="salvando" />
            <small class="muted">Preço salvo: {{ formatar(item.preco) }} moedas</small>
            <span v-if="item.novoPreco !== item.preco" class="badge info">Alteração pendente</span>
          </div>
        </article>
      </section>
      <footer class="card acoes">
        <div>
          <strong>{{ alterados.length }} {{ alterados.length === 1 ? 'preço alterado' : 'preços alterados' }}</strong>
          <small class="muted">Use números inteiros a partir de zero. Zero torna o item gratuito.</small>
          <small v-if="invalido" class="erro" role="alert">Informe preços inteiros entre 0 e 1.000.000.000 moedas.</small>
        </div>
        <button type="button" class="btn ghost" :disabled="salvando || !alterados.length" @click="descartar">Descartar alterações</button>
        <button type="submit" class="btn primary" :disabled="salvando || invalido || !alterados.length"><fa v-if="salvando" icon="spinner" spin /> {{ salvando ? 'Salvando…' : 'Salvar preços' }}</button>
      </footer>
    </form>
  </main>
</template>

<style scoped>
.admin-loja { display: grid; gap: 18px; }
.cabecalho { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 18px; padding: 24px; }
.eyebrow { display: inline-flex; gap: 8px; font-size: 11px; font-weight: 800; letter-spacing: 1px; color: var(--text-dim); }
h2 { margin: 12px 0 8px; }
.cabecalho p { margin: 0; line-height: 1.6; }
.cabecalho .regra { margin-top: 10px; font-size: 13px; max-width: 760px; }
form { display: grid; gap: 18px; }
.filtros { display: flex; flex-wrap: wrap; gap: 8px; }
.ativo { border-color: var(--primary); box-shadow: inset 0 0 0 1px var(--primary); }
.catalogo { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 16px; }
.produto { overflow: hidden; padding: 0; display: flex; flex-direction: column; }
.previa { min-height: 180px; display: grid; justify-items: center; align-content: center; gap: 16px; padding: 20px; }
.icone { font-size: 38px; }
.info { display: grid; gap: 10px; padding: 20px; flex: 1; align-content: start; }
.info h3, .info p { margin: 0; }
.descricao { font-size: 13px; line-height: 1.6; min-height: 64px; }
.info label { font-weight: 700; font-size: 13px; }
.info input { width: 100%; min-width: 0; }
.info .badge { justify-self: start; }
.acoes { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 18px; }
.acoes > div { display: grid; gap: 6px; margin-right: auto; }
.erro { color: var(--danger); }
.mensagem { padding: 16px; margin: 0; }
@media (max-width: 600px) { .acoes .btn { width: 100%; } }
</style>
