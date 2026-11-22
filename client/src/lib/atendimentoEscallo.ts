// Ellos: ver a conversa do WhatsApp (por protocolo) ou ouvir a gravação de uma ligação (escolhida na lista do agente no dia), para auditar.
// Nada é guardado: a conversa e o áudio vêm da Escallo na hora (função escallo-atendimento) e somem ao fechar a tela.
// Da ligação só fica registrado, na auditoria, o identificador (uniqueid): sem áudio, sem telefone, sem nome.
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

/** Uma ligação recebida e atendida pelo agente no dia (sem telefone nem nome do paciente) */
export interface LigacaoDaLista {
  /** identificador da gravação na Escallo; é o que fica salvo na auditoria */
  uniqueid: string;
  /** "AAAA-MM-DD HH:MM:SS" */
  inicio: string;
  fila: string;
  segundos: number;
}

/** Identificador de ligação da Escallo, ex.: 1763560000.12345 */
export const ID_LIGACAO = /^\d{6,15}\.\d{1,8}$/;
export const pareceIdLigacao = (v: string) => ID_LIGACAO.test(v.trim());

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

/** Busca a conversa do WhatsApp pelo protocolo (a Escallo informa o protocolo só no WhatsApp). */
export async function buscarConversa(protocolo: string, dia: string): Promise<ConversaWhatsapp> {
  if (atendimentoInventado()) return conversaInventada(protocolo, dia);
  const { data, error } = await getSupabase().functions.invoke("escallo-atendimento", { body: { canal: "WhatsApp", protocolo, dia } });
  if (error) throw new Error(await traduzirErroAtendimento(error));
  const r = data as ConversaWhatsapp | null;
  if (!r || r.tipo !== "conversa") throw new Error("A resposta da Escallo veio em um formato inesperado.");
  return r;
}

/** Ligações recebidas e atendidas por esse agente (código da Escallo) no dia */
export async function listarLigacoes(dia: string, codigoAgente: number): Promise<LigacaoDaLista[]> {
  if (atendimentoInventado()) {
    const base: [string, string, number][] = [
      ["09:10:00", "USG", 187],
      ["10:32:00", "Preparo AC", 64],
      ["14:05:00", "Resultados AC", 312],
    ];
    return base.map(([hora, fila, segundos], i) => ({ uniqueid: `170000000${i}.0000${i + 1}`, inicio: `${dia} ${hora}`, fila, segundos }));
  }
  const { data, error } = await getSupabase().functions.invoke("escallo-atendimento", { body: { canal: "Ligação", acao: "listar", dia, codigoAgente } });
  if (error) throw new Error(await traduzirErroAtendimento(error));
  const r = data as { tipo?: string; ligacoes?: LigacaoDaLista[] } | null;
  if (!r || r.tipo !== "lista" || !Array.isArray(r.ligacoes)) throw new Error("A resposta da Escallo veio em um formato inesperado.");
  return r.ligacoes;
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
