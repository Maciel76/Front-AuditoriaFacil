<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import api from "@/services/api";
import ColaboradorAvatar from "@/components/ColaboradorAvatar.vue";
import ProductBarcode from "@/components/ProductBarcode.vue";

const props = defineProps({
  token: { type: String, default: "" },
});

const carregando = ref(false);
const erro = ref("");
const resumo = ref(null);
const origemResumo = ref("hoje");

const corredorSelecionado = ref(null);
const detalheCorredor = ref(null);
const carregandoDetalhe = ref(false);
const erroDetalhe = ref("");
const filtroItensModal = ref("todos");

const TIPO_LABELS = {
  ETIQUETA: "Etiqueta",
  PRESENCA: "Presença",
  RUPTURA: "Ruptura",
};

const TIPO_CORES = {
  ETIQUETA: "#7c5cff",
  PRESENCA: "#22d3ee",
  RUPTURA: "#f59e0b",
};

function apiPortal() {
  return {
    get: (url, cfg) =>
      api.request({
        method: "get",
        url,
        ...cfg,
        headers: {
          ...cfg?.headers,
          Authorization: `Bearer ${props.token}`,
        },
      }),
  };
}

function formatNum(valor) {
  return Number(valor || 0).toLocaleString("pt-BR");
}

function formatarEstoque(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "não informado";
  }

  const numero = Number(valor);
  if (Number.isFinite(numero)) {
    return numero.toLocaleString("pt-BR");
  }

  return String(valor);
}

function formatarData(valor, incluirHora = false) {
  if (!valor) return "Data indisponível";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat(
    "pt-BR",
    incluirHora
      ? { dateStyle: "medium", timeStyle: "short" }
      : { dateStyle: "medium" },
  ).format(data);
}

function textoConformidade(item) {
  return `${Number(item?.taxaConformidade || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}% conf.`;
}

function textoConclusao(item) {
  return `${Number(item?.progressoPct || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}% concluído`;
}

function situacaoClasse(item) {
  if (item?.conforme === true) return "ok";
  if (item?.conforme === false) return "bad";
  return "dim";
}

function classeLeituraItem(item) {
  return item?.foiLido ? "lido" : "nao-lido";
}

function textoLeituraItem(item) {
  return item?.foiLido ? "Lido" : "Não lido";
}

function fecharCorredor() {
  corredorSelecionado.value = null;
  detalheCorredor.value = null;
  erroDetalhe.value = "";
  filtroItensModal.value = "todos";
}

async function carregarResumo(origem = origemResumo.value) {
  if (!props.token) {
    resumo.value = null;
    origemResumo.value = "hoje";
    fecharCorredor();
    return;
  }

  origemResumo.value = origem === "anterior" ? "anterior" : "hoje";
  carregando.value = true;
  erro.value = "";
  fecharCorredor();

  try {
    const { data } = await apiPortal().get(
      "/metricas/portal/me/auditoria-do-dia",
      { params: { origem: origemResumo.value } },
    );
    resumo.value = data;
  } catch (e) {
    erro.value =
      e?.response?.data?.error ||
      "Não foi possível carregar a auditoria do dia.";
  } finally {
    carregando.value = false;
  }
}

function verAuditoriaAnterior() {
  return carregarResumo("anterior");
}

function voltarParaHoje() {
  return carregarResumo("hoje");
}

async function abrirCorredor(corredor) {
  if (!resumo.value?.auditoria?._id) return;

  corredorSelecionado.value = corredor;
  detalheCorredor.value = null;
  erroDetalhe.value = "";
  filtroItensModal.value = "todos";
  carregandoDetalhe.value = true;

  try {
    const { data } = await apiPortal().get(
      "/metricas/portal/me/auditoria-do-dia/corredor",
      {
        params: {
          auditoriaId: resumo.value.auditoria._id,
          local: corredor.local,
        },
      },
    );
    detalheCorredor.value = data;
  } catch (e) {
    erroDetalhe.value =
      e?.response?.data?.error ||
      "Não foi possível carregar os detalhes do corredor.";
  } finally {
    carregandoDetalhe.value = false;
  }
}

function tratarTecla(event) {
  if (event.key === "Escape" && corredorSelecionado.value) {
    fecharCorredor();
  }
}

