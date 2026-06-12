<script setup>
/**
 * Admin de conquistas (SUPER_ADMIN).
 * Permite criar, editar, ativar/desativar e remover definições do
 * sistema de gamificação. Cada conquista possui múltiplos tiers
 * (raro, épico, lendário, etc) que servem como marcos crescentes
 * de uma métrica do colaborador.
 */
import { computed, onMounted, ref } from "vue";
import api from "@/services/api";
import { resolverUrlMidia } from "@/utils/media";
import Loader from "@/components/Loader.vue";

const carregando = ref(false);
const salvando = ref(false);
const items = ref([]);
const meta = ref({
  tiers: [],
  categorias: [],
  metricas: [],
  tiposAuditoria: [],
});
const erro = ref("");
const sucesso = ref("");
const filtroCategoria = ref("");

const editorAberto = ref(false);
const editando = ref(null);

const TIER_ORDER = ["comum", "raro", "epico", "lendario", "diamante", "mitico", "suprema", "transcendente"];

const TIER_LABELS = {
  comum: { label: "Comum", cor: "#94a3b8", emoji: "⚪" },
  raro: { label: "Raro", cor: "#3b82f6", emoji: "🔵" },
  epico: { label: "Épico", cor: "#a855f7", emoji: "🟣" },
  lendario: { label: "Lendário", cor: "#f59e0b", emoji: "🟠" },
  diamante: { label: "Diamante", cor: "#06b6d4", emoji: "💎" },
  mitico: { label: "Mítico", cor: "#ef4444", emoji: "🔴" },
  suprema: { label: "Suprema", cor: "#753772", emoji: "👑" },
  transcendente: { label: "Transcendente", cor: "#d79eee", emoji: "🌟" },
};

const METRICA_LABELS = {
  totalItensLidos: "Itens lidos",
  totalItensConformes: "Itens conformes",
  totalAuditorias: "Auditorias realizadas",
  totalItensParticipacaoLoja: "Itens lidos da loja com participação",
  totalLiderPodium: "Vezes no pódio",
  taxaConformidadeAcumulada: "Taxa de conformidade (%)",
  pontuacao: "Pontuação (XP)",
  nivel: "Nível atingido",
};

const CATEGORIA_LABELS = {
  ITENS: "Itens",
  AUDITORIAS: "Auditorias",
  CONFORMIDADE: "Conformidade",
  PONTUACAO: "Pontuação",
  NIVEL: "Nível",
  ESPECIAL: "Especial",
};

const TIPO_AUDITORIA_LABELS = {
  ETIQUETA: "Etiqueta",
  PRESENCA: "Presença",
  RUPTURA: "Ruptura",
};

const itemsFiltrados = computed(() => {
  if (!filtroCategoria.value) return items.value;
  return items.value.filter((c) => c.categoria === filtroCategoria.value);
});

function formularioVazio() {
  return {
    _id: null,
    codigo: "",
    nome: "",
    descricao: "",
    icone: "🏆",
    cor: "",
    categoria: "ITENS",
    metricaBase: "totalItensLidos",
    tipoAuditoria: "",
    recorrente: true,
    ativa: true,
    ordem: 100,
    tiers: [
      { nivel: "comum", meta: 100, xpBonus: 25, titulo: "", imagemUrl: "" },
      { nivel: "raro", meta: 500, xpBonus: 75, titulo: "", imagemUrl: "" },
      { nivel: "epico", meta: 1000, xpBonus: 150, titulo: "", imagemUrl: "" },
    ],
  };
}

const form = ref(formularioVazio());

function abrirNovo() {
  editando.value = null;
  form.value = formularioVazio();
  erro.value = "";
  sucesso.value = "";
  editorAberto.value = true;
}

function abrirEdicao(c) {
  editando.value = c._id;
  form.value = {
    _id: c._id,
    codigo: c.codigo,
    nome: c.nome,
    descricao: c.descricao || "",
    icone: c.icone || "🏆",
    cor: c.cor || "",
    categoria: c.categoria,
    metricaBase: c.metricaBase,
    tipoAuditoria: c.tipoAuditoria || "",
    recorrente: !!c.recorrente,
    ativa: c.ativa !== false,
    ordem: c.ordem ?? 100,
    tiers: (c.tiers || []).map((t) => ({
      nivel: t.nivel,
      meta: t.meta,
      xpBonus: t.xpBonus || 0,
      titulo: t.titulo || "",
      imagemUrl: t.imagemUrl || "",
    })),
  };
  erro.value = "";
  sucesso.value = "";
  editorAberto.value = true;
}

