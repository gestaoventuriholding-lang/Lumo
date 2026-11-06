// Ellos: monta o que a sincronização grava para UM dia, a partir dos relatórios rel025 (ligação) e rel090 (WhatsApp).
// Lógica pura (sem rede e sem banco), testada com dados inventados. As regras são as da importação de outubro:
//  - só colaboradores VINCULADOS (pelo código da Escallo); nunca cria colaborador;
//  - só grava linha de um canal para quem teve atendimento NAQUELE canal (> 0);
//  - login e pausa são do agente: o maior login entre os dois canais decide a regra do limite (padrão 12 h);
//  - login acima do limite: grava os atendimentos, esvazia login/pausa/ocupação/chamadas por hora NOS DOIS canais e gera 1 alerta;
//  - a linha "_media" do rel090 é ignorada.
import {
  ligarColaboradores,
  LOGIN_LIMITE_PADRAO_SEGUNDOS,
  numero,
  type Colaborador,
  type RegistroEscallo,
} from "./mapeamento.ts";
import {
  codigoAgente090,
  converterRegistro090,
  esvaziarLogin,
  mediaMinutos,
  CANAL_WHATSAPP,
  type LinhaProdutividade,
} from "./rel090.ts";

/** Formato que a função SQL public.aplicar_sync_dia espera para cada linha */
export interface LinhaSync {
  attendant_id: number;
  channel: string;
  inbound: number;
  outbound: number;
  atend: number;
  talk: number;
  tma: number;
  login: number | null;
  pause: number | null;
  pause_pct: number | null;
  legal: number | null;
  productive: number | null;
  unproductive: number | null;
  to1: number | null;
  to2: number | null;
  to3: number | null;
  to4: number | null;
  per_hour: number | null;
  report_code: string;
  media_min: number;
}

export interface AlertaSync {
  attendant_id: number;
  login_seconds: number;
  limit_seconds: number;
}

export interface PlanoDia {
  dia: string;
  linhas: LinhaSync[];
  alertas: AlertaSync[];
  resumo: {
    rel025Agentes: number;
    rel090Agentes: number;
    linhasLigacao: number;
    linhasWhatsapp: number;
    atendimentosLigacao: number;
    atendimentosWhatsapp: number;
    loginEsvaziado: number;
    semVinculoComAtendimento: number;
  };
}

function paraLinhaSync(attendantId: number, p: LinhaProdutividade, mediaMin: number): LinhaSync {
  return {
    attendant_id: attendantId,
    channel: p.channel,
    inbound: p.inbound_count,
    outbound: p.outbound_count,
    atend: p.attendances_count,
    talk: p.talk_seconds,
    tma: p.tma_seconds,
    login: p.login_seconds,
    pause: p.pause_seconds,
    pause_pct: p.pause_percent,
    legal: p.pause_legal_seconds,
    productive: p.pause_productive_seconds,
    unproductive: p.pause_unproductive_seconds,
    to1: p.occupancy_to1,
    to2: p.occupancy_to2,
    to3: p.occupancy_to3,
    to4: p.occupancy_to4,
    per_hour: p.per_hour,
    report_code: p.report_code,
    media_min: mediaMin,
  };
}

export function montarPlanoDia(args: {
  dia: string;
  rel025: RegistroEscallo[];
  rel090: RegistroEscallo[];
  colaboradores: Colaborador[];
  /** Limite de login por dia, em segundos; null = regra desligada */
  limiteLoginSegundos: number | null;
}): PlanoDia {
  const { dia, rel025, rel090, colaboradores } = args;
  const limite = args.limiteLoginSegundos;
  const porCodigo = new Map<number, Colaborador>();
  for (const c of colaboradores) if (typeof c.escallo_codigo === "number") porCodigo.set(c.escallo_codigo, c);

  // ---- ligação (limite null aqui: o login bruto entra na regra do dia, que olha os dois canais) ----
  const { vinculados, sobras } = ligarColaboradores(rel025, colaboradores, dia, null);
  let semVinculo = 0;
  for (const s of sobras) {
    if (s.motivo !== "sem_vinculo" || s.codigo === null) continue;
    const r = rel025.find((q) => numero(q.codigo) === s.codigo);
    const atend = r ? Math.round(numero(r.ligacoesOferecidasAtendidas) ?? 0) + Math.round(numero(r.ligacoesRealizadasAtendidas) ?? 0) : 0;
    if (atend > 0) semVinculo += 1;
  }

  // ---- WhatsApp ----
  const chat = new Map<number, LinhaProdutividade>();
  for (const r of rel090) {
    const codigo = codigoAgente090(r); // "_media" e linhas sem código: ignoradas
    if (codigo === null) continue;
    const colab = porCodigo.get(codigo);
    const linha = converterRegistro090(r, dia);
    if (!colab) {
      if (linha.attendances_count > 0) semVinculo += 1;
      continue;
    }
    if (!chat.has(colab.id)) chat.set(colab.id, linha); // código repetido: vale o primeiro
  }

  // ---- regra do login: maior login entre os canais, por colaborador ----
  const logins = new Map<number, number>();
  for (const v of vinculados) logins.set(v.attendantId, Math.max(logins.get(v.attendantId) ?? 0, v.produtividade.login_seconds ?? 0));
  for (const [id, l] of chat) logins.set(id, Math.max(logins.get(id) ?? 0, l.login_seconds ?? 0));
  const acima = new Map<number, number>();
  if (limite !== null) for (const [id, login] of logins) if (login > limite) acima.set(id, login);

  const linhas: LinhaSync[] = [];
  let atendVoz = 0;
  let atendChat = 0;
  let linhasVoz = 0;
  let linhasChat = 0;
  let esvaziadas = 0;
  for (const v of vinculados) {
    if (v.produtividade.attendances_count <= 0) continue; // sem ligação, sem linha de ligação
    const esvazia = acima.has(v.attendantId);
    const p = esvazia ? esvaziarLogin(v.produtividade) : v.produtividade;
    linhas.push(paraLinhaSync(v.attendantId, p, v.diario.average_time_minutes));
    atendVoz += p.attendances_count;
    linhasVoz += 1;
    if (esvazia) esvaziadas += 1;
  }
  for (const [id, linha] of chat) {
    if (linha.attendances_count <= 0) continue; // sem atendimento no WhatsApp, sem linha de WhatsApp
    const esvazia = acima.has(id);
    const p = esvazia ? esvaziarLogin(linha) : linha;
    linhas.push(paraLinhaSync(id, p, mediaMinutos(linha.tma_seconds)));
    atendChat += p.attendances_count;
    linhasChat += 1;
    if (esvazia) esvaziadas += 1;
  }

  const alertas: AlertaSync[] = [...acima].map(([id, login]) => ({
    attendant_id: id,
    login_seconds: Math.round(login),
    limit_seconds: limite as number,
  }));

  return {
    dia,
    linhas,
    alertas,
    resumo: {
      rel025Agentes: rel025.length,
      rel090Agentes: rel090.filter((r) => codigoAgente090(r) !== null).length,
      linhasLigacao: linhasVoz,
      linhasWhatsapp: linhasChat,
      atendimentosLigacao: atendVoz,
      atendimentosWhatsapp: atendChat,
      loginEsvaziado: esvaziadas,
      semVinculoComAtendimento: semVinculo,
    },
  };
}

export { LOGIN_LIMITE_PADRAO_SEGUNDOS, CANAL_WHATSAPP };
