<script setup>
/**
 * Compartilhamento automático dos painéis no WhatsApp após um upload.
 *
 * As imagens do Dashboard, do Ranking e dos Relatórios nascem do DOM
 * (html2canvas), então não existe como o servidor gerá-las sozinho. Este
 * componente monta essas telas num palco fora da área visível, com os filtros
 * da auditoria recém-enviada (loja + dia + tipo), espera cada uma terminar de
 * carregar, tira o print e manda tudo para a API, que repassa aos grupos.
 *
 * Fica montado em quem faz upload e não aparece para o usuário: o palco é
 * posicionado longe da viewport, e não `display:none`, porque html2canvas
 * precisa de layout real para medir os elementos.
 */
import { ref, shallowRef, nextTick } from "vue";
import api from "@/services/api";

import Dashboard from "@/views/Dashboard.vue";
import RankingColaboradores from "@/views/RankingColaboradores.vue";
import Relatorios from "@/views/Relatorios.vue";

// Largura do palco: fixa em desktop para o print sair sempre igual,
// independentemente do tamanho da janela de quem enviou a planilha.
const LARGURA_PALCO = 1280;
const TIMEOUT_CARREGAMENTO_MS = 45_000;

const painelAtivo = ref(null);
const filtros = ref(null);
const viewRef = shallowRef(null);

/**
 * `progresso` leva a frase curta que a tela mostra; `estado` leva a contagem
 * das imagens — quantas já ficaram prontas, de quantas, e para quantos grupos
 * vão — para quem quiser mostrar o andamento em número.
 */
const emit = defineEmits(["progresso", "estado"]);

/**
 * Dois quadros de renderização, ou 400ms, o que vier primeiro.
 *
 * O prazo importa: com a aba em segundo plano — upload rodando enquanto o
 * usuário olha outra coisa — `requestAnimationFrame` não dispara e a captura
 * ficaria pendurada sem nunca mandar nada para o grupo.
 */
