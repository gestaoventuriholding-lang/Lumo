// Ellos: orquestra uma sincronização (quais dias, buscar, montar, gravar). Sem Deno e sem Supabase aqui: tudo que toca o
// mundo de fora entra por `deps`, então a mesma lógica roda no servidor, nos testes e na simulação local.
import { hojeSaoPaulo, type RegistroEscallo } from "./mapeamento.ts";
import { montarPlanoDia, type AvisoSync, type ColaboradorSync, type PlanoDia } from "./plano.ts";

/** Modos que ficam registrados em sync_runs */
export type Modo = "hoje" | "fechamento" | "manual" | "simulacao";
/** O que se pode pedir à função. "agora" é o botão "Atualizar agora" (qualquer pessoa da equipe): sincroniza hoje e fica registrado como "manual". */
export type ModoPedido = Modo | "agora";
export const MODOS: readonly ModoPedido[] = ["hoje", "fechamento", "manual", "simulacao", "agora"];
/** Intervalo mínimo entre duas atualizações pelo botão (qualquer execução que gravou conta) */
export const JANELA_ATUALIZAR_AGORA_MIN = 5;
/** Modos que o agendador (chave secreta) pode pedir. Os outros só um administrador logado. */
export const MODOS_DO_AGENDADOR: readonly Modo[] = ["hoje", "fechamento"];
export const MAX_DIAS_POR_PEDIDO = 7;

export interface PedidoSync {
  modo: ModoPedido;
  /** Só em manual e simulação */
  dias?: string[];
}

export interface ResultadoGravacao {
  inseridas: number;
  atualizadas: number;
  puladas_manuais: number;
  alertas_novos: number;
}

export interface Deps {
  buscarRelatorio(rel: "rel025" | "rel090", dia: string): Promise<RegistroEscallo[]>;
  lerColaboradores(): Promise<ColaboradorSync[]>;
  /** null = regra do login desligada */
  lerLimiteLogin(): Promise<number | null>;
  aplicarDia(plano: PlanoDia): Promise<ResultadoGravacao>;
  esperar(ms: number): Promise<void>;
}

export interface ResultadoSync {
  modo: ModoPedido;
  gravou: boolean;
  dias: string[];
  planos: PlanoDia[];
  gravacao: ResultadoGravacao;
  totais: {
    rel025Agentes: number;
    rel090Agentes: number;
    loginEsvaziado: number;
    semVinculoComAtendimento: number;
    ignoradosDesligados: number;
  };
  /** Avisos de todos os dias (ex.: atendimento de desligado, ignorado) */
  avisos: AvisoSync[];
}

const dataValida = (s: unknown): s is string => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