function fecharEditor() {
  editorAberto.value = false;
  editando.value = null;
}

function adicionarTier() {
  const usados = new Set(form.value.tiers.map((t) => t.nivel));
  const proximo = TIER_ORDER.find((n) => !usados.has(n)) || "comum";
  const ultima = form.value.tiers[form.value.tiers.length - 1];
  form.value.tiers.push({
    nivel: proximo,
    meta: ultima ? ultima.meta * 5 : 100,
    xpBonus: ultima ? ultima.xpBonus * 2 : 25,
    titulo: "",
    imagemUrl: "",
  });
}

function removerTier(i) {
  form.value.tiers.splice(i, 1);
}

const uploadingTier = ref({});
async function uparImagemTier(event, idx, tier) {
  const file = event.target?.files?.[0];
  if (!file) return;
  const key = `${idx}-${tier.nivel}`;
  uploadingTier.value = { ...uploadingTier.value, [key]: true };
  try {
    const fd = new FormData();
    fd.append("imagem", file);
    fd.append("codigo", form.value.codigo || "conq");
    fd.append("nivel", tier.nivel || "tier");
    const { data } = await api.post("/conquistas/upload-imagem", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    tier.imagemUrl = data.url || "";
  } catch (e) {
    erro.value = e?.response?.data?.error || "Falha no upload da imagem";
  } finally {
    uploadingTier.value = { ...uploadingTier.value, [key]: false };
    if (event.target) event.target.value = "";
  }
}
function removerImagemTier(tier) {
  tier.imagemUrl = "";
}

async function carregar() {
  carregando.value = true;
  erro.value = "";
  try {
    const [{ data }, { data: m }] = await Promise.all([
      api.get("/conquistas"),
      api.get("/conquistas/meta"),
    ]);
    items.value = data.items || [];
    meta.value = m;
  } catch (e) {
    erro.value = e?.response?.data?.error || "Erro ao carregar conquistas";
  } finally {
    carregando.value = false;
  }
}

async function salvar() {
  if (!form.value.tiers.length) {
    erro.value = "Adicione pelo menos um tier.";
    return;
  }
  salvando.value = true;
  erro.value = "";
  sucesso.value = "";
  try {
    const payload = {
      codigo: form.value.codigo.toUpperCase().trim(),
      nome: form.value.nome.trim(),
      descricao: form.value.descricao,
      icone: form.value.icone || "🏆",
      categoria: form.value.categoria,
      metricaBase: form.value.metricaBase,
      tipoAuditoria: form.value.tipoAuditoria || null,
      recorrente: !!form.value.recorrente,
      ativa: !!form.value.ativa,
      ordem: Number(form.value.ordem) || 100,
      tiers: form.value.tiers
        .map((t) => ({
          nivel: t.nivel,
          meta: Number(t.meta),
          xpBonus: Number(t.xpBonus) || 0,
          titulo: t.titulo || "",
          imagemUrl: (t.imagemUrl || "").trim(),
        }))
        .sort((a, b) => a.meta - b.meta),
    };

    if (editando.value) {
      await api.put(`/conquistas/${editando.value}`, payload);
      sucesso.value = "Conquista atualizada.";
    } else {
      await api.post("/conquistas", payload);
      sucesso.value = "Conquista criada.";
    }
    editorAberto.value = false;
    await carregar();
  } catch (e) {
    erro.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      "Erro ao salvar conquista.";
  } finally {
    salvando.value = false;
  }
}

async function excluir(c) {
  if (!confirm(`Excluir a conquista "${c.nome}"? Esta ação é irreversível.`))
    return;
  try {
    await api.delete(`/conquistas/${c._id}`);
    items.value = items.value.filter((x) => x._id !== c._id);
    sucesso.value = "Conquista removida.";
  } catch (e) {
    erro.value = e?.response?.data?.error || "Erro ao excluir.";
  }
}

async function alternarAtiva(c) {
  try {
    const { data } = await api.put(`/conquistas/${c._id}`, { ativa: !c.ativa });
    Object.assign(c, data);
  } catch (e) {
    erro.value = e?.response?.data?.error || "Erro ao alterar status.";
  }
}

onMounted(carregar);
</script>

<template>
  <div class="page-conquistas">
    <div class="page-head card glow">
      <div>
        <h2 class="page-title">
          <fa icon="trophy" /> Conquistas e Gamificação
        </h2>
        <p class="muted page-sub">
          Defina os marcos que motivam os colaboradores. Cada conquista pode ter
          múltiplos tiers — Comum, Raro, Épico, Lendário, Diamante, Mítico, Suprema e Transcendente —
          desbloqueados conforme o colaborador progride na métrica.
        </p>
      </div>
      <div class="row gap-2 page-actions">
        <select v-model="filtroCategoria" class="select-cat">
          <option value="">Todas categorias</option>
          <option v-for="c in meta.categorias" :key="c" :value="c">
            {{ CATEGORIA_LABELS[c] || c }}
          </option>
        </select>
        <button class="btn primary" @click="abrirNovo">
          <fa icon="plus" /> Nova conquista
        </button>
      </div>
    </div>

    <div v-if="erro" class="badge bad" style="margin: 12px 0">{{ erro }}</div>
    <div v-if="sucesso" class="badge ok" style="margin: 12px 0">
      {{ sucesso }}
    </div>

    <Loader v-if="carregando" />

    <div v-else class="conquistas-list">
      <div
        v-for="c in itemsFiltrados"
        :key="c._id"
        class="card conquista-row"
        :class="{ inativa: !c.ativa }"
      >
        <div class="conquista-row-head">
          <div class="conquista-icone">{{ c.icone || "🏆" }}</div>
          <div class="conquista-row-info">
            <div class="row gap-2 items-center">
              <strong>{{ c.nome }}</strong>
              <span class="badge dim">{{ c.codigo }}</span>
              <span class="badge info">{{
                CATEGORIA_LABELS[c.categoria] || c.categoria
              }}</span>
              <span v-if="c.tipoAuditoria" class="badge dim">{{
                TIPO_AUDITORIA_LABELS[c.tipoAuditoria] || c.tipoAuditoria
              }}</span>
              <span v-if="c.recorrente" class="badge warn">recorrente</span>
              <span v-if="!c.ativa" class="badge bad">inativa</span>
            </div>
            <p class="muted" style="margin: 4px 0 0; font-size: 13px">
              {{ c.descricao || "Sem descrição." }}
            </p>
            <div class="muted" style="font-size: 12px; margin-top: 6px">
              Métrica:
              <strong>{{
                METRICA_LABELS[c.metricaBase] || c.metricaBase
              }}</strong>
            </div>
          </div>
          <div class="row gap-1 conquista-row-actions">
            <button
              class="btn ghost"
              :title="c.ativa ? 'Desativar' : 'Ativar'"
              @click="alternarAtiva(c)"
            >
              <fa :icon="c.ativa ? 'eye' : 'eye-slash'" />
            </button>
            <button class="btn ghost" title="Editar" @click="abrirEdicao(c)">
              <fa icon="pen-to-square" />
            </button>
            <button class="btn ghost" title="Excluir" @click="excluir(c)">
              <fa icon="trash" />
            </button>
          </div>
        </div>
        <div class="tiers-row">
          <div
            v-for="t in c.tiers"
            :key="t.nivel"
            class="tier-chip"
            :style="{
              borderColor: TIER_LABELS[t.nivel]?.cor,
              color: TIER_LABELS[t.nivel]?.cor,
            }"
          >
            <span class="tier-emoji">{{ TIER_LABELS[t.nivel]?.emoji }}</span>
            <span class="tier-name">{{
              TIER_LABELS[t.nivel]?.label || t.nivel
            }}</span>
            <span class="tier-meta"
              >{{ Number(t.meta).toLocaleString("pt-BR")
              }}{{
                c.metricaBase === "taxaConformidadeAcumulada" ? "%" : ""
              }}</span
            >
            <span v-if="t.xpBonus" class="tier-xp">+{{ t.xpBonus }} XP</span>
          </div>
        </div>
      </div>

      <div v-if="!itemsFiltrados.length" class="empty card">
        Nenhuma conquista cadastrada.
      </div>
    </div>

    <Transition name="modal">
      <div
        v-if="editorAberto"
        class="modal-backdrop"
        @click.self="fecharEditor"
      >
        <div class="modal card glow">
          <div class="row justify-between items-center mb-3">
            <h3 style="margin: 0">
              <fa icon="trophy" />
              {{ editando ? "Editar conquista" : "Nova conquista" }}
            </h3>
            <button class="btn ghost" @click="fecharEditor">
              <fa icon="xmark" />
            </button>
          </div>

          <div class="form-grid">
            <div class="field">
              <label>Código (A-Z, 0-9, _)</label>
              <input
                v-model="form.codigo"
                placeholder="ex: ITENS_LIDOS"
                :disabled="!!editando"
                style="text-transform: uppercase"
              />
            </div>
            <div class="field">
              <label>Nome exibido</label>
              <input v-model="form.nome" placeholder="ex: Caçador de Itens" />
            </div>
            <div class="field full">
              <label>Descrição</label>
              <textarea
                v-model="form.descricao"
                rows="2"
                placeholder="Como o colaborador conquista isso?"
              />
            </div>
            <div class="field">
              <label>Ícone (emoji)</label>
              <input v-model="form.icone" maxlength="4" placeholder="🎯" />
            </div>
            <div class="field">
              <label>Ordem</label>
              <input v-model.number="form.ordem" type="number" />
            </div>
            <div class="field">
              <label>Categoria</label>
              <select v-model="form.categoria">
                <option v-for="c in meta.categorias" :key="c" :value="c">
                  {{ CATEGORIA_LABELS[c] || c }}
                </option>
              </select>
            </div>
            <div class="field">
              <label>Métrica base</label>
              <select v-model="form.metricaBase">
                <option v-for="m in meta.metricas" :key="m" :value="m">
                  {{ METRICA_LABELS[m] || m }}
                </option>
              </select>
            </div>
            <div class="field">
              <label>Tipo de auditoria</label>
              <select v-model="form.tipoAuditoria">
                <option value="">Todos os tipos</option>
                <option
                  v-for="tipo in meta.tiposAuditoria || []"
                  :key="tipo"
                  :value="tipo"
                >
                  {{ TIPO_AUDITORIA_LABELS[tipo] || tipo }}
                </option>
              </select>
            </div>
            <div class="field check">
              <label>
                <input type="checkbox" v-model="form.recorrente" />
                Recorrente (vários tiers progressivos)
              </label>
            </div>
            <div class="field check">
              <label>
                <input type="checkbox" v-model="form.ativa" />
                Conquista ativa
              </label>
            </div>
          </div>

          <div class="tiers-edit">
            <div class="row justify-between items-center mb-2">
              <h4 style="margin: 0"><fa icon="medal" /> Tiers de progresso</h4>
              <button class="btn ghost" @click="adicionarTier">
                <fa icon="plus" /> Adicionar tier
              </button>
            </div>
            <p class="muted" style="font-size: 12px; margin: 0 0 8px">
              Os tiers são desbloqueados na ordem do menor para o maior valor de
              meta. Use bônus de XP para premiar marcos importantes.
            </p>

            <div
              v-for="(t, i) in form.tiers"
              :key="i"
              class="tier-edit-row"
              :style="{ borderColor: TIER_LABELS[t.nivel]?.cor }"
            >
              <select v-model="t.nivel" class="tier-select">
                <option v-for="opt in TIER_ORDER" :key="opt" :value="opt">
                  {{ TIER_LABELS[opt]?.emoji }} {{ TIER_LABELS[opt]?.label }}
                </option>
              </select>
              <input
                v-model.number="t.meta"
                type="number"
                placeholder="meta"
                class="tier-input"
              />
              <input
                v-model.number="t.xpBonus"
                type="number"
                placeholder="XP bônus"
                class="tier-input"
              />
              <input
                v-model="t.titulo"
                placeholder="título (opcional)"
                class="tier-input wide"
              />
              <label
                class="tier-upload"
                :class="{ uploading: uploadingTier[`${i}-${t.nivel}`] }"
              >
                <fa
                  :icon="
                    uploadingTier[`${i}-${t.nivel}`] ? 'spinner' : 'upload'
                  "
                  :spin="uploadingTier[`${i}-${t.nivel}`]"
                />
                <span>{{
                  t.imagemUrl ? "Trocar imagem" : "Selecionar imagem"
                }}</span>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  @change="uparImagemTier($event, i, t)"
                />
              </label>
              <div v-if="t.imagemUrl" class="tier-img-preview">
                <img
                  :src="resolverUrlMidia(t.imagemUrl)"
                  :alt="`Imagem ${t.nivel}`"
                />
                <button
                  type="button"
                  class="tier-img-remove"
                  @click="removerImagemTier(t)"
                  title="Remover imagem"
                >
                  <fa icon="xmark" />
                </button>
              </div>
              <button class="btn ghost" @click="removerTier(i)">
                <fa icon="trash" />
              </button>
            </div>
          </div>

          <div v-if="erro" class="badge bad" style="margin-top: 12px">
            {{ erro }}
          </div>

          <div class="row justify-end gap-2 mt-3">
            <button class="btn ghost" @click="fecharEditor">Cancelar</button>
            <button class="btn primary" :disabled="salvando" @click="salvar">
              <fa :icon="salvando ? 'spinner' : 'check'" :spin="salvando" />
              Salvar
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.page-conquistas {
  display: grid;
  gap: 16px;
}
.page-head {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}
.page-title {
  margin: 0;
  font-size: 22px;
}
.page-sub {
  margin: 6px 0 0;
  font-size: 13px;
  max-width: 720px;
}
.page-actions {
  flex-wrap: wrap;
}
.select-cat {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 10px 12px;
  border-radius: 12px;
}

