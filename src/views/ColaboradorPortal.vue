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
  watch,
  defineComponent,
  h,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import api from "@/services/api";
import {
  precarregarImagem,
  precarregarImagens,
  resolverUrlMidia,
} from "@/utils/media";
import AppChart from "@/components/AppChart.vue";
import AuditoriaDodia from "@/components/AuditoriaDodia.vue";
import ColaboradorAvatar from "@/components/ColaboradorAvatar.vue";
import InstallPWA from "@/components/InstallPWA.vue";
import PerfilPublicoColaborador from "@/components/PerfilPublicoColaborador.vue";
import StoreAvatar from "@/components/StoreAvatar.vue";

const route = useRoute();
const router = useRouter();

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
const abaAtiva = ref("inicio"); // inicio | conquistas | corredores | ranking | configuracoes
const perfil = ref(null);
const metricas = ref(null);
const conquistasResolvidas = ref([]);
const colegasEquipe = ref([]);
const carregandoColegas = ref(false);
const erroColegas = ref("");
const colegaSelecionado = ref(null);
const perfilPublicoColega = ref(null);
const carregandoPerfilPublico = ref(false);
const erroPerfilPublico = ref("");
const conquistaSelecionada = ref(null);
const imagemAmpliada = ref(null); // { url, alt } para lightbox
const filtroCategoriaConq = ref("todas");
const filtroStatusConq = ref("todas");
const rankingGeral = ref({
  posicao: null,
  totalColaboradores: 0,
  totalItensLidos: 0,
});

// ---- Ranking da loja (aba Ranking) ----
const rankingLoja = ref([]);
const carregandoRankingLoja = ref(false);
const erroRankingLoja = ref("");
const periodoRankingLoja = ref("7d");
const tipoRankingLoja = ref("");
const rankingLojaCarregado = ref(false);

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

// Reset de senha após 3 tentativas erradas
const tentativasErradas = ref(0);
const novaSenhaReset = ref("");
const confirmarSenhaReset = ref("");

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
  comum: { ordem: 1, label: "Comum", cor: "#94a3b8" },
  raro: { ordem: 2, label: "Raro", cor: "#3b82f6" },
  epico: { ordem: 3, label: "Épico", cor: "#a855f7" },
  lendario: { ordem: 4, label: "Lendário", cor: "#f59e0b" },
  diamante: { ordem: 5, label: "Diamante", cor: "#06b6d4" },
  mitico: { ordem: 6, label: "Mítico", cor: "#ef4444" },
  suprema: { ordem: 7, label: "Suprema", cor: "#fbbf24" },
  transcendente: { ordem: 8, label: "Transcendente", cor: "#ec4899" },
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
  totalLiderPodium: "Vezes no pódio",
  taxaConformidadeAcumulada: "Taxa de conformidade",
  pontuacao: "Pontuação (XP)",
  nivel: "Nível",
};

const corPorTipo = {
  ETIQUETA: "#7c5cff",
  PRESENCA: "#22d3ee",
  RUPTURA: "#f59e0b",
};

const CONQUISTA_TIER_IMAGES = {
  PARTICIPACAO_LOJA: {
    comum: "/image/conquistas/foca-tarefa-comum.png",
    raro: "/image/conquistas/foca-tarefa-rare.png",
    epico: "/image/conquistas/foca-tarefa-epic.png",
    lendario: "/image/conquistas/foca-tarefa-lendary.png",
    diamante: "/image/conquistas/foca-tarefa-diamond.png",
    mitico: "/image/conquistas/foca-tarefa-mitico.png",
  },
};

function nivelImagemConquista(conquista, nivel = "") {
  const fallbackNivel = Array.isArray(conquista?.tiers)
    ? conquista.tiers[0]?.nivel || ""
    : "";
  return String(nivel || conquista?.tierAtual || fallbackNivel || "")
    .trim()
    .toLowerCase();
}

function imagemConquistaPorTier(conquista, nivel = "") {
  const tierAtual = nivelImagemConquista(conquista, nivel);
  if (!tierAtual) return "";

  if (!nivel && conquista?.tierAtualImagem) {
    return resolverUrlMidia(conquista.tierAtualImagem);
  }

  if (Array.isArray(conquista?.tiers)) {
    const t = conquista.tiers.find(
      (x) => String(x.nivel).toLowerCase() === tierAtual,
    );
    if (t?.imagemUrl) return resolverUrlMidia(t.imagemUrl);
  }

  const imagensPorTier = CONQUISTA_TIER_IMAGES[conquista?.codigo];
  if (!imagensPorTier) return "";
  return imagensPorTier[tierAtual] || "";
}

function iconeConquista(conquista) {
  return conquista?.icone || "🏅";
}

function altImagemConquistaTier(conquista, nivel = "") {
  const tierAtual = Array.isArray(conquista?.tiers)
    ? conquista.tiers.find(
        (item) =>
          String(item?.nivel || "").toLowerCase() ===
          nivelImagemConquista(conquista, nivel),
      )
    : null;

  return [
    conquista?.nome,
    tierAtual?.label || tierAtual?.nivel || conquista?.tierAtualLabel,
  ]
    .filter(Boolean)
    .join(" • ");
}

function altImagemConquista(conquista) {
  return altImagemConquistaTier(conquista);
}

function ordenarConquistasPorRelevancia(lista) {
  return [...(lista || [])].sort((a, b) => {
    if (a.desbloqueada !== b.desbloqueada) return a.desbloqueada ? -1 : 1;
    return (b.totalTiersDesbloqueados || 0) - (a.totalTiersDesbloqueados || 0);
  });
}

function coletarUrlsImagensConquistas(lista) {
  return Array.from(
    new Set(
      ordenarConquistasPorRelevancia(lista)
        .flatMap((conquista) => [
          imagemConquistaPorTier(conquista),
          ...(Array.isArray(conquista?.tiers)
            ? conquista.tiers.map((tier) =>
                imagemConquistaPorTier(conquista, tier.nivel),
              )
            : []),
        ])
        .filter(Boolean),
    ),
  );
}

async function aquecerImagensConquistas(lista) {
  const urls = coletarUrlsImagensConquistas(lista);
  if (!urls.length) return;

  await Promise.race([
    precarregarImagens(urls, {
      prioridadeImediata: Math.min(4, urls.length),
      prioridade: "high",
    }),
    new Promise((resolve) => setTimeout(resolve, 180)),
  ]);
}

const colegaIdRota = computed(() => String(route.params.colegaId || "").trim());
const colegaIdQuery = computed(() => String(route.query.colegaId || "").trim());
const colegaIdAtivo = computed(() => colegaIdRota.value || colegaIdQuery.value);
const estaNaRotaColega = computed(
  () => route.path.startsWith("/portal/colegas/") || !!colegaIdQuery.value,
);
const exibindoPerfilPublico = computed(
  () => etapa.value === "portal" && !!colegaIdAtivo.value,
);
const tituloPerfilPublico = computed(
  () =>
    perfilPublicoColega.value?.colaborador?.nome ||
    colegaSelecionado.value?.nome ||
    "Perfil público",
);
const imagemConquistaSelecionada = computed(() =>
  imagemConquistaPorTier(conquistaSelecionada.value),
);

