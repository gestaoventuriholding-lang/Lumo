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

// ---- WhatsApp: conversas atendidas por um agente no dia (historicoMensagens) ----
// A Escallo não filtra por agente nesse relatório (o campo "agente" é aceito, mas ignorado): a função lê o dia inteiro,
// em páginas de 100, e aqui separamos os atendimentos do agente (código do agente = o mesmo do cadastro no Ellos).
export const PROTOCOLO_WHATSAPP = /^[A-Za-z0-9._-]{1,60}$/;

export interface ConversaDaLista {
  protocolo: string;
  /** "AAAA-MM-DD HH:MM:SS" */
  inicio: string;
  segundos: number;
  mensagens: number;
}

/** Conversas (uma por protocolo) em que o agente `codigo` atendeu, da mais antiga para a mais nova. Sem texto de mensagem. */
export function listarConversasDoAgente(registros: Linha[], codigo: string): ConversaDaLista[] {
  const achadas = new Map<string, ConversaDaLista>();
  for (const r of registros) {
    const atendimentos = Array.isArray(r.atendimentos) ? (r.atendimentos as Linha[]) : [];
    for (const a of atendimentos) {
      const ag = a.agente as { codigo?: unknown } | undefined;
      if (texto(ag?.codigo) !== codigo) continue;
      const protocolo = texto(a.protocolo);
      if (!PROTOCOLO_WHATSAPP.test(protocolo) || achadas.has(protocolo)) continue;
      const mensagens = Array.isArray(a.mensagens) ? a.mensagens.length : 0;
      if (mensagens === 0) continue; // atendimento sem nenhuma mensagem (ex.: transferido na hora): não há o que auditar
      achadas.set(protocolo, {
        protocolo,
        inicio: texto(a.dataHoraInicial),
        segundos: Number(a.tempoAtendimento) || 0,
        mensagens,
      });
    }
  }
  return [...achadas.values()].sort((x, y) => x.inicio.localeCompare(y.inicio)).slice(0, LIMITE_LIGACOES);
}

// ---- Triagem: quantas conversas o agente (gestão) recebeu e para quem passou ----
// Em cada conversa a Escallo lista os atendimentos em ordem. Se depois do atendimento do agente vem outro agente, a conversa foi transferida.
// Só contagens e nomes de agentes (equipe). Sem protocolo, sem texto, sem nome de paciente.
export interface DestinoTransferencia {
  codigo: string;
  nome: string;
  quantidade: number;
}
export interface ResumoTransferencias {
  /** conversas em que o agente participou */
  conversas: number;
  /** conversas que seguiram com outro agente depois dele */
  transferidas: number;
  /** conversas que terminaram com o próprio agente */
  semTransferencia: number;
  /** para quem foram (primeiro agente depois dele), do maior para o menor */
  destinos: DestinoTransferencia[];
}

export function resumirTransferencias(registros: Linha[], codigo: string): ResumoTransferencias {
  const destinos = new Map<string, DestinoTransferencia>();
  const vistas = new Set<string>();
  let conversas = 0;
  let transferidas = 0;
  for (const r of registros) {
    const atendimentos = Array.isArray(r.atendimentos) ? (r.atendimentos as Linha[]) : [];
    const codigoDe = (a: Linha) => texto((a.agente as { codigo?: unknown } | undefined)?.codigo);
    const i = atendimentos.findIndex((a) => codigoDe(a) === codigo);
    if (i < 0) continue;
    const protocolo = texto(atendimentos[i].protocolo);
    if (protocolo) {
      if (vistas.has(protocolo)) continue; // a mesma conversa pode vir em mais de uma página
      vistas.add(protocolo);
    }
    conversas += 1;
    const seguinte = atendimentos.slice(i + 1).find((a) => codigoDe(a) !== "" && codigoDe(a) !== codigo);
    if (!seguinte) continue;
    transferidas += 1;
    const cod = codigoDe(seguinte);
    const atual = destinos.get(cod) ?? { codigo: cod, nome: texto((seguinte.agente as { nome?: unknown }).nome).slice(0, 80), quantidade: 0 };
    atual.quantidade += 1;
    destinos.set(cod, atual);
  }
  return {
    conversas,
    transferidas,
    semTransferencia: conversas - transferidas,
    destinos: [...destinos.values()].sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR")),
  };
}
