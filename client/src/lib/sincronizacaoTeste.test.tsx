import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const MENSAGEM = "Ambiente de teste: a sincronização com a Escallo está desativada. Os dados exibidos são inventados.";
const invocar = vi.fn();
let ambienteSimulado: "teste" | "producao" = "teste";

// O ambiente é decidido pelo endereço do site; aqui simulamos os dois.
vi.mock("@/lib/supabase", async (original) => {
  const real = await original<typeof import("@/lib/supabase")>();
  return {
    ...real,
    get ambiente() {
      return ambienteSimulado;
    },
    getSupabase: () => ({ functions: { invoke: invocar }, from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }), maybeSingle: async () => ({ data: null }) }) }), rpc: async () => ({ error: null }) }),
  };
});

import AtualizarAgoraButton from "@/components/AtualizarAgoraButton";
import SyncEscalloCard from "@/components/SyncEscalloCard";
import { MENSAGEM_SYNC_TESTE, executarSync, sincronizacaoDesativada } from "@/lib/syncApi";

afterEach(() => {
  cleanup();
  invocar.mockReset();
  ambienteSimulado = "teste";
});

describe("sincronização no ambiente de teste", () => {
  it("a mensagem é exatamente a combinada", () => {
    expect(MENSAGEM_SYNC_TESTE).toBe(MENSAGEM);
  });

  it("'Atualizar agora' fica desabilitado, com a explicação ao passar o mouse (balão no invólucro)", () => {
    render(<AtualizarAgoraButton />);
    const botao = screen.getByTestId("atualizar-agora") as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    expect(screen.getByTestId("atualizar-agora-envolucro").getAttribute("title")).toBe(MENSAGEM);
    // leitores de tela recebem o mesmo motivo
    expect(botao.getAttribute("aria-describedby")).toBe("atualizar-agora-motivo");
    expect(document.getElementById("atualizar-agora-motivo")?.textContent).toBe(MENSAGEM);
  });

  it("clicar não chama a função do servidor (que não tem token da Escallo)", async () => {
    render(<AtualizarAgoraButton />);
    await userEvent.setup().click(screen.getByTestId("atualizar-agora"));
    expect(invocar).not.toHaveBeenCalled();
  });

  it("qualquer pedido de sincronização recusa com a mensagem do teste, sem chamar o servidor", async () => {
    for (const modo of ["agora", "simulacao", "manual"] as const) {
      await expect(executarSync(modo, ["2026-11-06"])).rejects.toThrow(MENSAGEM);
    }
    expect(invocar).not.toHaveBeenCalled();
    expect(sincronizacaoDesativada()).toBe(true);
  });

  it("em Configurações o cartão explica e desabilita simular, sincronizar e o agendador", () => {
    render(<SyncEscalloCard />);
    expect(screen.getByTestId("sync-teste-aviso").textContent).toContain(MENSAGEM);
    expect((screen.getByRole("button", { name: /Simular hoje/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /Sincronizar hoje agora/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("switch", { name: "Agendador automático" }).hasAttribute("disabled")).toBe(true);
  });
});

describe("sincronização na produção: nada muda", () => {
  it("o botão continua habilitado e sem balão", () => {
    ambienteSimulado = "producao";
    render(<AtualizarAgoraButton />);
    expect((screen.getByTestId("atualizar-agora") as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId("atualizar-agora-envolucro").getAttribute("title")).toBeNull();
    expect(document.getElementById("atualizar-agora-motivo")).toBeNull();
    expect(sincronizacaoDesativada()).toBe(false);
  });

  it("o pedido segue para a função do servidor como antes", async () => {
    ambienteSimulado = "producao";
    invocar.mockResolvedValue({ data: { planos: [], ok: true, modo: "agora", gravou: true, dias: [], gravacao: {}, totais: {} }, error: null });
    await executarSync("agora");
    expect(invocar).toHaveBeenCalledWith("escallo-sync", { body: { modo: "agora" } });
  });

  it("o cartão de Configurações não mostra aviso de teste", () => {
    ambienteSimulado = "producao";
    render(<SyncEscalloCard />);
    expect(screen.queryByTestId("sync-teste-aviso")).toBeNull();
    expect((screen.getByRole("button", { name: /Simular hoje/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});
