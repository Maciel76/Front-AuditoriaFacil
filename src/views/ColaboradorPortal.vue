<script setup>
/**
 * Portal self-service do colaborador.
 * Acesso: /portal
 * Fluxo:
 *  1. Usuário informa matrícula
 *  2. Sistema localiza as lojas em que essa matrícula possui dados
 *  3. Usuário escolhe a loja desejada
 *  4. Primeiro acesso → define senha
 *  5. Login → JWT de colaborador → exibe perfil completo
 */
import Cropper from "cropperjs";
import { ref, computed, nextTick, onBeforeUnmount, onMounted } from "vue";
import { useRoute } from "vue-router";
import api from "@/services/api";
import AppChart from "@/components/AppChart.vue";
import StoreAvatar from "@/components/StoreAvatar.vue";

const route = useRoute();

// ---- Estado de autenticação do portal ----
const lojaPreferencial = ref(String(route.query.loja || "").trim());
const lojaSlug = ref("");
const lojaSelecionada = ref(null);
const lojasDisponiveis = ref([]);
const matricula = ref("");
const senha = ref("");
const senhaConfirm = ref("");
const etapa = ref("buscar"); // buscar | selecionar | setup | login | portal
const primeiroNome = ref("");
const carregando = ref(false);
const erro = ref("");
const token = ref(localStorage.getItem("na_portal_token") || "");
const temaPortal = ref(localStorage.getItem("na_portal_tema") || "light");

// ---- Dados do perfil ----
const perfil = ref(null);
const metricas = ref(null);
const avatarInput = ref(null);
const enviandoAvatar = ref(false);
const cropperImage = ref("");
const cropperAberto = ref(false);
const cropperImageRef = ref(null);
const cropperNomeArquivo = ref("");
const alterandoSenha = ref(false);
const senhaAtualConta = ref("");
const novaSenhaConta = ref("");
const confirmarNovaSenhaConta = ref("");
const erroConfig = ref("");
const sucessoConfig = ref("");

let cropper;
let temaAnterior = "";

function apiPortal() {
  return {
    get: (url, cfg) =>
      api.request({
        method: "get",
        url,
        ...cfg,
        headers: { Authorization: `Bearer ${token.value}` },
      }),
    post: (url, d, cfg) =>
      api.request({
        method: "post",
        url,
        data: d,
        ...cfg,
        headers: { ...cfg?.headers, Authorization: `Bearer ${token.value}` },
      }),
  };
}

function aplicarTemaPortal(tema) {
  temaPortal.value = tema;
  localStorage.setItem("na_portal_tema", tema);
  document.documentElement.setAttribute("data-theme", tema);
}

function limparMensagensConfig() {
  erroConfig.value = "";
  sucessoConfig.value = "";
}

function limparFormularioSenha() {
  senha.value = "";
  senhaConfirm.value = "";
  erro.value = "";
}

function localidadeLoja(loja) {
  return [loja?.cidade, loja?.estado].filter(Boolean).join(" / ");
}

function ordenarLojas(lojas) {
  const preferencial = lojaPreferencial.value;
  return [...lojas].sort((a, b) => {
    const aPreferida = !!preferencial && a.slug === preferencial;
    const bPreferida = !!preferencial && b.slug === preferencial;
    if (aPreferida !== bPreferida) return aPreferida ? -1 : 1;
    return a.nomeLoja.localeCompare(b.nomeLoja, "pt-BR");
  });
}

function selecionarLoja(loja) {
  lojaSelecionada.value = loja;
  lojaSlug.value = loja.slug;
  primeiroNome.value = loja.primeiroNome || loja.nome?.split(" ")[0] || "";
  limparFormularioSenha();
  etapa.value = loja.primeiroAcesso ? "setup" : "login";
}

function voltarParaBusca() {
  lojaSlug.value = "";
  lojaSelecionada.value = null;
  lojasDisponiveis.value = [];
  matricula.value = "";
  primeiroNome.value = "";
  perfil.value = null;
  metricas.value = null;
  limparFormularioSenha();
  etapa.value = "buscar";
}

function voltarParaSelecao() {
  limparFormularioSenha();
  etapa.value = "selecionar";
}

