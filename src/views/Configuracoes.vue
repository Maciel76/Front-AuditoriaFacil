<script setup>
import Cropper from "cropperjs";
import { ref, onMounted, nextTick, onBeforeUnmount } from "vue";
import api from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import Loader from "@/components/Loader.vue";
import StoreAvatar from "@/components/StoreAvatar.vue";

const auth = useAuthStore();
const ui = useUiStore();
const carregando = ref(true);
const loja = ref(null);
const usuarios = ref([]);
const novoUsuario = ref(null);
const senhaForm = ref({ atual: "", nova: "", confirmar: "" });
const avatarInput = ref(null);
const enviandoAvatar = ref(false);
const alterandoSenha = ref(false);
const cropperImage = ref("");
const cropperAberto = ref(false);
const cropperImageRef = ref(null);
const cropperStageRef = ref(null);
const cropperNomeArquivo = ref("");

// Configurações globais (SUPER_ADMIN). Mantém o último valor salvo para
// permitir cancelar edição/voltar ao default sem nova requisição.
const systemConfig = ref({ metaPercentualRestante: 2 });
const systemConfigEdit = ref({ metaPercentualRestante: 2 });
const salvandoConfig = ref(false);

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

function sincronizarLojaAuth(lojaAtualizada) {
  if (!lojaAtualizada) return;
  if (String(auth.loja?._id || "") === String(lojaAtualizada._id || "")) {
    auth.atualizarLoja(lojaAtualizada);
  }
}

async function carregar() {
  carregando.value = true;
  try {
    if (auth.loja?._id) {
      const { data } = await api.get("/lojas/me", {
        params: auth.isSuperAdmin ? { lojaId: auth.loja._id } : {},
      });
      loja.value = data;
      sincronizarLojaAuth(data);
    }
    const { data: u } = await api.get("/usuarios");
    usuarios.value = u.items;
    if (auth.isSuperAdmin) {
      try {
        const { data: cfg } = await api.get("/config");
        if (cfg && typeof cfg.metaPercentualRestante === "number") {
          systemConfig.value = { ...cfg };
          systemConfigEdit.value = { ...cfg };
        }
      } catch {
        // mantém defaults
      }
    }
  } finally {
    carregando.value = false;
  }
}
onMounted(carregar);
onBeforeUnmount(() => destruirCropper());

async function salvarSystemConfig() {
  salvandoConfig.value = true;
  try {
    const payload = {
      metaPercentualRestante: Number(systemConfigEdit.value.metaPercentualRestante),
    };
    const { data } = await api.put("/config", payload);
    systemConfig.value = { ...data };
    systemConfigEdit.value = { ...data };
    ui.sucesso("Configurações globais atualizadas");
  } catch (e) {
    ui.erro(e?.response?.data?.error || "Falha ao salvar configurações");
  } finally {
    salvandoConfig.value = false;
  }
}

async function salvarLoja() {
  try {
    const { data } = await api.put("/lojas/" + loja.value._id, loja.value);
    loja.value = data;
    sincronizarLojaAuth(data);
    ui.sucesso("Loja atualizada");
  } catch (e) {
    ui.erro(e?.response?.data?.error || "Falha");
  }
}

function resetarSenhaForm() {
  senhaForm.value = { atual: "", nova: "", confirmar: "" };
}

async function alterarMinhaSenha() {
  if (!auth.usuario?._id) return;

  if (senhaForm.value.nova !== senhaForm.value.confirmar) {
    ui.erro("A confirmação da nova senha não confere");
    return;
  }

  alterandoSenha.value = true;

  try {
    await api.put("/usuarios/me/senha", {
      senhaAtual: senhaForm.value.atual,
      senhaNova: senhaForm.value.nova,
    });
    resetarSenhaForm();
    ui.sucesso("Senha atualizada com sucesso");
  } catch (e) {
    ui.erro(e?.response?.data?.error || "Falha ao atualizar senha");
  } finally {
    alterandoSenha.value = false;
  }
}

function abrirAvatar() {
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
  if (!arquivo || !loja.value?._id) return;

  cropperNomeArquivo.value = arquivo.name;
  cropperImage.value = URL.createObjectURL(arquivo);
  cropperAberto.value = true;
  await iniciarCropper();
}

