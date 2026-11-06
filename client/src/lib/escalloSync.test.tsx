import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { converterRegistro090, codigoAgente090, esvaziarLogin } from "../../../supabase/functions/escallo-sync/rel090";
import { montarPlanoDia } from "../../../supabase/functions/escallo-sync/plano";
import {
  diasDoPedido,
  sincronizar,
  textoSeguro,
  validarPedidoSync,
  type Deps,
} from "../../../supabase/functions/escallo-sync/sincronizar";
import type { Colaborador, RegistroEscallo } from "../../../supabase/functions/escallo-sync/mapeamento";

// Todos os dados abaixo são inventados.
const DIA = "2026-11-03";
const colaboradores: Colaborador[] = [
  { id: 1, name: "Pessoa Um", escallo_codigo: 101 },
  { id: 2, name: "Pessoa Dois", escallo_codigo: 102 },
  { id: 3, name: "Pessoa Três", escallo_codigo: 103 },
  { id: 4, name: "Sem Código", escallo_codigo: null },
];

const voz = (codigo: number, extra: RegistroEscallo = {}): RegistroEscallo => ({
  codigo, nome: `Agente ${codigo}`,
  ligacoesOferecidasAtendidas: 10, ligacoesRealizadasAtendidas: 2, tempoAtendimento: 1500, tempoRealizadas: 300,
  TMA: 150, tempoLogin: 28_800, tempoPausa: 3_000, pausaLegal: 2_000, pausaProdutiva: 400, pausaImprodutiva: 600,
  percentualPausa: 10.4, TO01: 60.126, TO02: 62, TO03: 0, TO04: 0, chamadasPorHora: 4.567,
  ...extra,
});
const chat = (codigo: number, extra: RegistroEscallo = {}): RegistroEscallo => ({
  codigo, nome: `Agente ${codigo}`,
  atendimentosEntrada: 20, atendimentosSaida: 5, atendimentosTempo: 4000, TMA: 180,
  login: 28_800, pausa: 3_000, percentualPausa: 10.4, pausaLegal: 2_000, pausaProdutiva: 400, pausaImprodutiva: 600,
  TO01: 70.5, TO02: 71, atendimentoHora: 3.25,
  ...extra,
});
const media = { codigo: "_media", nome: "Média" } as RegistroEscallo;

const montar = (rel025: RegistroEscallo[], rel090: RegistroEscallo[], limite: number | null = 43_200) =>
  montarPlanoDia({ dia: DIA, rel025, rel090, colaboradores, limiteLoginSegundos: limite });

describe("sincronização: rel090 (WhatsApp)", () => {
  it("converte entrada, saída, tempos e ocupação como as planilhas REL090", () => {
    const l = converterRegistro090(chat(101), DIA);
    expect(l).toMatchObject({
      channel: "WhatsApp", inbound_count: 20, outbound_count: 5, attendances_count: 25, talk_seconds: 4000, tma_seconds: 180,
      login_seconds: 28_800, pause_seconds: 3_000, occupancy_to1: 70.5, occupancy_to2: 71, occupancy_to3: null, occupancy_to4: null,
      per_hour: 3.25, report_code: "REL090", source_file: "API Escallo",
    });
  });
  it("ignora a linha _media e registros sem código numérico", () => {
    expect(codigoAgente090(media)).toBeNull();
    expect(codigoAgente090(chat(101))).toBe(101);
  });
  it("esvaziar o login limpa só o que depende dele", () => {
    const v = esvaziarLogin(converterRegistro090(chat(101), DIA));
    expect(v.login_seconds).toBeNull();
    expect(v.pause_seconds).toBeNull();
    expect(v.per_hour).toBeNull();
    expect(v.attendances_count).toBe(25);
    expect(v.talk_seconds).toBe(4000);
  });
});

