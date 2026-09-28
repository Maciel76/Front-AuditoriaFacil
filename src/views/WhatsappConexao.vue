<script setup>
/**
 * Conexão do WhatsApp da loja e escolha dos grupos que recebem os painéis.
 *
 * O pareamento é por QR Code, como no WhatsApp Web: a tela dispara a conexão
 * na API e fica consultando o status em laço curto enquanto o código está
 * válido. Depois de conectado, a lista de grupos vem do próprio número — só dá
 * para escolher grupo em que aquela linha já participa.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import api from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import Loader from "@/components/Loader.vue";
import CompartilhamentoAutomatico from "@/components/CompartilhamentoAutomatico.vue";

const auth = useAuthStore();
const ui = useUiStore();

const INTERVALO_POLL_MS = 2500;

const carregando = ref(true);
const conexao = ref(null);
const grupos = ref([]);
const lojas = ref([]);
const lojaSelecionadaId = ref("");
const carregandoLojas = ref(false);

const conectando = ref(false);
const sincronizandoGrupos = ref(false);
const salvando = ref(false);
const enviandoTeste = ref(false);
const reenviando = ref(false);
const detalheReenvio = ref("");
const detalheTeste = ref("");
const compartilhamentoRef = ref(null);

// Rascunho da configuração: só vai para a API quando o usuário salva.
const form = ref({
  ativo: false,
  grupos: [],
  periodoCaptura: "auditoria",
  incluirDashboard: true,
  incluirRanking: true,
  incluirRelatorioCorredor: false,
  incluirRelatorioClasse: false,
  legenda: "",
});

let pollTimer = null;

const PERIODOS = [
  {
    valor: "auditoria",
    titulo: "Dia da auditoria",
    descricao:
      "Recorta o dia da planilha que acabou de entrar. Planilha enviada com atraso continua mostrando o dia correto.",
  },
  {
    valor: "hoje",
    titulo: "Hoje",
    descricao: "Sempre o dia de hoje, independentemente da data da planilha.",
  },
  {
    valor: "semana",
    titulo: "Últimos 7 dias",
    descricao: "Acumulado da semana até o momento do envio.",
  },
  {
    valor: "mes",
    titulo: "Últimos 30 dias",
    descricao: "Acumulado do mês até o momento do envio.",
  },
];

const PAINEIS = [
  {
    campo: "incluirDashboard",
    titulo: "Dashboard",
    descricao: "Visão geral com KPIs, gráficos e conformidade do dia.",
  },
  {
    campo: "incluirRanking",
    titulo: "Ranking de colaboradores",
    descricao: "Pódio e classificação dos colaboradores no dia da auditoria.",
  },
  {
    campo: "incluirRelatorioCorredor",
    titulo: "Relatório por corredor",
    descricao: "Grade de corredores com conformidade e itens lidos.",
  },
  {
    campo: "incluirRelatorioClasse",
    titulo: "Relatório por classe",
    descricao: "Tabela de classes com desempenho e colaboradores.",
  },
];

const conectado = computed(() => conexao.value?.status === "connected");
const aguardandoQr = computed(() => conexao.value?.status === "connecting");
const precisaEscolherLoja = computed(
  () => auth.isSuperAdmin && !lojaSelecionadaId.value,
);

/**
 * Grupo "so administradores" onde o numero nao consta como admin continua na
 * lista, so que avisado: a deteccao de quem e admin depende do formato de id
 * que o aparelho usa, e esconder o grupo por um falso negativo tiraria da loja
 * um destino que ela poderia usar.
 */
function grupoArriscado(grupo) {
  return grupo.somenteAdmins && !grupo.souAdmin;
}
const totalArriscados = computed(
  () => grupos.value.filter(grupoArriscado).length,
);

const jidsEscolhidos = computed(() => new Set(form.value.grupos.map((g) => g.jid)));

const algumPainelLigado = computed(() =>
  PAINEIS.some((p) => form.value[p.campo]),
);

const ultimoEnvio = computed(() => conexao.value?.ultimoEnvio || null);

const podeReenviar = computed(() => !!ultimoEnvio.value && conectado.value);

const periodoEscolhido = computed(
  () =>
    PERIODOS.find((p) => p.valor === form.value.periodoCaptura) || PERIODOS[0],
);