const somarDias = (dia: string, n: number) => new Date(new Date(`${dia}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

/** Valida o corpo da chamada. Só aceita { modo, dias? }. */
export function validarPedidoSync(corpo: unknown, hoje: string): { pedido: PedidoSync } | { erro: string } {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return { erro: "Pedido inválido." };
  const c = corpo as Record<string, unknown>;
  const extra = Object.keys(c).find((k) => k !== "modo" && k !== "dias");
  if (extra) return { erro: `Campo não aceito: ${extra}.` };
  if (typeof c.modo !== "string" || !(MODOS as readonly string[]).includes(c.modo)) {
    return { erro: `Informe o modo: ${MODOS.join(", ")}.` };
  }
  const modo = c.modo as ModoPedido;
  if (modo === "hoje" || modo === "fechamento" || modo === "agora") {
    if (c.dias !== undefined) return { erro: `O modo ${modo} não aceita dias: ele escolhe o dia sozinho.` };
    return { pedido: { modo } };
  }
  if (!Array.isArray(c.dias) || c.dias.length === 0) return { erro: `O modo ${modo} precisa de "dias", por exemplo ["2026-11-03"].` };
  if (c.dias.length > MAX_DIAS_POR_PEDIDO) return { erro: `No máximo ${MAX_DIAS_POR_PEDIDO} dias por pedido.` };
  const dias: string[] = [];
  for (const d of c.dias) {
    if (!dataValida(d)) return { erro: `Dia inválido: informe AAAA-MM-DD.` };
    if (d > hoje) return { erro: "Escolha dias que já começaram. A Escallo não tem relatório de datas futuras." };
    if (!dias.includes(d)) dias.push(d);
  }
  return { pedido: { modo, dias: dias.sort() } };
}

/** Dias que cada modo cobre. hoje = o dia de hoje; fechamento = o dia anterior inteiro. */
export function diasDoPedido(pedido: PedidoSync, hoje: string): string[] {
  if (pedido.modo === "hoje" || pedido.modo === "agora") return [hoje];
  if (pedido.modo === "fechamento") return [somarDias(hoje, -1)];
  return pedido.dias ?? [];
}

/** Modo como fica gravado em sync_runs ("agora" é uma execução manual) */
export function modoRegistrado(modo: ModoPedido): Modo {
  return modo === "agora" ? "manual" : modo;
}

/**
 * Limite do botão "Atualizar agora": no máximo 1 atualização a cada 5 minutos.
 * `ultimoSucessoFim` é o fim da última execução que gravou (de qualquer origem). Devolve null se pode rodar.
 */
export function limiteAtualizarAgora(
  ultimoSucessoFim: Date | null,
  agora: Date,
  janelaMin: number = JANELA_ATUALIZAR_AGORA_MIN
): { atualizadoHaMin: number; tenteEmMin: number; mensagem: string } | null {
  if (!ultimoSucessoFim) return null;
  const decorridoMs = agora.getTime() - ultimoSucessoFim.getTime();
  if (decorridoMs >= janelaMin * 60_000 || decorridoMs < 0) return null;
  const atualizadoHaMin = Math.floor(decorridoMs / 60_000);
  const tenteEmMin = Math.max(1, Math.ceil((janelaMin * 60_000 - decorridoMs) / 60_000));
  const plural = (n: number) => (n === 1 ? "1 minuto" : `${n} minutos`);
  const ha = atualizadoHaMin === 0 ? "menos de 1 minuto" : plural(atualizadoHaMin);
  return { atualizadoHaMin, tenteEmMin, mensagem: `Atualizado há ${ha}. Tente de novo em ${plural(tenteEmMin)}.` };
}

/** Tira o token de qualquer texto e limita o tamanho (para o registro e para as respostas) */
export function textoSeguro(valor: unknown, token: string | undefined, max = 500): string {
  let t = valor instanceof Error ? valor.message : String(valor ?? "");
  if (token) t = t.split(token).join("***");
  t = t.replace(/Partner\s+\S+/gi, "Partner ***");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

const VAZIA: ResultadoGravacao = { inseridas: 0, atualizadas: 0, puladas_manuais: 0, alertas_novos: 0 };

export async function sincronizar(deps: Deps, pedido: PedidoSync, hoje: string = hojeSaoPaulo()): Promise<ResultadoSync> {
  const dias = diasDoPedido(pedido, hoje);
  const gravar = pedido.modo !== "simulacao"; // hoje, fechamento, manual e agora gravam
  const colaboradores = await deps.lerColaboradores();
  const limite = await deps.lerLimiteLogin();

  const planos: PlanoDia[] = [];
  const gravacao = { ...VAZIA };
  for (let i = 0; i < dias.length; i++) {
    const dia = dias[i];
    const rel025 = await deps.buscarRelatorio("rel025", dia);
    const rel090 = await deps.buscarRelatorio("rel090", dia);
    const plano = montarPlanoDia({ dia, rel025, rel090, colaboradores, limiteLoginSegundos: limite });
    planos.push(plano);
    if (gravar) {
      const r = await deps.aplicarDia(plano);
      gravacao.inseridas += r.inseridas;
      gravacao.atualizadas += r.atualizadas;
      gravacao.puladas_manuais += r.puladas_manuais;
      gravacao.alertas_novos += r.alertas_novos;
    }
    if (i < dias.length - 1) await deps.esperar(1500);
  }
  const soma = (f: (p: PlanoDia) => number) => planos.reduce((s, p) => s + f(p), 0);
  return {
    modo: pedido.modo,
    gravou: gravar,
    dias,
    planos,
    gravacao,
    totais: {
      rel025Agentes: soma((p) => p.resumo.rel025Agentes),
      rel090Agentes: soma((p) => p.resumo.rel090Agentes),
      loginEsvaziado: soma((p) => p.resumo.loginEsvaziado),
      semVinculoComAtendimento: soma((p) => p.resumo.semVinculoComAtendimento),
      ignoradosDesligados: soma((p) => p.resumo.ignoradosDesligados),
    },
    avisos: planos.flatMap((p) => p.avisos),
  };
}
