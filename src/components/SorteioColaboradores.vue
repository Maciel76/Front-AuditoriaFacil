<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import api from '@/services/api';
import ColaboradorAvatar from '@/components/ColaboradorAvatar.vue';
import SorteioParticulas from '@/components/SorteioParticulas.vue';
import { precarregarImagem } from '@/utils/media';

const props = defineProps({ lojaId: { type: String, default: '' }, lojaNome: { type: String, default: '' } });
const emit = defineEmits(['close']);
const dialog = ref(null);
const colaboradores = ref([]);
const selecionados = ref(new Set());
const busca = ref('');
const carregando = ref(true);
const erro = ref('');
const fase = ref('selecao');
const participantes = ref([]);
const vencedor = ref(null);
const rotacao = ref(0);
const indiceAtual = ref(0);
const suspense = ref(false);
const movimentoReduzido = ref(false);
const controller = new AbortController();
let frame = 0;
let revelacaoTimer;
let focoAnterior;
let overflowAnterior;
let media;
const cores = ['#6e45b8', '#a56e25', '#3e3274', '#936037', '#56429a', '#8b702e'];
const visiveis = computed(() => {
  const termo = busca.value.trim().toLocaleLowerCase('pt-BR');
  return colaboradores.value.filter(c => `${c.nome} ${c.codigoExterno} ${c.setor || ''} ${c.loja?.nome || ''}`.toLocaleLowerCase('pt-BR').includes(termo));
});
const todosVisiveis = computed(() => visiveis.value.length > 0 && visiveis.value.every(c => selecionados.value.has(c._id)));
const nomeAtual = computed(() => participantes.value[indiceAtual.value]?.nome || '');
const participanteAtual = computed(() => participantes.value[indiceAtual.value]);
const fatias = computed(() => participantes.value.map((c, i, lista) => {
  const passo = 360 / lista.length;
  const centro = (i + .5) * passo * Math.PI / 180;
  const tamanhoFoto = Math.max(6, Math.min(92, 2 * 164 * Math.sin(Math.PI / lista.length) * .82));
  const ponto = angulo => {
    const rad = (angulo - 90) * Math.PI / 180;
    return `${250 + 230 * Math.cos(rad)} ${250 + 230 * Math.sin(rad)}`;
  };
  return {
    id: c._id, nome: c.nome, avatarUrl: c.avatarUrl, cor: cores[i % cores.length],
    x: 250 + 164 * Math.sin(centro), y: 250 - 164 * Math.cos(centro), tamanhoFoto,
    path: `M 250 250 L ${ponto(i * passo)} A 230 230 0 ${passo > 180 ? 1 : 0} 1 ${ponto((i + 1) * passo)} Z`,
  };
}));
const particulas = Array.from({ length: 84 }, (_, i) => ({
  left: `${(i * 37.13) % 100}%`,
  '--delay': `${(i % 17) * .065}s`, '--duration': `${3 + (i % 7) * .3}s`,
  '--drift': `${((i * 31) % 240) - 120}px`,
  '--turn': `${180 + (i % 6) * 120}deg`,
  background: ['#ffd56a', '#fff1bd', '#b78aff', '#d59a34', '#ffffff'][i % 5],
}));

