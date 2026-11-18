// Ellos: consumo de FTokens da IA por dia (rel103 da Escallo), sem rede e sem banco.
// Só somas e contagens por dia: sem telefone, nome nem protocolo guardados.
import type { RegistroEscallo } from "./mapeamento.ts";

export interface ConsumoIADia {
  dia: string;
  /** Soma dos FTokens das ações (o "Total de FTokens" da Escallo) */
  ftokens: number;
  /** Contatos (protocolos) distintos com consumo */
  contatos: number;
  /** Ações de IA (linhas do extrato) */
  acoes: number;
}

const numero = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** rel103 (uma linha por ação de IA) → totais do dia. Sem ações, não gera linha. */
export function resumirConsumoIA(dia: string, registros: RegistroEscallo[]): ConsumoIADia | null {
  let ftokens = 0;
  let acoes = 0;
  const protocolos = new Set<string>();
  for (const r of registros) {
    const l = r as Record<string, unknown>;
    ftokens += Math.max(0, numero(l.fTokensAcao));
    acoes += 1;
    protocolos.add(String(l.protocolo ?? ""));
  }
  if (acoes === 0) return null;
  return { dia, ftokens: Math.round(ftokens * 100) / 100, contatos: protocolos.size, acoes };
}

/** Linha como vai para a tabela ia_consumo_diario */
export const iaParaTabela = (c: ConsumoIADia) => ({ date: c.dia, ftokens: c.ftokens, contacts: c.contatos, actions: c.acoes });
