// Ellos: regras da tela de vínculo entre os agentes da Escallo e os colaboradores. Sem rede e sem tela.
// Ninguém é vinculado aqui: estas funções só organizam a lista e validam o que a pessoa vai confirmar.
import type { Attendant, AttendantServiceChannel } from "@/types/attendant";
import { isValidJornada } from "@/lib/attendantSchedule";
import { getSupabase } from "@/lib/supabase";

/** Registro que a função escallo-rel025 devolve em `sobras` (só os campos que a tela usa). */
export interface SobraEscallo {
  codigo: number | null;
  nome: string;
  motivo: "sem_vinculo" | "revisar";
  detalhe: string;
  sugestao: { id: number; nome: string } | null;
}

export interface RespostaEscallo {
  dia: string;
  migracaoPendente: boolean;
  escallo: { registros: number };
  resumo: { vinculados: number; semVinculo: number; paraRevisar: number; comSugestaoPorNome: number };
  sobras: SobraEscallo[];
  /** Quem a função já ligou a um colaborador neste dia (só os campos que a tela usa). Pode faltar em respostas antigas. */
  vinculados?: { attendantId: number; escalloCodigo: number }[];
}

export interface LinhaVinculo {
  codigo: number;
  nome: string;
  /** Colaborador sugerido pelo nome (null = sem sugestão). */
  sugestaoId: number | null;
  /** O registro do dia tem algum problema e não seria gravado (mas o vínculo pelo código continua válido). */
  comProblema: boolean;
  detalhe: string;
}

/** Agente da Escallo que já está ligado a um colaborador do Ellos (aparece na lista "Já vinculadas"). */
export interface LinhaVinculada {
  codigo: number;
  colaboradorId: number;
  colaboradorNome: string;
  /** Nome que veio da Escallo; só existe quando o agente veio nas sobras (a função não devolve o nome dos já ligados). */
  nomeEscallo: string | null;
}

export interface ListasVinculo {
  /** Têm colaborador sugerido pelo nome. */
  sugestoes: LinhaVinculo[];
  /** Vieram da Escallo sem sugestão. Nada é criado para eles. */
  semSugestao: LinhaVinculo[];
  /** Registros sem código válido: não dá para vincular. */
  semCodigo: { nome: string }[];
  /** Quantos registros do dia já estão vinculados a um colaborador. */
  jaVinculados: number;
  /** Os agentes já vinculados, um a um (colaboradora do Ellos + código da Escallo), por ordem de nome. */
  vinculadas: LinhaVinculada[];
  /** Colaboradores que ainda não têm código. */
  colaboradoresSemCodigo: Attendant[];
}

/**
 * Separa as sobras da Escallo em listas, olhando os vínculos que existem AGORA no cadastro.
 * `vinculadosNaResposta`: registros que a função já devolveu como ligados (eles não vêm nas sobras) e contam como já vinculados.
 */
export function prepararVinculos(
  sobras: SobraEscallo[],
  attendants: Attendant[],
  vinculadosNaResposta = 0,
  vinculados: { attendantId: number; escalloCodigo: number }[] = []
): ListasVinculo {
  const usados = new Set(attendants.filter((a) => typeof a.escalloCodigo === "number").map((a) => a.escalloCodigo as number));
  const ids = new Set(attendants.map((a) => a.id));
  const sugestoes: LinhaVinculo[] = [];
  const semSugestao: LinhaVinculo[] = [];
  const semCodigo: { nome: string }[] = [];
  let jaVinculados = Math.max(0, Math.floor(vinculadosNaResposta));
  const nomeDe = new Map(attendants.map((a) => [a.id, a.name]));
  const vinculadas = new Map<number, LinhaVinculada>(); // por código da Escallo (sem repetir)
  for (const v of vinculados) {
    const nome = nomeDe.get(v.attendantId);
    if (nome !== undefined) vinculadas.set(v.escalloCodigo, { codigo: v.escalloCodigo, colaboradorId: v.attendantId, colaboradorNome: nome, nomeEscallo: null });
  }

  for (const s of sobras) {
    if (s.codigo === null) {
      semCodigo.push({ nome: s.nome });
      continue;
    }
    if (usados.has(s.codigo)) {
      jaVinculados += 1;
      const dono = attendants.find((a) => a.escalloCodigo === s.codigo);
      if (dono) vinculadas.set(s.codigo, { codigo: s.codigo, colaboradorId: dono.id, colaboradorNome: dono.name, nomeEscallo: s.nome || null });
      continue;
    }
    const sugestaoId = s.sugestao && ids.has(s.sugestao.id) ? s.sugestao.id : null;
    const linha: LinhaVinculo = {
      codigo: s.codigo,
      nome: s.nome,
      sugestaoId,
      comProblema: s.motivo === "revisar",
      detalhe: s.detalhe,
    };
    (sugestaoId === null ? semSugestao : sugestoes).push(linha);
  }
  return {
    sugestoes,
    semSugestao,
    semCodigo,
    jaVinculados,
    vinculadas: [...vinculadas.values()].sort((a, b) => a.colaboradorNome.localeCompare(b.colaboradorNome, "pt-BR")),
    colaboradoresSemCodigo: attendants.filter((a) => typeof a.escalloCodigo !== "number"),
  };
}

/**
 * Confere se dá para ligar este código a este colaborador. Devolve a mensagem de erro, ou null se estiver tudo certo.
 * `escolhasPendentes`: colaboradores já escolhidos em outras linhas da mesma tela (um colaborador só liga a um código).
 */
