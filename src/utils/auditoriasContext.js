export const AUDITORIAS_LOJA_DESTINO_STORAGE_KEY =
  "na_auditorias_superadmin_loja";
export const AUDITORIAS_LOJA_DESTINO_EVENT = "na:auditorias-loja-destino";

export function lerLojaDestinoAuditorias() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUDITORIAS_LOJA_DESTINO_STORAGE_KEY) || "";
}

export function salvarLojaDestinoAuditorias(lojaId = "") {
  if (typeof window === "undefined") return;

  if (lojaId) {
    window.localStorage.setItem(AUDITORIAS_LOJA_DESTINO_STORAGE_KEY, lojaId);
  } else {
    window.localStorage.removeItem(AUDITORIAS_LOJA_DESTINO_STORAGE_KEY);
  }

  window.dispatchEvent(
    new CustomEvent(AUDITORIAS_LOJA_DESTINO_EVENT, {
      detail: { lojaId },
    }),
  );
}
