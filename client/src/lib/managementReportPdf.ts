import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { goalPercentageTone, type ProductivityTrendPoint } from "@/lib/performanceMetrics";
import {
  managementReportFilename,
  type ManagementReportData,
  type ManagementReportRankingRow,
} from "@/lib/managementReport";
import { LEGENDA_META } from "@/lib/diasDaMeta";

type Cor = [number, number, number];

// Cores do tema azul do sistema (mesmos valores dos tokens claros em index.css); o PDF não lê o CSS.
const AZUL: Cor = [0, 86, 179];
const AZUL_MEDIO: Cor = [61, 128, 201];
const AZUL_CLARO: Cor = [184, 209, 240];
const AZUL_SUAVE: Cor = [234, 240, 249];
const FUNDO: Cor = [243, 246, 251];
const TEXTO: Cor = [11, 27, 51];
const TEXTO_SECUNDARIO: Cor = [75, 92, 120];
const TEXTO_FRACO: Cor = [138, 154, 180];
const BORDA: Cor = [220, 228, 239];
const BRANCO: Cor = [255, 255, 255];
const VERDE: Cor = [21, 128, 61];
const AMARELO: Cor = [138, 90, 0];
const VERMELHO: Cor = [198, 40, 40];
const CORES_CANAL: Record<"Ligação" | "WhatsApp", Cor> = { Ligação: [0, 0, 255], WhatsApp: [42, 157, 42] };

const MARGIN = 14;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

type JsPdfWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

const numero = (n: number) => n.toLocaleString("pt-BR");
const dataBr = (iso: string) => iso.split("-").reverse().join("/");
const percentual = (n: number) => (n > 0 ? `${Math.round(n)}%` : "-");

function corDaMeta(valor: number): Cor {
  const tom = goalPercentageTone(valor);
  if (tom === "green") return VERDE;
  if (tom === "yellow") return AMARELO;
  if (tom === "red") return VERMELHO;
  return TEXTO_SECUNDARIO;
}

function periodTypeLabel(period: ManagementReportData["period"]): string {
  if (period === "day") return "Dia";
  if (period === "week") return "Semana";
  return "Mês";
}

function formatGeneratedAt(date: Date): string {
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - MARGIN) {
    doc.addPage();
    return MARGIN + 4;
  }
  return y;
}

function drawSectionTitle(doc: jsPDF, y: number, title: string, marca: Cor = AZUL, reserva = 14): number {
  y = ensureSpace(doc, y, reserva);
  doc.setFillColor(...marca);
  doc.roundedRect(MARGIN, y - 4, 1.4, 5, 0.7, 0.7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...TEXTO);
  doc.text(title, MARGIN + 4, y);
  doc.setDrawColor(...BORDA);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y + 3, PAGE_WIDTH - MARGIN, y + 3);
  return y + 9;
}

function drawHeader(doc: jsPDF, data: ManagementReportData): number {
  doc.setFillColor(...AZUL);
  doc.rect(0, 0, PAGE_WIDTH, 30, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...BRANCO);
  doc.text("Ellos", MARGIN, 14);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Relatório Gerencial de Operação", MARGIN, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(data.dateRange.label, PAGE_WIDTH - MARGIN, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Gerado em ${formatGeneratedAt(data.generatedAt)}`, PAGE_WIDTH - MARGIN, 22, { align: "right" });

  let y = 37;
  doc.setFontSize(8);
  doc.setTextColor(...TEXTO_SECUNDARIO);
  const intervalo =
    data.dateRange.start === data.dateRange.end
      ? dataBr(data.dateRange.start)
      : `${dataBr(data.dateRange.start)} a ${dataBr(data.dateRange.end)}`;
  doc.text(`${periodTypeLabel(data.period)} · ${intervalo} · ${data.filtersLabel}`, MARGIN, y);

  y += 4;
  const cardW = (CONTENT_WIDTH - 8) / 3;
  const cards = [
    { label: "Atendimentos no período", value: numero(data.summary.totalAttendances) },
    { label: "Média da meta", value: percentual(data.summary.averagePercentage) },
    {
      label: "Colaboradores com registro",
      value: `${data.summary.attendantsWithRecords} de ${data.summary.totalAttendants}`,
    },
  ];

  cards.forEach((card, index) => {
    const x = MARGIN + index * (cardW + 4);
    doc.setFillColor(...FUNDO);
    doc.setDrawColor(...BORDA);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardW, 18, 2, 2, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXTO_SECUNDARIO);
    doc.text(card.label, x + 4, y + 6.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...AZUL);
    doc.text(card.value, x + 4, y + 14);
  });

  return y + 28;
}

