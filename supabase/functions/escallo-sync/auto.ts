// Ellos: auto-atendimento do robô por dia (rel097 da Escallo, WhatsApp), sem rede e sem banco.
// Só contagens por dia: sem telefone, nome nem protocolo.
import type { RegistroEscallo } from "./mapeamento.ts";

export interface AutoDia {
  dia: string;
  contatos: number;
  /** Resolvidos pelo robô, sem atendente */
  auto_atendidos: number;
  /** Atendidos por pessoa */
  atendidos: number;
  sem_exito: number;
  com_erro: number;
}

const numero = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
};

/** rel097 (uma linha por canal de mídia social) → totais do dia. Sem contatos, não gera linha. */
export function resumirAutoAtendimento(dia: string, registros: RegistroEscallo[]): AutoDia | null {
  const t: AutoDia = { dia, contatos: 0, auto_atendidos: 0, atendidos: 0, sem_exito: 0, com_erro: 0 };
  for (const r of registros) {
    const l = r as Record<string, unknown>;
    t.contatos += numero(l.contatos);
    t.auto_atendidos += numero(l.autoAtendidos);
    t.atendidos += numero(l.atendidos);
    t.sem_exito += numero(l.finalizadosSemExito);
    t.com_erro += numero(l.finalizadosComErro);
  }
  return t.contatos > 0 ? t : null;
}

/** Linha como vai para a tabela auto_atendimento_diario */
export const autoParaTabela = (a: AutoDia) => ({
  date: a.dia,
  contacts: a.contatos,
  self_served: a.auto_atendidos,
  served: a.atendidos,
  no_success: a.sem_exito,
  errors: a.com_erro,
});
