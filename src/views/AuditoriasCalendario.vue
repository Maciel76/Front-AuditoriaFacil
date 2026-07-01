<script setup>
import { computed, onMounted, ref } from "vue";
import api from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import AuditoriaSidebarCalendar from "@/components/AuditoriaSidebarCalendar.vue";
import LoadingOverlay from "@/components/LoadingOverlay.vue";
import { exportarAreaComoImagem, slugArquivo } from "@/utils/captureExport";
import {
  lerLojaDestinoAuditorias,
  salvarLojaDestinoAuditorias,
} from "@/utils/auditoriasContext";

const auth = useAuthStore();

const carregandoLojas = ref(false);
const erroLojas = ref("");
const lojasDisponiveis = ref([]);
const captureArea = ref(null);
const exportando = ref(false);
const lojaSelecionadaId = ref(
  auth.isSuperAdmin ? lerLojaDestinoAuditorias() : auth.loja?._id || "",
);

const lojaSelecionada = computed(
  () =>
    lojasDisponiveis.value.find(
      (loja) => loja._id === lojaSelecionadaId.value,
    ) || null,
);

const nomeLojaAtual = computed(
  () => lojaSelecionada.value?.nome || auth.loja?.nome || "minha-loja",
);

onMounted(async () => {
  if (auth.isSuperAdmin) {
    await carregarLojas();
    return;
  }

  if (auth.loja?._id) {
    lojaSelecionadaId.value = auth.loja._id;
  }
});

async function carregarLojas() {
  carregandoLojas.value = true;
  erroLojas.value = "";

  try {
    const { data } = await api.get("/lojas");
    lojasDisponiveis.value = (data.items || []).filter(
      (loja) => loja.ativa !== false,
    );

    const lojaInicial =
      lojasDisponiveis.value.find(
        (loja) => loja._id === lojaSelecionadaId.value,
      ) ||
      lojasDisponiveis.value[0] ||
      null;

    lojaSelecionadaId.value = lojaInicial?._id || "";
    salvarLojaDestinoAuditorias(lojaSelecionadaId.value);
  } catch (error) {
    erroLojas.value =
      error?.response?.data?.error || "Não foi possível carregar as lojas.";
    lojasDisponiveis.value = [];
    lojaSelecionadaId.value = "";
  } finally {
    carregandoLojas.value = false;
  }
}

function trocarLoja() {
  salvarLojaDestinoAuditorias(lojaSelecionadaId.value);
}

async function compartilhar() {
  if (!captureArea.value || exportando.value) return;

  exportando.value = true;
  try {
    await exportarAreaComoImagem({
      target: captureArea.value,
      filename: `calendario-auditorias-${slugArquivo(nomeLojaAtual.value)}-${new Date().toISOString().slice(0, 10)}.png`,
      buttonSelector: ".audit-calendar-share-btn",
    });
  } finally {
    exportando.value = false;
  }
}
</script>

<template>
  <div ref="captureArea" class="audit-calendar-page">
    <section class="card glow audit-calendar-hero">
      <div class="audit-calendar-hero-grid">
        <div>
          <h2 class="mt-0 mb-1">
            <fa icon="calendar" /> Calendário de auditorias
          </h2>
          <p class="muted mb-0">
            Visualize os 12 meses em cards com datas previstas, planilhas
            enviadas, pendências e auditorias canceladas.
          </p>
        </div>

        <div class="audit-calendar-actions">
          <div
            v-if="auth.isSuperAdmin"
            class="field audit-calendar-store-field"
          >
            <label>Loja do calendário</label>
            <select
              v-model="lojaSelecionadaId"
              class="audit-calendar-store-select"
              :disabled="carregandoLojas || !lojasDisponiveis.length"
              @change="trocarLoja"
            >
              <option value="">
                {{ carregandoLojas ? "Carregando lojas..." : "Escolha uma loja" }}
              </option>
              <option
                v-for="loja in lojasDisponiveis"
                :key="loja._id"
                :value="loja._id"
              >
                {{ loja.nome }}
              </option>
            </select>
            <div v-if="erroLojas" class="muted audit-calendar-store-feedback">
              {{ erroLojas }}
            </div>
          </div>

          <div v-else class="audit-calendar-store-badge">
            <span class="badge dim">
              <fa icon="store" /> {{ auth.loja?.nome || "Minha loja" }}
            </span>
          </div>

          <div class="audit-calendar-share-wrap">
            <button
              class="btn primary audit-calendar-share-btn"
              :disabled="
                exportando ||
                carregandoLojas ||
                (auth.isSuperAdmin && !lojaSelecionadaId)
              "
              :aria-busy="exportando"
              @click="compartilhar"
            >
              <fa icon="share-nodes" />
              Compartilhar
            </button>
          </div>
        </div>
      </div>
    </section>

    <div
      v-if="auth.isSuperAdmin && lojaSelecionada"
      class="audit-calendar-current-store"
    >
      <span class="badge dim">
        <fa icon="store" /> {{ lojaSelecionada.nome }}
      </span>
    </div>

    <AuditoriaSidebarCalendar :loja-id="lojaSelecionadaId" />
  </div>
</template>

<style scoped>
.audit-calendar-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.audit-calendar-hero {
  padding: 20px 22px;
}

.audit-calendar-hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(280px, 360px);
  gap: 18px;
  align-items: end;
}

.audit-calendar-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: stretch;
}

.audit-calendar-hero h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 22px;
}

.audit-calendar-store-field {
  margin-left: 0;
}

.audit-calendar-store-select {
  width: 100%;
}

.audit-calendar-store-feedback {
  margin-top: 6px;
  font-size: 12px;
}

.audit-calendar-store-badge,
.audit-calendar-current-store {
  display: flex;
  justify-content: flex-start;
}

.audit-calendar-share-wrap {
  display: flex;
  justify-content: flex-end;
}

.audit-calendar-page :deep(.audit-calendar) {
  margin-top: 0;
}

@media (max-width: 900px) {
  .audit-calendar-hero {
    padding: 18px;
  }

  .audit-calendar-hero-grid {
    grid-template-columns: 1fr;
  }

  .audit-calendar-share-wrap {
    justify-content: stretch;
  }

  .audit-calendar-share-btn {
    width: 100%;
  }

  .audit-calendar-hero h2 {
    font-size: 19px;
  }
}
</style>