watch(
  () => props.token,
  (novoToken) => {
    if (!novoToken) {
      resumo.value = null;
      origemResumo.value = "hoje";
      fecharCorredor();
      return;
    }
    carregarResumo("hoje");
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener("keydown", tratarTecla);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", tratarTecla);
});

const auditoriaAtual = computed(() => resumo.value?.auditoria || null);
const meusCorredores = computed(() => resumo.value?.meusCorredores || []);
const demaisCorredores = computed(() => resumo.value?.demaisCorredores || []);
const exibindoAnterior = computed(() =>
  Boolean(resumo.value?.exibindoAnterior),
);
const temAuditoriaAnterior = computed(() =>
  Boolean(resumo.value?.temAuditoriaAnterior),
);
const itensDetalhe = computed(() => detalheCorredor.value?.itens || []);
function itemDetalheEhValido(item) {
  return item?.conforme === true || item?.conforme === false;
}

const itensDetalheValidos = computed(() =>
  itensDetalhe.value.filter((item) => itemDetalheEhValido(item)),
);
const contagemItensDetalhe = computed(() => {
  const totais = {
    todos: itensDetalheValidos.value.length,
    lidos: 0,
    naoLidos: 0,
  };

  for (const item of itensDetalheValidos.value) {
    if (item?.foiLido) totais.lidos += 1;
    else totais.naoLidos += 1;
  }

  return totais;
});
const itensDetalheFiltrados = computed(() => {
  const itensBase = itensDetalheValidos.value;

  if (filtroItensModal.value === "lidos") {
    return itensBase.filter((item) => item?.foiLido);
  }

  if (filtroItensModal.value === "nao-lidos") {
    return itensBase.filter((item) => !item?.foiLido);
  }

  return itensBase;
});
const totalCorredoresResumo = computed(() =>
  Number(
    resumo.value?.totalCorredores ??
      meusCorredores.value.length + demaisCorredores.value.length,
  ),
);
const semAuditoria = computed(() => !auditoriaAtual.value);
</script>

