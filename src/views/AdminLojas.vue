<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import api from "@/services/api";
import { useUiStore } from "@/stores/ui";
import Loader from "@/components/Loader.vue";
import StoreAvatar from "@/components/StoreAvatar.vue";

const ui = useUiStore();
const router = useRouter();
const items = ref([]);
const carregando = ref(true);

// ── Nova loja ───────────────────────────────────────────────────────────────
const nova = ref(null);
const salvandoNova = ref(false);

// ── Editar loja ─────────────────────────────────────────────────────────────
const editando = ref(null);
const salvandoEdicao = ref(false);
const salvandoCredenciais = ref(false);
const enviandoAvatar = ref(false);
const inputAvatar = ref(null);

// ────────────────────────────────────────────────────────────────────────────
async function carregar() {
  carregando.value = true;
  try {
    const { data } = await api.get("/lojas");
    items.value = data.items;
  } finally {
    carregando.value = false;
  }
}
onMounted(carregar);

// ── Nova loja ────────────────────────────────────────────────────────────────
function abrirNova() {
  nova.value = {
    nome: "",
    codigo: "",
    cidade: "",
    estado: "",
    email: "",
    senha: "",
  };
}

async function salvarNova() {
  if (!nova.value.nome.trim()) return ui.erro("Nome obrigatório");
  salvandoNova.value = true;
  try {
    const { data: loja } = await api.post("/lojas", {
      nome: nova.value.nome.trim(),
      codigo: nova.value.codigo.trim(),
      cidade: nova.value.cidade.trim(),
      estado: nova.value.estado.trim().toUpperCase(),
    });
    if (nova.value.email.trim() && nova.value.senha) {
      await api.post("/usuarios", {
        nome: nova.value.nome.trim(),
        email: nova.value.email.trim(),
        senha: nova.value.senha,
        role: "STORE_ADMIN",
        lojaId: loja._id,
      });
    }
    ui.sucesso("Loja criada com sucesso");
    nova.value = null;
    await carregar();
  } catch (e) {
    ui.erro(e?.response?.data?.error || "Falha ao criar loja");
  } finally {
    salvandoNova.value = false;
  }
}

// ── Editar loja ───────────────────────────────────────────────────────────────
async function abrirEditar(l) {
  editando.value = {
    loja: { ...l },
    adminUser: null,
    credencial: { email: "", senha: "" },
    aba: "dados",
    carregandoAdmin: true,
  };
  try {
    const { data } = await api.get(`/lojas/${l._id}/admin`);
    if (editando.value) {
      editando.value.adminUser = data;
      editando.value.credencial.email = data?.email || "";
    }
  } catch {
    // sem admin ainda
  } finally {
    if (editando.value) editando.value.carregandoAdmin = false;
  }
}

async function salvarEdicao() {
  if (!editando.value) return;
  salvandoEdicao.value = true;
  try {
    const { loja } = editando.value;
    const { data } = await api.put(`/lojas/${loja._id}`, {
      nome: loja.nome,
      codigo: loja.codigo,
      cidade: loja.cidade,
      estado: loja.estado,
      endereco: loja.endereco,
      ativa: loja.ativa,
    });
    const idx = items.value.findIndex((i) => i._id === data._id);
    if (idx !== -1) items.value[idx] = { ...items.value[idx], ...data };
    editando.value.loja = { ...editando.value.loja, ...data };
    ui.sucesso("Dados da loja salvos");
  } catch (e) {
    ui.erro(e?.response?.data?.error || "Falha ao salvar dados");
  } finally {
    salvandoEdicao.value = false;
  }
}