.conquistas-list {
  display: grid;
  gap: 12px;
}
.conquista-row {
  display: grid;
  gap: 12px;
}
.conquista-row.inativa {
  opacity: 0.6;
}
.conquista-row-head {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  gap: 14px;
  align-items: center;
}
.conquista-icone {
  font-size: 36px;
  text-align: center;
  line-height: 1;
}
.conquista-row-info {
  min-width: 0;
}
.conquista-row-actions {
  align-self: start;
}

.tiers-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tier-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.02);
  font-size: 12px;
  font-weight: 600;
}
.tier-emoji {
  font-size: 14px;
}
.tier-meta {
  font-variant-numeric: tabular-nums;
}
.tier-xp {
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 11px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  padding: 20px;
  z-index: 100;
}
.modal {
  width: min(720px, 100%);
  max-height: 90vh;
  overflow-y: auto;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.field.full {
  grid-column: 1 / -1;
}
.field.check label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.tiers-edit {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.tier-edit-row {
  display: grid;
  grid-template-columns: 140px 110px 110px 1fr 40px;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  padding: 8px;
  border: 1px solid var(--border);
  border-left-width: 4px;
  border-radius: 12px;
}
.tier-edit-row > .tier-input.wide:nth-of-type(2),
.tier-edit-row > .tier-upload,
.tier-edit-row > .tier-img-preview {
  grid-column: 1 / -1;
}
.tier-upload {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px dashed var(--border-strong, var(--border));
  border-radius: 10px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
  font-size: 13px;
  user-select: none;
  width: max-content;
}
.tier-upload:hover {
  background: rgba(255, 255, 255, 0.06);
}
.tier-upload.uploading {
  opacity: 0.7;
  pointer-events: none;
}
.tier-img-preview {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.04);
  display: grid;
  place-items: center;
}
.tier-img-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.tier-img-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 11px;
}
.tier-select,
.tier-input {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 10px;
  color: var(--text);
}

