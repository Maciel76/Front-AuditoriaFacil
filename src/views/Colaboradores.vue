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

function formatNum(valor) {
  return Number(valor || 0).toLocaleString("pt-BR");
}

/**
 * Medalha dos tres primeiros da lista, por itens lidos — o mesmo destaque que
 * o colaborador ve no portal. So entra quem esta ativo: colaborador inativo
 * nao aparece em ranking nenhum, entao nao faz sentido premiar aqui.
 */
const rankingColaboradores = computed(() => {
  const ordenados = items.value
    .filter((colaborador) => colaborador.ativo !== false)
    .sort((a, b) => (b.totalItensLidos || 0) - (a.totalItensLidos || 0));

  const mapa = new Map();
  ordenados.slice(0, 3).forEach((colaborador, indice) => {
    mapa.set(String(colaborador._id), indice + 1);
  });
  return mapa;
});

function rankColaborador(id) {
  return rankingColaboradores.value.get(String(id)) ?? null;
}

function rankClass(id) {
  const posicao = rankColaborador(id);
  if (posicao === 1) return "colega-rank-ouro";
  if (posicao === 2) return "colega-rank-prata";
  if (posicao === 3) return "colega-rank-bronze";
  return "";
}

function rankTrophy(id) {
  const posicao = rankColaborador(id);
  if (posicao === 1) return "🏆";
  if (posicao === 2) return "🥈";
  if (posicao === 3) return "🥉";
  return null;
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

    <section class="card colegas-card">
      <div class="colegas-head">
        <div>
          <h3 class="colegas-titulo"><fa icon="users" /> Colaboradores</h3>
          <p class="muted colegas-help">
            Abra o perfil de cada colaborador para acompanhar fotos, conquistas
            e resultados.
          </p>
        </div>
        <span v-if="items.length" class="colega-count">{{ items.length }}</span>
      </div>

      <Loader v-if="carregando" />

      <div v-else-if="!items.length" class="empty">{{ mensagemVazia }}</div>

      <div v-else class="colegas-list">
        <article
          v-for="c in items"
          :key="c._id"
          class="colega-card"
          :class="[rankClass(c._id), { inativo: c.ativo === false }]"
        >
          <!-- Varredura de brilho (top 3) -->
          <div
            v-if="rankColaborador(c._id)"
            class="colega-shine"
            aria-hidden="true"
          />

          <!-- Partículas (top 3) -->
          <div
            v-if="rankColaborador(c._id)"
            class="colega-particles"
            aria-hidden="true"
          >
            <span class="cp p1" /><span class="cp p2" /><span class="cp p3" />
            <span class="cp p4" /><span class="cp p5" />
          </div>

          <!-- Medalha de posição -->
          <div v-if="rankTrophy(c._id)" class="colega-rank-badge">
            {{ rankTrophy(c._id) }}
          </div>

          <RouterLink
            :to="rotaColaborador(c._id)"
            class="colega-abrir"
            :title="c.nome"
          >
            <div class="colega-main">
              <ColaboradorAvatar
                :nome="c.nome"
                :avatar-url="c.avatarUrl"
                :size="54"
                :font-size="18"
              />
              <div class="colega-body">
                <strong>{{ c.nome }}</strong>
                <small class="muted">
                  #{{ c.codigoExterno
                  }}<template v-if="c.cargo"> · {{ c.cargo }}</template>
                </small>
                <small
                  v-if="auth.isSuperAdmin && c.loja?.nome"
                  class="muted colega-loja"
                >
                  <fa icon="store" /> {{ c.loja.nome }}
                </small>
              </div>
            </div>

            <div class="colega-stats">
              <div class="colega-stat">
                <span class="colega-stat-label">Nível</span>
                <strong>{{ c.nivel || 1 }}</strong>
              </div>
              <div class="colega-stat">
                <span class="colega-stat-label">Pontos</span>
                <strong>{{ formatNum(Math.round(c.pontuacao || 0)) }}</strong>
              </div>
              <div class="colega-stat">
                <span class="colega-stat-label">Lidos</span>
                <strong>{{ formatNum(c.totalItensLidos) }}</strong>
              </div>
            </div>

            <div class="colega-link">
              <span>Abrir perfil</span>
              <fa icon="chevron-right" />
            </div>
          </RouterLink>

          <div v-if="auth.podeGerenciar" class="colega-acoes">
            <span
              class="badge"
              :class="statusColaborador(c).klass"
              :title="
                c.ativo === false
                  ? 'Oculto no portal e nos rankings'
                  : 'Aparece no portal e nos rankings'
              "
            >
              {{ statusColaborador(c).text }}
            </span>
            <span class="spacer" />
            <button
              class="btn ghost colega-acao"
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
    </section>
  </div>
</template>

