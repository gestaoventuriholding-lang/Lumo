// Ellos: regras do relatório rel025 da Escallo (produtividade dos agentes de voz), sem rede e sem banco.
// Fica separado do index.ts para poder ser testado (vitest) com dados inventados.
// Só usa sintaxe que o Deno, o Node e o TypeScript entendem sem configuração extra.

export const CANAL = "Ligação";
export const CODIGO_RELATORIO = "REL025";
export const ORIGEM = "API Escallo";
/**
 * Login acima deste limite (padrão 12 h, configurável em Configurações) num mesmo dia: os atendimentos são gravados,
 * mas login, pausa, ocupação e chamadas por hora daquele dia ficam VAZIOS e o gestor recebe um alerta.
 */
export const LOGIN_LIMITE_PADRAO_SEGUNDOS = 43_200;

export type RegistroEscallo = Record<string, unknown>;

/** Linha de public.productivity_reports (sem attendant_id, que vem da ligação com o colaborador). */
export interface DadosProdutividade {
  period_start: string;
  period_end: string;
  channel: string;
  inbound_count: number;
  outbound_count: number;
  attendances_count: number;
  talk_seconds: number;
  tma_seconds: number;
  // Vazios (null) quando o login do dia passou do limite
  login_seconds: number | null;
  pause_seconds: number | null;
  pause_percent: number | null;
  pause_legal_seconds: number | null;
  pause_productive_seconds: number | null;
  pause_unproductive_seconds: number | null;
  occupancy_to1: number | null;
  occupancy_to2: number | null;
  occupancy_to3: number | null;
  occupancy_to4: number | null;
  per_hour: number | null;
  report_code: string;
  source_file: string;
}

/** Linha de public.performance_records (resumo diário que alimenta o Dashboard). */
export interface DadosDiarios {
  date: string;
  channel: string;
  attendances_count: number;
  average_time_minutes: number;
}

export interface Colaborador {
  id: number;
  name: string;
  escallo_codigo?: number | null;
}

export interface Vinculado {
  attendantId: number;
  escalloCodigo: number;
  produtividade: DadosProdutividade;
  diario: DadosDiarios;
  /** Preenchido quando o login passou do limite: o tempo que veio da Escallo (vai para o alerta do gestor) */
  loginDesconsiderado: { loginSegundos: number; limiteSegundos: number } | null;
}

export interface Sobra {
  codigo: number | null;
  nome: string;
  /** sem_vinculo: nenhum colaborador tem esse código. revisar: o registro em si tem algum problema. */
  motivo: "sem_vinculo" | "revisar";
  detalhe: string;
  /** Sugestão por nome (só sugere, nunca grava). */
  sugestao: { id: number; nome: string } | null;
}

export type Pedido = { dia: string; exibirUsuarioSistema: "0" | "1" };

// ---------------------------------------------------------------- pedido

/** Data de hoje em São Paulo, AAAA-MM-DD. */
export function hojeSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