// ConquistaCard como componente local definido via render function (sem template parser em runtime).
const ConquistaCard = defineComponent({
  name: "ConquistaCard",
  emits: ["select", "imageClick"],
  props: {
    c: { type: Object, required: true },
    compact: { type: Boolean, default: false },
    priority: { type: Boolean, default: false },
  },
  setup(props, { emit }) {
    return () => {
      const c = props.c;
      const tierCor = c.tierAtualCor || "#94a3b8";
      const imagemConquista = imagemConquistaPorTier(c);
      const cls = [
        "conq-card",
        c.desbloqueada ? "" : "locked",
        props.compact ? "compact" : "",
        "tier-" + (c.tierAtual || "locked"),
      ]
        .filter(Boolean)
        .join(" ");
      const abrirDetalhes = () => emit("select", c);
      const abrirImagem = (event) => {
        event.stopPropagation();
        emit("imageClick", {
          url: imagemConquista,
          alt: altImagemConquista(c),
        });
      };

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
          h("div", { class: "conq-card-head" }, [
            h(
              "div",
              {
                class: ["conq-card-icon", imagemConquista ? "has-image" : ""],
              },
              [
                imagemConquista
                  ? h(
                      "button",
                      {
                        class: "conq-icon-btn conq-card-img-btn",
                        title: `Ampliar imagem de ${altImagemConquista(c)}`,
                        onClick: abrirImagem,
                        "aria-label": `Ampliar imagem de ${altImagemConquista(c)}`,
                      },
                      [
                        h("img", {
                          class: "conq-icon-image",
                          src: imagemConquista,
                          alt: altImagemConquista(c),
                          loading: props.priority ? "eager" : "lazy",
                          decoding: "async",
                          fetchpriority: props.priority ? "high" : "low",
                          width: 64,
                          height: 64,
                          draggable: false,
                        }),
                      ],
                    )
                  : c.desbloqueada
                    ? iconeConquista(c)
                    : h("i", { class: "fa-solid fa-lock" }),
              ],
            ),
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
              c.proximoTier
                ? h("div", { class: "progress conq-bar" }, [
                    h("span", {
                      style: {
                        width: c.progressoPct + "%",
                        background: c.proximoTier.cor,
                      },
                    }),
                  ])
                : null,
            ]),
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
  tentativasErradas.value = 0;
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
  tentativasErradas.value = 0;
  novaSenhaReset.value = "";
  confirmarSenhaReset.value = "";
  etapa.value = loja.primeiroAcesso ? "setup" : "login";
}

function voltarParaBusca() {
  if (estaNaRotaColega.value) {
    void router.replace({ path: "/portal", query: route.query });
  }
  lojaSlug.value = "";
  lojaSelecionada.value = null;
  lojasDisponiveis.value = [];
  matricula.value = "";
  primeiroNome.value = "";
  perfil.value = null;
  metricas.value = null;
  conquistasResolvidas.value = [];
  colegasEquipe.value = [];
  erroColegas.value = "";
  limparPerfilPublicoColega();
  conquistaSelecionada.value = null;
  imagemAmpliada.value = null;
  limparFormularioSenha();
  etapa.value = "buscar";
}

function abrirDetalheConquista(conquista) {
  const imagem = imagemConquistaPorTier(conquista);
  if (imagem) void precarregarImagem(imagem, { prioridade: "high" });
  conquistaSelecionada.value = conquista;
}

function fecharDetalheConquista() {
  conquistaSelecionada.value = null;
  imagemAmpliada.value = null;
}

function abrirVisualizacaoImagem(url, alt = "") {
  if (!url) return;
  imagemAmpliada.value = { url: resolverUrlMidia(url), alt };
}

function fecharVisualizacaoImagem() {
  imagemAmpliada.value = null;
}

function voltarParaSelecao() {
  limparFormularioSenha();
  tentativasErradas.value = 0;
  novaSenhaReset.value = "";
  confirmarSenhaReset.value = "";
  etapa.value = "selecionar";
}

function irParaReset() {
  novaSenhaReset.value = "";
  confirmarSenhaReset.value = "";
  erro.value = "";
  etapa.value = "reset";
}

function voltarParaLogin() {
  limparFormularioSenha();
  tentativasErradas.value = 0;
  etapa.value = "login";
}

async function executarResetSenha() {
  if (novaSenhaReset.value.length < 6) {
    erro.value = "Mínimo de 6 caracteres.";
    return;
  }
  if (novaSenhaReset.value !== confirmarSenhaReset.value) {
    erro.value = "As senhas não coincidem.";
    return;
  }
  carregando.value = true;
  erro.value = "";
  try {
    const { data } = await api.post("/auth/portal/reset-senha", {
      matricula: matricula.value.trim(),
      lojaSlug: lojaSlug.value.trim(),
      novaSenha: novaSenhaReset.value,
    });
    token.value = data.token;
    localStorage.setItem("na_portal_token", data.token);
    tentativasErradas.value = 0;
    await carregarPerfil();
    etapa.value = "portal";
  } catch (e) {
    erro.value = e?.response?.data?.error || "Erro ao redefinir senha.";
  } finally {
    carregando.value = false;
  }
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
    tentativasErradas.value = 0;
    await carregarPerfil();
    etapa.value = "portal";
  } catch (e) {
    tentativasErradas.value++;
    if (tentativasErradas.value >= 3) {
      erro.value = "Senha incorreta 3 vezes. Deseja redefinir sua senha?";
    } else {
      erro.value =
        e?.response?.data?.error ||
        `Senha incorreta. Tentativa ${tentativasErradas.value} de 3.`;
    }
  } finally {
    carregando.value = false;
  }
}

async function carregarPerfil() {
  const [perfilResponse, metricasResponse, rankingResponse] = await Promise.all(
    [
      apiPortal().get("/colaboradores/portal/me"),
      apiPortal().get("/metricas/portal/me?periodo=tudo"),
      apiPortal()
        .get("/metricas/portal/me/ranking-geral")
        .catch(() => ({ data: { posicao: null, totalColaboradores: 0 } })),
    ],
  );

  const perfilData = perfilResponse.data;
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

  const conquistasPortal = metricasResponse.data.conquistas || [];
  const aquecimentoConquistas = aquecerImagensConquistas(conquistasPortal);

  metricas.value = metricasResponse.data;
  conquistasResolvidas.value = conquistasPortal;
  rankingGeral.value = rankingResponse.data || {
    posicao: null,
    totalColaboradores: 0,
    totalItensLidos: 0,
  };
  await carregarColegas();
  await aquecimentoConquistas;
}

async function carregarRankingLoja() {
  carregandoRankingLoja.value = true;
  erroRankingLoja.value = "";
  try {
    const params = { periodo: periodoRankingLoja.value };
    if (tipoRankingLoja.value) params.tipo = tipoRankingLoja.value;
    const { data } = await apiPortal().get("/metricas/portal/me/ranking-loja", {
      params,
    });
    rankingLoja.value = data?.items || [];
    rankingLojaCarregado.value = true;
  } catch (e) {
    erroRankingLoja.value =
      e?.response?.data?.error || "Não foi possível carregar o ranking.";
    rankingLoja.value = [];
  } finally {
    carregandoRankingLoja.value = false;
  }
}

watch(abaAtiva, (nova) => {
  if (nova === "ranking" && !carregandoRankingLoja.value) {
    carregarRankingLoja();
  }
});
watch([periodoRankingLoja, tipoRankingLoja], () => {
  if (abaAtiva.value === "ranking") carregarRankingLoja();
});

async function carregarColegas() {
  carregandoColegas.value = true;
  erroColegas.value = "";
  try {
    const { data } = await apiPortal().get("/metricas/portal/me/colegas");
    const lista = data.items || [];

    // Injeta o próprio colaborador na lista
    if (perfil.value?._id) {
      lista.push({
        _id: perfil.value._id,
        nome: perfil.value.nome,
        cargo: perfil.value.cargo,
        avatarUrl: perfil.value.avatarUrl,
        nivel: perfil.value.nivel,
        pontuacao: perfil.value.pontuacao,
        totalAuditorias: perfil.value.totalAuditorias,
        totalItensLidos: perfil.value.totalItensLidos,
        taxaConformidade: perfil.value.taxaConformidade,
        euMesmo: true,
      });
    }

    // Ordena por itens lidos decrescente para refletir o ranking real
    lista.sort((a, b) => (b.totalItensLidos || 0) - (a.totalItensLidos || 0));

    colegasEquipe.value = lista;
    if (colegaIdAtivo.value) {
      colegaSelecionado.value =
        colegasEquipe.value.find(
          (colega) => String(colega._id) === colegaIdAtivo.value,
        ) || colegaSelecionado.value;
    }
  } catch (e) {
    colegasEquipe.value = [];
    erroColegas.value =
      e?.response?.data?.error || "Não foi possível carregar os colegas agora.";
  } finally {
    carregandoColegas.value = false;
  }
}

function serializarQueryPortal(query) {
  const params = new URLSearchParams();

  for (const [chave, valor] of Object.entries(query || {})) {
    if (Array.isArray(valor)) {
      for (const item of valor) {
        if (item != null && item !== "") params.append(chave, String(item));
      }
      continue;
    }

    if (valor != null && valor !== "") params.append(chave, String(valor));
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

function urlPerfilPublicoColega(colegaId) {
  return `/portal${serializarQueryPortal({
    ...route.query,
    colegaId,
  })}`;
}

function abrirPerfilPublicoColega(colegaId, event) {
  if (
    event?.defaultPrevented ||
    event?.button > 0 ||
    event?.metaKey ||
    event?.ctrlKey ||
    event?.shiftKey ||
    event?.altKey
  ) {
    return;
  }

  event?.preventDefault();
  void router.push({
    path: "/portal",
    query: {
      ...route.query,
      colegaId,
    },
  });
}

function queryPortalSemColega() {
  const query = { ...route.query };
  delete query.colegaId;
  return query;
}

function nomeColegaLista(nome) {
  const primeiroNome = String(nome || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0];

  if (!primeiroNome) return "Colega";
  return primeiroNome.length > 12
    ? `${primeiroNome.slice(0, 12)}…`
    : primeiroNome;
}

function limparPerfilPublicoColega() {
  colegaSelecionado.value = null;
  perfilPublicoColega.value = null;
  carregandoPerfilPublico.value = false;
  erroPerfilPublico.value = "";
}

async function carregarPerfilPublicoColega(colegaId) {
  colegaSelecionado.value =
    colegasEquipe.value.find(
      (colega) => String(colega._id) === String(colegaId),
    ) || null;
  perfilPublicoColega.value = null;
  erroPerfilPublico.value = "";
  carregandoPerfilPublico.value = true;
  try {
    const { data } = await apiPortal().get(
      `/metricas/portal/me/colegas/${colegaId}/perfil?periodo=tudo`,
    );
    perfilPublicoColega.value = data;

    if (!colegaSelecionado.value && data?.colaborador) {
      colegaSelecionado.value = {
        _id: data.colaborador._id,
        nome: data.colaborador.nome,
        cargo: data.colaborador.cargo,
        avatarUrl: data.colaborador.avatarUrl,
        nivel: data.colaborador.nivel,
        pontuacao: data.colaborador.pontuacao,
        totalAuditorias: data.colaborador.totalAuditorias,
        totalItensLidos: data.colaborador.totalItensLidos,
        taxaConformidade: data.colaborador.taxaConformidade,
      };
    }
  } catch (e) {
    erroPerfilPublico.value =
      e?.response?.data?.error ||
      "Não foi possível abrir o perfil público deste colega.";
  } finally {
    carregandoPerfilPublico.value = false;
  }
}

function voltarParaInicioPortal() {
  limparPerfilPublicoColega();
  void router.push({ path: "/portal", query: queryPortalSemColega() });
}

function sair() {
  token.value = "";
  localStorage.removeItem("na_portal_token");
  if (estaNaRotaColega.value) {
    void router.replace({ path: "/portal", query: queryPortalSemColega() });
  }
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

// Mapa de _id → posição no ranking de itens lidos (top 3 ganham destaque)
const rankingColegas = computed(() => {
  const sorted = [...colegasEquipe.value].sort(
    (a, b) => (b.totalItensLidos || 0) - (a.totalItensLidos || 0),
  );
  const mapa = new Map();
  sorted.forEach((c, i) => {
    if (i < 3) mapa.set(String(c._id), i + 1);
  });
  return mapa;
});

function rankColega(id) {
  return rankingColegas.value.get(String(id)) ?? null;
}

function rankColegaClass(id) {
  const r = rankColega(id);
  if (r === 1) return "colega-rank-ouro";
  if (r === 2) return "colega-rank-prata";
  if (r === 3) return "colega-rank-bronze";
  return "";
}

function rankColegaTrophy(id) {
  const r = rankColega(id);
  if (r === 1) return "🏆";
  if (r === 2) return "🥈";
  if (r === 3) return "🥉";
  return null;
}

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

watch([() => etapa.value, colegaIdAtivo], async ([etapaAtual, colegaId]) => {
  if (etapaAtual !== "portal") return;
  if (!colegaId) {
    limparPerfilPublicoColega();
    return;
  }
  await carregarPerfilPublicoColega(colegaId);
});

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
          v-if="etapa === 'login' && tentativasErradas >= 3"
          class="btn warn full-w"
          @click="irParaReset"
        >
          <fa icon="key" /> Esqueceu a senha? Redefinir agora
        </button>
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

    <!-- Reset de senha (após 3 tentativas erradas) -->
    <div v-else-if="etapa === 'reset'" class="portal-card">
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
      <h2 class="auth-title-small">Redefinir senha</h2>
      <p class="auth-sub">
        {{ primeiroNome }}, sua matrícula é <strong>{{ matricula }}</strong
        >. Defina uma nova senha abaixo.
      </p>
      <div class="grid gap-3">
        <div class="field">
          <label>Nova senha (mínimo 6 caracteres)</label>
          <input
            type="password"
            v-model="novaSenhaReset"
            placeholder="••••••"
            @keyup.enter="executarResetSenha"
          />
        </div>
        <div class="field">
          <label>Confirmar nova senha</label>
          <input
            type="password"
            v-model="confirmarSenhaReset"
            placeholder="••••••"
            @keyup.enter="executarResetSenha"
          />
        </div>
        <div v-if="erro" class="badge bad full-w">{{ erro }}</div>
        <button
          class="btn primary full-w"
          :disabled="carregando"
          @click="executarResetSenha"
        >
          <fa :icon="carregando ? 'spinner' : 'key'" :spin="carregando" />
          {{ carregando ? "Redefinindo..." : "Redefinir senha e entrar" }}
        </button>
        <button class="btn ghost full-w" @click="voltarParaLogin">
          Voltar para o login
        </button>
      </div>
    </div>

    <!-- ============== PORTAL AUTENTICADO ============== -->
    <div v-else-if="etapa === 'portal' && perfil" class="portal-app">
      <header
        class="app-topbar"
        :class="{ 'app-topbar-profile': exibindoPerfilPublico }"
      >
        <div v-if="!exibindoPerfilPublico" class="topbar-left">
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
        <div v-else class="topbar-left topbar-left-profile">
          <button
            class="btn ghost small portal-back-btn"
            @click="voltarParaInicioPortal"
          >
            <fa icon="arrow-right" class="portal-back-icon" /> Equipe
          </button>
          <div class="topbar-greet topbar-profile-copy">
            <small class="muted">Perfil público</small>
          </div>
        </div>
        <button class="btn ghost icon-btn" @click="sair" title="Sair">
          <fa icon="right-from-bracket" />
        </button>
      </header>

      <main
        v-if="exibindoPerfilPublico"
        class="app-content app-content-profile"
      >
        <PerfilPublicoColaborador
          :carregando="carregandoPerfilPublico"
          :erro="erroPerfilPublico"
          :perfil="perfilPublicoColega"
          :colega-resumo="colegaSelecionado"
          :ranking-geral="perfilPublicoColega?.rankingGeral || null"
          @select-conquista="abrirDetalheConquista"
        />
      </main>

      <!-- ABA INÍCIO -->
      <main v-else-if="abaAtiva === 'inicio'" class="app-content">
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
            <div
              class="ranking-stat"
              :class="{
                'rank-ouro': rankingGeral.posicao === 1,
                'rank-prata': rankingGeral.posicao === 2,
                'rank-bronze': rankingGeral.posicao === 3,
              }"
            >
              <strong v-if="rankingGeral.posicao" class="rank-pos">
                <span v-if="rankingGeral.posicao === 1" class="rank-trophy"
                  >🏆</span
                >
                <span v-else-if="rankingGeral.posicao === 2" class="rank-trophy"
                  >🥈</span
                >
                <span v-else-if="rankingGeral.posicao === 3" class="rank-trophy"
                  >🥉</span
                >
                <span v-else class="rank-num">#</span>{{ rankingGeral.posicao }}
              </strong>
              <strong v-else class="rank-pos rank-nd">—</strong>
              <small class="muted">ranking geral</small>
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
            <div class="kpi-valor">{{ formatNum(t.totalLidos) }}</div>
            <small class="muted">itens lidos</small>
            <div class="kpi-foot">
              <span
                ><fa icon="shield-halved" />
                {{
                  t.totalLidos
                    ? ((t.totalConformes / t.totalLidos) * 100).toFixed(1)
                    : 0
                }}%
              </span>
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
              priority
              @select="abrirDetalheConquista"
              @imageClick="({ url, alt }) => abrirVisualizacaoImagem(url, alt)"
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

        <section class="card colegas-card">
          <div class="colegas-head">
            <div>
              <h3 class="section-title">
                <fa icon="users" /> Colegas da equipe
              </h3>
              <p class="muted colegas-help">
                Abra o perfil público do seu time para acompanhar fotos,
                conquistas e resultados.
              </p>
            </div>
            <span v-if="colegasEquipe.length" class="colega-count">
              {{ colegasEquipe.length }}
            </span>
          </div>

          <div v-if="carregandoColegas" class="colegas-state muted">
            <fa icon="spinner" spin />
            <span>Carregando equipe...</span>
          </div>

          <div v-else-if="erroColegas" class="badge bad full-w">
            {{ erroColegas }}
          </div>

          <div v-else-if="!colegasEquipe.length" class="empty mini">
            Sua loja ainda não tem outros colegas ativos no portal.
          </div>

          <div v-else class="colegas-list">
            <a
              v-for="colega in colegasEquipe"
              :key="colega._id"
              class="colega-card"
              :class="rankColegaClass(colega._id)"
              :href="urlPerfilPublicoColega(colega._id)"
              :title="colega.nome"
              @click="abrirPerfilPublicoColega(colega._id, $event)"
            >
              <!-- Varredura de brilho (top 3) -->
              <div
                v-if="rankColega(colega._id)"
                class="colega-shine"
                aria-hidden="true"
              />

              <!-- Partículas (top 3) -->
              <div
                v-if="rankColega(colega._id)"
                class="colega-particles"
                aria-hidden="true"
              >
                <span class="cp p1" /><span class="cp p2" /><span
                  class="cp p3"
                />
                <span class="cp p4" /><span class="cp p5" />
              </div>

              <!-- Medalha de posição -->
              <div
                v-if="rankColegaTrophy(colega._id)"
                class="colega-rank-badge"
              >
                {{ rankColegaTrophy(colega._id) }}
              </div>

              <div class="colega-main">
                <ColaboradorAvatar
                  :nome="colega.nome"
                  :avatar-url="colega.avatarUrl"
                  :size="54"
                  :font-size="18"
                />
                <div class="colega-body">
                  <strong>{{ nomeColegaLista(colega.nome) }}</strong>
                  <small
                    :class="colega.euMesmo ? 'colega-eu-label' : 'muted'"
                    >{{
                      colega.euMesmo ? "Você" : colega.cargo || "Equipe da loja"
                    }}</small
                  >
                </div>
              </div>
              <div class="colega-link">
                <span>Abrir perfil</span>
                <fa icon="chevron-right" />
              </div>
            </a>
          </div>
        </section>
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
            Cada conquista evolui em até 8 tiers — Comum, Raro, Épico, Lendário,
            Diamante, Mítico, Suprema e Transcendente. Continue auditando para
            ganhar XP bônus!
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
            @imageClick="({ url, alt }) => abrirVisualizacaoImagem(url, alt)"
          />
        </div>
      </main>

      <!-- ABA CORREDORES -->
      <main v-else-if="abaAtiva === 'corredores'" class="app-content">
        <AuditoriaDodia :token="token" />
      </main>

      <!-- ABA RANKING DA LOJA -->
      <main v-else-if="abaAtiva === 'ranking'" class="app-content">
        <section class="card ranking-loja-card">
          <header class="ranking-loja-head">
            <div>
              <h3 class="section-title">
                <fa icon="ranking-star" /> Ranking da loja
              </h3>
              <p class="muted small">
                Compare seu desempenho com os colegas da
                {{ lojaSelecionada?.nomeLoja || "loja" }}.
              </p>
            </div>
          </header>

          <div class="ranking-loja-filtros">
            <div class="chip-group">
              <button
                v-for="opt in [
                  { id: '1d', label: 'Hoje' },
                  { id: '7d', label: '7 dias' },
                  { id: '30d', label: 'Mês' },
                  { id: 'ano', label: 'Ano' },
                  { id: 'tudo', label: 'Tudo' },
                ]"
                :key="opt.id"
                class="chip"
                :class="{ active: periodoRankingLoja === opt.id }"
                @click="periodoRankingLoja = opt.id"
              >
                {{ opt.label }}
              </button>
            </div>
            <div class="chip-group">
              <button
                class="chip"
                :class="{ active: tipoRankingLoja === '' }"
                @click="tipoRankingLoja = ''"
              >
                Todos
              </button>
              <button
                v-for="t in ['ETIQUETA', 'PRESENCA', 'RUPTURA']"
                :key="t"
                class="chip"
                :class="{ active: tipoRankingLoja === t }"
                @click="tipoRankingLoja = t"
              >
                {{ t }}
              </button>
            </div>
          </div>

          <div v-if="carregandoRankingLoja" class="ranking-loja-loading">
            <fa icon="spinner" spin /> Carregando ranking…
          </div>
          <div v-else-if="erroRankingLoja" class="badge bad full-w">
            {{ erroRankingLoja }}
          </div>
          <div
            v-else-if="!rankingLoja.length"
            class="empty mini"
            style="padding: 16px; text-align: center"
          >
            Ainda não há dados de ranking neste período.
          </div>
          <ol v-else class="ranking-loja-list">
            <li
              v-for="(item, idx) in rankingLoja"
              :key="item._id"
              class="ranking-loja-item"
              :class="{ 'is-me': item._id === perfil?._id, 'top-3': idx < 3 }"
            >
              <div class="ranking-pos">
                <span v-if="idx === 0">🏆</span>
                <span v-else-if="idx === 1">🥈</span>
                <span v-else-if="idx === 2">🥉</span>
                <span v-else>{{ idx + 1 }}</span>
              </div>
              <ColaboradorAvatar
                :nome="item.nome"
                :avatar-url="item.avatarUrl"
                :size="40"
                :font-size="14"
              />
              <div class="ranking-info">
                <strong class="ranking-nome">
                  {{ item.nome }}
                  <span v-if="item._id === perfil?._id" class="badge mini ok"
                    >você</span
                  >
                </strong>
                <div class="ranking-meta muted small">
                  <span
                    ><fa icon="book-open" />
                    {{ formatNum(item.totalLidos) }} lidos</span
                  >
                  <span v-if="item.pontuacao != null">
                    · <fa icon="bolt" /> {{ formatNum(item.pontuacao) }} pts
                  </span>
                  <span v-if="item.percentualConclusao != null">
                    · {{ Number(item.percentualConclusao).toFixed(1) }}%
                  </span>
                </div>
              </div>
              <div class="ranking-score">
                <strong>{{ formatNum(item.totalLidos) }}</strong>
                <span class="muted micro">lidos</span>
              </div>
            </li>
          </ol>
        </section>
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

      <nav v-if="!exibindoPerfilPublico" class="bottom-nav">
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
          :class="{ active: abaAtiva === 'ranking' }"
          @click="abaAtiva = 'ranking'"
        >
          <fa icon="ranking-star" />
          <span>Ranking</span>
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
              <div
                class="conq-modal-icon"
                :class="{ 'has-image': !!imagemConquistaSelecionada }"
              >
                <button
                  v-if="imagemConquistaSelecionada"
                  class="conq-icon-btn"
                  :title="`Ampliar imagem de ${altImagemConquista(conquistaSelecionada)}`"
                  @click="
                    abrirVisualizacaoImagem(
                      imagemConquistaSelecionada,
                      altImagemConquista(conquistaSelecionada),
                    )
                  "
                >
                  <img
                    class="conq-icon-image"
                    :src="imagemConquistaSelecionada"
                    :alt="altImagemConquista(conquistaSelecionada)"
                    loading="eager"
                    decoding="async"
                    fetchpriority="high"
                    width="100"
                    height="100"
                    draggable="false"
                  />
                </button>
                <template v-else>
                  {{
                    conquistaSelecionada.desbloqueada
                      ? iconeConquista(conquistaSelecionada)
                      : "🔒"
                  }}
                </template>
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
                  <div class="conq-req-tier-wrap">
                    <div
                      class="conq-req-tier-icon"
                      :class="{
                        'has-image': !!imagemConquistaPorTier(
                          conquistaSelecionada,
                          tier.nivel,
                        ),
                      }"
                    >
                      <button
                        v-if="
                          imagemConquistaPorTier(
                            conquistaSelecionada,
                            tier.nivel,
                          )
                        "
                        class="conq-tier-img-btn"
                        :title="`Ampliar imagem do tier ${tier.label || tier.nivel}`"
                        @click="
                          abrirVisualizacaoImagem(
                            imagemConquistaPorTier(
                              conquistaSelecionada,
                              tier.nivel,
                            ),
                            altImagemConquistaTier(
                              conquistaSelecionada,
                              tier.nivel,
                            ),
                          )
                        "
                      >
                        <img
                          class="conq-req-tier-image"
                          :src="
                            imagemConquistaPorTier(
                              conquistaSelecionada,
                              tier.nivel,
                            )
                          "
                          :alt="
                            altImagemConquistaTier(
                              conquistaSelecionada,
                              tier.nivel,
                            )
                          "
                          loading="lazy"
                          decoding="async"
                          width="56"
                          height="56"
                          draggable="false"
                        />
                      </button>
                      <template v-else>
                        {{ iconeConquista(conquistaSelecionada) }}
                      </template>
                    </div>
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
                  <div class="conq-req-tier-wrap">
                    <div
                      class="conq-req-tier-icon"
                      :class="{
                        'has-image': !!imagemConquistaPorTier(
                          conquistaSelecionada,
                          item.nivel,
                        ),
                      }"
                    >
                      <button
                        v-if="
                          imagemConquistaPorTier(
                            conquistaSelecionada,
                            item.nivel,
                          )
                        "
                        class="conq-tier-img-btn"
                        :title="`Ampliar imagem do tier ${item.label || item.nivel}`"
                        @click="
                          abrirVisualizacaoImagem(
                            imagemConquistaPorTier(
                              conquistaSelecionada,
                              item.nivel,
                            ),
                            altImagemConquistaTier(
                              conquistaSelecionada,
                              item.nivel,
                            ),
                          )
                        "
                      >
                        <img
                          class="conq-req-tier-image"
                          :src="
                            imagemConquistaPorTier(
                              conquistaSelecionada,
                              item.nivel,
                            )
                          "
                          :alt="
                            altImagemConquistaTier(
                              conquistaSelecionada,
                              item.nivel,
                            )
                          "
                          loading="lazy"
                          decoding="async"
                          width="56"
                          height="56"
                          draggable="false"
                        />
                      </button>
                      <template v-else>
                        {{ iconeConquista(conquistaSelecionada) }}
                      </template>
                    </div>
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

    <!-- Lightbox para visualização ampliada de imagens de conquistas -->
    <Transition name="img-lightbox">
      <div
        v-if="imagemAmpliada"
        class="img-lightbox-backdrop"
        @click.self="fecharVisualizacaoImagem"
      >
        <div class="img-lightbox-container">
          <button
            class="img-lightbox-close"
            @click="fecharVisualizacaoImagem"
            title="Fechar visualização"
          >
            <fa icon="xmark" />
          </button>
          <img
            :src="imagemAmpliada.url"
            :alt="imagemAmpliada.alt || 'Imagem da conquista'"
            class="img-lightbox-image"
            draggable="false"
          />
          <p v-if="imagemAmpliada.alt" class="img-lightbox-caption">
            {{ imagemAmpliada.alt }}
          </p>
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

.app-topbar-profile {
  gap: 12px;
}

.topbar-left-profile {
  min-width: 0;
}

.topbar-profile-copy {
  min-width: 0;
}

.topbar-profile-copy strong {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.portal-back-btn {
  flex-shrink: 0;
}

.portal-back-icon {
  transform: rotate(180deg);
}

.app-content-profile {
  padding-top: 8px;
}

.colegas-card {
  display: grid;
  gap: 16px;
}

.colegas-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.colegas-help {
  margin: 6px 0 0;
  max-width: 48ch;
}

.colega-count {
  min-width: 34px;
  height: 34px;
  padding: 0 10px;
  border-radius: 999px;
  display: inline-grid;
  place-items: center;
  font-weight: 700;
  color: #7c5cff;
  background: rgba(124, 92, 255, 0.14);
}

.colegas-state {
  min-height: 110px;
  display: grid;
  place-items: center;
  gap: 10px;
  text-align: center;
}

.colegas-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.colega-card {
  border: 1px solid color-mix(in srgb, var(--border) 88%, #7c5cff 12%);
  border-radius: 22px;
  padding: 16px;
  display: grid;
  gap: 14px;
  text-align: left;
  text-decoration: none;
  background:
    radial-gradient(
      180px 120px at 0% 0%,
      rgba(124, 92, 255, 0.16),
      transparent 72%
    ),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--surface-strong) 92%, transparent),
      color-mix(in srgb, var(--surface) 94%, transparent)
    );
  color: var(--text);
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08);
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.colega-card:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, #7c5cff 52%, var(--border));
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.14);
}