<template>
  <section class="card auditoria-dia">
    <div class="auditoria-hero">
      <div class="auditoria-hero-copy">
        <h3 class="section-title">
          <fa icon="boxes-stacked" />
          {{ exibindoAnterior ? "Auditoria anterior" : "Auditoria do dia" }}
        </h3>
        <p class="auditoria-hero-title">
          {{
            exibindoAnterior
              ? "Consulta manual da última auditoria disponível."
              : "Acompanhe somente a operação do momento."
          }}
        </p>
        <p class="muted auditoria-dia-sub">
          {{
            exibindoAnterior
              ? "Você abriu uma auditoria anterior por escolha manual. Os corredores abaixo não representam a operação atual da loja."
              : "Os corredores abaixo mostram apenas a auditoria em andamento hoje. A auditoria anterior ficou separada em um botão próprio para evitar confusão."
          }}
        </p>
      </div>

      <div class="auditoria-acoes">
        <button
          class="btn ghost"
          type="button"
          :disabled="carregando"
          @click="carregarResumo()"
        >
          <fa icon="rotate-right" :spin="carregando" /> Atualizar
        </button>
        <button
          v-if="temAuditoriaAnterior && !exibindoAnterior && !semAuditoria"
          class="btn primary"
          type="button"
          :disabled="carregando"
          @click="verAuditoriaAnterior"
        >
          Ver auditoria anterior
        </button>
        <button
          v-if="exibindoAnterior"
          class="btn ghost"
          type="button"
          :disabled="carregando"
          @click="voltarParaHoje"
        >
          Voltar para hoje
        </button>
      </div>
    </div>

    <div v-if="erro" class="auditoria-banner erro">{{ erro }}</div>

    <div v-if="carregando" class="auditoria-dia-loading">
      <fa icon="spinner" spin /> Carregando auditoria do dia...
    </div>

    <template v-else>
      <div v-if="semAuditoria" class="auditoria-vazia">
        <span class="badge warn">Sem auditoria hoje</span>
        <strong>Não há auditoria em andamento no momento.</strong>
        <p class="muted auditoria-vazia-texto">
          {{ resumo?.aviso || "Não há auditoria disponível para consulta." }}
        </p>
        <div class="auditoria-vazia-acoes">
          <button
            v-if="temAuditoriaAnterior"
            class="btn primary"
            type="button"
            @click="verAuditoriaAnterior"
          >
            Ver auditoria anterior
          </button>
          <button class="btn ghost" type="button" @click="voltarParaHoje">
            Atualizar
          </button>
        </div>
      </div>

      <template v-else>
        <div class="auditoria-painel">
          <div class="auditoria-meta">
            <div class="auditoria-meta-principal">
              <span
                class="auditoria-status"
                :class="{ anterior: exibindoAnterior }"
              >
                {{ exibindoAnterior ? "Consulta anterior" : "Operação atual" }}
              </span>
              <span
                class="auditoria-tipo"
                :style="{
                  '--tipo-cor': TIPO_CORES[auditoriaAtual.tipo] || '#94a3b8',
                }"
              >
                {{ TIPO_LABELS[auditoriaAtual.tipo] || auditoriaAtual.tipo }}
              </span>
            </div>
            <strong class="auditoria-data">{{
              formatarData(auditoriaAtual.data)
            }}</strong>
          </div>

          <div class="auditoria-resumo-grid">
            <article class="auditoria-resumo-card">
              <span>Meus corredores</span>
              <strong>{{ meusCorredores.length }}</strong>
            </article>
            <article class="auditoria-resumo-card">
              <span>Demais corredores</span>
              <strong>{{ demaisCorredores.length }}</strong>
            </article>
            <article class="auditoria-resumo-card">
              <span>Total visível</span>
              <strong>{{ formatNum(totalCorredoresResumo) }}</strong>
            </article>
          </div>
        </div>

        <div
          v-if="resumo?.aviso"
          class="auditoria-banner"
          :class="{ anterior: exibindoAnterior }"
        >
          {{ resumo.aviso }}
        </div>

        <section class="auditoria-bloco">
          <div class="auditoria-bloco-head">
            <h4>Meus corredores</h4>
            <span class="muted">{{ meusCorredores.length }} corredor(es)</span>
          </div>

          <div v-if="!meusCorredores.length" class="empty mini">
            Você ainda não tem leitura registrada nessa auditoria.
          </div>

          <div v-else class="corredores-grid destaque">
            <button
              v-for="corredor in meusCorredores"
              :key="`meu-${corredor.local}`"
              class="corredor-card"
              :class="{ destaque: corredor.emDestaque }"
              type="button"
              @click="abrirCorredor(corredor)"
            >
              <div class="corredor-card-top">
                <div>
                  <span v-if="corredor.emDestaque" class="badge ok">
                    Em destaque
                  </span>
                  <strong>{{ corredor.local }}</strong>
                </div>
                <span class="corredor-conclusao">{{
                  textoConclusao(corredor)
                }}</span>
              </div>

              <div class="progress corredor-barra">
                <span :style="{ width: `${corredor.progressoPct}%` }"></span>
              </div>

              <div class="corredor-metricas">
                <span>
                  <strong>{{ formatNum(corredor.totalLidos) }}</strong>
                  / {{ formatNum(corredor.totalItensAuditaveis) }} lidos
                </span>
                <span>
                  Minha leitura:
                  <strong>{{ formatNum(corredor.minhaLeitura) }}</strong>
                </span>
                <span>{{ textoConformidade(corredor) }}</span>
              </div>

              <div class="corredor-equipe">
                <div class="corredor-equipe-head">
                  <span>Equipe no corredor</span>
                  <span>{{ corredor.totalParticipantes }} pessoa(s)</span>
                </div>
                <div class="corredor-participantes">
                  <div
                    v-for="participante in corredor.participantes"
                    :key="`${corredor.local}-${participante.colaboradorId || participante.nome}`"
                    class="participante-pill"
                    :class="{ eu: participante.eu }"
                  >
                    <ColaboradorAvatar
                      :nome="participante.nome"
                      :avatar-url="participante.avatarUrl"
                      :size="28"
                      :font-size="10"
                    />
                    <div>
                      <strong>{{ participante.nome }}</strong>
                      <span
                        >{{ formatNum(participante.totalLidos) }} lidos</span
                      >
                    </div>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </section>

        <section v-if="demaisCorredores.length" class="auditoria-bloco">
          <div class="auditoria-bloco-head">
            <h4>Demais corredores</h4>
            <span class="muted"
              >{{ demaisCorredores.length }} corredor(es)</span
            >
          </div>

          <div class="corredores-grid">
            <button
              v-for="corredor in demaisCorredores"
              :key="`demais-${corredor.local}`"
              class="corredor-card secundario"
              type="button"
              @click="abrirCorredor(corredor)"
            >
              <div class="corredor-card-top">
                <strong>{{ corredor.local }}</strong>
                <span class="corredor-conclusao">{{
                  textoConclusao(corredor)
                }}</span>
              </div>

              <div class="progress corredor-barra">
                <span :style="{ width: `${corredor.progressoPct}%` }"></span>
              </div>

              <div class="corredor-metricas">
                <span>
                  <strong>{{ formatNum(corredor.totalLidos) }}</strong>
                  / {{ formatNum(corredor.totalItensAuditaveis) }} lidos
                </span>
                <span>{{ textoConformidade(corredor) }}</span>
                <span>{{ corredor.totalParticipantes }} participante(s)</span>
              </div>
            </button>
          </div>
        </section>
      </template>
    </template>

    <Transition name="modal">
      <div
        v-if="corredorSelecionado"
        class="auditoria-modal-backdrop"
        @click.self="fecharCorredor"
      >
        <div class="auditoria-modal card glow">
          <div class="auditoria-modal-head">
            <div>
              <div class="auditoria-meta-principal">
                <span v-if="exibindoAnterior" class="auditoria-status anterior">
                  Consulta anterior
                </span>
                <span
                  v-if="auditoriaAtual"
                  class="auditoria-tipo"
                  :style="{
                    '--tipo-cor': TIPO_CORES[auditoriaAtual.tipo] || '#94a3b8',
                  }"
                >
                  {{ TIPO_LABELS[auditoriaAtual.tipo] || auditoriaAtual.tipo }}
                </span>
              </div>
              <h3>{{ corredorSelecionado.local }}</h3>
              <p class="muted">
                {{ auditoriaAtual ? formatarData(auditoriaAtual.data) : "" }}
              </p>
            </div>
            <button class="btn ghost" type="button" @click="fecharCorredor">
              <fa icon="xmark" />
            </button>
          </div>

          <div v-if="erroDetalhe" class="badge bad auditoria-dia-feedback">
            {{ erroDetalhe }}
          </div>

          <div v-if="carregandoDetalhe" class="auditoria-dia-loading detalhe">
            <fa icon="spinner" spin /> Carregando detalhes do corredor...
          </div>

          <template v-else-if="detalheCorredor?.corredor">
            <div class="auditoria-modal-stats">
              <div class="stat-card">
                <span>Conclusão</span>
                <strong>{{ textoConclusao(detalheCorredor.corredor) }}</strong>
              </div>
              <div class="stat-card">
                <span>Itens lidos</span>
                <strong>
                  {{ formatNum(detalheCorredor.corredor.totalLidos) }} /
                  {{ formatNum(detalheCorredor.corredor.totalItensAuditaveis) }}
                </strong>
              </div>
              <div class="stat-card">
                <span>Conformidade</span>
                <strong>{{
                  textoConformidade(detalheCorredor.corredor)
                }}</strong>
              </div>
              <div class="stat-card">
                <span>Participantes</span>
                <strong>{{
                  detalheCorredor.corredor.totalParticipantes
                }}</strong>
              </div>
            </div>

            <div class="progress corredor-barra modal-barra">
              <span
                :style="{ width: `${detalheCorredor.corredor.progressoPct}%` }"
              ></span>
            </div>

            <section class="modal-section">
              <div class="modal-section-head">
                <h4>Equipe no corredor</h4>
              </div>
              <div class="participantes-lista">
                <div
                  v-for="participante in detalheCorredor.corredor.participantes"
                  :key="participante.colaboradorId || participante.nome"
                  class="participante-row"
                  :class="{ eu: participante.eu }"
                >
                  <div class="participante-row-main">
                    <ColaboradorAvatar
                      :nome="participante.nome"
                      :avatar-url="participante.avatarUrl"
                      :size="36"
                      :font-size="12"
                    />
                    <div>
                      <strong>{{ participante.nome }}</strong>
                      <div class="muted" v-if="participante.codigoExterno">
                        Matrícula {{ participante.codigoExterno }}
                      </div>
                    </div>
                  </div>
                  <div class="participante-row-stats">
                    <strong>{{ formatNum(participante.totalLidos) }}</strong>
                    <span>{{ textoConclusao(participante) }}</span>
                  </div>
                </div>
              </div>
            </section>

            <section class="modal-section">
              <div class="modal-section-head">
                <h4>Itens do corredor</h4>
                <span class="muted"
                  >{{ formatNum(contagemItensDetalhe.todos) }} item(ns)
                  válidos</span
                >
              </div>
              <div
                class="itens-filtros"
                role="tablist"
                aria-label="Filtro de leitura dos itens"
              >
                <button
                  class="itens-filtro"
                  :class="{ ativo: filtroItensModal === 'todos' }"
                  type="button"
                  @click="filtroItensModal = 'todos'"
                >
                  Todos
                  <span>{{ formatNum(contagemItensDetalhe.todos) }}</span>
                </button>
                <button
                  class="itens-filtro"
                  :class="{ ativo: filtroItensModal === 'lidos' }"
                  type="button"
                  @click="filtroItensModal = 'lidos'"
                >
                  Lidos
                  <span>{{ formatNum(contagemItensDetalhe.lidos) }}</span>
                </button>
                <button
                  class="itens-filtro"
                  :class="{ ativo: filtroItensModal === 'nao-lidos' }"
                  type="button"
                  @click="filtroItensModal = 'nao-lidos'"
                >
                  Não lidos
                  <span>{{ formatNum(contagemItensDetalhe.naoLidos) }}</span>
                </button>
              </div>
              <div class="itens-lista">
                <div
                  v-if="!itensDetalheFiltrados.length"
                  class="empty mini itens-vazios"
                >
                  Nenhum item válido encontrado para esse filtro.
                </div>
                <div
                  v-for="item in itensDetalheFiltrados"
                  :key="item._id"
                  class="item-row"
                >
                  <div class="item-row-main">
                    <strong>{{ item.codigo }} · {{ item.produto }}</strong>
                    <ProductBarcode v-if="item.codigo" :value="item.codigo" />
                    <div class="muted item-meta">
                      <span class="item-estoque-chip">
                        <span class="item-estoque-label">Estoque</span>
                        <strong class="item-estoque-value">{{
                          formatarEstoque(item.estoqueAtual)
                        }}</strong>
                      </span>
                      <span v-if="item.setor">{{ item.setor }}</span>
                      <span v-if="item.classeRaiz">{{ item.classeRaiz }}</span>
                      <span>{{ item.colaboradorNome }}</span>
                    </div>
                  </div>
                  <div class="item-row-side">
                    <div class="item-row-badges">
                      <span
                        class="badge leitura-badge"
                        :class="classeLeituraItem(item)"
                      >
                        {{ textoLeituraItem(item) }}
                      </span>
                      <span class="badge" :class="situacaoClasse(item)">
                        {{ item.situacao }}
                      </span>
                    </div>
                    <small class="muted">{{
                      formatarData(item.auditadoEm, true)
                    }}</small>
                  </div>
                </div>
              </div>
            </section>
          </template>
        </div>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.auditoria-dia {
  position: relative;
  display: grid;
  gap: 18px;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--border-strong) 58%, transparent);
  background:
    radial-gradient(
      circle at top right,
      color-mix(in srgb, var(--primary) 14%, transparent),
      transparent 34%
    ),
    radial-gradient(
      circle at bottom left,
      color-mix(in srgb, var(--accent) 12%, transparent),
      transparent 36%
    ),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-2) 94%, white 6%),
      color-mix(in srgb, var(--bg-1) 92%, var(--surface) 8%)
    );
  box-shadow: 0 24px 56px rgba(12, 18, 36, 0.18);
}

