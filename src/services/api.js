import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:4000/api',
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('na_token');
  if (token && !config.headers?.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const appToken = localStorage.getItem('na_token');
    const authHeader = err?.config?.headers?.Authorization;
    const usaTokenApp = !!appToken && authHeader === `Bearer ${appToken}`;

    if (err?.response?.status === 401 && usaTokenApp) {
      try {
        const auth = useAuthStore();
        auth.logout();
      } catch {}
    }
    return Promise.reject(err);
  }
);

export default api;
