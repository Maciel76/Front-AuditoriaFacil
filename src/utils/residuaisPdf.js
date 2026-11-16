import { jsPDF } from "jspdf";
import { h, nextTick, render } from "vue";
import { QrcodeCanvas } from "qrcode.vue";

const numero = (valor) => Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const texto = (valor) => String(valor || "").replace(/[\r\n\t]+/g, " ").trim();
const tipos = { ETIQUETA: "Etiqueta", PRESENCA: "Presença", RUPTURA: "Ruptura" };

/** PDF em A4, com o código original no QR e quantidades separadas para conferência. */
export async function gerarPdfResiduais({ loja, auditoria, items, resumo }) {
  if (!auditoria) throw new Error("Nenhuma auditoria concluída disponível para gerar o PDF de residuais");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const data = new Date(auditoria.data).toLocaleDateString("pt-BR", { timeZone: "UTC" });
  const nomeLoja = texto(loja?.nome) || "Loja";
  const host = document.createElement("div");
  const margem = 10;
  const largura = 93.5;
  const altura = 36;
  const inicio = 38;
  const porPagina = 12;

  function linhas(valor, maxWidth, limite) {
    const partes = doc.splitTextToSize(texto(valor), maxWidth);
    if (partes.length <= limite) return partes;
    const result = partes.slice(0, limite);
    result[limite - 1] = result[limite - 1].replace(/\s*\S*$/, "") + "...";
    return result;
  }
  function cabecalho() {
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Residuais para conferência", margem, 15);
    doc.setFontSize(10);
    doc.text(linhas(nomeLoja, 190, 1), margem, 21);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${data} - ${tipos[auditoria.tipo] || auditoria.tipo} - ${items.length} produto(s)`, margem, 26);
    doc.text("Mais de 10 dias sem venda; estoque maior que 0 e menor que 10.", margem, 30);
    doc.text("Exclui bazar, cigarro, whisky e vinho. Estoque conforme a auditoria de referência.", margem, 34);
  }

  doc.setProperties({ title: `Residuais - ${nomeLoja} - ${data}`, subject: "Produtos residuais para conferência com coletor", creator: "Flashrub" });
  cabecalho();
  try {
    for (let index = 0; index < items.length; index++) {
      if (index && index % porPagina === 0) { doc.addPage(); cabecalho(); }
      const item = items[index];
      const posicao = index % porPagina;
      const x = margem + (posicao % 2) * (largura + 3);
      const y = inicio + Math.floor(posicao / 2) * (altura + 3);
      doc.setDrawColor(190, 196, 205);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, y, largura, altura, 1, 1);

      render(h(QrcodeCanvas, { value: String(item.codigo), size: 300, margin: 4, level: "M", background: "#ffffff", foreground: "#000000" }), host);
      await nextTick();
      const canvas = host.querySelector("canvas");
      if (!canvas) throw new Error(`Não foi possível gerar o QR code do produto ${item.codigo}`);
      doc.addImage(canvas.toDataURL("image/png"), "PNG", x + 1, y + 3, 25, 25, `qr-${index}`);

      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(linhas(item.codigo, largura - 46, 2), x + 28, y + 6);
      doc.setFillColor(242, 244, 247);
      doc.roundedRect(x + largura - 17, y + 2, 15, 12, 1, 1, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("Qtd.", x + largura - 9.5, y + 6, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(numero(item.estoqueAtual), x + largura - 9.5, y + 11.5, { align: "center", maxWidth: 13 });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(linhas(item.produto || "Produto sem descrição", largura - 31, 3), x + 28, y + 18, { lineHeightFactor: 1.2 });
      doc.setFontSize(7);
      doc.setTextColor(70, 80, 95);
      doc.text(linhas(`${item.local || "Sem corredor"} - ${numero(item.diasSemVenda)} dias sem venda`, largura - 31, 1), x + 28, y + 32);
      // Permite ao navegador atualizar o andamento em listas extensas.
      if (index && index % porPagina === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (!items.length) {
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text("Nenhum produto atende aos critérios dos residuais nesta auditoria.", margem, 48, { maxWidth: 185 });
      if (resumo?.semDados) {
        doc.setFontSize(9);
        doc.text(`${numero(resumo.semDados)} produto(s) ficaram fora da lista por falta de estoque ou dias sem venda informados.`, margem, 62, { maxWidth: 185 });
      }
    }
    const paginas = doc.getNumberOfPages();
    for (let pagina = 1; pagina <= paginas; pagina++) {
      doc.setPage(pagina);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(70, 80, 95);
      doc.text("QR code: somente o código do produto. Imprimir em A4, escala 100%.", margem, 286);
      doc.text(`Página ${pagina} de ${paginas}`, 200, 286, { align: "right" });
    }
    const dia = new Date(auditoria.data).toISOString().slice(0, 10);
    const slug = nomeLoja.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "loja";
    return { blob: doc.output("blob"), nomeArquivo: `residuais-${slug}-${dia}.pdf`, auditoriaId: String(auditoria._id), paginas };
  } finally {
    render(null, host);
  }
}
