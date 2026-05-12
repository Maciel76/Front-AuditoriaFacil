const fallbackApiOrigin = 'http://localhost:4000';
const fallbackApiBase = `${fallbackApiOrigin}/api`;

const rawApiBase =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  fallbackApiBase;

const normalizedApiBase = `${rawApiBase}`.trim().replace(/\/+$/, '') || fallbackApiBase;

export const API_BASE = normalizedApiBase.endsWith('/api')
  ? normalizedApiBase
  : `${normalizedApiBase}/api`;

export function getApiOrigin() {
  try {
    return new URL(API_BASE).origin;
  } catch {
    return typeof window !== 'undefined'
      ? window.location.origin
      : fallbackApiOrigin;
  }
}