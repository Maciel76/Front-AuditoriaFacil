<script setup>
/**
 * Portal self-service do colaborador (rota /portal).
 *
 * Acesso público: o colaborador autentica via matrícula + senha (token
 * próprio do portal, distinto do app principal). Após login, navega
 * entre quatro abas: Visão geral, Conquistas, Corredores e Configurações.
 *
 * O design é mobile-first com bottom navigation, focado no uso pelo
 * celular. A página principal exibe nível, XP, KPIs por tipo, gráfico
 * de itens lidos por dia e um carrossel de conquistas em destaque.
 */
import Cropper from "cropperjs";
import {
  ref,
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  defineComponent,
  h,
} from "vue";
import { useRoute } from "vue-router";
import api from "@/services/api";
import AppChart from "@/components/AppChart.vue";
import AuditoriaDodia from "@/components/AuditoriaDodia.vue";
import ColaboradorAvatar from "@/components/ColaboradorAvatar.vue";
import InstallPWA from "@/components/InstallPWA.vue";
import StoreAvatar from "@/components/StoreAvatar.vue";

const route = useRoute();

// ---- Estado de autenticação ----
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

// ---- Estado do portal ----
const abaAtiva = ref("inicio"); // inicio | conquistas | corredores | configuracoes
const perfil = ref(null);
const metricas = ref(null);
const conquistasResolvidas = ref([]);
const conquistaSelecionada = ref(null);
const filtroCategoriaConq = ref("todas");
const filtroStatusConq = ref("todas");

const avatarInput = ref(null);
const enviandoAvatar = ref(false);
const cropperImage = ref("");
const cropperAberto = ref(false);
const cropperImageRef = ref(null);
const cropperStageRef = ref(null);
const cropperNomeArquivo = ref("");
const alterandoSenha = ref(false);
const senhaAtualConta = ref("");
const novaSenhaConta = ref("");
const confirmarNovaSenhaConta = ref("");
const erroConfig = ref("");
const sucessoConfig = ref("");

let cropper;
let temaAnterior = "";

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

const TIER_INFO = {
  comum: { label: "Comum", cor: "#94a3b8" },
  raro: { label: "Raro", cor: "#3b82f6" },
  epico: { label: "Épico", cor: "#a855f7" },
  lendario: { label: "Lendário", cor: "#f59e0b" },
  mitico: { label: "Mítico", cor: "#ef4444" },
};

const CATEGORIA_LABELS = {
  ITENS: "Itens",
  AUDITORIAS: "Auditorias",
  CONFORMIDADE: "Conformidade",
  PONTUACAO: "Pontuação",
  NIVEL: "Nível",
  ESPECIAL: "Especial",
  todas: "Todas",
};

const METRICA_LABELS = {
  totalItensLidos: "Itens lidos",
  totalItensConformes: "Itens conformes",
  totalAuditorias: "Auditorias realizadas",
  taxaConformidadeAcumulada: "Taxa de conformidade",
  pontuacao: "Pontuação (XP)",
  nivel: "Nível",
};

const corPorTipo = {
  ETIQUETA: "#7c5cff",
  PRESENCA: "#22d3ee",
  RUPTURA: "#f59e0b",
};

// ConquistaCard como componente local definido via render function (sem template parser em runtime).
const ConquistaCard = defineComponent({
  name: "ConquistaCard",
  emits: ["select"],
  props: {
    c: { type: Object, required: true },
    compact: { type: Boolean, default: false },
  },
  setup(props, { emit }) {
    return () => {
      const c = props.c;
      const tierCor = c.tierAtualCor || "#94a3b8";
      const cls = [
        "conq-card",
        c.desbloqueada ? "" : "locked",
        props.compact ? "compact" : "",
        "tier-" + (c.tierAtual || "locked"),
      ]
        .filter(Boolean)
        .join(" ");
      const abrirDetalhes = () => emit("select", c);

      return h(
        "div",
        {
          class: cls,
          style: { "--tier-cor": tierCor },
          role: "button",
          tabindex: 0,
          "aria-label": `Abrir detalhes da conquista ${c.nome}`,
          onClick: abrirDetalhes,
          onKeydown: (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              abrirDetalhes();
            }
          },
        },
        [
          h("div", { class: "conq-card-bg" }),
          h("div", { class: "conq-card-icon" }, [
            c.desbloqueada ? c.icone : h("i", { class: "fa-solid fa-lock" }),
          ]),
          h("div", { class: "conq-card-body" }, [
            c.tierAtual
              ? h("div", { class: "conq-card-tier" }, [
                  h("span", {
                    class: "conq-tier-dot",
                    style: { background: tierCor },
                  }),
                  c.tierAtualLabel,
                ])
              : h("div", { class: "conq-card-tier locked-label" }, [
                  h("i", { class: "fa-solid fa-lock" }),
                  " Bloqueada",
                ]),
            h("strong", { class: "conq-card-nome" }, c.nome),
            props.compact
              ? null
              : h("p", { class: "muted conq-card-desc" }, c.descricao || ""),
            c.proximoTier
              ? h("div", { class: "conq-progress" }, [
                  h("div", { class: "conq-progress-head" }, [
                    h("span", { class: "muted" }, [
                      "Próx.: ",
                      h("strong", c.proximoTier.label),
                    ]),
                    h(
                      "span",
                      { class: "conq-progress-meta" },
                      `${Number(c.progresso).toLocaleString("pt-BR")} / ${Number(c.proximoTier.meta).toLocaleString("pt-BR")}`,
                    ),
                  ]),
                  h("div", { class: "progress conq-bar" }, [
                    h("span", {
                      style: {
                        width: c.progressoPct + "%",
                        background: c.proximoTier.cor,
                      },
                    }),
                  ]),
                ])
              : h("div", { class: "conq-progress-max" }, [
                  h("i", { class: "fa-solid fa-medal" }),
                  " Tier máximo alcançado!",
                ]),
            props.compact || !c.tiers?.length
              ? null
              : h(
                  "div",
                  { class: "conq-tiers" },
                  c.tiers.map((t) =>
                    h(
                      "span",
                      {
                        key: t.nivel,
                        class: [
                          "conq-tier-pill",
                          t.desbloqueado ? "unlocked" : "",
                        ],
                        style: t.desbloqueado
                          ? { borderColor: t.cor, color: t.cor }
                          : {},
                        title: `${t.titulo || ""} · meta ${t.meta}`,
                      },
                      [
                        h("i", {
                          class: t.desbloqueado
                            ? "fa-solid fa-check"
                            : "fa-solid fa-lock",
                        }),
                        " " + t.label,
                      ],
                    ),
                  ),
                ),
          ]),
        ],
      );
    };
  },
});

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
  conquistasResolvidas.value = [];
  conquistaSelecionada.value = null;
  limparFormularioSenha();
  etapa.value = "buscar";
}