const iniciais = (nome: string) => {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
};

/** Altura fixa de um pódio (título + três lugares): dois cabem na primeira página */
const ALTURA_PODIO = 100;

/** Pódio de um canal: 2º à esquerda, 1º no meio (mais alto) e 3º à direita */
function drawPodium(doc: jsPDF, y: number, channel: keyof typeof CORES_CANAL, rows: ManagementReportRankingRow[]): number {
  const topo = drawSectionTitle(doc, y, `Pódio ${channel}`, CORES_CANAL[channel]);
  const base = y + ALTURA_PODIO - 12;

  if (rows.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXTO_SECUNDARIO);
    doc.text("Nenhum atendimento neste canal no período.", MARGIN, topo + 4);
    return y + ALTURA_PODIO;
  }

  const gap = 4;
  const largura = (CONTENT_WIDTH - gap * 2) / 3;
  const lugares = [
    { posicao: 2, coluna: 0, degrau: 16, cor: AZUL_MEDIO, corTexto: BRANCO },
    { posicao: 1, coluna: 1, degrau: 24, cor: AZUL, corTexto: BRANCO },
    { posicao: 3, coluna: 2, degrau: 10, cor: AZUL_CLARO, corTexto: TEXTO },
  ];

  for (const lugar of lugares) {
    const row = rows[lugar.posicao - 1];
    if (!row) continue;
    const primeiro = lugar.posicao === 1;
    const x = MARGIN + lugar.coluna * (largura + gap);
    const meio = x + largura / 2;
    const topoDegrau = base - lugar.degrau;
    const alturaCartao = 48;
    const topoCartao = topoDegrau - alturaCartao;

    // cartão da pessoa, apoiado no degrau
    doc.setFillColor(...(primeiro ? AZUL_SUAVE : FUNDO));
    doc.setDrawColor(...(primeiro ? AZUL : BORDA));
    doc.setLineWidth(primeiro ? 0.6 : 0.3);
    doc.roundedRect(x, topoCartao, largura, alturaCartao, 2.5, 2.5, "FD");

    // círculo com as iniciais, metade para fora do cartão
    const raio = primeiro ? 8 : 7;
    doc.setFillColor(...lugar.cor);
    doc.setDrawColor(...BRANCO);
    doc.setLineWidth(1);
    doc.circle(meio, topoCartao, raio, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(primeiro ? 12 : 10.5);
    doc.setTextColor(...lugar.corTexto);
    doc.text(iniciais(row.name), meio, topoCartao + 0.3, { align: "center", baseline: "middle" });

    doc.setFontSize(primeiro ? 11 : 10);
    doc.setTextColor(...TEXTO);
    const linhasNome = (doc.splitTextToSize(row.name, largura - 6) as string[]).slice(0, 2);
    doc.text(linhasNome, meio, topoCartao + 15, { align: "center" });

    doc.setFontSize(primeiro ? 22 : 18);
    doc.setTextColor(...AZUL);
    doc.text(percentual(row.metaPercent), meio, topoCartao + 30, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...TEXTO_SECUNDARIO);
    doc.text("da meta", meio, topoCartao + 34, { align: "center" });

    doc.setFontSize(8.5);
    doc.setTextColor(...TEXTO);
    doc.text(`${numero(row.attendances)} atendimentos`, meio, topoCartao + 40, { align: "center" });
    doc.setTextColor(...TEXTO_SECUNDARIO);
    doc.text(`TMA ${row.averageTime}`, meio, topoCartao + 44.5, { align: "center" });

    doc.setFillColor(...lugar.cor);
    doc.rect(x, topoDegrau + 0.8, largura, lugar.degrau - 0.8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(primeiro ? 17 : 13);
    doc.setTextColor(...lugar.corTexto);
    doc.text(`${lugar.posicao}º`, meio, topoDegrau + lugar.degrau / 2 + 0.6, { align: "center", baseline: "middle" });
  }

  doc.setDrawColor(...TEXTO);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, base, PAGE_WIDTH - MARGIN, base);

  return y + ALTURA_PODIO;
}