<style scoped>
/*
 * A listagem usa o mesmo cartao de "Colegas da equipe" do portal do
 * colaborador: mesmo grid, mesmo destaque de top 3 e mesmo rodape de "Abrir
 * perfil". O que e exclusivo do painel (numeros e o liga/desliga) entra nos
 * blocos que o proprio cartao ja previa.
 */
.colegas-card {
  display: grid;
  gap: 16px;
}

.colegas-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.colegas-titulo {
  margin: 0;
}

.colegas-help {
  margin: 6px 0 0;
  max-width: 48ch;
}

.colega-count {
  min-width: 34px;
  height: 34px;
  padding: 0 10px;
  border-radius: 999px;
  display: inline-grid;
  place-items: center;
  font-weight: 700;
  color: #7c5cff;
  background: rgba(124, 92, 255, 0.14);
}

.colegas-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
}

.colega-card {
  position: relative;
  border: 1px solid color-mix(in srgb, var(--border) 88%, #7c5cff 12%);
  border-radius: 22px;
  padding: 16px;
  display: grid;
  gap: 14px;
  align-content: start;
  text-align: left;
  background:
    radial-gradient(
      180px 120px at 0% 0%,
      rgba(124, 92, 255, 0.16),
      transparent 72%
    ),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--surface-strong) 92%, transparent),
      color-mix(in srgb, var(--surface) 94%, transparent)
    );
  color: var(--text);
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08);
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.colega-card:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, #7c5cff 52%, var(--border));
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.14);
}

/* Colaborador inativo continua na lista, mas apagado. */
.colega-card.inativo {
  opacity: 0.62;
}

.colega-abrir {
  display: grid;
  gap: 14px;
  text-decoration: none;
  color: inherit;
}

.colega-abrir:focus-visible {
  outline: 2px solid #7c5cff;
  outline-offset: 3px;
  border-radius: 16px;
}

.colega-main {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: center;
}

.colega-body {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.colega-body strong {
  font-size: 1rem;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.colega-body small {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.colega-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.colega-stat {
  padding: 10px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 84%, transparent);
  display: grid;
  gap: 4px;
}

.colega-stat-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.colega-stat strong {
  font-size: 14px;
}

.colega-link {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  font-weight: 700;
  color: #7c5cff;
}

.colega-acoes {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.colega-acao {
  padding: 6px 10px;
  font-size: 12px;
}

/* ===== TOP 3 ===== */
@keyframes colegaShine {
  0% {
    transform: translateX(-130%) skewX(-20deg);
    opacity: 0;
  }
  12% {
    opacity: 1;
  }
  88% {
    opacity: 1;
  }
  100% {
    transform: translateX(240%) skewX(-20deg);
    opacity: 0;
  }
}

@keyframes colegaParticle {
  0% {
    transform: translateY(0) scale(1);
    opacity: 0.8;
  }
  55% {
    transform: translateY(-20px) scale(1.35);
    opacity: 1;
  }
  100% {
    transform: translateY(-44px) scale(0.5);
    opacity: 0;
  }
}

@keyframes colegaPulseOuro {
  0%,
  100% {
    box-shadow:
      0 12px 26px rgba(15, 23, 42, 0.08),
      0 0 0 0 rgba(245, 158, 11, 0);
  }
  50% {
    box-shadow:
      0 18px 38px rgba(245, 158, 11, 0.18),
      0 0 0 3px rgba(245, 158, 11, 0.22);
  }
}

@keyframes colegaPulsePrata {
  0%,
  100% {
    box-shadow:
      0 12px 26px rgba(15, 23, 42, 0.08),
      0 0 0 0 rgba(148, 163, 184, 0);
  }
  50% {
    box-shadow:
      0 16px 34px rgba(148, 163, 184, 0.15),
      0 0 0 3px rgba(148, 163, 184, 0.2);
  }
}

@keyframes colegaPulseBronze {
  0%,
  100% {
    box-shadow:
      0 12px 26px rgba(15, 23, 42, 0.08),
      0 0 0 0 rgba(249, 115, 22, 0);
  }
  50% {
    box-shadow:
      0 16px 34px rgba(249, 115, 22, 0.15),
      0 0 0 3px rgba(249, 115, 22, 0.2);
  }
}

@keyframes badgePop {
  0% {
    transform: scale(0.5) rotate(-18deg);
    opacity: 0;
  }
  65% {
    transform: scale(1.18) rotate(4deg);
    opacity: 1;
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

.colega-rank-ouro {
  --ck: 245, 158, 11;
  border-color: rgba(245, 158, 11, 0.42) !important;
  background:
    radial-gradient(
      200px 130px at 0% 0%,
      rgba(245, 158, 11, 0.15),
      transparent 68%
    ),
    radial-gradient(
      300px 160px at 100% 100%,
      rgba(245, 158, 11, 0.08),
      transparent 70%
    ),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--surface-strong) 92%, transparent),
      color-mix(in srgb, var(--surface) 94%, transparent)
    ) !important;
  animation: colegaPulseOuro 2.6s ease-in-out 0.5s infinite;
}

.colega-rank-prata {
  --ck: 148, 163, 184;
  border-color: rgba(148, 163, 184, 0.38) !important;
  background:
    radial-gradient(
      200px 130px at 0% 0%,
      rgba(148, 163, 184, 0.13),
      transparent 68%
    ),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--surface-strong) 92%, transparent),
      color-mix(in srgb, var(--surface) 94%, transparent)
    ) !important;
  animation: colegaPulsePrata 3s ease-in-out 0.5s infinite;
}

