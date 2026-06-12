<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import api from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import {
  AUDITORIAS_LOJA_DESTINO_EVENT,
  lerLojaDestinoAuditorias,
} from "@/utils/auditoriasContext";

const props = defineProps({
  lojaId: {
    type: String,
    default: "",
  },
});

const auth = useAuthStore();

const ANO_ATUAL = new Date().getFullYear();
const HOJE_CHAVE = formatarChaveLocal(new Date());
const LIMIT_POR_PAGINA = 200;
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const COLUNAS = [
  { label: "Seg", tipo: "ETIQUETA", resumo: "Etiq." },
  { label: "Ter", tipo: "PRESENCA", resumo: "Pres." },
  { label: "Qua", tipo: "RUPTURA", resumo: "Rupt." },
  { label: "Qui", tipo: "ETIQUETA", resumo: "Etiq." },
];
const TIPO_LABEL = {
  ETIQUETA: "Etiqueta",
  PRESENCA: "Presença",
  RUPTURA: "Ruptura",
};

const carregando = ref(false);
const erro = ref("");
const auditoriasAno = ref([]);
const lojaSuperAdminId = ref(
  auth.isSuperAdmin ? lerLojaDestinoAuditorias() : "",
);

let requisicaoAtual = 0;

const lojaEscopoId = computed(() => {
  if (props.lojaId) return props.lojaId;
  if (auth.isSuperAdmin) return lojaSuperAdminId.value;
  return auth.loja?._id || "";
});

const precisaEscolherLoja = computed(
  () => auth.isSuperAdmin && !lojaEscopoId.value,
);

const mapaAuditorias = computed(() => {
  const mapa = new Map();
  for (const auditoria of auditoriasAno.value) {
    const chaveData = extrairChaveData(auditoria?.data);
    if (!chaveData || !auditoria?.tipo) continue;
    mapa.set(`${chaveData}:${auditoria.tipo}`, auditoria);
  }
  return mapa;
});

const mesesCalendario = computed(() =>
  MESES.map((nome, indiceMes) => {
    const semanas = new Map();
    const ultimoDia = new Date(ANO_ATUAL, indiceMes + 1, 0).getDate();

    for (let dia = 1; dia <= ultimoDia; dia += 1) {
      const data = new Date(ANO_ATUAL, indiceMes, dia);
      const tipo = tipoProgramado(data.getDay());
      if (!tipo) continue;

      const chaveData = formatarChaveLocal(data);
      const auditoria =
        mapaAuditorias.value.get(`${chaveData}:${tipo}`) || null;
      const status = resolverStatusDia(chaveData, auditoria);
      const chaveSemana = formatarChaveLocal(inicioDaSemana(data));

      if (!semanas.has(chaveSemana)) {
        semanas.set(chaveSemana, [null, null, null, null]);
      }

      semanas.get(chaveSemana)[colunaDia(data.getDay())] = {
        chave: chaveData,
        dia,
        tipo,
        status,
        descricao: descreverStatus(status, auditoria),
        tooltip: montarTooltip(chaveData, tipo, status, auditoria),
      };
    }

    return {
      nome,
      semanas: [...semanas.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([chave, dias]) => ({ chave, dias })),
    };
  }),
);

const resumo = computed(() => {
  const totais = {
    uploaded: 0,
    pending: 0,
    canceled: 0,
    upcoming: 0,
  };

  for (const mes of mesesCalendario.value) {
    for (const semana of mes.semanas) {
      for (const dia of semana.dias) {
        if (!dia) continue;
        if (dia.status === "uploaded") totais.uploaded += 1;
        else if (dia.status === "canceled") totais.canceled += 1;
        else if (dia.status === "upcoming") totais.upcoming += 1;
        else totais.pending += 1;
      }
    }
  }

  return totais;
});

watch(
  lojaEscopoId,
  () => {
    void carregarAuditoriasAno();
  },
  { immediate: true },
);

