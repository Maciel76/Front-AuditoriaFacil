const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000/api";

function origemApi() {
  try {
    const base = new URL(
      API_BASE,
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:4000",
    );
    return base.origin;
  } catch {
    return typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:4000";
  }
}

export function resolverUrlMidia(url) {
  if (!url) return "";
  if (/^(data:|blob:|https?:\/\/)/i.test(url)) return url;

  try {
    return new URL(
      url.startsWith("/") ? url : `/${url}`,
      origemApi(),
    ).toString();
  } catch {
    return url;
  }
}
