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
  <div class="login-shell">
    <div class="login-panel-card">
      <!-- Painel Esquerdo: Brand + Features -->
      <div class="login-left">
        <div class="login-left-inner">
          <div class="login-brand-row">
            <div class="login-brand-icon">
              <fa icon="bolt" />
            </div>
            <h1>Flashrub</h1>
          </div>
          <p class="login-tagline">Gestão Inteligente de Auditorias</p>

          <ul class="login-features">
            <li>
              <fa icon="users-gear" />
              <div>
                <strong>Gestão de Colaboradores</strong>
                <span>Acompanhe métricas, ranking e desempenho da equipe</span>
              </div>
            </li>
            <li>
              <fa icon="clipboard-check" />
              <div>
                <strong>Auditorias em Tempo Real</strong>
                <span>Upload de planilhas, classificação automática e KPIs</span>
              </div>
            </li>
            <li>
              <fa icon="chart-line" />
              <div>
                <strong>Dashboards e Relatórios</strong>
                <span>Conformidade, corredores, classes e gamificação</span>
              </div>
            </li>
          </ul>

          <div class="login-footer">
            © {{ new Date().getFullYear() }} Flashrub
          </div>
        </div>
      </div>

      <!-- Painel Direito: Formulário -->
      <div class="login-right">
        <div class="login-right-inner">
          <div v-if="aba === 'login'">
            <h2>Bem-vindo de volta</h2>
            <p class="login-sub">Acesse sua conta para continuar</p>

            <form @submit.prevent="entrar" class="login-form">
              <div class="field">
                <label>Usuário</label>
                <input
                  v-model="login.email"
                  type="email"
                  placeholder="seu@email.com"
                  required
                  autocomplete="email"
                />
              </div>
              <div class="field">
                <label>Senha</label>
                <input
                  v-model="login.senha"
                  type="password"
                  placeholder="••••••••"
                  required
                  autocomplete="current-password"
                />
              </div>
              <button
                class="btn primary login-btn-main"
                :disabled="auth.carregando"
              >
                <fa v-if="auth.carregando" icon="spinner" spin />
                <span>{{ auth.carregando ? 'Entrando...' : 'Entrar' }}</span>
              </button>
            </form>

            <div class="login-divider"><span>OU</span></div>

            <button class="btn ghost login-btn-ghost" @click="aba = 'cad'">
              <fa icon="store" /> Criar nova loja
            </button>
          </div>

          <div v-else>
            <h2>Criar nova loja</h2>
            <p class="login-sub">Cadastre sua loja e o administrador</p>

            <form @submit.prevent="cadastrar" class="login-form">
              <div class="field">
                <label>Nome da loja</label>
                <input v-model="cad.loja.nome" placeholder="Ex: Supermercado Center" required />
              </div>
              <div class="login-form-row">
                <div class="field">
                  <label>Código</label>
                  <input v-model="cad.loja.codigo" placeholder="LOJA01" />
                </div>
                <div class="field">
                  <label>Cidade</label>
                  <input v-model="cad.loja.cidade" placeholder="São Paulo" />
                </div>
                <div class="field">
                  <label>UF</label>
                  <input v-model="cad.loja.estado" maxlength="2" placeholder="SP" />
                </div>
              </div>
              <div class="field">
                <label>Administrador</label>
                <input v-model="cad.admin.nome" placeholder="Nome completo" required />
              </div>
              <div class="login-form-row">
                <div class="field">
                  <label>E-mail</label>
                  <input v-model="cad.admin.email" type="email" placeholder="admin@loja.com" required />
                </div>
                <div class="field">
                  <label>Senha</label>
                  <input v-model="cad.admin.senha" type="password" placeholder="Mínimo 6" required minlength="6" />
                </div>
              </div>
              <button
                class="btn primary login-btn-main"
                :disabled="auth.carregando"
              >
                <fa v-if="auth.carregando" icon="spinner" spin />
                <span>{{ auth.carregando ? 'Criando...' : 'Criar loja' }}</span>
              </button>
            </form>

            <div class="login-divider"><span>OU</span></div>

            <button class="btn ghost login-btn-ghost" @click="aba = 'login'">
              <fa icon="right-to-bracket" /> Voltar para login
            </button>
          </div>

          <!-- Links de acesso -->
          <div class="login-portals">
            <RouterLink to="/portal" class="login-portal-chip">
              <fa icon="id-badge" /> Colaborador
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ============ Shell ============ */
.login-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background-color: #0d0b1a;
  background-image:
    url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M29 22v8h-8v1h8v8h1v-8h8v-1h-8v-8z' fill='rgba(124,92,255,0.08)'/%3E%3C/svg%3E"),
    linear-gradient(160deg, #0f0c29 0%, #1a1040 40%, #0f1424 100%);
}

/* ============ Card principal ============ */
.login-panel-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
  max-width: 960px;
  width: 100%;
  min-height: 560px;
  border-radius: 22px;
  overflow: hidden;
  box-shadow:
    0 20px 60px rgba(53, 70, 120, 0.16),
    0 4px 16px rgba(0, 0, 0, 0.06);
}

