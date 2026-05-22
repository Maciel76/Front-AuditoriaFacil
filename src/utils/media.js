import { getApiOrigin } from "@/utils/apiBase";

const cachePreloadImagens = new Map();

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

function agendarOcioso(callback) {
  if (typeof window === "undefined") {
    callback();
    return;
  }

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(callback, { timeout: 400 });
    return;
  }

  window.setTimeout(callback, 60);
}

export function precarregarImagem(url, opcoes = {}) {
  const resolvida = resolverUrlMidia(url);
  if (!resolvida) return Promise.resolve("");

  if (/^(data:|blob:)/i.test(resolvida) || typeof Image === "undefined") {
    return Promise.resolve(resolvida);
  }

  const existente = cachePreloadImagens.get(resolvida);
  if (existente) return existente;

  const tarefa = new Promise((resolve) => {
    const imagem = new Image();
    if ("decoding" in imagem) imagem.decoding = opcoes.decoding || "async";
    if ("fetchPriority" in imagem && opcoes.prioridade) {
      imagem.fetchPriority = opcoes.prioridade;
    }

    const finalizar = () => resolve(resolvida);

    imagem.onload = () => {
      if (typeof imagem.decode === "function") {
        imagem.decode().catch(() => {}).finally(finalizar);
        return;
      }
      finalizar();
    };

    imagem.onerror = () => {
      cachePreloadImagens.delete(resolvida);
      resolve(resolvida);
    };

    imagem.src = resolvida;
  });

  cachePreloadImagens.set(resolvida, tarefa);
  return tarefa;
}

export function precarregarImagens(
  urls,
  { prioridadeImediata = 0, prioridade = "auto" } = {},
) {
  const unicas = Array.from(
    new Set((urls || []).map((url) => resolverUrlMidia(url)).filter(Boolean)),
  );

  if (!unicas.length) return Promise.resolve([]);

  const imediatas = unicas.slice(0, Math.max(0, prioridadeImediata));
  const restantes = unicas.slice(imediatas.length);

  if (restantes.length) {
    agendarOcioso(() => {
      restantes.forEach((url) => {
        void precarregarImagem(url);
      });
    });
  }

  return Promise.all(
    imediatas.map((url) => precarregarImagem(url, { prioridade })),
  );
}