.auditoria-hero,
.auditoria-bloco-head,
.auditoria-modal-head,
.modal-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.auditoria-hero {
  align-items: flex-start;
}

.auditoria-hero-copy {
  display: grid;
  gap: 10px;
  max-width: 760px;
}

.auditoria-hero-title {
  margin: 0;
  font-size: clamp(22px, 3vw, 30px);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.auditoria-dia-sub {
  margin: 0;
  max-width: 62ch;
  font-size: 14px;
}

.auditoria-acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.auditoria-dia-feedback {
  align-self: start;
}

.auditoria-dia-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 0;
  color: var(--muted);
  font-size: 14px;
}

.auditoria-dia-loading.detalhe {
  padding: 24px 0;
}

.auditoria-painel,
.auditoria-bloco,
.auditoria-vazia {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 24px;
  border: 1px solid color-mix(in srgb, var(--border) 84%, transparent);
  background: color-mix(in srgb, var(--bg-2) 84%, var(--surface) 16%);
}

.auditoria-vazia {
  padding: 24px;
  border-style: dashed;
}

.auditoria-vazia strong {
  font-size: 20px;
}

.auditoria-vazia-texto {
  margin: 0;
}

.auditoria-vazia-acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.auditoria-banner {
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
  background: color-mix(in srgb, var(--bg-2) 88%, var(--surface) 12%);
  color: var(--text);
}