onMounted(() => {
  if (props.lojaId) return;
  window.addEventListener(
    AUDITORIAS_LOJA_DESTINO_EVENT,
    sincronizarLojaSuperAdmin,
  );
});

onBeforeUnmount(() => {
  if (props.lojaId) return;
  window.removeEventListener(
    AUDITORIAS_LOJA_DESTINO_EVENT,
    sincronizarLojaSuperAdmin,
  );
});

function sincronizarLojaSuperAdmin(event) {
  lojaSuperAdminId.value =
    event?.detail?.lojaId || lerLojaDestinoAuditorias() || "";
}

async function carregarAuditoriasAno() {
  const lojaId = lojaEscopoId.value;
  const token = ++requisicaoAtual;

  if (!lojaId) {
    auditoriasAno.value = [];
    erro.value = "";
    carregando.value = false;
    return;
  }

  carregando.value = true;
  erro.value = "";

  try {
    const acumulado = [];
    let total = Number.POSITIVE_INFINITY;
    let page = 1;

    while (acumulado.length < total) {
      const params = {
        dataInicio: `${ANO_ATUAL}-01-01`,
        dataFim: `${ANO_ATUAL}-12-31`,
        limit: LIMIT_POR_PAGINA,
        page,
        includeExcluidas: true,
      };

      if (auth.isSuperAdmin) params.lojaId = lojaId;

      const { data } = await api.get("/auditorias", { params });

      if (token !== requisicaoAtual) return;

      const items = Array.isArray(data?.items) ? data.items : [];
      total = Number(data?.total || items.length || 0);
      acumulado.push(...items);

      if (!items.length || items.length < LIMIT_POR_PAGINA) break;
      page += 1;
    }

    auditoriasAno.value = acumulado;
  } catch (error) {
    if (token !== requisicaoAtual) return;
    auditoriasAno.value = [];
    erro.value =
      error?.response?.data?.error ||
      "Não foi possível carregar o calendário de auditorias.";
  } finally {
    if (token === requisicaoAtual) carregando.value = false;
  }
}

function tipoProgramado(diaSemana) {
  if (diaSemana === 1 || diaSemana === 4) return "ETIQUETA";
  if (diaSemana === 2) return "PRESENCA";
  if (diaSemana === 3) return "RUPTURA";
  return "";
}

function colunaDia(diaSemana) {
  return Math.max(0, diaSemana - 1);
}

function inicioDaSemana(data) {
  const inicio = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  inicio.setDate(inicio.getDate() - (inicio.getDay() - 1));
  return inicio;
}

function resolverStatusDia(chaveData, auditoria) {
  if (auditoria?.status === "CANCELADA") return "canceled";
  if (auditoria?.status && auditoria.status !== "ERRO") return "uploaded";
  if (chaveData > HOJE_CHAVE) return "upcoming";
  return auditoria?.status === "ERRO" ? "error" : "pending";
}

function descreverStatus(status, auditoria) {
  if (status === "canceled") return "Cancelada";
  if (status === "uploaded") {
    if (auditoria?.status === "PROCESSANDO") return "Processando";
    return "Realizada";
  }
  if (status === "error") return "Falha";
  if (status === "upcoming") return "Programada";
  return "Pendente";
}

function montarTooltip(chaveData, tipo, status, auditoria) {
  const partes = [
    formatarDataPtBr(chaveData),
    TIPO_LABEL[tipo] || tipo,
    descreverStatus(status, auditoria),
  ];

  if (status === "canceled" && auditoria?.motivoCancelamento) {
    partes.push(auditoria.motivoCancelamento);
  }

  return partes.join(" • ");
}

function extrairChaveData(valor) {
  if (!valor) return "";
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
    return valor.slice(0, 10);
  }
  return formatarChaveLocal(new Date(valor));
}