.colega-card:focus-visible {
  outline: 2px solid #7c5cff;
  outline-offset: 3px;
}

.colega-main {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: center;
}

.colega-body {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.colega-body strong {
  font-size: 1rem;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.colega-body small {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.colega-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.colega-stat {
  padding: 10px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 84%, transparent);
  display: grid;
  gap: 4px;
}

.colega-stat-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.colega-stat strong {
  font-size: 14px;
}

.colega-link {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  font-weight: 700;
  color: #7c5cff;
}

/* ===== TOP 3 COLEGAS ===== */
@keyframes colegaShine {
  0% {
    transform: translateX(-130%) skewX(-20deg);
    opacity: 0;
  }
  12% {
    opacity: 1;
  }
  88% {
    opacity: 1;
  }
  100% {
    transform: translateX(240%) skewX(-20deg);
    opacity: 0;
  }
}
@keyframes colegaParticle {
  0% {
    transform: translateY(0) scale(1);
    opacity: 0.8;
  }
  55% {
    transform: translateY(-20px) scale(1.35);
    opacity: 1;
  }
  100% {
    transform: translateY(-44px) scale(0.5);
    opacity: 0;
  }
}
@keyframes colegaPulseOuro {
  0%,
  100% {
    box-shadow:
      0 12px 26px rgba(15, 23, 42, 0.08),
      0 0 0 0 rgba(245, 158, 11, 0);
  }
  50% {
    box-shadow:
      0 18px 38px rgba(245, 158, 11, 0.18),
      0 0 0 3px rgba(245, 158, 11, 0.22);
  }
}
@keyframes colegaPulsePrata {
  0%,
  100% {
    box-shadow:
      0 12px 26px rgba(15, 23, 42, 0.08),
      0 0 0 0 rgba(148, 163, 184, 0);
  }
  50% {
    box-shadow:
      0 16px 34px rgba(148, 163, 184, 0.15),
      0 0 0 3px rgba(148, 163, 184, 0.2);
  }
}
@keyframes colegaPulseBronze {
  0%,
  100% {
    box-shadow:
      0 12px 26px rgba(15, 23, 42, 0.08),
      0 0 0 0 rgba(249, 115, 22, 0);
  }
  50% {
    box-shadow:
      0 16px 34px rgba(249, 115, 22, 0.15),
      0 0 0 3px rgba(249, 115, 22, 0.2);
  }
}
@keyframes badgePop {
  0% {
    transform: scale(0.5) rotate(-18deg);
    opacity: 0;
  }
  65% {
    transform: scale(1.18) rotate(4deg);
    opacity: 1;
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

/* Variáveis de cor por posição */
.colega-rank-ouro {
  --ck: 245, 158, 11;
  border-color: rgba(245, 158, 11, 0.42) !important;
  background:
    radial-gradient(
      200px 130px at 0% 0%,
      rgba(245, 158, 11, 0.15),
      transparent 68%
    ),
    radial-gradient(
      300px 160px at 100% 100%,
      rgba(245, 158, 11, 0.08),
      transparent 70%
    ),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--surface-strong) 92%, transparent),
      color-mix(in srgb, var(--surface) 94%, transparent)
    ) !important;
  animation: colegaPulseOuro 2.6s ease-in-out 0.5s infinite;
}
.colega-rank-prata {
  --ck: 148, 163, 184;
  border-color: rgba(148, 163, 184, 0.38) !important;
  background:
    radial-gradient(
      200px 130px at 0% 0%,
      rgba(148, 163, 184, 0.13),
      transparent 68%
    ),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--surface-strong) 92%, transparent),
      color-mix(in srgb, var(--surface) 94%, transparent)
    ) !important;
  animation: colegaPulsePrata 3s ease-in-out 0.5s infinite;
}
.colega-rank-bronze {
  --ck: 249, 115, 22;
  border-color: rgba(249, 115, 22, 0.38) !important;
  background:
    radial-gradient(
      200px 130px at 0% 0%,
      rgba(249, 115, 22, 0.13),
      transparent 68%
    ),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--surface-strong) 92%, transparent),
      color-mix(in srgb, var(--surface) 94%, transparent)
    ) !important;
  animation: colegaPulseBronze 3.2s ease-in-out 0.5s infinite;
}