/* ============ Painel Esquerdo ============ */
.login-left {
  background: linear-gradient(135deg, #7c5cff 0%, #7c5cff 40%, #22d3ee 100%);
  color: #fff;
  display: flex;
  align-items: flex-start;
  padding-top: 40px;
}

.login-left-inner {
  padding: 44px 36px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.login-brand-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.login-brand-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.18);
  display: grid;
  place-items: center;
  font-size: 20px;
}

.login-brand-row h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.login-tagline {
  margin: -16px 0 0;
  font-size: 14px;
  opacity: 0.8;
  font-weight: 400;
}

/* ============ Features ============ */
.login-features {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}

.login-features li {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.login-features li > svg {
  flex-shrink: 0;
  margin-top: 3px;
  font-size: 16px;
  opacity: 0.85;
}

.login-features li strong {
  display: block;
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 2px;
}

.login-features li span {
  font-size: 12px;
  opacity: 0.75;
  line-height: 1.4;
}

/* ============ Footer ============ */
.login-footer {
  font-size: 12px;
  opacity: 0.5;
  margin-top: auto;
}

/* ============ Painel Direito ============ */
.login-right {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

/* Dots decorativos no fundo do painel direito */
.login-dots {
  position: absolute;
  top: 50%;
  right: -30px;
  transform: translateY(-50%);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 10px;
  width: 70px;
  height: 70px;
  opacity: 0.12;
  pointer-events: none;
}

.login-dots .ld-dot {
  position: relative;
}

.login-dots .ld-dot,
.login-dots .ld-dot::before,
.login-dots .ld-dot::after {
  animation-duration: 2s;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

.login-dots .ld-dot::before,
.login-dots .ld-dot::after {
  aspect-ratio: 1;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 50%;
  content: "";
  display: block;
  position: absolute;
  width: 100%;
}

.login-dots .ld-dot::after {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0);
}

.login-dots .ld-dot--primary::before,
.login-dots .ld-dot--primary::after { background-color: #7c5cff; }
.login-dots .ld-dot--accent::before,
.login-dots .ld-dot--accent::after { background-color: #22d3ee; }
.login-dots .ld-dot--warning::before,
.login-dots .ld-dot--warning::after { background-color: #f59e0b; }
.login-dots .ld-dot--danger::before,
.login-dots .ld-dot--danger::after { background-color: #ef4444; }
.login-dots .ld-dot--good::before,
.login-dots .ld-dot--good::after { background-color: #4f9cf0; }
.login-dots .ld-dot--excellent::before,
.login-dots .ld-dot--excellent::after { background-color: #22c55e; }

.login-dots .ld-dot--lg::after { width: 500%; }
.login-dots .ld-dot--sm::after { width: 167%; }

.login-dots .ld-dot--rotate-top { animation-name: ld-rotate; transform-origin: 50% 200%; }
.login-dots .ld-dot--rotate-right { animation-name: ld-rotate; transform-origin: 200% 50%; }
.login-dots .ld-dot--rotate-left { animation-name: ld-rotate; transform-origin: -100% 50%; }
.login-dots .ld-dot--rotate-bottom { animation-name: ld-rotate; transform-origin: 50% -100%; }

.login-dots .ld-dot:nth-child(1)::before { animation-name: ld-scale1; }
.login-dots .ld-dot:nth-child(2)::before { animation-name: ld-scale2; }
.login-dots .ld-dot:nth-child(3)::before { animation-name: ld-scale3; }
.login-dots .ld-dot:nth-child(4)::before { animation-name: ld-scale4; }
.login-dots .ld-dot:nth-child(5)::before { animation-name: ld-scale5; }
.login-dots .ld-dot:nth-child(6)::before { animation-name: ld-scale6; }
.login-dots .ld-dot:nth-child(7)::before { animation-name: ld-scale7; }
.login-dots .ld-dot:nth-child(8)::before { animation-name: ld-scale8; }
.login-dots .ld-dot:nth-child(9)::before { animation-name: ld-scale9; }

.login-dots .ld-dot:nth-child(3)::after { animation-name: ld-wave3; }
.login-dots .ld-dot:nth-child(5)::after { animation-name: ld-wave5a, ld-wave5b; }
.login-dots .ld-dot:nth-child(7)::after { animation-name: ld-wave7; }
.login-dots .ld-dot:nth-child(9)::after { animation-name: ld-wave9; }

@keyframes ld-rotate {
  from, 22% { animation-timing-function: ease-out; transform: rotate(-45deg); }
  37%, to   { transform: rotate(0); }
}
@keyframes ld-scale1 {
  from, 36% { transform: translate(0, 0) scale(0); }
  50%, 71%  { transform: translate(0, 0) scale(1); }
  87%, to   { transform: translate(75%, 75%) scale(0); }
}
@keyframes ld-scale2 {
  from, 25% { animation-timing-function: ease-out; transform: translate(0, 0) scale(0); }
  40%, 71%  { transform: translate(0, 0) scale(1); }
  87%, to   { transform: translate(0, -100%) scale(0); }
}
@keyframes ld-scale3 {
  from, 27% { animation-timing-function: ease-in; transform: translate(0, 0) scale(0); }
  45%, 71%  { transform: translate(0, 0) scale(1); }
  87%, to   { transform: translate(-75%, 75%) scale(0); }
}
@keyframes ld-scale4 {
  from, 28% { animation-timing-function: ease-out; transform: translate(0, 0) scale(0); }
  43%, 71%  { transform: translate(0, 0) scale(1); }
  87%, to   { transform: translate(-100%, 0) scale(0); }
}
@keyframes ld-scale5 {
  from, 9%, to { transform: scale(0); }
  26%          { transform: scale(1.17); }
  41%, 75%     { transform: scale(1); }
}
@keyframes ld-scale6 {
  from, 22% { animation-timing-function: ease-out; transform: translate(0, 0) scale(0); }
  37%, 71%  { transform: translate(0, 0) scale(1); }
  87%, to   { transform: translate(100%, 0) scale(0); }
}
@keyframes ld-scale7 {
  from, 36% { animation-timing-function: ease-in; transform: translate(0, 0) scale(0); }
  53%, 71%  { transform: translate(0, 0) scale(1); }
  87%, to   { transform: translate(75%, -75%) scale(0); }
}
@keyframes ld-scale8 {
  from, 24% { animation-timing-function: ease-out; transform: translate(0, 0) scale(0); }
  39%, 71%  { transform: translate(0, 0) scale(1); }
  87%, to   { transform: translate(0, 100%) scale(0); }
}
@keyframes ld-scale9 {
  from, 32% { animation-timing-function: ease-in; transform: translate(0, 0) scale(0); }
  49%, 71%  { transform: translate(0, 0) scale(1); }
  87%, to   { transform: translate(-75%, -75%) scale(0); }
}
@keyframes ld-wave3 {
  from       { visibility: hidden; }
  45%        { opacity: 1; transform: translate(-50%, -50%) scale(0.6); visibility: hidden; }
  61%, to    { opacity: 0; transform: translate(-50%, -50%) scale(1); }
}
@keyframes ld-wave5a {
  from       { transform: translate(-50%, -50%) scale(0.2); }
  8%         { transform: translate(-50%, -50%) scale(0.8); }
  25%, to    { transform: translate(-50%, -50%) scale(1); }
}
@keyframes ld-wave5b {
  from, 25%, to { opacity: 0; }
  8%            { opacity: 0.5; }
}
@keyframes ld-wave7 {
  from       { visibility: hidden; }
  53%        { opacity: 1; transform: translate(-50%, -50%) scale(0.6); visibility: hidden; }
  69%, to    { opacity: 0; transform: translate(-50%, -50%) scale(1); }
}
@keyframes ld-wave9 {
  from       { visibility: hidden; }
  49%        { opacity: 1; transform: translate(-50%, -50%) scale(0.6); visibility: hidden; }
  65%, to    { opacity: 0; transform: translate(-50%, -50%) scale(1); }
}

.login-right-inner {
  padding: 44px 40px;
  width: 100%;
  max-width: 400px;
}

.login-right h2 {
  margin: 0 0 4px;
  font-size: 22px;
  font-weight: 800;
  color: #1a1e35;
}

.login-sub {
  margin: 0 0 24px;
  font-size: 13px;
  color: #6b7393;
}

/* ============ Formulário ============ */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 8px;
}

.login-form .field label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #46527e;
  margin-bottom: 5px;
}

.login-form .field input {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 14px;
  border-radius: 10px;
  border: 1.5px solid #dde3f0;
  background: #f8fafd;
  color: #1a1e35;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.login-form .field input::placeholder {
  color: #a0aac0;
}

.login-form .field input:focus {
  border-color: #7c5cff;
  box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.12);
  background: #fff;
}

.login-form-row {
  display: grid;
  grid-template-columns: 1fr 1fr 0.7fr;
  gap: 10px;
}

/* ============ Botões ============ */
.login-btn-main {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  margin-top: 4px;
}

.login-btn-ghost {
  width: 100%;
  padding: 11px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  border: 1.5px solid #dde3f0;
  color: #46527e;
}

.login-btn-ghost:hover {
  background: #f2f5fa;
  border-color: #c8d0e0;
}

/* ============ Divisor ============ */
.login-divider {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 16px 0;
}

.login-divider::before,
.login-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e2e8f5;
}

.login-divider span {
  font-size: 11px;
  font-weight: 700;
  color: #a0aac0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* ============ Portais ============ */
.login-portals {
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid #eef2f8;
  display: flex;
  justify-content: center;
}

.login-portal-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 999px;
  background: #f2f5fa;
  color: #7c5cff;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
}

.login-portal-chip:hover {
  background: #e8e5ff;
}

/* ============ Responsivo ============ */
@media (max-width: 700px) {
  .login-panel-card {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .login-left {
    display: none;
  }

  .login-right-inner {
    padding: 32px 24px;
  }

  .login-form-row {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
