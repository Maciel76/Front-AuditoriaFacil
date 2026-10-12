<script setup>
import { computed, onMounted, ref } from "vue";
import api from "@/services/api";

const busca = ref("");
const items = ref([]);
const total = ref(0);
const pagina = ref(1);
const selecionados = ref([]);
const quantidade = ref(100);
const motivo = ref("");
const carregando = ref(false);
const enviando = ref(false);
const pendente = ref(null);
const erro = ref("");
const sucesso = ref("");
const paginas = computed(() => Math.max(1, Math.ceil(total.value / 20)));
const valido = computed(() => selecionados.value.length > 0 && selecionados.value.length <= 100 && Number.isInteger(quantidade.value) && quantidade.value > 0 && quantidade.value <= 1000000000 && motivo.value.trim().length >= 3);
const formatar = (valor) => Number(valor || 0).toLocaleString("pt-BR");
const escolhido = (id) => selecionados.value.some((item) => item._id === id);

async function carregar(page = 1) {
  if (carregando.value) return;
  carregando.value = true;
  erro.value = "";
  try {
    const { data } = await api.get("/admin/loja-portal/colaboradores", { params: { q: busca.value.trim(), page } });
    items.value = data.items;
    total.value = data.total;
    pagina.value = data.page;
  } catch (e) {
    erro.value = e.response?.data?.error || "Não foi possível buscar os colaboradores.";
  } finally {
    carregando.value = false;
  }
}

function selecionar(item) {
  if (enviando.value || pendente.value) return;
  sucesso.value = "";
  if (escolhido(item._id)) selecionados.value = selecionados.value.filter((pessoa) => pessoa._id !== item._id);
  else if (selecionados.value.length < 100) selecionados.value.push(item);
}

async function creditar() {
  if (enviando.value || (!pendente.value && !valido.value)) return;
  pendente.value ||= {
    colaboradores: selecionados.value.map((item) => item._id),
    quantidade: quantidade.value,
    motivo: motivo.value.trim(),
    operacao: crypto.randomUUID(),
  };
  enviando.value = true;
  erro.value = "";
  sucesso.value = "";
  try {
    const { data } = await api.post("/admin/loja-portal/moedas", pendente.value);
    if (data.creditados !== pendente.value.colaboradores.length) {
      erro.value = "Alguns créditos ainda não foram confirmados. Clique em tentar novamente para concluir sem duplicar moedas.";
      return;
    }
    sucesso.value = `${formatar(data.quantidade)} moedas adicionadas para cada um dos ${data.creditados} colaboradores selecionados.`;
    pendente.value = null;
    selecionados.value = [];
    motivo.value = "";
    await carregar(pagina.value);
  } catch (e) {
    if (e.response?.status === 400 || e.response?.status === 403) pendente.value = null;
    erro.value = e.response?.data?.error || "Não foi possível confirmar o crédito. Tente novamente; as moedas não serão duplicadas.";
  } finally {
    enviando.value = false;
  }
}
onMounted(() => carregar());
</script>