/** Tabela com uma linha por colaborador: total do período, TMA e meta atingida */
function rankingTable(doc: jsPDF, y: number, channel: keyof typeof CORES_CANAL, rows: ManagementReportRankingRow[]): number {
  y = drawSectionTitle(doc, y, `Ranking ${channel} - total do período`, CORES_CANAL[channel], 36);

  if (rows.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXTO_SECUNDARIO);
    doc.text("Nenhum atendimento neste canal no período.", MARGIN, y);
    return y + 10;
  }

  const total = rows.reduce((soma, row) => soma + row.attendances, 0);
  autoTable(doc, {
    startY: y - 2,
    margin: { left: MARGIN, right: MARGIN },
    head: [["#", "Colaborador", "Atendimentos", "TMA", "% da meta"]],
    body: rows.map((row) => [
      String(row.position),
      row.name,
      numero(row.attendances),
      row.averageTime,
      percentual(row.metaPercent),
    ]),
    foot: [["", "Total do canal", numero(total), "", ""]],
    showFoot: "lastPage",
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: 2.6, textColor: TEXTO, lineColor: BORDA },
    headStyles: { fillColor: AZUL, textColor: BRANCO, fontStyle: "bold" },
    bodyStyles: { lineWidth: { bottom: 0.2 } },
    alternateRowStyles: { fillColor: FUNDO },
    footStyles: { fillColor: AZUL_SUAVE, textColor: TEXTO, fontStyle: "bold" },
    // larguras fixas: as tabelas dos dois canais ficam alinhadas
    columnStyles: { 0: { cellWidth: 12, halign: "center" }, 2: { cellWidth: 34 }, 3: { cellWidth: 28 }, 4: { cellWidth: 26 } },
    didParseCell: (hook) => {
      if (hook.column.index >= 2) hook.cell.styles.halign = "right";
      if (hook.section === "body" && hook.column.index === 4) {
        hook.cell.styles.textColor = corDaMeta(rows[hook.row.index].metaPercent);
        hook.cell.styles.fontStyle = "bold";
      }
    },
  });

  return (doc as JsPdfWithAutoTable).lastAutoTable.finalY + 12;
}

function qualityBlock(doc: jsPDF, y: number, quality: NonNullable<ManagementReportData["quality"]>, minScore: number): number {
  y = drawSectionTitle(doc, y, "Qualidade (auditorias de atendimento)", AZUL, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXTO);
  if (quality.totalAudits === 0) {
    doc.text("Nenhuma auditoria de atendimento no período.", MARGIN, y);
    return y + 12;
  }
  const media = quality.average !== undefined ? String(quality.average).replace(".", ",") : "-";
  doc.text(
    `Nota média: ${media} (mínima ${minScore}) | ${quality.totalAudits} auditoria(s) | ${quality.eliminated} eliminada(s) | ${quality.withoutAudit} colaborador(es) sem auditoria`,
    MARGIN,
    y
  );
  y += 6;
  if (quality.belowMin.length === 0) {
    doc.setTextColor(...VERDE);
    doc.text("Ninguém abaixo da nota mínima no período.", MARGIN, y);
    return y + 12;
  }
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Abaixo da nota mínima", "Nota média"]],
    body: quality.belowMin.map((x) => [x.attendant.name, String(x.average).replace(".", ",")]),
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: 2.6, textColor: TEXTO, lineColor: BORDA },
    headStyles: { fillColor: AZUL, textColor: BRANCO, fontStyle: "bold" },
    alternateRowStyles: { fillColor: FUNDO },
    didParseCell: (hook) => {
      if (hook.column.index === 1) {
        hook.cell.styles.halign = "right";
        if (hook.section === "body") hook.cell.styles.textColor = VERMELHO;
      }
    },
  });
  return (doc as JsPdfWithAutoTable).lastAutoTable.finalY + 12;
}

