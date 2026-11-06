export const GIF_MAX_ORIGINAL = 50 * 1024 * 1024;
export const GIF_TAMANHO_ALVO = 512 * 1024;

export function formatarTamanho(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Keep all frames, their delays, transparency and loop settings. Only resize,
// quantize and optimize; canvas.toBlob would flatten the GIF to one frame.
export async function compactarGif(original, onProgress = () => {}) {
  if (original.size > GIF_MAX_ORIGINAL) {
    throw new Error("Selecione um GIF de até 50 MB para compactar.");
  }
  const assinatura = new TextDecoder().decode(await original.slice(0, 6).arrayBuffer());
  if (!/^GIF8[79]a$/.test(assinatura)) {
    throw new Error("O arquivo selecionado não é um GIF válido.");
  }
  onProgress("Preparando compactação…");
  const { default: gifsicle } = await import("gifsicle-wasm-browser");
  const perfis = [
    { lado: 320, cores: 64, perdas: 100 },
    { lado: 240, cores: 48, perdas: 150 },
    { lado: 160, cores: 32, perdas: 200 },
  ];
  let menor = original;
  for (const [index, perfil] of perfis.entries()) {
    onProgress(`Compactando GIF (${index + 1}/${perfis.length})…`);
    const arquivos = await gifsicle.run({
      input: [{ file: original, name: "entrada.gif" }],
      command: [`-O1 --lossy=${perfil.perdas} --colors=${perfil.cores} --resize-fit ${perfil.lado}x${perfil.lado} --no-comments --no-names entrada.gif -o /out/compactado.gif`],
    });
    const resultado = arquivos?.find((file) => file.name === "compactado.gif");
    if (!resultado?.size) {
      throw new Error("Não foi possível compactar este GIF. Tente outro arquivo.");
    }
    if (resultado.size < menor.size) menor = resultado;
    if (menor.size <= GIF_TAMANHO_ALVO) break;
  }
  const file = new File([menor], `${original.name.replace(/\.gif$/i, "")}-compactado.gif`, { type: "image/gif" });
  return {
    file,
    originalSize: original.size,
    size: file.size,
    reducao: Math.round((1 - file.size / original.size) * 100),
    atingiuAlvo: file.size <= GIF_TAMANHO_ALVO,
  };
}
