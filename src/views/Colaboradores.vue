<script setup>
import { ref, computed, onMounted, watch } from "vue";
import api from "@/services/api";
import ColaboradorAvatar from "@/components/ColaboradorAvatar.vue";
import Loader from "@/components/Loader.vue";
import LoadingOverlay from "@/components/LoadingOverlay.vue";
import { useUiStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { RouterLink, useRoute, useRouter } from "vue-router";

const ui = useUiStore();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const COLABORADORES_LOJA_STORAGE_KEY = "na_colaboradores_superadmin_loja";

const items = ref([]);
const carregando = ref(true);
const q = ref("");
const novo = ref(null);
const filtroStatus = ref("active");
const lojasDisponiveis = ref([]);
const lojaSelecionadaId = ref("");
const carregandoLojas = ref(false);
const erroLojas = ref("");
const sincronizandoRotaLoja = ref(false);
const alterandoAtivoId = ref("");

const lojaSelecionada = computed(
  () =>
    lojasDisponiveis.value.find(
      (loja) => loja._id === lojaSelecionadaId.value,
    ) || null,
);

const podeCriarColaborador = computed(
  () => !auth.isSuperAdmin || !!lojaSelecionadaId.value,
);
const mensagemVazia = computed(() => {
  if (filtroStatus.value === "inactive")
    return "Nenhum colaborador inativo encontrado.";
  if (filtroStatus.value === "all") return "Nenhum colaborador encontrado.";
  return "Nenhum colaborador ativo. Eles serão criados automaticamente após o upload das planilhas.";
});

function paramsEscopoLoja(extra = {}) {
  if (auth.isSuperAdmin && lojaSelecionadaId.value) {
    return { ...extra, lojaId: lojaSelecionadaId.value };
  }
  return { ...extra };
}

function persistirLojaSelecionada() {
  if (!auth.isSuperAdmin) return;
  if (lojaSelecionadaId.value) {
    localStorage.setItem(
      COLABORADORES_LOJA_STORAGE_KEY,
      lojaSelecionadaId.value,
    );
    return;
  }
  localStorage.removeItem(COLABORADORES_LOJA_STORAGE_KEY);
}

async function sincronizarRotaLoja() {
  if (!auth.isSuperAdmin) return;

  const lojaAtualNaRota =
    typeof route.query.lojaId === "string" ? route.query.lojaId : "";
  const proximaLojaId = lojaSelecionadaId.value || "";
  if (lojaAtualNaRota === proximaLojaId) return;

  const query = { ...route.query };
  if (proximaLojaId) query.lojaId = proximaLojaId;
  else delete query.lojaId;

  sincronizandoRotaLoja.value = true;
  try {
    await router.replace({ query });
  } finally {
    sincronizandoRotaLoja.value = false;
  }
}

async function carregarLojas() {
  if (!auth.isSuperAdmin) return;

  carregandoLojas.value = true;
  erroLojas.value = "";
  try {
    const { data } = await api.get("/lojas");
    lojasDisponiveis.value = (data.items || []).filter(
      (loja) => loja.ativa !== false,
    );

    const lojaDaRota =
      typeof route.query.lojaId === "string" ? route.query.lojaId : "";
    const lojaSalva =
      localStorage.getItem(COLABORADORES_LOJA_STORAGE_KEY) || "";
    const lojaInicial =
      lojasDisponiveis.value.find((loja) => loja._id === lojaDaRota) ||
      lojasDisponiveis.value.find((loja) => loja._id === lojaSalva) ||
      null;

    lojaSelecionadaId.value = lojaInicial?._id || "";
    persistirLojaSelecionada();
    await sincronizarRotaLoja();
  } catch (error) {
    erroLojas.value =
      error?.response?.data?.error || "Não foi possível carregar as lojas.";
    lojasDisponiveis.value = [];
    lojaSelecionadaId.value = "";
    persistirLojaSelecionada();
    await sincronizarRotaLoja();
  } finally {
    carregandoLojas.value = false;
  }
}

async function carregar() {
  carregando.value = true;
  try {
    const { data } = await api.get("/colaboradores", {
      params: paramsEscopoLoja({
        q: q.value || undefined,
        limit: 200,
        status: auth.podeGerenciar ? filtroStatus.value : undefined,
      }),
    });
    items.value = data.items;
  } finally {
    carregando.value = false;
  }
}

onMounted(async () => {
  if (auth.isSuperAdmin) await carregarLojas();
  await carregar();
});

watch(
  () => route.query.lojaId,
  async (novoValor) => {
    if (
      !auth.isSuperAdmin ||
      sincronizandoRotaLoja.value ||
      carregandoLojas.value
    )
      return;

    const lojaDaRota = typeof novoValor === "string" ? novoValor : "";
    const lojaValida =
      lojaDaRota &&
      lojasDisponiveis.value.some((loja) => loja._id === lojaDaRota);
    const proximaLojaId = lojaValida ? lojaDaRota : "";
    if (proximaLojaId === lojaSelecionadaId.value) return;

    lojaSelecionadaId.value = proximaLojaId;
    persistirLojaSelecionada();
    await sincronizarRotaLoja();
    if (novo.value && !podeCriarColaborador.value) novo.value = null;
    await carregar();
  },
);

async function trocarLojaSelecionada() {
  persistirLojaSelecionada();
  await sincronizarRotaLoja();
  if (novo.value && !podeCriarColaborador.value) novo.value = null;
  await carregar();
}

function rotaColaborador(colaboradorId) {
  if (auth.isSuperAdmin && lojaSelecionadaId.value) {
    return {
      path: `/colaboradores/${colaboradorId}`,
      query: { lojaId: lojaSelecionadaId.value },
    };
  }
  return { path: `/colaboradores/${colaboradorId}` };
}

function abrirNovo() {
  if (!podeCriarColaborador.value) {
    ui.info("Selecione uma loja para cadastrar um colaborador.");
    return;
  }
  novo.value = { nome: "", codigoExterno: "", cargo: "", setor: "" };
}

async function salvar() {
  try {
    await api.post("/colaboradores", paramsEscopoLoja(novo.value));
    ui.sucesso("Colaborador criado");
    novo.value = null;
    carregar();
  } catch (e) {
    ui.erro(e?.response?.data?.error || "Falha");
  }
}

function lojaIdDoColaborador(colaborador) {
  if (!auth.isSuperAdmin) return "";
  const loja = colaborador?.loja;
  if (!loja) return lojaSelecionadaId.value || "";
  if (typeof loja === "string") return loja;
  return loja._id ? String(loja._id) : lojaSelecionadaId.value || "";
}

function statusColaborador(colaborador) {
  if (colaborador?.ativo === false) return { text: "Inativo", klass: "bad" };
  return { text: "Ativo", klass: "ok" };
}

async function alternarAtivo(colaborador) {
  if (!auth.podeGerenciar || alterandoAtivoId.value) return;

  const proximoAtivo = colaborador?.ativo === false;
  const lojaId = lojaIdDoColaborador(colaborador);
  if (auth.isSuperAdmin && !lojaId) {
    ui.erro("Não foi possível identificar a loja deste colaborador.");
    return;
  }

  alterandoAtivoId.value = colaborador._id;
  try {
    const { data } = await api.patch(
      `/colaboradores/${colaborador._id}/ativo`,
      { ativo: proximoAtivo },
      { params: auth.isSuperAdmin ? { lojaId } : {} },
    );
    ui.sucesso(
      data?.mensagem ||
        (proximoAtivo ? "Colaborador reativado" : "Colaborador inativado"),
    );
    await carregar();
  } catch (error) {
    ui.erro(
      error?.response?.data?.error ||
        "Não foi possível atualizar o colaborador.",
    );
  } finally {
    alterandoAtivoId.value = "";
  }
}
</script>

<template>
  <LoadingOverlay :show="carregando || carregandoLojas" />
  <div class="grid gap-3">
    <div class="row">
      <div class="row" style="gap: 8px">
        <input
          v-model="q"
          placeholder="Buscar nome ou código..."
          style="
            background: rgba(0, 0, 0, 0.25);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 10px 14px;
            color: white;
            width: 280px;
          "
          @keyup.enter="carregar"
        />
        <select
          v-if="auth.isSuperAdmin"
          v-model="lojaSelecionadaId"
          class="btn ghost"
          style="padding: 10px 14px; min-width: 220px"
          :disabled="carregandoLojas"
          @change="trocarLojaSelecionada"
        >
          <option value="">Todas as lojas</option>
          <option
            v-for="loja in lojasDisponiveis"
            :key="loja._id"
            :value="loja._id"
          >
            {{ loja.nome }}
          </option>
        </select>
        <select
          v-if="auth.podeGerenciar"
          v-model="filtroStatus"
          class="btn ghost"
          style="padding: 10px 14px; min-width: 170px"
          @change="carregar"
        >
          <option value="active">Somente ativos</option>
          <option value="inactive">Somente inativos</option>
          <option value="all">Ativos e inativos</option>
        </select>
        <button class="btn ghost" @click="carregar">
          <fa icon="magnifying-glass" />
        </button>
      </div>
      <span v-if="auth.isSuperAdmin && erroLojas" class="badge bad">{{
        erroLojas
      }}</span>
      <span class="spacer" />
      <button
        v-if="auth.podeGerenciar"
        class="btn primary"
        :disabled="!podeCriarColaborador"
        @click="abrirNovo"
      >
        <fa icon="plus" /> Novo colaborador
      </button>
    </div>

    <div
      v-if="auth.isSuperAdmin && !podeCriarColaborador"
      class="muted"
      style="font-size: 13px; margin-top: -6px"
    >
      Escolha uma loja para cadastrar um colaborador. Com “Todas as lojas”, a
      tela mostra a lista completa em modo de consulta.
    </div>

    <div v-if="novo" class="card glow">
      <h3 class="mt-0">Novo colaborador</h3>
      <div v-if="auth.isSuperAdmin && lojaSelecionada" class="row mb-2">
        <span class="badge dim"
          ><fa icon="store" /> {{ lojaSelecionada.nome }}</span
        >
      </div>
      <div class="form-grid">
        <div class="field">
          <label>Nome</label><input v-model="novo.nome" required />
        </div>
        <div class="field">
          <label>Código (matrícula)</label
          ><input v-model="novo.codigoExterno" required />
        </div>
        <div class="field">
          <label>Cargo</label><input v-model="novo.cargo" />
        </div>
        <div class="field">
          <label>Setor</label><input v-model="novo.setor" />
        </div>
      </div>
      <div class="row mt-2">
        <span class="spacer" />
        <button class="btn ghost" @click="novo = null">Cancelar</button>
        <button class="btn primary" @click="salvar">Salvar</button>
      </div>
    </div>

    <Loader v-if="carregando" />
    <div v-else-if="!items.length" class="empty">{{ mensagemVazia }}</div>
    <div
      v-else
      class="grid"
      style="
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 14px;
      "
    >
      <article v-for="c in items" :key="c._id" class="card">
        <RouterLink
          :to="rotaColaborador(c._id)"
          class="colaborador-card-link"
          style="display: block; text-decoration: none; color: inherit"
        >
          <div class="row">
            <ColaboradorAvatar
              :nome="c.nome"
              :avatar-url="c.avatarUrl"
              :size="44"
              :font-size="16"
            />
            <div style="flex: 1; min-width: 0">
              <div style="font-weight: 700">{{ c.nome }}</div>
              <div class="muted" style="font-size: 12px">
                #{{ c.codigoExterno }}
              </div>
              <div
                v-if="auth.isSuperAdmin && c.loja?.nome"
                class="muted"
                style="font-size: 12px; margin-top: 2px"
              >
                <fa icon="store" /> {{ c.loja.nome }}
              </div>
            </div>
            <span class="badge info">N{{ c.nivel }}</span>
          </div>
          <div class="row mt-2" style="font-size: 12px">
            <span class="muted">Pontos</span
            ><strong>{{ Math.round(c.pontuacao) }}</strong>
            <span class="spacer" />
            <span class="muted">Lidos</span
            ><strong>{{ c.totalItensLidos.toLocaleString("pt-BR") }}</strong>
          </div>
          <div class="progress mt-2">
            <span
              :style="{
                width: c.totalItensLidos
                  ? Math.min(
                      100,
                      (c.totalItensConformes / c.totalItensLidos) * 100,
                    ) + '%'
                  : '0%',
              }"
            />
          </div>
        </RouterLink>

        <div class="row mt-2" style="align-items: center; gap: 8px">
          <span class="badge" :class="statusColaborador(c).klass">{{
            statusColaborador(c).text
          }}</span>
          <span v-if="c.ativo === false" class="muted" style="font-size: 12px">
            Oculto no portal e nos rankings
          </span>
          <span class="spacer" />
          <button
            v-if="auth.podeGerenciar"
            class="btn ghost"
            :disabled="alterandoAtivoId === c._id"
            @click="alternarAtivo(c)"
          >
            <fa :icon="c.ativo === false ? 'check' : 'ban'" />
            {{
              alterandoAtivoId === c._id
                ? c.ativo === false
                  ? "Ativando..."
                  : "Inativando..."
                : c.ativo === false
                  ? "Marcar ativo"
                  : "Marcar inativo"
            }}
          </button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.colaborador-card-link {
  display: block;
}

.colaborador-card-link:hover {
  opacity: 0.98;
}
</style>
