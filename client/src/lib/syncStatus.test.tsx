import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  alertaParaSino,
  avaliarSincronizacao,
  emHorarioComercial,
  execucoesQueContam,
  horaSp,
  limiteAtualizarAgora,
  runFromRow,
  textoAtualizado,
  ultimoSucesso,
  type SyncRun,
} from "./syncStatus";
import { mesclarPorId } from "./cloudStore";
import SyncEscalloCard, { resumoDaExecucao } from "@/components/SyncEscalloCard";
import AtualizarAgoraButton from "@/components/AtualizarAgoraButton";
import { limiteAtualizarAgora as limiteDoServidor, modoRegistrado, validarPedidoSync, diasDoPedido } from "../../../supabase/functions/escallo-sync/sincronizar";

// Quinta 05/11/2026. Brasília = UTC-3. Todos os dados são inventados.
const iso = (hhmmBrasilia: string, dia = "2026-11-05") => {
  const [h, m] = hhmmBrasilia.split(":").map(Number);
  return new Date(Date.UTC(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, Number(dia.slice(8, 10)), h + 3, m)).toISOString();
};
let contador = 0;
function run(extra: Partial<SyncRun> & { status: SyncRun["status"]; hora: string }): SyncRun {
  const { hora, ...resto } = extra;
  contador += 1;
  return {
    id: `r${contador}`, mode: "hoje", triggeredBy: "agendador", days: ["2026-11-05"], startedAt: iso(hora), finishedAt: iso(hora),
    rowsInserted: 0, rowsUpdated: 0, rowsSkippedManual: 0, loginBlanked: 0, alertsCreated: 0, unlinkedWithActivity: 0, error: null, durationMs: 1000,
    ...resto,
  };
}

describe("sincronização: Atualizado às HH:MM", () => {
  const agora = new Date(iso("15:00"));
  it("mostra a hora da última execução concluída, em horário de Brasília", () => {
    expect(textoAtualizado([run({ status: "ok", hora: "14:30" })], agora)).toBe("Atualizado às 14:30");
    expect(horaSp(iso("09:05"))).toBe("09:05");
  });
  it("de outro dia, mostra a data junto", () => {
    expect(textoAtualizado([{ ...run({ status: "ok", hora: "03:30" }), startedAt: iso("03:30", "2026-11-04"), finishedAt: iso("03:30", "2026-11-04") }], agora)).toBe("Atualizado em 04/11 às 03:30");
  });
  it("sem execução concluída não mostra nada", () => {
    expect(textoAtualizado([], agora)).toBeNull();
    expect(textoAtualizado([run({ status: "erro", hora: "14:00" })], agora)).toBeNull();
  });
  it("simulação e execução pulada não contam como atualização", () => {
    const runs = [run({ status: "ok", mode: "simulacao", hora: "14:50" }), run({ status: "pulado", hora: "14:40" }), run({ status: "ok", hora: "14:00" })];
    expect(execucoesQueContam(runs)).toHaveLength(1);
    expect(textoAtualizado(runs, agora)).toBe("Atualizado às 14:00");
    expect(ultimoSucesso(runs)?.startedAt).toBe(iso("14:00"));
  });
});

describe("sincronização: alerta de falha (segunda execução seguida com erro)", () => {
  const agora = new Date(iso("15:00"));
  it("uma falha só não gera alerta", () => {
    expect(avaliarSincronizacao([run({ status: "erro", hora: "14:30", error: "x" }), run({ status: "ok", hora: "14:00" })], false, agora)).toBeNull();
  });
  it("duas falhas seguidas geram alerta, com o último sucesso e o erro", () => {
    const a = avaliarSincronizacao([run({ status: "erro", hora: "14:30", error: "Escallo fora do ar" }), run({ status: "erro", hora: "14:00" }), run({ status: "ok", hora: "13:30" })], false, agora);
    expect(a).toMatchObject({ tipo: "falha", ultimoErro: "Escallo fora do ar" });
    expect(a && a.ultimoSucesso).toBe(iso("13:30"));
  });
  it("erro, sucesso, erro não é 'duas seguidas'", () => {
    expect(avaliarSincronizacao([run({ status: "erro", hora: "14:30" }), run({ status: "ok", hora: "14:00" }), run({ status: "erro", hora: "13:30" })], false, agora)).toBeNull();
  });
  it("simulação com erro e execução pulada entre as falhas não interferem", () => {
    const runs = [run({ status: "erro", hora: "14:30" }), run({ status: "erro", mode: "simulacao", hora: "14:20" }), run({ status: "pulado", hora: "14:10" }), run({ status: "ok", hora: "14:00" })];
    expect(avaliarSincronizacao(runs, false, agora)).toBeNull();
  });
  it("o alerta some sozinho quando uma execução dá certo", () => {
    expect(avaliarSincronizacao([run({ status: "ok", hora: "14:45" }), run({ status: "erro", hora: "14:30" }), run({ status: "erro", hora: "14:00" })], false, agora)).toBeNull();
  });
});

