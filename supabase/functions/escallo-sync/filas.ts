// Ellos: totais por fila (Ligação, rel001) e tempo de espera do WhatsApp (rel091), sem rede e sem banco.
// Não guarda telefone, nome nem protocolo: só contagens e somas por dia, canal e área.
import type { RegistroEscallo } from "./mapeamento.ts";

export type AreaFila = "analises" | "imagem" | "outros";
export interface LinhaFila {
  dia: string;
  canal: "Ligação" | "WhatsApp";
  area: AreaFila | "total";
  atendidas: number;
  abandonadas: number;
  /** Soma da espera (segundos) das atendidas: a média é soma ÷ atendidas */
  espera_total_segundos: number;
}

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
const limpar = (t: unknown) => semAcento(String(t ?? "")).toLowerCase().replace(/\s+/g, " ").trim();

/** Filas de Imagem e de Análises (nome sem acento, minúsculo). O resto (Orçamento, Falar com Atendente...) fica em "outros". */
const FILAS_IMAGEM = ["usg", "rm", "tc", "mmg / deo / rx", "resultados di", "entrega de laudos", "exames cardiologicos"];
const FILAS_ANALISES = ["preparo ac", "resultados ac", "coleta domiciliar"];

/** Área da fila. "Recuperação Automática - X" segue a área de X. Filas novas terminadas em AC ou DI entram na área certa. */
export function areaDaFila(nome: unknown): AreaFila {
  let n = limpar(nome).replace(/^recuperacao automatica\s*-\s*/, "");
  if (FILAS_IMAGEM.includes(n)) return "imagem";
  if (FILAS_ANALISES.includes(n)) return "analises";
  if (/(^|\s)di$/.test(n)) return "imagem";
  if (/(^|\s)ac$/.test(n)) return "analises";
  return "outros";
}

const numero = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** rel001 (uma linha por chamada nas filas) → uma linha por área. Chaves planas com ponto, como `filaAtendimentoLigacao.status`. */
export function resumirLigacoes(dia: string, registros: RegistroEscallo[]): LinhaFila[] {
  const porArea = new Map<AreaFila, LinhaFila>();
  for (const r of registros) {
    const linha = r as Record<string, unknown>;
    const formatado = limpar(linha["filaAtendimentoLigacao.statusFormatado"]);
    const status = numero(linha["filaAtendimentoLigacao.status"]);
    const atendida = formatado.startsWith("atendid") || (formatado === "" && status === 1);
    const abandonada = formatado.includes("abandon") || (formatado === "" && status === 2);
    if (!atendida && !abandonada) continue;
    const area = areaDaFila(linha["telefoniaFilaAtendimento.nome"]);
    const l = porArea.get(area) ?? { dia, canal: "Ligação" as const, area, atendidas: 0, abandonadas: 0, espera_total_segundos: 0 };
    if (atendida) {
      l.atendidas += 1;
      l.espera_total_segundos += Math.max(0, numero(linha["filaAtendimentoLigacao.tempoEspera"]));
    } else {
      l.abandonadas += 1;
    }
    porArea.set(area, l);
  }
  return [...porArea.values()];
}

/** rel091 (WhatsApp por hora): TMEAT = tempo médio de espera até ser atendido. Soma ponderada pelos atendimentos de cada hora. */
export function resumirWhatsapp(dia: string, registros: RegistroEscallo[]): LinhaFila[] {
  let atendidas = 0;
  let espera = 0;
  for (const r of registros) {
    const linha = r as Record<string, unknown>;
    // só as linhas de hora cheia (a última linha da Escallo é a "Média"/"Total")
    if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(String(linha.hora ?? "").trim())) continue;
    const n = Math.max(0, Math.round(numero(linha.atendimentos)));
    if (n === 0) continue;
    atendidas += n;
    espera += n * Math.max(0, numero(linha.TMEAT));
  }
  if (atendidas === 0) return [];
  return [{ dia, canal: "WhatsApp", area: "total", atendidas, abandonadas: 0, espera_total_segundos: Math.round(espera) }];
}

/** Linhas como vão para a tabela queue_daily */
export function paraTabela(linhas: LinhaFila[]) {
  return linhas.map((l) => ({
    date: l.dia,
    channel: l.canal,
    area: l.area,
    answered: l.atendidas,
    abandoned: l.abandonadas,
    wait_seconds_total: l.espera_total_segundos,
  }));
}