// ---- Verificar matrícula ----
async function verificar() {
  if (!matricula.value.trim()) {
    erro.value = "Informe sua matrícula.";
    return;
  }
  carregando.value = true;
  erro.value = "";
  lojasDisponiveis.value = [];
  lojaSelecionada.value = null;
  lojaSlug.value = "";
  try {
    const { data } = await api.get("/auth/portal/verificar", {
      params: { matricula: matricula.value.trim() },
    });
    lojasDisponiveis.value = ordenarLojas(data.lojas || []);
    primeiroNome.value =
      data.nome || lojasDisponiveis.value[0]?.primeiroNome || "";
    etapa.value = "selecionar";
  } catch (e) {
    erro.value = e?.response?.data?.error || "Matrícula não encontrada.";
  } finally {
    carregando.value = false;
  }
}

// ---- Primeiro acesso: definir senha ----
async function configurarSenha() {
  if (!lojaSlug.value.trim()) {
    erro.value = "Selecione uma loja para continuar.";
    return;
  }
  if (senha.value.length < 6) {
    erro.value = "Mínimo de 6 caracteres.";
    return;
  }
  if (senha.value !== senhaConfirm.value) {
    erro.value = "As senhas não coincidem.";
    return;
  }
  carregando.value = true;
  erro.value = "";
  try {
    const { data } = await api.post("/auth/portal/setup", {
      matricula: matricula.value.trim(),
      lojaSlug: lojaSlug.value.trim(),
      senha: senha.value,
    });
    token.value = data.token;
    localStorage.setItem("na_portal_token", data.token);
    await carregarPerfil();
    etapa.value = "portal";
  } catch (e) {
    erro.value = e?.response?.data?.error || "Erro ao configurar senha.";
  } finally {
    carregando.value = false;
  }
}

// ---- Login ----
async function login() {
  if (!lojaSlug.value.trim()) {
    erro.value = "Selecione uma loja para continuar.";
    return;
  }
  if (!senha.value) {
    erro.value = "Informe a senha.";
    return;
  }
  carregando.value = true;
  erro.value = "";
  try {
    const { data } = await api.post("/auth/portal/login", {
      matricula: matricula.value.trim(),
      lojaSlug: lojaSlug.value.trim(),
      senha: senha.value,
    });
    token.value = data.token;
    localStorage.setItem("na_portal_token", data.token);
    await carregarPerfil();
    etapa.value = "portal";
  } catch (e) {
    erro.value = e?.response?.data?.error || "Credenciais inválidas.";
  } finally {
    carregando.value = false;
  }
}

// ---- Carregar perfil ----
async function carregarPerfil() {
  const { data: perfilData } = await apiPortal().get(
    "/colaboradores/portal/me",
  );
  perfil.value = perfilData;
  primeiroNome.value = perfilData.nome?.split(" ")[0] || "";

  if (perfilData.loja) {
    lojaSelecionada.value = {
      slug: perfilData.loja.slug,
      nomeLoja: perfilData.loja.nome,
      cidade: perfilData.loja.cidade || lojaSelecionada.value?.cidade || "",
      estado: perfilData.loja.estado || lojaSelecionada.value?.estado || "",
      avatarUrl:
        perfilData.loja.avatarUrl || lojaSelecionada.value?.avatarUrl || "",
      primeiroAcesso: false,
      nome: perfilData.nome,
      primeiroNome: perfilData.nome?.split(" ")[0] || "",
    };
    lojaSlug.value = perfilData.loja.slug;
  }

  const { data } = await apiPortal().get("/metricas/portal/me?periodo=tudo");
  metricas.value = data;
}

function sair() {
  token.value = "";
  localStorage.removeItem("na_portal_token");
  voltarParaBusca();
}

// Avatar
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
    aspectRatio: 1,
    viewMode: 1,
    dragMode: "move",
    autoCropArea: 0.92,
    background: false,
    guides: false,
    center: true,
    highlight: false,
    responsive: true,
  });
}

function fecharCropper() {
  cropperAberto.value = false;
  cropperNomeArquivo.value = "";
  destruirCropper();
}

function resetarCropper() {
  cropper?.reset();
}

async function enviarAvatar(e) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file || !perfil.value) return;
  limparMensagensConfig();
  cropperNomeArquivo.value = file.name;
  cropperImage.value = URL.createObjectURL(file);
  cropperAberto.value = true;
  await iniciarCropper();
}