.auditoria-banner.anterior {
  border-color: color-mix(in srgb, var(--warning) 30%, transparent);
  background: color-mix(in srgb, var(--warning) 10%, var(--bg-2) 90%);
}

.auditoria-banner.erro {
  border-color: color-mix(in srgb, var(--danger) 36%, transparent);
  background: color-mix(in srgb, var(--danger) 9%, var(--bg-2) 91%);
}

.auditoria-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.auditoria-meta-principal {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.auditoria-status {
  display: inline-flex;
  align-items: center;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, white 88%);
  border: 1px solid color-mix(in srgb, var(--accent) 34%, white 66%);
}

.auditoria-status.anterior {
  color: #b45309;
  background: color-mix(in srgb, var(--warning) 14%, white 86%);
  border-color: color-mix(in srgb, var(--warning) 36%, white 64%);
}

.auditoria-data {
  font-size: 15px;
}

.auditoria-tipo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: var(--tipo-cor);
  background: color-mix(in srgb, var(--tipo-cor) 12%, white 88%);
  border: 1px solid color-mix(in srgb, var(--tipo-cor) 35%, white 65%);
}

.auditoria-resumo-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.auditoria-resumo-card {
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
  background: color-mix(in srgb, var(--bg-2) 72%, var(--surface) 28%);
}