describe("sincronização: regras do dia", () => {
  it("só grava colaboradores vinculados, nunca cria, e conta quem ficou sem vínculo", () => {
    const p = montar([voz(101), voz(999)], [chat(101), chat(888), media]);
    expect(p.linhas.map((l) => l.attendant_id).sort()).toEqual([1, 1]);
    expect(p.resumo.semVinculoComAtendimento).toBe(2);
    expect(p.resumo.rel090Agentes).toBe(2); // a _media não conta
  });

  it("ligação só de quem atendeu; WhatsApp só de quem atendeu; login do agente conta para o alerta mesmo sem linha", () => {
    const semLigacao = voz(102, { ligacoesOferecidasAtendidas: 0, ligacoesRealizadasAtendidas: 0 });
    const p = montar([voz(101), semLigacao], [chat(101), chat(102, { atendimentosEntrada: 0, atendimentosSaida: 0 })]);
    expect(p.linhas.filter((l) => l.channel === "Ligação").map((l) => l.attendant_id)).toEqual([1]);
    expect(p.linhas.filter((l) => l.channel === "WhatsApp").map((l) => l.attendant_id)).toEqual([1]);
    expect(p.resumo.linhasLigacao).toBe(1);
    expect(p.resumo.linhasWhatsapp).toBe(1);
  });

  it("monta a linha de ligação no formato da função do banco", () => {
    const l = montar([voz(101)], []).linhas[0];
    expect(l).toMatchObject({
      attendant_id: 1, channel: "Ligação", inbound: 10, outbound: 2, atend: 12, talk: 1800, tma: 150, login: 28_800, pause: 3_000,
      pause_pct: 10.4, legal: 2_000, productive: 400, unproductive: 600, to1: 60.13, to2: 62, to3: null, to4: null, per_hour: 4.57,
      report_code: "REL025", media_min: 2.5,
    });
  });

  it("login acima do limite em UM canal: esvazia os DOIS canais, grava atendimentos e gera 1 alerta com o maior login", () => {
    const p = montar([voz(101, { tempoLogin: 50_000 })], [chat(101, { login: 40_000 })]);
    expect(p.linhas).toHaveLength(2);
    for (const l of p.linhas) {
      expect(l.login).toBeNull();
      expect(l.pause).toBeNull();
      expect(l.to1).toBeNull();
      expect(l.per_hour).toBeNull();
      expect(l.atend).toBeGreaterThan(0);
    }
    expect(p.alertas).toEqual([{ attendant_id: 1, login_seconds: 50_000, limit_seconds: 43_200 }]);
    expect(p.resumo.loginEsvaziado).toBe(2);
  });

  it("login exatamente no limite não passa; limite desligado (null) não tem alerta", () => {
    expect(montar([voz(101, { tempoLogin: 43_200 })], []).alertas).toEqual([]);
    const desligado = montar([voz(101, { tempoLogin: 99_000 })], [], null);
    expect(desligado.alertas).toEqual([]);
    expect(desligado.linhas[0].login).toBe(99_000);
  });

  it("alerta mesmo quando o agente que passou do limite não teve ligação (só WhatsApp)", () => {
    const p = montar([voz(103, { ligacoesOferecidasAtendidas: 0, ligacoesRealizadasAtendidas: 0, tempoLogin: 60_000 })], [chat(103, { login: 60_000 })]);
    expect(p.alertas).toHaveLength(1);
    expect(p.linhas).toHaveLength(1);
    expect(p.linhas[0].login).toBeNull();
  });

  it("é determinístico: os mesmos dados dão o mesmo plano (rodar de novo não muda nada)", () => {
    const dados = [[voz(101), voz(102, { tempoLogin: 60_000 })], [chat(101), chat(102), chat(103)]] as const;
    expect(JSON.stringify(montar([...dados[0]], [...dados[1]]))).toBe(JSON.stringify(montar([...dados[0]], [...dados[1]])));
  });
});

describe("sincronização: pedido", () => {
  const hoje = "2026-11-05";
  it("hoje e fechamento escolhem o dia sozinhos", () => {
    expect(diasDoPedido({ modo: "hoje" }, hoje)).toEqual(["2026-11-05"]);
    expect(diasDoPedido({ modo: "fechamento" }, hoje)).toEqual(["2026-11-04"]);
    expect(diasDoPedido({ modo: "fechamento" }, "2026-11-01")).toEqual(["2026-10-31"]);
  });
  it("aceita só os campos e modos conhecidos", () => {
    expect(validarPedidoSync({ modo: "hoje" }, hoje)).toEqual({ pedido: { modo: "hoje" } });
    expect("erro" in validarPedidoSync({ modo: "hoje", dias: ["2026-11-03"] }, hoje)).toBe(true);
    expect("erro" in validarPedidoSync({ modo: "apagar" }, hoje)).toBe(true);
    expect("erro" in validarPedidoSync({ modo: "hoje", extra: 1 }, hoje)).toBe(true);
    expect("erro" in validarPedidoSync(null, hoje)).toBe(true);
    expect("erro" in validarPedidoSync([], hoje)).toBe(true);
  });
  it("simulação e manual exigem dias válidos, passados, sem repetir, no máximo 7", () => {
    expect(validarPedidoSync({ modo: "simulacao", dias: ["2026-11-04", "2026-11-03", "2026-11-03"] }, hoje)).toEqual({ pedido: { modo: "simulacao", dias: ["2026-11-03", "2026-11-04"] } });
    expect("erro" in validarPedidoSync({ modo: "manual" }, hoje)).toBe(true);
    expect("erro" in validarPedidoSync({ modo: "manual", dias: [] }, hoje)).toBe(true);
    expect("erro" in validarPedidoSync({ modo: "manual", dias: ["2026-11-31"] }, hoje)).toBe(true);
    expect("erro" in validarPedidoSync({ modo: "manual", dias: ["2026-11-06"] }, hoje)).toBe(true);
    expect("erro" in validarPedidoSync({ modo: "manual", dias: Array.from({ length: 8 }, (_, i) => `2026-10-0${i + 1}`) }, hoje)).toBe(true);
  });
  it("o token nunca aparece em mensagens", () => {
    const t = "segredo-123";
    expect(textoSeguro(new Error(`falhou com ${t} e Partner ${t}`), t)).not.toContain(t);
    expect(textoSeguro("Authorization: Partner abc.def", undefined)).not.toContain("abc.def");
    expect(textoSeguro("x".repeat(900), undefined).length).toBeLessThanOrEqual(500);
  });
});

