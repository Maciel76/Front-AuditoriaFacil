<script setup>
import { ref, reactive } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

const aba = ref('login');
const auth = useAuthStore();
const ui = useUiStore();
const router = useRouter();
const route = useRoute();

const login = reactive({ email: '', senha: '' });
const cad = reactive({
  loja: { nome: '', cidade: '', estado: '', codigo: '' },
  admin: { nome: '', email: '', senha: '' },
});

async function entrar() {
  try {
    await auth.login(login.email, login.senha);
    ui.sucesso('Bem-vindo!');
    router.push(route.query.redirect || '/dashboard');
  } catch (e) {
    ui.erro(e?.response?.data?.error || 'Falha ao entrar');
  }
}

async function cadastrar() {
  try {
    await auth.registrarLoja(cad);
    ui.sucesso('Loja cadastrada!');
    router.push('/dashboard');
  } catch (e) {
    ui.erro(e?.response?.data?.error || 'Falha ao cadastrar');
  }
}
</script>

<template>
  <div class="auth-shell">
    <div class="auth-card">
      <div class="row" style="margin-bottom: 8px;">
        <div class="brand-mark"><fa icon="bolt" /></div>
        <div>
          <h1 style="margin:0">NovaAuditoria</h1>
          <p style="margin:0">Inteligência de auditoria para o varejo</p>
        </div>
      </div>

      <div class="auth-tabs">
        <button :class="{ active: aba === 'login' }" @click="aba = 'login'">Entrar</button>
        <button :class="{ active: aba === 'cad' }" @click="aba = 'cad'">Cadastrar Loja</button>
      </div>

      <form v-if="aba === 'login'" @submit.prevent="entrar" class="grid">
        <div class="field">
          <label>E-mail</label>
          <input v-model="login.email" type="email" required autocomplete="email" />
        </div>
        <div class="field">
          <label>Senha</label>
          <input v-model="login.senha" type="password" required autocomplete="current-password" />
        </div>
        <button class="btn primary" :disabled="auth.carregando">
          <fa v-if="auth.carregando" icon="spinner" spin />
          <span>Entrar</span>
        </button>
        <p class="muted text-center" style="font-size: 12px;">
          Primeiro uso? O super-admin padrão é
          <strong>admin@novaauditoria.local / admin123</strong>.
        </p>
        <div class="text-center" style="border-top: 1px solid var(--border); padding-top: 16px; margin-top: 4px;">
          <RouterLink to="/portal" class="btn ghost" style="width:100%; justify-content:center;">
            <fa icon="id-badge" /> Sou colaborador &rsaquo; Acessar meu portal
          </RouterLink>
        </div>
      </form>

      <form v-else @submit.prevent="cadastrar" class="grid">
        <p class="muted" style="margin: 0;">Crie sua loja e o primeiro administrador.</p>
        <div class="form-grid">
          <div class="field"><label>Nome da loja</label><input v-model="cad.loja.nome" required /></div>
          <div class="field"><label>Código interno</label><input v-model="cad.loja.codigo" /></div>
          <div class="field"><label>Cidade</label><input v-model="cad.loja.cidade" /></div>
          <div class="field"><label>UF</label><input v-model="cad.loja.estado" maxlength="2" /></div>
        </div>
        <div class="field"><label>Nome do administrador</label><input v-model="cad.admin.nome" required /></div>
        <div class="form-grid">
          <div class="field"><label>E-mail</label><input v-model="cad.admin.email" type="email" required /></div>
          <div class="field"><label>Senha</label><input v-model="cad.admin.senha" type="password" required minlength="6" /></div>
        </div>
        <button class="btn primary" :disabled="auth.carregando">
          <fa v-if="auth.carregando" icon="spinner" spin />
          <span>Criar loja</span>
        </button>
      </form>
    </div>
  </div>
</template>
