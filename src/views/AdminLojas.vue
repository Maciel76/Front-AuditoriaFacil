<script setup>
import { ref, onMounted } from 'vue';
import api from '@/services/api';
import { useUiStore } from '@/stores/ui';
import Loader from '@/components/Loader.vue';

const ui = useUiStore();
const items = ref([]);
const carregando = ref(true);
const nova = ref(null);

async function carregar() {
  carregando.value = true;
  try {
    const { data } = await api.get('/lojas');
    items.value = data.items;
  } finally { carregando.value = false; }
}
onMounted(carregar);

function abrirNova() { nova.value = { nome: '', codigo: '', cidade: '', estado: '' }; }

async function salvar() {
  try {
    await api.post('/lojas', nova.value);
    ui.sucesso('Loja criada');
    nova.value = null;
    carregar();
  } catch (e) { ui.erro(e?.response?.data?.error || 'Falha'); }
}

async function desativar(l) {
  if (!confirm(`Desativar ${l.nome}?`)) return;
  await api.delete('/lojas/' + l._id);
  carregar();
}
</script>

<template>
  <div class="grid gap-3">
    <div class="row">
      <span class="spacer" />
      <button class="btn primary" @click="abrirNova"><fa icon="plus" /> Nova loja</button>
    </div>

    <div v-if="nova" class="card glow">
      <h3 class="mt-0">Nova loja</h3>
      <div class="form-grid">
        <div class="field"><label>Nome</label><input v-model="nova.nome" required /></div>
        <div class="field"><label>Código</label><input v-model="nova.codigo" /></div>
        <div class="field"><label>Cidade</label><input v-model="nova.cidade" /></div>
        <div class="field"><label>UF</label><input v-model="nova.estado" maxlength="2" /></div>
      </div>
      <div class="row mt-2"><span class="spacer" /><button class="btn ghost" @click="nova = null">Cancelar</button><button class="btn primary" @click="salvar">Salvar</button></div>
    </div>

    <Loader v-if="carregando" />
    <div v-else class="grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px;">
      <div v-for="l in items" :key="l._id" class="card">
        <div class="row">
          <div class="avatar" style="width: 44px; height: 44px;"><fa icon="store" /></div>
          <div style="flex:1">
            <div style="font-weight: 700;">{{ l.nome }}</div>
            <div class="muted" style="font-size: 12px;">{{ l.cidade }} {{ l.estado ? '/' + l.estado : '' }} · #{{ l.slug }}</div>
          </div>
          <span class="badge" :class="l.ativa ? 'ok' : 'bad'">{{ l.ativa ? 'Ativa' : 'Inativa' }}</span>
        </div>
        <div class="row mt-2" style="font-size: 12px;">
          <span class="muted">Pontos</span><strong>{{ Math.round(l.pontuacao) }}</strong>
          <span class="spacer" />
          <span class="muted">Nível</span><strong>{{ l.nivel }}</strong>
        </div>
        <div class="row mt-2">
          <span class="spacer" />
          <button v-if="l.ativa" class="btn ghost" @click="desativar(l)"><fa icon="trash" /></button>
        </div>
      </div>
    </div>
  </div>
</template>