/** Aceita só { dia, exibirUsuarioSistema? }. Um dia só, que exista e não seja futuro. */
export function validarPedido(corpo: unknown, hoje: string): { pedido: Pedido } | { erro: string } {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return { erro: "Pedido inválido." };
  const campos = corpo as Record<string, unknown>;
  const extras = Object.keys(campos).filter((k) => k !== "dia" && k !== "exibirUsuarioSistema");
  if (extras.length) return { erro: `Campo não aceito: ${extras[0]}.` };

  const dia = campos.dia;
  if (typeof dia !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
    return { erro: "Informe o dia no formato AAAA-MM-DD, por exemplo 2026-11-03." };
  }
  const d = new Date(`${dia}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== dia) {
    return { erro: `A data ${dia} não existe.` };
  }
  if (dia > hoje) return { erro: "Escolha um dia que já passou. A Escallo ainda não fechou o relatório de datas futuras." };

  const exibir = campos.exibirUsuarioSistema ?? "1";
  if (exibir !== "0" && exibir !== "1") return { erro: 'exibirUsuarioSistema aceita só "0" ou "1".' };
  return { pedido: { dia, exibirUsuarioSistema: exibir } };
}

// ---------------------------------------------------------------- números

/** Número vindo da Escallo: aceita 12.5, "12.5" e "12,5" (e "1.234,5"). Qualquer outra coisa vira null. */
export function numero(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.trim();
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const arredondar = (n: number, casas = 2) => {
  const f = 10 ** casas;
  return Math.round(n * f) / f;
};

export function normalizarNome(valor: string): string {
  return valor.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ");
}

// ---------------------------------------------------------------- conversão de um registro

const CAMPOS_NUMERICOS = [
  "ligacoesOferecidasAtendidas", "ligacoesRealizadasAtendidas", "tempoAtendimento", "tempoRealizadas",
  "TMA", "tempoLogin", "tempoPausa", "pausaLegal", "pausaProdutiva", "pausaImprodutiva",
  "percentualPausa", "TO01", "TO02", "TO03", "TO04", "chamadasPorHora",
] as const;

export function converterRegistro(
  r: RegistroEscallo,
  dia: string,
  /** null = regra desligada */
  limiteLoginSegundos: number | null = LOGIN_LIMITE_PADRAO_SEGUNDOS
): {
  dados: { produtividade: DadosProdutividade; diario: DadosDiarios } | null;
  problemas: string[];
  loginDesconsiderado: { loginSegundos: number; limiteSegundos: number } | null;
} {
  const problemas: string[] = [];
  const n: Record<string, number> = {};
  for (const campo of CAMPOS_NUMERICOS) {
    const v = numero(r[campo]);
    if (v === null) problemas.push(`campo ${campo} ausente ou inválido`);
    else if (v < 0) problemas.push(`campo ${campo} negativo`);
    else n[campo] = v;
  }
  if (problemas.length) return { dados: null, problemas, loginDesconsiderado: null };
  const acimaDoLimite = limiteLoginSegundos != null && n.tempoLogin > limiteLoginSegundos;

  const entrada = Math.round(n.ligacoesOferecidasAtendidas);
  const saida = Math.round(n.ligacoesRealizadasAtendidas);
  const atendimentos = entrada + saida;
  return {
    problemas,
    loginDesconsiderado: acimaDoLimite ? { loginSegundos: Math.round(n.tempoLogin), limiteSegundos: limiteLoginSegundos } : null,
    dados: {
      produtividade: {
        period_start: dia,
        period_end: dia,
        channel: CANAL,
        inbound_count: entrada,
        outbound_count: saida,
        attendances_count: atendimentos,
        talk_seconds: Math.round(n.tempoAtendimento + n.tempoRealizadas),
        tma_seconds: Math.round(n.TMA),
        // Login acima do limite: tudo que depende do tempo logado fica vazio. Atendimentos, TMA e conversa ficam.
        login_seconds: acimaDoLimite ? null : Math.round(n.tempoLogin),
        pause_seconds: acimaDoLimite ? null : Math.round(n.tempoPausa),
        pause_percent: acimaDoLimite ? null : arredondar(n.percentualPausa),
        pause_legal_seconds: acimaDoLimite ? null : Math.round(n.pausaLegal),
        pause_productive_seconds: acimaDoLimite ? null : Math.round(n.pausaProdutiva),
        pause_unproductive_seconds: acimaDoLimite ? null : Math.round(n.pausaImprodutiva),
        occupancy_to1: acimaDoLimite ? null : arredondar(n.TO01),
        occupancy_to2: acimaDoLimite ? null : arredondar(n.TO02),
        // TO3 e TO4 dependem da jornada configurada na Escallo: 0 significa "sem dado", não 0% de ocupação.
        occupancy_to3: acimaDoLimite || n.TO03 === 0 ? null : arredondar(n.TO03),
        occupancy_to4: acimaDoLimite || n.TO04 === 0 ? null : arredondar(n.TO04),
        per_hour: acimaDoLimite ? null : arredondar(n.chamadasPorHora),
        report_code: CODIGO_RELATORIO,
        source_file: ORIGEM,
      },
      diario: {
        date: dia,
        channel: CANAL,
        attendances_count: atendimentos,
        average_time_minutes: arredondar(n.TMA / 60),
      },
    },
  };
}

// ---------------------------------------------------------------- ligação com os colaboradores

/**
 * Liga cada registro ao colaborador SÓ pelo código da Escallo. O nome serve apenas para sugerir.
 * Nunca cria colaborador. Quem não liga, ou tem problema, vai para `sobras` e não é gravado.
 */
export function ligarColaboradores(
  registros: RegistroEscallo[],
  colaboradores: Colaborador[],
  dia: string,
  /** null = regra do login desligada */
  limiteLoginSegundos: number | null = LOGIN_LIMITE_PADRAO_SEGUNDOS
): { vinculados: Vinculado[]; sobras: Sobra[] } {
  const porCodigo = new Map<number, Colaborador>();
  for (const c of colaboradores) {
    if (typeof c.escallo_codigo === "number") porCodigo.set(c.escallo_codigo, c);
  }
  const porNome = new Map<string, Colaborador[]>();
  for (const c of colaboradores) {
    const chave = normalizarNome(c.name);
    porNome.set(chave, [...(porNome.get(chave) ?? []), c]);
  }

  const sugerir = (nome: string, codigo: number | null) => {
    const candidatos = porNome.get(normalizarNome(nome)) ?? [];
    if (candidatos.length !== 1) return null; // nenhum, ou nome repetido: não dá para sugerir com segurança
    const c = candidatos[0];
    // Já vinculado a OUTRO código da Escallo: não sugerir.
    if (typeof c.escallo_codigo === "number" && c.escallo_codigo !== codigo) return null;
    return { id: c.id, nome: c.name };
  };

  const vinculados: Vinculado[] = [];
  const sobras: Sobra[] = [];
  const codigosVistos = new Set<number>();

  for (const r of registros) {
    const codigoNum = numero(r.codigo);
    const codigo = codigoNum !== null && Number.isInteger(codigoNum) && codigoNum >= 0 ? codigoNum : null;
    const nome = typeof r.nome === "string" ? r.nome.trim() : "";

    if (codigo === null) {
      sobras.push({ codigo: null, nome, motivo: "revisar", detalhe: "registro sem código válido", sugestao: sugerir(nome, null) });
      continue;
    }
    if (codigosVistos.has(codigo)) {
      sobras.push({ codigo, nome, motivo: "revisar", detalhe: "código repetido na resposta da Escallo", sugestao: null });
      continue;
    }
    codigosVistos.add(codigo);

    const conv = converterRegistro(r, dia, limiteLoginSegundos);
    const colaborador = porCodigo.get(codigo);

    if (!conv.dados) {
      sobras.push({ codigo, nome, motivo: "revisar", detalhe: conv.problemas.join("; "), sugestao: colaborador ? { id: colaborador.id, nome: colaborador.name } : sugerir(nome, codigo) });
      continue;
    }
    if (!colaborador) {
      sobras.push({ codigo, nome, motivo: "sem_vinculo", detalhe: "nenhum colaborador tem este código da Escallo", sugestao: sugerir(nome, codigo) });
      continue;
    }
    vinculados.push({
      attendantId: colaborador.id,
      escalloCodigo: codigo,
      produtividade: conv.dados.produtividade,
      diario: conv.dados.diario,
      loginDesconsiderado: conv.loginDesconsiderado,
    });
  }
  return { vinculados, sobras };
}

/** Totais do que seria gravado, para conferir com os totais da Escallo. */
export function totaisDoPreview(vinculados: Vinculado[]) {
  const soma = (f: (v: Vinculado) => number) => vinculados.reduce((s, v) => s + f(v), 0);
  return {
    atendimentos: soma((v) => v.produtividade.attendances_count),
    entrada: soma((v) => v.produtividade.inbound_count),
    saida: soma((v) => v.produtividade.outbound_count),
    loginSegundos: soma((v) => v.produtividade.login_seconds ?? 0),
    pausaSegundos: soma((v) => v.produtividade.pause_seconds ?? 0),
    /** Dias com login acima do limite (ficam sem login, pausa e ocupação) */
    comLoginDesconsiderado: vinculados.filter((v) => v.loginDesconsiderado).length,
  };
}
