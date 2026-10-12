let carregamento;

export function carregarLottie() {
  if (window.lottie) return Promise.resolve(window.lottie);
  if (!carregamento) {
    carregamento = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const falhar = () => {
        clearTimeout(timeout);
        script.remove();
        carregamento = null;
        reject(new Error("Não foi possível carregar o player da animação"));
      };
      const timeout = setTimeout(falhar, 15000);
      script.src = `${import.meta.env.BASE_URL}vendor/lottie-web/lottie_svg.min.js`;
      script.async = true;
      script.onload = () => {
        clearTimeout(timeout);
        if (window.lottie) resolve(window.lottie);
        else falhar();
      };
      script.onerror = falhar;
      document.head.appendChild(script);
    });
  }
  return carregamento;
}
