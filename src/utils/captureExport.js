import { nextTick } from 'vue';
import html2canvas from 'html2canvas';

/**
 * Espera dois quadros de renderização, ou o prazo, o que vier primeiro.
 *
 * Os dois quadros deixam o layout assentar antes do print; o prazo é a saída
 * para a aba em segundo plano, onde `requestAnimationFrame` não dispara.
 */
function esperarQuadrosOuPrazo(prazoMs = 400) {
  return new Promise((resolve) => {
    let concluido = false;
    const concluir = () => {
      if (concluido) return;
      concluido = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(concluir, prazoMs);
    requestAnimationFrame(() => requestAnimationFrame(concluir));
  });
}

export async function esperarCapturaEstavel() {
  await nextTick();
  // Aba em segundo plano não executa requestAnimationFrame. Sem o prazo
  // máximo, uma captura disparada enquanto o usuário troca de aba (upload de
  // planilha, por exemplo) ficaria esperando para sempre.
  await esperarQuadrosOuPrazo();
}

function sincronizarCamposDeFormulario(originalRoot, clonedRoot) {
  const originalFields = originalRoot.querySelectorAll('input, select, textarea');
  const clonedFields = clonedRoot.querySelectorAll('input, select, textarea');

  originalFields.forEach((field, index) => {
    const clonedField = clonedFields[index];
    if (!clonedField) return;

    clonedField.value = field.value;
    if ('checked' in field) clonedField.checked = field.checked;
  });
}

function copiarCanvases(originalRoot, clonedRoot) {
  const originalCanvases = originalRoot.querySelectorAll('canvas');
  const clonedCanvases = clonedRoot.querySelectorAll('canvas');

  originalCanvases.forEach((canvas, index) => {
    const clonedCanvas = clonedCanvases[index];
    if (!clonedCanvas) return;

    clonedCanvas.width = canvas.width;
    clonedCanvas.height = canvas.height;
    clonedCanvas.style.width = `${canvas.clientWidth}px`;
    clonedCanvas.style.height = `${canvas.clientHeight}px`;

    const context = clonedCanvas.getContext('2d');
    if (context) context.drawImage(canvas, 0, 0);
  });
}

/*
 * ── Cores modernas x html2canvas ──────────────────────────────────────────
 *
 * O projeto usa `color-mix()` em quase 90 regras. O Chrome resolve isso, no
 * estilo computado, para `color(srgb r g b / a)` — sintaxe do CSS Color 4 que
 * o html2canvas 1.4.1 não sabe ler: ele lança "unsupported color function" e a
 * captura inteira morre. (Localmente pode passar: navegador antigo ainda
 * devolve `rgba()`.)
 *
 * A saída é reescrever, no clone, toda cor computada que use função moderna
 * como `rgba()` comum. O clone é o que o html2canvas fotografa; o estilo
 * inline vence as regras da folha, então a aparência não muda.
 */
const REGEX_COR_MODERNA = /\b(?:color|oklch|oklab|lch|lab|hwb)\(\s*[^()]*\)/gi;

const PROPRIEDADES_DE_COR = [
  'color',
  'background-color',
  'background-image',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'box-shadow',
  'text-decoration-color',
  'caret-color',
  'column-rule-color',
  'fill',
  'stroke',
  '-webkit-text-fill-color',
];

function temCorModerna(valor) {
  return !!valor && /\b(?:color|oklch|oklab|lch|lab|hwb)\(/i.test(valor);
}

function componenteParaByte(token) {
  if (!token || token === 'none') return 0;
  const numero = token.endsWith('%') ? parseFloat(token) / 100 : parseFloat(token);
  if (Number.isNaN(numero)) return 0;
  // display-p3 e afins produzem valores fora do intervalo ao virar sRGB.
  return Math.round(Math.min(1, Math.max(0, numero)) * 255);
}

function alfaParaNumero(token) {
  if (!token || token === 'none') return 1;
  const numero = token.endsWith('%') ? parseFloat(token) / 100 : parseFloat(token);
  if (Number.isNaN(numero)) return 1;
  return Math.min(1, Math.max(0, numero));
}

/**
 * Força qualquer função de cor moderna a virar `color(srgb ...)`.
 *
 * Um `color-mix` de 100% com transparente a 0% não muda a cor, mas obriga o
 * navegador a devolvê-la no espaço sRGB — é como oklch, lab e display-p3
 * chegam a um formato que dá para converter.
 */
function forcarSrgb(valor, sonda) {
  if (!sonda) return null;
  try {
    sonda.style.color = '';
    sonda.style.color = `color-mix(in srgb, ${valor} 100%, transparent 0%)`;
    const computado = getComputedStyle(sonda).color;
    return computado && computado !== valor ? computado : null;
  } catch {
    return null;
  }
}

function converterCorModerna(valor, sonda) {
  let srgb = valor;

  if (!/^color\(\s*srgb\s/i.test(srgb)) {
    srgb = forcarSrgb(valor, sonda);
    if (!srgb) return valor;
  }

  const conteudo = srgb.match(/^color\(\s*srgb\s+([^)]*)\)$/i)?.[1];
  if (!conteudo) return valor;

  const [canais, alfa] = conteudo.split('/');
  const partes = canais.trim().split(/\s+/);
  if (partes.length < 3) return valor;

  const [r, g, b] = partes.map(componenteParaByte);
  return `rgba(${r}, ${g}, ${b}, ${alfaParaNumero((alfa || '').trim())})`;
}

function normalizarValorDeCor(valor, sonda) {
  return valor.replace(REGEX_COR_MODERNA, (trecho) =>
    converterCorModerna(trecho, sonda),
  );
}

/** Reescreve as funções de cor modernas do próprio atributo `style`. */
function normalizarEstiloInline(elemento, sonda) {
  if (!(elemento instanceof HTMLElement)) return;
  for (const propriedade of PROPRIEDADES_DE_COR) {
    const valor = elemento.style.getPropertyValue(propriedade);
    if (!temCorModerna(valor)) continue;
    elemento.style.setProperty(propriedade, normalizarValorDeCor(valor, sonda));
  }
}

/**
 * Copia as cores do original para o clone já convertidas.
 *
 * Lê o estilo COMPUTADO do original (que está no documento e portanto tem as
 * variáveis resolvidas) e grava inline no clone. Precisa rodar antes de
 * qualquer remoção de nó no clone: o pareamento é por índice, como nos demais
 * ajudantes daqui.
 */
export function normalizarCoresParaCaptura(raizOriginal, raizClone) {
  if (!raizOriginal || !raizClone) return;

  const sonda = document.createElement('div');
  sonda.style.position = 'absolute';
  sonda.style.left = '-99999px';
  document.body.appendChild(sonda);

  try {
    const originais = [raizOriginal, ...raizOriginal.querySelectorAll('*')];
    const clones = [raizClone, ...raizClone.querySelectorAll('*')];

    originais.forEach((original, indice) => {
      const clone = clones[indice];
      if (!clone || !(clone instanceof HTMLElement)) return;

      const estilo = getComputedStyle(original);
      for (const propriedade of PROPRIEDADES_DE_COR) {
        const valor = estilo.getPropertyValue(propriedade);
        if (!temCorModerna(valor)) continue;
        clone.style.setProperty(
          propriedade,
          normalizarValorDeCor(valor, sonda),
        );
      }
    });
  } finally {
    sonda.remove();
  }
}

/** Versão para um elemento solto (ex.: o container temporário da captura). */
export function normalizarCoresDoElemento(elemento) {
  const sonda = document.createElement('div');
  sonda.style.position = 'absolute';
  sonda.style.left = '-99999px';
  document.body.appendChild(sonda);
  try {
    normalizarEstiloInline(elemento, sonda);
  } finally {
    sonda.remove();
  }
}

function limparEstadosTransitorios(clonedRoot, { buttonSelector, classesParaRemover = [] } = {}) {
  clonedRoot.querySelectorAll('*').forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.style.animation = 'none';
    node.style.transition = 'none';
    node.style.caretColor = 'transparent';
  });

  classesParaRemover.forEach((className) => {
    clonedRoot.querySelectorAll(`.${className}`).forEach((node) => node.classList.remove(className));
  });

  if (buttonSelector) {
    clonedRoot.querySelectorAll(buttonSelector).forEach((button) => {
      button.removeAttribute('disabled');
      button.setAttribute('aria-busy', 'false');
    });
  }
}

