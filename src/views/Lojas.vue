<script setup>
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import api from "@/services/api";
import Loader from "@/components/Loader.vue";
import { useAuthStore } from "@/stores/auth";
import StoreAvatar from "@/components/StoreAvatar.vue";

const auth = useAuthStore();
const carregando = ref(true);
const busca = ref("");
const items = ref([]);

function normalizar(valor = "") {
  return valor
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function metasResumo(loja) {
  return [
    `Etiqueta ${Math.round(loja?.metas?.conformidadeEtiqueta ?? 95)}%`,
    `Presença ${Math.round(loja?.metas?.conformidadePresenca ?? 90)}%`,
    `Ruptura ${Math.round(loja?.metas?.conformidadeRuptura ?? 95)}%`,
  ].join(" · ");
}

async function carregar() {
  carregando.value = true;
  try {
    const { data } = await api.get("/lojas/catalogo");
    items.value = data.items || [];
  } finally {
    carregando.value = false;
  }
}

onMounted(carregar);

const lojasFiltradas = computed(() => {
  const termo = normalizar(busca.value);
  return [...items.value]
    .filter((item) => {
      if (!termo) return true;
      const alvo = normalizar(
        [item.nome, item.slug, item.codigo, item.cidade, item.estado]
          .filter(Boolean)
          .join(" "),
      );
      return alvo.includes(termo);
    })
    .sort((a, b) => {
      const aPropria = String(a._id) === String(auth.loja?._id || "");
      const bPropria = String(b._id) === String(auth.loja?._id || "");
      if (aPropria !== bPropria) return aPropria ? -1 : 1;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
});
</script>

<template>
  <div class="stores-shell">
    <div class="row stores-toolbar">
      <div>
        <h3 class="mt-0 mb-0">Catálogo de lojas</h3>
        <p class="muted stores-copy">
          Abra o perfil de qualquer loja para comparar desempenho, metas e
          histórico recente.
        </p>
      </div>
      <span class="spacer" />
      <input
        v-model="busca"
        class="stores-search"
        placeholder="Buscar por nome, código, cidade ou slug"
      />
      <RouterLink v-if="auth.isSuperAdmin" to="/admin/lojas" class="btn ghost">
        <fa icon="gear" /> Administração
      </RouterLink>
    </div>

    <Loader v-if="carregando" />

    <div v-else-if="!lojasFiltradas.length" class="empty">
      Nenhuma loja encontrada para o filtro informado.
    </div>

    <div v-else class="stores-grid">
      <RouterLink
        v-for="loja in lojasFiltradas"
        :key="loja._id"
        :to="`/lojas/${loja._id}`"
        class="card store-card glow"
      >
        <div class="row store-card-head">
          <StoreAvatar
            :nome="loja.nome"
            :avatar-url="loja.avatarUrl"
            :size="52"
            :font-size="18"
            class="store-card-avatar"
          />

          <div style="flex: 1; min-width: 0">
            <div class="store-card-title">{{ loja.nome }}</div>
            <div class="muted store-card-subtitle">
              {{
                [loja.cidade, loja.estado].filter(Boolean).join(" / ") ||
                "Local não informado"
              }}
            </div>
          </div>

          <span
            v-if="String(loja._id) === String(auth.loja?._id || '')"
            class="badge ok"
            >Sua loja</span
          >
        </div>

        <div class="store-card-meta">
          <span class="badge dim">#{{ loja.slug }}</span>
          <span v-if="loja.codigo" class="badge dim"
            >Código {{ loja.codigo }}</span
          >
          <span class="badge info">Nível {{ loja.nivel || 1 }}</span>
        </div>

        <div class="store-card-stats">
          <div>
            <span class="muted">Pontuação acumulada</span>
            <strong>{{
              Math.round(loja.pontuacao || 0).toLocaleString("pt-BR")
            }}</strong>
          </div>
          <div>
            <span class="muted">Metas base</span>
            <strong>{{ metasResumo(loja) }}</strong>
          </div>
        </div>

        <div class="row store-card-footer">
          <span class="muted">Ver perfil analítico</span>
          <span class="spacer" />
          <fa icon="chevron-right" />
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.stores-shell {
  display: grid;
  gap: 18px;
}

.stores-toolbar {
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.stores-copy {
  margin: 6px 0 0;
  max-width: 620px;
}

.stores-search {
  min-width: min(100%, 320px);
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  color: var(--text);
}

.stores-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.store-card {
  display: grid;
  gap: 16px;
  color: inherit;
  text-decoration: none;
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease;
}

.store-card:hover,
.store-card:focus-visible {
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
  border-color: var(--border-strong);
}

.store-card-avatar {
  width: 52px;
  height: 52px;
  font-weight: 700;
}

.store-card-head {
  align-items: flex-start;
}

.store-card-title {
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.store-card-subtitle {
  font-size: 13px;
  margin-top: 4px;
}

.store-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.store-card-stats {
  display: grid;
  gap: 12px;
}

.store-card-stats > div {
  display: grid;
  gap: 4px;
}

.store-card-stats strong {
  font-size: 14px;
}

.store-card-footer {
  align-items: center;
  color: var(--text-dim);
}

@media (max-width: 720px) {
  .stores-search {
    width: 100%;
  }
}
</style>
