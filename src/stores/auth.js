import { defineStore } from 'pinia';
import api from '@/services/api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('na_token') || null,
    usuario: JSON.parse(localStorage.getItem('na_usuario') || 'null'),
    loja: JSON.parse(localStorage.getItem('na_loja') || 'null'),
    carregando: false,
  }),
  getters: {
    autenticado: (s) => !!s.token,
    isSuperAdmin: (s) => s.usuario?.role === 'SUPER_ADMIN',
    isStoreAdmin: (s) => s.usuario?.role === 'STORE_ADMIN',
    isColaborador: (s) => s.usuario?.role === 'COLABORADOR',
    podeGerenciar: (s) => ['SUPER_ADMIN', 'STORE_ADMIN'].includes(s.usuario?.role),
  },
  actions: {
    persistir() {
      if (this.token) localStorage.setItem('na_token', this.token);
      else localStorage.removeItem('na_token');
      if (this.usuario) localStorage.setItem('na_usuario', JSON.stringify(this.usuario));
      else localStorage.removeItem('na_usuario');
      if (this.loja) localStorage.setItem('na_loja', JSON.stringify(this.loja));
      else localStorage.removeItem('na_loja');
    },
    async login(email, senha) {
      this.carregando = true;
      try {
        const { data } = await api.post('/auth/login', { email, senha });
        this.token = data.token;
        this.usuario = data.usuario;
        this.loja = data.loja;
        this.persistir();
        return data;
      } finally {
        this.carregando = false;
      }
    },
    async registrarLoja(payload) {
      this.carregando = true;
      try {
        const { data } = await api.post('/auth/register-loja', payload);
        this.token = data.token;
        this.usuario = data.usuario;
        this.loja = data.loja;
        this.persistir();
        return data;
      } finally {
        this.carregando = false;
      }
    },
    async carregarMe() {
      try {
        const { data } = await api.get('/auth/me');
        this.usuario = data.usuario;
        this.loja = data.loja;
        this.persistir();
      } catch (e) {
        this.logout();
      }
    },
    logout() {
      this.token = null;
      this.usuario = null;
      this.loja = null;
      this.persistir();
      if (location.pathname !== '/login') location.href = '/login';
    },
  },
});