describe("sincronização: alerta de 150 minutos sem sucesso (o agendador roda de hora em hora)", () => {
  it("com o agendador ligado, em horário comercial, passou de 150 min: alerta", () => {
    const a = avaliarSincronizacao([run({ status: "ok", hora: "12:00" })], true, new Date(iso("14:31")));
    expect(a).toMatchObject({ tipo: "parada", minutos: 151 });
  });
  it("até 150 minutos não alerta (uma rodada perdida de hora em hora ainda cabe)", () => {
    expect(avaliarSincronizacao([run({ status: "ok", hora: "12:00" })], true, new Date(iso("14:30")))).toBeNull();
    expect(avaliarSincronizacao([run({ status: "ok", hora: "12:00" })], true, new Date(iso("13:31")))).toBeNull(); // 91 min: antes alertava, agora não
  });
  it("agendador desligado, fora do horário ou domingo: não alerta", () => {
    const runs = [run({ status: "ok", hora: "08:00" })];
    expect(avaliarSincronizacao(runs, false, new Date(iso("14:00")))).toBeNull();
    expect(avaliarSincronizacao(runs, true, new Date(iso("21:00")))).toBeNull();
    expect(avaliarSincronizacao(runs, true, new Date(iso("14:00", "2026-11-08")))).toBeNull();
  });
  it("horário comercial: segunda a sábado das 06:00 às 20:30 (rodadas de hora em hora, de 06:00 a 20:00)", () => {
    expect(emHorarioComercial(new Date(iso("05:59")))).toBe(false);
    expect(emHorarioComercial(new Date(iso("06:00")))).toBe(true);
    expect(emHorarioComercial(new Date(iso("20:30")))).toBe(true);
    expect(emHorarioComercial(new Date(iso("20:31")))).toBe(false);
    expect(emHorarioComercial(new Date(iso("10:00", "2026-11-07")))).toBe(true); // sábado
    expect(emHorarioComercial(new Date(iso("10:00", "2026-11-08")))).toBe(false); // domingo
  });
});

describe("sincronização: alerta no sino", () => {
  const agora = new Date(iso("15:00"));
  it("falha é vermelho e parada é amarelo, com id negativo que muda a cada problema novo", () => {
    const falha1 = alertaParaSino(avaliarSincronizacao([run({ status: "erro", hora: "14:30" }), run({ status: "erro", hora: "14:00" })], false, agora));
    const falha2 = alertaParaSino(avaliarSincronizacao([run({ status: "erro", hora: "14:45" }), run({ status: "erro", hora: "14:30" })], false, agora));
    expect(falha1[0]).toMatchObject({ alertLevel: "red", attendantName: "Sincronização com a Escallo", kind: "sync" });
    expect(falha1[0].id).toBeLessThan(0);
    expect(falha1[0].id).not.toBe(falha2[0].id);
    const parada = alertaParaSino(avaliarSincronizacao([run({ status: "ok", hora: "12:00" })], true, new Date(iso("14:31"))));
    expect(parada[0]).toMatchObject({ alertLevel: "yellow", kind: "sync" });
    expect(parada[0].message).toContain("150 minutos");
  });
  it("sem problema não há alerta, e o erro mostrado não traz token", () => {
    expect(alertaParaSino(null)).toEqual([]);
    const a = alertaParaSino(avaliarSincronizacao([run({ status: "erro", hora: "14:30", error: "rel025 2026-11-05: HTTP 500" }), run({ status: "erro", hora: "14:00" })], false, agora));
    expect(a[0].footer).toContain("HTTP 500");
  });
});

