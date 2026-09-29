<script setup>
/**
 * Perfil do colaborador no painel administrativo.
 *
 * A pagina mostra o MESMO perfil que o colaborador ve de si no portal: quem
 * desenha tudo — cabecalho, ranking geral, resultados por tipo, conquistas com
 * tiers e historico de leituras — e o componente PerfilPublicoColaborador, sem
 * copia nenhuma aqui. O que existe so para o administrador (editar o cadastro
 * e trocar a foto) mora em janelas, para nao disputar espaco com o perfil.
 */
import Cropper from "cropperjs";
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import api from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import PerfilPublicoColaborador from "@/components/PerfilPublicoColaborador.vue";

const auth = useAuthStore();
const ui = useUiStore();
const route = useRoute();

// O perfil do portal e sempre historico: e desse recorte que saem o nivel, as
// conquistas e a posicao no ranking geral.
const PERIODO_PERFIL = "tudo";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const carregando = ref(true);
const erro = ref("");
const dados = ref(null);

const edicaoAberta = ref(false);
const salvandoPerfil = ref(false);
const formulario = ref({ nome: "", codigoExterno: "", cargo: "", setor: "" });

const avatarInput = ref(null);
const enviandoAvatar = ref(false);
const cropperAberto = ref(false);
const cropperImage = ref("");
const cropperNomeArquivo = ref("");
const cropperImageRef = ref(null);
const cropperStageRef = ref(null);

const conquistaSelecionada = ref(null);

let cropper;

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
    ? { path: "/colaboradores", query: { lojaId: route.query.lojaId } }
    : { path: "/colaboradores" },
);

const colaborador = computed(() => dados.value?.colaborador || null);

const lojaIdEdicao = computed(() => {
  if (route.query.lojaId) return String(route.query.lojaId);
  const loja = colaborador.value?.loja;
  if (!loja) return "";
  if (typeof loja === "string") return loja;
  return loja._id ? String(loja._id) : String(loja);
});

const paramsEscopoEdicao = computed(() => {
  if (auth.isSuperAdmin && lojaIdEdicao.value) {
    return { lojaId: lojaIdEdicao.value };
  }
  return {};
});

const podeEditar = computed(
  () => auth.podeGerenciar && !!colaborador.value?._id,
);

function formatNum(valor) {
  return Number(valor || 0).toLocaleString("pt-BR");
}

function preencherFormulario(colab) {
  formulario.value = {
    nome: colab?.nome || "",
    codigoExterno: colab?.codigoExterno || "",
    cargo: colab?.cargo || "",
    setor: colab?.setor || "",
  };
}

async function carregar() {
  carregando.value = true;
  erro.value = "";
  try {
    const { data } = await api.get(
      `/metricas/colaboradores/${route.params.id}/perfil`,
      { params: { ...escopoLojaParams.value, periodo: PERIODO_PERFIL } },
    );
    dados.value = data;
    preencherFormulario(data.colaborador);
  } catch (error) {
    dados.value = null;
    erro.value =
      error?.response?.data?.error ||
      "Não foi possível carregar o perfil do colaborador.";
  } finally {
    carregando.value = false;
  }
}

onMounted(carregar);
onBeforeUnmount(() => destruirCropper());

/* ── Cadastro ── */

function abrirEdicao() {
  if (!podeEditar.value) return;
  preencherFormulario(colaborador.value);
  edicaoAberta.value = true;
}

function fecharEdicao() {
  edicaoAberta.value = false;
}

async function salvarPerfil() {
  if (!colaborador.value?._id) return;
  salvandoPerfil.value = true;
  try {
    const payload = {
      nome: formulario.value.nome.trim(),
      codigoExterno: formulario.value.codigoExterno.trim(),
      cargo: formulario.value.cargo.trim() || undefined,
      setor: formulario.value.setor.trim() || undefined,
    };

    const { data } = await api.put(
      `/colaboradores/${colaborador.value._id}`,
      payload,
      { params: paramsEscopoEdicao.value },
    );

    dados.value.colaborador = { ...dados.value.colaborador, ...data };
    preencherFormulario(dados.value.colaborador);
    edicaoAberta.value = false;
    ui.sucesso("Colaborador atualizado");
  } catch (error) {
    ui.erro(error?.response?.data?.error || "Falha ao atualizar colaborador");
  } finally {
    salvandoPerfil.value = false;
  }
}

/* ── Foto ── */

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
    cropperImage.value = "";
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
  cropperNomeArquivo.value = "";
  destruirCropper();
}