function abrirDetalheConquista(conquista) {
  conquistaSelecionada.value = conquista;
}

function fecharDetalheConquista() {
  conquistaSelecionada.value = null;
}

function voltarParaSelecao() {
  limparFormularioSenha();
  etapa.value = "selecionar";
}

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
  conquistasResolvidas.value = data.conquistas || [];
}

function sair() {
  token.value = "";
  localStorage.removeItem("na_portal_token");
  voltarParaBusca();
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

async function enviarAvatar(e) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file || !perfil.value) return;

  if (!file.type.startsWith("image/")) {
    erroConfig.value = "Selecione apenas um arquivo de imagem.";
    return;
  }

  if (file.size > MAX_AVATAR_BYTES) {
    erroConfig.value = "A foto deve ter no máximo 5 MB.";
    return;
  }

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
    fd.append("avatar", blob, `colaborador-${perfil.value._id}.jpg`);

    const res = await apiPortal().post(
      `/colaboradores/${perfil.value._id}/avatar`,
      fd,
      { headers: { "Content-Type": "multipart/form-data" } },
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

const totaisConquistas = computed(() => {
  const desbl = conquistasResolvidas.value.filter((c) => c.desbloqueada).length;
  const tiersDesbl = conquistasResolvidas.value.reduce(
    (acc, c) => acc + (c.totalTiersDesbloqueados || 0),
    0,
  );
  const totalTiers = conquistasResolvidas.value.reduce(
    (acc, c) => acc + (c.totalTiers || 0),
    0,
  );
  return {
    total: conquistasResolvidas.value.length,
    desbloqueadas: desbl,
    tiersDesbl,
    totalTiers,
  };
});

const categoriasDisponiveis = computed(() => {
  const cats = new Set(conquistasResolvidas.value.map((c) => c.categoria));
  return ["todas", ...Array.from(cats)];
});

const conquistasFiltradas = computed(() => {
  let lista = [...conquistasResolvidas.value];
  if (filtroCategoriaConq.value !== "todas")
    lista = lista.filter((c) => c.categoria === filtroCategoriaConq.value);
  if (filtroStatusConq.value === "desbloqueadas")
    lista = lista.filter((c) => c.desbloqueada);
  else if (filtroStatusConq.value === "bloqueadas")
    lista = lista.filter((c) => !c.desbloqueada);
  return lista.sort((a, b) => {
    if (a.desbloqueada !== b.desbloqueada) return a.desbloqueada ? -1 : 1;
    return (b.totalTiersDesbloqueados || 0) - (a.totalTiersDesbloqueados || 0);
  });
});

const conquistasDestaque = computed(() =>
  conquistasResolvidas.value
    .slice()
    .sort((a, b) => {
      if (a.desbloqueada !== b.desbloqueada) return a.desbloqueada ? -1 : 1;
      return (
        (b.totalTiersDesbloqueados || 0) - (a.totalTiersDesbloqueados || 0)
      );
    })
    .slice(0, 4),
);

const historicoConquistaSelecionada = computed(() => {
  const historico = conquistaSelecionada.value?.historicoDesbloqueios || [];
  return historico.slice().sort((a, b) => {
    const dataA = a.desbloqueadoEm ? new Date(a.desbloqueadoEm).getTime() : 0;
    const dataB = b.desbloqueadoEm ? new Date(b.desbloqueadoEm).getTime() : 0;
    if (dataA !== dataB) return dataB - dataA;
    return (TIER_INFO[b.nivel]?.ordem || 0) - (TIER_INFO[a.nivel]?.ordem || 0);
  });
});

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
          maxBarThickness: 30,
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
        label: (ctx) =>
          `${ctx.dataset.label}: ${Number(ctx.raw ?? ctx.parsed?.y ?? 0).toLocaleString("pt-BR")} itens`,
      },
    },
  },
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
}));

function formatNum(n) {
  return Number(n || 0).toLocaleString("pt-BR");
}

function formatarValorConquista(valor, metricaBase) {
  const numero = Number(valor || 0);
  if (metricaBase === "taxaConformidadeAcumulada") {
    return `${numero.toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })}%`;
  }
  return numero.toLocaleString("pt-BR");
}

function formatarData(valor, incluirHora = false) {
  if (!valor) return "Data indisponível";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat(
    "pt-BR",
    incluirHora
      ? { dateStyle: "medium", timeStyle: "short" }
      : { dateStyle: "medium" },
  ).format(data);
}

function textoRequisitoTier(conquista, tier) {
  const metrica =
    METRICA_LABELS[conquista.metricaBase] || conquista.metricaBase;
  return `${metrica}: atingir ${formatarValorConquista(tier.meta, conquista.metricaBase)}`;
}

function dataTierDesbloqueado(conquista, nivel) {
  const historico = conquista.historicoDesbloqueios?.find(
    (item) => item.nivel === nivel,
  );
  return historico?.desbloqueadoEm || null;
}

function progressoTierValor(conquista, tier) {
  const progressoAtual = Number(conquista?.progresso || 0);
  const meta = Number(tier?.meta || 0);
  if (meta <= 0) return 0;
  return Math.min(progressoAtual, meta);
}

function progressoTierPct(conquista, tier) {
  const meta = Number(tier?.meta || 0);
  if (meta <= 0) return 0;
  return Math.min(
    100,
    Math.max(0, (progressoTierValor(conquista, tier) / meta) * 100),
  );
}

function textoProgressoTier(conquista, tier) {
  return `${formatarValorConquista(progressoTierValor(conquista, tier), conquista.metricaBase)} / ${formatarValorConquista(tier.meta, conquista.metricaBase)}`;
}