export function validarVinculo(
  codigo: number,
  attendantId: number | null,
  attendants: Attendant[],
  escolhasPendentes: Map<number, number> = new Map()
): string | null {
  if (!Number.isInteger(codigo) || codigo < 0) return "O código da Escallo precisa ser um número inteiro.";
  if (attendantId === null) return "Escolha o colaborador.";
  const colaborador = attendants.find((a) => a.id === attendantId);
  if (!colaborador) return "Esse colaborador não existe mais.";
  if (typeof colaborador.escalloCodigo === "number" && colaborador.escalloCodigo !== codigo) {
    return `${colaborador.name} já tem outro código da Escallo (${colaborador.escalloCodigo}). Corrija no cadastro, se for o caso.`;
  }
  const dono = attendants.find((a) => a.escalloCodigo === codigo && a.id !== attendantId);
  if (dono) return `O código ${codigo} já pertence a ${dono.name}.`;
  for (const [outroCodigo, outroId] of escolhasPendentes) {
    if (outroCodigo !== codigo && outroId === attendantId) return "Este colaborador já foi escolhido em outra linha.";
  }
  return null;
}

/** Texto digitado no campo "Código Escallo": vazio vira null; senão precisa ser inteiro >= 0. */
export function lerCodigoDigitado(texto: string): { codigo: number | null } | { erro: string } {
  const t = texto.trim();
  if (t === "") return { codigo: null };
  if (!/^\d+$/.test(t) || !Number.isSafeInteger(Number(t))) return { erro: "O código da Escallo deve ter só números." };
  return { codigo: Number(t) };
}

const MSG_NAO_PUBLICADA =
  "A busca na Escallo ainda não foi publicada neste ambiente. Peça para publicar a função escallo-rel025.";
const MSG_SEM_RESPOSTA =
  "Não consegui falar com a função escallo-rel025. Se a internet está funcionando, ela provavelmente ainda não foi publicada neste ambiente.";
const MSG_SEM_SERVIDOR = "Não foi possível falar com o servidor. Verifique a internet e tente de novo.";

/**
 * Traduz o erro do supabase.functions.invoke para uma mensagem que diz o que fazer.
 * O formato do erro varia (resposta HTTP, função inexistente, falha de rede), então nada aqui presume que
 * `context` seja uma Response: tudo é conferido antes de usar.
 */
export async function traduzirErroDaFuncao(error: unknown): Promise<string> {
  const e = (error ?? {}) as { name?: unknown; message?: unknown; context?: unknown };
  const ctx = e.context as { status?: unknown; json?: unknown } | undefined;
  const status = typeof ctx?.status === "number" ? ctx.status : undefined;
  const nome = typeof e.name === "string" ? e.name : "";
  const mensagem = typeof e.message === "string" ? e.message : "";

  if (status === 404 || nome === "FunctionsRelayError" || /not[ _]found|404/i.test(mensagem)) return MSG_NAO_PUBLICADA;
  if (nome === "FunctionsFetchError") return MSG_SEM_RESPOSTA;
  if (ctx && typeof ctx.json === "function") {
    try {
      const corpo = (await (ctx as { json: () => Promise<unknown> }).json()) as { error?: unknown } | null;
      if (corpo && typeof corpo.error === "string" && corpo.error) return corpo.error;
    } catch {
      /* corpo que não é JSON: cai na mensagem padrão */
    }
  }
  return MSG_SEM_SERVIDOR;
}

/** Chama a função escallo-rel025 (só leitura). Traduz os erros para mensagens que dizem o que fazer. */
export async function buscarVinculosNaEscallo(dia: string): Promise<RespostaEscallo> {
  const { data, error } = await getSupabase().functions.invoke("escallo-rel025", { body: { dia } });
  if (error) throw new Error(await traduzirErroDaFuncao(error));
  const r = data as RespostaEscallo | null;
  if (!r || !Array.isArray(r.sobras)) throw new Error("A resposta da busca veio em um formato inesperado.");
  return r;
}

/** Dados para cadastrar no Ellos uma pessoa que só existe na Escallo, já ligada ao código dela. */
export interface NovaColaboradora {
  name: string;
  role: string;
  serviceChannel: AttendantServiceChannel | "";
  workingHours: string;
  jornadaStart: string;
  jornadaEnd: string;
}

/**
 * Confere se dá para cadastrar e vincular. Devolve a mensagem de erro (diz o que houve e como resolver), ou null se estiver tudo certo.
 * Nunca cadastra sozinha: quem chama só grava depois que a pessoa confirmar na janela.
 */
export function validarNovaColaboradora(codigo: number, dados: NovaColaboradora, attendants: Attendant[]): string | null {
  if (!Number.isInteger(codigo) || codigo < 0) return "O código da Escallo precisa ser um número inteiro.";
  const nome = dados.name.trim();
  if (!nome) return "Escreva o nome da colaboradora.";
  if (!dados.role) return "Escolha a função.";
  if (!dados.serviceChannel) return "Escolha o canal de atendimento.";
  if (!dados.workingHours) return "Escolha a carga horária.";
  if (!isValidJornada(dados.jornadaStart, dados.jornadaEnd)) return "Informe início e fim da jornada (o horário final deve ser após o inicial).";
  const dono = attendants.find((a) => a.escalloCodigo === codigo);
  if (dono) return `O código ${codigo} já pertence a ${dono.name}.`;
  const mesmoNome = attendants.find((a) => a.name.trim().toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"));
  if (mesmoNome) return `Já existe ${mesmoNome.name} no Ellos. Em vez de cadastrar de novo, escolha ela na lista e confirme o vínculo.`;
  return null;
}