function resetarCropper() {
  const selection = cropper?.getCropperSelection();
  selection?.$reset();
  selection?.$center();
}

async function enviarAvatar(event) {
  const arquivo = event.target?.files?.[0];
  if (event?.target) event.target.value = "";
  if (!arquivo || !colaborador.value?._id) return;

  if (!arquivo.type.startsWith("image/")) {
    ui.erro("Selecione apenas um arquivo de imagem.");
    return;
  }

  if (arquivo.size > MAX_AVATAR_BYTES) {
    ui.erro("A foto deve ter no máximo 5 MB.");
    return;
  }

  cropperNomeArquivo.value = arquivo.name;
  cropperImage.value = URL.createObjectURL(arquivo);
  cropperAberto.value = true;
  await iniciarCropper();
}

async function confirmarCropAvatar() {
  if (!colaborador.value?._id || !cropper) return;
  enviandoAvatar.value = true;

  try {
    const selection = cropper.getCropperSelection();
    if (!selection) throw new Error("Área de corte indisponível");

    const canvas = await selection.$toCanvas({
      width: 720,
      height: 720,
      beforeDraw(context, targetCanvas) {
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
      },
    });

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (arquivoFinal) => {
          if (arquivoFinal) {
            resolve(arquivoFinal);
            return;
          }
          reject(new Error("Não foi possível gerar a imagem final"));
        },
        "image/jpeg",
        0.92,
      );
    });

    if (!blob) throw new Error("Não foi possível processar a imagem");

    const fd = new FormData();
    fd.append("avatar", blob, `colaborador-${colaborador.value._id}.jpg`);

    const { data } = await api.post(
      `/colaboradores/${colaborador.value._id}/avatar`,
      fd,
      {
        params: paramsEscopoEdicao.value,
        headers: { "Content-Type": "multipart/form-data" },
      },
    );

    dados.value.colaborador.avatarUrl = data.avatarUrl;
    fecharCropper();
    ui.sucesso("Foto atualizada com sucesso");
  } catch (error) {
    ui.erro(
      error?.response?.data?.error ||
        error?.message ||
        "Erro ao atualizar a foto",
    );
  } finally {
    enviandoAvatar.value = false;
  }
}

/* ── Conquistas ── */

/**
 * O card de conquista do perfil e clicavel; a janela mostra a escada de tiers.
 * A conquista chega ja enriquecida pelo componente (tier atual, cor, imagem),
 * daqui so sai a data de cada desbloqueio.
 */
function abrirConquista(conquista) {
  conquistaSelecionada.value = conquista;
}

function fecharConquista() {
  conquistaSelecionada.value = null;
}

function dataDesbloqueioTier(conquista, nivel) {
  const item = (conquista.historicoDesbloqueios || []).find(
    (historico) => historico.nivel === nivel,
  );
  if (!item?.desbloqueadoEm) return "";
  return new Date(item.desbloqueadoEm).toLocaleDateString("pt-BR");
}

const conquistaDetalhe = computed(() => {
  const conquista = conquistaSelecionada.value;
  if (!conquista) return null;

  return {
    ...conquista,
    tiers: (conquista.tiers || []).map((tier) => ({
      ...tier,
      dataDesbloqueio: dataDesbloqueioTier(conquista, tier.nivel),
    })),
  };
});
</script>