async function confirmarCropAvatar() {
  if (!perfil.value || !cropper) return;
  limparMensagensConfig();
  enviandoAvatar.value = true;

  try {
    const canvas = cropper.getCroppedCanvas({
      width: 640,
      height: 640,
      fillColor: "#ffffff",
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    });

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) throw new Error("Não foi possível recortar a imagem");

    const fd = new FormData();
    fd.append(
      "avatar",
      new File([blob], `avatar-${perfil.value._id}.jpg`, {
        type: "image/jpeg",
      }),
    );

    const res = await apiPortal().post(
      `/colaboradores/${perfil.value._id}/avatar`,
      fd,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );

    perfil.value.avatarUrl = res.data.avatarUrl;
    sucessoConfig.value = "Foto atualizada com sucesso.";
    fecharCropper();
  } catch (e) {
    erroConfig.value =
      e?.response?.data?.error || e?.message || "Erro ao atualizar a foto.";
  } finally {
    enviandoAvatar.value = false;
  }
}

async function alterarSenhaConta() {
  limparMensagensConfig();
  if (!senhaAtualConta.value) {
    erroConfig.value = "Informe sua senha atual.";
    return;
  }
  if (novaSenhaConta.value.length < 6) {
    erroConfig.value = "A nova senha deve ter no mínimo 6 caracteres.";
    return;
  }
  if (novaSenhaConta.value !== confirmarNovaSenhaConta.value) {
    erroConfig.value = "A confirmação da nova senha não confere.";
    return;
  }

  alterandoSenha.value = true;
  try {
    await apiPortal().post("/colaboradores/portal/password", {
      senhaAtual: senhaAtualConta.value,
      novaSenha: novaSenhaConta.value,
    });
    senhaAtualConta.value = "";
    novaSenhaConta.value = "";
    confirmarNovaSenhaConta.value = "";
    sucessoConfig.value = "Senha atualizada com sucesso.";
  } catch (e) {
    erroConfig.value =
      e?.response?.data?.error || "Não foi possível atualizar sua senha.";
  } finally {
    alterandoSenha.value = false;
  }
}

// --- Conquistas emojis ---
const conquistaIco = {
  PRIMEIRA_AUDITORIA: "🏁",
  CEM_LIDOS: "💯",
  MIL_LIDOS: "🔢",
  DEZ_MIL_LIDOS: "⭐",
  CONFORMIDADE_95: "🥇",
  NIVEL_5: "🎖️",
};