describe("sincronização: orquestração", () => {
  function deps(extra: Partial<Deps> = {}) {
    const chamadas = { buscas: [] as string[], gravados: [] as string[], esperas: 0 };
    const d: Deps = {
      async buscarRelatorio(rel, dia) {
        chamadas.buscas.push(`${rel}@${dia}`);
        return rel === "rel025" ? [voz(101)] : [chat(101), media];
      },
      async lerColaboradores() { return colaboradores; },
      async lerLimiteLogin() { return 43_200; },
      async aplicarDia(plano) {
        chamadas.gravados.push(plano.dia);
        return { inseridas: plano.linhas.length, atualizadas: 0, puladas_manuais: 0, alertas_novos: plano.alertas.length };
      },
      async esperar() { chamadas.esperas += 1; },
      ...extra,
    };
    return { d, chamadas };
  }

  it("simulação busca e calcula, mas NÃO grava", async () => {
    const { d, chamadas } = deps();
    const r = await sincronizar(d, { modo: "simulacao", dias: ["2026-11-03", "2026-11-04"] }, "2026-11-05");
    expect(r.gravou).toBe(false);
    expect(chamadas.gravados).toEqual([]);
    expect(chamadas.buscas).toEqual(["rel025@2026-11-03", "rel090@2026-11-03", "rel025@2026-11-04", "rel090@2026-11-04"]);
    expect(r.planos).toHaveLength(2);
    expect(chamadas.esperas).toBe(1); // pausa entre os dois dias, não depois do último
  });

  it("hoje grava só o dia de hoje; fechamento grava só o dia anterior", async () => {
    const a = deps();
    await sincronizar(a.d, { modo: "hoje" }, "2026-11-05");
    expect(a.chamadas.gravados).toEqual(["2026-11-05"]);
    const b = deps();
    const r = await sincronizar(b.d, { modo: "fechamento" }, "2026-11-05");
    expect(b.chamadas.gravados).toEqual(["2026-11-04"]);
    expect(r.gravacao.inseridas).toBe(2);
  });

  it("erro ao buscar na Escallo interrompe e nada é gravado depois", async () => {
    const { d, chamadas } = deps({ async buscarRelatorio() { throw new Error("rel025 falhou"); } });
    await expect(sincronizar(d, { modo: "hoje" }, "2026-11-05")).rejects.toThrow("rel025 falhou");
    expect(chamadas.gravados).toEqual([]);
  });
});

describe("sincronização: arquivos", () => {
  it("a cópia de mapeamento.ts na função é idêntica à da escallo-rel025 (uma só regra)", () => {
    const base = join(process.cwd(), "supabase", "functions");
    const a = readFileSync(join(base, "escallo-rel025", "mapeamento.ts"), "utf8").replace(/\r\n/g, "\n");
    const b = readFileSync(join(base, "escallo-sync", "mapeamento.ts"), "utf8").replace(/\r\n/g, "\n");
    expect(b).toBe(a);
  });
  it("nenhum token, chave ou URL com segredo está escrito no código da função", () => {
    const dir = join(process.cwd(), "supabase", "functions", "escallo-sync");
    for (const f of ["index.ts", "sincronizar.ts", "plano.ts", "rel090.ts"]) {
      const t = readFileSync(join(dir, f), "utf8");
      expect(t).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/); // JWT
      expect(t).not.toMatch(/Partner [A-Za-z0-9]{12,}/);
      // log que imprime uma variável secreta (texto entre aspas não conta)
      expect(t).not.toMatch(/console\.log\([^"'`]*\b(token|chave|tokenEscallo|serviceKey)\b/i);
    }
  });
});