.colega-rank-bronze {
  --ck: 249, 115, 22;
  border-color: rgba(249, 115, 22, 0.38) !important;
  background:
    radial-gradient(
      200px 130px at 0% 0%,
      rgba(249, 115, 22, 0.13),
      transparent 68%
    ),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--surface-strong) 92%, transparent),
      color-mix(in srgb, var(--surface) 94%, transparent)
    ) !important;
  animation: colegaPulseBronze 3.2s ease-in-out 0.5s infinite;
}

.colega-rank-ouro .colega-link {
  color: #f59e0b;
}
.colega-rank-prata .colega-link {
  color: #94a3b8;
}
.colega-rank-bronze .colega-link {
  color: #f97316;
}

/* Faixa de brilho varrendo */
.colega-shine {
  pointer-events: none;
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  z-index: 0;
}

.colega-shine::after {
  content: "";
  position: absolute;
  top: -50%;
  left: 0;
  width: 38%;
  height: 200%;
  animation: colegaShine 2.6s ease-in-out 0.2s infinite;
}

.colega-rank-ouro .colega-shine::after {
  background: linear-gradient(
    108deg,
    transparent 15%,
    rgba(255, 220, 80, 0.28) 50%,
    transparent 85%
  );
  animation-duration: 2.4s;
}

.colega-rank-prata .colega-shine::after {
  background: linear-gradient(
    108deg,
    transparent 15%,
    rgba(200, 220, 240, 0.22) 50%,
    transparent 85%
  );
  animation-duration: 3.2s;
}

.colega-rank-bronze .colega-shine::after {
  background: linear-gradient(
    108deg,
    transparent 15%,
    rgba(255, 180, 80, 0.22) 50%,
    transparent 85%
  );
  animation-duration: 2.8s;
}

/* Partículas */
.colega-particles {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 0;
}

.cp {
  position: absolute;
  border-radius: 50%;
  animation: colegaParticle 2.4s ease-in infinite;
  opacity: 0;
  background: rgba(var(--ck), 1);
  box-shadow: 0 0 5px 1px rgba(var(--ck), 0.55);
}

.cp.p1 {
  width: 4px;
  height: 4px;
  left: 12%;
  bottom: 16%;
  animation-delay: 0s;
  animation-duration: 2.2s;
}
.cp.p2 {
  width: 5px;
  height: 5px;
  left: 32%;
  bottom: 8%;
  animation-delay: 0.6s;
  animation-duration: 2.8s;
}
.cp.p3 {
  width: 3px;
  height: 3px;
  left: 56%;
  bottom: 18%;
  animation-delay: 1.1s;
  animation-duration: 2.5s;
}
.cp.p4 {
  width: 4px;
  height: 4px;
  left: 74%;
  bottom: 10%;
  animation-delay: 0.3s;
  animation-duration: 3s;
}
.cp.p5 {
  width: 3px;
  height: 3px;
  left: 88%;
  bottom: 22%;
  animation-delay: 1.5s;
  animation-duration: 2.3s;
}

/* Medalha de posição (canto superior direito) */
.colega-rank-badge {
  position: absolute;
  top: 10px;
  right: 12px;
  font-size: 20px;
  line-height: 1;
  z-index: 2;
  animation: badgePop 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.25));
}

.colega-rank-ouro,
.colega-rank-prata,
.colega-rank-bronze {
  overflow: hidden;
}

/* Conteúdo acima dos efeitos */
.colega-rank-ouro > .colega-abrir,
.colega-rank-ouro > .colega-acoes,
.colega-rank-prata > .colega-abrir,
.colega-rank-prata > .colega-acoes,
.colega-rank-bronze > .colega-abrir,
.colega-rank-bronze > .colega-acoes {
  position: relative;
  z-index: 1;
}

@media (prefers-reduced-motion: reduce) {
  .colega-card,
  .colega-shine::after,
  .cp,
  .colega-rank-badge {
    animation: none;
    transition: none;
  }
}
</style>