function formatarChaveLocal(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function formatarDataPtBr(chaveData) {
  const [ano, mes, dia] = String(chaveData || "").split("-");
  if (!ano || !mes || !dia) return "";
  return `${dia}/${mes}/${ano}`;
}
</script>

<template>
  <section class="audit-calendar card glow">
    <div class="audit-calendar-head">
      <div>
        <strong>Calendário anual de Auditorias</strong>
        <p>{{ ANO_ATUAL }} · auditorias esperadas</p>
      </div>
      <span class="badge dim">12 meses</span>
    </div>

    <div v-if="precisaEscolherLoja" class="audit-calendar-empty">
      Escolha a loja na tela de auditorias para montar o calendário do ano.
    </div>

    <div v-else-if="erro" class="audit-calendar-empty is-error">
      {{ erro }}
    </div>

    <div v-else class="audit-calendar-body">
      <div class="audit-calendar-resumo">
        <div class="audit-calendar-stat uploaded">
          <strong>{{ resumo.uploaded }}</strong>
          <span>Enviadas</span>
        </div>
        <div class="audit-calendar-stat pending">
          <strong>{{ resumo.pending }}</strong>
          <span>Pendentes</span>
        </div>
        <div class="audit-calendar-stat canceled">
          <strong>{{ resumo.canceled }}</strong>
          <span>Canceladas</span>
        </div>
      </div>

      <div class="audit-calendar-legend">
        <span><i class="uploaded"></i> Realizada</span>
        <span><i class="pending"></i> Pendente</span>
        <span><i class="canceled"></i> Cancelada</span>
        <span><i class="upcoming"></i> Programada</span>
      </div>

      <div v-if="carregando" class="audit-calendar-loading">
        Carregando datas do ano…
      </div>

      <div v-else class="audit-calendar-months">
        <section
          v-for="mes in mesesCalendario"
          :key="mes.nome"
          class="audit-calendar-month"
        >
          <header>
            <strong>{{ mes.nome }}</strong>
          </header>

          <div class="audit-calendar-grid audit-calendar-grid-head">
            <div
              v-for="coluna in COLUNAS"
              :key="coluna.label"
              class="head-cell"
            >
              <span>{{ coluna.label }}</span>
              <small>{{ coluna.resumo }}</small>
            </div>
          </div>

          <div
            v-for="semana in mes.semanas"
            :key="semana.chave"
            class="audit-calendar-grid"
          >
            <div
              v-for="(dia, indice) in semana.dias"
              :key="dia?.chave || `${semana.chave}-${indice}`"
              class="day-cell"
              :class="dia ? [dia.status, 'tipo-' + dia.tipo] : 'empty'"
              :title="dia?.tooltip || ''"
            >
              <template v-if="dia">
                <strong>{{ dia.dia }}</strong>
                <small>{{ dia.descricao }}</small>
              </template>
            </div>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.audit-calendar {
  margin-top: 12px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid var(--border);
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.05),
      rgba(255, 255, 255, 0.02)
    ),
    var(--surface);
}

.audit-calendar-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.audit-calendar-head p {
  margin: 4px 0 0;
  color: var(--text-dim);
  font-size: 12px;
}

.audit-calendar-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
}

.audit-calendar-resumo {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.audit-calendar-stat {
  padding: 10px 8px;
  border-radius: 12px;
  border: 1px solid var(--border);
  text-align: center;
  background: rgba(255, 255, 255, 0.04);
}

.audit-calendar-stat strong {
  display: block;
  font-size: 18px;
}

.audit-calendar-stat span {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-dim);
}

.audit-calendar-stat.uploaded {
  border-color: rgba(34, 197, 94, 0.22);
}

.audit-calendar-stat.pending {
  border-color: rgba(245, 158, 11, 0.22);
}

.audit-calendar-stat.canceled {
  border-color: rgba(239, 68, 68, 0.22);
}

.audit-calendar-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  font-size: 11px;
  color: var(--text-dim);
}

.audit-calendar-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.audit-calendar-legend i {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  display: inline-block;
  border: 1px solid transparent;
}

