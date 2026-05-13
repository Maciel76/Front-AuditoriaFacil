<script setup>
import { ref, onMounted } from 'vue';
import api from '@/services/api';
import Loader from '@/components/Loader.vue';
import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import { RouterLink } from 'vue-router';

const ui = useUiStore();
const auth = useAuthStore();

const items = ref([]);
const carregando = ref(true);
const q = ref('');
const novo = ref(null);

async function carregar() {
  carregando.value = true;
  try {
    const { data } = await api.get('/colaboradores', { params: { q: q.value || undefined, limit: 200 } });
    items.value = data.items;
  } finally { carregando.value = false; }
}
onMounted(carregar);

function abrirNovo() { novo.value = { nome: '', codigoExterno: '', cargo: '', setor: '' }; }

async function salvar() {
  try {
    await api.post('/colaboradores', novo.value);
    ui.sucesso('Colaborador criado');
    novo.value = null;
    carregar();
  } catch (e) {
    ui.erro(e?.response?.data?.error || 'Falha');
  }
}
</script>

<template>
  <div class="grid gap-3">
    <div class="row">
      <div class="row" style="gap:8px;">
        <input v-model="q" placeholder="Buscar nome ou código..." style="background:rgba(0,0,0,.25);border:1px solid var(--border);border-radius:10px;padding:10px 14px;color:white;width:280px;" @keyup.enter="carregar" />
        <button class="btn ghost" @click="carregar"><fa icon="magnifying-glass" /></button>
      </div>
      <span class="spacer" />
      <button v-if="auth.podeGerenciar" class="btn primary" @click="abrirNovo"><fa icon="plus" /> Novo colaborador</button>
    </div>

    <div v-if="novo" class="card glow">
      <h3 class="mt-0">Novo colaborador</h3>
      <div class="form-grid">
        <div class="field"><label>Nome</label><input v-model="novo.nome" required /></div>
        <div class="field"><label>Código (matrícula)</label><input v-model="novo.codigoExterno" required /></div>
        <div class="field"><label>Cargo</label><input v-model="novo.cargo" /></div>
        <div class="field"><label>Setor</label><input v-model="novo.setor" /></div>
      </div>
      <div class="row mt-2">
        <span class="spacer" />
        <button class="btn ghost" @click="novo = null">Cancelar</button>
        <button class="btn primary" @click="salvar">Salvar</button>
      </div>
    </div>

    <Loader v-if="carregando" />
    <div v-else-if="!items.length" class="empty">Nenhum colaborador. Eles serão criados automaticamente após o upload das planilhas.</div>
    <div v-else class="grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px;">
      <RouterLink
        v-for="c in items"
        :key="c._id"
        :to="`/colaboradores/${c._id}`"
        class="card"
        style="display: block; text-decoration: none; color: inherit;"
      >
        <div class="row">
          <div class="avatar" style="width: 44px; height: 44px;">{{ (c.nome || '?').slice(0,2) }}</div>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700;">{{ c.nome }}</div>
            <div class="muted" style="font-size: 12px;">#{{ c.codigoExterno }}</div>
          </div>
          <span class="badge info">N{{ c.nivel }}</span>
        </div>
        <div class="row mt-2" style="font-size: 12px;">
          <span class="muted">Pontos</span><strong>{{ Math.round(c.pontuacao) }}</strong>
          <span class="spacer" />
          <span class="muted">Lidos</span><strong>{{ c.totalItensLidos.toLocaleString('pt-BR') }}</strong>
        </div>
        <div class="progress mt-2"><span :style="{ width: c.totalItensLidos ? Math.min(100, (c.totalItensConformes / c.totalItensLidos) * 100) + '%' : '0%' }" /></div>
      </RouterLink>
    </div>
  </div>
</template>