describe("sincronização: leitura do banco", () => {
  it("converte a linha de sync_runs", () => {
    const r = runFromRow({ id: "abc", mode: "fechamento", triggered_by: "pessoa", days: ["2026-11-04"], started_at: "2026-11-05T06:30:00Z", finished_at: null, status: "executando", rows_inserted: 3 });
    expect(r).toMatchObject({ id: "abc", mode: "fechamento", triggeredBy: "pessoa", days: ["2026-11-04"], finishedAt: null, rowsInserted: 3, rowsUpdated: 0, error: null });
  });
});

describe("atualização automática: mesclar por id", () => {
  it("troca o que mudou no mesmo lugar, acrescenta o novo e não mexe no resto", () => {
    const atual = [{ id: 1, atend: 10 }, { id: 2, atend: 20 }];
    const r = mesclarPorId(atual, [{ id: 2, atend: 25 }, { id: 3, atend: 5 }]);
    expect(r.mudou).toBe(true);
    expect(r.lista).toEqual([{ id: 1, atend: 10 }, { id: 2, atend: 25 }, { id: 3, atend: 5 }]);
    expect(atual).toEqual([{ id: 1, atend: 10 }, { id: 2, atend: 20 }]); // não altera a lista original
  });
  it("o que veio igual não conta como mudança (a tela não redesenha à toa)", () => {
    const r = mesclarPorId([{ id: 1, atend: 10 }], [{ id: 1, atend: 10 }]);
    expect(r.mudou).toBe(false);
  });
  it("ids como texto e número batem", () => {
    expect(mesclarPorId([{ id: 7, v: 1 }], [{ id: "7", v: 1 }]).mudou).toBe(true); // o objeto é diferente (id de outro tipo)
    expect(mesclarPorId([{ id: 7, v: 1 }], [{ id: 7, v: 2 }]).lista).toHaveLength(1);
  });
});

describe("Configurações: card da sincronização", () => {
  it("mostra o agendador, os botões e a lista de execuções", () => {
    const html = renderToStaticMarkup(<SyncEscalloCard />);
    expect(html).toContain("Sincronização com a Escallo");
    expect(html).toContain("Agendador automático");
    expect(html).toContain("Desligado: nada roda sozinho");
    expect(html).toContain("Simular hoje");
    expect(html).toContain("Sincronizar hoje agora");
    expect(html).toContain("Últimas execuções");
    expect(html).toContain("Nenhuma execução registrada ainda.");
  });
  it("resume uma execução em português", () => {
    const base = run({ status: "ok", hora: "10:00", rowsInserted: 4, rowsUpdated: 20, rowsSkippedManual: 1, loginBlanked: 2, alertsCreated: 1 });
    expect(resumoDaExecucao(base)).toBe("4 novas · 20 atualizadas · 1 de planilha/manual preservadas · 2 com login desconsiderado · 1 alerta(s) novo(s)");
    expect(resumoDaExecucao(run({ status: "erro", hora: "10:00", error: "rel090 falhou" }))).toBe("rel090 falhou");
  });
});

describe("Dashboard: hora da sincronização", () => {
  it("não usa mais a hora em que a página abriu", () => {
    const src = readFileSync(join(process.cwd(), "client", "src", "pages", "Dashboard.tsx"), "utf8");
    expect(src).not.toContain("Dados atualizados em");
    expect(src).toContain("atualizadoTexto");
  });
});

