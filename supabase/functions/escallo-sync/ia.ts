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

export const TAMANHO_PAGINA_IA = 100;

const assinatura = (r: RegistroEscallo): string => {
  const l = r as Record<string, unknown>;
  return [l.data, l.protocolo, l.acao, l.fTokensAcao, l.dataHoraInicial].map((x) => String(x ?? "")).join("|");
};

/**
 * Lê todas as linhas do rel103 de um dia, página a página. A Escallo se comporta de dois jeitos (conferido com dados reais):
 *  - consulta de VÁRIOS dias: devolve no máximo 100 linhas e a paginação (pagina=0, 1, 2…) funciona;
 *  - consulta de UM dia: devolve o dia inteiro (centenas de linhas) em toda página, ignorando a paginação.
 * Por isso: mais de 100 linhas na página = a API já mandou tudo; página igual à anterior = paginação ignorada, para.
 * Se passar de maxPaginas, falha de propósito (melhor ficar sem o dia do que gravar o total pela metade).
 */
export async function lerRel103Completo(buscarPagina: (pagina: number) => Promise<RegistroEscallo[]>, maxPaginas = 80): Promise<RegistroEscallo[]> {
  const todas: RegistroEscallo[] = [];
  let anterior = "";
  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const linhas = await buscarPagina(pagina);
    if (linhas.length === 0) return todas;
    const primeira = assinatura(linhas[0]);
    if (pagina > 0 && primeira === anterior) return todas; // repetiu: a API ignorou a paginação
    todas.push(...linhas);
    if (linhas.length !== TAMANHO_PAGINA_IA) return todas; // menos de 100 = última; mais de 100 = veio tudo de uma vez
    anterior = primeira;
  }
  throw new Error(`rel103: mais de ${maxPaginas} páginas, não li tudo`);
}