.auditoria-resumo-card span {
  display: block;
  font-size: 12px;
  color: var(--muted);
}

.auditoria-resumo-card strong {
  display: block;
  margin-top: 6px;
  font-size: 28px;
  line-height: 1;
}

.auditoria-bloco-head h4,
.modal-section h4,
.auditoria-modal h3 {
  margin: 0;
}

.corredores-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.corredor-card {
  border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
  background: color-mix(in srgb, var(--bg-2) 78%, var(--surface) 22%);
  border-radius: 22px;
  padding: 16px;
  display: grid;
  gap: 12px;
  text-align: left;
  color: inherit;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.corredor-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--primary) 35%, var(--border) 65%);
  box-shadow: 0 18px 40px rgba(27, 45, 94, 0.12);
}

.corredor-card.destaque {
  border-color: color-mix(in srgb, var(--primary) 45%, transparent);
  background:
    radial-gradient(
      circle at top left,
      rgba(124, 92, 255, 0.12),
      transparent 38%
    ),
    color-mix(in srgb, var(--bg-2) 72%, var(--surface) 28%);
}

.corredor-card.secundario {
  background: color-mix(in srgb, var(--bg-2) 82%, var(--surface) 18%);
}

.corredor-card-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.corredor-card-top strong {
  display: block;
  font-size: 17px;
}

.corredor-conclusao {
  font-size: 12px;
  font-weight: 700;
  color: var(--primary);
}

.corredor-barra {
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: color-mix(in srgb, var(--border) 68%, white 32%);
}

.corredor-barra > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #7c5cff, #22d3ee);
}

.corredor-metricas {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
}

.corredor-metricas strong {
  color: var(--text);
}

.corredor-equipe {
  display: grid;
  gap: 10px;
}

.corredor-equipe-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: var(--muted);
}

.corredor-participantes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.participante-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-2) 70%, var(--surface) 30%);
  border: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
  min-width: 0;
}

.participante-pill.eu,
.participante-row.eu {
  border-color: color-mix(in srgb, var(--primary) 45%, transparent);
  background: color-mix(in srgb, var(--primary) 10%, white 90%);
}

.participante-pill div,
.participante-row-main {
  min-width: 0;
}

.participante-pill strong,
.participante-row strong {
  display: block;
  font-size: 12px;
}

.participante-pill span,
.participante-row span {
  display: block;
  font-size: 11px;
  color: var(--muted);
}