function paramsLoja(extra = {}) {
  if (auth.isSuperAdmin && lojaSelecionadaId.value) {
    return { ...extra, lojaId: lojaSelecionadaId.value };
  }
  return { ...extra };
}

function aplicarConexao(data) {
  conexao.value = data;
  const config = data?.compartilhamentoAuto || {};
  form.value = {
    ativo: !!config.ativo,
    grupos: (config.grupos || []).map((g) => ({ jid: g.jid, nome: g.nome })),
    periodoCaptura: config.periodoCaptura || "auditoria",
    incluirDashboard: config.incluirDashboard !== false,
    incluirRanking: config.incluirRanking !== false,
    incluirRelatorioCorredor: !!config.incluirRelatorioCorredor,
    incluirRelatorioClasse: !!config.incluirRelatorioClasse,
    legenda: config.legenda || "",
  };
}

async function carregarLojas() {
  if (!auth.isSuperAdmin) return;
  carregandoLojas.value = true;
  try {
    const { data } = await api.get("/lojas");
    lojas.value = (data.items || []).filter((loja) => loja.ativa !== false);
  } catch {
    lojas.value = [];
  } finally {
    carregandoLojas.value = false;
  }
}

async function carregarConexao() {
  if (precisaEscolherLoja.value) {
    conexao.value = null;
    grupos.value = [];
    carregando.value = false;
    return;
  }

  carregando.value = true;
  try {
    const { data } = await api.get("/whatsapp/conexao", { params: paramsLoja() });
    aplicarConexao(data);
    await carregarGrupos();
  } catch (error) {
    ui.erro(
      error?.response?.data?.error || "Não foi possível ler a conexão da loja",
    );
    conexao.value = null;
  } finally {
    carregando.value = false;
  }
}

async function carregarGrupos() {
  try {
    const { data } = await api.get("/whatsapp/grupos", { params: paramsLoja() });
    grupos.value = data.items || [];
  } catch {
    grupos.value = [];
  }
}

/**
 * Consulta o status em laço enquanto o QR está na tela.
 *
 * Só a API sabe quando o celular leu o código; sem essa consulta o usuário
 * ficaria olhando um QR já usado sem saber que deu certo.
 */
function iniciarPolling() {
  pararPolling();
  pollTimer = setInterval(async () => {
    if (precisaEscolherLoja.value) return;
    try {
      const { data } = await api.get("/whatsapp/conexao", {
        params: paramsLoja(),
      });
      const statusAnterior = conexao.value?.status;
      // A configuração em edição não pode ser sobrescrita pelo poll: só o
      // status/QR vêm daqui, o formulário continua sendo do usuário.
      conexao.value = { ...data, compartilhamentoAuto: conexao.value?.compartilhamentoAuto };

      if (data.status === "connected" && statusAnterior !== "connected") {
        ui.sucesso("WhatsApp conectado!");
        pararPolling();
        await carregarGrupos();
      }
      if (data.status === "disconnected" && statusAnterior === "connecting") {
        pararPolling();
      }
    } catch {
      /* uma consulta perdida não derruba o laço */
    }
  }, INTERVALO_POLL_MS);
}

function pararPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

async function conectar(novoPareamento = false) {
  if (precisaEscolherLoja.value) {
    ui.erro("Escolha a loja primeiro");
    return;
  }

  conectando.value = true;
  try {
    const { data } = await api.post(
      "/whatsapp/conexao/conectar",
      { novoPareamento },
      { params: paramsLoja() },
    );
    conexao.value = { ...conexao.value, status: data.status, qrCode: data.qrCode };
    iniciarPolling();
    ui.info("Abra o WhatsApp da loja e leia o QR Code");
  } catch (error) {
    ui.erro(error?.response?.data?.error || "Não foi possível iniciar a conexão");
  } finally {
    conectando.value = false;
  }
}

async function desconectar() {
  try {
    await api.post("/whatsapp/conexao/desconectar", {}, { params: paramsLoja() });
    pararPolling();
    await carregarConexao();
    ui.info("Conexão encerrada. O pareamento foi mantido.");
  } catch (error) {
    ui.erro(error?.response?.data?.error || "Não foi possível desconectar");
  }
}

