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
  runFromRow,
  textoAtualizado,
  ultimoSucesso,
  type SyncRun,
} from "./syncStatus";
import { mesclarPorId } from "./cloudStore";
import SyncEscalloCard, { resumoDaExecucao } from "@/components/SyncEscalloCard";

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

describe("sincronização: alerta de 90 minutos sem sucesso", () => {
  it("com o agendador ligado, em horário comercial, passou de 90 min: alerta", () => {
    const a = avaliarSincronizacao([run({ status: "ok", hora: "12:00" })], true, new Date(iso("13:31")));
    expect(a).toMatchObject({ tipo: "parada", minutos: 91 });
  });
  it("até 90 minutos não alerta", () => {
    expect(avaliarSincronizacao([run({ status: "ok", hora: "12:00" })], true, new Date(iso("13:30")))).toBeNull();
  });
  it("agendador desligado, fora do horário ou domingo: não alerta", () => {
    const runs = [run({ status: "ok", hora: "08:00" })];
    expect(avaliarSincronizacao(runs, false, new Date(iso("14:00")))).toBeNull();
    expect(avaliarSincronizacao(runs, true, new Date(iso("20:00")))).toBeNull();
    expect(avaliarSincronizacao(runs, true, new Date(iso("14:00", "2026-11-08")))).toBeNull();
  });
  it("horário comercial: segunda a sábado das 07:00 às 19:30", () => {
    expect(emHorarioComercial(new Date(iso("06:59")))).toBe(false);
    expect(emHorarioComercial(new Date(iso("07:00")))).toBe(true);
    expect(emHorarioComercial(new Date(iso("19:30")))).toBe(true);
    expect(emHorarioComercial(new Date(iso("19:31")))).toBe(false);
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
    const parada = alertaParaSino(avaliarSincronizacao([run({ status: "ok", hora: "12:00" })], true, new Date(iso("14:00"))));
    expect(parada[0]).toMatchObject({ alertLevel: "yellow", kind: "sync" });
    expect(parada[0].message).toContain("90 minutos");
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