/* Link color acompanha a cor do tier */
.colega-rank-ouro .colega-link {
  color: #f59e0b;
}
.colega-rank-prata .colega-link {
  color: #94a3b8;
}
.colega-rank-bronze .colega-link {
  color: #f97316;
}

/* Faixa de brilho varrendo */
.colega-shine {
  pointer-events: none;
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  z-index: 0;
}
.colega-shine::after {
  content: "";
  position: absolute;
  top: -50%;
  left: 0;
  width: 38%;
  height: 200%;
  animation: colegaShine 2.6s ease-in-out 0.2s infinite;
}
.colega-rank-ouro .colega-shine::after {
  background: linear-gradient(
    108deg,
    transparent 15%,
    rgba(255, 220, 80, 0.28) 50%,
    transparent 85%
  );
  animation-duration: 2.4s;
}
.colega-rank-prata .colega-shine::after {
  background: linear-gradient(
    108deg,
    transparent 15%,
    rgba(200, 220, 240, 0.22) 50%,
    transparent 85%
  );
  animation-duration: 3.2s;
}
.colega-rank-bronze .colega-shine::after {
  background: linear-gradient(
    108deg,
    transparent 15%,
    rgba(255, 180, 80, 0.22) 50%,
    transparent 85%
  );
  animation-duration: 2.8s;
}

