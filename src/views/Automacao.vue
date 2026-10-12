<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const lojas = ref([]);
const lojaId = ref('');
const estado = ref(null);
const chave = ref('');
const erro = ref('');
const aviso = ref('');
const ocupado = ref(false);
const carregando = ref(false);
const habilitada = ref(false);
const editando = ref(false);
const avancado = ref(false);
const dataAlvo = ref(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
const defaults = () => ({ nome: 'Atualização de auditorias', caminho: '', tipo: 'ETIQUETA', intervaloMinutos: 60,
  usuarioSeletor: 'input[placeholder="Usuário"]', senhaSeletor: 'input[type="password"]',
  entrarSeletor: 'button:has-text("Entrar")', prontoSeletor: '', downloadSeletor: '', passos: [] });
const rotina = ref(defaults());
const selecionada = computed(() => !auth.isSuperAdmin || !!lojaId.value);
const ativa = computed(() => estado.value?.historico?.find(j => j.ativa));
const apiUrl = computed(() => new URL(api.defaults.baseURL, window.location.origin).href.replace(/\/$/, ''));
const params = () => auth.isSuperAdmin ? { lojaId: lojaId.value } : {};
let timer;
let generation = 0;
let destroyed = false;

async function carregar(reset = false) {
  if (!selecionada.value) return;
  const g = generation;
  if (reset) carregando.value = true;
  try {
    const { data } = await api.get('/automacao', { params: params() });
    if (g !== generation || destroyed) return;
    estado.value = data;
    if (reset) {
      rotina.value = data.config?.rotina ? structuredClone(data.config.rotina) : defaults();
      habilitada.value = !!data.config?.habilitada;
      editando.value = false;
    }
  } catch (e) { if (g === generation) erro.value = e.response?.data?.error || 'Não foi possível consultar a automação.'; }
  finally { if (g === generation) carregando.value = false; }
}
async function acao(fn, mensagem = '') {
  ocupado.value = true; erro.value = ''; aviso.value = '';
  try { await fn(); aviso.value = mensagem; await carregar(); }
  catch (e) { erro.value = e.response?.data?.error || e.message || 'Não foi possível concluir.'; }
  finally { ocupado.value = false; }
}
async function gerarChave() {
  if (estado.value?.config?.chaveFinal && !window.confirm('Substituir a chave? O agente atual será desconectado e o agendamento ficará pausado.')) return;
  await acao(async () => {
    const { data } = await api.post('/automacao/chave', {}, { params: params() });
    chave.value = data.chave; habilitada.value = false;
  }, 'Chave gerada. Copie para o agente local; ela aparece somente agora.');
}
async function revogar() {
  if (!window.confirm('Revogar a conexão e pausar os agendamentos? Importações já recebidas continuarão.')) return;
  await acao(async () => { await api.delete('/automacao/chave', { params: params() }); chave.value = ''; habilitada.value = false; }, 'Conexão revogada.');
}
async function salvar() {
  await acao(async () => {
    await api.put('/automacao/rotina', { rotina: rotina.value, habilitada: habilitada.value }, { params: params() });
    editando.value = false;
  }, 'Rotina salva.');
}
async function baixar() {
  await acao(async () => {
    const response = await api.get('/automacao/download', { params: params(), responseType: 'blob', timeout: 300000 });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a'); a.href = url; a.download = 'FlashubAgente-windows-x64.zip'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  });
}
async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); aviso.value = 'Copiado.'; }
  catch { erro.value = 'Selecione o texto e copie manualmente.'; }
}
function formatar(v) { return v ? new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'; }
const nomes = { aguardando: 'Na fila', executando: 'Baixando no RUB', importando: 'Importando', concluida: 'Concluída', erro: 'Falha', cancelada: 'Cancelada' };
watch(lojaId, async () => { generation++; estado.value = null; chave.value = ''; erro.value = ''; aviso.value = ''; await carregar(true); });
onMounted(async () => {
  try {
    if (auth.isSuperAdmin) { const { data } = await api.get('/lojas'); lojas.value = (data.items || []).filter(l => l.ativa !== false); }
    else await carregar(true);
  } catch { erro.value = 'Não foi possível carregar as lojas.'; }
  const poll = async () => { await carregar(); if (!destroyed) timer = setTimeout(poll, 15000); };
  if (!destroyed) timer = setTimeout(poll, 15000);
});
onBeforeUnmount(() => { destroyed = true; generation++; clearTimeout(timer); });
</script>

<template>
  <main class="automacao">
    <header class="intro">
      <div><div class="eyebrow">INTEGRAÇÃO LOCAL</div><h1>Automação</h1><p>As planilhas saem do RUB na rede da loja e chegam ao Flashub automaticamente.</p></div>
      <label v-if="auth.isSuperAdmin" class="loja">Loja<select v-model="lojaId" :disabled="ocupado"><option value="">Selecione uma loja</option><option v-for="l in lojas" :key="l._id" :value="l._id">{{ l.nome }}</option></select></label>
    </header>
    <p v-if="erro" role="alert" class="notice error">{{ erro }}</p>
    <p v-if="aviso" role="status" class="notice success">{{ aviso }}</p>
    <section v-if="!selecionada" class="box empty">Selecione a loja para configurar sua conexão e consultar as execuções.</section>
    <p v-else-if="carregando">Carregando integração…</p>
    <template v-else-if="selecionada">
      <section class="box connection">
        <div class="section-top"><div><h2>Agente da loja</h2><p>O programa permanece em execução na máquina que acessa o RUB.</p></div><span class="status" :class="{ online: estado?.online }"><i></i>{{ estado?.online ? 'Online' : 'Offline' }}</span></div>
        <div class="stats"><div><small>Máquina conectada</small><strong>{{ estado?.config?.nomeMaquina || 'Nenhuma máquina conectada' }}</strong></div><div><small>Último contato</small><strong>{{ formatar(estado?.config?.vistoEm) }}</strong></div><div><small>Agendamento</small><strong>{{ estado?.config?.habilitada ? 'Ativo' : 'Pausado' }}</strong></div></div>
        <div class="actions"><button class="btn primary" :disabled="ocupado" @click="gerarChave">{{ estado?.config?.chaveFinal ? 'Substituir chave' : 'Gerar chave de conexão' }}</button><button v-if="estado?.config?.chaveFinal" class="btn" :disabled="ocupado" @click="revogar">Revogar conexão</button><button class="btn" :disabled="ocupado || !estado?.pacoteDisponivel" @click="baixar">Baixar agente Windows</button></div>
        <p v-if="!estado?.pacoteDisponivel" class="muted">O pacote Windows precisa ser publicado no servidor para liberar o download.</p>
        <div v-if="chave" class="secret"><label>Chave — exibida uma única vez<input readonly :value="chave" @focus="$event.target.select()" /></label><button class="btn" @click="copiar(chave)">Copiar chave</button><button class="btn ghost" @click="chave = ''">Ocultar</button></div>
        <p v-else-if="estado?.config?.chaveFinal" class="muted">Chave cadastrada: ••••••{{ estado.config.chaveFinal }}</p>
      </section>
      <div class="columns">
        <section class="box"><h2>Conectar em 3 passos</h2><ol class="steps"><li><b>Baixe e extraia o pacote</b><p>Na máquina da loja, abra FlashubAgente.exe. Mantenha todos os arquivos na mesma pasta.</p></li><li><b>Configure a conexão</b><p>Cole o endereço da API e a chave. Informe o endereço, usuário e senha do RUB no agente local.</p><label>Endereço da API<input readonly :value="apiUrl" @focus="$event.target.select()" /></label><button class="btn ghost" @click="copiar(apiUrl)">Copiar endereço</button></li><li><b>Inicie o agente</b><p>Clique em Salvar e conectar. Ele fica na bandeja do Windows; você pode habilitar a inicialização ao entrar no Windows.</p></li></ol><p class="muted">A senha do RUB fica protegida na máquina local. A máquina precisa estar ligada, sem suspensão, e conectada à rede da loja.</p></section>
        <section class="box"><div class="section-top"><h2>Atualizar agora</h2><span class="pill">{{ ativa ? nomes[ativa.status] : 'Pronto para solicitar' }}</span></div><p>Usa a última rotina salva. O agente baixa a planilha e a importação atualiza a auditoria da loja, tipo e data.</p><label>Data da auditoria<input type="date" v-model="dataAlvo" /></label><button class="btn primary" :disabled="ocupado || !!ativa || !estado?.config?.rotina || !estado?.config?.chaveFinal || estado?.importacaoBloqueada || editando" @click="acao(() => api.post('/automacao/executar', { dataAlvo }, { params: params() }), 'Solicitação enviada ao agente.')">Atualizar agora</button><button v-if="ativa?.status === 'aguardando'" class="btn" :disabled="ocupado" @click="acao(() => api.post('/automacao/cancelar', {}, { params: params() }), 'Solicitação cancelada.')">Cancelar solicitação</button><p v-if="!estado?.config?.rotina" class="muted">Configure a página e os filtros abaixo quando estiverem definidos.</p><p v-else-if="!estado?.online" class="muted">O agente está offline. A solicitação aguardará conexão por até 30 minutos.</p><p v-if="estado?.importacaoBloqueada" class="notice">Há uma importação em andamento ou interrompida. Se persistir, peça a revisão do servidor.</p><p v-if="editando" class="muted">Salve as alterações da rotina antes de executar.</p></section>
      </div>
      <section class="box"><div class="section-top"><div><h2>Página, filtros e frequência</h2><p>{{ estado?.config?.rotina ? 'A rotina será executada na máquina da loja.' : 'Configuração pendente. Você pode conectar o agente agora e definir a rotina depois.' }}</p></div><button class="btn" @click="avancado = !avancado">{{ avancado ? 'Recolher' : 'Configurar rotina' }}</button></div>
        <form v-if="avancado" @submit.prevent="salvar" @input="editando = true" @change="editando = true">
          <fieldset :disabled="ocupado || !!ativa"><div class="form-grid"><label>Nome da rotina<input v-model="rotina.nome" required maxlength="80" /></label><label>Tipo de auditoria<select v-model="rotina.tipo"><option value="ETIQUETA">Etiqueta</option><option value="PRESENCA">Presença</option><option value="RUPTURA">Ruptura</option></select></label><label class="full">Caminho da página no RUB<input v-model="rotina.caminho" placeholder="/vue/#/caminho/da/auditoria" required /></label><label>Intervalo em minutos<input type="number" min="5" max="10080" v-model.number="rotina.intervaloMinutos" required /></label><label class="check"><input type="checkbox" v-model="habilitada" /> Executar automaticamente</label></div>
          <p class="muted">Os agendamentos usam o dia atual de São Paulo. A primeira execução ocorre após o intervalo; se o agente estiver offline, retoma sem acumular tarefas antigas.</p>
          <details open><summary>Elementos da página (configuração técnica)</summary><p>Informe os seletores dos campos e botões do RUB. Não coloque senhas nestes campos.</p><div class="form-grid"><label>Campo usuário<input v-model="rotina.usuarioSeletor" required /></label><label>Campo senha<input v-model="rotina.senhaSeletor" required /></label><label>Botão entrar<input v-model="rotina.entrarSeletor" required /></label><label>Elemento visível quando a página está pronta<input v-model="rotina.prontoSeletor" required /></label><label class="full">Botão que baixa Excel ou CSV<input v-model="rotina.downloadSeletor" required /></label></div></details>
          <h3>Etapas dos filtros</h3><p class="muted">Execute as etapas na ordem da página. Nos valores, use <code v-pre>{{data}}</code> para AAAA-MM-DD ou <code v-pre>{{dataBR}}</code> para DD/MM/AAAA.</p>
          <div v-for="(passo, i) in rotina.passos" :key="i" class="step-row"><span>{{ i + 1 }}</span><label>Ação<select v-model="passo.acao"><option value="clicar">Clicar</option><option value="preencher">Preencher</option><option value="selecionar">Selecionar valor</option><option value="aguardar">Aguardar elemento</option><option value="marcar">Marcar</option><option value="desmarcar">Desmarcar</option></select></label><label>Seletor<input v-model="passo.seletor" required placeholder="Elemento do filtro" /></label><label v-if="['preencher','selecionar'].includes(passo.acao)">Valor<input v-model="passo.valor" /></label><button type="button" class="btn" aria-label="Remover etapa" @click="rotina.passos.splice(i, 1); editando = true">Remover</button></div>
          <div class="actions"><button type="button" class="btn" :disabled="rotina.passos.length >= 40" @click="rotina.passos.push({ acao: 'clicar', seletor: '', valor: '' }); editando = true">Adicionar etapa</button><button class="btn primary" type="submit" :disabled="!estado?.config?.chaveFinal">Salvar rotina</button></div>
          </fieldset>
        </form>
      </section>
      <section class="box"><div class="section-top"><div><h2>Histórico de execuções</h2><p>Últimas 30 solicitações · horários de São Paulo</p></div><button class="btn ghost" :disabled="ocupado" @click="carregar()">Atualizar</button></div><p v-if="!estado?.historico?.length" class="empty muted">Nenhuma execução. Conecte o agente e configure sua primeira rotina.</p><div v-else class="table-wrap"><table><thead><tr><th>Solicitação</th><th>Data alvo</th><th>Origem</th><th>Status</th><th>Resultado</th></tr></thead><tbody><tr v-for="job in estado.historico" :key="job._id"><td>{{ formatar(job.createdAt) }}</td><td>{{ job.dataAlvo }}</td><td>{{ job.origem === 'manual' ? 'Manual' : 'Agendamento' }}</td><td><span class="pill" :class="job.status">{{ nomes[job.status] }}</span></td><td>{{ job.mensagem }}</td></tr></tbody></table></div></section>
    </template>
  </main>
</template>

<style scoped>
.automacao{display:grid;gap:22px;max-width:1400px;margin:auto}.intro,.section-top,.actions{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.intro h1{margin:6px 0;font-size:30px}.eyebrow{font-size:11px;font-weight:700;letter-spacing:2px;color:var(--accent)}p{color:var(--text-dim);line-height:1.6;margin:8px 0 16px}h2{font-size:19px;margin:0 0 6px}h3{font-size:16px;margin:24px 0 6px}.box{background:var(--bg-1);border:1px solid var(--border);border-radius:18px;padding:24px;min-width:0}.connection{background:var(--grad-card)}.status,.pill{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--border);padding:6px 12px;border-radius:24px;font-size:12px;white-space:nowrap}.status i{width:8px;height:8px;border-radius:50%;background:var(--text-mute)}.status.online,.pill.concluida{color:var(--success)}.status.online i{background:var(--success)}.pill.erro{color:var(--danger)}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin:22px 0}.stats small{display:block;color:var(--text-dim);margin-bottom:8px}.stats strong{font-size:14px;overflow-wrap:anywhere}.actions{justify-content:flex-start}.columns{display:grid;grid-template-columns:1fr 1fr;gap:22px}label{display:grid;gap:7px;font-size:13px;color:var(--text-dim);margin-bottom:14px}input,select{width:100%;min-width:0;padding:11px 12px;border:1px solid var(--border-strong);border-radius:9px;background:var(--bg-0);color:var(--text);font:inherit}input[type=checkbox]{width:auto}.loja{min-width:220px}.steps{padding-left:22px;display:grid;gap:14px;margin-top:20px}.steps li{padding-left:8px}.secret{margin-top:20px;padding:16px;border:1px solid var(--primary);border-radius:12px}.secret input{font-family:monospace}.notice{padding:14px 18px;border-radius:12px;background:var(--surface-strong);margin:0}.notice.error{color:var(--danger)}.notice.success{color:var(--success)}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px}.full{grid-column:1/-1}.check{display:flex;align-items:center;gap:10px}.step-row{display:flex;gap:12px;align-items:center;margin:14px 0}.step-row label{flex:1;margin:0}.step-row>span{color:var(--text-mute)}fieldset{border:0;padding:0;margin:0;min-width:0}details{border:1px solid var(--border);border-radius:12px;padding:16px;margin:20px 0}summary{cursor:pointer;font-size:14px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:14px 10px;border-bottom:1px solid var(--border)}th{color:var(--text-dim);font-weight:500}td:last-child{min-width:220px}.empty{padding:30px;text-align:center}.muted{font-size:13px}button:disabled{opacity:.5;cursor:not-allowed}@media(max-width:850px){.columns,.stats,.form-grid{grid-template-columns:1fr}.step-row{flex-wrap:wrap}.step-row label{flex-basis:40%}.box{padding:18px}.intro{align-items:stretch}.loja{width:100%}}
</style>