// --- Charts ---
const corPorTipo = {
  ETIQUETA: "#7c5cff",
  PRESENCA: "#22d3ee",
  RUPTURA: "#f59e0b",
};
const serieComoColunas = computed(
  () => (metricas.value?.serie?.length || 0) <= 12,
);
const serieChart = computed(() => {
  const m = metricas.value;
  if (!m?.serie?.length) return { labels: [], datasets: [] };
  const dias = [...new Set(m.serie.map((x) => x._id.dia))].sort();
  const tipos = ["ETIQUETA", "PRESENCA", "RUPTURA"];
  return {
    labels: dias.map((d) => d.slice(5)),
    datasets: tipos.map((t) => {
      const map = new Map();
      m.serie
        .filter((x) => x._id.tipo === t)
        .forEach((x) => map.set(x._id.dia, x.totalLidos));

      if (serieComoColunas.value) {
        return {
          label: t,
          data: dias.map((d) => map.get(d) ?? 0),
          backgroundColor: corPorTipo[t],
          borderColor: corPorTipo[t],
          borderRadius: 12,
          borderSkipped: false,
          maxBarThickness: 34,
        };
      }

      return {
        label: t,
        data: dias.map((d) => map.get(d) ?? null),
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
        label: (context) =>
          `${context.dataset.label}: ${Number(context.raw ?? context.parsed?.y ?? 0).toLocaleString("pt-BR")} itens`,
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

// Restaurar sessão ao carregar
onMounted(async () => {
  temaAnterior =
    document.documentElement.getAttribute("data-theme") ||
    localStorage.getItem("na_tema") ||
    "dark";
  aplicarTemaPortal(localStorage.getItem("na_portal_tema") || "light");

  if (token.value) {
    try {
      await carregarPerfil();
      etapa.value = "portal";
    } catch {
      sair();
    }
  }
});

onBeforeUnmount(() => {
  destruirCropper();
  document.documentElement.setAttribute(
    "data-theme",
    localStorage.getItem("na_tema") || temaAnterior || "dark",
  );
});

const iniciais = computed(() => {
  const n = perfil.value?.nome || "?";
  return n
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("");
});

const resumoLojaSelecionada = computed(() => {
  if (!lojaSelecionada.value) return "";
  const local = localidadeLoja(lojaSelecionada.value);
  return [lojaSelecionada.value.nomeLoja, local].filter(Boolean).join(" · ");
});

const nivel = computed(() => perfil.value?.nivel || 1);
const pontuacaoProxNivel = computed(() => nivel.value * 500);
const pctNivel = computed(() => {
  const pts = perfil.value?.pontuacao || 0;
  const base = (nivel.value - 1) * 500;
  return Math.min(100, ((pts - base) / 500) * 100);
});
</script>

<template>
  <div class="portal-shell">
    <!-- ======= HEADER DO PORTAL ======= -->
    <header class="portal-header">
      <div class="portal-brand">
        <div class="brand-mark"><fa icon="bolt" /></div>
        <span class="brand-name"
          >NovaAuditoria <small>Portal do Colaborador</small></span
        >
      </div>
      <button v-if="etapa === 'portal'" class="btn ghost" @click="sair">
        <fa icon="right-from-bracket" /> Sair
      </button>
    </header>

    <!-- ======= ETAPA: BUSCAR MATRÍCULA ======= -->
    <div v-if="etapa === 'buscar'" class="portal-card">
      <div class="center mb-4">
        <div class="brand-mark big"><fa icon="id-badge" /></div>
      </div>
      <h2 style="text-align: center; margin: 0 0 6px">Acesse seu perfil</h2>
      <p
        class="muted"
        style="text-align: center; font-size: 14px; margin: 0 0 24px"
      >
        Informe sua matrícula para localizar as lojas em que você possui
        auditorias.
      </p>
      <div class="grid gap-3">
        <div class="field">
          <label>Matrícula</label>
          <input
            v-model="matricula"
            placeholder="ex.: 2692473"
            @keyup.enter="verificar"
          />
        </div>
        <div
          v-if="erro"
          class="badge bad"
          style="width: 100%; justify-content: center"
        >
          {{ erro }}
        </div>
        <button
          class="btn primary"
          :disabled="carregando"
          @click="verificar"
          style="width: 100%"
        >
          <fa
            :icon="carregando ? 'spinner' : 'arrow-right'"
            :spin="carregando"
          />
          Ver minhas lojas
        </button>
      </div>
    </div>

    <!-- ======= ETAPA: ESCOLHER LOJA ======= -->
    <div
      v-else-if="etapa === 'selecionar'"
      class="portal-card portal-card-wide"
    >
      <div class="center mb-4">
        <div class="brand-mark big"><fa icon="store" /></div>
      </div>
      <h2 style="text-align: center; margin: 0 0 6px">Escolha a loja</h2>
      <p
        class="muted"
        style="text-align: center; font-size: 14px; margin: 0 0 24px"
      >
        {{ primeiroNome }}, encontramos {{ lojasDisponiveis.length }}
        {{ lojasDisponiveis.length === 1 ? "loja" : "lojas" }} para a matrícula
        {{ matricula }}.
      </p>
      <div class="store-options">
        <button
          v-for="loja in lojasDisponiveis"
          :key="loja.slug"
          class="store-option"
          :class="{ preferred: loja.slug === lojaPreferencial }"
          @click="selecionarLoja(loja)"
        >
          <div class="store-option-main">
            <StoreAvatar
              :nome="loja.nomeLoja"
              :avatar-url="loja.avatarUrl"
              :size="42"
              :font-size="15"
              class="store-option-icon"
            />
            <div class="store-option-copy">
              <strong>{{ loja.nomeLoja }}</strong>
              <span class="muted">{{
                localidadeLoja(loja) || "Loja disponível no portal"
              }}</span>
              <div class="row gap-1" style="margin-top: 6px">
                <span
                  class="badge"
                  :class="loja.primeiroAcesso ? 'warn' : 'info'"
                >
                  {{
                    loja.primeiroAcesso
                      ? "Primeiro acesso"
                      : "Senha já cadastrada"
                  }}
                </span>
                <span v-if="loja.slug === lojaPreferencial" class="badge dim"
                  >link atual</span
                >
              </div>
            </div>
          </div>
          <div class="store-option-meta">
            <fa icon="chevron-right" />
          </div>
        </button>
      </div>
      <button
        class="btn ghost"
        @click="voltarParaBusca"
        style="width: 100%; margin-top: 16px"
      >
        Informar outra matrícula
      </button>
    </div>

    <!-- ======= ETAPA: PRIMEIRO ACESSO ======= -->
    <div v-else-if="etapa === 'setup'" class="portal-card">
      <div v-if="lojaSelecionada" class="selected-store">
        <div class="selected-store-chip">
          <StoreAvatar
            :nome="lojaSelecionada.nomeLoja"
            :avatar-url="lojaSelecionada.avatarUrl"
            :size="28"
            :font-size="11"
          />
          <span class="badge info">{{ lojaSelecionada.nomeLoja }}</span>
        </div>
        <span class="muted" style="font-size: 12px">{{
          resumoLojaSelecionada
        }}</span>
      </div>
      <h2 style="margin: 0 0 4px">Olá, {{ primeiroNome }}!</h2>
      <p class="muted" style="font-size: 14px; margin: 0 0 24px">
        Defina sua senha para acessar o portal.
      </p>
      <div class="grid gap-3">
        <div class="field">
          <label>Nova senha (mínimo 6 caracteres)</label>
          <input
            type="password"
            v-model="senha"
            placeholder="••••••"
            @keyup.enter="configurarSenha"
          />
        </div>
        <div class="field">
          <label>Confirmar senha</label>
          <input
            type="password"
            v-model="senhaConfirm"
            placeholder="••••••"
            @keyup.enter="configurarSenha"
          />
        </div>
        <div
          v-if="erro"
          class="badge bad"
          style="width: 100%; justify-content: center"
        >
          {{ erro }}
        </div>
        <button
          class="btn primary"
          :disabled="carregando"
          @click="configurarSenha"
          style="width: 100%"
        >
          <fa :icon="carregando ? 'spinner' : 'check'" :spin="carregando" />
          Definir senha e entrar
        </button>
        <button
          class="btn ghost"
          @click="voltarParaSelecao"
          style="width: 100%"
        >
          Trocar loja
        </button>
      </div>
    </div>

    <!-- ======= ETAPA: LOGIN ======= -->
    <div v-else-if="etapa === 'login'" class="portal-card">
      <div v-if="lojaSelecionada" class="selected-store">
        <div class="selected-store-chip">
          <StoreAvatar
            :nome="lojaSelecionada.nomeLoja"
            :avatar-url="lojaSelecionada.avatarUrl"
            :size="28"
            :font-size="11"
          />
          <span class="badge info">{{ lojaSelecionada.nomeLoja }}</span>
        </div>
        <span class="muted" style="font-size: 12px">{{
          resumoLojaSelecionada
        }}</span>
      </div>
      <h2 style="margin: 0 0 4px">Bem-vindo, {{ primeiroNome }}!</h2>
      <p class="muted" style="font-size: 14px; margin: 0 0 24px">
        Informe sua senha para entrar.
      </p>
      <div class="grid gap-3">
        <div class="field">
          <label>Senha</label>
          <input
            type="password"
            v-model="senha"
            placeholder="••••••"
            autofocus
            @keyup.enter="login"
          />
        </div>
        <div
          v-if="erro"
          class="badge bad"
          style="width: 100%; justify-content: center"
        >
          {{ erro }}
        </div>
        <button
          class="btn primary"
          :disabled="carregando"
          @click="login"
          style="width: 100%"
        >
          <fa
            :icon="carregando ? 'spinner' : 'right-to-bracket'"
            :spin="carregando"
          />
          Entrar
        </button>
        <button
          class="btn ghost"
          @click="voltarParaSelecao"
          style="width: 100%"
        >
          Trocar loja
        </button>
      </div>
    </div>

    <!-- ======= PORTAL: PERFIL COMPLETO ======= -->
    <div v-else-if="etapa === 'portal' && perfil" class="portal-content">
      <!-- Hero do colaborador -->
      <div class="card glow portal-hero">
        <div class="hero-avatar">
          <div
            class="avatar-big"
            @click="abrirAvatar"
            title="Trocar foto"
            style="cursor: pointer"
          >
            <img
              v-if="perfil.avatarUrl"
              :src="perfil.avatarUrl"
              alt="foto"
              style="
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 50%;
              "
            />
            <span v-else>{{ iniciais }}</span>
            <div class="avatar-overlay"><fa icon="camera" /></div>
          </div>
          <input
            ref="avatarInput"
            type="file"
            accept="image/*"
            hidden
            @change="enviarAvatar"
          />
          <div
            v-if="enviandoAvatar"
            class="muted"
            style="font-size: 12px; margin-top: 6px"
          >
            Enviando…
          </div>
        </div>
        <div class="hero-info">
          <h2 style="margin: 0 0 4px">{{ perfil.nome }}</h2>
          <div class="row gap-2 mb-2" style="flex-wrap: wrap">
            <span class="badge dim">Matrícula {{ perfil.codigoExterno }}</span>
            <span v-if="perfil.cargo" class="badge info">{{
              perfil.cargo
            }}</span>
            <span v-if="perfil.setor" class="badge dim">{{
              perfil.setor
            }}</span>
          </div>
          <!-- Nível e progresso -->
          <div class="row gap-3">
            <div class="nivel-badge">Nível {{ nivel }}</div>
            <div style="flex: 1">
              <div class="row mb-1" style="font-size: 12px">
                <span class="muted"
                  >{{ perfil.pontuacao.toLocaleString("pt-BR") }} pts</span
                >
                <span class="spacer" />
                <span class="muted"
                  >Próx. nível:
                  {{ pontuacaoProxNivel.toLocaleString("pt-BR") }}</span
                >
              </div>
              <div class="progress">
                <span :style="{ width: pctNivel + '%' }" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="portal-settings-grid">
        <div class="card portal-settings-card">
          <h3 class="section-title">Configurações</h3>
          <div class="settings-block">
            <div class="settings-title">Tema do portal</div>
            <p class="muted settings-copy">
              O portal abre em tema claro por padrão. Você pode trocar quando
              quiser.
            </p>
            <div class="theme-toggle-group">
              <button
                class="theme-toggle"
                :class="{ active: temaPortal === 'light' }"
                @click="aplicarTemaPortal('light')"
              >
                <fa icon="sun" /> Claro
              </button>
              <button
                class="theme-toggle"
                :class="{ active: temaPortal === 'dark' }"
                @click="aplicarTemaPortal('dark')"
              >
                <fa icon="moon" /> Escuro
              </button>
            </div>
          </div>

          <form
            class="settings-block grid gap-3"
            @submit.prevent="alterarSenhaConta"
          >
            <div>
              <div class="settings-title">Segurança</div>
              <p class="muted settings-copy">
                Atualize sua senha sempre que quiser, usando sua senha atual
                para confirmar.
              </p>
            </div>
            <div class="field">
              <label>Senha atual</label>
              <input
                v-model="senhaAtualConta"
                type="password"
                placeholder="••••••"
                autocomplete="current-password"
              />
            </div>
            <div class="field">
              <label>Nova senha</label>
              <input
                v-model="novaSenhaConta"
                type="password"
                placeholder="••••••"
                autocomplete="new-password"
              />
            </div>
            <div class="field">
              <label>Confirmar nova senha</label>
              <input
                v-model="confirmarNovaSenhaConta"
                type="password"
                placeholder="••••••"
                autocomplete="new-password"
              />
            </div>
            <div v-if="erroConfig" class="badge bad settings-feedback">
              {{ erroConfig }}
            </div>
            <div v-else-if="sucessoConfig" class="badge ok settings-feedback">
              {{ sucessoConfig }}
            </div>
            <button
              class="btn primary"
              type="submit"
              :disabled="alterandoSenha"
            >
              <fa
                :icon="alterandoSenha ? 'spinner' : 'lock'"
                :spin="alterandoSenha"
              />
              Atualizar senha
            </button>
          </form>
        </div>
      </div>

      <!-- Conquistas -->
      <div class="card" v-if="perfil.conquistas?.length">
        <h3 class="section-title">Conquistas</h3>
        <div class="conquistas-grid">
          <div
            v-for="c in perfil.conquistas"
            :key="c.codigo"
            class="conquista-item"
          >
            <span class="conquista-ico">{{
              conquistaIco[c.codigo] || "🏆"
            }}</span>
            <span class="conquista-nome">{{ c.nome }}</span>
            <span class="muted" style="font-size: 10px">{{
              new Date(c.conquistadaEm).toLocaleDateString("pt-BR")
            }}</span>
          </div>
        </div>
      </div>

      <!-- KPIs por tipo -->
      <div
        v-if="metricas?.porTipo?.length"
        class="grid"
        style="
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
        "
      >
        <div v-for="t in metricas.porTipo" :key="t._id" class="card glow">
          <span
            class="badge"
            :class="'tipo-' + t._id"
            style="margin-bottom: 12px"
            >{{ t._id }}</span
          >
          <div style="font-size: 26px; font-weight: 700">
            {{
              t.totalLidos
                ? ((t.totalConformes / t.totalLidos) * 100).toFixed(1)
                : 0
            }}%
          </div>
          <div class="muted" style="font-size: 12px">conformidade</div>
          <div class="row mt-2" style="font-size: 12px">
            <span class="muted">Itens:</span
            ><strong>{{ t.totalLidos?.toLocaleString("pt-BR") }}</strong>
            <span class="spacer" />
            <span class="muted">Pts:</span
            ><strong>{{ Math.round(t.pontuacao) }}</strong>
          </div>
        </div>
      </div>

      <!-- Gráfico histórico -->
      <div class="card" v-if="metricas?.serie?.length">
        <div class="row mb-2">
          <h3 class="section-title" style="margin-bottom: 0">
            Itens auditados por dia
          </h3>
          <span class="spacer" /><fa
            :icon="serieComoColunas ? 'chart-bar' : 'chart-line'"
            class="muted"
          />
        </div>
        <AppChart
          :type="serieComoColunas ? 'bar' : 'line'"
          :data="serieChart"
          :height="260"
          :options="serieChartOptions"
        />
      </div>

      <div v-if="!metricas?.serie?.length" class="empty" style="padding: 40px">
        Nenhuma auditoria registrada ainda. Seus dados aparecerão aqui após o
        processamento das planilhas.
      </div>
    </div>

    <Transition name="crop-modal">
      <div
        v-if="cropperAberto"
        class="crop-backdrop"
        @click.self="fecharCropper"
      >
        <div class="crop-dialog">
          <div class="row justify-between items-center mb-2">
            <div>
              <h3 class="mt-0 mb-0">Ajustar foto do perfil</h3>
              <p class="muted crop-copy">
                Arraste a imagem e defina o enquadramento do jeito que preferir.
              </p>
            </div>
            <button class="btn ghost" @click="fecharCropper">
              <fa icon="xmark" /> Fechar
            </button>
          </div>

          <div class="crop-stage">
            <img
              ref="cropperImageRef"
              :src="cropperImage"
              :alt="cropperNomeArquivo || 'Prévia do avatar'"
              class="crop-image"
            />
          </div>

          <div class="row justify-between items-center crop-footer">
            <button class="btn ghost" @click="resetarCropper">
              Reiniciar corte
            </button>
            <div class="row gap-2">
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
                Salvar foto
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.portal-shell {
  min-height: 100vh;
  background:
    radial-gradient(
      900px 600px at 5% -5%,
      rgba(124, 92, 255, 0.18),
      transparent 60%
    ),
    radial-gradient(
      800px 600px at 100% 15%,
      rgba(34, 211, 238, 0.12),
      transparent 60%
    ),
    var(--bg-0);
  font-family: var(--font-sans);
}

.portal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 32px;
  border-bottom: 1px solid var(--border);
  background: rgba(11, 15, 26, 0.55);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 10;
}

.portal-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.brand-mark {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--grad-primary);
  display: grid;
  place-items: center;
  color: #fff;
  box-shadow: 0 6px 18px rgba(124, 92, 255, 0.4);
  font-size: 16px;
}
.brand-mark.big {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  font-size: 28px;
  margin: 0 auto;
}
.brand-name {
  font-weight: 700;
  color: var(--text);
}
.brand-name small {
  display: block;
  font-size: 11px;
  color: var(--text-dim);
  font-weight: 400;
}

.portal-card {
  max-width: 440px;
  margin: 60px auto;
  background: var(--surface-strong);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  padding: 36px;
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(10px);
}

.portal-card-wide {
  max-width: 560px;
}

.selected-store {
  display: grid;
  gap: 8px;
  margin-bottom: 18px;
}

.selected-store-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.store-options {
  display: grid;
  gap: 12px;
}

.store-option {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease;
}

.store-option:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-sm);
}

.store-option.preferred {
  border-color: rgba(124, 92, 255, 0.32);
  box-shadow: 0 0 0 1px rgba(124, 92, 255, 0.16);
}

.store-option-main {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.store-option-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: var(--grad-primary);
  color: #fff;
  flex-shrink: 0;
}

.store-option-copy {
  display: grid;
  gap: 4px;
  text-align: left;
}

.store-option-copy strong {
  font-size: 15px;
}

.store-option-meta {
  color: var(--text-dim);
  flex-shrink: 0;
}

.portal-settings-grid {
  display: grid;
  gap: 20px;
}

.portal-settings-card {
  display: grid;
  gap: 18px;
}

.settings-block {
  display: grid;
  gap: 12px;
  padding-top: 6px;
}

.settings-block + .settings-block {
  border-top: 1px solid var(--border);
  padding-top: 20px;
}

.settings-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}

.settings-copy {
  margin: 4px 0 0;
  font-size: 13px;
}

.theme-toggle-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.theme-toggle {
  min-width: 140px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-weight: 700;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background-color 0.18s ease;
}

.theme-toggle:hover {
  transform: translateY(-1px);
  border-color: var(--border-strong);
}

.theme-toggle.active {
  border-color: rgba(124, 92, 255, 0.35);
  background: linear-gradient(
    180deg,
    rgba(124, 92, 255, 0.16),
    rgba(34, 211, 238, 0.08)
  );
  box-shadow: 0 0 0 1px rgba(124, 92, 255, 0.12);
}

.settings-feedback {
  width: 100%;
  justify-content: center;
}

.portal-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 28px 20px 60px;
  display: grid;
  gap: 20px;
}