async function carregar() {
  carregando.value = true;
  erro.value = '';
  try {
    const lista = [];
    let page = 1;
    let total = Infinity;
    while (lista.length < total) {
      const { data } = await api.get('/colaboradores', {
        params: { status: 'active', limit: 200, page, ...(props.lojaId ? { lojaId: props.lojaId } : {}) },
        signal: controller.signal,
      });
      lista.push(...(data.items || []));
      total = data.total ?? lista.length;
      if (!data.items?.length) break;
      page++;
    }
    colaboradores.value = [...new Map(lista.filter(c => c.ativo !== false).map(c => [c._id, c])).values()]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  } catch {
    if (!controller.signal.aborted) erro.value = 'Não foi possível carregar os participantes. Tente novamente.';
  } finally {
    carregando.value = false;
  }
}
function marcar(id) {
  const proxima = new Set(selecionados.value);
  proxima.has(id) ? proxima.delete(id) : proxima.add(id);
  selecionados.value = proxima;
}
function marcarVisiveis() {
  const proxima = new Set(selecionados.value);
  const remover = todosVisiveis.value;
  visiveis.value.forEach(c => remover ? proxima.delete(c._id) : proxima.add(c._id));
  selecionados.value = proxima;
}
// Rejeita o excedente para que todos tenham a mesma probabilidade.
function indiceAleatorio(total) {
  const limite = 2 ** 32 - (2 ** 32 % total);
  const valor = new Uint32Array(1);
  do { crypto.getRandomValues(valor); } while (valor[0] >= limite);
  return valor[0] % total;
}
async function focarAcao() {
  await nextTick();
  dialog.value?.querySelector('[data-focus]')?.focus();
}
function sortear() {
  if (selecionados.value.size < 2 || fase.value !== 'selecao') return;
  participantes.value = colaboradores.value.filter(c => selecionados.value.has(c._id)).map(c => ({ ...c }));
  participantes.value.forEach(c => { if (c.avatarUrl) void precarregarImagem(c.avatarUrl); });
  const indice = indiceAleatorio(participantes.value.length);
  vencedor.value = participantes.value[indice];
  // Carrega a foto durante o giro para ela já estar pronta na revelação.
  if (vencedor.value.avatarUrl) void precarregarImagem(vencedor.value.avatarUrl, { prioridade: 'high' });
  const passo = 360 / participantes.value.length;
  const destino = 360 * 10 + 360 - (indice + .5) * passo;
  rotacao.value = 0;
  suspense.value = false;
  fase.value = 'roleta';
  focarAcao();
  const duracao = movimentoReduzido.value ? 400 : 12000;
  const inicio = performance.now();
  function animar(agora) {
    const progresso = Math.min((agora - inicio) / duracao, 1);
    rotacao.value = destino * (1 - (1 - progresso) ** 4);
    const angulo = ((360 - rotacao.value % 360) % 360);
    indiceAtual.value = Math.min(Math.floor(angulo / passo), participantes.value.length - 1);
    suspense.value = progresso > .78;
    if (progresso < 1) frame = requestAnimationFrame(animar);
    else revelacaoTimer = window.setTimeout(() => {
      fase.value = 'resultado';
      focarAcao();
    }, movimentoReduzido.value ? 100 : 1000);
  }
  frame = requestAnimationFrame(animar);
}
function voltar(remover = false) {
  if (remover && vencedor.value) {
    const proxima = new Set(selecionados.value);
    proxima.delete(vencedor.value._id);
    selecionados.value = proxima;
  }
  fase.value = 'selecao';
  vencedor.value = null;
  focarAcao();
}
function fechar() { emit('close'); }
function teclado(event) {
  if (event.key === 'Escape') { event.preventDefault(); fechar(); }
  if (event.key !== 'Tab') return;
  const alvos = [...dialog.value.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')];
  const primeiro = alvos[0];
  const ultimo = alvos.at(-1);
  if (event.shiftKey && (document.activeElement === primeiro || document.activeElement === dialog.value)) {
    event.preventDefault(); ultimo?.focus();
  } else if (!event.shiftKey && (document.activeElement === ultimo || !dialog.value.contains(document.activeElement))) {
    event.preventDefault(); primeiro?.focus();
  }
}
function atualizarMovimento() { movimentoReduzido.value = media.matches; }
onMounted(() => {
  focoAnterior = document.activeElement;
  overflowAnterior = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  media = window.matchMedia('(prefers-reduced-motion: reduce)');
  atualizarMovimento();
  media.addEventListener('change', atualizarMovimento);
  document.addEventListener('keydown', teclado);
  focarAcao();
  carregar();
});
onBeforeUnmount(() => {
  controller.abort();
  cancelAnimationFrame(frame);
  clearTimeout(revelacaoTimer);
  document.removeEventListener('keydown', teclado);
  media?.removeEventListener('change', atualizarMovimento);
  document.body.style.overflow = overflowAnterior;
  focoAnterior?.focus();
});
</script>

<template>
  <Teleport to="body">
    <div class="sorteio-overlay" @click.self="fase !== 'roleta' && fechar()">
      <section ref="dialog" class="sorteio-dialog" :class="`fase-${fase}`" role="dialog" aria-modal="true" aria-labelledby="sorteio-titulo" tabindex="-1">
        <button class="sorteio-fechar" aria-label="Fechar sorteio" data-focus @click="fechar">×</button>

        <template v-if="fase === 'selecao'">
          <header class="sorteio-header">
            <span class="sorteio-emblema" aria-hidden="true">✦</span>
            <div><h2 id="sorteio-titulo">Uma equipe. Um grande momento.</h2>
              <p>Escolha quem participa e deixe a sorte fazer o espetáculo.</p>
              <span v-if="lojaNome" class="sorteio-escopo">{{ lojaNome }}</span>
            </div>
          </header>
          <div class="sorteio-selecao">
            <div class="sorteio-lista-area">
              <label class="sorteio-busca"><span aria-hidden="true">⌕</span><input v-model="busca" placeholder="Buscar nome, matrícula ou setor" aria-label="Buscar participantes" /></label>
              <div class="sorteio-lista-acoes">
                <label><input type="checkbox" :checked="todosVisiveis" :disabled="!visiveis.length || carregando" @change="marcarVisiveis" /> {{ busca.trim() ? 'Selecionar resultados' : 'Selecionar todos' }}</label>
                <span>{{ visiveis.length }} disponíveis</span>
              </div>
              <div class="sorteio-lista" :aria-busy="carregando">
                <p v-if="carregando" class="sorteio-vazio" role="status">Preparando a lista de colaboradores…</p>
                <div v-else-if="erro" class="sorteio-vazio" role="alert"><p>{{ erro }}</p><button class="sorteio-secundario" @click="carregar">Tentar novamente</button></div>
                <p v-else-if="!visiveis.length" class="sorteio-vazio">{{ busca ? 'Nenhum participante encontrado para essa busca.' : 'Nenhum colaborador ativo disponível nesta loja.' }}</p>
                <label v-for="c in visiveis" v-else :key="c._id" class="sorteio-pessoa" :class="{ marcada: selecionados.has(c._id) }">
                  <input type="checkbox" :checked="selecionados.has(c._id)" @change="marcar(c._id)" />
                  <ColaboradorAvatar class="sorteio-foto-lista" :nome="c.nome" :avatar-url="c.avatarUrl" :size="52" :font-size="17" />
                  <span><strong>{{ c.nome }}</strong><small>#{{ c.codigoExterno }}<template v-if="c.cargo"> · {{ c.cargo }}</template><template v-if="c.loja?.nome"> · {{ c.loja.nome }}</template></small></span>
                </label>
              </div>
            </div>
            <aside class="sorteio-convite">
              <div class="sorteio-mini-roleta" aria-hidden="true"><span>✦</span></div>
              <h3>Quem vai brilhar hoje?</h3>
              <p>O próximo nome pode ser o de qualquer pessoa que você selecionar.</p>
              <div class="sorteio-contagem"><strong>{{ selecionados.size }}</strong><span>participantes selecionados</span></div>
              <p class="sorteio-regra">Chances iguais para todos.<br />Selecione pelo menos 2 colaboradores.</p>
            </aside>
          </div>
          <footer class="sorteio-footer"><button class="sorteio-secundario" :disabled="!selecionados.size" @click="selecionados = new Set()">Limpar seleção</button><button class="sorteio-dourado" :disabled="selecionados.size < 2 || carregando || !!erro" @click="sortear">✦ Iniciar sorteio <span aria-hidden="true">↗</span></button></footer>
        </template>

        <div v-else-if="fase === 'roleta'" class="sorteio-palco">
          <h2 id="sorteio-titulo">{{ suspense ? 'O grande momento está chegando…' : 'A sorte está em movimento.' }}</h2>
          <p>{{ participantes.length }} participantes. Uma chance de brilhar.</p>
          <div class="sorteio-roleta-moldura" :class="{ suspense }">
            <div class="sorteio-luzes" aria-hidden="true"><i v-for="n in 40" :key="n" :style="{ transform: `rotate(${n * 9}deg) translateY(calc(var(--wheel-size) / -2 + 10px))`, animationDelay: `${n % 2 * .35}s` }" /></div>
            <div class="sorteio-ponteiro" aria-hidden="true" />
            <svg class="sorteio-roleta" viewBox="0 0 500 500" :style="{ transform: `rotate(${rotacao}deg)` }" role="img" aria-label="Roleta dos participantes selecionados">
              <g v-for="f in fatias" :key="f.id">
                <title>{{ f.nome }}</title>
                <path :d="f.path" :fill="f.cor" stroke="#edc66a" stroke-width="1" />
                <g :transform="`rotate(${-rotacao} ${f.x} ${f.y})`">
                  <foreignObject :x="f.x - f.tamanhoFoto / 2" :y="f.y - f.tamanhoFoto / 2" :width="f.tamanhoFoto" :height="f.tamanhoFoto">
                    <div xmlns="http://www.w3.org/1999/xhtml" class="sorteio-foto-fatia" :style="{ borderWidth: `${Math.min(3, f.tamanhoFoto * .04)}px` }">
                      <ColaboradorAvatar :nome="f.nome" :avatar-url="f.avatarUrl" :size="f.tamanhoFoto" :font-size="Math.max(4, f.tamanhoFoto * .32)" />
                    </div>
                  </foreignObject>
                </g>
              </g>
            </svg>
            <div class="sorteio-miolo" aria-hidden="true">✦</div>
          </div>
          <div v-if="participanteAtual" class="sorteio-nome-passando" aria-hidden="true">
            <ColaboradorAvatar :nome="participanteAtual.nome" :avatar-url="participanteAtual.avatarUrl" :size="72" :font-size="24" />
            <span>{{ nomeAtual }}</span>
          </div>
          <span class="sorteio-suspense" role="status">{{ suspense ? 'Prenda a respiração. Quase lá!' : 'Torça pelo seu nome…' }}</span>
        </div>

        <div v-else class="sorteio-resultado">
          <div class="sorteio-raios" aria-hidden="true" />
          <SorteioParticulas />
          <div class="sorteio-confetes" aria-hidden="true"><i v-for="(estilo, i) in particulas" :key="i" :style="estilo" :class="{ estrela: i % 4 === 0 }" /></div>
          <span class="sorteio-trofeu" aria-hidden="true">🏆</span>
          <h2 id="sorteio-titulo">Hoje, o brilho é todo seu!</h2>
          <p class="sorteio-parabens" role="status">O sorteio tem um nome. E esse nome merece aplausos.</p>
          <article class="sorteio-vencedor">
            <div class="sorteio-vencedor-brilho" aria-hidden="true" />
            <span class="sorteio-selo">✦ Colaborador sorteado ✦</span>
            <div class="sorteio-avatar-premiado"><ColaboradorAvatar :key="vencedor._id" :nome="vencedor.nome" :avatar-url="vencedor.avatarUrl" :size="148" :font-size="44" /></div>
            <h3>{{ vencedor.nome }}</h3>
            <p>#{{ vencedor.codigoExterno }}<template v-if="vencedor.cargo"> · {{ vencedor.cargo }}</template></p>
            <span v-if="vencedor.setor || vencedor.loja?.nome" class="sorteio-vencedor-setor">{{ [vencedor.setor, vencedor.loja?.nome].filter(Boolean).join(' · ') }}</span>
            <div class="sorteio-vencedor-mensagem">A sorte escolheu você.<br /><strong>A equipe inteira celebra esse momento!</strong></div>
          </article>
          <div class="sorteio-resultado-acoes"><button class="sorteio-dourado" @click="voltar()">Sortear novamente</button><button class="sorteio-secundario" @click="voltar(true)">Próximo sorteio sem {{ vencedor.nome.split(' ')[0] }}</button></div>
          <button class="sorteio-encerrar" @click="fechar">Encerrar sorteio</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.sorteio-overlay { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; padding: 24px; overflow-y: auto; background: #080612e8; backdrop-filter: blur(14px); color: #f6f1ff; }
.sorteio-dialog { --gold: #f2cb72; position: relative; width: min(960px, 100%); max-height: calc(100dvh - 48px); overflow: auto; border: 1px solid #b58a424d; border-radius: 28px; background: radial-gradient(ellipse at 95% 0%, #49306540, transparent 50%), #171222; box-shadow: 0 32px 120px #0009; font-family: inherit; color-scheme: dark; animation: sorteio-entrada .35s ease both; }
.sorteio-dialog * { box-sizing: border-box; }
.sorteio-dialog button, .sorteio-dialog input { font: inherit; }
.sorteio-dialog button { cursor: pointer; }
.sorteio-dialog button:disabled { opacity: .4; cursor: not-allowed; }
.sorteio-dialog :focus-visible { outline: 3px solid #e8c56e; outline-offset: 4px; }
.sorteio-fechar { position: absolute; top: 16px; right: 18px; z-index: 5; width: 36px; height: 36px; border: 1px solid #ffffff26; background: #ffffff0a; border-radius: 50%; color: #e4dbea; font-size: 25px !important; line-height: 1; }
.sorteio-header { display: flex; align-items: center; gap: 18px; padding: 34px 60px 28px 32px; }
.sorteio-header h2 { margin: 0; font-size: clamp(21px, 3vw, 28px); letter-spacing: -.8px; line-height: 1.2; }
.sorteio-header p { color: #bcb2ce; margin: 9px 0 0; font-size: 14px; }
.sorteio-emblema { font-size: 38px; color: var(--gold); }
.sorteio-escopo { display: inline-block; margin-top: 12px; font-size: 12px; color: #e8cc94; border: 1px solid #e8cc9430; border-radius: 30px; padding: 4px 10px; }
.sorteio-selecao { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(230px, 1fr); border-top: 1px solid #ffffff10; border-bottom: 1px solid #ffffff10; }
.sorteio-lista-area { min-width: 0; padding: 24px; }
.sorteio-busca { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid #ffffff26; background: #0c0914; border-radius: 12px; }
.sorteio-busca > span { font-size: 24px; color: #c9b4e5; }
.sorteio-busca input { min-width: 0; width: 100%; background: transparent; border: 0; color: #fff; padding: 2px; font-size: 13px; }
.sorteio-lista-acoes { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin: 18px 0 12px; font-size: 12px; color: #c6bcd5; }
.sorteio-lista-acoes label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.sorteio-dialog input[type=checkbox] { accent-color: #e3b85e; width: 17px; height: 17px; flex-shrink: 0; }
.sorteio-lista { height: min(360px, 42dvh); overflow-y: auto; padding: 4px; scrollbar-color: #685478 transparent; scrollbar-width: thin; }
.sorteio-pessoa { display: flex; align-items: center; gap: 12px; padding: 12px 10px; border: 1px solid transparent; border-bottom-color: #ffffff0a; border-radius: 12px; cursor: pointer; }
.sorteio-pessoa:hover { background: #ffffff05; }
.sorteio-pessoa.marcada { background: #e5bd6510; border-color: #e5bd6538; }
.sorteio-pessoa > span { min-width: 0; display: grid; gap: 5px; }
.sorteio-pessoa strong { font-size: 14px; overflow-wrap: anywhere; }
.sorteio-pessoa small { color: #b6abc8; font-size: 11px; }
.sorteio-pessoa :deep(.avatar), .sorteio-avatar-premiado :deep(.avatar) { display: grid; place-items: center; border-radius: 50%; flex-shrink: 0; background: linear-gradient(135deg, #7650af, #45306b); color: white; }
.sorteio-foto-lista { border: 2px solid #e5bd6540; }
.sorteio-pessoa.marcada .sorteio-foto-lista { border-color: #e5bd65; }
.sorteio-pessoa :deep(.colaborador-avatar-image), .sorteio-avatar-premiado :deep(.colaborador-avatar-image) { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
.sorteio-foto-fatia { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; border: 3px solid #ffe2a0; box-shadow: 0 3px 12px #0005; }
.sorteio-foto-fatia :deep(.avatar) { width: 100% !important; height: 100% !important; border-radius: 50%; display: grid; place-items: center; background: #59417b; color: #fff4dc; }
.sorteio-nome-passando :deep(.avatar) { flex-shrink: 0; border: 3px solid #edc66a; border-radius: 50%; display: grid; place-items: center; background: #59417b; color: #fff4dc; box-shadow: 0 0 22px #e3b96330; }
.sorteio-vazio { text-align: center; padding: 32px 16px; color: #c6bcd5; line-height: 1.7; }
.sorteio-convite { border-left: 1px solid #ffffff10; padding: 32px 24px; text-align: center; background: radial-gradient(ellipse at center 30%, #a884301c, transparent 70%); display: flex; flex-direction: column; align-items: center; justify-content: center; }
.sorteio-mini-roleta { width: 118px; height: 118px; border: 6px double #efc673; border-radius: 50%; background: repeating-conic-gradient(#664591 0deg 45deg, #a17c35 45deg 90deg); display: grid; place-items: center; box-shadow: 0 0 40px #dcb45418; transform: rotate(-12deg); }
.sorteio-mini-roleta span { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: #f2ce7c; color: #422b10; font-size: 24px; }
.sorteio-convite h3 { font-size: 23px; margin: 24px 0 8px; letter-spacing: -.6px; }
.sorteio-convite p { margin: 0; max-width: 27ch; font-size: 13px; color: #bcb2ce; line-height: 1.7; }
.sorteio-contagem { display: grid; gap: 2px; margin: 20px 0 16px; }
.sorteio-contagem strong { font-size: 42px; color: var(--gold); line-height: 1; }
.sorteio-contagem span { font-size: 12px; color: #dfd2ef; }
.sorteio-convite .sorteio-regra { font-size: 11px; color: #9f93b0; }
.sorteio-footer { padding: 20px 28px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.sorteio-dourado, .sorteio-secundario { display: inline-flex; justify-content: center; align-items: center; gap: 12px; border-radius: 12px; padding: 13px 19px; font-weight: 700 !important; font-size: 13px !important; }
.sorteio-dourado { border: 1px solid #ffe4a5; background: linear-gradient(120deg, #ffe4a5, #e9b851 65%, #f7d586); color: #39240b; box-shadow: 0 5px 24px #dbac3925; }
.sorteio-dourado:hover:not(:disabled) { filter: brightness(1.08); }
.sorteio-secundario { border: 1px solid #ffffff24; background: #ffffff05; color: #ded4ec; }
.sorteio-palco { padding: 42px 24px 30px; text-align: center; overflow: hidden; background: radial-gradient(ellipse at center, #5b3d692e, transparent 66%); }
.sorteio-palco h2, .sorteio-resultado h2 { margin: 0 28px 10px; font-size: clamp(23px, 3.5vw, 36px); letter-spacing: -1px; }
.sorteio-palco > p { color: #c1b3d0; font-size: 14px; margin: 0 0 26px; }
.sorteio-roleta-moldura { --wheel-size: min(430px, 67vw, 49dvh); width: var(--wheel-size); height: var(--wheel-size); position: relative; margin: 0 auto; border-radius: 50%; border: 2px solid #f5d38a; padding: 13px; background: linear-gradient(135deg, #f8df9c, #8b591b 40%, #f2c56c 70%, #7c4b14); box-shadow: 0 0 0 7px #d4a75212, 0 0 65px #e1ac4825, 0 20px 60px #0008; }
.sorteio-roleta { width: 100%; height: 100%; border-radius: 50%; background: #241c36; display: block; will-change: transform; }
.sorteio-luzes { position: absolute; inset: -2px; z-index: 2; pointer-events: none; }
.sorteio-luzes i { position: absolute; left: calc(50% - 3px); top: calc(50% - 3px); width: 6px; height: 6px; border-radius: 50%; background: #fff4d7; box-shadow: 0 0 8px #ffdc75; animation: sorteio-luz .7s alternate infinite; }
.sorteio-ponteiro { position: absolute; z-index: 3; top: -12px; left: calc(50% - 15px); width: 30px; height: 42px; background: linear-gradient(90deg, #c4963b, #fff0b8, #d5a84e); clip-path: polygon(0 0, 100% 0, 100% 45%, 50% 100%, 0 45%); filter: drop-shadow(0 4px 3px #0008); }
.sorteio-miolo { position: absolute; inset: 40%; border-radius: 50%; border: 5px solid #e6bd69; background: radial-gradient(circle at 35% 25%, #fff2bd, #ca9332); display: grid; place-items: center; color: #563314; font-size: clamp(22px, 5vw, 40px); box-shadow: 0 5px 20px #0007; }
.sorteio-roleta-moldura.suspense { box-shadow: 0 0 0 9px #d4a75218, 0 0 90px #e1ac4855; }
.sorteio-nome-passando { display: flex; flex-direction: column; align-items: center; gap: 8px; margin: 18px auto 8px; font-size: 14px; font-weight: 600; color: #ffe5a2; min-height: 35px; overflow-wrap: anywhere; }
.sorteio-suspense { color: #c1b3d0; font-size: 13px; }
.sorteio-resultado { position: relative; isolation: isolate; text-align: center; overflow: hidden; padding: 30px 24px 24px; }
.sorteio-raios { position: absolute; inset: -60%; z-index: -1; background: repeating-conic-gradient(from 0deg, #e9b44409 0deg 12deg, transparent 12deg 30deg); animation: sorteio-raios 40s linear infinite; pointer-events: none; }
.sorteio-trofeu { position: relative; z-index: 2; display: block; font-size: 48px; margin-bottom: 14px; filter: drop-shadow(0 0 25px #eab94665); }
.sorteio-resultado h2 { position: relative; z-index: 2; color: #ffe2a0; }
.sorteio-parabens { position: relative; z-index: 2; color: #c5b8d6; font-size: 13px; margin: 0 auto 24px; max-width: 42ch; line-height: 1.6; }
.sorteio-vencedor { position: relative; overflow: hidden; width: min(400px, 100%); margin: auto; border: 1px solid #f2cb7280; border-radius: 24px; padding: 24px; background: radial-gradient(ellipse at 50% 0%, #a97b2b35, transparent 70%), linear-gradient(155deg, #302237, #1c1527); box-shadow: 0 0 60px #e7b84020, inset 0 0 0 5px #e7b84006; animation: sorteio-premio .8s cubic-bezier(.18,.8,.25,1) both; }
.sorteio-selo { font-size: 12px; color: #eac77e; display: block; margin-bottom: 22px; }
.sorteio-avatar-premiado { border-radius: 50%; width: 164px; padding: 5px; border: 3px solid #f5d88a; margin: auto; box-shadow: 0 0 35px #f5d88a30; }
.sorteio-vencedor h3 { position: relative; font-size: clamp(24px, 4vw, 34px); letter-spacing: -.8px; line-height: 1.15; margin: 20px 0 8px; color: #fff4d8; overflow-wrap: anywhere; }
.sorteio-vencedor p { color: #cdbedb; font-size: 13px; margin: 0; }
.sorteio-vencedor-setor { display: block; margin-top: 8px; color: #c1abc9; font-size: 12px; }
.sorteio-vencedor-mensagem { margin-top: 22px; padding-top: 18px; border-top: 1px solid #f2cb7226; font-size: 12px; color: #bdb0ca; line-height: 1.8; }
.sorteio-vencedor-mensagem strong { color: #f4d796; font-weight: 500; }
.sorteio-vencedor { z-index: 2; }
.sorteio-resultado-acoes, .sorteio-encerrar { z-index: 3; }
.sorteio-vencedor-brilho { position: absolute; inset: -100%; background: linear-gradient(110deg, transparent 40%, #ffdd9920 50%, transparent 60%); animation: sorteio-brilho 2s ease-out both; pointer-events: none; }
.sorteio-resultado-acoes { position: relative; display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; margin: 24px 0 16px; }
.sorteio-encerrar { position: relative; color: #c7b9d2; background: none; border: 0; text-decoration: underline; text-underline-offset: 4px; font-size: 12px !important; padding: 6px; }
.sorteio-confetes { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 2; }
.sorteio-confetes i { position: absolute; top: -25px; width: 7px; height: 13px; opacity: 0; animation: sorteio-confete var(--duration) var(--delay) ease-out 2; }
.sorteio-confetes i.estrela { width: 12px; height: 12px; clip-path: polygon(50% 0, 62% 36%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 36%); }
@keyframes sorteio-entrada { from { opacity: 0; transform: translateY(15px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes sorteio-luz { to { opacity: .35; } }
@keyframes sorteio-premio { from { opacity: 0; transform: translateY(28px) scale(.8); } to { opacity: 1; transform: none; } }
@keyframes sorteio-raios { to { transform: rotate(360deg); } }
@keyframes sorteio-brilho { from { transform: translateX(-40%); } to { transform: translateX(40%); } }
@keyframes sorteio-confete { 0% { opacity: 0; transform: translate3d(0,-20px,0) rotate(0); } 8% { opacity: 1; } 85% { opacity: 1; } 100% { opacity: 0; transform: translate3d(var(--drift), 850px, 0) rotate(var(--turn)); } }
@media (max-width: 640px) {
  .sorteio-overlay { padding: 10px; }
  .sorteio-dialog { border-radius: 20px; max-height: calc(100dvh - 20px); }
  .sorteio-header { padding: 28px 54px 22px 20px; gap: 12px; }
  .sorteio-emblema { display: none; }
  .sorteio-selecao { grid-template-columns: 1fr; }
  .sorteio-lista-area { padding: 18px; }
  .sorteio-lista { height: 32dvh; }
  .sorteio-convite { border-left: 0; border-top: 1px solid #ffffff10; padding: 16px; }
  .sorteio-mini-roleta, .sorteio-convite h3, .sorteio-convite > p:not(.sorteio-regra) { display: none; }
  .sorteio-contagem { margin: 0 0 8px; display: flex; gap: 8px; align-items: center; }
  .sorteio-contagem strong { font-size: 26px; }
  .sorteio-footer { padding: 16px; }
  .sorteio-footer button { padding: 12px; }
  .sorteio-palco { padding: 60px 14px 28px; }
  .sorteio-resultado { padding: 50px 16px 20px; }
  .sorteio-resultado-acoes { flex-direction: column; }
}
@media (prefers-reduced-motion: reduce) {
  .sorteio-dialog, .sorteio-dialog *, .sorteio-dialog *::before, .sorteio-dialog *::after { animation: none !important; transition: none !important; }
  .sorteio-confetes i { display: none; }
}
</style>
