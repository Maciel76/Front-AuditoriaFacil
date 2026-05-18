<script setup>
import Cropper from 'cropperjs';
import { ref, computed, onMounted, watch, nextTick, onBeforeUnmount } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import ColaboradorAvatar from '@/components/ColaboradorAvatar.vue';
import Loader from '@/components/Loader.vue';
import AppChart from '@/components/AppChart.vue';
import PeriodoSelector from '@/components/PeriodoSelector.vue';

const auth = useAuthStore();
const ui = useUiStore();
const route = useRoute();
const periodo = ref('1d');
const dataInicio = ref('');
const dataFim = ref('');
const carregando = ref(true);
const salvandoPerfil = ref(false);
const enviandoAvatar = ref(false);
const dados = ref(null);
const formulario = ref({ nome: '', codigoExterno: '', cargo: '', setor: '' });
const avatarInput = ref(null);
const cropperImage = ref('');
const cropperAberto = ref(false);
const cropperImageRef = ref(null);
const cropperStageRef = ref(null);
const cropperNomeArquivo = ref('');

let cropper;

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const CROP_TEMPLATE = `
  <cropper-canvas background>
    <cropper-image scalable translatable></cropper-image>
    <cropper-shade hidden></cropper-shade>
    <cropper-handle action="select" plain></cropper-handle>
    <cropper-selection
      initial-coverage="0.74"
      initial-aspect-ratio="1"
      aspect-ratio="1"
      movable
      resizable
      precise
      outlined
    >
      <cropper-grid role="grid" covered></cropper-grid>
      <cropper-crosshair centered></cropper-crosshair>
      <cropper-handle
        action="move"
        theme-color="rgba(255, 255, 255, 0.28)"
      ></cropper-handle>
      <cropper-handle action="ne-resize"></cropper-handle>
      <cropper-handle action="nw-resize"></cropper-handle>
      <cropper-handle action="se-resize"></cropper-handle>
      <cropper-handle action="sw-resize"></cropper-handle>
    </cropper-selection>
  </cropper-canvas>
`;

const escopoLojaParams = computed(() =>
  route.query.lojaId ? { lojaId: route.query.lojaId } : {},
);

const rotaVoltar = computed(() =>
  route.query.lojaId
    ? { path: '/colaboradores', query: { lojaId: route.query.lojaId } }
    : { path: '/colaboradores' },
);

const lojaIdEdicao = computed(() => {
  if (route.query.lojaId) return String(route.query.lojaId);
  const loja = dados.value?.colaborador?.loja;
  if (!loja) return '';
  if (typeof loja === 'string') return loja;
  return loja._id ? String(loja._id) : String(loja);
});

const paramsEscopoEdicao = computed(() => {
  if (auth.isSuperAdmin && lojaIdEdicao.value) {
    return { lojaId: lojaIdEdicao.value };
  }
  return {};
});

const podeEditar = computed(() => auth.podeGerenciar && !!dados.value?.colaborador?._id);

function preencherFormulario(colaborador) {
  formulario.value = {
    nome: colaborador?.nome || '',
    codigoExterno: colaborador?.codigoExterno || '',
    cargo: colaborador?.cargo || '',
    setor: colaborador?.setor || '',
  };
}

async function carregar() {
  carregando.value = true;
  try {
    const params = { ...escopoLojaParams.value, periodo: periodo.value };
    if (periodo.value === 'custom' && dataInicio.value && dataFim.value) {
      params.dataInicio = dataInicio.value;
      params.dataFim = dataFim.value;
    }
    const { data } = await api.get(`/metricas/colaboradores/${route.params.id}/perfil`, { params });
    dados.value = data;
    preencherFormulario(data.colaborador);
  } finally { carregando.value = false; }
}

onMounted(carregar);
onBeforeUnmount(() => destruirCropper());

watch([periodo, dataInicio, dataFim], () => {
  if (periodo.value !== 'custom' || (dataInicio.value && dataFim.value)) carregar();
});

const corPorTipo = { ETIQUETA: '#7c5cff', PRESENCA: '#22d3ee', RUPTURA: '#f59e0b' };

const serieComoColunas = computed(() => (dados.value?.serie?.length || 0) <= 12);

const serieChart = computed(() => {
  if (!dados.value) return { labels: [], datasets: [] };
  const dias = [...new Set(dados.value.serie.map((x) => x._id.dia))].sort();
  const tipos = ['ETIQUETA', 'PRESENCA', 'RUPTURA'];
  return {
    labels: dias.map((d) => d.slice(5)),
    datasets: tipos.map((t) => {
      const mapa = new Map();
      dados.value.serie.filter((x) => x._id.tipo === t).forEach((x) => mapa.set(x._id.dia, x.totalLidos));

      if (serieComoColunas.value) {
        return {
          label: t,
          data: dias.map((d) => mapa.get(d) ?? 0),
          backgroundColor: corPorTipo[t],
          borderColor: corPorTipo[t],
          borderRadius: 12,
          borderSkipped: false,
          maxBarThickness: 36,
        };
      }

      return {
        label: t,
        data: dias.map((d) => mapa.get(d) ?? null),
        borderColor: corPorTipo[t],
        tension: 0.35,
        spanGaps: true,
        fill: true,
        pointRadius: 3,
        borderWidth: 2,
      };
    }),
  };
});

