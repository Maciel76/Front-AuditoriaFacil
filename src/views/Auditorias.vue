<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import api from "@/services/api";
import { useUiStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { useRouter } from "vue-router";
import Loader from "@/components/Loader.vue";
import { RouterLink } from "vue-router";

const ui = useUiStore();
const auth = useAuthStore();
const router = useRouter();
const fileInput = ref(null);
const LOJA_DESTINO_STORAGE_KEY = "na_auditorias_superadmin_loja";

// Detecta tipo sugerido pelo dia da semana: 1=Seg,4=Qui→ETIQUETA, 2=Ter→PRESENCA, 3=Qua→RUPTURA
function tipoSugeridoHoje() {
  const d = new Date().getDay(); // 0=Dom
  if (d === 1 || d === 4) return "ETIQUETA";
  if (d === 2) return "PRESENCA";
  if (d === 3) return "RUPTURA";
  return "";
}

function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: value >= 10 ? 0 : 1 })} ${units[exponent]}`;
}

const enviando = ref(false);
const dragOver = ref(false);
const arquivo = ref(null); // arquivo atualmente em processamento
const fila = ref([]); // [{id, file, status, erro, resultado}]
const tipoForcado = ref(tipoSugeridoHoje());
const ultimoResultado = ref(null);
const progressoUpload = ref(0);
const etapaUpload = ref("idle");
const detalheProcessamento = ref("");
const erroUpload = ref("");

let filaProcessando = false;
let idCounter = 0;

let componenteAtivo = true;
let simulacaoProcessamento = null;

const auditorias = ref([]);
const carregando = ref(true);
const filtroTipo = ref("");
const lojasDisponiveis = ref([]);
const lojaDestinoId = ref("");
const carregandoLojas = ref(false);
const erroLojas = ref("");
const ultimaLojaProcessada = ref(null);

const lojaDestino = computed(
  () =>
    lojasDisponiveis.value.find((loja) => loja._id === lojaDestinoId.value) ||
    null,
);
const uploadBloqueadoSemLoja = computed(
  () => auth.isSuperAdmin && !lojaDestinoId.value,
);
const podeSelecionarArquivo = computed(
  () => !uploadBloqueadoSemLoja.value && !carregandoLojas.value,
);

function paramsEscopoLoja(extra = {}) {
  if (auth.isSuperAdmin && lojaDestinoId.value)
    return { ...extra, lojaId: lojaDestinoId.value };
  return { ...extra };
}

function rotaAuditoria(auditoriaId) {
  if (auth.isSuperAdmin && lojaDestinoId.value) {
    return {
      path: `/auditorias/${auditoriaId}`,
      query: { lojaId: lojaDestinoId.value },
    };
  }
  return { path: `/auditorias/${auditoriaId}` };
}

function statusAuditoria(auditoria) {
  if (auditoria?.status === "CANCELADA")
    return { text: "Cancelada", klass: "bad" };
  if (auditoria?.status === "ERRO") return { text: "Erro", klass: "bad" };
  if (auditoria?.status === "PROCESSANDO")
    return { text: "Processando", klass: "warn" };
  return { text: "Concluída", klass: "ok" };
}

async function carregarLojasDestino() {
  if (!auth.isSuperAdmin) return;

  carregandoLojas.value = true;
  erroLojas.value = "";
  try {
    const { data } = await api.get("/lojas");
    lojasDisponiveis.value = (data.items || []).filter(
      (loja) => loja.ativa !== false,
    );

    const lojaSalva = localStorage.getItem(LOJA_DESTINO_STORAGE_KEY);
    const lojaInicial =
      lojasDisponiveis.value.find((loja) => loja._id === lojaSalva) || null;
    lojaDestinoId.value = lojaInicial?._id || "";

    if (lojaDestinoId.value)
      localStorage.setItem(LOJA_DESTINO_STORAGE_KEY, lojaDestinoId.value);
    else localStorage.removeItem(LOJA_DESTINO_STORAGE_KEY);
  } catch (error) {
    erroLojas.value =
      error?.response?.data?.error || "Não foi possível carregar as lojas.";
    lojasDisponiveis.value = [];
    lojaDestinoId.value = "";
  } finally {
    carregandoLojas.value = false;
  }
}

async function listar() {
  if (auth.isSuperAdmin && !lojaDestinoId.value) {
    auditorias.value = [];
    carregando.value = false;
    return;
  }

  carregando.value = true;
  try {
    const params = {};
    if (filtroTipo.value) params.tipo = filtroTipo.value;
    const { data } = await api.get("/auditorias", {
      params: paramsEscopoLoja(params),
    });
    auditorias.value = data.items;
  } finally {
    carregando.value = false;
  }
}

async function trocarLojaDestino() {
  if (!auth.isSuperAdmin) return;

  if (lojaDestinoId.value)
    localStorage.setItem(LOJA_DESTINO_STORAGE_KEY, lojaDestinoId.value);
  else localStorage.removeItem(LOJA_DESTINO_STORAGE_KEY);

  ultimoResultado.value = null;
  ultimaLojaProcessada.value = null;
  limparArquivoSelecionado();
  resetarEstadoUpload();
  await listar();
}

onMounted(async () => {
  if (auth.isSuperAdmin) await carregarLojasDestino();
  await listar();
});

function limparArquivoSelecionado() {
  arquivo.value = null;
  if (fileInput.value) fileInput.value.value = "";
}

function resetarEstadoUpload() {
  progressoUpload.value = 0;
  etapaUpload.value = arquivo.value ? "ready" : "idle";
  detalheProcessamento.value = "";
  erroUpload.value = "";
}

function adicionarFilaArquivos(files) {
  if (!files || !files.length) return;
  for (const file of Array.from(files)) {
    fila.value.push({
      id: ++idCounter,
      file,
      status: "waiting",
      erro: "",
      resultado: null,
    });
  }
  if (fileInput.value) fileInput.value.value = "";
  iniciarFila();
}

function removerDaFila(id) {
  const idx = fila.value.findIndex((item) => item.id === id);
  if (idx !== -1 && fila.value[idx].status !== "processing") {
    fila.value.splice(idx, 1);
  }
}

async function iniciarFila() {
  if (filaProcessando) return;
  filaProcessando = true;
  while (componenteAtivo) {
    const proximo = fila.value.find((item) => item.status === "waiting");
    if (!proximo) break;
    await processarItem(proximo);
  }
  filaProcessando = false;
  // Se fila vazia e tudo processado, volta para idle
  const algumAtivo = fila.value.some(
    (item) => item.status === "waiting" || item.status === "processing",
  );
  if (!algumAtivo) {
    etapaUpload.value = fila.value.length
      ? fila.value.every((i) => i.status === "done")
        ? "success"
        : "idle"
      : "idle";
    arquivo.value = null;
  }
}

async function processarItem(item) {
  if (!componenteAtivo) return;
  item.status = "processing";
  arquivo.value = item.file;

  // reinicia animacao do zero
  progressoUpload.value = 0;
  etapaUpload.value = "upload";
  detalheProcessamento.value = "Enviando arquivo";
  erroUpload.value = "";
  ultimoResultado.value = null;
  enviando.value = true;

  ultimaLojaProcessada.value = lojaDestino.value
    ? {
        nome: lojaDestino.value.nome,
        cidade: lojaDestino.value.cidade,
        estado: lojaDestino.value.estado,
      }
    : auth.loja
      ? {
          nome: auth.loja.nome,
          cidade: auth.loja.cidade,
          estado: auth.loja.estado,
        }
      : null;

  const fd = new FormData();
  fd.append("arquivo", item.file);
  if (tipoForcado.value) fd.append("tipo", tipoForcado.value);

  try {
    const { data } = await api.post("/auditorias/upload", fd, {
      params: paramsEscopoLoja(),
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress(event) {
        if (!event.total) {
          progressoUpload.value = Math.max(progressoUpload.value, 18);
          return;
        }
        const percentual = event.loaded / event.total;
        progressoUpload.value = Math.max(
          progressoUpload.value,
          Math.min(34, percentual * 34),
        );
        detalheProcessamento.value =
          percentual >= 0.98
            ? "Arquivo recebido. Iniciando processamento…"
            : "Enviando arquivo";
      },
    });
    enviando.value = false;
    await acompanharProcessamentoItem(item, data.jobId);
  } catch (e) {
    pararSimulacaoProcessamento();
    etapaUpload.value = "error";
    progressoUpload.value = 0;
    const msg = e?.response?.data?.error || e?.message || "Falha no upload";
    erroUpload.value = msg;
    detalheProcessamento.value = msg;
    item.status = "error";
    item.erro = msg;
    ui.erro(`${item.file.name}: ${msg}`);
  } finally {
    enviando.value = false;
  }
}

async function acompanharProcessamentoItem(item, jobId) {
  etapaUpload.value = "processing";
  iniciarSimulacaoProcessamento();
  while (componenteAtivo) {
    const { data } = await api.get(`/auditorias/upload/${jobId}/status`);
    detalheProcessamento.value = data.stage || "Processando auditoria";
    const progressoMapeado = 34 + Number(data.progress || 0) * 0.66;
    progressoUpload.value = Math.max(progressoUpload.value, progressoMapeado);
    if (data.status === "done") {
      pararSimulacaoProcessamento();
      progressoUpload.value = 100;
      etapaUpload.value = "success";
      detalheProcessamento.value = data.result?.cancelada
        ? data.result.mensagemCancelamento ||
          "Auditoria cancelada. Métricas zeradas."
        : "Processamento concluído";
      item.status = "done";
      item.resultado = data.result;
      ultimoResultado.value = data.result;
      if (data.result?.cancelada) {
        ui.info(
          `${item.file.name}: auditoria cancelada. Dados não contabilizados.`,
        );
      } else {
        ui.sucesso(
          `${item.file.name}: ${data.result.tipo} — ${data.result.totalLidos} itens lidos`,
        );
      }
      await listar();
      return;
    }
    if (data.status === "error") {
      throw new Error(data.error || "Falha no processamento da planilha");
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
}

function iniciarSimulacaoProcessamento() {
  pararSimulacaoProcessamento();
  simulacaoProcessamento = setInterval(() => {
    if (etapaUpload.value !== "processing") return;
    progressoUpload.value = Math.min(
      96,
      progressoUpload.value +
        Math.max(0.35, (96 - progressoUpload.value) * 0.045),
    );
  }, 180);
}

function pararSimulacaoProcessamento() {
  if (!simulacaoProcessamento) return;
  clearInterval(simulacaoProcessamento);
  simulacaoProcessamento = null;
}

function pickFile(e) {
  adicionarFilaArquivos(e.target.files);
}
function onDrop(e) {
  dragOver.value = false;
  adicionarFilaArquivos(e.dataTransfer.files);
}

function irParaDashboard() {
  router.push({
    path: "/dashboard",
    query: paramsEscopoLoja({ refresh: Date.now() }),
  });
}

async function excluir(a) {
  if (
    !confirm(
      `Excluir auditoria de ${a.tipo} de ${new Date(a.data).toLocaleDateString("pt-BR")}?`,
    )
  )
    return;
  await api.delete("/auditorias/" + a._id, { params: paramsEscopoLoja() });
  ui.sucesso("Auditoria removida");
  listar();
}

// --- Cancelamento e Reclassificação ---
const auditoriaAlvo = ref(null); // auditoria selecionada nos modais
const modalCancelar = ref(false);
const motivoCancelamento = ref("");
const enviandoCancelar = ref(false);
const modalReclassificar = ref(false);
const novoTipoReclassificacao = ref("");
const enviandoReclassificar = ref(false);

function semLeitura(a) {
  if (!a) return false;
  if (a.status === "CANCELADA" || a.status === "PROCESSANDO") return false;
  return Number(a.totalLidos || 0) === 0;
}

function abrirCancelar(a) {
  auditoriaAlvo.value = a;
  motivoCancelamento.value = "";
  modalCancelar.value = true;
}

function fecharCancelar() {
  if (enviandoCancelar.value) return;
  modalCancelar.value = false;
  auditoriaAlvo.value = null;
  motivoCancelamento.value = "";
}

async function confirmarCancelar() {
  if (!auditoriaAlvo.value || enviandoCancelar.value) return;
  enviandoCancelar.value = true;
  try {
    const { data } = await api.post(
      `/auditorias/${auditoriaAlvo.value._id}/cancelar`,
      { motivo: motivoCancelamento.value.trim() },
      { params: paramsEscopoLoja() },
    );
    ui.sucesso(data?.mensagem || "Auditoria cancelada.");
    modalCancelar.value = false;
    auditoriaAlvo.value = null;
    motivoCancelamento.value = "";
    await listar();
  } catch (e) {
    ui.erro(
      e?.response?.data?.error || e?.message || "Não foi possível cancelar a auditoria.",
    );
  } finally {
    enviandoCancelar.value = false;
  }
}

function abrirReclassificar(a) {
  auditoriaAlvo.value = a;
  novoTipoReclassificacao.value = "";
  modalReclassificar.value = true;
}

function fecharReclassificar() {
  if (enviandoReclassificar.value) return;
  modalReclassificar.value = false;
  auditoriaAlvo.value = null;
  novoTipoReclassificacao.value = "";
}

async function confirmarReclassificar() {
  if (!auditoriaAlvo.value || enviandoReclassificar.value) return;
  if (!novoTipoReclassificacao.value) {
    ui.erro("Selecione o novo tipo da auditoria.");
    return;
  }
  if (novoTipoReclassificacao.value === auditoriaAlvo.value.tipo) {
    ui.erro("Escolha um tipo diferente do atual.");
    return;
  }
  enviandoReclassificar.value = true;
  try {
    const { data } = await api.patch(
      `/auditorias/${auditoriaAlvo.value._id}/reclassificar`,
      { tipo: novoTipoReclassificacao.value },
      { params: paramsEscopoLoja() },
    );
    ui.sucesso(data?.mensagem || "Auditoria reclassificada.");
    modalReclassificar.value = false;
    auditoriaAlvo.value = null;
    novoTipoReclassificacao.value = "";
    await listar();
  } catch (e) {
    ui.erro(
      e?.response?.data?.error || e?.message || "Não foi possível reclassificar.",
    );
  } finally {
    enviandoReclassificar.value = false;
  }
}

const nomeDiaSemana = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
][new Date().getDay()];
const tipoLabels = {
  ETIQUETA: "Etiqueta",
  PRESENCA: "Presença",
  RUPTURA: "Ruptura",
};

const uploadEmAndamento = computed(
  () => etapaUpload.value === "upload" || etapaUpload.value === "processing",
);
const uploadComPreenchimento = computed(
  () => uploadEmAndamento.value || etapaUpload.value === "success",
);
const resultadoCancelado = computed(() => !!ultimoResultado.value?.cancelada);
const progressoExibido = computed(() =>
  Math.round(Math.max(0, Math.min(100, progressoUpload.value))),
);
const arquivoResumo = computed(() => {
  if (!arquivo.value) return null;
  return {
    nome: arquivo.value.name,
    tamanho: formatBytes(arquivo.value.size),
  };
});
const tipoAtualLabel = computed(() =>
  tipoForcado.value ? tipoLabels[tipoForcado.value] : "Automático",
);
const lojaDestinoLabel = computed(
  () => lojaDestino.value?.nome || "Selecione uma loja",
);
const lojaDestinoResumo = computed(() =>
  [lojaDestino.value?.cidade, lojaDestino.value?.estado]
    .filter(Boolean)
    .join(" / "),
);
const filaVisivelOrdenada = computed(() =>
  fila.value.filter((i) => i.status !== "done" || fila.value.length <= 5),
);
const temFilaEspera = computed(() =>
  fila.value.some((i) => i.status === "waiting"),
);
const statusUploadTitulo = computed(() => {
  if (uploadBloqueadoSemLoja.value) return "Escolha a loja de destino";
  if (etapaUpload.value === "upload") return "Enviando a planilha";
  if (etapaUpload.value === "processing") return "Processando auditoria";
  if (etapaUpload.value === "success" && resultadoCancelado.value)
    return "Auditoria cancelada";
  if (etapaUpload.value === "success") return "Upload concluído";
  if (etapaUpload.value === "error") return "Falha no envio";
  if (arquivo.value) return "Arquivo pronto";
  return "Aguardando planilha";
});
const statusUploadTexto = computed(() => {
  if (auth.isSuperAdmin && erroLojas.value) return erroLojas.value;
  if (uploadBloqueadoSemLoja.value)
    return "Selecione a loja em que esta auditoria deve ser processada. O histórico abaixo também seguirá a loja escolhida.";
  if (etapaUpload.value === "upload")
    return "Transferindo o arquivo para o servidor.";
  if (etapaUpload.value === "processing")
    return (
      detalheProcessamento.value ||
      "Classificando itens e atualizando métricas."
    );
  if (etapaUpload.value === "success" && resultadoCancelado.value)
    return (
      ultimoResultado.value?.mensagemCancelamento ||
      "A planilha foi recebida, mas essa auditoria está cancelada e não conta para métricas, rankings ou acumulados."
    );
  if (etapaUpload.value === "success")
    return "Sua auditoria foi processada e o histórico já foi atualizado.";
  if (etapaUpload.value === "error")
    return erroUpload.value || "Não foi possível concluir o upload.";
  if (arquivo.value)
    return "Confira o tipo, revise o arquivo e inicie o processamento.";
  return "Selecione uma planilha exportada do coletor para iniciar.";
});
const badgeStatusUpload = computed(() => {
  if (uploadBloqueadoSemLoja.value)
    return { text: "Loja obrigatória", klass: "warn" };
  if (etapaUpload.value === "success" && resultadoCancelado.value)
    return { text: "Cancelada", klass: "warn" };
  if (etapaUpload.value === "success")
    return { text: "Concluído", klass: "ok" };
  if (etapaUpload.value === "error") return { text: "Erro", klass: "bad" };
  if (uploadEmAndamento.value)
    return { text: `${progressoExibido.value}%`, klass: "info" };
  if (arquivo.value) return { text: "Pronto", klass: "warn" };
  return { text: "Aguardando", klass: "dim" };
});

onBeforeUnmount(() => {
  componenteAtivo = false;
  pararSimulacaoProcessamento();
});
</script>

<template>
  <div class="grid gap-3">
    <div
      v-if="auth.podeGerenciar"
      class="upload-shell card glow"
      :class="{
        uploading: uploadEmAndamento,
        ready: !!arquivo,
        success: etapaUpload === 'success',
        canceled: resultadoCancelado,
        error: etapaUpload === 'error',
      }"
    >
      <div
        v-if="uploadComPreenchimento"
        class="upload-liquid"
        :style="{ height: progressoExibido + '%' }"
        aria-hidden="true"
      ></div>

      <div class="upload-shell-inner">
        <div class="upload-topbar row">
          <div>
            <h3 class="mt-0 mb-0">
              <fa icon="cloud-arrow-up" /> Enviar planilha de auditoria
            </h3>
            <div
              v-if="tipoForcado"
              class="row mt-1"
              style="font-size: 13px; gap: 8px"
            >
              <span class="badge" :class="'tipo-' + tipoForcado"
                ><fa icon="calendar" /> {{ nomeDiaSemana }} →
                {{ tipoLabels[tipoForcado] }} sugerido</span
              >
              <span class="muted">Você pode alterar o tipo acima</span>
            </div>
            <div v-else class="muted mt-1" style="font-size: 13px">
              Defina manualmente ou deixe a detecção automática agir.
            </div>
          </div>

          <div class="upload-topbar-actions">
            <div v-if="auth.isSuperAdmin" class="field upload-type-field">
              <label>Loja de destino</label>
              <select
                v-model="lojaDestinoId"
                class="upload-type-select"
                :disabled="uploadEmAndamento || carregandoLojas"
                @change="trocarLojaDestino"
              >
                <option value="">
                  {{
                    carregandoLojas ? "Carregando lojas…" : "Escolha uma loja"
                  }}
                </option>
                <option
                  v-for="loja in lojasDisponiveis"
                  :key="loja._id"
                  :value="loja._id"
                >
                  {{ loja.nome }}
                </option>
              </select>
            </div>

            <div class="field upload-type-field">
              <label>Tipo da auditoria</label>
              <select
                v-model="tipoForcado"
                class="upload-type-select"
                :disabled="uploadEmAndamento"
              >
                <option value="">Detectar automaticamente</option>
                <option value="ETIQUETA">Etiqueta</option>
                <option value="PRESENCA">Presença</option>
                <option value="RUPTURA">Ruptura</option>
              </select>
            </div>
          </div>
        </div>

        <div class="upload-layout">
          <div
            class="upload-status-card"
            :class="{ 'has-fila': fila.length > 0 }"
          >
            <div class="upload-status-icon">
              <fa
                :icon="
                  uploadEmAndamento
                    ? 'spinner'
                    : resultadoCancelado
                      ? 'triangle-exclamation'
                      : etapaUpload === 'success'
                        ? 'check'
                        : etapaUpload === 'error'
                          ? 'triangle-exclamation'
                          : 'cloud-arrow-up'
                "
                :spin="uploadEmAndamento"
              />
            </div>

            <div class="upload-status-copy">
              <span class="badge" :class="badgeStatusUpload.klass">{{
                badgeStatusUpload.text
              }}</span>
              <h4>{{ statusUploadTitulo }}</h4>
              <p>{{ statusUploadTexto }}</p>
            </div>

            <div v-if="!fila.length" class="upload-status-meta">
              <div v-if="auth.isSuperAdmin" class="upload-meta-row">
                <span class="muted">Loja</span>
                <strong>{{ lojaDestinoLabel }}</strong>
              </div>
              <div
                v-if="auth.isSuperAdmin && lojaDestinoResumo"
                class="upload-meta-row"
              >
                <span class="muted">Local</span>
                <strong>{{ lojaDestinoResumo }}</strong>
              </div>
              <div class="upload-meta-row">
                <span class="muted">Tipo</span>
                <strong>{{ tipoAtualLabel }}</strong>
              </div>
              <div class="upload-meta-row">
                <span class="muted">Limite</span>
                <strong>100 MB</strong>
              </div>
            </div>

            <!-- Fila de processamento dentro do card esquerdo -->
            <Transition name="fila-fade">
              <div v-if="fila.length > 0" class="upload-fila-interna">
                <div class="upload-fila-header row">
                  <span
                    style="
                      font-size: 12px;
                      font-weight: 600;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                      opacity: 0.6;
                    "
                    >Fila</span
                  >
                  <span class="badge dim" style="font-size: 11px"
                    >{{
                      fila.filter((i) => i.status !== "done").length
                    }}
                    pendente(s)</span
                  >
                  <span class="spacer" />
                  <button
                    v-if="
                      !uploadEmAndamento &&
                      fila.some((i) => i.status === 'done')
                    "
                    class="btn ghost"
                    style="font-size: 11px; padding: 2px 8px"
                    @click="
                      fila.splice(
                        0,
                        fila.length,
                        ...fila.filter((i) => i.status !== 'done'),
                      )
                    "
                  >
                    <fa icon="broom" />
                  </button>
                </div>
                <div class="upload-fila-scroll">
                  <TransitionGroup name="fila-item" tag="div">
                    <div
                      v-for="item in filaVisivelOrdenada"
                      :key="item.id"
                      class="upload-fila-item"
                      :class="item.status"
                    >
                      <div class="fila-item-icon">
                        <fa
                          v-if="item.status === 'processing'"
                          icon="spinner"
                          spin
                        />
                        <span
                          v-else-if="item.status === 'waiting'"
                          class="fila-waiting-pulse"
                        />
                        <fa v-else-if="item.status === 'done'" icon="check" />
                        <fa v-else icon="triangle-exclamation" />
                      </div>
                      <div class="fila-item-info">
                        <div class="fila-item-nome">{{ item.file.name }}</div>
                        <div class="fila-item-meta muted">
                          <span>{{ formatBytes(item.file.size) }}</span>
                          <span v-if="item.status === 'processing'">
                            · Processando…</span
                          >
                          <span v-else-if="item.status === 'waiting'">
                            · Na fila</span
                          >
                          <span v-else-if="item.status === 'done'">
                            · Concluído</span
                          >
                          <span
                            v-else-if="item.status === 'error'"
                            class="fila-item-erro"
                          >
                            · {{ item.erro }}</span
                          >
                        </div>
                      </div>
                      <button
                        v-if="item.status === 'waiting'"
                        class="btn ghost fila-item-remove"
                        title="Remover da fila"
                        @click.prevent="removerDaFila(item.id)"
                      >
                        <fa icon="xmark" />
                      </button>
                    </div>
                  </TransitionGroup>
                </div>
              </div>
            </Transition>
          </div>

          <label
            class="dropzone upload-dropzone"
            :class="{
              over: dragOver,
              active: fila.length > 0,
              disabled: !podeSelecionarArquivo,
              'cursor-pointer': podeSelecionarArquivo,
              'cursor-not-allowed': uploadBloqueadoSemLoja,
            }"
            @dragover.prevent="podeSelecionarArquivo && (dragOver = true)"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="podeSelecionarArquivo && onDrop($event)"
          >
            <input
              ref="fileInput"
              type="file"
              multiple
              accept=".xlsx,.xls,.xlsb,.xlsm,.csv,.ods"
              @change="pickFile"
              hidden
              :disabled="!podeSelecionarArquivo"
            />

            <template v-if="uploadEmAndamento">
              <div class="upload-progress-stage">
                <div
                  class="upload-progress-meter"
                  :style="{ '--meter-progress': progressoExibido + '%' }"
                >
                  <div class="upload-progress-value">
                    {{ progressoExibido }}%
                  </div>
                  <div class="upload-progress-ripple"></div>
                </div>
                <div class="upload-progress-label">
                  {{ statusUploadTitulo }}
                </div>
                <div class="upload-stage-display">
                  <div class="stage-live-label">
                    <span class="stage-live-dot"></span>
                    <span>{{
                      detalheProcessamento || "Acompanhando processamento"
                    }}</span>
                  </div>
                  <div class="stage-name-rotator" aria-hidden="true">
                    <span>Validando estrutura da planilha</span>
                    <span>Lendo itens auditados</span>
                    <span>Classificando situações</span>
                    <span>Atualizando métricas da loja</span>
                    <span>Consolidando histórico</span>
                  </div>
                </div>
                <div class="progress upload-progress-bar">
                  <span :style="{ width: progressoExibido + '%' }" />
                </div>
                <div class="muted upload-progress-footnote">
                  A barra combina envio real do arquivo com o avanço do
                  processamento da auditoria.
                </div>
              </div>
            </template>

            <template v-else-if="auth.isSuperAdmin && !lojaDestinoId">
              <div class="upload-drop-content">
                <div class="upload-drop-icon"><fa icon="store" /></div>
                <strong
                  >Escolha a loja de destino para habilitar o envio</strong
                >
                <div class="muted">
                  A planilha será processada exatamente para a loja selecionada
                  acima.
                </div>
              </div>
            </template>

            <template v-else-if="temFilaEspera">
              <div class="upload-drop-content">
                <div class="upload-drop-icon"><fa icon="layer-group" /></div>
                <strong
                  >{{
                    fila.filter((i) => i.status === "waiting").length
                  }}
                  arquivo(s) aguardando na fila</strong
                >
                <div class="muted">
                  Clique ou arraste para adicionar mais planilhas
                </div>
              </div>
            </template>

            <template v-else>
              <div class="upload-drop-content">
                <div class="upload-drop-icon"><fa icon="cloud-arrow-up" /></div>
                <strong
                  >Arraste planilhas aqui ou clique para selecionar</strong
                >
                <div class="muted">
                  Selecione vários arquivos de uma vez — Excel / CSV até 100 MB
                  cada
                </div>
              </div>
            </template>
          </label>
        </div>

        <div class="upload-footer row">
          <div class="upload-footer-copy">
            <span class="muted" style="font-size: 12px">
              Detecção automática usa o nome do arquivo e a aba. Override manual
              tem prioridade.
            </span>
            <span
              v-if="auth.isSuperAdmin && lojaDestinoId"
              class="badge dim upload-store-badge"
            >
              <fa icon="store" /> {{ lojaDestinoLabel }}
            </span>
            <span v-if="erroUpload" class="badge bad upload-error-badge">{{
              erroUpload
            }}</span>
          </div>

          <div class="upload-footer-actions">
            <div v-if="uploadComPreenchimento" class="upload-inline-progress">
              <span class="muted">{{
                uploadEmAndamento
                  ? detalheProcessamento || "Processando"
                  : "Último processamento"
              }}</span>
              <strong>{{ progressoExibido }}%</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- Resultado do upload -->
      <Transition name="fade">
        <div
          v-if="ultimoResultado"
          class="card mt-3 upload-result-card"
          :class="{ canceled: ultimoResultado.cancelada }"
        >
          <div class="row">
            <fa
              :icon="
                ultimoResultado.cancelada ? 'triangle-exclamation' : 'check'
              "
              class="upload-result-icon"
            />
            <strong>{{ ultimoResultado.tipo }}</strong>
            <span class="muted">·</span>
            <span>{{
              new Date(ultimoResultado.dataAuditoria).toLocaleDateString(
                "pt-BR",
              )
            }}</span>
            <span v-if="ultimaLojaProcessada?.nome" class="muted">·</span>
            <span v-if="ultimaLojaProcessada?.nome" class="badge dim"
              ><fa icon="store" /> {{ ultimaLojaProcessada.nome }}</span
            >
            <span class="spacer" />
            <span v-if="ultimoResultado.cancelada" class="badge warn"
              >Auditoria cancelada</span
            >
            <span v-else class="badge ok">
              {{ ultimoResultado.taxaConformidade?.toFixed(1) }}% conformidade
            </span>
          </div>
          <div v-if="ultimoResultado.cancelada" class="upload-cancel-copy mt-2">
            <fa icon="triangle-exclamation" />
            <span>{{ ultimoResultado.mensagemCancelamento }}</span>
          </div>
          <div class="row mt-2 gap-3" style="font-size: 13px">
            <span
              ><span class="muted">Itens:</span>
              <strong>{{ ultimoResultado.totalItens }}</strong></span
            >
            <span
              ><span class="muted">Lidos:</span>
              <strong>{{ ultimoResultado.totalLidos }}</strong></span
            >
            <span
              ><span class="muted">Conformes:</span>
              <strong>{{ ultimoResultado.totalConformes }}</strong></span
            >
            <span
              ><span class="muted">Pts:</span>
              <strong>{{
                Math.round(ultimoResultado.pontuacao || 0)
              }}</strong></span
            >
            <span class="spacer" />
            <button
              class="btn ghost"
              style="font-size: 13px"
              @click="irParaDashboard"
            >
              <fa icon="gauge" /> Ver no Dashboard
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Histórico -->
    <div class="card">
      <div class="row mb-2">
        <h3 class="mt-0 mb-0">Histórico de auditorias</h3>
        <span v-if="auth.isSuperAdmin && lojaDestinoId" class="badge dim"
          ><fa icon="store" /> {{ lojaDestinoLabel }}</span
        >
        <span class="spacer" />
        <select
          v-model="filtroTipo"
          @change="listar"
          class="btn ghost"
          style="padding: 8px 14px"
        >
          <option value="">Todos os tipos</option>
          <option value="ETIQUETA">Etiqueta</option>
          <option value="PRESENCA">Presença</option>
          <option value="RUPTURA">Ruptura</option>
        </select>
      </div>

      <Loader v-if="carregando" />
      <div v-else-if="auth.isSuperAdmin && !lojaDestinoId" class="empty">
        Escolha uma loja acima para ver o histórico e enviar planilhas para ela.
      </div>
      <div v-else-if="!auditorias.length" class="empty">
        Nenhuma auditoria encontrada.
      </div>
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Data</th>
              <th>Itens lidos</th>
              <th>Conclusão</th>
              <th>Pontuação</th>
              <th>Custo Ruptura</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="a in auditorias"
              :key="a._id"
              :class="a.status === 'CANCELADA' ? 'auditoria-cancelada-row' : ''"
            >
              <td>
                <span class="badge" :class="'tipo-' + a.tipo">{{
                  a.tipo
                }}</span>
                <span
                  class="badge audit-status-badge"
                  :class="statusAuditoria(a).klass"
                >
                  {{ statusAuditoria(a).text }}
                </span>
                <span
                  v-if="semLeitura(a)"
                  class="badge warn audit-status-badge"
                  title="Nenhum colaborador realizou leituras nessa auditoria. Considere cancelá-la."
                >
                  <fa icon="triangle-exclamation" /> Sem leituras
                </span>
              </td>
              <td>{{ new Date(a.data).toLocaleDateString("pt-BR") }}</td>
              <td>
                {{ a.totalLidos?.toLocaleString("pt-BR") }} /
                {{ a.totalItens?.toLocaleString("pt-BR") }}
              </td>
              <td>
                <div class="row gap-2">
                  {{ a.taxaConformidade?.toFixed(1) }}%
                  <div class="progress" style="flex: 1; min-width: 60px">
                    <span
                      :style="{
                        width: Math.min(100, a.taxaConformidade || 0) + '%',
                      }"
                    />
                  </div>
                </div>
              </td>
              <td>{{ Math.round(a.pontuacao || 0) }}</td>
              <td>
                <span v-if="a.custoRupturaTotal > 0" class="badge bad">
                  R$
                  {{
                    a.custoRupturaTotal.toLocaleString("pt-BR", {
                      maximumFractionDigits: 0,
                    })
                  }}
                </span>
                <span v-else class="muted">—</span>
              </td>
              <td class="text-right">
                <div class="row gap-1 audit-actions">
                  <RouterLink
                    :to="rotaAuditoria(a._id)"
                    class="btn ghost"
                    title="Ver detalhes"
                  >
                    <fa icon="eye" />
                  </RouterLink>
                  <button
                    v-if="auth.podeGerenciar && a.status !== 'CANCELADA'"
                    class="btn ghost"
                    title="Reclassificar tipo"
                    @click="abrirReclassificar(a)"
                  >
                    <fa icon="shuffle" />
                  </button>
                  <button
                    v-if="auth.podeGerenciar && a.status !== 'CANCELADA'"
                    class="btn ghost warn"
                    title="Cancelar auditoria (não conta nas métricas)"
                    @click="abrirCancelar(a)"
                  >
                    <fa icon="ban" />
                  </button>
                  <button
                    v-if="auth.podeGerenciar"
                    class="btn ghost danger"
                    @click="excluir(a)"
                    title="Excluir"
                  >
                    <fa icon="trash" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal: Cancelar auditoria -->
    <Transition name="fade">
      <div
        v-if="modalCancelar"
        class="audit-modal-backdrop"
        @click.self="fecharCancelar"
      >
        <div class="audit-modal card">
          <h3 class="mt-0 mb-1">
            <fa icon="ban" /> Cancelar auditoria
          </h3>
          <p class="muted mt-0">
            A auditoria continuará registrada no histórico, mas será marcada
            como
            <strong>cancelada</strong> e <strong>não entrará</strong> em
            métricas, ranking, pontuação ou conformidade.
          </p>
          <div v-if="auditoriaAlvo" class="audit-modal-target">
            <span class="badge" :class="'tipo-' + auditoriaAlvo.tipo">{{
              auditoriaAlvo.tipo
            }}</span>
            <span class="muted">·</span>
            <strong>{{
              new Date(auditoriaAlvo.data).toLocaleDateString("pt-BR")
            }}</strong>
          </div>
          <div class="field mt-2">
            <label>Motivo (opcional)</label>
            <textarea
              v-model="motivoCancelamento"
              rows="3"
              placeholder="Ex.: planilha de teste, dia sem leitura, duplicidade…"
              :disabled="enviandoCancelar"
            />
          </div>
          <div class="row mt-2 gap-2" style="justify-content: flex-end">
            <button
              class="btn ghost"
              :disabled="enviandoCancelar"
              @click="fecharCancelar"
            >
              Manter ativa
            </button>
            <button
              class="btn warn"
              :disabled="enviandoCancelar"
              @click="confirmarCancelar"
            >
              <fa :icon="enviandoCancelar ? 'spinner' : 'ban'" :spin="enviandoCancelar" />
              Cancelar auditoria
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Modal: Reclassificar auditoria -->
    <Transition name="fade">
      <div
        v-if="modalReclassificar"
        class="audit-modal-backdrop"
        @click.self="fecharReclassificar"
      >
        <div class="audit-modal card">
          <h3 class="mt-0 mb-1">
            <fa icon="shuffle" /> Reclassificar auditoria
          </h3>
          <p class="muted mt-0">
            Todos os itens desta auditoria serão reavaliados com as regras do
            novo tipo. Pontuação, conformidade e ranking serão recalculados
            automaticamente.
          </p>
          <div v-if="auditoriaAlvo" class="audit-modal-target">
            <span class="muted">De</span>
            <span class="badge" :class="'tipo-' + auditoriaAlvo.tipo">{{
              tipoLabels[auditoriaAlvo.tipo] || auditoriaAlvo.tipo
            }}</span>
            <fa icon="arrow-right" class="muted" />
            <span class="muted">para</span>
            <select
              v-model="novoTipoReclassificacao"
              class="upload-type-select"
              :disabled="enviandoReclassificar"
              style="padding: 8px 14px; font-size: 14px"
            >
              <option value="">Escolha o novo tipo</option>
              <option
                v-for="t in ['ETIQUETA', 'PRESENCA', 'RUPTURA'].filter(
                  (t) => t !== auditoriaAlvo.tipo,
                )"
                :key="t"
                :value="t"
              >
                {{ tipoLabels[t] }}
              </option>
            </select>
          </div>
          <div class="audit-modal-warn mt-2">
            <fa icon="triangle-exclamation" />
            <span>
              Se já existir uma auditoria do tipo escolhido na mesma loja e
              data, a reclassificação será bloqueada. Exclua ou cancele a outra
              antes.
            </span>
          </div>
          <div class="row mt-2 gap-2" style="justify-content: flex-end">
            <button
              class="btn ghost"
              :disabled="enviandoReclassificar"
              @click="fecharReclassificar"
            >
              Voltar
            </button>
            <button
              class="btn primary"
              :disabled="enviandoReclassificar || !novoTipoReclassificacao"
              @click="confirmarReclassificar"
            >
              <fa
                :icon="enviandoReclassificar ? 'spinner' : 'shuffle'"
                :spin="enviandoReclassificar"
              />
              Reclassificar
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.audit-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(8, 13, 26, 0.62);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  z-index: 80;
  padding: 16px;
}
.audit-modal {
  width: min(100%, 480px);
  padding: 22px;
  display: grid;
  gap: 4px;
}
.audit-modal-target {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border);
  margin-top: 8px;
}
.audit-modal-warn {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(245, 158, 11, 0.34);
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
  font-size: 13px;
}
.audit-actions {
  justify-content: flex-end;
  flex-wrap: wrap;
}
.btn.ghost.warn {
  color: #f59e0b;
}
.btn.warn {
  background: rgba(245, 158, 11, 0.18);
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.4);
}
.btn.warn:hover {
  background: rgba(245, 158, 11, 0.28);
}

.upload-shell {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  background:
    linear-gradient(
      145deg,
      rgba(124, 92, 255, 0.13),
      rgba(34, 211, 238, 0.08) 48%,
      rgba(34, 197, 94, 0.07)
    ),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)),
    var(--surface);
  border-color: rgba(124, 92, 255, 0.2);
  transition:
    border-color 0.28s ease,
    box-shadow 0.28s ease,
    transform 0.28s ease;
}

.upload-shell.uploading {
  border-color: rgba(34, 211, 238, 0.34);
  box-shadow:
    0 18px 48px rgba(10, 25, 55, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.upload-shell.success {
  border-color: rgba(34, 197, 94, 0.34);
}

.upload-shell.canceled {
  border-color: rgba(245, 158, 11, 0.42);
}

.upload-shell.error {
  border-color: rgba(239, 68, 68, 0.38);
}

.upload-result-card {
  background: rgba(34, 197, 94, 0.06);
  border-color: rgba(34, 197, 94, 0.3);
}

.upload-result-card.canceled {
  background: rgba(245, 158, 11, 0.08);
  border-color: rgba(245, 158, 11, 0.32);
}

.upload-result-icon {
  color: var(--success);
  font-size: 18px;
}

.upload-result-card.canceled .upload-result-icon {
  color: #f59e0b;
}

.upload-cancel-copy {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fbbf24;
  font-size: 13px;
  font-weight: 700;
}

.audit-status-badge {
  margin-left: 6px;
}

.auditoria-cancelada-row {
  background: rgba(245, 158, 11, 0.05);
}

[data-theme="light"] .upload-cancel-copy {
  color: #92400e;
}

.upload-shell::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      115deg,
      transparent 0 28%,
      rgba(255, 255, 255, 0.08) 43%,
      transparent 58% 100%
    ),
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 32%);
  pointer-events: none;
  z-index: 0;
  opacity: 0.72;
}

.upload-shell-inner,
.upload-shell > .card {
  position: relative;
  z-index: 2;
}

.upload-shell-inner {
  display: grid;
  gap: 20px;
}

.upload-liquid {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  min-height: 0;
  background:
    linear-gradient(
      180deg,
      rgba(34, 211, 238, 0.08) 0%,
      rgba(34, 211, 238, 0.16) 42%,
      rgba(37, 99, 235, 0.24) 72%,
      rgba(124, 92, 255, 0.28) 100%
    );
  box-shadow:
    inset 0 18px 34px rgba(255, 255, 255, 0.1),
    0 -12px 28px rgba(34, 211, 238, 0.12);
  transition: height 0.68s cubic-bezier(0.2, 0.8, 0.2, 1);
  pointer-events: none;
  z-index: 1;
  transform: translateZ(0);
}

[data-theme="light"] .upload-shell {
  background:
    linear-gradient(
      145deg,
      rgba(109, 92, 255, 0.16),
      rgba(17, 197, 255, 0.11) 48%,
      rgba(16, 185, 129, 0.08)
    ),
    linear-gradient(180deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0)),
    rgba(255, 255, 255, 0.72);
}

[data-theme="light"] .upload-liquid {
  background:
    linear-gradient(
      180deg,
      rgba(17, 197, 255, 0.08) 0%,
      rgba(17, 197, 255, 0.16) 42%,
      rgba(37, 99, 235, 0.22) 72%,
      rgba(109, 92, 255, 0.24) 100%
    );
  box-shadow:
    inset 0 18px 34px rgba(255, 255, 255, 0.16),
    0 -12px 28px rgba(17, 197, 255, 0.1);
}

.upload-topbar {
  align-items: flex-start;
}

.upload-topbar-actions {
  display: flex;
  gap: 14px;
  align-items: flex-end;
  margin-left: auto;
  flex-wrap: wrap;
}

.upload-type-field {
  min-width: 260px;
  margin: 0;
}

.upload-type-select {
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 16px;
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.upload-layout {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: 18px;
  align-items: stretch;
}

.upload-status-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid var(--border);
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.16),
      rgba(255, 255, 255, 0.07)
    ),
    rgba(8, 13, 26, 0.1);
  backdrop-filter: blur(6px);
  min-height: 100%;
  overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.upload-status-card::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    110deg,
    transparent 0 34%,
    rgba(255, 255, 255, 0.12) 47%,
    transparent 60% 100%
  );
  opacity: 0;
  transform: translateX(-45%);
  pointer-events: none;
}

.upload-shell.uploading .upload-status-card::before {
  animation: cardSheen 3.8s ease-in-out infinite;
}

.upload-status-card.has-fila {
  min-height: 320px;
}

.upload-status-icon {
  position: relative;
  overflow: hidden;
  width: 62px;
  height: 62px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background: linear-gradient(
    135deg,
    rgba(124, 92, 255, 0.24),
    rgba(34, 211, 238, 0.24)
  );
  color: var(--text);
  font-size: 24px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.upload-status-icon::after {
  content: "";
  position: absolute;
  inset: 8px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  opacity: 0.45;
}

.upload-shell.uploading .upload-status-icon {
  animation: iconBuoy 2.8s ease-in-out infinite;
}

.upload-status-copy h4 {
  margin: 10px 0 8px;
  font-size: 20px;
}

.upload-status-copy p {
  margin: 0;
  color: var(--text-dim);
  line-height: 1.5;
  font-size: 14px;
}

.upload-status-meta {
  display: grid;
  gap: 10px;
}

.upload-meta-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}

.upload-dropzone {
  min-height: 250px;
  display: grid;
  place-items: center;
  text-align: center;
  background: rgba(255, 255, 255, 0.08);
  border-width: 2px;
  position: relative;
  overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.upload-dropzone::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    120deg,
    transparent 0 35%,
    rgba(255, 255, 255, 0.1) 48%,
    transparent 62% 100%
  );
  opacity: 0;
  transform: translateX(-55%);
  pointer-events: none;
}

.upload-shell.uploading .upload-dropzone::before,
.upload-dropzone.over::before {
  animation: dropzoneSweep 2.8s ease-in-out infinite;
  opacity: 1;
}

.upload-dropzone.active {
  border-color: rgba(124, 92, 255, 0.36);
  background: rgba(255, 255, 255, 0.1);
}

.upload-dropzone.disabled {
  cursor: progress;
}

.upload-dropzone.cursor-pointer {
  cursor: pointer;
}
.upload-dropzone.cursor-not-allowed {
  cursor: not-allowed;
}

.upload-drop-content,
.upload-progress-stage {
  position: relative;
  z-index: 1;
  width: min(100%, 520px);
  display: grid;
  gap: 10px;
  justify-items: center;
}

.upload-drop-icon {
  width: 72px;
  height: 72px;
  border-radius: 22px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.78);
  color: var(--text-dim);
  font-size: 28px;
  box-shadow: 0 10px 24px rgba(70, 82, 126, 0.14);
}

.upload-progress-meter {
  --meter-progress: 0%;
  position: relative;
  width: 168px;
  height: 168px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background:
    conic-gradient(
      from -90deg,
      rgba(34, 211, 238, 0.95) var(--meter-progress),
      rgba(255, 255, 255, 0.18) 0
    ),
    linear-gradient(135deg, rgba(124, 92, 255, 0.36), rgba(34, 211, 238, 0.24));
  box-shadow:
    0 18px 42px rgba(9, 18, 38, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.32);
}

.upload-progress-meter::before {
  content: "";
  position: absolute;
  inset: 9px;
  border-radius: inherit;
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.34),
      rgba(255, 255, 255, 0.14)
    ),
    rgba(8, 13, 26, 0.18);
  backdrop-filter: blur(8px);
  box-shadow: inset 0 0 32px rgba(255, 255, 255, 0.1);
}

.upload-progress-meter::after {
  content: "";
  position: absolute;
  inset: 24px;
  border-radius: inherit;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.3),
    transparent 48%
  );
  opacity: 0.58;
  animation: meterGleam 4s ease-in-out infinite;
}

.upload-progress-ripple {
  position: absolute;
  inset: 17px;
  border-radius: inherit;
  border: 1px solid rgba(255, 255, 255, 0.32);
  z-index: 3;
  animation: meterRipple 2.4s ease-out infinite;
}

.upload-progress-value {
  position: relative;
  z-index: 2;
  font-size: 54px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0;
  text-shadow: 0 2px 14px rgba(11, 15, 26, 0.18);
}

.upload-progress-label {
  font-size: 17px;
  font-weight: 700;
}

.upload-stage-display {
  width: min(100%, 460px);
  min-height: 78px;
  display: grid;
  gap: 8px;
  padding: 11px 14px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(8px);
}

.stage-live-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
}

.stage-live-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.42);
  flex: 0 0 auto;
  animation: stagePulse 1.55s ease-out infinite;
}

.stage-name-rotator {
  position: relative;
  width: 100%;
  height: 24px;
  overflow: hidden;
  color: var(--text-dim);
  font-size: 13px;
  font-weight: 700;
  line-height: 24px;
}

.stage-name-rotator span {
  position: absolute;
  inset: 0;
  opacity: 0;
  transform: translateY(12px);
  animation: stageNameCycle 12.5s ease-in-out infinite;
}

.stage-name-rotator span:nth-child(2) {
  animation-delay: 2.5s;
}
.stage-name-rotator span:nth-child(3) {
  animation-delay: 5s;
}
.stage-name-rotator span:nth-child(4) {
  animation-delay: 7.5s;
}
.stage-name-rotator span:nth-child(5) {
  animation-delay: 10s;
}

.upload-progress-footnote {
  font-size: 12px;
  max-width: 420px;
  line-height: 1.5;
}

.upload-progress-bar {
  width: min(100%, 420px);
  height: 12px;
  background: rgba(255, 255, 255, 0.26);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.08);
}

.upload-progress-bar > span {
  transition: width 0.24s ease;
}

.upload-footer {
  align-items: center;
  gap: 16px;
}

.upload-footer-copy {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.upload-footer-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-left: auto;
}

.upload-inline-progress {
  display: grid;
  justify-items: end;
  gap: 2px;
  text-align: right;
  min-width: 140px;
}

.upload-error-badge {
  width: fit-content;
  max-width: 100%;
}

.upload-store-badge {
  width: fit-content;
}

/* ---- Fila de processamento (dentro do card esquerdo) ---- */
.upload-fila-interna {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.06);
}

.upload-fila-header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.upload-fila-scroll {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  max-height: 260px;
  scrollbar-width: thin;
  scrollbar-color: rgba(124, 92, 255, 0.3) transparent;
}

.upload-fila-scroll::-webkit-scrollbar {
  width: 4px;
}
.upload-fila-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.upload-fila-scroll::-webkit-scrollbar-thumb {
  background: rgba(124, 92, 255, 0.3);
  border-radius: 2px;
}

.upload-fila-list {
  display: grid;
}

.upload-fila-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  transition: background 0.2s;
}

.upload-fila-item:last-child {
  border-bottom: none;
}

.upload-fila-item.processing {
  background: rgba(124, 92, 255, 0.08);
}

.upload-fila-item.done {
  opacity: 0.6;
}

.upload-fila-item.error {
  background: rgba(239, 68, 68, 0.06);
}

.fila-item-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 8px;
  font-size: 12px;
}

.upload-fila-item.processing .fila-item-icon {
  color: var(--accent, #7c5cff);
}
.upload-fila-item.done .fila-item-icon {
  color: var(--success, #22c55e);
}
.upload-fila-item.error .fila-item-icon {
  color: var(--danger, #ef4444);
}
.upload-fila-item.waiting .fila-item-icon {
  color: var(--text-dim);
}

.fila-waiting-pulse {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-dim);
  animation: filaWaitPulse 1.4s ease-in-out infinite;
}

@keyframes filaWaitPulse {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

.fila-item-info {
  flex: 1;
  min-width: 0;
}

.fila-item-nome {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fila-item-meta {
  font-size: 12px;
  margin-top: 2px;
}

.fila-item-erro {
  color: var(--danger, #ef4444);
}

.fila-item-remove {
  flex-shrink: 0;
  padding: 4px 8px;
  font-size: 12px;
  opacity: 0.6;
}
.fila-item-remove:hover {
  opacity: 1;
}

/* Transitions fila */
.fila-fade-enter-active,
.fila-fade-leave-active {
  transition:
    opacity 0.25s,
    transform 0.25s;
}
.fila-fade-enter-from,
.fila-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.fila-item-enter-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.fila-item-leave-active {
  transition: opacity 0.15s;
}
.fila-item-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}
.fila-item-leave-to {
  opacity: 0;
}

@keyframes cardSheen {
  0% {
    opacity: 0;
    transform: translateX(-55%);
  }
  18%,
  52% {
    opacity: 0.9;
  }
  100% {
    opacity: 0;
    transform: translateX(64%);
  }
}

@keyframes iconBuoy {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

@keyframes dropzoneSweep {
  0% {
    transform: translateX(-65%);
  }
  100% {
    transform: translateX(70%);
  }
}

@keyframes meterGleam {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.44;
  }
  50% {
    transform: translateY(-7px);
    opacity: 0.72;
  }
}

@keyframes meterRipple {
  0% {
    transform: scale(0.92);
    opacity: 0.68;
  }
  100% {
    transform: scale(1.13);
    opacity: 0;
  }
}

@keyframes stagePulse {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.42);
    transform: scale(0.92);
  }
  70% {
    box-shadow: 0 0 0 9px rgba(34, 211, 238, 0);
    transform: scale(1);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(34, 211, 238, 0);
    transform: scale(0.92);
  }
}

@keyframes stageNameCycle {
  0% {
    opacity: 0;
    transform: translateY(13px);
  }
  7%,
  18% {
    opacity: 1;
    transform: translateY(0);
  }
  25%,
  100% {
    opacity: 0;
    transform: translateY(-13px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .upload-liquid,
  .upload-shell.uploading .upload-status-card::before,
  .upload-shell.uploading .upload-status-icon,
  .upload-shell.uploading .upload-dropzone::before,
  .upload-progress-meter::after,
  .upload-progress-ripple,
  .stage-live-dot,
  .stage-name-rotator span {
    animation: none !important;
  }

  .stage-name-rotator span:first-child {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 980px) {
  .upload-layout {
    grid-template-columns: 1fr;
  }

  .upload-type-field {
    min-width: min(100%, 280px);
    width: 100%;
  }

  .upload-topbar-actions {
    width: 100%;
    margin-left: 0;
  }

  .upload-footer-actions {
    width: 100%;
    justify-content: space-between;
    margin-left: 0;
  }
}

@media (max-width: 720px) {
  .upload-dropzone {
    min-height: 220px;
    padding: 24px 18px;
  }

  .upload-progress-meter {
    width: 134px;
    height: 134px;
  }

  .upload-progress-value {
    font-size: 42px;
  }

  .upload-stage-display {
    min-height: 86px;
    border-radius: 14px;
  }

  .stage-live-label {
    align-items: flex-start;
    text-align: left;
  }

  .upload-footer-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .upload-inline-progress {
    justify-items: start;
    text-align: left;
  }

  .upload-topbar {
    align-items: stretch;
  }
}
</style>
