<script setup>
import { ref, onMounted } from 'vue';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import Loader from '@/components/Loader.vue';

const auth = useAuthStore();
const ui = useUiStore();
const carregando = ref(true);
const loja = ref(null);
const usuarios = ref([]);
const novoUsuario = ref(null);

async function carregar() {
  carregando.value = true;
  try {
    if (auth.loja?._id) {
      const { data } = await api.get('/lojas/me', { params: auth.isSuperAdmin ? { lojaId: auth.loja._id } : {} });
      loja.value = data;
    }
    const { data: u } = await api.get('/usuarios');
    usuarios.value = u.items;
  } finally { carregando.value = false; }
}
onMounted(carregar);

async function salvarLoja() {
  try {
    const { data } = await api.put('/lojas/' + loja.value._id, loja.value);
    loja.value = data;
    ui.sucesso('Loja atualizada');
  } catch (e) { ui.erro(e?.response?.data?.error || 'Falha'); }
}

function abrirNovoUsuario() {
  novoUsuario.value = { nome: '', email: '', senha: '', role: 'COLABORADOR' };
}

async function salvarUsuario() {
  try {
    await api.post('/usuarios', novoUsuario.value);
    ui.sucesso('Usuário criado');
    novoUsuario.value = null;
    carregar();
  } catch (e) { ui.erro(e?.response?.data?.error || 'Falha'); }
}

async function desativarUsuario(u) {
  if (!confirm(`Desativar ${u.nome}?`)) return;
  await api.delete('/usuarios/' + u._id);
  carregar();
}
</script>

<template>
  <Loader v-if="carregando" />
  <div v-else class="grid gap-3">
    <div v-if="loja" class="card">
      <h3 class="mt-0">Dados da loja</h3>
      <div class="form-grid">
        <div class="field"><label>Nome</label><input v-model="loja.nome" /></div>
        <div class="field"><label>Slug</label><input v-model="loja.slug" disabled /></div>
        <div class="field"><label>Código</label><input v-model="loja.codigo" /></div>
        <div class="field"><label>Cidade</label><input v-model="loja.cidade" /></div>
        <div class="field"><label>UF</label><input v-model="loja.estado" maxlength="2" /></div>
        <div class="field"><label>CNPJ</label><input v-model="loja.cnpj" /></div>
      </div>
      <h4>Metas de conformidade (%)</h4>
      <div class="form-grid">
        <div class="field"><label>Etiqueta</label><input type="number" v-model.number="loja.metas.conformidadeEtiqueta" /></div>
        <div class="field"><label>Presença</label><input type="number" v-model.number="loja.metas.conformidadePresenca" /></div>
        <div class="field"><label>Ruptura</label><input type="number" v-model.number="loja.metas.conformidadeRuptura" /></div>
      </div>
      <div class="row mt-2"><span class="spacer" /><button class="btn primary" @click="salvarLoja">Salvar</button></div>
    </div>

    <div class="card">
      <div class="row mb-2">
        <h3 class="mt-0 mb-0">Usuários</h3>
        <span class="spacer" />
        <button v-if="auth.podeGerenciar" class="btn primary" @click="abrirNovoUsuario"><fa icon="plus" /> Novo usuário</button>
      </div>

      <div v-if="novoUsuario" class="card glow mb-2">
        <h4 class="mt-0">Novo usuário</h4>
        <div class="form-grid">
          <div class="field"><label>Nome</label><input v-model="novoUsuario.nome" /></div>
          <div class="field"><label>E-mail</label><input v-model="novoUsuario.email" type="email" /></div>
          <div class="field"><label>Senha</label><input v-model="novoUsuario.senha" type="password" minlength="6" /></div>
          <div class="field">
            <label>Perfil</label>
            <select v-model="novoUsuario.role">
              <option value="COLABORADOR">Colaborador</option>
              <option value="STORE_ADMIN">Admin da loja</option>
              <option v-if="auth.isSuperAdmin" value="SUPER_ADMIN">Super admin</option>
            </select>
          </div>
        </div>
        <div class="row mt-2"><span class="spacer" /><button class="btn ghost" @click="novoUsuario = null">Cancelar</button><button class="btn primary" @click="salvarUsuario">Salvar</button></div>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Loja</th><th>Status</th><th></th></tr></thead>
          <tbody>
            <tr v-for="u in usuarios" :key="u._id">
              <td>{{ u.nome }}</td>
              <td>{{ u.email }}</td>
              <td><span class="badge dim">{{ u.role }}</span></td>
              <td>{{ u.loja?.nome || '—' }}</td>
              <td><span class="badge" :class="u.ativo ? 'ok' : 'bad'">{{ u.ativo ? 'Ativo' : 'Inativo' }}</span></td>
              <td class="text-right"><button v-if="u.ativo && auth.podeGerenciar" class="btn ghost" @click="desativarUsuario(u)"><fa icon="trash" /></button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