/* Partículas */
.colega-particles {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 0;
}
.cp {
  position: absolute;
  border-radius: 50%;
  animation: colegaParticle 2.4s ease-in infinite;
  opacity: 0;
  background: rgba(var(--ck), 1);
  box-shadow: 0 0 5px 1px rgba(var(--ck), 0.55);
}
.cp.p1 {
  width: 4px;
  height: 4px;
  left: 12%;
  bottom: 16%;
  animation-delay: 0s;
  animation-duration: 2.2s;
}
.cp.p2 {
  width: 5px;
  height: 5px;
  left: 32%;
  bottom: 8%;
  animation-delay: 0.6s;
  animation-duration: 2.8s;
}
.cp.p3 {
  width: 3px;
  height: 3px;
  left: 56%;
  bottom: 18%;
  animation-delay: 1.1s;
  animation-duration: 2.5s;
}
.cp.p4 {
  width: 4px;
  height: 4px;
  left: 74%;
  bottom: 10%;
  animation-delay: 0.3s;
  animation-duration: 3s;
}
.cp.p5 {
  width: 3px;
  height: 3px;
  left: 88%;
  bottom: 22%;
  animation-delay: 1.5s;
  animation-duration: 2.3s;
}

/* Medalha de posição (canto superior direito) */
.colega-rank-badge {
  position: absolute;
  top: 10px;
  right: 12px;
  font-size: 20px;
  line-height: 1;
  z-index: 2;
  animation: badgePop 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.25));
}

