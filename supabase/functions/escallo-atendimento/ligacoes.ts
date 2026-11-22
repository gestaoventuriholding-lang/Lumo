// Ellos: lista as ligações RECEBIDAS e atendidas por um agente em um dia, juntando dois relatórios da Escallo.
//  - rel001 (chamadas de fila): hora, fila, duração e o identificador da gravação (uniqueid). Não diz quem atendeu.
//  - rel002 (ligações): diz qual agente participou de cada ligação (codigoAgenteDestino) e liga ao rel001 pelo uniqueid.
// Lógica pura (sem rede e sem token), testada em client/src/lib/atendimentoLigacoes.test.tsx.
// Nada aqui guarda telefone, nome ou áudio: só hora, fila, duração e o identificador da gravação.

export const UNIQUEID_LIGACAO = /^\d{6,15}\.\d{1,8}$/;
export const LIMITE_LIGACOES = 300;

export interface LigacaoDaLista {
  uniqueid: string;
  /** "AAAA-MM-DD HH:MM:SS" */
  inicio: string;
  fila: string;
  segundos: number;
}

type Linha = Record<string, unknown>;
const texto = (v: unknown) => String(v ?? "").trim();

/** Ligações atendidas pelo agente `codigo` no dia, da mais antiga para a mais nova */
export function listarLigacoesDoAgente(rel001: Linha[], rel002: Linha[], codigo: string): LigacaoDaLista[] {
  // identificador (da ligação ou da ligação principal) -> códigos dos agentes que participaram
  const agentesPorLigacao = new Map<string, Set<string>>();
  for (const l of rel002) {
    const cod = texto(l["ligacao.codigoAgenteDestino"]);
    if (!cod) continue;
    for (const chave of [texto(l["ligacao.uniqueid"]), texto(l["ligacao.primaryUniqueid"])]) {
      if (!chave) continue;
      const conjunto = agentesPorLigacao.get(chave) ?? new Set<string>();
      conjunto.add(cod);
      agentesPorLigacao.set(chave, conjunto);
    }
  }

  const achadas: LigacaoDaLista[] = [];
  const vistos = new Set<string>();
  for (const q of rel001) {
    if (texto(q["filaAtendimentoLigacao.statusFormatado"]) !== "Atendida") continue;
    const uniqueid = texto(q["filaAtendimentoLigacao.uniqueid"]);
    if (!UNIQUEID_LIGACAO.test(uniqueid) || vistos.has(uniqueid)) continue;
    const agentes = agentesPorLigacao.get(uniqueid) ?? agentesPorLigacao.get(texto(q["filaAtendimentoLigacao.primaryUniqueid"]));
    if (!agentes?.has(codigo)) continue;
    vistos.add(uniqueid);
    achadas.push({
      uniqueid,
      inicio: texto(q["filaAtendimentoLigacao.dataHoraInicial"]),
      fila: texto(q["telefoniaFilaAtendimento.nome"]).slice(0, 60),
      segundos: Number(q["filaAtendimentoLigacao.tempoAtendimento"]) || 0,
    });
  }
  achadas.sort((a, b) => a.inicio.localeCompare(b.inicio));
  return achadas.slice(0, LIMITE_LIGACOES);
}
