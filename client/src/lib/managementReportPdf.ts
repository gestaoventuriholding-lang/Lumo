import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ProductivityTrendPoint } from "@/lib/performanceMetrics";
import {
  managementReportFilename,
  type ManagementReportBelowGoalRow,
  type ManagementReportData,
  type ManagementReportRankingRow,
} from "@/lib/managementReport";

const BRAND = { r: 37, g: 99, b: 235 };
const MARGIN = 14;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

type JsPdfWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

function periodTypeLabel(period: ManagementReportData["period"]): string {
  if (period === "day") return "Dia";
  if (period === "week") return "Semana";
  return "Mes";
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

function drawSectionTitle(doc: jsPDF, y: number, title: string): number {
  y = ensureSpace(doc, y, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(title, MARGIN, y);
  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y + 2, PAGE_WIDTH - MARGIN, y + 2);
  return y + 10;
}

function drawHeader(doc: jsPDF, data: ManagementReportData): number {
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, PAGE_WIDTH, 32, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("Elos", MARGIN, 14);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Relatorio Gerencial de Operacao", MARGIN, 22);

  doc.setFontSize(9);
  doc.text(`Gerado em ${formatGeneratedAt(data.generatedAt)}`, PAGE_WIDTH - MARGIN, 14, {
    align: "right",
  });

  let y = 42;
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Periodo analisado", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  y += 6;
  doc.text(data.dateRange.label, MARGIN, y);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  y += 5;
  doc.text(
    `${periodTypeLabel(data.period)} · ${data.dateRange.start} a ${data.dateRange.end}`,
    MARGIN,
    y
  );
  y += 5;
  doc.setFontSize(8);
  doc.text(data.filtersLabel, MARGIN, y);

  y += 10;
  const cardW = CONTENT_WIDTH / 3 - 2;
  const cards = [
    { label: "Atendimentos", value: String(data.summary.totalAttendances) },
    { label: "Media da meta", value: `${data.summary.averagePercentage}%` },
    {
      label: "Colaboradores c/ registro",
      value: `${data.summary.attendantsWithRecords}/${data.summary.totalAttendants}`,
    },
  ];

  cards.forEach((card, index) => {
    const x = MARGIN + index * (cardW + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardW, 18, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, x + 4, y + 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(card.value, x + 4, y + 14);
    doc.setFont("helvetica", "normal");
  });

  return y + 26;
}

function rankingTable(
  doc: jsPDF,
  y: number,
  title: string,
  rows: ManagementReportRankingRow[]
): number {
  y = drawSectionTitle(doc, y, title);

  if (rows.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Nenhum atendimento neste canal no periodo.", MARGIN, y);
    return y + 8;
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["#", "Colaborador", "Atend.", "TMA", "% Meta"]],
    body: rows.map((row) => [
      String(row.position),
      row.name,
      String(row.attendances),
      row.averageTime,
      `${row.metaPercent}%`,
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: {
      fillColor: [BRAND.r, BRAND.g, BRAND.b],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
  });

  return (doc as JsPdfWithAutoTable).lastAutoTable.finalY + 8;
}

function belowGoalTable(doc: jsPDF, y: number, rows: ManagementReportBelowGoalRow[]): number {
  y = drawSectionTitle(doc, y, "Colaboradores abaixo da meta");

  if (rows.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(22, 163, 74);
    doc.text("Todos os colaboradores atingiram a meta no periodo.", MARGIN, y);
    return y + 8;
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Colaborador", "Canal", "Meta", "Realizado", "% Meta", "Diferenca"]],
    body: rows.map((row) => [
      row.name,
      row.channel,
      String(row.target),
      String(row.produced),
      `${row.percentage}%`,
      row.difference > 0 ? `+${row.difference}` : String(row.difference),
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: {
      fillColor: [220, 38, 38],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [254, 242, 242] },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
    didParseCell: (hook) => {
      if (hook.section === "body" && hook.column.index === 4) {
        const row = rows[hook.row.index];
        if (row.alertLevel === "red") {
          hook.cell.styles.textColor = [220, 38, 38];
        } else {
          hook.cell.styles.textColor = [217, 119, 6];
        }
      }
    },
  });

  return (doc as JsPdfWithAutoTable).lastAutoTable.finalY + 8;
}

function drawTrendChart(
  doc: jsPDF,
  y: number,
  points: ProductivityTrendPoint[]
): number {
  y = drawSectionTitle(doc, y, "Evolucao da produtividade (% media da meta)");

  const chartHeight = 52;
  const chartWidth = CONTENT_WIDTH;
  y = ensureSpace(doc, y, chartHeight + 16);

  if (points.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Sem dados de evolucao no periodo selecionado.", MARGIN, y);
    return y + 10;
  }

  const chartX = MARGIN;
  const chartY = y;
  const innerPad = { left: 12, right: 4, top: 6, bottom: 14 };
  const plotW = chartWidth - innerPad.left - innerPad.right;
  const plotH = chartHeight - innerPad.top - innerPad.bottom;
  const plotLeft = chartX + innerPad.left;
  const plotTop = chartY + innerPad.top;

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(chartX, chartY, chartWidth, chartHeight, 2, 2, "FD");

  const yMax = 120;
  const yMin = 0;

  for (let tick = 0; tick <= 100; tick += 25) {
    const ratio = (tick - yMin) / (yMax - yMin);
    const lineY = plotTop + plotH - ratio * plotH;
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(plotLeft, lineY, plotLeft + plotW, lineY);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`${tick}%`, chartX + 2, lineY + 1);
  }

  const targetRatio = (100 - yMin) / (yMax - yMin);
  const targetY = plotTop + plotH - targetRatio * plotH;
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(plotLeft, targetY, plotLeft + plotW, targetY);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(7);
  doc.setTextColor(22, 163, 74);
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

  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setLineWidth(0.8);
  for (let i = 1; i < coords.length; i++) {
    doc.line(coords[i - 1].x, coords[i - 1].y, coords[i].x, coords[i].y);
  }

  coords.forEach((coord) => {
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
    doc.circle(coord.x, coord.y, 1.2, "F");
  });

  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  const labelStep = points.length > 14 ? Math.ceil(points.length / 7) : 1;
  coords.forEach((coord, index) => {
    if (index % labelStep !== 0 && index !== coords.length - 1) return;
    doc.text(coord.label, coord.x, chartY + chartHeight - 3, { align: "center" });
  });

  doc.setFontSize(7);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text("Produtividade media diaria", plotLeft, chartY + 5);

  return chartY + chartHeight + 10;
}

function drawFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Elos · Relatorio gerencial · Pagina ${page} de ${pageCount}`,
      PAGE_WIDTH / 2,
      pageHeight - 8,
      { align: "center" }
    );
  }
}

export function generateManagementReportPdf(data: ManagementReportData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  let y = drawHeader(doc, data);

  if (data.channelFilter === "both" || data.channelFilter === "Ligação") {
    y = rankingTable(doc, y, "Ranking Ligação", data.ligacaoRanking);
  }
  if (data.channelFilter === "both" || data.channelFilter === "WhatsApp") {
    y = rankingTable(doc, y, "Ranking WhatsApp", data.whatsappRanking);
  }

  y = belowGoalTable(doc, y, data.belowGoal);
  drawTrendChart(doc, y, data.productivityTrend);
  drawFooter(doc);

  doc.save(managementReportFilename(data));
}

export async function generateManagementReportPdfAsync(
  data: ManagementReportData
): Promise<void> {
  generateManagementReportPdf(data);
}