async function desvincular() {
  const ok = window.confirm(
    "Desvincular remove o aparelho da loja e apaga a sessão. Será preciso ler o QR Code de novo e escolher os grupos outra vez. Continuar?",
  );
  if (!ok) return;

  try {
    await api.post("/whatsapp/conexao/desvincular", {}, { params: paramsLoja() });
    pararPolling();
    await carregarConexao();
    ui.info("Número desvinculado");
  } catch (error) {
    ui.erro(error?.response?.data?.error || "Não foi possível desvincular");
  }
}

async function sincronizarGrupos() {
  sincronizandoGrupos.value = true;
  try {
    const { data } = await api.post(
      "/whatsapp/grupos/sincronizar",
      {},
      { params: paramsLoja() },
    );
    grupos.value = data.items || [];

    // Grupo que sumiu do celular não pode continuar como destino salvo.
    const conhecidos = new Set(grupos.value.map((g) => g.jid));
    form.value.grupos = form.value.grupos.filter((g) => conhecidos.has(g.jid));

    ui.sucesso(`${data.total} grupo(s) encontrado(s)`);
  } catch (error) {
    ui.erro(
      error?.response?.data?.error || "Não foi possível sincronizar os grupos",
    );
  } finally {
    sincronizandoGrupos.value = false;
  }
}

function alternarGrupo(grupo) {
  const idx = form.value.grupos.findIndex((g) => g.jid === grupo.jid);
  if (idx >= 0) {
    form.value.grupos.splice(idx, 1);
    return;
  }
  if (form.value.grupos.length >= 10) {
    ui.erro("Máximo de 10 grupos por loja");
    return;
  }
  form.value.grupos.push({ jid: grupo.jid, nome: grupo.nome });
}

async function salvar() {
  if (form.value.ativo && !form.value.grupos.length) {
    ui.erro("Escolha ao menos um grupo para ligar o compartilhamento");
    return;
  }
  if (form.value.ativo && !algumPainelLigado.value) {
    ui.erro("Escolha ao menos um painel para enviar");
    return;
  }

  salvando.value = true;
  try {
    const { data } = await api.put("/whatsapp/compartilhamento", form.value, {
      params: paramsLoja(),
    });
    aplicarConexao({ ...conexao.value, ...data });
    ui.sucesso("Configuração salva");
  } catch (error) {
    ui.erro(error?.response?.data?.error || "Não foi possível salvar");
  } finally {
    salvando.value = false;
  }
}

/**
 * Manda os painéis de hoje para os grupos escolhidos, ignorando o liga/desliga.
 *
 * Serve para a loja conferir formato e destino sem precisar subir uma planilha
 * de verdade só para testar.
 */
async function enviarTeste() {
  if (!form.value.grupos.length) {
    ui.erro("Escolha e salve ao menos um grupo antes de testar");
    return;
  }

  enviandoTeste.value = true;
  detalheTeste.value = "Preparando imagens";
  try {
    // O teste usa o dia da última auditoria da loja, não "hoje": num dia sem
    // planilha as telas sairiam vazias e o teste não mostraria nada.
    let dia = new Date().toISOString().slice(0, 10);
    try {
      const { data } = await api.get("/metricas/ultima-data", {
        params: paramsLoja(),
      });
      if (data?.data) dia = new Date(data.data).toISOString().slice(0, 10);
    } catch {
      /* sem última data, tenta com hoje mesmo */
    }

    const retorno = await compartilhamentoRef.value.dispararParaAuditoria({
      lojaId: auth.isSuperAdmin ? lojaSelecionadaId.value : "",
      auditoria: { dataAuditoria: dia },
      teste: true,
    });

    if (retorno?.enviado) {
      ui.sucesso(`Teste enviado: ${retorno.totalEnviados} imagem(ns)`);
      return;
    }
    ui.erro(`Teste não enviado: ${explicarMotivo(retorno)}`);
  } finally {
    enviandoTeste.value = false;
    detalheTeste.value = "";
    await atualizarUltimoEnvio();
  }
}

const MOTIVOS = {
  desligado: "o compartilhamento automático está desligado",
  desconectado: "o WhatsApp da loja não está conectado",
  "sem-grupo": "nenhum grupo salvo como destino",
  "sem-painel": "nenhum painel marcado para envio",
  "sem-imagem": "não havia dados para gerar as imagens",
};