<template>
  <div class="perfil-admin">
    <div class="perfil-admin-barra">
      <RouterLink :to="rotaVoltar" class="btn ghost">
        <fa icon="chevron-right" class="perfil-admin-voltar" /> Voltar
      </RouterLink>

      <span class="spacer" />

      <template v-if="podeEditar">
        <button class="btn ghost" @click="abrirAvatar">
          <fa icon="camera" /> Trocar foto
        </button>
        <button class="btn ghost" @click="abrirEdicao">
          <fa icon="pen-to-square" /> Editar dados
        </button>
      </template>
    </div>

    <PerfilPublicoColaborador
      :carregando="carregando"
      :erro="erro"
      :perfil="dados"
      :ranking-geral="dados?.rankingGeral || null"
      @select-conquista="abrirConquista"
    />

    <input
      ref="avatarInput"
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
      hidden
      @change="enviarAvatar"
    />

    <!-- ── Cadastro do colaborador ── -->
    <Transition name="perfil-modal">
      <div
        v-if="edicaoAberta"
        class="perfil-modal-backdrop"
        @click.self="fecharEdicao"
      >
        <div class="perfil-modal-dialog">
          <div class="row perfil-modal-head mb-2">
            <div>
              <h3 class="mt-0 mb-0">Editar colaborador</h3>
              <p class="muted perfil-modal-copy">
                Nome, matrícula, cargo e setor deste colaborador.
              </p>
            </div>
            <button class="btn ghost" @click="fecharEdicao">
              <fa icon="xmark" /> Fechar
            </button>
          </div>

          <div class="form-grid">
            <div class="field">
              <label>Nome</label>
              <input v-model="formulario.nome" required />
            </div>
            <div class="field">
              <label>Código (matrícula)</label>
              <input v-model="formulario.codigoExterno" required />
            </div>
            <div class="field">
              <label>Cargo</label>
              <input v-model="formulario.cargo" />
            </div>
            <div class="field">
              <label>Setor</label>
              <input v-model="formulario.setor" />
            </div>
          </div>

          <div class="row perfil-modal-footer">
            <button class="btn ghost" @click="preencherFormulario(colaborador)">
              Reverter
            </button>
            <span class="spacer" />
            <button class="btn ghost" @click="fecharEdicao">Cancelar</button>
            <button
              class="btn primary"
              :disabled="salvandoPerfil"
              @click="salvarPerfil"
            >
              <fa
                :icon="salvandoPerfil ? 'spinner' : 'floppy-disk'"
                :spin="salvandoPerfil"
              />
              {{ salvandoPerfil ? "Salvando..." : "Salvar alterações" }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ── Corte da foto ── -->
    <Transition name="perfil-modal">
      <div
        v-if="cropperAberto"
        class="perfil-modal-backdrop"
        @click.self="fecharCropper"
      >
        <div class="perfil-modal-dialog crop-dialog">
          <div class="row perfil-modal-head mb-2">
            <div>
              <h3 class="mt-0 mb-0">Ajustar foto do colaborador</h3>
              <p class="muted perfil-modal-copy">
                Use o círculo como guia principal do enquadramento para manter o
                avatar padronizado.
              </p>
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

          <p class="muted perfil-modal-copy">
            Arraste a foto até centralizar o rosto dentro do círculo antes de
            salvar.
          </p>

          <div class="row perfil-modal-footer">
            <button class="btn ghost" @click="resetarCropper">
              Reiniciar corte
            </button>
            <span class="spacer" />
            <button class="btn ghost" @click="fecharCropper">Cancelar</button>
            <button
              class="btn primary"
              :disabled="enviandoAvatar"
              @click="confirmarCropAvatar"
            >
              <fa
                :icon="enviandoAvatar ? 'spinner' : 'check'"
                :spin="enviandoAvatar"
              />
              {{ enviandoAvatar ? "Salvando foto..." : "Salvar foto" }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ── Escada de tiers da conquista ── -->
    <Transition name="perfil-modal">
      <div
        v-if="conquistaDetalhe"
        class="perfil-modal-backdrop"
        @click.self="fecharConquista"
      >
        <div class="perfil-modal-dialog conq-dialog">
          <div class="conq-topo">
            <span
              class="conq-selo"
              :style="{ '--tier-cor': conquistaDetalhe.tierColor || '#7c5cff' }"
            >
              <img
                v-if="conquistaDetalhe.imagemIcone"
                :src="conquistaDetalhe.imagemIcone"
                :alt="conquistaDetalhe.nome"
                draggable="false"
              />
              <span v-else>{{ conquistaDetalhe.icone || "🏅" }}</span>
            </span>

            <div class="conq-topo-copy">
              <span v-if="conquistaDetalhe.tierLabel" class="badge info">
                {{ conquistaDetalhe.tierLabel }}
              </span>
              <h3 class="mt-0 mb-0">{{ conquistaDetalhe.nome }}</h3>
              <p class="muted perfil-modal-copy">
                {{ conquistaDetalhe.descricao || "Sem descrição detalhada." }}
              </p>
            </div>

            <button class="btn ghost" @click="fecharConquista">
              <fa icon="xmark" />
            </button>
          </div>

          <div v-if="conquistaDetalhe.proximoTier" class="conq-progresso">
            <div class="row conq-progresso-topo">
              <span class="muted">
                Próximo tier:
                <strong>{{ conquistaDetalhe.proximoTier.label }}</strong>
              </span>
              <span class="spacer" />
              <span class="muted">
                {{ formatNum(conquistaDetalhe.progresso) }} /
                {{ formatNum(conquistaDetalhe.proximoTier.meta) }}
              </span>
            </div>
            <div class="progress">
              <span :style="{ width: conquistaDetalhe.progressoPct + '%' }" />
            </div>
          </div>

          <div class="row conq-contagem">
            <fa icon="trophy" class="muted" />
            <span class="muted">
              {{ formatNum(conquistaDetalhe.totalTiersDesbloqueados) }} de
              {{ formatNum(conquistaDetalhe.totalTiers) }} tiers desbloqueados
            </span>
          </div>

          <ul class="conq-tiers">
            <li
              v-for="tier in conquistaDetalhe.tiers"
              :key="tier.nivel"
              :class="{ ativo: tier.desbloqueado }"
              :style="{ '--tier-cor': tier.cor || '#7c5cff' }"
            >
              <span class="conq-tier-selo">
                <fa :icon="tier.desbloqueado ? 'check' : 'lock'" />
              </span>
              <span class="conq-tier-copy">
                <strong>{{ tier.label }}</strong>
                <small class="muted">
                  {{ tier.titulo || `Meta de ${formatNum(tier.meta)}` }}
                </small>
              </span>
              <span class="conq-tier-status muted">
                <template v-if="tier.desbloqueado">
                  {{ tier.dataDesbloqueio || "Desbloqueado" }}
                </template>
                <template v-else>Meta {{ formatNum(tier.meta) }}</template>
              </span>
            </li>
          </ul>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.perfil-admin {
  display: grid;
  gap: 14px;
  /* Mesma coluna do portal (880px). O perfil foi desenhado para telefone:
     esticado na largura inteira do painel, os cards ficam ocos e o cabeçalho
     se espalha. */
  width: 100%;
  max-width: 880px;
  margin: 0 auto;
}

.perfil-admin-barra {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.perfil-admin-voltar {
  transform: rotate(180deg);
}

/* ── Janelas: cadastro, foto e conquista ── */
.perfil-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(6, 10, 18, 0.72);
  backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  padding: 20px;
  z-index: 60;
  overflow-y: auto;
}

.perfil-modal-dialog {
  width: min(100%, 640px);
  background: var(--bg-2);
  border: 1px solid var(--border-strong);
  border-radius: 24px;
  padding: 22px;
  box-shadow: var(--shadow-lg);
}

.crop-dialog {
  width: min(100%, 860px);
}

.conq-dialog {
  width: min(100%, 560px);
}

.perfil-modal-head {
  align-items: flex-start;
  justify-content: space-between;
}

.perfil-modal-copy {
  margin: 6px 0 0;
  font-size: 13px;
}

.perfil-modal-footer {
  margin-top: 18px;
  align-items: center;
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

/* ── Conquista ── */
.conq-topo {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 14px;
  align-items: start;
}

.conq-selo {
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  font-size: 30px;
  border-radius: 18px;
  border: 1px solid var(--tier-cor);
  background: color-mix(in srgb, var(--tier-cor) 16%, transparent);
  overflow: hidden;
}

.conq-selo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.conq-topo-copy {
  min-width: 0;
  display: grid;
  gap: 6px;
  justify-items: start;
}

.conq-progresso {
  margin-top: 16px;
  display: grid;
  gap: 6px;
}

.conq-progresso-topo {
  align-items: center;
  font-size: 12.5px;
}

.conq-contagem {
  margin-top: 14px;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
}

.conq-tiers {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.conq-tiers li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--surface);
  opacity: 0.6;
}

.conq-tiers li.ativo {
  opacity: 1;
  border-color: var(--tier-cor);
  background: color-mix(in srgb, var(--tier-cor) 12%, transparent);
}

.conq-tier-selo {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--tier-cor) 22%, transparent);
  color: var(--tier-cor);
  font-size: 12px;
}

.conq-tier-copy {
  display: grid;
  flex: 1;
  min-width: 0;
}

.conq-tier-copy strong {
  font-size: 13.5px;
}

.conq-tier-copy small {
  font-size: 12px;
}

.conq-tier-status {
  font-size: 12px;
  text-align: right;
  white-space: nowrap;
}

.perfil-modal-enter-active,
.perfil-modal-leave-active {
  transition: opacity 0.22s ease;
}

.perfil-modal-enter-from,
.perfil-modal-leave-to {
  opacity: 0;
}

:global([data-theme="light"]) .perfil-modal-dialog {
  background: rgba(255, 255, 255, 0.98);
}

@media (max-width: 720px) {
  .perfil-modal-dialog {
    padding: 18px;
  }

  .crop-stage {
    min-height: 320px;
  }

  :global(.crop-stage cropper-canvas) {
    min-height: 320px;
  }

  .conq-topo {
    grid-template-columns: auto 1fr;
  }

  .conq-topo > button {
    grid-column: 2;
    justify-self: end;
  }
}
</style>
