import { nextTick } from 'vue';
import html2canvas from 'html2canvas';

export async function esperarCapturaEstavel() {
  await nextTick();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
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

export async function exportarAreaComoImagem({
  target,
  filename,
  buttonSelector,
  classesParaRemover = [],
} = {}) {
  if (!target) return;

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

    const link = document.createElement('a');
    link.download = filename || `captura-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } finally {
    if (tempContainer?.parentNode) tempContainer.parentNode.removeChild(tempContainer);
  }
}