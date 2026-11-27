// Ellos: conversas do WhatsApp que a equipe classificou como orçamento E em que a empresa enviou o orçamento
// (histórico de mensagens da Escallo), sem rede e sem banco.
// Alimenta a tela de Follow-up. LGPD: sai daqui só protocolo, data, área e atendente (equipe).
// Nome, telefone e mensagens do paciente são lidos e descartados: nunca vão para o banco nem para log.

export type AreaOrcamento = "laboratorio" | "imagem" | "outros";

export interface OrcamentoDia {
  /** Número da conversa na Escallo: identifica a linha, para reler o dia sem duplicar */
  chatId: number;
  protocolo: string;
  dia: string;
  area: AreaOrcamento;
  codigoAgente: number | null;
  nomeAgente: string;
}

type Linha = Record<string, unknown>;

export const REGISTROS_POR_PAGINA = 100;
export const MAX_PAGINAS_HISTORICO = 80;
export const PAGINAS_EM_PARALELO = 4;

const limpar = (t: unknown) => String(t ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
const PROTOCOLO_OK = /^[A-Za-z0-9._-]{1,60}$/;

/** "Orçamento AC" = análises clínicas; "Orçamento DI" = diagnóstico por imagem; outra classificação com "orçamento" = outros. */
export function areaDoOrcamento(classificacao: unknown): AreaOrcamento | null {
  const nome = limpar(classificacao);
  if (!/\borcamento\b/.test(nome)) return null;
  if (/\bac\b/.test(nome)) return "laboratorio";
  if (/\bdi\b/.test(nome)) return "imagem";
  return "outros";
}

const VALOR_EM_REAIS = /R\$\s*\d|\b\d{1,3}(\.\d{3})*,\d{2}\b/;

const atendimentosDe = (r: Linha) => (Array.isArray(r.atendimentos) ? (r.atendimentos as Linha[]) : []);

/**
 * A Escallo não tem o campo "orçamento feito". O sinal usado: a empresa ENVIOU na conversa um valor escrito,
 * um arquivo ou uma imagem. O conteúdo é só examinado aqui; nunca é guardado.
 */
export function empresaEnviouOrcamento(conversa: Linha): boolean {
  return atendimentosDe(conversa).some((a) =>
    (Array.isArray(a.mensagens) ? (a.mensagens as Linha[]) : []).some(
      (m) =>
        m.direcao === "Enviado" &&
        (m.tipo === "Arquivo" || m.tipo === "Imagem" || (m.tipo === "Texto" && VALOR_EM_REAIS.test(String(m.conteudo ?? ""))))
    )
  );
}

/**
 * `registros` são as conversas do dia (historicoMensagens). Devolve as classificadas como orçamento em que houve envio.
 * O mesmo contato com duas conversas de orçamento da mesma área no dia conta uma vez (fica a mais recente).
 */
export function extrairOrcamentos(dia: string, registros: Linha[]): OrcamentoDia[] {
  const porContato = new Map<string, OrcamentoDia>();
  const ordenados = [...registros].sort((a, b) => Number(a.id) - Number(b.id));
  for (const r of ordenados) {
    const area = areaDoOrcamento((r.classificacao as Linha | undefined)?.nome);
    const chatId = Number(r.id);
    if (!area || !Number.isSafeInteger(chatId) || chatId <= 0) continue;
    // `comEnvio` vem da leitura do dia, que já conferiu e descartou as mensagens
    if (r.comEnvio !== true && !empresaEnviouOrcamento(r)) continue;
    const atendimentos = atendimentosDe(r);
    const comProtocolo = atendimentos.filter((a) => PROTOCOLO_OK.test(String(a.protocolo ?? "").trim()));
    // quem fez o orçamento: o último atendimento com agente (antes dele pode ter havido triagem)
    const doAgente = [...comProtocolo].reverse().find((a) => (a.agente as Linha | undefined)?.codigo) ?? comProtocolo[comProtocolo.length - 1];
    if (!doAgente) continue; // sem protocolo não há como a equipe localizar o paciente na Escallo
    const agente = (doAgente.agente ?? {}) as Linha;
    const codigo = Number(agente.codigo);
    // o contato só serve para não repetir a pessoa: fica na memória e não sai desta função
    const contato = r.clienteContato ? JSON.stringify(r.clienteContato) : `conversa ${chatId}`;
    porContato.set(`${area}|${contato}`, {
      chatId,
      protocolo: String(doAgente.protocolo).trim(),
      dia,
      area,
      codigoAgente: Number.isSafeInteger(codigo) && codigo > 0 ? codigo : null,
      nomeAgente: String(agente.nome ?? "").trim().slice(0, 80),
    });
  }
  return [...porContato.values()].sort((a, b) => a.chatId - b.chatId);
}

/**
 * Lê o histórico de um dia inteiro (a Escallo não filtra por classificação), alguns lotes de páginas por vez,
 * e guarda de cada conversa só o que a extração usa (as mensagens são descartadas na hora).
 */
export async function lerOrcamentosDoDia(
  dia: string,
  buscarPagina: (pagina: number) => Promise<Linha[]>,
  maxPaginas = MAX_PAGINAS_HISTORICO
): Promise<OrcamentoDia[]> {
  const vistos = new Set<unknown>();
  const enxutas: Linha[] = [];
  for (let p = 0; p < maxPaginas; p += PAGINAS_EM_PARALELO) {
    const lote = await Promise.all(Array.from({ length: PAGINAS_EM_PARALELO }, (_, i) => buscarPagina(p + i)));
    for (const pagina of lote) {
      let novas = 0;
      for (const r of pagina) {
        if (vistos.has(r.id)) continue;
        vistos.add(r.id);
        novas += 1;
        if (!areaDoOrcamento((r.classificacao as Linha | undefined)?.nome) || !empresaEnviouOrcamento(r)) continue;
        enxutas.push({
          comEnvio: true,
          id: r.id,
          classificacao: r.classificacao,
          clienteContato: r.clienteContato,
          atendimentos: atendimentosDe(r).map((a) => ({ protocolo: a.protocolo, agente: a.agente })),
        });
      }
      // página incompleta (ou repetida): acabou o dia
      if (pagina.length < REGISTROS_POR_PAGINA || novas === 0) return extrairOrcamentos(dia, enxutas);
    }
  }
  throw new Error(`histórico ${dia}: mais de ${maxPaginas} páginas, não li tudo`);
}

/** Linhas como vão para a tabela quote_followups. Só as colunas da sincronização: o acompanhamento da equipe não é tocado. */
export function orcamentosParaTabela(linhas: OrcamentoDia[], colaboradores: { id: number; name: string; escallo_codigo?: number | string | null }[]) {
  const porCodigo = new Map(colaboradores.filter((c) => c.escallo_codigo).map((c) => [Number(c.escallo_codigo), c]));
  return linhas.map((l) => {
    const c = l.codigoAgente === null ? undefined : porCodigo.get(l.codigoAgente);
    return {
      chat_id: l.chatId,
      protocol: l.protocolo,
      date: l.dia,
      area: l.area,
      attendant_id: c?.id ?? null,
      attendant_name: c?.name ?? l.nomeAgente,
    };
  });
}