[data-theme="light"] .modal-backdrop {
  background: rgba(28, 36, 61, 0.36);
}

[data-theme="light"] .modal.card.glow {
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.98),
      rgba(245, 248, 255, 0.96)
    ),
    linear-gradient(145deg, rgba(109, 92, 255, 0.12), rgba(17, 197, 255, 0.08));
  border-color: rgba(89, 108, 165, 0.24);
  box-shadow: 0 30px 70px rgba(53, 70, 120, 0.22);
}

[data-theme="light"] .modal .field label,
[data-theme="light"] .modal .muted {
  color: #5b678d;
}

[data-theme="light"] .tiers-edit {
  border-top-color: rgba(89, 108, 165, 0.18);
}

[data-theme="light"] .tier-edit-row {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(89, 108, 165, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

[data-theme="light"] .tier-select,
[data-theme="light"] .tier-input,
[data-theme="light"] .tier-edit-row .btn.ghost {
  background: rgba(255, 255, 255, 0.96);
  border-color: rgba(89, 108, 165, 0.22);
}

[data-theme="light"] .tier-select option {
  background: #ffffff;
  color: var(--text);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

@media (max-width: 720px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .tier-edit-row {
    grid-template-columns: 1fr 1fr;
  }
  .tier-edit-row .tier-input.wide {
    grid-column: 1 / -1;
  }
  .conquista-row-head {
    grid-template-columns: 48px 1fr;
  }
  .conquista-row-actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }
}
</style>