/* Garantir position:relative para os efeitos absolutos */
.colega-rank-ouro,
.colega-rank-prata,
.colega-rank-bronze {
  position: relative;
  overflow: hidden;
}

/* Conteúdo fica acima dos efeitos */
.colega-rank-ouro > .colega-main,
.colega-rank-ouro > .colega-link,
.colega-rank-prata > .colega-main,
.colega-rank-prata > .colega-link,
.colega-rank-bronze > .colega-main,
.colega-rank-bronze > .colega-link {
  position: relative;
  z-index: 1;
}

/* "Você" subtitle */
.colega-eu-label {
  color: #7c5cff;
  font-weight: 700;
  font-size: 11px;
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

/* Ranking geral no nivel-card */
.ranking-stat {
  position: relative;
}
.rank-pos {
  font-size: 17px;
  display: flex;
  align-items: center;
  gap: 2px;
}
.rank-trophy {
  font-style: normal;
  font-size: 15px;
}
.rank-num {
  font-size: 13px;
  opacity: 0.6;
}
.rank-nd {
  opacity: 0.4;
}
.rank-ouro .rank-pos {
  color: #f59e0b;
  text-shadow: 0 0 8px rgba(245, 158, 11, 0.45);
}
.rank-prata .rank-pos {
  color: #94a3b8;
  text-shadow: 0 0 8px rgba(148, 163, 184, 0.4);
}
.rank-bronze .rank-pos {
  color: #f97316;
  text-shadow: 0 0 8px rgba(249, 115, 22, 0.4);
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
  grid-template-columns: repeat(5, 1fr);
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
  grid-template-columns: 100px 1fr;
  gap: 16px;
  min-width: 0;
}

.conq-modal-icon {
  width: 100px;
  height: 100px;
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

.conq-modal-icon.has-image {
  overflow: hidden;
  padding: 0;
  background: color-mix(in srgb, var(--tier-cor) 18%, transparent);
}

.conq-modal-icon .conq-icon-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  border-radius: inherit;
}

/* Botão para tornar imagem do ícone da conquista clicável */
.conq-icon-btn {
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: inherit;
  transition:
    transform 0.18s ease,
    opacity 0.18s ease;
}
.conq-icon-btn:hover {
  transform: scale(1.08);
  opacity: 0.9;
}
.conq-icon-btn .conq-icon-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  border-radius: inherit;
}

/* Botão para tornar imagem de tier clicável */
.conq-tier-img-btn {
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: inherit;
  transition: transform 0.15s ease;
}
.conq-tier-img-btn:hover {
  transform: scale(1.12);
}