function esperarFrame() {
  return new Promise((resolve) => {
    let concluido = false;
    const concluir = () => {
      if (concluido) return;
      concluido = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(concluir, 400);
    requestAnimationFrame(() => requestAnimationFrame(concluir));
  });
}

/**
 * Espera a tela montada terminar de buscar os dados.
 *
 * O limite existe porque uma API lenta não pode travar a fila de uploads:
 * estourou o tempo, o painel é descartado e os outros seguem.
 */
async function esperarTelaPronta() {
  const limite = Date.now() + TIMEOUT_CARREGAMENTO_MS;
  while (Date.now() < limite) {
    if (viewRef.value?.prontoParaCaptura) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function montarPainel(nome, filtrosPainel) {
  filtros.value = filtrosPainel;
  painelAtivo.value = nome;
  await nextTick();

  const pronta = await esperarTelaPronta();
  if (!pronta) return false;

  // Gráficos e as animações de entrada dos cards precisam de um respiro
  // depois do carregamento, senão o print pega tudo pela metade.
  await esperarFrame();
  await new Promise((r) => setTimeout(r, 900));
  return true;
}

function desmontarPainel() {
  painelAtivo.value = null;
  filtros.value = null;
}

/**
 * Renderiza e captura os painéis pedidos.
 * Devolve [{ chave, blob }] apenas do que realmente virou imagem.
 */
async function capturarPaineis(filtrosCaptura, chaves) {
  const capturas = [];

  // A contagem é reemitida a cada painel que sai do palco: quem enviou a
  // planilha vê "2 de 4 imagens" em vez de um spinner sem fim.
  const relatarContagem = () =>
    emit("estado", {
      fase: "gerando",
      prontas: capturas.length,
      total: chaves.length,
    });

  const precisaRelatorios =
    chaves.includes("relatorio-corredor") ||
    chaves.includes("relatorio-classe");

  try {
    if (chaves.includes("dashboard")) {
      emit("progresso", "Gerando imagem do dashboard");
      if (await montarPainel("dashboard", filtrosCaptura)) {
        // Dia sem número nenhum vira um print de estado vazio; o grupo não
        // ganha nada com isso.
        if (!viewRef.value.semDados) {
          const blob = await viewRef.value.gerarImagemCompartilhamento();
          if (blob) capturas.push({ chave: "dashboard", blob });
        }
      }
      desmontarPainel();
      await nextTick();
      relatarContagem();
    }

    if (chaves.includes("ranking")) {
      emit("progresso", "Gerando imagem do ranking");
      if (await montarPainel("ranking", filtrosCaptura)) {
        // Pódio vazio vira um print sem conteúdo; melhor não mandar nada.
        if (!viewRef.value.semDados) {
          const blob = await viewRef.value.gerarImagemCompartilhamento();
          if (blob) capturas.push({ chave: "ranking", blob });
        }
      }
      desmontarPainel();
      await nextTick();
      relatarContagem();
    }

    if (precisaRelatorios) {
      emit("progresso", "Gerando imagens dos relatórios");
      // Corredor e classe saem da MESMA montagem: são duas áreas da mesma
      // tela, e remontá-la só para o segundo print dobraria as requisições.
      if (await montarPainel("relatorios", filtrosCaptura)) {
        if (chaves.includes("relatorio-corredor")) {
          const blob = await viewRef.value.gerarImagemCorredor();
          if (blob) capturas.push({ chave: "relatorio-corredor", blob });
        }
        if (chaves.includes("relatorio-classe")) {
          const blob = await viewRef.value.gerarImagemClasse();
          if (blob) capturas.push({ chave: "relatorio-classe", blob });
        }
      }
      desmontarPainel();
      await nextTick();
      relatarContagem();
    }
  } finally {
    desmontarPainel();
  }

  return capturas;
}

function paramsLoja(lojaId) {
  return lojaId ? { lojaId } : {};
}

/**
 * Ponto de entrada: chamar depois que a planilha terminou de processar.
 *
 * `auditoria` traz o que a API devolveu do processamento (tipo, dataAuditoria,
 * taxa, itens) e `lojaId` é a loja de destino do upload. Nunca lança — falha
 * de compartilhamento não pode transformar um upload bem-sucedido em erro.
 */
async function dispararParaAuditoria({
  lojaId,
  auditoria,
  teste = false,
  periodoForcado = null,
}) {
  try {
    const { data: conexao } = await api.get("/whatsapp/conexao", {
      params: paramsLoja(lojaId),
    });

    const config = conexao?.compartilhamentoAuto;
    // O teste manual serve justamente para conferir a configuração antes de
    // ligar o automático, então ele passa por cima do liga/desliga.
    if (!teste && !config?.ativo) return { ignorado: true, motivo: "desligado" };
    if (conexao.status !== "connected") {
      return { ignorado: true, motivo: "desconectado" };
    }
    if (!config.grupos?.length) {
      return { ignorado: true, motivo: "sem-grupo" };
    }

    const chaves = [
      config.incluirDashboard && "dashboard",
      config.incluirRanking && "ranking",
      config.incluirRelatorioCorredor && "relatorio-corredor",
      config.incluirRelatorioClasse && "relatorio-classe",
    ].filter(Boolean);

    if (!chaves.length) return { ignorado: true, motivo: "sem-painel" };

    if (teste) emit("progresso", "Montando as telas");
    emit("estado", {
      fase: "gerando",
      prontas: 0,
      total: chaves.length,
      grupos: config.grupos.length,
    });

    // O reenvio refaz a MESMA auditoria, então traz o recorte daquele envio
    // em vez do que estiver configurado agora.
    const periodoCaptura =
      periodoForcado || config.periodoCaptura || "auditoria";
    const dia = auditoria?.dataAuditoria
      ? new Date(auditoria.dataAuditoria).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    // "auditoria" (padrão) recorta exatamente o dia da planilha que entrou —
    // planilha enviada com atraso continua mostrando o dia certo. Os demais
    // recortes vão como período nomeado, e cada tela traduz para o próprio
    // vocabulário de filtro.
    const filtrosCaptura =
      periodoCaptura === "auditoria"
        ? { dataInicio: dia, dataFim: dia }
        : { periodo: periodoCaptura };

    const capturas = await capturarPaineis(
      {
        lojaId: lojaId || "",
        tipo: auditoria?.tipo || "",
        ...filtrosCaptura,
      },
      chaves,
    );

    if (!capturas.length) {
      return { ignorado: true, motivo: "sem-imagem" };
    }

    emit("progresso", "Enviando para o WhatsApp");
    emit("estado", {
      fase: "enviando",
      prontas: capturas.length,
      total: capturas.length,
      paineis: capturas.map((captura) => captura.chave),
    });

    const fd = new FormData();
    for (const captura of capturas) {
      fd.append(captura.chave, captura.blob, `${captura.chave}.png`);
    }
    fd.append(
      "contexto",
      JSON.stringify({
        tipo: auditoria?.tipo || "",
        data: dia,
        taxaConformidade: auditoria?.taxaConformidade,
        totalLidos: auditoria?.totalLidos,
        auditoriaId: auditoria?.auditoriaId,
        periodoCaptura,
      }),
    );
    if (teste) fd.append("teste", "true");

    const { data } = await api.post("/whatsapp/compartilhar", fd, {
      params: paramsLoja(lojaId),
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 180_000,
    });

    return data;
  } catch (error) {
    console.error("[whatsapp] compartilhamento automático falhou:", error);
    return {
      enviado: false,
      erro:
        error?.response?.data?.error ||
        error?.message ||
        "Falha ao compartilhar no WhatsApp",
    };
  }
}

defineExpose({ dispararParaAuditoria });
</script>

<template>
  <div
    v-if="painelAtivo"
    class="captura-palco"
    aria-hidden="true"
    :style="{ width: `${LARGURA_PALCO}px` }"
  >
    <Dashboard
      v-if="painelAtivo === 'dashboard'"
      ref="viewRef"
      modo-captura
      :captura-filtros="filtros"
    />
    <RankingColaboradores
      v-else-if="painelAtivo === 'ranking'"
      ref="viewRef"
      modo-captura
      :captura-filtros="filtros"
    />
    <Relatorios
      v-else-if="painelAtivo === 'relatorios'"
      ref="viewRef"
      modo-captura
      :captura-filtros="filtros"
    />
  </div>
</template>

<style scoped>
/*
 * Fora da viewport, mas com layout real: html2canvas mede os elementos, então
 * `display:none` ou `visibility:hidden` produziriam imagem em branco.
 */
.captura-palco {
  position: fixed;
  left: -30000px;
  top: 0;
  z-index: -1;
  pointer-events: none;
  padding: 24px;
  box-sizing: border-box;
  background: var(--bg-0);
}
</style>