.audit-calendar-legend .uploaded {
  background: rgba(34, 197, 94, 0.92);
}

.audit-calendar-legend .pending {
  background: transparent;
  border-color: var(--border-strong);
}

.audit-calendar-legend .canceled {
  background: rgba(239, 68, 68, 0.92);
}

.audit-calendar-legend .upcoming {
  background: rgba(148, 163, 184, 0.18);
  border-color: rgba(148, 163, 184, 0.28);
}

.audit-calendar-loading,
.audit-calendar-empty {
  padding: 12px;
  border-radius: 14px;
  border: 1px dashed var(--border-strong);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-dim);
  font-size: 13px;
}

.audit-calendar-empty.is-error {
  border-color: rgba(239, 68, 68, 0.34);
  color: #fca5a5;
}

.audit-calendar-months {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.audit-calendar-month {
  padding: 10px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.03);
  min-height: 100%;
}

.audit-calendar-month header {
  margin-bottom: 8px;
}

.audit-calendar-month header strong {
  font-size: 13px;
}

.audit-calendar-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin-top: 6px;
}

.head-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding-bottom: 4px;
  color: var(--text-dim);
}

.head-cell span {
  font-size: 11px;
  font-weight: 600;
}

.head-cell small {
  font-size: 10px;
  color: var(--text-mute);
}

.day-cell {
  min-height: 40px;
  padding: 6px 4px;
  border-radius: 12px;
  border: 1px solid transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  position: relative;
  overflow: hidden;
}

.day-cell::after {
  content: "";
  position: absolute;
  inset: auto 5px 4px;
  height: 3px;
  border-radius: 999px;
  opacity: 0.75;
}

.day-cell strong {
  font-size: 13px;
  line-height: 1;
}

.day-cell small {
  font-size: 9px;
  color: inherit;
  opacity: 0.88;
}

.day-cell.tipo-ETIQUETA::after {
  background: rgba(124, 92, 255, 0.88);
}

.day-cell.tipo-PRESENCA::after {
  background: rgba(34, 211, 238, 0.88);
}

.day-cell.tipo-RUPTURA::after {
  background: rgba(249, 115, 22, 0.92);
}

.day-cell.uploaded {
  background: rgba(34, 197, 94, 0.14);
  border-color: rgba(34, 197, 94, 0.46);
  color: #d3ffe2;
}

.day-cell.pending,
.day-cell.error {
  background: transparent;
  border-color: var(--border);
  color: var(--text-dim);
}

.day-cell.error {
  background: rgba(239, 68, 68, 0.14);
  border-color: rgba(239, 68, 68, 0.4);
  color: #ffd1d1;
}

.day-cell.canceled {
  background: rgba(239, 68, 68, 0.16);
  border-color: rgba(239, 68, 68, 0.5);
  color: #ffd3d3;
}

.day-cell.upcoming {
  background: rgba(148, 163, 184, 0.08);
  border-color: rgba(148, 163, 184, 0.18);
  color: var(--text-dim);
}

.day-cell.empty {
  min-height: 20px;
  background: transparent;
}

[data-theme="light"] .audit-calendar {
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.92),
      rgba(248, 251, 255, 0.9)
    ),
    var(--surface);
}

[data-theme="light"] .audit-calendar-loading,
[data-theme="light"] .audit-calendar-empty,
[data-theme="light"] .audit-calendar-month,
[data-theme="light"] .audit-calendar-stat {
  background: rgba(255, 255, 255, 0.86);
}

[data-theme="light"] .day-cell.uploaded {
  color: #0b6a34;
}

[data-theme="light"] .day-cell.pending {
  color: var(--text-dim);
}

[data-theme="light"] .day-cell.error,
[data-theme="light"] .day-cell.canceled {
  color: #a11d1d;
}

@media (max-width: 900px) {
  .audit-calendar {
    margin-top: 8px;
  }

  .audit-calendar-months {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .audit-calendar-months {
    grid-template-columns: 1fr;
  }
}
</style>