const serieChartOptions = computed(() => ({
  plugins: {
    tooltip: {
      callbacks: {
        label: (context) => `${context.dataset.label}: ${Number(context.raw ?? context.parsed?.y ?? 0).toLocaleString('pt-BR')} itens`,
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        precision: 0,
      },
    },
  },
}));

async function salvarPerfil() {
  if (!dados.value?.colaborador?._id) return;
  salvandoPerfil.value = true;
  try {
    const payload = {
      nome: formulario.value.nome.trim(),
      codigoExterno: formulario.value.codigoExterno.trim(),
      cargo: formulario.value.cargo.trim() || undefined,
      setor: formulario.value.setor.trim() || undefined,
    };

    const { data } = await api.put(`/colaboradores/${dados.value.colaborador._id}`, payload, {
      params: paramsEscopoEdicao.value,
    });

    dados.value.colaborador = { ...dados.value.colaborador, ...data };
    preencherFormulario(dados.value.colaborador);
    ui.sucesso('Colaborador atualizado');
  } catch (error) {
    ui.erro(error?.response?.data?.error || 'Falha ao atualizar colaborador');
  } finally {
    salvandoPerfil.value = false;
  }
}

function abrirAvatar() {
  if (!podeEditar.value) return;
  avatarInput.value?.click();
}

function destruirCropper() {
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
  if (cropperImage.value) {
    URL.revokeObjectURL(cropperImage.value);
    cropperImage.value = '';
  }
}

async function iniciarCropper() {
  await nextTick();
  if (!cropperImageRef.value) return;
  if (cropper) cropper.destroy();

  cropper = new Cropper(cropperImageRef.value, {
    container: cropperStageRef.value || undefined,
    template: CROP_TEMPLATE,
  });

  await nextTick();

  const selection = cropper.getCropperSelection();
  if (selection) {
    selection.aspectRatio = 1;
    selection.initialAspectRatio = 1;
    selection.initialCoverage = 0.74;
    selection.movable = true;
    selection.resizable = true;
    selection.precise = true;
    selection.$reset();
    selection.$center();
  }
}

function fecharCropper() {
  cropperAberto.value = false;
  cropperNomeArquivo.value = '';
  destruirCropper();
}

function resetarCropper() {
  const selection = cropper?.getCropperSelection();
  selection?.$reset();
  selection?.$center();
}

async function enviarAvatar(event) {
  const arquivo = event.target?.files?.[0];
  if (event?.target) event.target.value = '';
  if (!arquivo || !dados.value?.colaborador?._id) return;

  if (!arquivo.type.startsWith('image/')) {
    ui.erro('Selecione apenas um arquivo de imagem.');
    return;
  }

  if (arquivo.size > MAX_AVATAR_BYTES) {
    ui.erro('A foto deve ter no máximo 5 MB.');
    return;
  }

  cropperNomeArquivo.value = arquivo.name;
  cropperImage.value = URL.createObjectURL(arquivo);
  cropperAberto.value = true;
  await iniciarCropper();
}

async function confirmarCropAvatar() {
  if (!dados.value?.colaborador?._id || !cropper) return;
  enviandoAvatar.value = true;

  try {
    const selection = cropper.getCropperSelection();
    if (!selection) throw new Error('Área de corte indisponível');

    const canvas = await selection.$toCanvas({
      width: 720,
      height: 720,
      beforeDraw(context, targetCanvas) {
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
      },
    });

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (arquivo) => {
          if (arquivo) {
            resolve(arquivo);
            return;
          }
          reject(new Error('Não foi possível gerar a imagem final'));
        },
        'image/jpeg',
        0.92,
      );
    });

    if (!blob) throw new Error('Não foi possível processar a imagem');

    const fd = new FormData();
    fd.append('avatar', blob, `colaborador-${dados.value.colaborador._id}.jpg`);

    const { data } = await api.post(`/colaboradores/${dados.value.colaborador._id}/avatar`, fd, {
      params: paramsEscopoEdicao.value,
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    dados.value.colaborador.avatarUrl = data.avatarUrl;
    fecharCropper();
    ui.sucesso('Foto atualizada com sucesso');
  } catch (error) {
    ui.erro(error?.response?.data?.error || error?.message || 'Erro ao atualizar a foto');
  } finally {
    enviandoAvatar.value = false;
  }
}
</script>