/* Lightbox para visualização ampliada */
.img-lightbox-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(2, 5, 12, 0.92);
  backdrop-filter: blur(16px);
  display: grid;
  place-items: center;
  padding: 24px;
  z-index: 100;
}
.img-lightbox-container {
  position: relative;
  display: grid;
  gap: 12px;
  justify-items: center;
  max-width: min(90vw, 640px);
  max-height: 85vh;
}
.img-lightbox-close {
  position: absolute;
  top: -44px;
  right: 0;
  width: 38px;
  height: 38px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.2s;
  z-index: 2;
}
.img-lightbox-close:hover {
  background: rgba(255, 255, 255, 0.18);
}
.img-lightbox-image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: 18px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
}
.img-lightbox-caption {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  margin: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Transições do lightbox */
.img-lightbox-enter-active,
.img-lightbox-leave-active {
  transition: opacity 0.22s ease;
}
.img-lightbox-enter-from,
.img-lightbox-leave-to {
  opacity: 0;
}
.img-lightbox-enter-active .img-lightbox-image,
.img-lightbox-leave-active .img-lightbox-image {
  transition: transform 0.22s ease;
}
.img-lightbox-enter-from .img-lightbox-image {
  transform: scale(0.92);
}
.img-lightbox-leave-to .img-lightbox-image {
  transform: scale(0.92);
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

.conq-modal-section {
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface-strong);
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
  border-color: color-mix(in srgb, #22c55e 34%, var(--border));
  background:
    radial-gradient(
      circle at top left,
      color-mix(in srgb, #22c55e 16%, transparent),
      transparent 58%
    ),
    linear-gradient(
      180deg,
      color-mix(in srgb, #22c55e 8%, rgba(255, 255, 255, 0.03)),
      rgba(255, 255, 255, 0.03)
    );
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, #22c55e 10%, transparent),
    0 10px 24px rgba(15, 23, 42, 0.08);
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

.conq-req-tier-wrap {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex-wrap: wrap;
}

.conq-req-tier-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  font-size: 18px;
  color: #fff;
  background: linear-gradient(
    135deg,
    var(--req-tier-cor),
    color-mix(in srgb, var(--req-tier-cor) 58%, #000)
  );
  box-shadow: 0 8px 18px
    color-mix(in srgb, var(--req-tier-cor) 26%, transparent);
  overflow: hidden;
}

.conq-req-tier-icon.has-image {
  background: color-mix(in srgb, var(--req-tier-cor) 14%, transparent);
  box-shadow: 0 8px 18px
    color-mix(in srgb, var(--req-tier-cor) 18%, transparent);
}

.conq-req-tier-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  padding: 3px;
  border-radius: inherit;
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
  color: #ffffff;
  background-color: #41976f;
  border-color: rgba(124, 92, 255, 0.4);
}

.conq-status-badge.pending {
  color: #696969;
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
:global([data-theme="light"]) .portal-header {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(10px);
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
:global([data-theme="light"]) .conq-modal-section,
:global([data-theme="light"]) .conq-req-item,
:global([data-theme="light"]) .conq-history-item {
  background: rgba(255, 255, 255, 0.94);
  border-color: rgba(89, 108, 165, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}
:global([data-theme="light"]) .conq-req-item.unlocked {
  background:
    radial-gradient(
      circle at top left,
      rgba(34, 197, 94, 0.12),
      transparent 56%
    ),
    linear-gradient(
      180deg,
      rgba(240, 253, 244, 0.96),
      rgba(236, 253, 245, 0.92)
    );
  border-color: rgba(34, 197, 94, 0.26);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.78),
    0 12px 24px rgba(22, 101, 52, 0.08);
}
:global([data-theme="light"]) .conq-status-badge.unlocked {
  color: #fafafa;
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
  .app-topbar-profile {
    align-items: flex-start;
  }

  .topbar-left-profile {
    flex-direction: column;
    align-items: flex-start;
  }

  .topbar-profile-copy strong {
    white-space: normal;
  }

  .colegas-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .colegas-list {
    grid-template-columns: 1fr;
  }

  .colega-stats {
    grid-template-columns: 1fr;
  }

  .conq-modal {
    padding: 18px;
  }

  .conq-modal-head {
    flex-direction: column;
  }

  .conq-modal-hero {
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

/* ===== Ranking da loja (portal) ===== */
.ranking-loja-card {
  display: grid;
  gap: 14px;
}
.ranking-loja-head h3 {
  margin: 0;
}
.ranking-loja-head .muted.small {
  margin: 4px 0 0;
  font-size: 12px;
}
.ranking-loja-filtros {
  display: grid;
  gap: 8px;
}
.ranking-loja-filtros .chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ranking-loja-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 18px;
  justify-content: center;
  color: var(--text-dim);
}
.ranking-loja-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.ranking-loja-item {
  display: grid;
  grid-template-columns: 36px 40px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
}
.ranking-loja-item.top-3 {
  border-color: color-mix(in srgb, #facc15 35%, var(--border));
  background: linear-gradient(
    180deg,
    color-mix(in srgb, #facc15 8%, var(--surface)),
    var(--surface)
  );
}
.ranking-loja-item.is-me {
  border-color: color-mix(in srgb, #7c5cff 50%, var(--border));
  box-shadow: 0 0 0 1px color-mix(in srgb, #7c5cff 25%, transparent);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, #7c5cff 12%, var(--surface)),
    var(--surface)
  );
}
.ranking-loja-item .ranking-pos {
  font-weight: 800;
  font-size: 16px;
  text-align: center;
  color: var(--text);
}
.ranking-loja-item .ranking-nome {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  line-height: 1.2;
}
.ranking-loja-item .ranking-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
  font-size: 11px;
}
.ranking-loja-item .ranking-score {
  text-align: right;
  display: grid;
  line-height: 1.1;
}
.ranking-loja-item .ranking-score strong {
  font-size: 15px;
  color: var(--text);
}
.badge.mini {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
}
.micro {
  font-size: 10px;
}
</style>

<style>
/* ConquistaCard styles (não-scoped pois o componente é registrado via render h() e não recebe class hash do scoped) */
.conq-card {
  position: relative;
  border-radius: 22px;
  padding: 0;
  border: 1px solid var(--border-strong);
  background: var(--surface-strong);
  overflow: hidden;
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 0;
  align-items: stretch;
  min-height: 100px;
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
  width: 100%;
  min-height: 100%;
  display: grid;
  place-items: center;
  font-size: 30px;
  color: #fff;
  background: linear-gradient(
    135deg,
    var(--tier-cor),
    color-mix(in srgb, var(--tier-cor) 55%, #000)
  );
  border-radius: 22px 0 0 22px;
  overflow: hidden;
  flex-shrink: 0;
}
.conq-card.locked .conq-card-icon {
  background: linear-gradient(135deg, #475569, #1f2937);
  box-shadow: none;
  font-size: 22px;
}
.conq-card-icon.has-image {
  background: color-mix(in srgb, var(--tier-cor) 14%, transparent);
}
.conq-card-icon .conq-icon-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  border-radius: 22px 0 0 22px;
  max-width: 100%;
  max-height: 100%;
}

/* Botão de imagem no card da conquista (fora do modal) */
.conq-card-img-btn {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 22px 0 0 22px;
  z-index: 2;
}
.conq-card-img-btn:hover .conq-icon-image {
  opacity: 0.85;
  transform: scale(1.04);
}
.conq-card-img-btn .conq-icon-image {
  transition:
    transform 0.18s ease,
    opacity 0.18s ease;
}

.conq-card-head {
  position: relative;
  z-index: 1;
  display: contents;
}

.conq-card-body {
  position: relative;
  z-index: 1;
  min-width: 0;
  display: grid;
  gap: 6px;
  padding: 14px;
  align-content: center;
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
  display: none;
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
.conq-card.compact {
  grid-template-columns: 60px 1fr;
  min-height: 80px;
}
.conq-card.compact .conq-card-icon {
  font-size: 22px;
  border-radius: 18px 0 0 18px;
}
.conq-card.compact .conq-card-icon .conq-icon-image {
  border-radius: 18px 0 0 18px;
}
.conq-card.compact .conq-card-body {
  padding: 10px;
  gap: 4px;
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

/* ============================================================
   Animações de raridade – vidro reflexivo no card da conquista
   Cada tier ganha um efeito visual único que reflete sua raridade.
   ============================================================ */

/* Base do overlay reflexivo (::after comum para tiers raros) */
.conq-card.tier-epico::after,
.conq-card.tier-lendario::after,
.conq-card.tier-diamante::after,
.conq-card.tier-mitico::after,
.conq-card.tier-suprema::after,
.conq-card.tier-transcendente::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  border-radius: 22px;
  opacity: 0;
  transition: opacity 0.4s ease;
}

/* Ao passar o mouse, intensifica o brilho */
.conq-card.tier-epico:hover::after,
.conq-card.tier-lendario:hover::after,
.conq-card.tier-diamante:hover::after,
.conq-card.tier-mitico:hover::after,
.conq-card.tier-suprema:hover::after,
.conq-card.tier-transcendente:hover::after {
  opacity: 1;
}

/* ---- ÉPICO – Faixa de luz roxa que varre na diagonal (vidro reflexivo) ---- */
@keyframes shimmerEpico {
  0% {
    transform: translateX(-120%) translateY(-120%) rotate(35deg);
  }
  50% {
    transform: translateX(40%) translateY(40%) rotate(35deg);
  }
  100% {
    transform: translateX(220%) translateY(220%) rotate(35deg);
  }
}
.conq-card.tier-epico::after {
  opacity: 0.55;
  background: linear-gradient(
    135deg,
    transparent 35%,
    rgba(168, 85, 247, 0.12) 42%,
    rgba(255, 255, 255, 0.28) 48%,
    rgba(168, 85, 247, 0.12) 54%,
    transparent 60%
  );
  background-size: 200% 200%;
  animation: shimmerEpico 3.2s ease-in-out infinite;
}
.conq-card.tier-epico {
  box-shadow:
    0 0 18px rgba(168, 85, 247, 0.12),
    inset 0 0 0 1px rgba(168, 85, 247, 0.25);
}
.conq-card.tier-epico:hover {
  box-shadow:
    0 8px 32px rgba(168, 85, 247, 0.25),
    inset 0 0 0 1px rgba(168, 85, 247, 0.45);
}

/* ---- LENDÁRIO – Brilho dourado com cintilação de partículas ---- */
@keyframes shimmerLendario {
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
}
@keyframes sparkLendario {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.8);
  }
  20%,
  80% {
    opacity: 0.7;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}
.conq-card.tier-lendario::after {
  opacity: 0.5;
  background:
    radial-gradient(
      circle at 25% 35%,
      rgba(255, 215, 0, 0.35) 0%,
      transparent 8%
    ),
    radial-gradient(
      circle at 70% 20%,
      rgba(255, 255, 255, 0.3) 0%,
      transparent 6%
    ),
    radial-gradient(
      circle at 50% 60%,
      rgba(245, 158, 11, 0.25) 0%,
      transparent 10%
    ),
    linear-gradient(
      105deg,
      transparent 40%,
      rgba(255, 215, 0, 0.08) 45%,
      rgba(255, 255, 255, 0.22) 50%,
      rgba(255, 215, 0, 0.08) 55%,
      transparent 60%
    );
  background-size:
    100% 100%,
    100% 100%,
    100% 100%,
    300% 100%;
  animation:
    sparkLendario 2.6s ease-in-out infinite,
    shimmerLendario 4s linear infinite;
}
.conq-card.tier-lendario {
  box-shadow:
    0 0 22px rgba(245, 158, 11, 0.15),
    inset 0 0 0 1px rgba(245, 158, 11, 0.3);
}
.conq-card.tier-lendario:hover {
  box-shadow:
    0 8px 36px rgba(245, 158, 11, 0.3),
    inset 0 0 0 1px rgba(245, 158, 11, 0.5);
}

/* ---- DIAMANTE – Reflexo prismático com arco-íris sutil ---- */
@keyframes shimmerDiamante {
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
}
@keyframes prismDiamante {
  0% {
    filter: hue-rotate(0deg);
  }
  100% {
    filter: hue-rotate(30deg);
  }
}
.conq-card.tier-diamante::after {
  opacity: 0.5;
  background: linear-gradient(
    120deg,
    transparent 30%,
    rgba(6, 182, 212, 0.1) 38%,
    rgba(255, 255, 255, 0.35) 45%,
    rgba(147, 197, 253, 0.15) 48%,
    rgba(6, 182, 212, 0.1) 55%,
    transparent 65%
  );
  background-size: 300% 100%;
  animation:
    shimmerDiamante 3.6s ease-in-out infinite,
    prismDiamante 6s linear infinite;
}
.conq-card.tier-diamante {
  box-shadow:
    0 0 24px rgba(6, 182, 212, 0.14),
    inset 0 0 0 1px rgba(6, 182, 212, 0.35);
}
.conq-card.tier-diamante:hover {
  box-shadow:
    0 8px 40px rgba(6, 182, 212, 0.28),
    inset 0 0 0 1px rgba(6, 182, 212, 0.55);
}

/* ---- MÍTICO – Pulsação flamejante com brilho intenso ---- */
@keyframes shimmerMitico {
  0% {
    background-position: -200% center;
    opacity: 0.35;
  }
  50% {
    opacity: 0.65;
  }
  100% {
    background-position: 200% center;
    opacity: 0.35;
  }
}
@keyframes pulseMitico {
  0%,
  100% {
    box-shadow:
      0 0 18px rgba(239, 68, 68, 0.18),
      inset 0 0 0 1px rgba(239, 68, 68, 0.3);
  }
  50% {
    box-shadow:
      0 0 36px rgba(239, 68, 68, 0.35),
      inset 0 0 0 1px rgba(239, 68, 68, 0.5);
  }
}
.conq-card.tier-mitico::after {
  opacity: 0.5;
  background:
    radial-gradient(
      ellipse at 20% 30%,
      rgba(255, 100, 100, 0.2) 0%,
      transparent 30%
    ),
    radial-gradient(
      ellipse at 80% 70%,
      rgba(239, 68, 68, 0.18) 0%,
      transparent 30%
    ),
    linear-gradient(
      115deg,
      transparent 35%,
      rgba(239, 68, 68, 0.1) 42%,
      rgba(255, 180, 180, 0.3) 48%,
      rgba(239, 68, 68, 0.1) 54%,
      transparent 60%
    );
  background-size:
    100% 100%,
    100% 100%,
    300% 100%;
  animation:
    shimmerMitico 2.4s ease-in-out infinite,
    pulseMitico 2s ease-in-out infinite;
}
.conq-card.tier-mitico {
  animation: pulseMitico 2s ease-in-out infinite;
}
.conq-card.tier-mitico:hover {
  animation: none;
  box-shadow:
    0 8px 44px rgba(239, 68, 68, 0.45),
    inset 0 0 0 2px rgba(239, 68, 68, 0.6);
}

/* ============================================================
   SUPREMA – Divina · Raios de luz dourada celestial
   A mais nobre das raridades comuns. Brilho majestoso e imponente.
   ============================================================ */
@keyframes shimmerSuprema {
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
}
@keyframes godRaysSuprema {
  0%,
  100% {
    opacity: 0.45;
    transform: scale(1);
  }
  50% {
    opacity: 0.72;
    transform: scale(1.04);
  }
}
@keyframes divineGlowSuprema {
  0%,
  100% {
    box-shadow:
      0 0 24px rgba(251, 191, 36, 0.22),
      0 0 48px rgba(255, 255, 255, 0.08),
      inset 0 0 0 1px rgba(251, 191, 36, 0.4);
  }
  50% {
    box-shadow:
      0 0 44px rgba(251, 191, 36, 0.42),
      0 0 72px rgba(255, 255, 255, 0.18),
      inset 0 0 0 2px rgba(251, 191, 36, 0.6);
  }
}
@keyframes divineBreathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.012);
  }
}
.conq-card.tier-suprema::after {
  opacity: 0.55;
  background:
    /* Raios divinos do topo */
    conic-gradient(
      from 180deg at 50% 0%,
      transparent 0deg,
      rgba(255, 255, 255, 0.18) 3deg,
      transparent 6deg,
      rgba(255, 255, 255, 0.14) 10deg,
      transparent 13deg,
      rgba(251, 191, 36, 0.12) 16deg,
      transparent 20deg,
      rgba(255, 255, 255, 0.16) 24deg,
      transparent 28deg,
      rgba(251, 191, 36, 0.1) 32deg,
      transparent 36deg,
      transparent 360deg
    ),
    /* Auréola superior */
    radial-gradient(
        ellipse 180px 80px at 50% 0%,
        rgba(255, 255, 255, 0.35) 0%,
        rgba(251, 191, 36, 0.15) 30%,
        transparent 70%
      ),
    /* Sweep horizontal majestoso */
    linear-gradient(
        110deg,
        transparent 32%,
        rgba(251, 191, 36, 0.05) 40%,
        rgba(255, 255, 255, 0.45) 47%,
        rgba(255, 255, 255, 0.15) 50%,
        rgba(251, 191, 36, 0.05) 58%,
        transparent 65%
      );
  background-size:
    100% 100%,
    100% 100%,
    350% 100%;
  animation:
    godRaysSuprema 3.5s ease-in-out infinite,
    shimmerSuprema 3s ease-in-out infinite;
}
.conq-card.tier-suprema {
  animation:
    divineGlowSuprema 2.8s ease-in-out infinite,
    divineBreathe 4s ease-in-out infinite;
  border-color: rgba(251, 191, 36, 0.45);
}
.conq-card.tier-suprema:hover {
  animation: none;
  transform: translateY(-3px) scale(1.02);
  box-shadow:
    0 0 52px rgba(251, 191, 36, 0.55),
    0 0 80px rgba(255, 255, 255, 0.22),
    inset 0 0 0 2px rgba(251, 191, 36, 0.7);
}

/* ============================================================
   TRANSCENDENTE – Arco-Íris da Glória · O esplendor máximo
   A raridade suprema. Um arco-íris completo desliza majestoso
   sobre o card, refletindo toda a glória desta conquista.
   ============================================================ */
@keyframes shimmerTranscendente {
  0% {
    background-position: -300% center;
  }
  100% {
    background-position: 300% center;
  }
}
@keyframes rainbowAuraTranscendente {
  0% {
    opacity: 0.5;
    filter: hue-rotate(0deg);
  }
  100% {
    opacity: 0.7;
    filter: hue-rotate(360deg);
  }
}
@keyframes rainbowBorderTranscendente {
  0% {
    box-shadow:
      0 0 18px rgba(239, 68, 68, 0.18),
      0 0 36px rgba(249, 115, 22, 0.1),
      inset 0 0 0 1px rgba(239, 68, 68, 0.3);
  }
  14% {
    box-shadow:
      0 0 22px rgba(249, 115, 22, 0.22),
      0 0 42px rgba(245, 158, 11, 0.14),
      inset 0 0 0 1px rgba(249, 115, 22, 0.38);
  }
  28% {
    box-shadow:
      0 0 24px rgba(245, 158, 11, 0.24),
      0 0 46px rgba(251, 191, 36, 0.16),
      inset 0 0 0 1px rgba(245, 158, 11, 0.42);
  }
  42% {
    box-shadow:
      0 0 22px rgba(34, 197, 94, 0.22),
      0 0 44px rgba(6, 182, 212, 0.14),
      inset 0 0 0 1px rgba(34, 197, 94, 0.38);
  }
  57% {
    box-shadow:
      0 0 24px rgba(6, 182, 212, 0.24),
      0 0 48px rgba(59, 130, 246, 0.16),
      inset 0 0 0 1px rgba(6, 182, 212, 0.42);
  }
  71% {
    box-shadow:
      0 0 22px rgba(59, 130, 246, 0.22),
      0 0 44px rgba(168, 85, 247, 0.14),
      inset 0 0 0 1px rgba(59, 130, 246, 0.38);
  }
  85% {
    box-shadow:
      0 0 26px rgba(168, 85, 247, 0.26),
      0 0 50px rgba(236, 72, 153, 0.18),
      inset 0 0 0 1px rgba(168, 85, 247, 0.44);
  }
  100% {
    box-shadow:
      0 0 18px rgba(239, 68, 68, 0.18),
      0 0 36px rgba(249, 115, 22, 0.1),
      inset 0 0 0 1px rgba(239, 68, 68, 0.3);
  }
}
.conq-card.tier-transcendente::after {
  opacity: 0.5;
  background:
    /* Arco-íris completo – 7 cores deslizando majestosamente */
    linear-gradient(
      130deg,
      transparent 20%,
      rgba(239, 68, 68, 0.12) 24%,
      rgba(249, 115, 22, 0.1) 28%,
      rgba(245, 158, 11, 0.1) 32%,
      rgba(251, 191, 36, 0.1) 35%,
      rgba(34, 197, 94, 0.09) 38%,
      rgba(6, 182, 212, 0.1) 42%,
      rgba(59, 130, 246, 0.1) 46%,
      rgba(168, 85, 247, 0.09) 50%,
      rgba(236, 72, 153, 0.08) 54%,
      transparent 60%
    ),
    /* Reflexo branco puríssimo (glória) */
    linear-gradient(
        115deg,
        transparent 38%,
        rgba(255, 255, 255, 0.08) 44%,
        rgba(255, 255, 255, 0.42) 48%,
        rgba(255, 255, 255, 0.22) 50%,
        rgba(255, 255, 255, 0.08) 54%,
        transparent 60%
      );
  background-size:
    500% 100%,
    400% 100%;
  animation:
    shimmerTranscendente 8s ease-in-out infinite,
    rainbowAuraTranscendente 12s linear infinite;
}
.conq-card.tier-transcendente {
  animation: rainbowBorderTranscendente 7s ease-in-out infinite;
  border-color: rgba(168, 85, 247, 0.35);
}
.conq-card.tier-transcendente:hover {
  animation: none;
  transform: translateY(-3px) scale(1.02);
  box-shadow:
    0 0 60px rgba(236, 72, 153, 0.45),
    0 0 80px rgba(168, 85, 247, 0.3),
    0 0 100px rgba(6, 182, 212, 0.2),
    0 0 120px rgba(245, 158, 11, 0.12),
    inset 0 0 0 2px rgba(236, 72, 153, 0.55);
}

/* Cards bloqueados não ganham animação de raridade */
.conq-card.locked::after {
  display: none;
}
.conq-card.locked.tier-epico,
.conq-card.locked.tier-lendario,
.conq-card.locked.tier-diamante,
.conq-card.locked.tier-mitico,
.conq-card.locked.tier-suprema,
.conq-card.locked.tier-transcendente {
  animation: none;
  box-shadow: none;
}
</style>
