// Ellos: regras do relatório rel090 da Escallo (produtividade por agente no WhatsApp), sem rede e sem banco.
// Mesmo mapeamento das planilhas REL090 já importadas. Só usa sintaxe que o Deno, o Node e o TypeScript entendem.
import { numero, ORIGEM, type RegistroEscallo } from "./mapeamento.ts";

export const CANAL_WHATSAPP = "WhatsApp";
export const CODIGO_RELATORIO_WHATSAPP = "REL090";

/** Campos que ficam vazios quando o login do dia passa do limite (os mesmos nos dois canais) */
export const CAMPOS_DEPENDENTES_DO_LOGIN = [
  "login_seconds", "pause_seconds", "pause_percent", "pause_legal_seconds", "pause_productive_seconds",
  "pause_unproductive_seconds", "occupancy_to1", "occupancy_to2", "occupancy_to3", "occupancy_to4", "per_hour",
] as const;

/** Linha de public.productivity_reports de um canal, antes de ligar ao colaborador */
export interface LinhaProdutividade {
  period_start: string;
  period_end: string;
  channel: string;
  inbound_count: number;
  outbound_count: number;
  attendances_count: number;
  talk_seconds: number;
  tma_seconds: number;
  login_seconds: number | null;
  pause_seconds: number | null;
  pause_percent: number | null;
  pause_legal_seconds: number | null;
  pause_productive_seconds: number | null;
  pause_unproductive_seconds: number | null;
  occupancy_to1: number | null;
  occupancy_to2: number | null;
  occupancy_to3: number | null;
  occupancy_to4: number | null;
  per_hour: number | null;
  report_code: string;
  source_file: string;
}

const n0 = (v: unknown) => numero(v) ?? 0;
const arredondar = (n: number, casas = 2) => {
  const f = 10 ** casas;
  return Math.round(n * f) / f;
};

/** Código do agente no rel090. A linha "_media" não tem código numérico: devolve null e é ignorada. */
export function codigoAgente090(r: RegistroEscallo): number | null {
  const c = numero(r.codigo);
  return c !== null && Number.isInteger(c) && c >= 0 ? c : null;
}

/** rel090 → linha de WhatsApp. Login e pausa são do agente (iguais nos dois canais). */
export function converterRegistro090(r: RegistroEscallo, dia: string): LinhaProdutividade {
  const entrada = Math.round(n0(r.atendimentosEntrada));
  const saida = Math.round(n0(r.atendimentosSaida));
  return {
    period_start: dia,
    period_end: dia,
    channel: CANAL_WHATSAPP,
    inbound_count: entrada,
    outbound_count: saida,
    attendances_count: entrada + saida,
    talk_seconds: Math.round(n0(r.atendimentosTempo)),
    tma_seconds: Math.round(n0(r.TMA)),
    login_seconds: Math.round(n0(r.login)),
    pause_seconds: Math.round(n0(r.pausa)),
    pause_percent: arredondar(n0(r.percentualPausa)),
    pause_legal_seconds: Math.round(n0(r.pausaLegal)),
    pause_productive_seconds: Math.round(n0(r.pausaProdutiva)),
    pause_unproductive_seconds: Math.round(n0(r.pausaImprodutiva)),
    occupancy_to1: arredondar(n0(r.TO01)),
    occupancy_to2: arredondar(n0(r.TO02)),
    // TO3 e TO4 dependem da jornada configurada na Escallo: ficam vazios
    occupancy_to3: null,
    occupancy_to4: null,
    per_hour: arredondar(n0(r.atendimentoHora)),
    report_code: CODIGO_RELATORIO_WHATSAPP,
    source_file: ORIGEM,
  };
}

/** Copia da linha sem os campos que dependem do tempo logado */
export function esvaziarLogin<T extends LinhaProdutividade>(linha: T): T {
  const copia = { ...linha } as Record<string, unknown>;
  for (const campo of CAMPOS_DEPENDENTES_DO_LOGIN) copia[campo] = null;
  return copia as T;
}

export function mediaMinutos(tmaSegundos: number): number {
  return arredondar(tmaSegundos / 60);
}
