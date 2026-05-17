<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import api from '@/services/api';
import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import Loader from '@/components/Loader.vue';
import { RouterLink } from 'vue-router';

const ui     = useUiStore();
const auth   = useAuthStore();
const router = useRouter();
const fileInput = ref(null);
const LOJA_DESTINO_STORAGE_KEY = 'na_auditorias_superadmin_loja';

// Detecta tipo sugerido pelo dia da semana: 1=Seg,4=Qui→ETIQUETA, 2=Ter→PRESENCA, 3=Qua→RUPTURA
function tipoSugeridoHoje() {
  const d = new Date().getDay(); // 0=Dom
  if (d === 1 || d === 4) return 'ETIQUETA';
  if (d === 2) return 'PRESENCA';
  if (d === 3) return 'RUPTURA';
  return '';
}

function formatBytes(bytes = 0) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: value >= 10 ? 0 : 1 })} ${units[exponent]}`;
}

const enviando     = ref(false);
const dragOver     = ref(false);
const arquivo      = ref(null);   // arquivo atualmente em processamento
const fila         = ref([]);     // [{id, file, status, erro, resultado}]
const tipoForcado  = ref(tipoSugeridoHoje());
const ultimoResultado = ref(null);
const progressoUpload = ref(0);
const etapaUpload = ref('idle');
const detalheProcessamento = ref('');
const erroUpload = ref('');

let filaProcessando = false;
let idCounter = 0;

let componenteAtivo = true;
let simulacaoProcessamento = null;

const auditorias  = ref([]);
const carregando  = ref(true);
const filtroTipo  = ref('');
const lojasDisponiveis = ref([]);
const lojaDestinoId = ref('');
const carregandoLojas = ref(false);
const erroLojas = ref('');
const ultimaLojaProcessada = ref(null);

const lojaDestino = computed(() => lojasDisponiveis.value.find((loja) => loja._id === lojaDestinoId.value) || null);
const uploadBloqueadoSemLoja = computed(() => auth.isSuperAdmin && !lojaDestinoId.value);
const podeSelecionarArquivo = computed(() => !uploadBloqueadoSemLoja.value && !carregandoLojas.value);

function paramsEscopoLoja(extra = {}) {
  if (auth.isSuperAdmin && lojaDestinoId.value) return { ...extra, lojaId: lojaDestinoId.value };
  return { ...extra };
}

function rotaAuditoria(auditoriaId) {
  if (auth.isSuperAdmin && lojaDestinoId.value) {
    return { path: `/auditorias/${auditoriaId}`, query: { lojaId: lojaDestinoId.value } };
  }
  return { path: `/auditorias/${auditoriaId}` };
}

async function carregarLojasDestino() {
  if (!auth.isSuperAdmin) return;

  carregandoLojas.value = true;
  erroLojas.value = '';
  try {
    const { data } = await api.get('/lojas');
    lojasDisponiveis.value = (data.items || []).filter((loja) => loja.ativa !== false);

    const lojaSalva = localStorage.getItem(LOJA_DESTINO_STORAGE_KEY);
    const lojaInicial = lojasDisponiveis.value.find((loja) => loja._id === lojaSalva) || null;
    lojaDestinoId.value = lojaInicial?._id || '';

    if (lojaDestinoId.value) localStorage.setItem(LOJA_DESTINO_STORAGE_KEY, lojaDestinoId.value);
    else localStorage.removeItem(LOJA_DESTINO_STORAGE_KEY);
  } catch (error) {
    erroLojas.value = error?.response?.data?.error || 'Não foi possível carregar as lojas.';
    lojasDisponiveis.value = [];
    lojaDestinoId.value = '';
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
    const { data } = await api.get('/auditorias', { params: paramsEscopoLoja(params) });
    auditorias.value = data.items;
  } finally { carregando.value = false; }
}

async function trocarLojaDestino() {
  if (!auth.isSuperAdmin) return;

  if (lojaDestinoId.value) localStorage.setItem(LOJA_DESTINO_STORAGE_KEY, lojaDestinoId.value);
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
  if (fileInput.value) fileInput.value.value = '';
}

function resetarEstadoUpload() {
  progressoUpload.value = 0;
  etapaUpload.value = arquivo.value ? 'ready' : 'idle';
  detalheProcessamento.value = '';
  erroUpload.value = '';
}

function adicionarFilaArquivos(files) {
  if (!files || !files.length) return;
  for (const file of Array.from(files)) {
    fila.value.push({ id: ++idCounter, file, status: 'waiting', erro: '', resultado: null });
  }
  if (fileInput.value) fileInput.value.value = '';
  iniciarFila();
}

function removerDaFila(id) {
  const idx = fila.value.findIndex((item) => item.id === id);
  if (idx !== -1 && fila.value[idx].status !== 'processing') {
    fila.value.splice(idx, 1);
  }
}

async function iniciarFila() {
  if (filaProcessando) return;
  filaProcessando = true;
  while (componenteAtivo) {
    const proximo = fila.value.find((item) => item.status === 'waiting');
    if (!proximo) break;
    await processarItem(proximo);
  }
  filaProcessando = false;
  // Se fila vazia e tudo processado, volta para idle
  const algumAtivo = fila.value.some((item) => item.status === 'waiting' || item.status === 'processing');
  if (!algumAtivo) {
    etapaUpload.value = fila.value.length ? (fila.value.every((i) => i.status === 'done') ? 'success' : 'idle') : 'idle';
    arquivo.value = null;
  }
}

async function processarItem(item) {
  if (!componenteAtivo) return;
  item.status = 'processing';
  arquivo.value = item.file;

  // reinicia animacao do zero
  progressoUpload.value = 0;
  etapaUpload.value = 'upload';
  detalheProcessamento.value = 'Enviando arquivo';
  erroUpload.value = '';
  ultimoResultado.value = null;
  enviando.value = true;

  ultimaLojaProcessada.value = lojaDestino.value
    ? { nome: lojaDestino.value.nome, cidade: lojaDestino.value.cidade, estado: lojaDestino.value.estado }
    : auth.loja
      ? { nome: auth.loja.nome, cidade: auth.loja.cidade, estado: auth.loja.estado }
      : null;

  const fd = new FormData();
  fd.append('arquivo', item.file);
  if (tipoForcado.value) fd.append('tipo', tipoForcado.value);

  try {
    const { data } = await api.post('/auditorias/upload', fd, {
      params: paramsEscopoLoja(),
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress(event) {
        if (!event.total) {
          progressoUpload.value = Math.max(progressoUpload.value, 18);
          return;
        }
        const percentual = event.loaded / event.total;
        progressoUpload.value = Math.max(progressoUpload.value, Math.min(34, percentual * 34));
        detalheProcessamento.value = percentual >= 0.98
          ? 'Arquivo recebido. Iniciando processamento…'
          : 'Enviando arquivo';
      },
    });
    enviando.value = false;
    await acompanharProcessamentoItem(item, data.jobId);
  } catch (e) {
    pararSimulacaoProcessamento();
    etapaUpload.value = 'error';
    progressoUpload.value = 0;
    const msg = e?.response?.data?.error || e?.message || 'Falha no upload';
    erroUpload.value = msg;
    detalheProcessamento.value = msg;
    item.status = 'error';
    item.erro = msg;
    ui.erro(`${item.file.name}: ${msg}`);
  } finally {
    enviando.value = false;
  }
}

async function acompanharProcessamentoItem(item, jobId) {
  etapaUpload.value = 'processing';
  iniciarSimulacaoProcessamento();
  while (componenteAtivo) {
    const { data } = await api.get(`/auditorias/upload/${jobId}/status`);
    detalheProcessamento.value = data.stage || 'Processando auditoria';
    const progressoMapeado = 34 + (Number(data.progress || 0) * 0.66);
    progressoUpload.value = Math.max(progressoUpload.value, progressoMapeado);
    if (data.status === 'done') {
      pararSimulacaoProcessamento();
      progressoUpload.value = 100;
      etapaUpload.value = 'success';
      detalheProcessamento.value = 'Processamento concluído';
      item.status = 'done';
      item.resultado = data.result;
      ultimoResultado.value = data.result;
      ui.sucesso(`${item.file.name}: ${data.result.tipo} — ${data.result.totalLidos} itens lidos`);
      await listar();
      return;
    }
    if (data.status === 'error') {
      throw new Error(data.error || 'Falha no processamento da planilha');
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
}

function iniciarSimulacaoProcessamento() {
  pararSimulacaoProcessamento();
  simulacaoProcessamento = setInterval(() => {
    if (etapaUpload.value !== 'processing') return;
    progressoUpload.value = Math.min(96, progressoUpload.value + Math.max(0.35, (96 - progressoUpload.value) * 0.045));
  }, 180);
}

function pararSimulacaoProcessamento() {
  if (!simulacaoProcessamento) return;
  clearInterval(simulacaoProcessamento);
  simulacaoProcessamento = null;
}

function pickFile(e) { adicionarFilaArquivos(e.target.files); }
function onDrop(e)   { dragOver.value = false; adicionarFilaArquivos(e.dataTransfer.files); }

function irParaDashboard() {
  router.push({ path: '/dashboard', query: paramsEscopoLoja({ refresh: Date.now() }) });
}

async function excluir(a) {
  if (!confirm(`Excluir auditoria de ${a.tipo} de ${new Date(a.data).toLocaleDateString('pt-BR')}?`)) return;
  await api.delete('/auditorias/' + a._id, { params: paramsEscopoLoja() });
  ui.sucesso('Auditoria removida');
  listar();
}

const nomeDiaSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][new Date().getDay()];
const tipoLabels = { ETIQUETA: 'Etiqueta', PRESENCA: 'Presença', RUPTURA: 'Ruptura' };

const uploadEmAndamento = computed(() => etapaUpload.value === 'upload' || etapaUpload.value === 'processing');
const uploadComPreenchimento = computed(() => uploadEmAndamento.value || etapaUpload.value === 'success');
const progressoExibido = computed(() => Math.round(Math.max(0, Math.min(100, progressoUpload.value))));
const arquivoResumo = computed(() => {
  if (!arquivo.value) return null;
  return {
    nome: arquivo.value.name,
    tamanho: formatBytes(arquivo.value.size),
  };
});
const tipoAtualLabel = computed(() => tipoForcado.value ? tipoLabels[tipoForcado.value] : 'Automático');
const lojaDestinoLabel = computed(() => lojaDestino.value?.nome || 'Selecione uma loja');
const lojaDestinoResumo = computed(() => [lojaDestino.value?.cidade, lojaDestino.value?.estado].filter(Boolean).join(' / '));
const filaVisivelOrdenada = computed(() => fila.value.filter((i) => i.status !== 'done' || fila.value.length <= 5));
const temFilaEspera = computed(() => fila.value.some((i) => i.status === 'waiting'));
const statusUploadTitulo = computed(() => {
  if (uploadBloqueadoSemLoja.value) return 'Escolha a loja de destino';
  if (etapaUpload.value === 'upload') return 'Enviando a planilha';
  if (etapaUpload.value === 'processing') return 'Processando auditoria';
  if (etapaUpload.value === 'success') return 'Upload concluído';
  if (etapaUpload.value === 'error') return 'Falha no envio';
  if (arquivo.value) return 'Arquivo pronto';
  return 'Aguardando planilha';
});
const statusUploadTexto = computed(() => {
  if (auth.isSuperAdmin && erroLojas.value) return erroLojas.value;
  if (uploadBloqueadoSemLoja.value) return 'Selecione a loja em que esta auditoria deve ser processada. O histórico abaixo também seguirá a loja escolhida.';
  if (etapaUpload.value === 'upload') return 'Transferindo o arquivo para o servidor.';
  if (etapaUpload.value === 'processing') return detalheProcessamento.value || 'Classificando itens e atualizando métricas.';
  if (etapaUpload.value === 'success') return 'Sua auditoria foi processada e o histórico já foi atualizado.';
  if (etapaUpload.value === 'error') return erroUpload.value || 'Não foi possível concluir o upload.';
  if (arquivo.value) return 'Confira o tipo, revise o arquivo e inicie o processamento.';
  return 'Selecione uma planilha exportada do coletor para iniciar.';
});
const badgeStatusUpload = computed(() => {
  if (uploadBloqueadoSemLoja.value) return { text: 'Loja obrigatória', klass: 'warn' };
  if (etapaUpload.value === 'success') return { text: 'Concluído', klass: 'ok' };
  if (etapaUpload.value === 'error') return { text: 'Erro', klass: 'bad' };
  if (uploadEmAndamento.value) return { text: `${progressoExibido.value}%`, klass: 'info' };
  if (arquivo.value) return { text: 'Pronto', klass: 'warn' };
  return { text: 'Aguardando', klass: 'dim' };
});

onBeforeUnmount(() => {
  componenteAtivo = false;
  pararSimulacaoProcessamento();
});
</script>

<template>
  <div class="grid gap-3">
    <div v-if="auth.podeGerenciar" class="upload-shell card glow" :class="{ uploading: uploadEmAndamento, ready: !!arquivo, success: etapaUpload === 'success', error: etapaUpload === 'error' }">
      <div v-if="uploadComPreenchimento" class="upload-liquid" :style="{ height: progressoExibido + '%' }" aria-hidden="true">
        <div class="upload-wave wave-a"></div>
        <div class="upload-wave wave-b"></div>
        <div class="upload-wave wave-c"></div>
      </div>

      <div class="upload-shell-inner">
        <div class="upload-topbar row">
          <div>
            <h3 class="mt-0 mb-0"><fa icon="cloud-arrow-up" /> Enviar planilha de auditoria</h3>
            <div v-if="tipoForcado" class="row mt-1" style="font-size: 13px; gap: 8px;">
              <span class="badge" :class="'tipo-' + tipoForcado"><fa icon="calendar" /> {{ nomeDiaSemana }} → {{ tipoLabels[tipoForcado] }} sugerido</span>
              <span class="muted">Você pode alterar o tipo acima</span>
            </div>
            <div v-else class="muted mt-1" style="font-size: 13px;">Defina manualmente ou deixe a detecção automática agir.</div>
          </div>

          <div class="upload-topbar-actions">
            <div v-if="auth.isSuperAdmin" class="field upload-type-field">
              <label>Loja de destino</label>
              <select v-model="lojaDestinoId" class="upload-type-select" :disabled="uploadEmAndamento || carregandoLojas" @change="trocarLojaDestino">
                <option value="">{{ carregandoLojas ? 'Carregando lojas…' : 'Escolha uma loja' }}</option>
                <option v-for="loja in lojasDisponiveis" :key="loja._id" :value="loja._id">{{ loja.nome }}</option>
              </select>
            </div>

            <div class="field upload-type-field">
              <label>Tipo da auditoria</label>
              <select v-model="tipoForcado" class="upload-type-select" :disabled="uploadEmAndamento">
                <option value="">Detectar automaticamente</option>
                <option value="ETIQUETA">Etiqueta</option>
                <option value="PRESENCA">Presença</option>
                <option value="RUPTURA">Ruptura</option>
              </select>
            </div>
          </div>
        </div>

        <div class="upload-layout">
          <div class="upload-status-card" :class="{ 'has-fila': fila.length > 0 }">
            <div class="upload-status-icon">
              <fa :icon="uploadEmAndamento ? 'spinner' : etapaUpload === 'success' ? 'check' : etapaUpload === 'error' ? 'triangle-exclamation' : 'cloud-arrow-up'" :spin="uploadEmAndamento" />
            </div>

            <div class="upload-status-copy">
              <span class="badge" :class="badgeStatusUpload.klass">{{ badgeStatusUpload.text }}</span>
              <h4>{{ statusUploadTitulo }}</h4>
              <p>{{ statusUploadTexto }}</p>
            </div>

            <div v-if="!fila.length" class="upload-status-meta">
              <div v-if="auth.isSuperAdmin" class="upload-meta-row">
                <span class="muted">Loja</span>
                <strong>{{ lojaDestinoLabel }}</strong>
              </div>
              <div v-if="auth.isSuperAdmin && lojaDestinoResumo" class="upload-meta-row">
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
                  <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; opacity: .6;">Fila</span>
                  <span class="badge dim" style="font-size: 11px;">{{ fila.filter(i => i.status !== 'done').length }} pendente(s)</span>
                  <span class="spacer" />
                  <button
                    v-if="!uploadEmAndamento && fila.some(i => i.status === 'done')"
                    class="btn ghost"
                    style="font-size: 11px; padding: 2px 8px;"
                    @click="fila.splice(0, fila.length, ...fila.filter(i => i.status !== 'done'))"
                  ><fa icon="broom" /></button>
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
                        <fa v-if="item.status === 'processing'" icon="spinner" spin />
                        <span v-else-if="item.status === 'waiting'" class="fila-waiting-pulse" />
                        <fa v-else-if="item.status === 'done'" icon="check" />
                        <fa v-else icon="triangle-exclamation" />
                      </div>
                      <div class="fila-item-info">
                        <div class="fila-item-nome">{{ item.file.name }}</div>
                        <div class="fila-item-meta muted">
                          <span>{{ formatBytes(item.file.size) }}</span>
                          <span v-if="item.status === 'processing'"> · Processando…</span>
                          <span v-else-if="item.status === 'waiting'"> · Na fila</span>
                          <span v-else-if="item.status === 'done'"> · Concluído</span>
                          <span v-else-if="item.status === 'error'" class="fila-item-erro"> · {{ item.erro }}</span>
                        </div>
                      </div>
                      <button
                        v-if="item.status === 'waiting'"
                        class="btn ghost fila-item-remove"
                        title="Remover da fila"
                        @click.prevent="removerDaFila(item.id)"
                      ><fa icon="xmark" /></button>
                    </div>
                  </TransitionGroup>
                </div>
              </div>
            </Transition>
          </div>

          <label
            class="dropzone upload-dropzone"
            :class="{ over: dragOver, active: fila.length > 0, disabled: !podeSelecionarArquivo }"
            @dragover.prevent="podeSelecionarArquivo && (dragOver = true)"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="podeSelecionarArquivo && onDrop($event)"
          >
            <input ref="fileInput" type="file" multiple accept=".xlsx,.xls,.xlsb,.xlsm,.csv,.ods" @change="pickFile" hidden :disabled="!podeSelecionarArquivo" />

            <template v-if="uploadEmAndamento">
              <div class="upload-progress-stage">
                <div class="upload-progress-value">{{ progressoExibido }}%</div>
                <div class="upload-progress-label">{{ detalheProcessamento || 'Processando auditoria…' }}</div>
                <div class="progress upload-progress-bar">
                  <span :style="{ width: progressoExibido + '%' }" />
                </div>
                <div class="muted upload-progress-footnote">A barra combina envio real do arquivo com o avanço do processamento da auditoria.</div>
              </div>
            </template>

            <template v-else-if="auth.isSuperAdmin && !lojaDestinoId">
              <div class="upload-drop-content">
                <div class="upload-drop-icon"><fa icon="store" /></div>
                <strong>Escolha a loja de destino para habilitar o envio</strong>
                <div class="muted">A planilha será processada exatamente para a loja selecionada acima.</div>
              </div>
            </template>

            <template v-else-if="temFilaEspera">
              <div class="upload-drop-content">
                <div class="upload-drop-icon"><fa icon="layer-group" /></div>
                <strong>{{ fila.filter(i => i.status === 'waiting').length }} arquivo(s) aguardando na fila</strong>
                <div class="muted">Clique ou arraste para adicionar mais planilhas</div>
              </div>
            </template>

            <template v-else>
              <div class="upload-drop-content">
                <div class="upload-drop-icon"><fa icon="cloud-arrow-up" /></div>
                <strong>Arraste planilhas aqui ou clique para selecionar</strong>
                <div class="muted">Selecione vários arquivos de uma vez — Excel / CSV até 100 MB cada</div>
              </div>
            </template>
          </label>
        </div>

        <div class="upload-footer row">
          <div class="upload-footer-copy">
            <span class="muted" style="font-size: 12px;">
              Detecção automática usa o nome do arquivo e a aba. Override manual tem prioridade.
            </span>
            <span v-if="auth.isSuperAdmin && lojaDestinoId" class="badge dim upload-store-badge">
              <fa icon="store" /> {{ lojaDestinoLabel }}
            </span>
            <span v-if="erroUpload" class="badge bad upload-error-badge">{{ erroUpload }}</span>
          </div>

          <div class="upload-footer-actions">
            <div v-if="uploadComPreenchimento" class="upload-inline-progress">
              <span class="muted">{{ uploadEmAndamento ? (detalheProcessamento || 'Processando') : 'Último processamento' }}</span>
              <strong>{{ progressoExibido }}%</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- Resultado do upload -->
      <Transition name="fade">
        <div v-if="ultimoResultado" class="card mt-3" style="background: rgba(34,197,94,.06); border-color: rgba(34,197,94,.3);">
          <div class="row">
            <fa icon="check" style="color: var(--success); font-size: 18px;" />
            <strong>{{ ultimoResultado.tipo }}</strong>
            <span class="muted">·</span>
            <span>{{ new Date(ultimoResultado.dataAuditoria).toLocaleDateString('pt-BR') }}</span>
            <span v-if="ultimaLojaProcessada?.nome" class="muted">·</span>
            <span v-if="ultimaLojaProcessada?.nome" class="badge dim"><fa icon="store" /> {{ ultimaLojaProcessada.nome }}</span>
            <span class="spacer" />
            <span class="badge ok">{{ ultimoResultado.taxaConformidade?.toFixed(1) }}% conformidade</span>
          </div>
          <div class="row mt-2 gap-3" style="font-size: 13px;">
            <span><span class="muted">Itens:</span> <strong>{{ ultimoResultado.totalItens }}</strong></span>
            <span><span class="muted">Lidos:</span> <strong>{{ ultimoResultado.totalLidos }}</strong></span>
            <span><span class="muted">Conformes:</span> <strong>{{ ultimoResultado.totalConformes }}</strong></span>
            <span><span class="muted">Pts:</span> <strong>{{ Math.round(ultimoResultado.pontuacao || 0) }}</strong></span>
            <span class="spacer" />
            <button class="btn ghost" style="font-size: 13px;" @click="irParaDashboard">
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
        <span v-if="auth.isSuperAdmin && lojaDestinoId" class="badge dim"><fa icon="store" /> {{ lojaDestinoLabel }}</span>
        <span class="spacer" />
        <select v-model="filtroTipo" @change="listar" class="btn ghost" style="padding: 8px 14px;">
          <option value="">Todos os tipos</option>
          <option value="ETIQUETA">Etiqueta</option>
          <option value="PRESENCA">Presença</option>
          <option value="RUPTURA">Ruptura</option>
        </select>
      </div>

      <Loader v-if="carregando" />
      <div v-else-if="auth.isSuperAdmin && !lojaDestinoId" class="empty">Escolha uma loja acima para ver o histórico e enviar planilhas para ela.</div>
      <div v-else-if="!auditorias.length" class="empty">Nenhuma auditoria encontrada.</div>
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Tipo</th><th>Data</th><th>Itens lidos</th><th>Conformidade</th><th>Pontuação</th><th>Custo Ruptura</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="a in auditorias" :key="a._id">
              <td><span class="badge" :class="'tipo-' + a.tipo">{{ a.tipo }}</span></td>
              <td>{{ new Date(a.data).toLocaleDateString('pt-BR') }}</td>
              <td>{{ a.totalLidos?.toLocaleString('pt-BR') }} / {{ a.totalItens?.toLocaleString('pt-BR') }}</td>
              <td>
                <div class="row gap-2">
                  {{ a.taxaConformidade?.toFixed(1) }}%
                  <div class="progress" style="flex:1; min-width:60px;">
                    <span :style="{ width: Math.min(100, a.taxaConformidade || 0) + '%' }" />
                  </div>
                </div>
              </td>
              <td>{{ Math.round(a.pontuacao || 0) }}</td>
              <td>
                <span v-if="a.custoRupturaTotal > 0" class="badge bad">
                  R$ {{ a.custoRupturaTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) }}
                </span>
                <span v-else class="muted">—</span>
              </td>
              <td class="text-right">
                <RouterLink :to="rotaAuditoria(a._id)" class="btn ghost"><fa icon="eye" /></RouterLink>
                <button v-if="auth.podeGerenciar" class="btn ghost danger" @click="excluir(a)" title="Excluir">
                  <fa icon="trash" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.upload-shell {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  background:
    linear-gradient(135deg, rgba(124,92,255,.10), rgba(34,211,238,.08)),
    var(--surface);
}

.upload-shell::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255,255,255,.04), transparent 28%);
  pointer-events: none;
  z-index: 0;
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
  background: linear-gradient(180deg, rgba(124,92,255,.10) 0%, rgba(124,92,255,.16) 20%, rgba(34,211,238,.22) 100%);
  transition: height .38s ease;
  pointer-events: none;
  z-index: 1;
}

.upload-liquid::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255,255,255,.14), transparent 20%, transparent 100%);
  opacity: .45;
}

.upload-wave {
  position: absolute;
  left: -8%;
  width: 116%;
  height: 54px;
  top: -24px;
  border-radius: 43% 57% 58% 42% / 54% 46% 54% 46%;
  background: rgba(255,255,255,.20);
  filter: blur(1px);
}

.wave-a {
  animation: waterDrift 11s linear infinite;
  opacity: .58;
}

.wave-b {
  top: -16px;
  animation: waterDriftReverse 15s linear infinite;
  background: rgba(255,255,255,.12);
  opacity: .68;
}

.wave-c {
  top: -10px;
  animation: waterDrift 19s linear infinite;
  background: rgba(255,255,255,.10);
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
  background: rgba(255,255,255,.74);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 16px;
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.35);
}

.upload-layout {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: 18px;
  align-items: stretch;
}

.upload-status-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: rgba(255,255,255,.12);
  backdrop-filter: blur(6px);
  min-height: 100%;
  overflow: hidden;
}

.upload-status-card.has-fila {
  min-height: 320px;
}

.upload-status-icon {
  width: 62px;
  height: 62px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, rgba(124,92,255,.24), rgba(34,211,238,.24));
  color: var(--text);
  font-size: 24px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.2);
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
  background: rgba(255,255,255,.08);
  border-width: 2px;
  position: relative;
}

.upload-dropzone.active {
  border-color: rgba(124,92,255,.36);
  background: rgba(255,255,255,.10);
}

.upload-dropzone.disabled {
  cursor: progress;
}

.upload-drop-content,
.upload-progress-stage {
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
  background: rgba(255,255,255,.78);
  color: var(--text-dim);
  font-size: 28px;
  box-shadow: 0 10px 24px rgba(70,82,126,.14);
}

.upload-progress-value {
  font-size: clamp(40px, 7vw, 74px);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -1.6px;
}

.upload-progress-label {
  font-size: 17px;
  font-weight: 700;
}

.upload-progress-footnote {
  font-size: 12px;
  max-width: 420px;
  line-height: 1.5;
}

.upload-progress-bar {
  width: min(100%, 420px);
  height: 12px;
  background: rgba(255,255,255,.26);
  box-shadow: inset 0 1px 2px rgba(0,0,0,.08);
}

.upload-progress-bar > span {
  transition: width .24s ease;
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
  background: rgba(0,0,0,.06);
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
  scrollbar-color: rgba(124,92,255,.3) transparent;
}

.upload-fila-scroll::-webkit-scrollbar { width: 4px; }
.upload-fila-scroll::-webkit-scrollbar-track { background: transparent; }
.upload-fila-scroll::-webkit-scrollbar-thumb { background: rgba(124,92,255,.3); border-radius: 2px; }

.upload-fila-list {
  display: grid;
}

.upload-fila-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-bottom: 1px solid rgba(255,255,255,.06);
  transition: background .2s;
}

.upload-fila-item:last-child {
  border-bottom: none;
}

.upload-fila-item.processing {
  background: rgba(124,92,255,.08);
}

.upload-fila-item.done {
  opacity: .6;
}

.upload-fila-item.error {
  background: rgba(239,68,68,.06);
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

.upload-fila-item.processing .fila-item-icon { color: var(--accent, #7c5cff); }
.upload-fila-item.done       .fila-item-icon { color: var(--success, #22c55e); }
.upload-fila-item.error      .fila-item-icon { color: var(--danger, #ef4444); }
.upload-fila-item.waiting    .fila-item-icon { color: var(--text-dim); }

.fila-waiting-pulse {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-dim);
  animation: filaWaitPulse 1.4s ease-in-out infinite;
}

@keyframes filaWaitPulse {
  0%, 100% { opacity: .35; transform: scale(.8); }
  50%       { opacity: 1;   transform: scale(1.1); }
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
  opacity: .6;
}
.fila-item-remove:hover { opacity: 1; }

/* Transitions fila */
.fila-fade-enter-active,
.fila-fade-leave-active { transition: opacity .25s, transform .25s; }
.fila-fade-enter-from,
.fila-fade-leave-to    { opacity: 0; transform: translateY(-6px); }

.fila-item-enter-active { transition: opacity .2s, transform .2s; }
.fila-item-leave-active { transition: opacity .15s; }
.fila-item-enter-from   { opacity: 0; transform: translateX(-10px); }
.fila-item-leave-to     { opacity: 0; }

@keyframes waterDrift {
  0% { transform: translateX(-4%) rotate(0deg); }
  100% { transform: translateX(4%) rotate(360deg); }
}

@keyframes waterDriftReverse {
  0% { transform: translateX(4%) rotate(0deg); }
  100% { transform: translateX(-4%) rotate(-360deg); }
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