function explicarMotivo(retorno) {
  if (retorno?.erro) return retorno.erro;
  return MOTIVOS[retorno?.motivo] || retorno?.motivo || "falha desconhecida";
}

/** Relê só a ficha do último envio, sem encostar no formulário em edição. */
async function atualizarUltimoEnvio() {
  try {
    const { data } = await api.get("/whatsapp/conexao", { params: paramsLoja() });
    if (conexao.value) conexao.value.ultimoEnvio = data.ultimoEnvio || null;
  } catch {
    /* a ficha volta na próxima leitura */
  }
}

/**
 * Refaz e manda de novo os painéis do último envio.
 *
 * Nada fica guardado no servidor: as imagens são geradas na hora, em memória,
 * com o MESMO recorte daquele envio (mesma auditoria, mesmo tipo, mesmo
 * período) — por isso o print sai equivalente ao primeiro, sem ocupar disco
 * nenhum no intervalo.
 */
async function reenviar() {
  if (!podeReenviar.value || reenviando.value) return;

  const contexto = ultimoEnvio.value?.contexto || {};

  reenviando.value = true;
  detalheReenvio.value = "Gerando as imagens";
  try {
    const retorno = await compartilhamentoRef.value.dispararParaAuditoria({
      lojaId: auth.isSuperAdmin ? lojaSelecionadaId.value : "",
      auditoria: {
        tipo: contexto.tipo || "",
        dataAuditoria: contexto.data || null,
        taxaConformidade: contexto.taxaConformidade,
        totalLidos: contexto.totalLidos,
      },
      teste: true,
      periodoForcado: contexto.periodoCaptura || null,
    });

    if (retorno?.enviado) {
      const falhas = retorno.totalFalhas
        ? ` (${retorno.totalFalhas} não entregue(s))`
        : "";
      ui.sucesso(`Reenviado: ${retorno.totalEnviados} imagem(ns)${falhas}`);
    } else {
      ui.erro(`Não foi possível reenviar: ${explicarMotivo(retorno)}`);
    }
  } finally {
    reenviando.value = false;
    detalheReenvio.value = "";
    await atualizarUltimoEnvio();
  }
}

