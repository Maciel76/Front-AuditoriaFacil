<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import api from "@/services/api";
import ColaboradorAvatar from "@/components/ColaboradorAvatar.vue";
import PeriodoSelector from "@/components/PeriodoSelector.vue";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const titulo = ref(null);
const tipos = { ETIQUETA: "Etiqueta", PRESENCA: "Presença", RUPTURA: "Ruptura" };
const cores = [
  { id: "verde", label: "Verdes", descricao: "Meta atingida", icon: "check" },
  { id: "amarelo", label: "Amarelos", descricao: "Precisam de atenção", icon: "triangle-exclamation" },
  { id: "vermelho", label: "Vermelhos", descricao: "Abaixo do esperado", icon: "arrow-trend-down" },
];
const labels = { verde: "Meta atingida", amarelo: "Atenção", vermelho: "Abaixo do esperado", "sem-base": "Sem referência" };
const numero = (n) => Number(n || 0).toLocaleString("pt-BR");
const pct = (n) => n == null ? "—" : `${Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const data = (d) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" });
const normalizar = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const hoje = () => new Date().toLocaleDateString("en-CA");
const textoQuery = (key) => typeof route.query[key] === "string" ? route.query[key] : "";
const opcoesOrdenacao = [
  { id: "meta", label: "Maior % na meta", coluna: "Na meta", campo: "percentualMeta", percentual: true, descricao: "Percentual de resultados verdes, do maior para o menor." },
  { id: "verdes", label: "Mais verdes", coluna: "Verdes", campo: "verde", descricao: "Quantidade de resultados verdes, do maior para o menor." },
  { id: "amarelos", label: "Mais amarelos", coluna: "Amarelos", campo: "amarelo", descricao: "Quantidade de resultados amarelos, do maior para o menor." },
  { id: "vermelhos", label: "Mais vermelhos", coluna: "Vermelhos", campo: "vermelho", descricao: "Quantidade de resultados vermelhos, do maior para o menor." },
  { id: "media", label: "Maior média", coluna: "Média dos corredores", campo: "taxa", percentual: true, descricao: "Média ponderada dos corredores, da maior para a menor." },
  { id: "participacoes", label: "Mais participações", coluna: "Participações", campo: "totalParticipacoes", descricao: "Total de participações em corredores nas auditorias, do maior para o menor." },
];
const ordenacao = computed({
  get: () => opcoesOrdenacao.some((o) => o.id === textoQuery("ordenacao")) ? textoQuery("ordenacao") : "meta",
  set: (valor) => router.replace({ query: { ...params.value, ...(valor !== "meta" ? { ordenacao: valor } : {}) } }),
});
const ordemAtiva = computed(() => opcoesOrdenacao.find((o) => o.id === ordenacao.value));
const queryNavegacao = computed(() => ({ ...params.value, ...(ordenacao.value !== "meta" ? { ordenacao: ordenacao.value } : {}) }));
function lerFiltros() {
  const periodo = textoQuery("periodo");
  return {
    periodo: ["1d", "semana", "mes", "ano", "tudo", "custom"].includes(periodo) ? periodo : "mes",
    tipo: tipos[textoQuery("tipo")] ? textoQuery("tipo") : "",
    lojaId: auth.isSuperAdmin ? textoQuery("lojaId") : "",
    dataInicio: textoQuery("dataInicio") || hoje(),
    dataFim: textoQuery("dataFim") || hoje(),
  };
}
const filtros = reactive(lerFiltros());
const params = computed(() => ({
  periodo: filtros.periodo,
  ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
  ...(auth.isSuperAdmin && filtros.lojaId ? { lojaId: filtros.lojaId } : {}),
  ...(filtros.periodo === "custom" ? { dataInicio: filtros.dataInicio, dataFim: filtros.dataFim } : {}),
}));
watch(() => route.query, () => Object.assign(filtros, lerFiltros()));
watch(() => JSON.stringify(params.value), () => {
  router.replace({ query: queryNavegacao.value });
});

const dados = ref({ items: [], meta: 98, limiteAmarelo: 80 });
const carregando = ref(true);
const erro = ref("");
const lojas = ref([]);
const erroLojas = ref("");
const carregandoLojas = ref(false);
const busca = ref("");
const faixa = ref("");
const perfilId = computed(() => String(route.params.colaboradorId || ""));
const selecionado = computed(() => dados.value.items.find((p) => p.id === perfilId.value));
const linkRanking = computed(() => ({ name: "desempenho-colaboradores", query: queryNavegacao.value }));
const linkPerfil = (p) => ({ name: "desempenho-colaboradores", params: { colaboradorId: p.id }, query: queryNavegacao.value });
const linkRelatorios = computed(() => ({ name: "relatorios", query: params.value }));
const escopoLabel = computed(() => auth.isSuperAdmin
  ? lojas.value.find((l) => l._id === filtros.lojaId)?.nome || (filtros.lojaId ? "Loja selecionada" : "Todas as lojas")
  : auth.loja?.nome || "Sua loja");
const valorOrdenacao = (p) => Number(p[ordemAtiva.value.campo] ?? -1);
const rankingOrdenado = computed(() => [...dados.value.items].sort((a, b) =>
  valorOrdenacao(b) - valorOrdenacao(a)
  || (b.percentualMeta ?? -1) - (a.percentualMeta ?? -1)
  || (b.taxa ?? -1) - (a.taxa ?? -1)
  || (b.totalLidos || 0) - (a.totalLidos || 0)
  || a.nome.localeCompare(b.nome, "pt-BR"),
).map((p, i) => ({ ...p, posicao: i + 1 })));
const posicaoPerfil = computed(() => rankingOrdenado.value.find((p) => p.id === perfilId.value)?.posicao);
const pontuacaoExibida = (p) => ordemAtiva.value.percentual ? pct(p[ordemAtiva.value.campo]) : numero(p[ordemAtiva.value.campo]);
const premiarPrimeiro = computed(() => ["meta", "verdes", "media"].includes(ordenacao.value));
const lista = computed(() => rankingOrdenado.value.filter((p) =>
  normalizar(`${p.nome} ${p.codigoExterno} ${p.lojaNome}`).includes(normalizar(busca.value)) && (!faixa.value || p[faixa.value] > 0)));
const historico = computed(() => (selecionado.value?.historico || []).filter((h) =>
  (!faixa.value || h.faixa === faixa.value) && normalizar(`${h.local} ${tipos[h.tipo]}`).includes(normalizar(busca.value))));
const resultados = computed(() => {
  const participantes = selecionado.value ? [selecionado.value] : dados.value.items;
  return [...new Map(participantes.flatMap((p) => p.historico.map((h) => [h.id, h]))).values()];
});
const contagens = computed(() => Object.fromEntries([...cores.map((c) => c.id), "sem-base"].map((cor) =>
  [cor, resultados.value.filter((h) => h.faixa === cor).length])));
const avaliados = computed(() => resultados.value.length - contagens.value["sem-base"]);
const atencao = computed(() => resultados.value.filter((h) => h.taxa !== null && h.taxa < dados.value.meta)
  .sort((a, b) => a.taxa - b.taxa).slice(0, 4));
const largura = (qtd, total) => `${total ? (qtd / total) * 100 : 0}%`;
const alternarFaixa = (cor) => { faixa.value = faixa.value === cor ? "" : cor; };
const limparBusca = () => { busca.value = ""; faixa.value = ""; };

let requisicao = 0;
let controlador;
async function carregar() {
  const atual = ++requisicao;
  controlador?.abort();
  controlador = new AbortController();
  carregando.value = true;
  erro.value = "";
  try {
    const { data: resposta } = await api.get("/metricas/relatorios/desempenho-colaboradores", {
      params: params.value, signal: controlador.signal,
    });
    if (atual === requisicao) dados.value = resposta;
  } catch (e) {
    if (atual === requisicao && e.code !== "ERR_CANCELED") {
      erro.value = e.response?.data?.error || "Não foi possível carregar os resultados. Tente novamente.";
    }
  } finally {
    if (atual === requisicao) carregando.value = false;
  }
}
async function carregarLojas() {
  if (!auth.isSuperAdmin) return;
  erroLojas.value = "";
  carregandoLojas.value = true;
  try {
    const { data: resposta } = await api.get("/lojas");
    lojas.value = resposta.items || [];
  } catch {
    erroLojas.value = "Não foi possível carregar as lojas.";
  } finally {
    carregandoLojas.value = false;
  }
}
watch(() => JSON.stringify(params.value), carregar, { immediate: true });
watch(perfilId, async () => {
  limparBusca();
  await nextTick();
  titulo.value?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
});
onMounted(carregarLojas);
onBeforeUnmount(() => { requisicao++; controlador?.abort(); });
</script>

<template>
  <div class="performance-page" :aria-busy="carregando">
    <nav class="performance-breadcrumb" aria-label="Navegação do relatório">
      <RouterLink :to="linkRelatorios">Relatórios</RouterLink>
      <span aria-hidden="true">/</span>
      <RouterLink v-if="perfilId" :to="linkRanking">Desempenho</RouterLink>
      <span v-else aria-current="page">Desempenho</span>
      <template v-if="perfilId"><span aria-hidden="true">/</span><span aria-current="page">Perfil do colaborador</span></template>
    </nav>

    <header class="performance-heading">
      <div>
        <h1 ref="titulo" tabindex="-1">{{ perfilId ? 'Perfil de desempenho' : 'Desempenho por corredor' }}</h1>
        <p>{{ perfilId ? 'Cada participação e o resultado de cada auditoria.' : 'Veja quem atinge as metas e como ficam os corredores em cada auditoria.' }}</p>
      </div>
      <RouterLink class="performance-back" :to="perfilId ? linkRanking : linkRelatorios">
        <span aria-hidden="true">←</span> {{ perfilId ? 'Voltar ao ranking' : 'Voltar aos relatórios' }}
      </RouterLink>
    </header>

    <section class="performance-filters" aria-label="Filtros de desempenho">
      <PeriodoSelector v-model="filtros.periodo" v-model:dataInicio="filtros.dataInicio" v-model:dataFim="filtros.dataFim" :loading="carregando" />
      <div class="performance-filter-selects">
        <label><span class="sr-only">Tipo de auditoria</span><select v-model="filtros.tipo" aria-label="Tipo de auditoria"><option value="">Todos os tipos</option><option v-for="(label, key) in tipos" :key="key" :value="key">{{ label }}</option></select></label>
        <label v-if="auth.isSuperAdmin"><span class="sr-only">Loja</span><select v-model="filtros.lojaId" aria-label="Loja" :disabled="carregandoLojas"><option value="">Todas as lojas</option><option v-for="loja in lojas" :key="loja._id" :value="loja._id">{{ loja.nome }}</option></select></label>
      </div>
      <p v-if="erroLojas" class="performance-filter-error" role="alert">{{ erroLojas }} <button @click="carregarLojas">Tentar novamente</button></p>
    </section>

    <div v-if="carregando" class="performance-loading" role="status">
      <span class="performance-spinner"></span><strong>Buscando resultados das auditorias</strong><span>Organizando colaboradores e corredores...</span>
    </div>
    <div v-else-if="erro" class="performance-empty" role="alert"><fa icon="triangle-exclamation" /><h2>Os resultados não carregaram</h2><p>{{ erro }}</p><button class="btn" @click="carregar">Tentar novamente</button></div>
    <div v-else-if="perfilId && !selecionado" class="performance-empty"><fa icon="users" /><h2>Sem participações neste período</h2><p>Este colaborador não aparece nos filtros selecionados. Escolha outro período ou volte ao ranking.</p><RouterLink class="btn" :to="linkRanking">Voltar ao ranking</RouterLink></div>
    <template v-else>
      <section v-if="selecionado" class="performance-profile" aria-label="Resumo do colaborador">
        <div class="profile-identity">
          <div class="profile-avatar"><ColaboradorAvatar :nome="selecionado.nome" :avatar-url="selecionado.avatarUrl" :size="80" :font-size="28" /></div>
          <div><span class="profile-position"><fa icon="ranking-star" /> {{ posicaoPerfil }}º no ranking · {{ ordemAtiva.label }}</span><h2>{{ selecionado.nome }}</h2><p>{{ selecionado.lojaNome }} <span>·</span> Matrícula {{ selecionado.codigoExterno || 'não informada' }}</p><p v-if="selecionado.cargo || selecionado.setor">{{ [selecionado.cargo, selecionado.setor].filter(Boolean).join(' · ') }}</p></div>
        </div>
        <div class="profile-metrics">
          <div class="profile-primary-metric"><strong>{{ pct(selecionado.percentualMeta) }}</strong><span>dos resultados na meta</span></div>
          <div><strong>{{ numero(selecionado.totalCorredores) }}</strong><span>corredores</span></div>
          <div><strong>{{ numero(selecionado.totalAuditorias) }}</strong><span>auditorias</span></div>
          <div><strong>{{ numero(selecionado.totalLidos) }}</strong><span>itens lidos</span></div>
        </div>
      </section>

      <section class="performance-overview" aria-labelledby="overview-title">
        <div class="overview-intro"><span class="overview-symbol"><fa icon="chart-bar" /></span><div><h2 id="overview-title">{{ selecionado ? 'Resultados nos corredores' : 'Panorama dos corredores' }}</h2><p>{{ numero(resultados.length) }} resultados {{ selecionado ? 'com participação do colaborador' : 'nas auditorias do período' }}</p></div><span class="performance-target"><fa icon="check" /> Meta {{ pct(dados.meta) }}</span></div>
        <div class="overview-distribution" role="img" :aria-label="cores.map(c => `${contagens[c.id]} ${c.label}`).join(', ') + `, ${contagens['sem-base']} sem referência`">
          <span v-for="cor in [...cores, { id: 'sem-base' }]" :key="cor.id" :class="cor.id" :style="{ width: largura(contagens[cor.id], resultados.length) }"></span>
        </div>
        <div class="overview-legend">
          <button v-for="cor in cores" :key="cor.id" :class="['overview-color', cor.id, { active: faixa === cor.id }]" :aria-pressed="faixa === cor.id" @click="alternarFaixa(cor.id)"><span class="status-dot"></span><span>{{ cor.label }}</span><strong>{{ numero(contagens[cor.id]) }}</strong><small>{{ pct(resultados.length ? contagens[cor.id] / resultados.length * 100 : 0) }}</small></button>
          <button v-if="contagens['sem-base']" :class="['overview-color', 'sem-base', { active: faixa === 'sem-base' }]" :aria-pressed="faixa === 'sem-base'" @click="alternarFaixa('sem-base')"><span class="status-dot"></span><span>Sem referência</span><strong>{{ contagens['sem-base'] }}</strong></button>
          <span class="overview-context">{{ escopoLabel }}<template v-if="dados.periodo"> · {{ data(dados.periodo.inicio) }} a {{ data(dados.periodo.fim) }}</template></span>
        </div>
      </section>

      <div :class="['performance-workspace', { 'profile-workspace': selecionado }]">
        <section class="performance-results" :aria-labelledby="selecionado ? 'history-title' : 'ranking-title'">
          <header class="results-heading"><div><h2 :id="selecionado ? 'history-title' : 'ranking-title'">{{ selecionado ? 'Histórico por corredor' : 'Ranking de colaboradores' }}</h2><p>{{ selecionado ? 'O resultado do corredor, com a participação individual em cada auditoria.' : 'Quem mais entrega corredores dentro da meta no período.' }}</p></div><span class="results-count">{{ numero(selecionado ? historico.length : lista.length) }} {{ selecionado ? 'resultados' : 'colaboradores' }}</span></header>
          <div v-if="!selecionado" class="ranking-sort" role="group" aria-label="Ordenar ranking">
            <span class="ranking-sort-label">Ordenar por</span>
            <button v-for="opcao in opcoesOrdenacao" :key="opcao.id" type="button" :aria-pressed="ordenacao === opcao.id" :class="{ active: ordenacao === opcao.id }" @click="ordenacao = opcao.id">{{ opcao.label }}</button>
          </div>
          <div class="results-controls">
            <label class="performance-search"><fa icon="magnifying-glass" /><span class="sr-only">{{ selecionado ? 'Buscar corredor ou tipo' : 'Buscar colaborador, matrícula ou loja' }}</span><input v-model="busca" type="search" :placeholder="selecionado ? 'Buscar corredor ou tipo de auditoria' : 'Buscar nome, matrícula ou loja'" /></label>
            <label class="performance-color-filter"><span class="sr-only">Filtrar resultados por cor</span><select v-model="faixa"><option value="">Todas as cores</option><option v-for="cor in cores" :key="cor.id" :value="cor.id">{{ cor.label }}</option><option value="sem-base">Sem referência</option></select></label>
          </div>

          <template v-if="!selecionado">
            <div v-if="!lista.length" class="performance-empty"><fa icon="users" /><h3>{{ dados.items.length ? 'Nenhum colaborador encontrado' : 'Sem participações para exibir' }}</h3><p>{{ dados.items.length ? 'Tente outro nome ou escolha uma cor diferente.' : 'Escolha outro período, loja ou tipo de auditoria para consultar os resultados.' }}</p><button v-if="busca || faixa" class="btn ghost" @click="limparBusca">Limpar busca e cor</button></div>
            <div v-else class="ranking-list">
              <div class="ranking-columns" aria-hidden="true"><span>Colaborador</span><span>Resultados por cor</span><span>{{ ordemAtiva.coluna }}</span><span></span></div>
              <RouterLink v-for="p in lista" :key="p.id" :to="linkPerfil(p)" class="ranking-row" :aria-label="`Ver perfil de ${p.nome}`">
                <div class="ranking-person"><span :class="['ranking-position', { first: p.posicao === 1 && premiarPrimeiro }]"><fa v-if="p.posicao === 1 && premiarPrimeiro" icon="trophy" /><template v-else>{{ p.posicao }}º</template></span><ColaboradorAvatar :nome="p.nome" :avatar-url="p.avatarUrl" :size="42" :font-size="14" /><div class="ranking-name"><strong>{{ p.nome }}</strong><span>{{ p.lojaNome }} · {{ p.codigoExterno || 'Sem matrícula' }}</span><small>{{ p.totalCorredores }} corredores <span>·</span> {{ p.totalAuditorias }} auditorias</small></div></div>
                <div class="ranking-distribution"><div class="ranking-bar"><span v-for="cor in [...cores, { id: 'sem-base' }]" :key="cor.id" :class="cor.id" :style="{ width: largura(p[cor.id], p.totalParticipacoes) }"></span></div><div class="ranking-color-counts"><span v-for="cor in cores" :key="cor.id" :class="cor.id" :title="`${p[cor.id]} ${cor.label.toLowerCase()}`"><i class="status-dot"></i>{{ p[cor.id] }}<span class="sr-only"> {{ cor.label }}</span></span><small v-if="p['sem-base']">{{ p['sem-base'] }} sem ref.</small></div></div>
                <div class="ranking-score"><strong>{{ pontuacaoExibida(p) }}</strong><span>{{ ordenacao === 'meta' ? `${p.verde}/${p.avaliados} na meta` : `${pct(p.percentualMeta)} na meta` }}</span></div><span class="ranking-open" aria-hidden="true"><fa icon="chevron-right" /></span>
              </RouterLink>
              <footer class="ranking-footnote"><fa icon="circle-info" /><span>{{ ordemAtiva.descricao }} Desempate pelo percentual na meta, média ponderada e volume lido.</span></footer>
            </div>
          </template>
          <template v-else>
            <div v-if="!historico.length" class="performance-empty"><fa icon="magnifying-glass" /><h3>Nenhum corredor encontrado</h3><p>Tente outro corredor ou remova o filtro de cor.</p><button class="btn ghost" @click="limparBusca">Limpar busca e cor</button></div>
            <div v-else class="corridor-grid">
              <article v-for="h in historico" :key="h.id" :class="['corridor-result', h.faixa]">
                <div class="corridor-topline"><span class="corridor-type">{{ tipos[h.tipo] }}</span><time :datetime="h.data">{{ data(h.data) }}</time></div>
                <div class="corridor-identity"><div><span>Corredor</span><h3>{{ h.local }}</h3></div><span class="corridor-rate">{{ pct(h.taxa) }}</span></div>
                <div class="corridor-track"><span :style="{ width: `${Math.min(100, Math.max(0, h.taxa || 0))}%` }"></span><i :style="{ left: `${dados.meta}%` }" :title="`Meta ${pct(dados.meta)}`"></i></div>
                <p class="corridor-status"><span class="status-dot"></span>{{ labels[h.faixa] }}<span v-if="h.faixa === 'verde'" class="corridor-check"><fa icon="check" /></span></p>
                <div class="corridor-contribution"><span>Participação de {{ selecionado.nome.split(' ')[0] }}</span><strong>{{ numero(h.minhaLeitura) }} <small>itens lidos</small></strong><p>{{ pct(h.participacao) }} da leitura do corredor <span>·</span> {{ h.participantes }} participante(s)</p></div>
                <details class="corridor-calculation"><summary>Como esse resultado foi calculado</summary><p>{{ h.criterio }}: {{ numero(h.realizados) }} de {{ numero(h.base) }}. {{ h.taxa === null ? 'Sem presença anterior para comparação.' : `Meta de ${pct(dados.meta)}.` }}</p></details>
                <RouterLink class="corridor-audit-link" :to="{ name: 'auditoria-detalhe', params: { id: h.auditoriaId } }">Ver auditoria <fa icon="chevron-right" /></RouterLink>
              </article>
            </div>
          </template>
        </section>

        <aside class="performance-aside" aria-label="Contexto dos resultados">
          <section v-if="!selecionado && atencao.length" class="attention-panel"><div class="aside-title"><fa icon="triangle-exclamation" /><h2>Corredores para acompanhar</h2></div><p>Resultados mais distantes da meta neste período.</p><RouterLink v-for="h in atencao" :key="h.id" :to="{ name: 'auditoria-detalhe', params: { id: h.auditoriaId } }" :class="['attention-row', h.faixa]"><div><strong>{{ h.local }}</strong><span>{{ tipos[h.tipo] }} · {{ data(h.data) }}</span></div><strong>{{ pct(h.taxa) }}</strong></RouterLink></section>
          <section class="reading-guide"><div class="aside-title"><fa icon="circle-info" /><h2>Entenda os resultados</h2></div><div v-for="cor in cores" :key="cor.id" :class="['guide-color', cor.id]"><span class="status-dot"></span><div><strong>{{ cor.descricao }}</strong><span>{{ cor.id === 'verde' ? `A partir de ${pct(dados.meta)}` : cor.id === 'amarelo' ? `${pct(dados.limiteAmarelo)} até abaixo da meta` : `Abaixo de ${pct(dados.limiteAmarelo)}` }}</span></div></div><p class="guide-note"><fa icon="users" /> Em um corredor compartilhado, o resultado é coletivo. A leitura de cada pessoa aparece no perfil.</p><details class="guide-method"><summary>Critérios de avaliação</summary><p><strong>Etiqueta:</strong> leitura sobre os itens auditáveis.</p><p><strong>Presença:</strong> itens conformes sobre os itens lidos.</p><p><strong>Ruptura:</strong> conclusão sobre a presença do dia anterior, na mesma semana. Sem referência, não entra na avaliação.</p><p>O panorama conta cada corredor uma vez por auditoria. No ranking, cada pessoa recebe o resultado dos corredores em que participou.</p></details><p v-if="selecionado" class="guide-average">Média ponderada dos corredores<strong>{{ pct(selecionado.taxa) }}</strong></p><p v-else class="guide-total">{{ numero(avaliados) }} resultados avaliados <span>·</span> {{ numero(dados.items.length) }} colaboradores</p></section>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.performance-page {
  --p-green: #2bc48a;
  --p-yellow: #e7b34c;
  --p-red: #ee7180;
  --p-muted: #8491af;
  --p-panel: var(--bg-2);
  --p-line: var(--border);
  display: grid;
  gap: 24px;
  max-width: 1680px;
  margin: 0 auto;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.performance-page h1, .performance-page h2, .performance-page h3, .performance-page p { margin: 0; }
.performance-page a { color: inherit; text-decoration: none; }
.performance-page button, .performance-page input, .performance-page select { font: inherit; }
.performance-page button { cursor: pointer; }
.performance-page a:focus-visible, .performance-page button:focus-visible, .performance-page input:focus-visible, .performance-page select:focus-visible, .performance-page summary:focus-visible { outline: 3px solid var(--primary); outline-offset: 4px; }
.performance-page h1:focus { outline: none; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.verde { --status: var(--p-green); }
.amarelo { --status: var(--p-yellow); }
.vermelho { --status: var(--p-red); }
.sem-base { --status: var(--p-muted); }
.status-dot { flex-shrink: 0; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--status); }
.performance-breadcrumb { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; color: var(--text-dim); font-size: 12px; }
.performance-breadcrumb a:hover { color: var(--primary); }
.performance-breadcrumb [aria-current] { color: var(--text); }
.performance-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.performance-heading h1 { font-size: clamp(26px, 2.5vw, 36px); letter-spacing: -.045em; line-height: 1.2; font-weight: 750; }
.performance-heading p { margin-top: 10px; font-size: 14px; color: var(--text-dim); line-height: 1.6; max-width: 70ch; }
.performance-back { display: inline-flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; white-space: nowrap; padding: 10px 0 10px 12px; }
.performance-back:hover { color: var(--primary); }
.performance-back > span { font-size: 20px; }
.performance-filters { display: flex; align-items: center; flex-wrap: wrap; gap: 14px; padding-bottom: 22px; border-bottom: 1px solid var(--p-line); }
.performance-filter-selects { display: flex; flex-wrap: wrap; gap: 10px; margin-left: auto; }
.performance-page select { border: 1px solid var(--border-strong); background: var(--p-panel); border-radius: 8px; padding: 9px 32px 9px 12px; color: var(--text); max-width: 250px; font-size: 13px; min-height: 38px; }
.performance-filter-error { flex-basis: 100%; font-size: 12px; color: var(--danger); }
.performance-filter-error button { border: none; background: none; color: inherit; text-decoration: underline; }
.performance-overview { border: 1px solid var(--p-line); border-radius: 14px; background: var(--p-panel); padding: 22px 24px; }
.overview-intro { display: flex; align-items: center; gap: 12px; }
.overview-symbol { color: var(--primary); background: var(--surface-strong); display: grid; place-items: center; width: 40px; height: 40px; border-radius: 10px; }
.overview-intro h2 { font-size: 16px; letter-spacing: -.025em; }
.overview-intro p { color: var(--text-dim); font-size: 12px; margin-top: 5px; }
.performance-target { display: inline-flex; align-items: center; gap: 7px; margin-left: auto; border: 1px solid var(--border-strong); border-radius: 6px; padding: 7px 10px; color: var(--text-dim); font-size: 12px; font-weight: 600; white-space: nowrap; }
.performance-target svg { color: var(--p-green); }
.overview-distribution { display: flex; height: 12px; overflow: hidden; border-radius: 4px; background: var(--surface-strong); margin: 24px 0 18px; gap: 3px; }
.overview-distribution > span, .ranking-bar > span { background: var(--status); }
.overview-distribution > span[style="width: 0%;"], .ranking-bar > span[style="width: 0%;"] { display: none; }
.overview-legend { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 22px; }
.overview-color { display: inline-flex; gap: 8px; align-items: center; color: var(--text-dim); font-size: 12px; border: 1px solid transparent; border-radius: 5px; padding: 5px 3px; background: transparent; }
.overview-color strong { font-size: 15px; color: var(--text); }
.overview-color small { font-size: 11px; color: var(--text-dim); }
.overview-color.active { border-color: var(--status); padding: 5px 8px; }
.overview-color:hover { background: var(--surface-strong); }
.overview-context { margin-left: auto; color: var(--text-dim); font-size: 11px; }
.performance-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 285px; gap: 24px; align-items: start; }
.performance-results { min-width: 0; background: var(--p-panel); border: 1px solid var(--p-line); border-radius: 14px; overflow: hidden; }
.results-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 24px 24px 0; }
.results-heading h2 { font-size: 19px; letter-spacing: -.03em; }
.results-heading p { margin-top: 7px; color: var(--text-dim); font-size: 12px; line-height: 1.6; }
.results-count { flex-shrink: 0; border: 1px solid var(--p-line); background: var(--surface); padding: 5px 9px; border-radius: 5px; color: var(--text-dim); font-size: 11px; }
.ranking-sort { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; padding: 18px 24px 0; }
.ranking-sort-label { color: var(--text-dim); font-size: 11px; margin-right: 5px; }
.ranking-sort button { border: 1px solid var(--border-strong); border-radius: 6px; padding: 7px 10px; background: transparent; color: var(--text-dim); font-size: 11px; }
.ranking-sort button:hover { color: var(--text); background: var(--surface-strong); }
.ranking-sort button.active { color: var(--primary); border-color: var(--primary); background: var(--surface-strong); font-weight: 600; }
.results-controls { display: flex; gap: 12px; padding: 20px 24px; }
.performance-search { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); padding: 0 12px; }
.performance-search > svg { font-size: 13px; color: var(--text-dim); }
.performance-search input { border: none; background: transparent; color: var(--text); padding: 11px 0; width: 100%; min-width: 0; font-size: 12px; }
.performance-search input::placeholder { color: var(--text-dim); opacity: .85; }
.performance-search:focus-within { border-color: var(--primary); }
.ranking-columns, .ranking-row { display: grid; grid-template-columns: minmax(210px, 1.7fr) minmax(95px, 1fr) 90px 14px; gap: 20px; align-items: center; padding: 17px 24px; }
.ranking-columns { background: var(--surface); color: var(--text-dim); font-size: 11px; border-top: 1px solid var(--p-line); border-bottom: 1px solid var(--p-line); padding-top: 12px; padding-bottom: 12px; }
.ranking-columns > :nth-child(3) { text-align: right; }
.ranking-row { border-bottom: 1px solid var(--p-line); min-height: 102px; transition: background .15s; }
.ranking-row:hover { background: var(--surface-strong); }
.ranking-person { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ranking-person > .colaborador-avatar { flex-shrink: 0; }
.ranking-position { width: 23px; flex-shrink: 0; text-align: center; font-size: 12px; color: var(--text-dim); font-weight: 600; }
.ranking-position.first { color: #d2a23e; font-size: 18px; }
.ranking-name { display: grid; gap: 5px; min-width: 0; }
.ranking-name strong { font-size: 14px; letter-spacing: -.02em; overflow-wrap: anywhere; }
.ranking-name > span { font-size: 11px; color: var(--text-dim); }
.ranking-name small { font-size: 10px; color: var(--text-dim); }
.ranking-name small > span { margin: 0 3px; }
.ranking-bar { display: flex; gap: 2px; height: 7px; border-radius: 3px; overflow: hidden; background: var(--surface-strong); }
.ranking-color-counts { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
.ranking-color-counts > span { display: flex; align-items: center; gap: 4px; color: var(--text-dim); font-size: 10px; }
.ranking-color-counts .status-dot { width: 5px; height: 5px; }
.ranking-color-counts small { color: var(--text-dim); font-size: 9px; }
.ranking-score { text-align: right; display: grid; gap: 6px; }
.ranking-score strong { font-size: 22px; letter-spacing: -.04em; font-weight: 750; }
.ranking-score > span { font-size: 10px; color: var(--text-dim); }
.ranking-open { color: var(--text-dim); font-size: 10px; }
.ranking-row:hover .ranking-open { color: var(--primary); }
.ranking-footnote { display: flex; align-items: flex-start; gap: 9px; padding: 18px 24px; font-size: 11px; color: var(--text-dim); line-height: 1.7; }
.ranking-footnote svg { flex-shrink: 0; margin-top: 3px; }
.performance-aside { display: grid; gap: 20px; }
.attention-panel, .reading-guide { border: 1px solid var(--p-line); border-radius: 12px; background: var(--p-panel); padding: 20px; }
.aside-title { display: flex; align-items: center; gap: 9px; }
.aside-title > svg { color: var(--text-dim); font-size: 13px; }
.aside-title h2 { font-size: 13px; font-weight: 650; letter-spacing: -.02em; line-height: 1.5; }
.attention-panel > p { font-size: 11px; color: var(--text-dim); line-height: 1.7; margin: 8px 0 5px; }
.attention-row { display: flex; gap: 10px; justify-content: space-between; align-items: center; padding: 16px 0; border-bottom: 1px solid var(--p-line); }
.attention-row:last-child { border-bottom: 0; padding-bottom: 0; }
.attention-row > div { display: grid; gap: 5px; }
.attention-row div strong { font-size: 13px; overflow-wrap: anywhere; }
.attention-row div span { font-size: 10px; color: var(--text-dim); }
.attention-row > strong { color: var(--status); font-size: 17px; letter-spacing: -.03em; }
.attention-row:hover div strong { text-decoration: underline; }
.guide-color { display: flex; align-items: flex-start; gap: 9px; padding-top: 19px; }
.guide-color .status-dot { margin-top: 4px; }
.guide-color > div { display: grid; gap: 5px; }
.guide-color strong { font-size: 12px; font-weight: 600; }
.guide-color div span { font-size: 11px; color: var(--text-dim); }
.guide-note { display: flex; align-items: flex-start; gap: 9px; margin-top: 22px !important; padding-top: 18px; border-top: 1px solid var(--p-line); font-size: 11px; color: var(--text-dim); line-height: 1.8; }
.guide-note > svg { flex-shrink: 0; margin-top: 4px; }
.guide-method { margin-top: 16px; font-size: 11px; line-height: 1.8; color: var(--text-dim); }
.guide-method summary { cursor: pointer; color: var(--text); }
.guide-method p { margin-top: 10px; }
.guide-total { font-size: 10px; color: var(--text-dim); padding-top: 18px; margin-top: 18px !important; border-top: 1px solid var(--p-line); line-height: 1.8; }
.guide-total > span { margin: 0 4px; }
.performance-profile { border: 1px solid var(--p-line); background: var(--p-panel); border-radius: 14px; padding: 28px; }
.profile-identity { display: flex; align-items: center; gap: 22px; }
.profile-avatar { flex-shrink: 0; padding: 5px; border: 1px solid var(--border-strong); border-radius: 50%; }
.profile-position { display: inline-flex; gap: 7px; align-items: center; font-size: 11px; color: var(--primary); font-weight: 600; margin-bottom: 9px; }
.profile-identity h2 { font-size: clamp(23px, 2.5vw, 31px); letter-spacing: -.04em; }
.profile-identity p { color: var(--text-dim); font-size: 12px; margin-top: 7px; line-height: 1.6; }
.profile-identity p > span { margin: 0 5px; }
.profile-metrics { display: grid; grid-template-columns: 1.3fr 1fr 1fr 1fr; gap: 24px; border-top: 1px solid var(--p-line); margin-top: 26px; padding-top: 24px; }
.profile-metrics > div { display: grid; gap: 7px; border-right: 1px solid var(--p-line); padding-right: 16px; }
.profile-metrics > div:last-child { border-right: 0; }
.profile-metrics strong { font-size: 27px; letter-spacing: -.04em; }
.profile-metrics span { font-size: 12px; color: var(--text-dim); }
.profile-metrics .profile-primary-metric strong { color: var(--primary); }
.corridor-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; padding: 0 24px 24px; }
.corridor-result { border: 1px solid var(--border-strong); border-radius: 10px; padding: 18px; min-width: 0; position: relative; overflow: hidden; }
.corridor-result::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 3px; background: var(--status); }
.corridor-topline { display: flex; align-items: center; gap: 10px; justify-content: space-between; color: var(--text-dim); font-size: 10px; }
.corridor-type { background: var(--surface-strong); border-radius: 4px; padding: 4px 7px; }
.corridor-identity { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin: 22px 0 16px; }
.corridor-identity > div { min-width: 0; }
.corridor-identity div > span { color: var(--text-dim); font-size: 10px; }
.corridor-identity h3 { margin-top: 4px; font-size: 24px; letter-spacing: -.04em; overflow-wrap: anywhere; }
.corridor-rate { color: var(--status); font-size: 30px; font-weight: 750; letter-spacing: -.055em; flex-shrink: 0; }
.corridor-track { height: 6px; background: var(--surface-strong); border-radius: 2px; position: relative; }
.corridor-track > span { display: block; height: 100%; border-radius: inherit; background: var(--status); }
.corridor-track > i { position: absolute; top: -3px; width: 2px; height: 12px; background: var(--text-dim); transform: translateX(-1px); }
.corridor-status { display: flex; align-items: center; gap: 6px; font-size: 10px; margin-top: 12px !important; color: var(--text-dim); }
.corridor-check { margin-left: auto; color: var(--status); }
.corridor-contribution { border-top: 1px solid var(--p-line); padding-top: 16px; margin-top: 18px; }
.corridor-contribution > span { display: block; color: var(--text-dim); font-size: 10px; }
.corridor-contribution strong { display: block; font-size: 21px; letter-spacing: -.03em; margin-top: 8px; }
.corridor-contribution strong small { font-size: 11px; font-weight: 400; color: var(--text-dim); letter-spacing: 0; }
.corridor-contribution p { color: var(--text-dim); font-size: 10px; line-height: 1.8; margin-top: 5px; }
.corridor-contribution p > span { margin: 0 3px; }
.corridor-calculation { margin-top: 15px; font-size: 10px; color: var(--text-dim); line-height: 1.8; }
.corridor-calculation summary { cursor: pointer; }
.corridor-calculation p { margin-top: 8px; }
.corridor-audit-link { display: flex; justify-content: space-between; align-items: center; color: var(--primary) !important; font-size: 11px; font-weight: 600; border-top: 1px solid var(--p-line); margin-top: 18px; padding-top: 14px; }
.corridor-audit-link > svg { font-size: 9px; }
.guide-average { display: grid; gap: 8px; margin-top: 22px !important; border-top: 1px solid var(--p-line); padding-top: 18px; color: var(--text-dim); font-size: 11px; }
.guide-average strong { color: var(--text); font-size: 26px; letter-spacing: -.04em; }
.performance-empty, .performance-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 24px; gap: 14px; text-align: center; min-height: 260px; }
.performance-empty > svg { font-size: 24px; color: var(--text-dim); margin-bottom: 8px; }
.performance-empty h2, .performance-empty h3 { font-size: 20px; letter-spacing: -.03em; }
.performance-empty p { font-size: 13px; line-height: 1.8; max-width: 55ch; color: var(--text-dim); }
.performance-loading > span:last-child { font-size: 12px; color: var(--text-dim); }
.performance-spinner { width: 26px; height: 26px; border: 2px solid var(--border-strong); border-top-color: var(--primary); border-radius: 50%; animation: performance-spin .8s linear infinite; margin-bottom: 8px; }
@keyframes performance-spin { to { transform: rotate(360deg); } }
[data-theme="light"] .performance-page { --p-green: #149a68; --p-yellow: #c78b15; --p-red: #d64b5f; --p-muted: #8792ac; --p-panel: #fff; }
@media (min-width: 1600px) { .corridor-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 1200px) {
  .performance-workspace { grid-template-columns: minmax(0, 1fr) 250px; gap: 18px; }
  .ranking-columns, .ranking-row { grid-template-columns: minmax(175px, 1.6fr) minmax(70px, .8fr) 78px 10px; padding-left: 18px; padding-right: 18px; gap: 12px; }
  .ranking-person { gap: 8px; }
  .ranking-position { width: 19px; }
  .ranking-score strong { font-size: 20px; }
  .overview-context { flex-basis: 100%; margin-top: 6px; }
  .performance-filter-selects { margin-left: 0; }
  .attention-panel, .reading-guide { padding: 16px; }
}
@media (max-width: 1000px) {
  .performance-workspace { grid-template-columns: minmax(0, 1fr); }
  .performance-aside { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .profile-workspace .performance-aside { grid-template-columns: 1fr; }
  .performance-heading { align-items: flex-start; }
}
@media (max-width: 600px) {
  .performance-page { gap: 20px; }
  .performance-heading { flex-direction: column; gap: 10px; }
  .performance-heading h1 { font-size: 28px; }
  .performance-heading p { font-size: 13px; }
  .performance-back { padding: 0; font-size: 12px; }
  .performance-filters { gap: 12px; }
  .performance-filters :deep(.periodo-wrap) { max-width: 100%; }
  .performance-filters :deep(.tabs) { flex-wrap: wrap; }
  .performance-filter-selects { width: 100%; }
  .performance-filter-selects > label { flex: 1; min-width: 0; }
  .performance-filter-selects select { width: 100%; max-width: none; }
  .performance-overview { padding: 18px 16px; }
  .overview-intro { flex-wrap: wrap; gap: 10px; }
  .overview-intro h2 { font-size: 14px; }
  .overview-symbol { width: 34px; height: 34px; }
  .overview-intro p { font-size: 10px; }
  .performance-target { margin-left: 44px; padding: 5px 8px; font-size: 10px; }
  .overview-distribution { margin: 18px 0 12px; height: 10px; }
  .overview-legend { gap: 6px 12px; }
  .overview-color { font-size: 10px; gap: 5px; }
  .overview-color strong { font-size: 13px; }
  .overview-color small { display: none; }
  .overview-context { font-size: 10px; line-height: 1.7; }
  .results-heading { padding: 20px 16px 0; align-items: flex-start; }
  .results-heading h2 { font-size: 18px; }
  .results-heading p { font-size: 11px; }
  .results-count { font-size: 9px; padding: 4px 6px; }
  .results-controls { flex-wrap: wrap; padding: 16px; gap: 9px; }
  .ranking-sort { padding: 16px 16px 0; gap: 6px; }
  .ranking-sort-label { flex-basis: 100%; margin-bottom: 2px; }
  .performance-search { flex-basis: 100%; }
  .performance-color-filter { width: 100%; }
  .performance-color-filter select { width: 100%; max-width: none; font-size: 12px; }
  .ranking-columns { display: none; }
  .ranking-row { grid-template-columns: minmax(0, 1fr) 72px; gap: 14px; padding: 20px 16px; }
  .ranking-person { grid-column: 1; grid-row: 1; gap: 9px; }
  .ranking-name strong { font-size: 13px; }
  .ranking-name > span { font-size: 10px; }
  .ranking-position { width: 18px; }
  .ranking-person > .colaborador-avatar { width: 34px !important; height: 34px !important; font-size: 12px !important; }
  .ranking-score { grid-column: 2; grid-row: 1; }
  .ranking-score strong { font-size: 21px; }
  .ranking-score > span { font-size: 9px; }
  .ranking-distribution { grid-column: 1 / -1; padding-left: 27px; }
  .ranking-color-counts { margin-top: 8px; }
  .ranking-open { display: none; }
  .ranking-footnote { padding: 16px; font-size: 10px; }
  .performance-aside { grid-template-columns: 1fr; }
  .performance-profile { padding: 20px 16px; }
  .profile-identity { gap: 14px; align-items: flex-start; }
  .profile-avatar { padding: 3px; }
  .profile-avatar :deep(.colaborador-avatar) { width: 52px !important; height: 52px !important; font-size: 20px !important; }
  .profile-identity h2 { font-size: 23px; overflow-wrap: anywhere; }
  .profile-position { font-size: 10px; margin-bottom: 7px; }
  .profile-identity p { font-size: 11px; }
  .profile-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; padding-top: 20px; margin-top: 22px; }
  .profile-metrics > div:nth-child(2) { border-right: 0; }
  .profile-metrics strong { font-size: 25px; }
  .profile-metrics span { font-size: 11px; }
  .corridor-grid { grid-template-columns: 1fr; padding: 0 16px 16px; }
  .corridor-identity h3 { font-size: 27px; }
  .corridor-rate { font-size: 34px; }
}
@media (prefers-reduced-motion: reduce) { .performance-spinner { animation: none; } .ranking-row { transition: none; } }
</style>