function drawTrendChart(
  doc: jsPDF,
  y: number,
  points: ProductivityTrendPoint[]
): number {
  const chartHeight = 52;
  const chartWidth = CONTENT_WIDTH;
  y = drawSectionTitle(doc, y, "Evolução da produtividade (% média da meta por dia)", AZUL, chartHeight + 16);
  doc.setFont("helvetica", "normal");

  if (points.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...TEXTO_SECUNDARIO);
    doc.text("Sem dados de evolução no período selecionado.", MARGIN, y);
    return y + 10;
  }

  const chartX = MARGIN;
  const chartY = y;
  const innerPad = { left: 12, right: 4, top: 6, bottom: 14 };
  const plotW = chartWidth - innerPad.left - innerPad.right;
  const plotH = chartHeight - innerPad.top - innerPad.bottom;
  const plotLeft = chartX + innerPad.left;
  const plotTop = chartY + innerPad.top;

  doc.setDrawColor(...BORDA);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(chartX, chartY, chartWidth, chartHeight, 2, 2, "FD");

  const yMax = 120;
  const yMin = 0;

  for (let tick = 0; tick <= 100; tick += 25) {
    const ratio = (tick - yMin) / (yMax - yMin);
    const lineY = plotTop + plotH - ratio * plotH;
    doc.setDrawColor(...AZUL_SUAVE);
    doc.setLineWidth(0.2);
    doc.line(plotLeft, lineY, plotLeft + plotW, lineY);
    doc.setFontSize(7);
    doc.setTextColor(...TEXTO_FRACO);
    doc.text(`${tick}%`, chartX + 2, lineY + 1);
  }

  const targetRatio = (100 - yMin) / (yMax - yMin);
  const targetY = plotTop + plotH - targetRatio * plotH;
  doc.setDrawColor(...VERDE);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(plotLeft, targetY, plotLeft + plotW, targetY);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(7);
  doc.setTextColor(...VERDE);
  doc.text("Meta 100%", plotLeft + plotW - 18, targetY - 2);

  const coords = points.map((point, index) => {
    const x =
      points.length === 1
        ? plotLeft + plotW / 2
        : plotLeft + (index / (points.length - 1)) * plotW;
    const clamped = Math.max(yMin, Math.min(yMax, point.productivity));
    const ratio = (clamped - yMin) / (yMax - yMin);
    const py = plotTop + plotH - ratio * plotH;
    return { x, y: py, label: point.label, value: point.productivity };
  });

  doc.setDrawColor(...AZUL);
  doc.setLineWidth(0.8);
  for (let i = 1; i < coords.length; i++) {
    doc.line(coords[i - 1].x, coords[i - 1].y, coords[i].x, coords[i].y);
  }

  coords.forEach((coord) => {
    doc.setFillColor(...AZUL);
    doc.circle(coord.x, coord.y, 1.2, "F");
  });

  doc.setFontSize(6.5);
  doc.setTextColor(...TEXTO_SECUNDARIO);
  const labelStep = points.length > 14 ? Math.ceil(points.length / 7) : 1;
  coords.forEach((coord, index) => {
    if (index % labelStep !== 0 && index !== coords.length - 1) return;
    doc.text(coord.label, coord.x, chartY + chartHeight - 3, { align: "center" });
  });

  doc.setFontSize(7);
  doc.setTextColor(...AZUL);
  doc.text("Produtividade média diária", plotLeft, chartY + 5);

  return chartY + chartHeight + 10;
}

function drawFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXTO_FRACO);
    doc.text(
      `Ellos · Relatório gerencial · Página ${page} de ${pageCount}`,
      PAGE_WIDTH / 2,
      pageHeight - 7,
      { align: "center" }
    );
  }
}

export function buildManagementReportPdf(data: ManagementReportData, minScore = 85): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  let y = drawHeader(doc, data);

  // WhatsApp em cima, Ligação embaixo
  const canais = (
    [
      { canal: "WhatsApp", rows: data.whatsappRanking },
      { canal: "Ligação", rows: data.ligacaoRanking },
    ] as const
  ).filter((c) => data.channelFilter === "both" || data.channelFilter === c.canal);

  for (const { canal, rows } of canais) y = drawPodium(doc, y, canal, rows);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXTO_SECUNDARIO);
  doc.text(`Pódio ordenado pela quantidade de atendimentos (empate: menor TMA). A % da meta é calculada ${LEGENDA_META}.`, MARGIN, y - 4);

  // a primeira página é só dos pódios; as tabelas começam na segunda
  doc.addPage();
  y = MARGIN + 6;

  for (const { canal, rows } of canais) y = rankingTable(doc, y, canal, rows);
  if (data.quality) y = qualityBlock(doc, y, data.quality, minScore);
  drawTrendChart(doc, y, data.productivityTrend);
  drawFooter(doc);

  return doc;
}

export function generateManagementReportPdf(data: ManagementReportData, minScore = 85): void {
  buildManagementReportPdf(data, minScore).save(managementReportFilename(data));
}

export async function generateManagementReportPdfAsync(
  data: ManagementReportData,
  minScore = 85
): Promise<void> {
  generateManagementReportPdf(data, minScore);
}