async function confirmarCropAvatar() {
  if (!loja.value?._id || !cropper) return;
  enviandoAvatar.value = true;

  try {
    const selection = cropper.getCropperSelection();
    if (!selection) {
      throw new Error("Área de corte indisponível");
    }

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
        (arquivo) => {
          if (arquivo) {
            resolve(arquivo);
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
    fd.append("avatar", blob, `loja-${loja.value._id}.jpg`);

    const { data } = await api.post(`/lojas/${loja.value._id}/avatar`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    loja.value = data.loja;
    sincronizarLojaAuth(data.loja);
    fecharCropper();
    ui.sucesso("Foto da loja atualizada");
  } catch (e) {
    ui.erro(
      e?.response?.data?.error || e?.message || "Falha ao enviar foto da loja",
    );
  } finally {
    enviandoAvatar.value = false;
  }
}

function abrirNovoUsuario() {
  novoUsuario.value = { nome: "", email: "", senha: "", role: "COLABORADOR" };
}

async function salvarUsuario() {
  try {
    await api.post("/usuarios", novoUsuario.value);
    ui.sucesso("Usuário criado");
    novoUsuario.value = null;
    carregar();
  } catch (e) {
    ui.erro(e?.response?.data?.error || "Falha");
  }
}

async function desativarUsuario(u) {
  if (!confirm(`Desativar ${u.nome}?`)) return;
  await api.delete("/usuarios/" + u._id);
  carregar();
}
</script>

<template>
  <Loader v-if="carregando" />
  <div v-else class="grid gap-3">
    <div v-if="auth.isSuperAdmin" class="card">
      <div class="row mb-2">
        <div>
          <h3 class="mt-0 mb-0">Segurança da conta</h3>
          <p class="muted config-password-helper">
            Atualize a senha do seu acesso de super admin sem depender da lista
            de usuários.
          </p>
        </div>
      </div>

      <div class="form-grid">
        <div class="field">
          <label>Senha atual</label>
          <input
            v-model="senhaForm.atual"
            type="password"
            autocomplete="current-password"
            minlength="6"
          />
        </div>
        <div class="field">
          <label>Nova senha</label>
          <input
            v-model="senhaForm.nova"
            type="password"
            autocomplete="new-password"
            minlength="6"
          />
        </div>
        <div class="field">
          <label>Confirmar nova senha</label>
          <input
            v-model="senhaForm.confirmar"
            type="password"
            autocomplete="new-password"
            minlength="6"
            @keyup.enter="alterarMinhaSenha"
          />
        </div>
      </div>

      <div class="row mt-2">
        <span class="spacer" />
        <button class="btn ghost" :disabled="alterandoSenha" @click="resetarSenhaForm">
          Limpar
        </button>
        <button
          class="btn primary"
          :disabled="alterandoSenha"
          @click="alterarMinhaSenha"
        >
          <fa :icon="alterandoSenha ? 'spinner' : 'lock'" :spin="alterandoSenha" />
          {{ alterandoSenha ? "Atualizando..." : "Atualizar senha" }}
        </button>
      </div>
    </div>

    <div v-if="auth.isSuperAdmin" class="card" id="metas-globais">
      <div class="row mb-2">
        <div>
          <h3 class="mt-0 mb-0">Metas e rankings</h3>
          <p class="muted config-password-helper">
            Configurações globais usadas pelos rankings de lojas e
            colaboradores. Apenas super admin pode alterar.
          </p>
        </div>
      </div>

      <div class="form-grid">
        <div class="field">
          <label>
            Limite de % restante para considerar meta batida
          </label>
          <input
            v-model.number="systemConfigEdit.metaPercentualRestante"
            type="number"
            min="0"
            max="100"
            step="0.1"
          />
          <small class="muted">
            Quando o % de itens restantes para concluir a auditoria fica
            abaixo desse valor, o ranking exibe o selo de meta batida.
            Padrão: 2%.
          </small>
        </div>
      </div>

      <div class="row mt-2">
        <span class="spacer" />
        <button
          class="btn ghost"
          :disabled="salvandoConfig"
          @click="systemConfigEdit = { ...systemConfig }"
        >
          Cancelar
        </button>
        <button
          class="btn primary"
          :disabled="salvandoConfig"
          @click="salvarSystemConfig"
        >
          <fa :icon="salvandoConfig ? 'spinner' : 'bullseye'" :spin="salvandoConfig" />
          {{ salvandoConfig ? "Salvando..." : "Salvar configurações" }}
        </button>
      </div>
    </div>

    <div v-if="loja" class="card">
      <div class="config-loja-hero">
        <StoreAvatar
          :nome="loja.nome"
          :avatar-url="loja.avatarUrl"
          :size="128"
          :font-size="40"
          class="config-loja-avatar"
        />
        <div class="config-loja-copy">
          <h3 class="mt-0 mb-0">Dados da loja</h3>
          <p class="muted config-loja-helper">
            A foto da loja será usada nas listagens, rankings, perfil da loja e
            demais pontos visuais do sistema.
          </p>
          <div class="row config-loja-actions">
            <button
              class="btn ghost"
              :disabled="enviandoAvatar"
              @click="abrirAvatar"
            >
              <fa
                :icon="enviandoAvatar ? 'spinner' : 'camera'"
                :spin="enviandoAvatar"
              />
              {{ enviandoAvatar ? "Enviando foto..." : "Trocar foto da loja" }}
            </button>
            <span v-if="loja.avatarUrl" class="badge info config-avatar-badge"
              >Avatar configurado</span
            >
            <input
              ref="avatarInput"
              type="file"
              accept="image/*"
              hidden
              @change="enviarAvatar"
            />
          </div>
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label>Nome</label><input v-model="loja.nome" />
        </div>
        <div class="field">
          <label>Slug</label><input v-model="loja.slug" disabled />
        </div>
        <div class="field">
          <label>Código</label><input v-model="loja.codigo" />
        </div>
        <div class="field">
          <label>Cidade</label><input v-model="loja.cidade" />
        </div>
        <div class="field">
          <label>UF</label><input v-model="loja.estado" maxlength="2" />
        </div>
        <div class="field">
          <label>CNPJ</label><input v-model="loja.cnpj" />
        </div>
      </div>
      <h4>Metas de conformidade (%)</h4>
      <div class="form-grid">
        <div class="field">
          <label>Etiqueta</label
          ><input
            type="number"
            v-model.number="loja.metas.conformidadeEtiqueta"
          />
        </div>
        <div class="field">
          <label>Presença</label
          ><input
            type="number"
            v-model.number="loja.metas.conformidadePresenca"
          />
        </div>
        <div class="field">
          <label>Ruptura</label
          ><input
            type="number"
            v-model.number="loja.metas.conformidadeRuptura"
          />
        </div>
      </div>
      <div class="row mt-2">
        <span class="spacer" /><button class="btn primary" @click="salvarLoja">
          Salvar
        </button>
      </div>
    </div>

    <div class="card">
      <div class="row mb-2">
        <h3 class="mt-0 mb-0">Usuários</h3>
        <span class="spacer" />
        <button
          v-if="auth.podeGerenciar"
          class="btn primary"
          @click="abrirNovoUsuario"
        >
          <fa icon="plus" /> Novo usuário
        </button>
      </div>

      <div v-if="novoUsuario" class="card glow mb-2">
        <h4 class="mt-0">Novo usuário</h4>
        <div class="form-grid">
          <div class="field">
            <label>Nome</label><input v-model="novoUsuario.nome" />
          </div>
          <div class="field">
            <label>E-mail</label
            ><input v-model="novoUsuario.email" type="email" />
          </div>
          <div class="field">
            <label>Senha</label
            ><input v-model="novoUsuario.senha" type="password" minlength="6" />
          </div>
          <div class="field">
            <label>Perfil</label>
            <select v-model="novoUsuario.role">
              <option value="COLABORADOR">Colaborador</option>
              <option value="STORE_ADMIN">Admin da loja</option>
              <option v-if="auth.isSuperAdmin" value="SUPER_ADMIN">
                Super admin
              </option>
            </select>
          </div>
        </div>
        <div class="row mt-2">
          <span class="spacer" /><button
            class="btn ghost"
            @click="novoUsuario = null"
          >
            Cancelar</button
          ><button class="btn primary" @click="salvarUsuario">Salvar</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Perfil</th>
              <th>Loja</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in usuarios" :key="u._id">
              <td>{{ u.nome }}</td>
              <td>{{ u.email }}</td>
              <td>
                <span class="badge dim">{{ u.role }}</span>
              </td>
              <td>{{ u.loja?.nome || "—" }}</td>
              <td>
                <span class="badge" :class="u.ativo ? 'ok' : 'bad'">{{
                  u.ativo ? "Ativo" : "Inativo"
                }}</span>
              </td>
              <td class="text-right">
                <button
                  v-if="u.ativo && auth.podeGerenciar"
                  class="btn ghost"
                  @click="desativarUsuario(u)"
                >
                  <fa icon="trash" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Transition name="crop-modal">
      <div
        v-if="cropperAberto"
        class="crop-backdrop"
        @click.self="fecharCropper"
      >
        <div class="crop-dialog">
          <div class="row mb-2 config-crop-head">
            <div>
              <h3 class="mt-0 mb-0">Ajustar foto da loja</h3>
              <p class="muted crop-copy">
                Arraste a imagem para definir o enquadramento antes de salvar.
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
              :alt="cropperNomeArquivo || 'Prévia do avatar da loja'"
              class="crop-image"
            />
          </div>
          <p class="muted crop-tip">
            Use o círculo como guia principal do enquadramento e arraste a foto
            até centralizar o logo ou fachada.
          </p>

          <div class="row crop-footer">
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
  </div>
</template>

<style scoped>
.config-password-helper {
  margin: 6px 0 0;
  max-width: 560px;
}

.config-loja-hero {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 18px;
}

.config-loja-avatar {
  box-shadow: var(--shadow);
  flex: 0 0 auto;
  border: 4px solid rgba(255, 255, 255, 0.16);
}

.config-loja-copy {
  display: grid;
  gap: 8px;
}

.config-loja-actions {
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.config-avatar-badge {
  min-height: 34px;
  padding-inline: 12px;
}

.config-loja-helper {
  margin: 0;
  max-width: 700px;
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
  .config-loja-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .crop-dialog {
    padding: 16px;
  }

  .crop-stage {
    min-height: 260px;
  }

  :global(.crop-stage cropper-canvas) {
    min-height: 260px;
  }

  .crop-footer {
    align-items: stretch;
  }
}
</style>