.portal-hero {
  display: flex;
  gap: 28px;
  align-items: flex-start;
  flex-wrap: wrap;
}
.hero-avatar {
  text-align: center;
}
.avatar-big {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: var(--grad-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  overflow: hidden;
  position: relative;
  box-shadow: 0 8px 24px rgba(124, 92, 255, 0.4);
  transition: transform 0.15s;
}
.avatar-big:hover {
  transform: scale(1.04);
}
.avatar-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: grid;
  place-items: center;
  font-size: 18px;
  opacity: 0;
  transition: opacity 0.15s;
}
.avatar-big:hover .avatar-overlay {
  opacity: 1;
}
.hero-info {
  flex: 1;
  min-width: 200px;
}

.nivel-badge {
  background: var(--grad-primary);
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 999px;
  white-space: nowrap;
}

.conquistas-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.conquista-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 18px;
  min-width: 110px;
  text-align: center;
  gap: 4px;
}
.conquista-ico {
  font-size: 28px;
}
.conquista-nome {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
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
  min-height: 360px;
  max-height: 62vh;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.28);
}

.crop-image {
  display: block;
  max-width: 100%;
}

.crop-footer {
  margin-top: 18px;
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

:global([data-theme="light"]) .theme-toggle.active {
  background: linear-gradient(
    180deg,
    rgba(109, 92, 255, 0.14),
    rgba(17, 197, 255, 0.08)
  );
}

@media (max-width: 640px) {
  .portal-card,
  .portal-card-wide {
    margin: 30px 16px;
    padding: 24px;
  }

  .portal-header {
    padding: 16px 18px;
  }

  .store-option {
    align-items: flex-start;
    padding: 14px;
  }

  .store-option-main {
    align-items: flex-start;
  }

  .theme-toggle {
    flex: 1 1 100%;
  }

  .crop-dialog {
    padding: 16px;
  }

  .crop-stage {
    min-height: 260px;
  }

  .crop-footer {
    align-items: stretch;
  }
}
</style>
