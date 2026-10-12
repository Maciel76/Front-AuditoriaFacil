<script setup>
import { computed, onMounted, ref } from "vue";
import { estiloFundoPerfil } from "@/utils/fundosPerfil";
import FundoAnimado from "@/components/FundoAnimado.vue";
import MascoteGato from "@/components/MascoteGato.vue";

const props = defineProps({
  api: { type: Object, required: true },
  carteira: { type: Object, required: true },
});
const emit = defineEmits(["atualizar"]);
const catalogo = ref([]);
const carregando = ref(false);
const emAcao = ref("");
const erro = ref("");
const sucesso = ref("");
const categoria = ref("todos");
const itensVisiveis = computed(() => catalogo.value.filter((item) =>
  categoria.value === "todos" || (item.categoria || "titulo") === categoria.value,
));
const nomeCategoria = (item) => ({ fundo: "fundo", mascote: "mascote", titulo: "título" }[item.categoria] || "título");
const emUso = (item) => props.carteira[`${item.categoria || "titulo"}PerfilCodigo`] === item.codigo;
const saldo = computed(() => Number(props.carteira.saldoMoedas || 0));
const possui = (codigo) => props.carteira.itensComprados?.includes(codigo);
const formatar = (valor) => Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

async function carregar() {
  carregando.value = true;
  erro.value = "";
  try {
    const { data } = await props.api.get("/colaboradores/portal/me/loja");
    catalogo.value = data.catalogo;
    emit("atualizar", data);
  } catch (e) {
    erro.value = e.response?.data?.error || "Não foi possível abrir a loja. Tente novamente.";
  } finally {
    carregando.value = false;
  }
}

async function usarItem(item, remover = false, tipo = "titulo") {
  if (emAcao.value) return;
  emAcao.value = item?.codigo || "remover";
  erro.value = "";
  sucesso.value = "";
  const comprar = !remover && !possui(item.codigo);
  const categoriaItem = item?.categoria || tipo;
  try {
    const { data } = comprar
      ? await props.api.post("/colaboradores/portal/me/loja/compras", { codigo: item.codigo })
      : await props.api.patch(`/colaboradores/portal/me/loja/${categoriaItem}`, { codigo: remover ? "" : item.codigo });
    emit("atualizar", data);
    sucesso.value = remover
      ? categoriaItem === "fundo" ? "Fundo padrão aplicado. Seus fundos continuam na coleção." : categoriaItem === "mascote" ? "Mascote removido do perfil. Ele continua na sua coleção." : "Título removido do perfil. Ele continua na sua coleção."
      : comprar ? `${item.nome} comprado e aplicado ao seu perfil!` : `${item.nome} aplicado ao seu perfil.`;
  } catch (e) {
    erro.value = e.response?.data?.error || "Não foi possível concluir. Tente novamente.";
  } finally {
    emAcao.value = "";
  }
}

onMounted(carregar);
</script>