function normalizarFundosSemAreaUtil(clonedRoot) {
  clonedRoot.querySelectorAll('*').forEach((node) => {
    if (!(node instanceof HTMLElement)) return;

    const rect = node.getBoundingClientRect();
    const styles = getComputedStyle(node);
    const semArea = rect.width <= 0 || rect.height <= 0;
    const areaSubpixel = rect.width < 1 || rect.height < 1;
    const possuiFundoComplexo = styles.backgroundImage && styles.backgroundImage !== 'none';

    if (semArea && possuiFundoComplexo) {
      node.style.backgroundImage = 'none';
      return;
    }

    if (areaSubpixel && possuiFundoComplexo) {
      if (rect.width > 0 && rect.width < 1) node.style.minWidth = '1px';
      if (rect.height > 0 && rect.height < 1) node.style.minHeight = '1px';
    }
  });
}

function aplicarTemaAtualNoClone(container) {
  const temaAtual = document.documentElement.getAttribute('data-theme') || 'dark';
  const rootStyles = getComputedStyle(document.documentElement);
  const bodyStyles = getComputedStyle(document.body);
  const themeVars = [
    '--bg-0',
    '--bg-1',
    '--bg-2',
    '--bg-3',
    '--surface',
    '--surface-strong',
    '--border',
    '--border-strong',
    '--text',
    '--text-dim',
    '--text-mute',
    '--primary',
    '--primary-2',
    '--accent',
    '--success',
    '--warning',
    '--danger',
    '--grad-primary',
    '--grad-warm',
    '--grad-success',
    '--grad-card',
    '--radius-sm',
    '--radius',
    '--radius-lg',
    '--shadow-sm',
    '--shadow',
    '--shadow-lg',
  ];

  container.setAttribute('data-theme', temaAtual);

  themeVars.forEach((name) => {
    const value = rootStyles.getPropertyValue(name).trim();
    if (value) container.style.setProperty(name, value);
  });

  container.style.color = rootStyles.getPropertyValue('--text').trim() || bodyStyles.color;
  container.style.backgroundColor = rootStyles.getPropertyValue('--bg-0').trim() || bodyStyles.backgroundColor || '#ffffff';
  container.style.backgroundImage = bodyStyles.backgroundImage !== 'none' ? bodyStyles.backgroundImage : 'none';
  container.style.backgroundPosition = bodyStyles.backgroundPosition;
  container.style.backgroundSize = bodyStyles.backgroundSize;
  container.style.backgroundRepeat = bodyStyles.backgroundRepeat;
}

