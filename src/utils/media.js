import { getApiOrigin } from "@/utils/apiBase";

function origemApi() {
  return getApiOrigin();
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