.auditoria-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  padding: 16px;
  background: rgba(8, 12, 24, 0.56);
  backdrop-filter: blur(12px);
}

.auditoria-modal {
  width: min(960px, 100%);
  max-height: min(90vh, 920px);
  overflow: auto;
  display: grid;
  gap: 16px;
  border-radius: 26px;
  border: 1px solid color-mix(in srgb, var(--border-strong) 60%, transparent);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--bg-2) 90%, white 10%),
    color-mix(in srgb, var(--bg-1) 94%, var(--surface) 6%)
  );
  box-shadow: 0 28px 60px rgba(9, 14, 29, 0.35);
}

.auditoria-modal-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.stat-card {
  padding: 14px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
  background: color-mix(in srgb, var(--bg-2) 76%, var(--surface) 24%);
}

.stat-card span {
  display: block;
  color: var(--muted);
  font-size: 12px;
}

.stat-card strong {
  display: block;
  margin-top: 6px;
}

.modal-barra {
  height: 12px;
}

.modal-section {
  display: grid;
  gap: 12px;
}

.itens-filtros {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.itens-filtro {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
  background: color-mix(in srgb, var(--bg-2) 76%, var(--surface) 24%);
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 700;
}

.itens-filtro span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  padding: 2px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 70%, white 30%);
  color: var(--text);
}

.itens-filtro.ativo {
  border-color: color-mix(in srgb, var(--primary) 48%, transparent);
  background: color-mix(in srgb, var(--primary) 14%, var(--bg-2) 86%);
  color: var(--text);
}

.itens-vazios {
  padding: 16px;
}

.participantes-lista,
.itens-lista {
  display: grid;
  gap: 10px;
}

.participante-row,
.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
  background: color-mix(in srgb, var(--bg-2) 78%, var(--surface) 22%);
}

.participante-row-main {
  display: flex;
  align-items: center;
  gap: 10px;
}

.participante-row-stats {
  text-align: right;
}

.item-row-main,
.item-row-side {
  min-width: 0;
}

.item-row-main {
  display: grid;
  gap: 8px;
}

.item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
}

.item-estoque-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--primary) 34%, white 66%);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--primary) 14%, white 86%),
    color-mix(in srgb, var(--accent) 14%, white 86%)
  );
  color: var(--text);
  box-shadow: 0 8px 18px rgba(35, 64, 123, 0.12);
}

.item-estoque-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--text) 68%, var(--primary) 32%);
}

.item-estoque-value {
  font-size: 15px;
  line-height: 1;
  color: color-mix(in srgb, var(--primary) 76%, #0f172a 24%);
}

.item-row-side {
  display: grid;
  justify-items: end;
  gap: 6px;
}

.item-row-badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.leitura-badge.lido {
  background: color-mix(in srgb, var(--success) 16%, white 84%);
  color: #15803d;
}

.leitura-badge.nao-lido {
  background: color-mix(in srgb, var(--warning) 18%, white 82%);
  color: #b45309;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.18s ease;
}

.modal-enter-active .auditoria-modal,
.modal-leave-active .auditoria-modal {
  transition: transform 0.18s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .auditoria-modal,
.modal-leave-to .auditoria-modal {
  transform: translateY(16px);
}

@media (max-width: 900px) {
  .auditoria-modal-stats,
  .corredor-metricas,
  .auditoria-resumo-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .auditoria-hero,
  .auditoria-bloco-head,
  .auditoria-modal-head,
  .modal-section-head,
  .corredor-card-top,
  .participante-row,
  .item-row {
    display: grid;
    grid-template-columns: 1fr;
  }

  .auditoria-acoes,
  .auditoria-vazia-acoes {
    justify-content: stretch;
  }

  .auditoria-acoes > *,
  .auditoria-vazia-acoes > *,
  .auditoria-meta,
  .auditoria-meta-principal,
  .auditoria-modal-stats,
  .corredor-metricas,
  .auditoria-resumo-grid {
    grid-template-columns: 1fr;
  }

  .participante-row-stats,
  .item-row-side {
    justify-items: start;
    text-align: left;
  }

  .item-row-badges {
    justify-content: flex-start;
  }

  .auditoria-modal-backdrop {
    padding: 0;
    align-items: stretch;
  }

  .auditoria-modal {
    width: 100%;
    max-height: 100vh;
    border-radius: 22px 22px 0 0;
  }
}
</style>
