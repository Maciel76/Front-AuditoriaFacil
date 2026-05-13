import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import { API_BASE } from '@/utils/apiBase';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
});

function normalizarUrl(config) {
  return String(config?.url || '').trim();
}

function isRotaPublicaPortal(config) {
  return normalizarUrl(config).startsWith('/auth/portal/');
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('na_token');
  if (token && !config.headers?.Authorization && !isRotaPublicaPortal(config)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const appToken = localStorage.getItem('na_token');
    const rotaPublicaPortal = isRotaPublicaPortal(err?.config);
    const authHeader = err?.config?.headers?.Authorization;
    const usaTokenApp = !!appToken && authHeader === `Bearer ${appToken}`;

    if (err?.response?.status === 401 && usaTokenApp && !rotaPublicaPortal) {
      try {
        const auth = useAuthStore();
        auth.logout();
      } catch {}
    }
    return Promise.reject(err);
  }
);

export default api;
