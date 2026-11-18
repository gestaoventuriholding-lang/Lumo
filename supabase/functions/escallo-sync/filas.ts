// Ellos: totais por fila (Ligação, rel001) e tempo de espera do WhatsApp (rel091), sem rede e sem banco.
// Não guarda telefone, nome nem protocolo: só contagens e somas por dia, canal e área.
import type { RegistroEscallo } from "./mapeamento.ts";

/** As 3 opções de exame da URA + "outras". ("analises" guarda os exames laboratoriais; o nome vem do banco.) */
export type AreaFila = "analises" | "imagem" | "cardiologicos" | "outros";
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

/** Filas conhecidas, por grupo (nome sem acento, minúsculo). */
const FILAS_LABORATORIAIS = ["preparo ac", "resultados ac", "coleta domiciliar", "transbordo coleta domiciliar"];
const FILAS_IMAGEM = ["usg", "rm", "tc", "mmg / deo / rx", "resultados di"];
const FILAS_CARDIOLOGICOS = ["exames cardiologicos"];
/** Conhecidas e de "Outras" (não são de nenhuma das 3 opções de exame). Não geram aviso. */
const FILAS_OUTRAS = ["orcamento", "falar com atendente", "entrega de laudos", "clinicas parceiras"];

/**
 * Grupo da fila. "Recuperação Automática - X" segue o grupo de X.
 * Fila que não está em nenhuma lista vai para "outros" e `reconhecida` vem falso (a sincronização anota um aviso).
 */
export function classificarFila(nome: unknown): { area: AreaFila; reconhecida: boolean } {
  const n = limpar(nome).replace(/^recuperacao automatica\s*-\s*/, "");
  if (FILAS_LABORATORIAIS.includes(n)) return { area: "analises", reconhecida: true };
  if (FILAS_IMAGEM.includes(n)) return { area: "imagem", reconhecida: true };
  if (FILAS_CARDIOLOGICOS.includes(n)) return { area: "cardiologicos", reconhecida: true };
  if (FILAS_OUTRAS.includes(n)) return { area: "outros", reconhecida: true };
  return { area: "outros", reconhecida: false };
}

export const areaDaFila = (nome: unknown): AreaFila => classificarFila(nome).area;

const numero = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

type Situacao = "atendida" | "abandonada" | null;
function situacao(linha: Record<string, unknown>): Situacao {
  const formatado = limpar(linha["filaAtendimentoLigacao.statusFormatado"]);
  const status = numero(linha["filaAtendimentoLigacao.status"]);
  if (formatado.startsWith("atendid") || (formatado === "" && status === 1)) return "atendida";
  if (formatado.includes("abandon") || (formatado === "" && status === 2)) return "abandonada";
  return null;
}

/** rel001 (uma linha por chamada nas filas) → uma linha por área. Chaves planas com ponto, como `filaAtendimentoLigacao.status`. */
export function resumirLigacoes(dia: string, registros: RegistroEscallo[]): LinhaFila[] {
  const porArea = new Map<AreaFila, LinhaFila>();
  for (const r of registros) {
    const linha = r as Record<string, unknown>;
    const s = situacao(linha);
    if (!s) continue;
    const area = areaDaFila(linha["telefoniaFilaAtendimento.nome"]);
    const l = porArea.get(area) ?? { dia, canal: "Ligação" as const, area, atendidas: 0, abandonadas: 0, espera_total_segundos: 0 };
    if (s === "atendida") {
      l.atendidas += 1;
      l.espera_total_segundos += Math.max(0, numero(linha["filaAtendimentoLigacao.tempoEspera"]));
    } else {
      l.abandonadas += 1;
    }
    porArea.set(area, l);
  }
  return [...porArea.values()];
}

/** Nomes de fila com chamadas contadas que não estão em nenhuma lista conhecida (caem em "Outras"). Sem repetição. */
export function filasNaoReconhecidas(registros: RegistroEscallo[]): string[] {
  const nomes = new Map<string, string>();
  for (const r of registros) {
    const linha = r as Record<string, unknown>;
    if (!situacao(linha)) continue;
    const nome = String(linha["telefoniaFilaAtendimento.nome"] ?? "").trim();
    if (classificarFila(nome).reconhecida) continue;
    nomes.set(limpar(nome), nome || "(sem nome)");
  }
  return [...nomes.values()];
}

/** rel091 (WhatsApp por hora): TMEAT = tempo médio de espera até ser atendido. Soma ponderada pelos atendimentos de cada hora. */
export function resumirWhatsapp(dia: string, registros: RegistroEscallo[]): LinhaFila[] {
  let atendidas = 0;
  let espera = 0;
  // A Escallo põe a linha "Média" no fim, rotulada com uma hora que já existe (ex.: 21:00:00 com 58,92 atendimentos).
  // Vale a PRIMEIRA linha de cada hora; a repetida é a média e não entra.
  const vistas = new Set<string>();
  for (const r of registros) {
    const linha = r as Record<string, unknown>;
    const hora = String(linha.hora ?? "").trim();
    if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(hora) || vistas.has(hora)) continue;
    vistas.add(hora);
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