export function slugArquivo(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Converte um canvas em Blob PNG.
 *
 * `canvas.toBlob` é assíncrono e sem Promise nativa; embrulhar aqui evita
 * repetir o callback em cada tela que compartilha imagem.
 */
export function canvasParaBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem'))),
      'image/png',
    );
  });
}

/**
 * Captura uma área da tela como PNG.
 *
 * Com `retornarBlob` a imagem volta como Blob em vez de virar download — é o
 * que o compartilhamento automático usa para mandar o painel ao WhatsApp sem
 * passar pela pasta de downloads do usuário.
 */
export async function exportarAreaComoImagem({
  target,
  filename,
  buttonSelector,
  classesParaRemover = [],
  retornarBlob = false,
} = {}) {
  if (!target) return null;

  let tempContainer = null;

  try {
    await esperarCapturaEstavel();

    const targetRect = target.getBoundingClientRect();
    const rootStyles = getComputedStyle(document.documentElement);

    tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-20000px';
    tempContainer.style.top = '0';
    tempContainer.style.width = `${Math.ceil(targetRect.width)}px`;
    tempContainer.style.maxWidth = 'none';
    tempContainer.style.padding = '0';
    tempContainer.style.margin = '0';
    tempContainer.style.boxSizing = 'border-box';
    tempContainer.style.overflow = 'visible';
    aplicarTemaAtualNoClone(tempContainer);

    const clonedTarget = target.cloneNode(true);
    clonedTarget.style.width = '100%';
    clonedTarget.style.maxWidth = 'none';
    clonedTarget.style.overflow = 'visible';

    tempContainer.appendChild(clonedTarget);
    document.body.appendChild(tempContainer);

    sincronizarCamposDeFormulario(target, clonedTarget);
    copiarCanvases(target, clonedTarget);
    normalizarCoresParaCaptura(target, clonedTarget);
    normalizarCoresDoElemento(tempContainer);
    limparEstadosTransitorios(clonedTarget, { buttonSelector, classesParaRemover });
    normalizarFundosSemAreaUtil(clonedTarget);
    await esperarCapturaEstavel();

    const canvas = await html2canvas(tempContainer, {
      backgroundColor: rootStyles.getPropertyValue('--bg-0').trim() || '#ffffff',
      useCORS: true,
      allowTaint: true,
      logging: false,
      imageTimeout: 15000,
      scale: Math.max(2, window.devicePixelRatio || 1),
      width: Math.ceil(tempContainer.scrollWidth),
      height: Math.ceil(tempContainer.scrollHeight),
      scrollX: 0,
      scrollY: 0,
    });

    if (retornarBlob) return canvasParaBlob(canvas);

    const link = document.createElement('a');
    link.download = filename || `captura-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    return null;
  } finally {
    if (tempContainer?.parentNode) tempContainer.parentNode.removeChild(tempContainer);
  }
}