async function salvarCredenciais() {
  if (!editando.value) return;
  const { credencial, adminUser, loja } = editando.value;
  if (!credencial.email.trim()) return ui.erro("E-mail obrigatório");
  salvandoCredenciais.value = true;
  try {
    if (adminUser?._id) {
      const payload = {};
      if (credencial.email.trim() !== adminUser.email)
        payload.email = credencial.email.trim();
      if (credencial.senha) payload.senha = credencial.senha;
      if (!Object.keys(payload).length) {
        ui.sucesso("Nenhuma alteração");
        return;
      }
      const { data } = await api.put(`/usuarios/${adminUser._id}`, payload);
      editando.value.adminUser = data;
      editando.value.credencial.email = data.email;
      editando.value.credencial.senha = "";
    } else {
      if (!credencial.senha)
        return ui.erro("Senha obrigatória para criar acesso");
      const { data } = await api.post("/usuarios", {
        nome: loja.nome,
        email: credencial.email.trim(),
        senha: credencial.senha,
        role: "STORE_ADMIN",
        lojaId: loja._id,
      });
      editando.value.adminUser = data;
      editando.value.credencial.email = data.email;
      editando.value.credencial.senha = "";
    }
    ui.sucesso("Acesso atualizado");
  } catch (e) {
    ui.erro(e?.response?.data?.error || "Falha ao atualizar acesso");
  } finally {
    salvandoCredenciais.value = false;
  }
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function acionarInputAvatar() {
  inputAvatar.value?.click();
}

async function enviarAvatar(event) {
  const file = event.target.files?.[0];
  if (!file || !editando.value) return;
  enviandoAvatar.value = true;
  try {
    const fd = new FormData();
    fd.append("avatar", file);
    const { data } = await api.post(
      `/lojas/${editando.value.loja._id}/avatar`,
      fd,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    editando.value.loja.avatarUrl = data.loja.avatarUrl;
    const idx = items.value.findIndex((i) => i._id === editando.value.loja._id);
    if (idx !== -1)
      items.value[idx] = {
        ...items.value[idx],
        avatarUrl: data.loja.avatarUrl,
      };
    ui.sucesso("Foto atualizada");
  } catch (e) {
    ui.erro(e?.response?.data?.error || "Falha ao enviar foto");
  } finally {
    enviandoAvatar.value = false;
    if (inputAvatar.value) inputAvatar.value.value = "";
  }
}

// ── Utilitários ───────────────────────────────────────────────────────────────
async function desativar(l) {
  if (!confirm(`Desativar "${l.nome}"?`)) return;
  try {
    await api.delete("/lojas/" + l._id);
    await carregar();
  } catch (e) {
    ui.erro(e?.response?.data?.error || "Falha");
  }
}

function abrirPerfil(lojaId) {
  router.push("/lojas/" + lojaId);
}
</script>

<template>
  <div class="grid gap-3">
    <div class="row">
      <span class="spacer" />
      <button class="btn primary" @click="abrirNova">
        <fa icon="plus" /> Nova loja
      </button>
    </div>

    <!-- ───── Formulário nova loja ───── -->
    <div v-if="nova" class="card glow">
      <h3 class="mt-0">Nova loja</h3>
      <div class="form-grid">
        <div class="field">
          <label>Nome <span style="color: var(--danger)">*</span></label>
          <input v-model="nova.nome" placeholder="Nome da loja" />
        </div>
        <div class="field">
          <label>Código</label>
          <input v-model="nova.codigo" placeholder="Código interno" />
        </div>
        <div class="field">
          <label>Cidade</label>
          <input v-model="nova.cidade" />
        </div>
        <div class="field">
          <label>UF</label>
          <input
            v-model="nova.estado"
            maxlength="2"
            style="text-transform: uppercase"
          />
        </div>
      </div>

      <div class="section-sep mt-2">
        <span class="section-sep-label">Acesso à plataforma (opcional)</span>
      </div>
      <div class="form-grid mt-2">
        <div class="field">
          <label>E-mail do admin da loja</label>
          <input
            v-model="nova.email"
            type="email"
            placeholder="admin@loja.com"
          />
        </div>
        <div class="field">
          <label>Senha</label>
          <input
            v-model="nova.senha"
            type="password"
            placeholder="Mínimo 6 caracteres"
          />
        </div>
      </div>

      <div class="row mt-2">
        <span class="spacer" />
        <button class="btn ghost" @click="nova = null">Cancelar</button>
        <button
          class="btn primary"
          :disabled="salvandoNova"
          @click="salvarNova"
        >
          <fa v-if="salvandoNova" icon="spinner" spin />
          Salvar
        </button>
      </div>
    </div>

    <!-- ───── Lista de lojas ───── -->
    <Loader v-if="carregando" />
    <div
      v-else
      class="grid"
      style="
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 14px;
      "
    >
      <div v-for="l in items" :key="l._id" class="card loja-admin-card">
        <div
          class="row card-clickable"
          role="link"
          tabindex="0"
          @click="abrirPerfil(l._id)"
          @keydown.enter.prevent="abrirPerfil(l._id)"
          @keydown.space.prevent="abrirPerfil(l._id)"
        >
          <StoreAvatar
            :nome="l.nome"
            :avatar-url="l.avatarUrl"
            :size="44"
            :font-size="16"
          />
          <div style="flex: 1">
            <div style="font-weight: 700">{{ l.nome }}</div>
            <div class="muted" style="font-size: 12px">
              {{ l.cidade }}{{ l.estado ? " / " + l.estado : "" }} · #{{
                l.slug
              }}
            </div>
          </div>
          <span class="badge" :class="l.ativa ? 'ok' : 'bad'">{{
            l.ativa ? "Ativa" : "Inativa"
          }}</span>
        </div>

        <div class="row mt-2" style="font-size: 12px">
          <span class="muted">Pontos</span>
          <strong>{{ Math.round(l.pontuacao) }}</strong>
          <span class="spacer" />
          <span class="muted">Nível</span>
          <strong>{{ l.nivel }}</strong>
        </div>

        <div class="row mt-2">
          <button class="btn ghost" @click.stop="abrirPerfil(l._id)">
            <fa icon="eye" /> Perfil
          </button>
          <span class="spacer" />
          <button
            class="btn ghost"
            title="Editar loja"
            @click.stop="abrirEditar(l)"
          >
            <fa icon="pen" />
          </button>
          <button
            v-if="l.ativa"
            class="btn ghost"
            title="Desativar loja"
            @click.stop="desativar(l)"
          >
            <fa icon="trash" />
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ══════════ Modal Editar Loja ══════════ -->
  <div v-if="editando" class="loja-modal-overlay" @click.self="editando = null">
    <div class="loja-modal">
      <!-- Header -->
      <div class="loja-modal-header">
        <StoreAvatar
          :nome="editando.loja.nome"
          :avatar-url="editando.loja.avatarUrl"
          :size="48"
          :font-size="18"
        />
        <div style="flex: 1; min-width: 0">
          <div style="font-weight: 700; font-size: 16px">
            {{ editando.loja.nome }}
          </div>
          <div class="muted" style="font-size: 12px">
            #{{ editando.loja.slug }}
          </div>
        </div>
        <button
          class="btn ghost"
          style="padding: 6px 10px; flex-shrink: 0"
          @click="editando = null"
        >
          <fa icon="xmark" />
        </button>
      </div>

      <!-- Tabs -->
      <div class="loja-modal-tabs">
        <button
          class="loja-tab"
          :class="{ active: editando.aba === 'dados' }"
          @click="editando.aba = 'dados'"
        >
          <fa icon="store" /> Dados
        </button>
        <button
          class="loja-tab"
          :class="{ active: editando.aba === 'acesso' }"
          @click="editando.aba = 'acesso'"
        >
          <fa icon="key" /> Acesso
        </button>
        <button
          class="loja-tab"
          :class="{ active: editando.aba === 'foto' }"
          @click="editando.aba = 'foto'"
        >
          <fa icon="camera" /> Foto
        </button>
      </div>

      <!-- ── Tab: Dados ── -->
      <div v-if="editando.aba === 'dados'" class="loja-modal-body">
        <div class="form-grid">
          <div class="field">
            <label>Nome</label>
            <input v-model="editando.loja.nome" />
          </div>
          <div class="field">
            <label>Código</label>
            <input v-model="editando.loja.codigo" />
          </div>
          <div class="field">
            <label>Cidade</label>
            <input v-model="editando.loja.cidade" />
          </div>
          <div class="field">
            <label>UF</label>
            <input
              v-model="editando.loja.estado"
              maxlength="2"
              style="text-transform: uppercase"
            />
          </div>
          <div class="field" style="grid-column: 1 / -1">
            <label>Endereço</label>
            <input v-model="editando.loja.endereco" />
          </div>
        </div>

        <div class="row mt-3">
          <label
            class="row"
            style="gap: 8px; cursor: pointer; user-select: none"
          >
            <input type="checkbox" v-model="editando.loja.ativa" />
            <span style="font-size: 13px">Loja ativa</span>
          </label>
          <span class="spacer" />
          <button
            class="btn primary"
            :disabled="salvandoEdicao"
            @click="salvarEdicao"
          >
            <fa v-if="salvandoEdicao" icon="spinner" spin />
            Salvar dados
          </button>
        </div>
      </div>

      <!-- ── Tab: Acesso ── -->
      <div v-if="editando.aba === 'acesso'" class="loja-modal-body">
        <div
          v-if="editando.carregandoAdmin"
          class="muted"
          style="text-align: center; padding: 28px 0"
        >
          <fa icon="spinner" spin /> Carregando...
        </div>
        <template v-else>
          <div v-if="editando.adminUser" class="acesso-banner ok mb-3">
            <fa icon="circle-check" />
            Acesso configurado para
            <strong>{{ editando.adminUser.email }}</strong>
          </div>
          <div v-else class="acesso-banner warn mb-3">
            <fa icon="triangle-exclamation" />
            Esta loja ainda não tem acesso à plataforma
          </div>

          <div class="form-grid">
            <div class="field" style="grid-column: 1 / -1">
              <label>E-mail de acesso</label>
              <input
                v-model="editando.credencial.email"
                type="email"
                placeholder="admin@loja.com"
              />
            </div>
            <div class="field" style="grid-column: 1 / -1">
              <label>
                Nova senha
                <span
                  v-if="editando.adminUser"
                  class="muted"
                  style="font-size: 11px"
                  >— deixe em branco para não alterar</span
                >
              </label>
              <input
                v-model="editando.credencial.senha"
                type="password"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>

          <div class="row mt-3">
            <span class="spacer" />
            <button
              class="btn primary"
              :disabled="salvandoCredenciais"
              @click="salvarCredenciais"
            >
              <fa v-if="salvandoCredenciais" icon="spinner" spin />
              {{ editando.adminUser ? "Atualizar acesso" : "Criar acesso" }}
            </button>
          </div>
        </template>
      </div>

      <!-- ── Tab: Foto ── -->
      <div v-if="editando.aba === 'foto'" class="loja-modal-body">
        <div class="avatar-upload-area">
          <StoreAvatar
            :nome="editando.loja.nome"
            :avatar-url="editando.loja.avatarUrl"
            :size="120"
            :font-size="44"
            style="border-radius: 50%"
          />
          <p class="muted mt-2" style="font-size: 13px; text-align: center">
            {{
              editando.loja.avatarUrl
                ? "Foto atual da loja"
                : "Sem foto — exibindo iniciais"
            }}
          </p>
          <input
            ref="inputAvatar"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style="display: none"
            @change="enviarAvatar"
          />
          <button
            class="btn primary mt-2"
            :disabled="enviandoAvatar"
            @click="acionarInputAvatar"
          >
            <fa v-if="enviandoAvatar" icon="spinner" spin />
            <fa v-else icon="camera" />
            {{
              enviandoAvatar
                ? "Enviando..."
                : editando.loja.avatarUrl
                  ? "Trocar foto"
                  : "Adicionar foto"
            }}
          </button>
          <p
            class="muted"
            style="font-size: 11px; text-align: center; margin-top: 6px"
          >
            JPG, PNG ou WebP · máx. 5 MB
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loja-admin-card {
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.card-clickable {
  cursor: pointer;
  padding-bottom: 6px;
}

/* ── Modal overlay ── */
.loja-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.loja-modal {
  background: var(--bg-2);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.loja-modal-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--border);
}

/* ── Tabs ── */
.loja-modal-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  padding: 0 20px;
  gap: 4px;
}

.loja-tab {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 13px;
  font-weight: 500;
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition:
    color 0.15s,
    border-color 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.loja-tab:hover {
  color: var(--text);
}

.loja-tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

/* ── Body ── */
.loja-modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

/* ── Banners de acesso ── */
.acesso-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.acesso-banner.ok {
  background: rgba(34, 197, 94, 0.12);
  color: #86efac;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.acesso-banner.warn {
  background: rgba(245, 158, 11, 0.12);
  color: #fcd34d;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

/* ── Separador de seção ── */
.section-sep {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-mute);
}

.section-sep::before,
.section-sep::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border);
}

.section-sep-label {
  font-size: 11px;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* ── Avatar upload ── */
.avatar-upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0 16px;
}

.mb-3 {
  margin-bottom: 12px;
}
.mt-2 {
  margin-top: 8px;
}
.mt-3 {
  margin-top: 14px;
}
</style>