function formatarDataHora(valor) {
  if (!valor) return "";
  return new Date(valor).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function aoProgressoTeste(mensagem) {
  detalheTeste.value = mensagem;
  if (reenviando.value) detalheReenvio.value = mensagem;
}

function formatarTelefone(numero) {
  const limpo = String(numero || "").replace(/\D/g, "");
  if (limpo.length < 12) return numero || "—";
  const ddi = limpo.slice(0, 2);
  const ddd = limpo.slice(2, 4);
  const resto = limpo.slice(4);
  const meio = resto.slice(0, resto.length - 4);
  return `+${ddi} (${ddd}) ${meio}-${resto.slice(-4)}`;
}

watch(lojaSelecionadaId, async () => {
  pararPolling();
  await carregarConexao();
  if (conexao.value?.status === "connecting") iniciarPolling();
});

onMounted(async () => {
  await carregarLojas();
  await carregarConexao();
  if (conexao.value?.status === "connecting") iniciarPolling();
});

onBeforeUnmount(pararPolling);
</script>

<template>
  <div class="grid gap-3">
    <CompartilhamentoAutomatico
      ref="compartilhamentoRef"
      @progresso="aoProgressoTeste"
    />

    <div class="card">
      <h3 class="mt-0">
        <fa :icon="['fab', 'whatsapp']" /> WhatsApp da loja
      </h3>
      <p class="muted" style="margin-top: 0">
        Conecte o WhatsApp da loja e escolha os grupos que recebem
        automaticamente as imagens do dashboard, do ranking e dos relatórios a
        cada planilha enviada.
      </p>

      <div v-if="auth.isSuperAdmin" class="field" style="max-width: 420px">
        <label>Loja</label>
        <select v-model="lojaSelecionadaId" :disabled="carregandoLojas">
          <option value="">Selecione a loja…</option>
          <option v-for="loja in lojas" :key="loja._id" :value="loja._id">
            {{ loja.nome }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="precisaEscolherLoja" class="card empty">
      <fa icon="store" style="font-size: 40px; opacity: 0.25" />
      <p class="muted">Escolha uma loja para configurar o WhatsApp dela.</p>
    </div>

    <Loader v-else-if="carregando" />

    <template v-else-if="conexao">
      <!-- ── Status da conexão ── -->
      <div class="card">
        <div class="row" style="align-items: center; gap: 12px">
          <span
            class="badge"
            :class="conectado ? 'good' : aguardandoQr ? 'warn' : 'bad'"
          >
            {{
              conectado
                ? "Conectado"
                : aguardandoQr
                  ? "Aguardando leitura do QR"
                  : "Desconectado"
            }}
          </span>
          <span v-if="conectado && conexao.phoneNumber" class="muted">
            {{ formatarTelefone(conexao.phoneNumber) }}
          </span>
          <span class="spacer" />

          <button
            v-if="!conectado"
            class="btn primary"
            :disabled="conectando"
            @click="conectar(false)"
          >
            <fa icon="link" />
            {{ aguardandoQr ? "Gerar novo QR" : "Conectar WhatsApp" }}
          </button>

          <template v-else>
            <button class="btn ghost" @click="desconectar">
              <fa icon="plug" /> Desconectar
            </button>
            <button class="btn ghost" @click="desvincular">
              <fa icon="trash" /> Desvincular número
            </button>
          </template>
        </div>

        <p v-if="conexao.ultimoErro && !conectado" class="badge bad" style="margin-top: 10px">
          {{ conexao.ultimoErro }}
        </p>

        <div v-if="aguardandoQr" class="qr-area">
          <img v-if="conexao.qrCode" :src="conexao.qrCode" alt="QR Code do WhatsApp" />
          <Loader v-else />
          <ol class="muted qr-passos">
            <li>Abra o WhatsApp no celular da loja.</li>
            <li>Toque em <strong>Configurações → Aparelhos conectados</strong>.</li>
            <li>Toque em <strong>Conectar aparelho</strong> e aponte para o código.</li>
          </ol>
        </div>
      </div>

      <!-- ── Grupos ── -->
      <div v-if="conectado" class="card">
        <div class="row" style="align-items: center">
          <h3 class="mt-0 mb-0"><fa icon="users" /> Grupos de destino</h3>
          <span class="spacer" />
          <button
            class="btn ghost"
            :disabled="sincronizandoGrupos"
            @click="sincronizarGrupos"
          >
            <fa icon="rotate" />
            {{ sincronizandoGrupos ? "Buscando…" : "Atualizar lista" }}
          </button>
        </div>

        <p v-if="!grupos.length" class="muted">
          Nenhum grupo encontrado ainda. Clique em <strong>Atualizar lista</strong>
          — só aparecem grupos em que este número já participa.
        </p>

        <ul v-else class="grupo-lista">
          <li
            v-for="grupo in grupos"
            :key="grupo.jid"
            class="grupo-item"
            :class="{ escolhido: jidsEscolhidos.has(grupo.jid) }"
          >
            <label>
              <input
                type="checkbox"
                :checked="jidsEscolhidos.has(grupo.jid)"
                @change="alternarGrupo(grupo)"
              />
              <span class="grupo-nome">{{ grupo.nome || grupo.jid }}</span>
              <span v-if="grupoArriscado(grupo)" class="badge warn" title="Grupo restrito a administradores">
                <fa icon="lock" /> só admins
              </span>
              <span class="muted grupo-meta">
                {{ grupo.participantes }} participante(s)
              </span>
            </label>
          </li>
        </ul>

        <p v-if="totalArriscados" class="muted" style="font-size: 13px">
          <fa icon="lock" />
          {{ totalArriscados }} grupo(s) só aceitam mensagem de administradores.
          Se este número não for admin lá, o envio será recusado pelo WhatsApp.
        </p>
      </div>

      <!-- ── Último envio / reenvio ── -->
      <div v-if="conectado && ultimoEnvio" class="card">
        <div class="row" style="align-items: center">
          <h3 class="mt-0 mb-0"><fa icon="rotate" /> Último envio</h3>
          <span class="spacer" />
          <button
            class="btn primary"
            :disabled="!podeReenviar || reenviando"
            @click="reenviar"
          >
            <fa icon="paper-plane" />
            {{ reenviando ? "Reenviando…" : "Reenviar" }}
          </button>
        </div>

        <p class="muted" style="margin-bottom: 6px">
          {{ formatarDataHora(ultimoEnvio.em) }} —
          {{ ultimoEnvio.totalEnviados }} imagem(ns) para
          {{ ultimoEnvio.grupos.join(", ") || "—" }}.
        </p>

        <ul class="envio-paineis">
          <li v-for="painel in ultimoEnvio.paineis" :key="painel.chave">
            {{ painel.titulo || painel.chave }}
          </li>
        </ul>

        <p v-if="reenviando" class="muted" style="font-size: 13px">
          {{ detalheReenvio }}
        </p>

        <p class="muted" style="font-size: 13px; margin-bottom: 0">
          <fa icon="lock" />
          Nenhuma imagem fica guardada no servidor: o reenvio gera tudo de novo
          na hora, com o mesmo recorte desta auditoria, e manda para os grupos
          marcados agora.
        </p>
      </div>

      <!-- ── Compartilhamento automático ── -->
      <div v-if="conectado" class="card">
        <h3 class="mt-0"><fa icon="share-nodes" /> Compartilhamento automático</h3>

        <label class="linha-toggle">
          <input type="checkbox" v-model="form.ativo" />
          <span>
            <strong>Enviar automaticamente a cada planilha nova</strong>
            <small class="muted">
              Ao terminar de processar uma auditoria, as imagens do dia daquela
              loja vão para os grupos escolhidos.
            </small>
          </span>
        </label>

        <h4>Período mostrado nas imagens</h4>
        <div class="field" style="max-width: 420px">
          <select v-model="form.periodoCaptura">
            <option v-for="p in PERIODOS" :key="p.valor" :value="p.valor">
              {{ p.titulo }}
            </option>
          </select>
          <small class="muted">{{ periodoEscolhido.descricao }}</small>
        </div>

        <h4>Painéis enviados</h4>
        <label v-for="painel in PAINEIS" :key="painel.campo" class="linha-toggle">
          <input type="checkbox" v-model="form[painel.campo]" />
          <span>
            <strong>{{ painel.titulo }}</strong>
            <small class="muted">{{ painel.descricao }}</small>
          </span>
        </label>

        <div class="field" style="margin-top: 16px">
          <label>Legenda da primeira imagem</label>
          <textarea
            v-model="form.legenda"
            rows="4"
            placeholder="Deixe vazio para usar a legenda padrão"
          ></textarea>
          <small class="muted">
            Use <code>{loja}</code>, <code>{tipo}</code>, <code>{data}</code>,
            <code>{taxa}</code> e <code>{itens}</code>.
          </small>
        </div>

        <div class="row" style="margin-top: 16px; align-items: center">
          <button class="btn primary" :disabled="salvando" @click="salvar">
            <fa icon="floppy-disk" /> {{ salvando ? "Salvando…" : "Salvar" }}
          </button>
          <button
            class="btn ghost"
            :disabled="enviandoTeste || !conexao.compartilhamentoAuto?.grupos?.length"
            @click="enviarTeste"
          >
            <fa icon="paper-plane" />
            {{ enviandoTeste ? "Enviando…" : "Enviar teste agora" }}
          </button>
          <span v-if="enviandoTeste" class="muted">{{ detalheTeste }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.qr-area {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 24px;
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
}

.qr-area img {
  width: 260px;
  height: 260px;
  border-radius: var(--radius);
  background: #fff;
  padding: 10px;
}

.qr-passos {
  margin: 0;
  padding-left: 20px;
  line-height: 1.9;
}

.grupo-lista {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.grupo-item {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  transition: border-color 0.15s ease;
}

.grupo-item.escolhido {
  border-color: var(--primary);
}

.grupo-item label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  margin: 0;
}

.grupo-nome {
  font-weight: 600;
}

.grupo-meta {
  margin-left: auto;
  font-size: 13px;
}

.envio-paineis {
  margin: 0 0 10px;
  padding-left: 20px;
  font-size: 13px;
  color: var(--text-dim);
}

.linha-toggle {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;
  cursor: pointer;
}

.linha-toggle span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.linha-toggle small {
  font-size: 13px;
}

@media (max-width: 640px) {
  .qr-area img {
    width: 100%;
    max-width: 280px;
    height: auto;
  }
}
</style>
