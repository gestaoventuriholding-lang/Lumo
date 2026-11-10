// Ellos: ver a conversa do WhatsApp ou ouvir a gravação da ligação de um atendimento, para auditar.
// Nada é guardado: a conversa e o áudio vêm da Escallo na hora (função escallo-atendimento) e somem ao fechar a tela.
// No ambiente de teste não há Escallo: usa uma conversa e um áudio inventados.
import { ambiente, getSupabase } from "@/lib/supabase";
import { traduzirErroDaFuncao } from "@/lib/escalloVinculos";
import type { AuditChannel } from "@/types/audit";

export const MENSAGEM_ATENDIMENTO_TESTE =
  "Ambiente de teste: esta conversa (ou gravação) é inventada. No Ellos oficial, ela é buscada na Escallo na hora.";

export function atendimentoInventado(): boolean {
  return ambiente === "teste";
}

export interface MensagemConversa {
  id: string;
  dataHora: string;
  /** "Recebido" (paciente), "Enviado" (agente) ou "Automático" */
  direcao: string;
  tipo: string;
  conteudo: string;
  etapa: "automatico" | "atendimento";
}

export interface ConversaWhatsapp {
  tipo: "conversa";
  protocolo: string;
  dia: string;
  agentes: string[];
  mensagens: MensagemConversa[];
}

export interface LigacaoEncontrada {
  tipo: "ligacao";
  protocolo: string;
  dia: string;
  uniqueid: string;
  inicio: string;
  segundosConversa: number;
  agente: string;
}

export type AtendimentoBuscado = ConversaWhatsapp | LigacaoEncontrada;

const CONVERSA_INVENTADA: Omit<MensagemConversa, "id" | "dataHora">[] = [
  { direcao: "Automático", tipo: "Texto", conteudo: "Olá! Você falou com o Laboratório Exemplo. Digite 1 para agendamentos ou 2 para resultados.", etapa: "automatico" },
  { direcao: "Recebido", tipo: "Texto", conteudo: "1", etapa: "automatico" },
  { direcao: "Enviado", tipo: "Texto", conteudo: "Bom dia! Aqui é a Paula, do agendamento. Com quem eu falo?", etapa: "atendimento" },
  { direcao: "Recebido", tipo: "Texto", conteudo: "bom dia, sou a Maria Exemplo. queria marcar um hemograma", etapa: "atendimento" },
  { direcao: "Enviado", tipo: "Texto", conteudo: "Maria, para confirmar seu cadastro, pode me informar seu nome completo e a data de nascimento?", etapa: "atendimento" },
  { direcao: "Recebido", tipo: "Texto", conteudo: "Maria Exemplo da Silva, 01/01/1990", etapa: "atendimento" },
  { direcao: "Enviado", tipo: "Texto", conteudo: "Obrigada! O hemograma exige jejum de 4 horas. Temos horário na terça às 8h na unidade Centro. Pode ser?", etapa: "atendimento" },
  { direcao: "Recebido", tipo: "Texto", conteudo: "pode sim. precisa levar algum documento?", etapa: "atendimento" },
  { direcao: "Enviado", tipo: "Texto", conteudo: "Leve um documento com foto e a carteirinha do convênio. Agendamento confirmado para terça às 8h. O protocolo é o que aparece no topo desta conversa.", etapa: "atendimento" },
  { direcao: "Recebido", tipo: "Imagem", conteudo: "[Imagem]", etapa: "atendimento" },
  { direcao: "Enviado", tipo: "Texto", conteudo: "Posso ajudar em mais alguma coisa?", etapa: "atendimento" },
  { direcao: "Recebido", tipo: "Texto", conteudo: "nao, obrigada!", etapa: "atendimento" },
  { direcao: "Enviado", tipo: "Texto", conteudo: "Por nada! Tenha um ótimo dia.", etapa: "atendimento" },
];

function conversaInventada(protocolo: string, dia: string): ConversaWhatsapp {
  const mensagens = CONVERSA_INVENTADA.map((m, i) => ({
    ...m,
    id: String(i + 1),
    dataHora: `${dia} 09:${String(10 + i).padStart(2, "0")}:00`,
  }));
  return { tipo: "conversa", protocolo, dia, agentes: ["Paula (inventada)"], mensagens };
}

/** Busca o atendimento. WhatsApp devolve a conversa; Ligação devolve o identificador da gravação. */
export async function buscarAtendimento(canal: AuditChannel, protocolo: string, dia: string): Promise<AtendimentoBuscado> {
  if (atendimentoInventado()) {
    if (canal === "WhatsApp") return conversaInventada(protocolo, dia);
    return { tipo: "ligacao", protocolo, dia, uniqueid: "1700000000.0", inicio: `${dia} 09:10:00`, segundosConversa: 4, agente: "Paula (inventada)" };
  }
  const { data, error } = await getSupabase().functions.invoke("escallo-atendimento", { body: { canal, protocolo, dia } });
  if (error) throw new Error(await traduzirErroAtendimento(error));
  const r = data as AtendimentoBuscado | null;
  if (!r || (r.tipo !== "conversa" && r.tipo !== "ligacao")) throw new Error("A resposta da Escallo veio em um formato inesperado.");
  return r;
}

/** Um tom curto gerado na hora, só para testar o player no ambiente de teste */
function audioInventado(): Blob {
  const taxa = 8000;
  const segundos = 4;
  const amostras = taxa * segundos;
  const buffer = new ArrayBuffer(44 + amostras * 2);
  const v = new DataView(buffer);
  const texto = (pos: number, s: string) => [...s].forEach((c, i) => v.setUint8(pos + i, c.charCodeAt(0)));
  texto(0, "RIFF");
  v.setUint32(4, 36 + amostras * 2, true);
  texto(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  texto(36, "data");
  v.setUint32(40, amostras * 2, true);
  for (let i = 0; i < amostras; i++) {
    const envelope = Math.min(1, i / 400, (amostras - i) / 400);
    v.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * 440 * i) / taxa) * 6000 * envelope), true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** Tipo do som pelos primeiros bytes (a função repassa como binário) */
async function tipoDoAudio(blob: Blob): Promise<string> {
  const inicio = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const txt = String.fromCharCode(...inicio);
  if (txt.startsWith("RIFF")) return "audio/wav";
  if (txt.startsWith("OggS")) return "audio/ogg";
  return "audio/mpeg";
}

/** Baixa a gravação (passando pela função, que esconde o token) e devolve o som para tocar */
export async function buscarAudio(uniqueid: string): Promise<Blob> {
  if (atendimentoInventado()) return audioInventado();
  const { data, error } = await getSupabase().functions.invoke("escallo-atendimento", { body: { canal: "Ligação", acao: "audio", uniqueid } });
  if (error) throw new Error(await traduzirErroAtendimento(error));
  if (!(data instanceof Blob) || data.size === 0) throw new Error("A Escallo não devolveu a gravação desta ligação.");
  return new Blob([data], { type: await tipoDoAudio(data) });
}

async function traduzirErroAtendimento(error: unknown): Promise<string> {
  const msg = await traduzirErroDaFuncao(error);
  return msg.replaceAll("escallo-rel025", "escallo-atendimento");
}

/** Texto de hora curto (HH:MM) a partir de "AAAA-MM-DD HH:MM:SS" */
export function horaDaMensagem(dataHora: string): string {
  const m = /\d{2}:\d{2}/.exec(dataHora.split(" ")[1] ?? "");
  return m ? m[0] : "";
}