function textoPctTier(conquista, tier) {
  return `${progressoTierPct(conquista, tier).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
}

function tratarTeclaPortal(event) {
  if (event.key !== "Escape") return;
  if (conquistaSelecionada.value) {
    fecharDetalheConquista();
    return;
  }
  if (cropperAberto.value) fecharCropper();
}

onMounted(async () => {
  document.addEventListener("keydown", tratarTeclaPortal);
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
  document.removeEventListener("keydown", tratarTeclaPortal);
  destruirCropper();
  document.documentElement.setAttribute(
    "data-theme",
    localStorage.getItem("na_tema") || temaAnterior || "dark",
  );
});
</script>

<template>
  <div class="portal-shell">
    <header v-if="etapa !== 'portal'" class="portal-header">
      <div class="portal-brand">
        <div class="brand-mark"><fa icon="bolt" /></div>
        <span class="brand-name"
          >Flashrub <small>Portal do Colaborador</small></span
        >
      </div>
    </header>

    <InstallPWA
      v-if="etapa !== 'portal'"
      :user-key="matricula"
      icon-src="/pwa-192.png"
    />

    <!-- Buscar matrícula -->
    <div v-if="etapa === 'buscar'" class="portal-card">
      <div class="center mb-4">
        <div class="brand-mark big"><fa icon="id-badge" /></div>
      </div>
      <h2 class="auth-title">Acesse seu perfil</h2>
      <p class="auth-sub">
        Informe sua matrícula para localizar as lojas em que você possui
        auditorias.
      </p>
      <div class="grid gap-3">
        <div class="field">
          <label>Matrícula</label>
          <input
            v-model="matricula"
            placeholder="ex.: 2692473"
            inputmode="numeric"
            @keyup.enter="verificar"
          />
        </div>
        <div v-if="erro" class="badge bad full-w">{{ erro }}</div>
        <button
          class="btn primary full-w"
          :disabled="carregando"
          @click="verificar"
        >
          <fa
            :icon="carregando ? 'spinner' : 'arrow-right'"
            :spin="carregando"
          />
          Ver minhas lojas
        </button>
      </div>
    </div>

    <!-- Selecionar loja -->
    <div
      v-else-if="etapa === 'selecionar'"
      class="portal-card portal-card-wide"
    >
      <div class="center mb-4">
        <div class="brand-mark big"><fa icon="store" /></div>
      </div>
      <h2 class="auth-title">Escolha a loja</h2>
      <p class="auth-sub">
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
              </div>
            </div>
          </div>
          <fa icon="chevron-right" class="muted" />
        </button>
      </div>
      <button
        class="btn ghost full-w"
        @click="voltarParaBusca"
        style="margin-top: 16px"
      >
        Informar outra matrícula
      </button>
    </div>

    <!-- Setup / Login -->
    <div v-else-if="etapa === 'setup' || etapa === 'login'" class="portal-card">
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
      <h2 class="auth-title-small">
        {{ etapa === "setup" ? "Olá," : "Bem-vindo," }}
        {{ primeiroNome }}!
      </h2>
      <p class="auth-sub">
        {{
          etapa === "setup"
            ? "Defina sua senha para acessar o portal."
            : "Informe sua senha para entrar."
        }}
      </p>
      <div class="grid gap-3">
        <div class="field">
          <label>{{
            etapa === "setup" ? "Nova senha (mínimo 6 caracteres)" : "Senha"
          }}</label>
          <input
            type="password"
            v-model="senha"
            placeholder="••••••"
            @keyup.enter="etapa === 'setup' ? configurarSenha() : login()"
          />
        </div>
        <div v-if="etapa === 'setup'" class="field">
          <label>Confirmar senha</label>
          <input
            type="password"
            v-model="senhaConfirm"
            placeholder="••••••"
            @keyup.enter="configurarSenha"
          />
        </div>
        <div v-if="erro" class="badge bad full-w">{{ erro }}</div>
        <button
          class="btn primary full-w"
          :disabled="carregando"
          @click="etapa === 'setup' ? configurarSenha() : login()"
        >
          <fa
            :icon="
              carregando
                ? 'spinner'
                : etapa === 'setup'
                  ? 'check'
                  : 'right-to-bracket'
            "
            :spin="carregando"
          />
          {{ etapa === "setup" ? "Definir senha e entrar" : "Entrar" }}
        </button>
        <button class="btn ghost full-w" @click="voltarParaSelecao">
          Trocar loja
        </button>
      </div>
    </div>

    <!-- ============== PORTAL AUTENTICADO ============== -->
    <div v-else-if="etapa === 'portal' && perfil" class="portal-app">
      <header class="app-topbar">
        <div class="topbar-left">
          <div class="topbar-avatar" @click="abrirAvatar">
            <ColaboradorAvatar
              :nome="perfil.nome"
              :avatar-url="perfil.avatarUrl"
              :size="44"
              :font-size="16"
            />
            <div class="avatar-edit"><fa icon="camera" /></div>
          </div>
          <input
            ref="avatarInput"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            hidden
            @change="enviarAvatar"
          />
          <div class="topbar-greet">
            <small class="muted">Bem-vindo</small>
            <strong>{{ primeiroNome }}</strong>
          </div>
        </div>
        <button class="btn ghost icon-btn" @click="sair" title="Sair">
          <fa icon="right-from-bracket" />
        </button>
      </header>

      <!-- ABA INÍCIO -->
      <main v-if="abaAtiva === 'inicio'" class="app-content">
        <section class="card glow nivel-card">
          <div class="nivel-card-head">
            <div class="nivel-emblema">
              <div class="nivel-num">{{ nivel }}</div>
              <small>Nível</small>
            </div>
            <div class="nivel-info">
              <h3 class="nome">{{ perfil.nome }}</h3>
              <div class="muted nome-sub">
                <fa icon="id-badge" /> {{ perfil.codigoExterno }}
                <span v-if="perfil.cargo"> · {{ perfil.cargo }}</span>
              </div>
              <div class="xp-row">
                <span class="xp-pts">{{ formatNum(perfil.pontuacao) }} XP</span>
                <span class="muted xp-target"
                  >Próx.: {{ formatNum(pontuacaoProxNivel) }}</span
                >
              </div>
              <div class="progress xp-bar">
                <span :style="{ width: pctNivel + '%' }" />
              </div>
            </div>
          </div>
          <div class="nivel-stats">
            <div>
              <strong>{{ formatNum(perfil.totalItensLidos) }}</strong>
              <small class="muted">itens lidos</small>
            </div>
            <div>
              <strong>{{ formatNum(perfil.totalAuditorias) }}</strong>
              <small class="muted">auditorias</small>
            </div>
            <div>
              <strong
                >{{ totaisConquistas.tiersDesbl }}/{{
                  totaisConquistas.totalTiers
                }}</strong
              >
              <small class="muted">tiers</small>
            </div>
          </div>
        </section>

        <section v-if="metricas?.porTipo?.length" class="kpis-tipos">
          <div
            v-for="t in metricas.porTipo"
            :key="t._id"
            class="kpi-tipo card"
            :style="{ borderTopColor: corPorTipo[t._id] }"
          >
            <span class="badge" :class="'tipo-' + t._id">{{ t._id }}</span>
            <div class="kpi-valor">
              {{
                t.totalLidos
                  ? ((t.totalConformes / t.totalLidos) * 100).toFixed(1)
                  : 0
              }}%
            </div>
            <small class="muted">conformidade</small>
            <div class="kpi-foot">
              <span
                ><fa icon="boxes-stacked" /> {{ formatNum(t.totalLidos) }}</span
              >
              <span><fa icon="bolt" /> {{ Math.round(t.pontuacao) }}</span>
            </div>
          </div>
        </section>

        <section class="card destaque-conquistas">
          <div class="row justify-between items-center mb-2">
            <h3 class="section-title"><fa icon="trophy" /> Conquistas</h3>
            <button class="btn ghost small" @click="abaAtiva = 'conquistas'">
              Ver todas <fa icon="chevron-right" />
            </button>
          </div>
          <div v-if="!conquistasResolvidas.length" class="empty mini">
            Continue auditando para desbloquear suas primeiras conquistas!
          </div>
          <div v-else class="destaque-grid">
            <ConquistaCard
              v-for="c in conquistasDestaque"
              :key="c.codigo"
              :c="c"
              compact
              @select="abrirDetalheConquista"
            />
          </div>
        </section>

        <section v-if="metricas?.serie?.length" class="card">
          <div class="row mb-2">
            <h3 class="section-title">Itens por dia</h3>
            <span class="spacer" />
            <fa
              :icon="serieComoColunas ? 'chart-bar' : 'chart-line'"
              class="muted"
            />
          </div>
          <AppChart
            :type="serieComoColunas ? 'bar' : 'line'"
            :data="serieChart"
            :height="240"
            :options="serieChartOptions"
          />
        </section>

        <div v-if="!metricas?.serie?.length" class="empty card">
          Suas auditorias ainda não foram processadas. Volte aqui em breve!
        </div>
      </main>

      <!-- ABA CONQUISTAS -->
      <main v-else-if="abaAtiva === 'conquistas'" class="app-content">
        <section class="card conquistas-summary">
          <div class="conq-summary-num">
            <fa icon="trophy" class="conq-summary-ico" />
            <div>
              <strong
                >{{ totaisConquistas.tiersDesbl }} /
                {{ totaisConquistas.totalTiers }}</strong
              >
              <small class="muted">tiers desbloqueados</small>
            </div>
          </div>
          <p class="muted conq-summary-help">
            Cada conquista evolui em até 5 tiers — Comum, Raro, Épico, Lendário
            e Mítico. Continue auditando para ganhar XP bônus!
          </p>
        </section>

        <div class="conq-filters">
          <div class="chip-row">
            <button
              v-for="cat in categoriasDisponiveis"
              :key="cat"
              class="chip"
              :class="{ active: filtroCategoriaConq === cat }"
              @click="filtroCategoriaConq = cat"
            >
              {{ CATEGORIA_LABELS[cat] || cat }}
            </button>
          </div>
          <div class="chip-row">
            <button
              class="chip"
              :class="{ active: filtroStatusConq === 'todas' }"
              @click="filtroStatusConq = 'todas'"
            >
              Todas
            </button>
            <button
              class="chip"
              :class="{ active: filtroStatusConq === 'desbloqueadas' }"
              @click="filtroStatusConq = 'desbloqueadas'"
            >
              <fa icon="unlock" /> Desbloqueadas
            </button>
            <button
              class="chip"
              :class="{ active: filtroStatusConq === 'bloqueadas' }"
              @click="filtroStatusConq = 'bloqueadas'"
            >
              <fa icon="lock" /> Bloqueadas
            </button>
          </div>
        </div>

        <div v-if="!conquistasFiltradas.length" class="empty card">
          Nenhuma conquista neste filtro.
        </div>
        <div v-else class="conq-grid">
          <ConquistaCard
            v-for="c in conquistasFiltradas"
            :key="c.codigo"
            :c="c"
            @select="abrirDetalheConquista"
          />
        </div>
      </main>

      <!-- ABA CORREDORES -->
      <main v-else-if="abaAtiva === 'corredores'" class="app-content">
        <AuditoriaDodia :token="token" />
      </main>

      <!-- ABA CONFIGURAÇÕES -->
      <main v-else-if="abaAtiva === 'configuracoes'" class="app-content">
        <section class="card">
          <h3 class="section-title"><fa icon="user-circle" /> Sua conta</h3>
          <div class="config-account">
            <div class="config-avatar" @click="abrirAvatar">
              <ColaboradorAvatar
                :nome="perfil.nome"
                :avatar-url="perfil.avatarUrl"
                :size="72"
                :font-size="22"
              />
              <div class="avatar-edit"><fa icon="camera" /></div>
            </div>
            <div>
              <strong>{{ perfil.nome }}</strong>
              <div class="muted">Matrícula {{ perfil.codigoExterno }}</div>
              <div class="muted" v-if="perfil.cargo">
                {{ perfil.cargo }}
              </div>
              <div class="muted" v-if="lojaSelecionada?.nomeLoja">
                <fa icon="store" /> {{ lojaSelecionada.nomeLoja }}
              </div>
            </div>
          </div>
        </section>

        <section class="card">
          <h3 class="section-title"><fa icon="sun" /> Tema do portal</h3>
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
        </section>

        <section class="card">
          <h3 class="section-title"><fa icon="lock" /> Segurança</h3>
          <form class="grid gap-3" @submit.prevent="alterarSenhaConta">
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
            <div v-if="erroConfig" class="badge bad full-w">
              {{ erroConfig }}
            </div>
            <div v-else-if="sucessoConfig" class="badge ok full-w">
              {{ sucessoConfig }}
            </div>
            <button
              class="btn primary full-w"
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
        </section>

        <button class="btn ghost full-w danger" @click="sair">
          <fa icon="right-from-bracket" /> Sair do portal
        </button>
      </main>

      <nav class="bottom-nav">
        <button
          class="nav-btn"
          :class="{ active: abaAtiva === 'inicio' }"
          @click="abaAtiva = 'inicio'"
        >
          <fa icon="gauge" />
          <span>Início</span>
        </button>
        <button
          class="nav-btn"
          :class="{ active: abaAtiva === 'conquistas' }"
          @click="abaAtiva = 'conquistas'"
        >
          <fa icon="trophy" />
          <span>Conquistas</span>
        </button>
        <button
          class="nav-btn"
          :class="{ active: abaAtiva === 'corredores' }"
          @click="abaAtiva = 'corredores'"
        >
          <fa icon="boxes-stacked" />
          <span>Corredores</span>
        </button>
        <button
          class="nav-btn"
          :class="{ active: abaAtiva === 'configuracoes' }"
          @click="abaAtiva = 'configuracoes'"
        >
          <fa icon="gear" />
          <span>Ajustes</span>
        </button>
      </nav>
    </div>

    <Transition name="conq-modal">
      <div
        v-if="conquistaSelecionada"
        class="conq-modal-backdrop"
        @click.self="fecharDetalheConquista"
      >
        <div
          class="conq-modal"
          role="dialog"
          aria-modal="true"
          :aria-label="`Detalhes da conquista ${conquistaSelecionada.nome}`"
          :style="{
            '--tier-cor':
              conquistaSelecionada.tierAtualCor ||
              conquistaSelecionada.proximoTier?.cor ||
              '#94a3b8',
          }"
        >
          <div class="conq-modal-head">
            <div class="conq-modal-hero">
              <div class="conq-modal-icon">
                {{
                  conquistaSelecionada.desbloqueada
                    ? conquistaSelecionada.icone
                    : "🔒"
                }}
              </div>
              <div class="conq-modal-copy">
                <div class="conq-modal-meta">
                  <span class="badge info">
                    {{
                      CATEGORIA_LABELS[conquistaSelecionada.categoria] ||
                      conquistaSelecionada.categoria
                    }}
                  </span>
                  <span
                    class="badge conq-status-badge"
                    :class="
                      conquistaSelecionada.desbloqueada ? 'unlocked' : 'pending'
                    "
                  >
                    <fa
                      :icon="
                        conquistaSelecionada.desbloqueada ? 'unlock' : 'lock'
                      "
                    />
                    {{
                      conquistaSelecionada.desbloqueada
                        ? "Desbloqueada"
                        : "Bloqueada"
                    }}
                  </span>
                  <span
                    v-if="conquistaSelecionada.tierAtualLabel"
                    class="badge conq-badge-tier"
                  >
                    {{ conquistaSelecionada.tierAtualLabel }}
                  </span>
                </div>
                <h3 class="conq-modal-title">
                  {{ conquistaSelecionada.nome }}
                </h3>
                <p class="muted conq-modal-desc">
                  {{
                    conquistaSelecionada.descricao || "Sem descrição detalhada."
                  }}
                </p>
              </div>
            </div>
            <button class="btn ghost" @click="fecharDetalheConquista">
              <fa icon="xmark" /> Fechar
            </button>
          </div>

          <div class="conq-modal-grid">
            <div class="conq-modal-stat">
              <span class="conq-modal-stat-label">Data de obtenção</span>
              <strong class="conq-modal-stat-value">
                {{
                  conquistaSelecionada.desbloqueada
                    ? formatarData(conquistaSelecionada.desbloqueadaEm, true)
                    : "Ainda não desbloqueada"
                }}
              </strong>
            </div>
            <div class="conq-modal-stat">
              <span class="conq-modal-stat-label">Progresso atual</span>
              <strong class="conq-modal-stat-value">
                {{
                  formatarValorConquista(
                    conquistaSelecionada.progresso,
                    conquistaSelecionada.metricaBase,
                  )
                }}
              </strong>
              <small class="muted">
                {{
                  METRICA_LABELS[conquistaSelecionada.metricaBase] ||
                  conquistaSelecionada.metricaBase
                }}
              </small>
            </div>
            <div class="conq-modal-stat">
              <span class="conq-modal-stat-label">Tier atual</span>
              <strong class="conq-modal-stat-value">
                {{ conquistaSelecionada.tierAtualLabel || "Bloqueada" }}
              </strong>
              <small class="muted">
                {{ conquistaSelecionada.totalTiersDesbloqueados }} de
                {{ conquistaSelecionada.totalTiers }} tiers desbloqueados
              </small>
            </div>
            <div class="conq-modal-stat">
              <span class="conq-modal-stat-label">Próximo objetivo</span>
              <strong class="conq-modal-stat-value">
                {{
                  conquistaSelecionada.proximoTier
                    ? conquistaSelecionada.proximoTier.label
                    : "Conquista completa"
                }}
              </strong>
              <small class="muted">
                {{
                  conquistaSelecionada.proximoTier
                    ? textoRequisitoTier(
                        conquistaSelecionada,
                        conquistaSelecionada.proximoTier,
                      )
                    : "Você já atingiu o tier máximo desta conquista."
                }}
              </small>
            </div>
          </div>

          <section class="conq-modal-section">
            <div class="row justify-between items-center mb-2">
              <h4 class="section-title mb-0">
                <fa icon="circle-info" /> Requisitos para obter
              </h4>
              <span class="muted conq-modal-section-meta">
                {{
                  METRICA_LABELS[conquistaSelecionada.metricaBase] ||
                  conquistaSelecionada.metricaBase
                }}
              </span>
            </div>
            <div class="conq-req-list">
              <article
                v-for="tier in conquistaSelecionada.tiers"
                :key="tier.nivel"
                class="conq-req-item"
                :class="{ unlocked: tier.desbloqueado }"
                :style="{ '--req-tier-cor': tier.cor }"
              >
                <div class="conq-req-head">
                  <div class="conq-req-tier">
                    <span
                      class="conq-tier-dot"
                      :style="{ background: tier.cor }"
                    />
                    <strong>{{ tier.label }}</strong>
                    <span v-if="tier.titulo" class="muted">
                      · {{ tier.titulo }}
                    </span>
                  </div>
                  <span
                    class="badge conq-status-badge"
                    :class="tier.desbloqueado ? 'unlocked' : 'pending'"
                  >
                    {{ tier.desbloqueado ? "Desbloqueado" : "Pendente" }}
                  </span>
                </div>
                <p class="muted conq-req-copy">
                  {{ textoRequisitoTier(conquistaSelecionada, tier) }}
                </p>
                <div class="conq-tier-progress-wrap">
                  <div class="conq-tier-progress-head">
                    <strong class="conq-tier-progress-value">
                      {{ textoProgressoTier(conquistaSelecionada, tier) }}
                    </strong>
                    <span class="conq-tier-progress-pct">
                      {{ textoPctTier(conquistaSelecionada, tier) }}
                    </span>
                  </div>
                  <div class="conq-tier-progress-track">
                    <span
                      class="conq-tier-progress-fill"
                      :style="{
                        width: `${progressoTierPct(conquistaSelecionada, tier)}%`,
                      }"
                    />
                  </div>
                </div>
                <div class="conq-req-foot muted">
                  <span v-if="tier.xpBonus">
                    <fa icon="bolt" /> +{{ tier.xpBonus }} XP
                  </span>
                  <span v-if="tier.desbloqueado">
                    <fa icon="calendar" />
                    {{
                      formatarData(
                        dataTierDesbloqueado(conquistaSelecionada, tier.nivel),
                      )
                    }}
                  </span>
                </div>
              </article>
            </div>
          </section>

          <section class="conq-modal-section">
            <div class="row justify-between items-center mb-2">
              <h4 class="section-title mb-0">
                <fa icon="medal" /> Histórico de desbloqueio
              </h4>
              <span class="muted conq-modal-section-meta">
                {{ historicoConquistaSelecionada.length }} evento(s)
              </span>
            </div>
            <div
              v-if="historicoConquistaSelecionada.length"
              class="conq-history-list"
            >
              <article
                v-for="item in historicoConquistaSelecionada"
                :key="item.nivel"
                class="conq-history-item"
              >
                <div class="conq-history-head">
                  <div class="conq-req-tier">
                    <span
                      class="conq-tier-dot"
                      :style="{ background: item.cor }"
                    />
                    <strong>{{ item.label }}</strong>
                    <span v-if="item.titulo" class="muted">
                      · {{ item.titulo }}
                    </span>
                  </div>
                  <span class="badge conq-status-badge unlocked">
                    Desbloqueado
                  </span>
                </div>
                <div class="conq-history-meta muted">
                  <span>
                    <fa icon="calendar" />
                    {{ formatarData(item.desbloqueadoEm, true) }}
                  </span>
                  <span>
                    <fa icon="circle-info" />
                    {{ textoRequisitoTier(conquistaSelecionada, item) }}
                  </span>
                  <span v-if="item.xpBonus">
                    <fa icon="bolt" /> +{{ item.xpBonus }} XP
                  </span>
                </div>
              </article>
            </div>
            <div v-else class="empty mini conq-history-empty">
              Essa conquista ainda não possui desbloqueios registrados.
            </div>
          </section>
        </div>
      </div>
    </Transition>

    <Transition name="crop-modal">
      <div
        v-if="cropperAberto"
        class="crop-backdrop"
        @click.self="fecharCropper"
      >
        <div class="crop-dialog">
          <div class="row config-crop-head mb-2">
            <div>
              <h3 class="mt-0 mb-0">Ajustar foto do perfil</h3>
              <p class="muted crop-copy">
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

          <p class="muted crop-tip">
            Arraste a foto até centralizar o rosto dentro do círculo antes de
            salvar.
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
  padding-bottom: env(safe-area-inset-bottom);
}

.portal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
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
  margin: 40px auto;
  background: var(--surface-strong);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  padding: 28px 22px;
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(10px);
}
.portal-card-wide {
  max-width: 560px;
}
.auth-title {
  text-align: center;
  margin: 0 0 6px;
  font-size: 22px;
}
.auth-title-small {
  margin: 0 0 4px;
  font-size: 20px;
}
.auth-sub {
  text-align: center;
  font-size: 14px;
  color: var(--text-dim);
  margin: 0 0 20px;
}
.full-w {
  width: 100%;
  justify-content: center;
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
  gap: 10px;
}
.store-option {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
}
.store-option:hover {
  border-color: var(--border-strong);
}
.store-option.preferred {
  border-color: rgba(124, 92, 255, 0.32);
}
.store-option-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.store-option-icon {
  flex-shrink: 0;
}
.store-option-copy {
  display: grid;
  gap: 2px;
  text-align: left;
}
.store-option-copy strong {
  font-size: 14px;
}

.portal-app {
  max-width: 560px;
  margin: 0 auto;
  min-height: 100vh;
  padding-bottom: 84px;
  display: flex;
  flex-direction: column;
}
.app-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  position: sticky;
  top: 0;
  z-index: 5;
  background: linear-gradient(180deg, var(--bg-0) 70%, transparent);
  backdrop-filter: blur(8px);
}
.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.topbar-avatar {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(124, 92, 255, 0.3);
}
.topbar-greet {
  display: grid;
  line-height: 1.2;
}
.topbar-greet strong {
  font-size: 15px;
}
.icon-btn {
  padding: 10px 12px;
}

.app-content {
  display: grid;
  gap: 14px;
  padding: 4px 16px 20px;
}

.nivel-card {
  padding: 18px;
}
.nivel-card-head {
  display: flex;
  gap: 14px;
  align-items: center;
}
.nivel-emblema {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: 22px;
  background: var(--grad-primary);
  color: #fff;
  display: grid;
  place-items: center;
  text-align: center;
  box-shadow: 0 12px 28px rgba(124, 92, 255, 0.38);
}
.nivel-num {
  font-size: 30px;
  font-weight: 800;
  line-height: 1;
}
.nivel-emblema small {
  font-size: 10px;
  opacity: 0.85;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.nivel-info {
  flex: 1;
  min-width: 0;
}
.nivel-info .nome {
  margin: 0;
  font-size: 17px;
}
.nome-sub {
  font-size: 12px;
  margin: 2px 0 8px;
}
.xp-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 4px;
}
.xp-pts {
  font-weight: 700;
  color: var(--text);
}
.xp-target {
  font-size: 11px;
}
.xp-bar {
  height: 8px;
}
.nivel-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
.nivel-stats > div {
  display: grid;
}
.nivel-stats strong {
  font-size: 17px;
}
.nivel-stats small {
  font-size: 11px;
}

.kpis-tipos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}
.kpi-tipo {
  padding: 14px;
  border-top: 3px solid;
  display: grid;
  gap: 4px;
}
.kpi-valor {
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
}
.kpi-foot {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 6px;
}
.kpi-foot span {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}

.destaque-conquistas {
  padding: 16px;
}
.btn.small {
  padding: 4px 10px;
  font-size: 12px;
}
.destaque-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.empty.mini {
  padding: 20px;
  text-align: center;
  color: var(--text-dim);
  font-size: 13px;
}
.empty.card {
  padding: 24px;
  text-align: center;
  color: var(--text-dim);
}

.conquistas-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}
.conq-summary-num {
  display: flex;
  align-items: center;
  gap: 14px;
}
.conq-summary-ico {
  font-size: 28px;
  color: #f59e0b;
}
.conq-summary-num strong {
  font-size: 20px;
  line-height: 1;
}
.conq-summary-num small {
  display: block;
  font-size: 11px;
}
.conq-summary-help {
  font-size: 12px;
  margin: 0;
}

.conq-filters {
  display: grid;
  gap: 8px;
}
.chip-row {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
}
.chip-row::-webkit-scrollbar {
  display: none;
}
.chip {
  flex-shrink: 0;
  padding: 7px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.chip.active {
  border-color: rgba(124, 92, 255, 0.5);
  background: linear-gradient(
    135deg,
    rgba(124, 92, 255, 0.18),
    rgba(34, 211, 238, 0.1)
  );
}

.conq-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
}

.config-account {
  display: flex;
  gap: 14px;
  align-items: center;
}
.config-avatar {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 22px;
  overflow: hidden;
  cursor: pointer;
  flex-shrink: 0;
}
.avatar-edit {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
  font-size: 11px;
  color: #fff;
  border: 2px solid var(--bg-0);
}
.theme-toggle-group {
  display: flex;
  gap: 10px;
}
.theme-toggle {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-weight: 700;
}
.theme-toggle.active {
  border-color: rgba(124, 92, 255, 0.35);
  background: linear-gradient(
    180deg,
    rgba(124, 92, 255, 0.18),
    rgba(34, 211, 238, 0.08)
  );
}
.btn.danger {
  color: #ef4444;
}

.bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: var(--surface-strong);
  border-top: 1px solid var(--border-strong);
  padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
  z-index: 30;
  backdrop-filter: blur(10px);
}
.nav-btn {
  display: grid;
  place-items: center;
  gap: 2px;
  background: transparent;
  border: 0;
  color: var(--text-dim);
  font-size: 10px;
  font-weight: 600;
  padding: 8px 4px;
  border-radius: 14px;
  cursor: pointer;
}
.nav-btn :deep(svg) {
  font-size: 18px;
}
.nav-btn.active {
  color: var(--text);
  background: linear-gradient(
    180deg,
    rgba(124, 92, 255, 0.22),
    rgba(34, 211, 238, 0.1)
  );
  box-shadow: inset 0 0 0 1px rgba(124, 92, 255, 0.25);
}

.conq-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(6, 10, 18, 0.74);
  backdrop-filter: blur(10px);
  display: grid;
  place-items: center;
  padding: 20px;
  z-index: 70;
}

.conq-modal {
  width: min(100%, 780px);
  max-height: min(90vh, 920px);
  overflow-y: auto;
  border-radius: 28px;
  padding: 22px;
  border: 1px solid var(--border-strong);
  background:
    radial-gradient(
      circle at top left,
      color-mix(in srgb, var(--tier-cor) 14%, transparent),
      transparent 42%
    ),
    var(--bg-2);
  box-shadow: var(--shadow-lg);
  display: grid;
  gap: 18px;
}

.conq-modal-head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.conq-modal-hero {
  display: grid;
  grid-template-columns: 84px 1fr;
  gap: 16px;
  min-width: 0;
}

.conq-modal-icon {
  width: 84px;
  height: 84px;
  border-radius: 26px;
  display: grid;
  place-items: center;
  font-size: 40px;
  background: linear-gradient(
    135deg,
    var(--tier-cor),
    color-mix(in srgb, var(--tier-cor) 58%, #000)
  );
  color: #fff;
  box-shadow: 0 18px 32px color-mix(in srgb, var(--tier-cor) 28%, transparent);
}

.conq-modal-copy {
  min-width: 0;
}

.conq-modal-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.conq-badge-tier {
  color: var(--tier-cor);
  border-color: color-mix(in srgb, var(--tier-cor) 42%, transparent);
  background: color-mix(in srgb, var(--tier-cor) 10%, transparent);
}

.conq-modal-title {
  margin: 10px 0 6px;
  font-size: 28px;
  line-height: 1.1;
}

.conq-modal-desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
}

.conq-modal-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.conq-modal-stat,
.conq-modal-section {
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface-strong);
}

.conq-modal-stat {
  padding: 16px;
  display: grid;
  gap: 6px;
}

.conq-modal-stat-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--text-dim);
}

.conq-modal-stat-value {
  font-size: 18px;
  line-height: 1.3;
}

.conq-modal-section {
  padding: 18px;
}

.conq-modal-section-meta {
  font-size: 12px;
}

.conq-req-list,
.conq-history-list {
  display: grid;
  gap: 12px;
}

.conq-req-item,
.conq-history-item {
  border: 1px solid var(--border);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.02);
  padding: 14px;
  display: grid;
  gap: 8px;
}

.conq-req-item.unlocked {
  border-color: color-mix(in srgb, var(--tier-cor) 22%, var(--border));
}

.conq-req-head,
.conq-history-head {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.conq-req-tier {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.conq-req-copy {
  margin: 0;
  font-size: 13px;
}

.conq-status-badge {
  border: 1px solid transparent;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.55px;
  text-transform: uppercase;
}

.conq-status-badge.unlocked {
  color: #d1fae5;
  background: rgba(16, 185, 129, 0.22);
  border-color: rgba(52, 211, 153, 0.4);
}

.conq-status-badge.pending {
  color: #e2e8f0;
  background: rgba(100, 116, 139, 0.2);
  border-color: rgba(148, 163, 184, 0.26);
}

.conq-tier-progress-wrap {
  display: grid;
  gap: 6px;
}

.conq-tier-progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
}

.conq-tier-progress-value,
.conq-tier-progress-pct {
  font-variant-numeric: tabular-nums;
}

.conq-tier-progress-value {
  font-size: 12px;
}

.conq-tier-progress-pct {
  color: var(--text-dim);
  font-weight: 700;
}

.conq-tier-progress-track {
  position: relative;
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: color-mix(
    in srgb,
    var(--req-tier-cor) 12%,
    rgba(148, 163, 184, 0.14)
  );
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--req-tier-cor) 18%, transparent),
    inset 0 1px 2px rgba(15, 23, 42, 0.12);
}

.conq-tier-progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--req-tier-cor) 74%, #ffffff),
    var(--req-tier-cor)
  );
  box-shadow: 0 0 16px color-mix(in srgb, var(--req-tier-cor) 28%, transparent);
}

.conq-req-foot,
.conq-history-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
}

.conq-history-empty {
  min-height: 96px;
}

.conq-modal-enter-active,
.conq-modal-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.conq-modal-enter-from,
.conq-modal-leave-to {
  opacity: 0;
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

:global(.topbar-avatar .colaborador-avatar),
:global(.config-avatar .colaborador-avatar) {
  box-shadow: none;
}

:global([data-theme="light"]) .crop-dialog {
  background: rgba(255, 255, 255, 0.98);
}
:global([data-theme="light"]) .conq-modal-backdrop {
  background: rgba(28, 36, 61, 0.34);
}
:global([data-theme="light"]) .conq-modal {
  background:
    radial-gradient(
      circle at top left,
      color-mix(in srgb, var(--tier-cor) 10%, transparent),
      transparent 40%
    ),
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.98),
      rgba(245, 248, 255, 0.97)
    );
  border-color: rgba(89, 108, 165, 0.24);
  box-shadow: 0 30px 70px rgba(53, 70, 120, 0.22);
}
:global([data-theme="light"]) .conq-modal-stat,
:global([data-theme="light"]) .conq-modal-section,
:global([data-theme="light"]) .conq-req-item,
:global([data-theme="light"]) .conq-history-item {
  background: rgba(255, 255, 255, 0.94);
  border-color: rgba(89, 108, 165, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}
:global([data-theme="light"]) .conq-status-badge.unlocked {
  color: #047857;
  background: rgba(16, 185, 129, 0.16);
  border-color: rgba(16, 185, 129, 0.28);
}
:global([data-theme="light"]) .conq-status-badge.pending {
  color: #475569;
  background: rgba(148, 163, 184, 0.14);
  border-color: rgba(100, 116, 139, 0.2);
}
:global([data-theme="light"]) .conq-tier-progress-track {
  background: color-mix(
    in srgb,
    var(--req-tier-cor) 10%,
    rgba(148, 163, 184, 0.12)
  );
  box-shadow:
    inset 0 0 0 1px
      color-mix(in srgb, var(--req-tier-cor) 14%, rgba(89, 108, 165, 0.18)),
    inset 0 1px 2px rgba(89, 108, 165, 0.08);
}
:global([data-theme="light"]) .theme-toggle.active {
  background: linear-gradient(
    180deg,
    rgba(109, 92, 255, 0.14),
    rgba(17, 197, 255, 0.08)
  );
}
:global([data-theme="light"]) .bottom-nav {
  background: rgba(255, 255, 255, 0.92);
}

@media (min-width: 720px) {
  .conq-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .destaque-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
@media (min-width: 980px) {
  .portal-app {
    max-width: 880px;
  }
  .conq-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 720px) {
  .conq-modal {
    padding: 18px;
  }

  .conq-modal-head {
    flex-direction: column;
  }

  .conq-modal-hero,
  .conq-modal-grid {
    grid-template-columns: 1fr;
  }

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

<style>
/* ConquistaCard styles (não-scoped pois o componente é registrado via render h() e não recebe class hash do scoped) */
.conq-card {
  position: relative;
  border-radius: 18px;
  padding: 16px;
  border: 1px solid var(--border-strong);
  background: var(--surface-strong);
  overflow: hidden;
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 14px;
  align-items: start;
  --tier-cor: #94a3b8;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}
.conq-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
}
.conq-card.locked {
  opacity: 0.78;
  filter: grayscale(0.55);
}
.conq-card-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    circle at 0% 0%,
    var(--tier-cor) -100%,
    transparent 70%
  );
  opacity: 0.18;
}
.conq-card-icon {
  position: relative;
  z-index: 1;
  width: 64px;
  height: 64px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  font-size: 32px;
  color: #fff;
  background: linear-gradient(
    135deg,
    var(--tier-cor),
    color-mix(in srgb, var(--tier-cor) 55%, #000)
  );
  box-shadow: 0 8px 22px color-mix(in srgb, var(--tier-cor) 45%, transparent);
}
.conq-card.locked .conq-card-icon {
  background: linear-gradient(135deg, #475569, #1f2937);
  box-shadow: none;
  font-size: 24px;
}
.conq-card-body {
  position: relative;
  z-index: 1;
  min-width: 0;
}
.conq-card-tier {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--tier-cor);
  margin-bottom: 4px;
}
.conq-tier-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.conq-card-tier.locked-label {
  color: var(--text-dim);
}
.conq-card-nome {
  display: block;
  font-size: 15px;
}
.conq-card-desc {
  font-size: 12px;
  margin: 4px 0 8px;
  color: var(--text-dim);
}
.conq-progress {
  display: grid;
  gap: 4px;
}
.conq-progress-head {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}
.conq-progress-meta {
  font-variant-numeric: tabular-nums;
}
.conq-bar {
  height: 8px;
  background: rgba(148, 163, 184, 0.18);
}
.conq-progress-max {
  font-size: 12px;
  color: #f59e0b;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.conq-tiers {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.conq-tier-pill {
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px dashed var(--border);
  font-size: 10px;
  font-weight: 700;
  color: var(--text-dim);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.conq-tier-pill.unlocked {
  border-style: solid;
}
.conq-card.compact {
  padding: 12px;
  grid-template-columns: 48px 1fr;
  gap: 10px;
}
.conq-card.compact .conq-card-icon {
  width: 48px;
  height: 48px;
  font-size: 24px;
  border-radius: 14px;
}
.conq-card.compact .conq-card-nome {
  font-size: 13px;
}
.conq-card[role="button"] {
  cursor: pointer;
}
.conq-card[role="button"]:focus-visible {
  outline: 2px solid var(--tier-cor);
  outline-offset: 3px;
}
</style>