<template>
  <main class="app-content loja-portal">
    <section class="card loja-cabecalho">
      <div>
        <span class="loja-sobre"><fa icon="store" /> LOJA DO PORTAL</span>
        <h2>Seu esforço vira recompensa</h2>
        <p class="muted">Use suas moedas para personalizar o perfil.</p>
      </div>
      <div class="loja-carteira" aria-label="Saldo disponível">
        <fa icon="coins" />
        <div><strong>{{ formatar(saldo) }}</strong><small>moedas disponíveis</small></div>
      </div>
      <p class="loja-regra muted">Cada ponto acumulado vale 1 moeda. Ganhe com auditorias e conquistas. As compras preservam seu nível e XP.</p>
    </section>

    <section v-if="carteira.tituloPerfil" class="card loja-equipado">
      <div>
        <small class="muted">NO SEU PERFIL</small>
        <strong :style="{ color: carteira.tituloPerfil.cor }"><fa :icon="carteira.tituloPerfil.icone" /> {{ carteira.tituloPerfil.nome }}</strong>
      </div>
      <button class="btn ghost small" :disabled="!!emAcao || carregando" @click="usarItem(null, true)">Remover título</button>
    </section>

    <section v-if="carteira.fundoPerfil" class="card loja-equipado fundo-personalizado" :style="estiloFundoPerfil(carteira.fundoPerfil)">
      <FundoAnimado :fundo="carteira.fundoPerfil" />
      <div>
        <small class="muted">FUNDO ATUAL</small>
        <strong>{{ carteira.fundoPerfil.nome }}</strong>
      </div>
      <button class="btn ghost small" :disabled="!!emAcao || carregando" @click="usarItem(null, true, 'fundo')">Usar fundo padrão</button>
    </section>

    <section v-if="carteira.mascotePerfil" class="card loja-equipado">
      <div><small class="muted">MASCOTE ATUAL</small><strong>{{ carteira.mascotePerfil.nome }}</strong></div>
      <button class="btn ghost small" :disabled="!!emAcao || carregando" @click="usarItem(null, true, 'mascote')">Remover mascote</button>
    </section>

    <div v-if="erro" class="card loja-erro" role="alert">
      <p>{{ erro }}</p>
      <button class="btn ghost" :disabled="carregando || !!emAcao" @click="carregar">Atualizar loja</button>
    </div>
    <p v-if="sucesso" class="badge ok" role="status">{{ sucesso }}</p>
    <p v-if="carregando" class="muted" role="status"><fa icon="spinner" spin /> Carregando loja…</p>

    <nav v-if="catalogo.length" class="loja-filtros" aria-label="Categorias da loja">
      <button v-for="filtro in [{codigo:'todos',nome:'Todos'},{codigo:'mascote',nome:'Mascotes'},{codigo:'fundo',nome:'Fundos'},{codigo:'titulo',nome:'Títulos'}]" :key="filtro.codigo" class="btn ghost" :class="{ 'filtro-ativo': categoria === filtro.codigo }" :aria-pressed="categoria === filtro.codigo" @click="categoria = filtro.codigo">{{ filtro.nome }}</button>
    </nav>
    <section v-if="catalogo.length" class="loja-catalogo" aria-label="Itens de personalização">
      <article v-for="item in itensVisiveis" :key="item.codigo" class="card loja-produto" :style="{ '--item-cor': item.cor }">
        <div class="loja-previa fundo-personalizado" :class="{ 'loja-previa-fundo': item.categoria === 'fundo' }" :style="item.categoria === 'fundo' ? estiloFundoPerfil(item) : {}">
          <FundoAnimado v-if="item.categoria === 'fundo'" :fundo="item" />
          <MascoteGato v-if="item.categoria === 'mascote'" :key="item.codigo" :codigo="item.codigo" previa class="loja-mascote" />
          <span v-else-if="item.categoria !== 'fundo'" class="loja-produto-icone"><fa :icon="item.icone" /></span>
          <template v-if="item.categoria !== 'fundo'">
            <strong>{{ item.nome }}</strong>
            <span v-if="emUso(item)" class="badge ok">Em uso</span>
            <span v-else-if="possui(item.codigo)" class="badge info">Na sua coleção</span>
          </template>
        </div>
        <div class="loja-produto-info">
          <small class="muted">{{ item.tipo }}</small>
          <h3>{{ item.nome }}</h3>
          <template v-if="item.categoria === 'fundo'">
            <span v-if="emUso(item)" class="badge ok">Em uso</span>
            <span v-else-if="possui(item.codigo)" class="badge info">Na sua coleção</span>
          </template>
          <p class="muted">{{ item.descricao }}</p>
          <span class="loja-preco"><fa icon="coins" /> {{ formatar(item.preco) }} moedas</span>
          <button
            class="btn primary full-w"
            :disabled="carregando || !!emAcao || emUso(item) || (!possui(item.codigo) && saldo < item.preco)"
            :aria-label="possui(item.codigo) ? 'Usar ' + nomeCategoria(item) + ' ' + item.nome : 'Comprar ' + item.nome + ' por ' + formatar(item.preco) + ' moedas'"
            @click="usarItem(item)"
          >
            {{ emAcao === item.codigo ? 'Aguarde…' : emUso(item) ? 'Em uso' : possui(item.codigo) ? 'Usar ' + nomeCategoria(item) : saldo < item.preco ? 'Moedas insuficientes' : 'Comprar por ' + formatar(item.preco) }}
          </button>
        </div>
      </article>
    </section>
    <small class="muted"><a href="/licenses/mascotes-lottie.txt" target="_blank" rel="noopener noreferrer">Créditos e licença dos novos mascotes</a></small>
  </main>
</template>

<style scoped>
.loja-mascote { margin: 0 auto; }
.loja-cabecalho { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px; padding: 22px; }
.loja-sobre { display: inline-flex; align-items: center; gap: 8px; color: var(--text-dim); font-size: 11px; font-weight: 800; letter-spacing: 1px; }
.loja-cabecalho h2 { margin: 10px 0 6px; font-size: clamp(20px, 3vw, 26px); }
.loja-cabecalho p { margin: 0; font-size: 13px; }
.loja-carteira { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-radius: 18px; background: rgba(245,158,11,.12); color: #b77908; }
.loja-carteira > svg { font-size: 30px; }
.loja-carteira div { display: grid; gap: 2px; }
.loja-carteira strong { color: var(--text); font-size: 25px; }
.loja-carteira small { font-size: 11px; }
.loja-regra { flex-basis: 100%; line-height: 1.6; }
.loja-equipado { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; padding: 18px; }
.loja-equipado div { display: grid; gap: 6px; }
.loja-equipado small { font-size: 10px; }
.loja-catalogo { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr)); gap: 14px; }
.loja-filtros { display: flex; flex-wrap: wrap; gap: 8px; }
.loja-filtros .filtro-ativo { border-color: var(--primary); box-shadow: inset 0 0 0 1px var(--primary); }
.loja-previa-fundo strong { color: var(--text); }
.loja-previa-fundo small { font-size: 10px; letter-spacing: 1px; }
.loja-produto { overflow: hidden; padding: 0; display: flex; flex-direction: column; }
.loja-previa { display: grid; justify-items: center; align-content: center; gap: 12px; min-height: 180px; padding: 22px 12px; color: var(--item-cor); background: color-mix(in srgb, var(--item-cor) 12%, transparent); }
.loja-produto-icone { display: grid; place-items: center; width: 68px; height: 68px; border-radius: 50%; border: 1px solid var(--item-cor); background: var(--surface); font-size: 30px; }
.loja-produto-info { display: grid; gap: 10px; padding: 18px; flex: 1; }
.loja-produto-info h3, .loja-produto-info p { margin: 0; }
.loja-produto-info h3 { font-size: 17px; }
.loja-produto-info p { font-size: 13px; line-height: 1.5; }
.loja-produto-info small { font-size: 11px; }
.loja-preco { color: #b77908; font-size: 14px; font-weight: 800; align-self: end; }
.loja-erro { padding: 16px; color: var(--danger); }
.loja-erro p { margin-top: 0; }
</style>