<template>
  <Loader v-if="carregando" />
  <div v-else-if="dados" class="grid gap-3">
    <RouterLink :to="rotaVoltar" class="btn ghost" style="width: fit-content;"><fa icon="chevron-right" style="transform: rotate(180deg);" /> Voltar</RouterLink>

    <div class="card glow row colaborador-hero-card" style="padding: 24px;">
      <div class="colaborador-hero-avatar-wrap">
        <button
          v-if="podeEditar"
          type="button"
          class="colaborador-hero-avatar-button"
          @click="abrirAvatar"
        >
          <ColaboradorAvatar class="colaborador-hero-avatar" :nome="dados.colaborador.nome" :avatar-url="dados.colaborador.avatarUrl" :size="96" :font-size="30" />
          <span class="colaborador-hero-avatar-overlay"><fa icon="camera" /></span>
        </button>
        <ColaboradorAvatar v-else class="colaborador-hero-avatar" :nome="dados.colaborador.nome" :avatar-url="dados.colaborador.avatarUrl" :size="96" :font-size="30" />
        <input
          ref="avatarInput"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          hidden
          @change="enviarAvatar"
        />
        <div v-if="podeEditar" class="muted colaborador-hero-avatar-hint">Clique para trocar a foto</div>
      </div>

      <div style="flex:1">
        <h2 class="mt-0 mb-0">{{ dados.colaborador.nome }}</h2>
        <div class="muted">#{{ dados.colaborador.codigoExterno }} · {{ dados.colaborador.cargo || 'Colaborador' }}</div>
        <div class="row mt-2" style="gap:6px; flex-wrap:wrap;">
          <span v-for="c in dados.colaborador.conquistas" :key="c.codigo" class="badge info"><fa icon="award" /> {{ c.nome }}</span>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 32px; font-weight: 800;">{{ Math.round(dados.colaborador.pontuacao) }}</div>
        <div class="muted">pontos · Nível {{ dados.colaborador.nivel }}</div>
      </div>
    </div>

    <div v-if="podeEditar" class="card glow">
      <div class="row mb-2">
        <div>
          <h3 class="mt-0 mb-0">Editar colaborador</h3>
          <p class="muted" style="margin: 6px 0 0; font-size: 13px;">Atualize os dados cadastrais e a foto do colaborador neste mesmo perfil.</p>
        </div>
      </div>

      <div class="form-grid">
        <div class="field"><label>Nome</label><input v-model="formulario.nome" required /></div>
        <div class="field"><label>Código (matrícula)</label><input v-model="formulario.codigoExterno" required /></div>
        <div class="field"><label>Cargo</label><input v-model="formulario.cargo" /></div>
        <div class="field"><label>Setor</label><input v-model="formulario.setor" /></div>
      </div>

      <div class="row mt-2">
        <button class="btn ghost" @click="preencherFormulario(dados.colaborador)">Reverter</button>
        <span class="spacer" />
        <button class="btn primary" :disabled="salvandoPerfil" @click="salvarPerfil">
          <fa :icon="salvandoPerfil ? 'spinner' : 'floppy-disk'" :spin="salvandoPerfil" />
          {{ salvandoPerfil ? 'Salvando...' : 'Salvar alterações' }}
        </button>
      </div>
    </div>

    <div class="row">
      <PeriodoSelector
        v-model="periodo"
        v-model:dataInicio="dataInicio"
        v-model:dataFim="dataFim"
      />
    </div>

    <div class="kpi-grid">
      <div v-for="t in dados.porTipo" :key="t._id" class="kpi">
        <div class="ico" :style="{ background: corPorTipo[t._id] }"><fa icon="clipboard-check" /></div>
        <div class="label">{{ t._id }}</div>
        <div class="value">{{ t.totalLidos.toLocaleString('pt-BR') }}</div>
        <div class="muted" style="font-size: 12px; margin-top: 4px;">
          {{ t.totalConformes }} conformes · {{ Math.round(t.pontuacao) }} pts
        </div>
      </div>
    </div>

    <div class="card">
      <div class="row mb-2">
        <h3 class="mt-0 mb-0">Itens lidos por dia</h3>
        <span class="spacer" /><fa :icon="serieComoColunas ? 'chart-bar' : 'chart-line'" class="muted" />
      </div>
      <AppChart :type="serieComoColunas ? 'bar' : 'line'" :data="serieChart" :height="320" :options="serieChartOptions" />
    </div>

    <Transition name="crop-modal">
      <div v-if="cropperAberto" class="crop-backdrop" @click.self="fecharCropper">
        <div class="crop-dialog">
          <div class="row config-crop-head mb-2">
            <div>
              <h3 class="mt-0 mb-0">Ajustar foto do colaborador</h3>
              <p class="muted crop-copy">Use o círculo como guia principal do enquadramento para manter o avatar padronizado.</p>
            </div>
            <button class="btn ghost" @click="fecharCropper">
              <fa icon="xmark" /> Fechar
            </button>
          </div>

          <div ref="cropperStageRef" class="crop-stage">
            <img
              ref="cropperImageRef"
              :src="cropperImage"
              :alt="cropperNomeArquivo || 'Prévia do avatar do colaborador'"
              class="crop-image"
            />
          </div>

          <p class="muted crop-tip">Arraste a foto até centralizar o rosto dentro do círculo antes de salvar.</p>

          <div class="row crop-footer">
            <button class="btn ghost" @click="resetarCropper">Reiniciar corte</button>
            <span class="spacer" />
            <button class="btn ghost" @click="fecharCropper">Cancelar</button>
            <button class="btn primary" :disabled="enviandoAvatar" @click="confirmarCropAvatar">
              <fa :icon="enviandoAvatar ? 'spinner' : 'check'" :spin="enviandoAvatar" />
              {{ enviandoAvatar ? 'Salvando foto...' : 'Salvar foto' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.colaborador-hero-card {
  align-items: flex-start;
  gap: 24px;
  flex-wrap: wrap;
}

.colaborador-hero-avatar-wrap {
  display: grid;
  justify-items: center;
  gap: 8px;
}

.colaborador-hero-avatar-button {
  position: relative;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  border-radius: 999px;
}

.colaborador-hero-avatar {
  box-shadow: 0 10px 28px rgba(124, 92, 255, 0.28);
  border: 4px solid rgba(255, 255, 255, 0.14);
}

.colaborador-hero-avatar-overlay {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: rgba(7, 10, 18, 0.42);
  color: #fff;
  font-size: 20px;
  opacity: 0;
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.colaborador-hero-avatar-button:hover .colaborador-hero-avatar-overlay,
.colaborador-hero-avatar-button:focus-visible .colaborador-hero-avatar-overlay {
  opacity: 1;
}

.colaborador-hero-avatar-button:hover,
.colaborador-hero-avatar-button:focus-visible {
  transform: translateY(-1px);
}

.colaborador-hero-avatar-hint {
  font-size: 12px;
}

.config-crop-head {
  align-items: flex-start;
  justify-content: space-between;
}

.crop-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(6, 10, 18, 0.72);
  backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  padding: 20px;
  z-index: 60;
}

.crop-dialog {
  width: min(100%, 860px);
  background: var(--bg-2);
  border: 1px solid var(--border-strong);
  border-radius: 24px;
  padding: 22px;
  box-shadow: var(--shadow-lg);
}

.crop-copy {
  margin: 6px 0 0;
  font-size: 13px;
}

.crop-stage {
  margin-top: 12px;
  min-height: 420px;
  max-height: 62vh;
  overflow: hidden;
  border-radius: 26px;
  border: 1px solid var(--border);
  background:
    radial-gradient(circle at top, rgba(255, 255, 255, 0.08), transparent 42%),
    linear-gradient(180deg, rgba(13, 19, 31, 0.96), rgba(7, 10, 18, 0.94));
}

.crop-image {
  display: block;
  max-width: 100%;
}

.crop-tip {
  margin: 12px 0 0;
  font-size: 13px;
}

:global(.crop-stage cropper-canvas) {
  display: block;
  width: 100%;
  min-height: 420px;
}

:global(.crop-stage cropper-image) {
  cursor: grab;
}

:global(.crop-stage cropper-image:active) {
  cursor: grabbing;
}

:global(.crop-stage cropper-selection) {
  border-radius: 999px;
  overflow: hidden;
  outline: 3px solid rgba(255, 255, 255, 0.96);
  box-shadow:
    0 0 0 9999px rgba(4, 8, 15, 0.52),
    0 18px 32px rgba(0, 0, 0, 0.34);
}

:global(.crop-stage cropper-selection cropper-grid),
:global(.crop-stage cropper-selection cropper-crosshair) {
  opacity: 0.9;
}

:global(.crop-stage cropper-selection cropper-handle[action="move"]) {
  background: rgba(255, 255, 255, 0.22);
}

.crop-footer {
  margin-top: 18px;
  align-items: center;
}

.crop-modal-enter-active,
.crop-modal-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.crop-modal-enter-from,
.crop-modal-leave-to {
  opacity: 0;
}

:global([data-theme="light"]) .crop-dialog {
  background: rgba(255, 255, 255, 0.98);
}

@media (max-width: 720px) {
  .crop-dialog {
    padding: 18px;
  }

  .crop-stage {
    min-height: 320px;
  }

  :global(.crop-stage cropper-canvas) {
    min-height: 320px;
  }
}
</style>