describe("Atualizar agora: no máximo 1 vez a cada 5 minutos", () => {
  it("antes de 5 minutos avisa há quanto tempo atualizou e em quanto tempo tentar", () => {
    const runs = [run({ status: "ok", hora: "14:00" })];
    expect(limiteAtualizarAgora(runs, new Date(iso("14:00")))).toMatchObject({ atualizadoHaMin: 0, tenteEmMin: 5, mensagem: "Atualizado há menos de 1 minuto. Tente de novo em 5 minutos." });
    expect(limiteAtualizarAgora(runs, new Date(iso("14:02")))?.mensagem).toBe("Atualizado há 2 minutos. Tente de novo em 3 minutos.");
    expect(limiteAtualizarAgora(runs, new Date(iso("14:04")))?.mensagem).toBe("Atualizado há 4 minutos. Tente de novo em 1 minuto.");
  });
  it("a partir de 5 minutos libera; sem nenhuma atualização também", () => {
    expect(limiteAtualizarAgora([run({ status: "ok", hora: "14:00" })], new Date(iso("14:05")))).toBeNull();
    expect(limiteAtualizarAgora([], new Date(iso("14:00")))).toBeNull();
  });
  it("só conta execução que gravou: simulação, erro e pulada não seguram o botão", () => {
    const runs = [run({ status: "ok", mode: "simulacao", hora: "14:01" }), run({ status: "erro", hora: "14:01" }), run({ status: "pulado", hora: "14:01" }), run({ status: "ok", hora: "13:00" })];
    expect(limiteAtualizarAgora(runs, new Date(iso("14:02")))).toBeNull();
  });
  it("conta também a execução do agendador (qualquer origem)", () => {
    expect(limiteAtualizarAgora([run({ status: "ok", triggeredBy: "agendador", hora: "14:00" })], new Date(iso("14:03")))).not.toBeNull();
  });
  it("a tela e o servidor aplicam exatamente a mesma regra", () => {
    const fim = new Date(iso("14:00"));
    for (const minutos of [0, 1, 2, 3, 4, 5, 6, 30]) {
      const agora = new Date(fim.getTime() + minutos * 60_000 + 20_000);
      expect(limiteDoServidor(fim, agora)).toEqual(limiteAtualizarAgora([run({ status: "ok", hora: "14:00" })], agora));
    }
  });
});

describe("Atualizar agora: pedido à função", () => {
  it("'agora' não leva dias, escolhe hoje e fica registrado como execução manual", () => {
    expect(validarPedidoSync({ modo: "agora" }, "2026-11-05")).toEqual({ pedido: { modo: "agora" } });
    expect("erro" in validarPedidoSync({ modo: "agora", dias: ["2026-11-03"] }, "2026-11-05")).toBe(true);
    expect(diasDoPedido({ modo: "agora" }, "2026-11-05")).toEqual(["2026-11-05"]);
    expect(modoRegistrado("agora")).toBe("manual");
    expect(modoRegistrado("hoje")).toBe("hoje");
  });
  it("a função deixa a equipe usar só 'agora' e o administrador o resto; o agendador só hoje e fechamento", () => {
    const src = readFileSync(join(process.cwd(), "supabase", "functions", "escallo-sync", "index.ts"), "utf8");
    expect(src).toContain('rpc("is_member")');
    expect(src).toMatch(/!ehAdmin && pedido\.modo !== "agora"/);
    expect(src).toContain("429");
    expect(src).toContain("limiteAtualizarAgora");
  });
});

describe("Atualizar agora: botão no Dashboard", () => {
  it("aparece no cabeçalho do Dashboard com o texto do botão", () => {
    const html = renderToStaticMarkup(<AtualizarAgoraButton />);
    expect(html).toContain("Atualizar agora");
    expect(html).not.toContain("Atualizando");
    const src = readFileSync(join(process.cwd(), "client", "src", "pages", "Dashboard.tsx"), "utf8");
    expect(src).toContain("<AtualizarAgoraButton />");
  });
  it("mostra 'Atualizando…' enquanto roda e desabilita o botão", () => {
    const src = readFileSync(join(process.cwd(), "client", "src", "components", "AtualizarAgoraButton.tsx"), "utf8");
    expect(src).toContain('"Atualizando…"');
    expect(src).toContain("disabled={atualizando}");
  });
});

describe("Tempo real", () => {
  it("assina as quatro tabelas, com atualização de reserva e debounce", () => {
    const src = readFileSync(join(process.cwd(), "client", "src", "contexts", "SyncStatusContext.tsx"), "utf8");
    for (const t of ["performance_records", "productivity_reports", "login_alerts", "sync_runs"]) expect(src).toContain(t);
    expect(src).toContain("postgres_changes");
    expect(src).toContain("visibilitychange"); // reserva ao voltar para a aba
    expect(src).toContain("INTERVALO_ATUALIZACAO_MS");
  });
  it("o card de Configurações explica quando o tempo real está indisponível", () => {
    const html = renderToStaticMarkup(<SyncEscalloCard />);
    expect(html).toContain("Tempo real indisponível agora");
    expect(html).toContain("de hora em hora das 6h às 20h");
  });
});