<template>
  <section class="card creditos">
    <div>
      <h2><fa icon="coins" /> Adicionar moedas</h2>
      <p class="muted">Escolha os colaboradores e defina quantas moedas cada um receberá. O crédito não altera XP, nível ou ranking.</p>
    </div>
    <form class="busca" @submit.prevent="carregar(1)">
      <label for="busca-moedas">Buscar por nome ou matrícula</label>
      <div><input id="busca-moedas" v-model="busca" type="search" maxlength="100" placeholder="Nome ou matrícula" /><button class="btn ghost" :disabled="carregando">{{ carregando ? 'Buscando…' : 'Buscar' }}</button></div>
    </form>
    <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
    <p v-if="sucesso" class="badge ok" role="status">{{ sucesso }}</p>
    <p v-if="carregando" class="muted" role="status">Carregando colaboradores…</p>
    <div v-else class="pessoas">
      <p v-if="!items.length" class="muted">Nenhum colaborador encontrado.</p>
      <label v-for="item in items" :key="item._id" class="pessoa" :class="{ marcada: escolhido(item._id) }">
        <input type="checkbox" :checked="escolhido(item._id)" :disabled="enviando || !!pendente || (!escolhido(item._id) && selecionados.length >= 100)" @change="selecionar(item)" />
        <span class="identidade"><strong>{{ item.nome }}</strong><small class="muted">Matrícula {{ item.codigoExterno }} · {{ item.loja?.nome || 'Loja indisponível' }}</small></span>
        <span class="saldo"><fa icon="coins" /> {{ formatar(item.saldoMoedas) }}<small class="muted">saldo atual</small></span>
      </label>
    </div>
    <div class="paginacao">
      <button type="button" class="btn ghost small" :disabled="carregando || pagina <= 1" @click="carregar(pagina - 1)">Anterior</button>
      <small class="muted">Página {{ pagina }} de {{ paginas }} · {{ total }} colaboradores</small>
      <button type="button" class="btn ghost small" :disabled="carregando || pagina >= paginas" @click="carregar(pagina + 1)">Próxima</button>
    </div>
    <div v-if="selecionados.length" class="selecao">
      <strong>{{ selecionados.length }} selecionados (até 100)</strong>
      <div class="chips"><button v-for="item in selecionados" :key="item._id" type="button" class="btn ghost small" :disabled="enviando || !!pendente" :aria-label="'Remover ' + item.nome + ' da seleção'" @click="selecionar(item)">{{ item.nome }} · {{ item.codigoExterno }} ×</button></div>
    </div>
    <form class="form-credito" @submit.prevent="creditar">
      <label for="quantidade-moedas">Moedas por colaborador<input id="quantidade-moedas" v-model.number="quantidade" type="number" min="1" max="1000000000" step="1" required :disabled="enviando || !!pendente" /></label>
      <label for="motivo-moedas">Motivo do crédito<input id="motivo-moedas" v-model="motivo" maxlength="200" minlength="3" placeholder="Ex.: reconhecimento pela participação" required :disabled="enviando || !!pendente" /></label>
      <div class="resumo">
        <p><strong>{{ formatar(quantidade) }}</strong> moedas por pessoa · <strong>{{ selecionados.length }}</strong> selecionados · Total: <strong>{{ formatar((Number(quantidade) || 0) * selecionados.length) }}</strong> moedas</p>
        <button class="btn primary" :disabled="enviando || (!pendente && !valido)"><fa icon="coins" /> {{ enviando ? 'Adicionando…' : pendente ? 'Tentar crédito novamente' : 'Adicionar moedas aos selecionados' }}</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.creditos { padding: 24px; display: grid; gap: 18px; }
h2, p { margin: 0; }
.creditos > div > p { margin-top: 8px; line-height: 1.6; }
.busca, .form-credito label { display: grid; gap: 8px; }
.busca > div { display: flex; gap: 8px; }
.busca input { flex: 1; min-width: 0; }
.pessoas { max-height: 360px; overflow-y: auto; display: grid; gap: 6px; }
.pessoa { display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid var(--border); border-radius: 12px; cursor: pointer; }
.pessoa.marcada { border-color: var(--primary); }
.pessoa input { width: 18px; height: 18px; flex: 0 0 auto; }
.identidade { display: grid; gap: 4px; min-width: 0; overflow-wrap: anywhere; }
.saldo { margin-left: auto; text-align: right; white-space: nowrap; }
.saldo small { display: block; margin-top: 4px; }
.paginacao { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; }
.selecao { display: grid; gap: 10px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.form-credito { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 16px; }
.form-credito input { width: 100%; min-width: 0; }
.resumo { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; }
.erro { color: var(--danger); }
@media (max-width: 600px) { .creditos { padding: 16px; } .form-credito { grid-template-columns: minmax(0, 1fr); } .resumo button { width: 100%; } .pessoa { gap: 8px; padding: 10px; } .saldo { font-size: 12px; } }
</style>
