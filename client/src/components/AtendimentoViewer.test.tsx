import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AtendimentoViewer from "./AtendimentoViewer";
import * as escallo from "@/lib/atendimentoEscallo";

const conversa = {
  tipo: "conversa" as const,
  protocolo: "P1",
  agentes: [],
  mensagens: [{ id: 1, direcao: "Enviado", etapa: "", dataHora: "2026-11-25 10:00:00", conteudo: "Segue o orçamento" }],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Conversa do atendimento", () => {
  it("no Follow-up abre sozinha, sem botão para carregar", async () => {
    const buscar = vi.spyOn(escallo, "buscarConversa").mockResolvedValue(conversa as never);
    render(<AtendimentoViewer canal="WhatsApp" protocolo="P1" dia="2026-11-25" somenteEste />);
    expect(await screen.findByText("Segue o orçamento")).toBeTruthy();
    expect(screen.queryByTestId("carregar-conversa")).toBeNull();
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(buscar).toHaveBeenCalledWith("P1", "2026-11-25");
  });

  it("se falhar, mostra o erro e deixa tentar de novo", async () => {
    const buscar = vi.spyOn(escallo, "buscarConversa").mockRejectedValueOnce(new Error("Sem resposta da Escallo.")).mockResolvedValue(conversa as never);
    render(<AtendimentoViewer canal="WhatsApp" protocolo="P1" dia="2026-11-25" somenteEste />);
    expect(await screen.findByText("Sem resposta da Escallo.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Segue o orçamento")).toBeTruthy();
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it("na auditoria continua esperando o clique", () => {
    const buscar = vi.spyOn(escallo, "buscarConversa");
    render(<AtendimentoViewer canal="WhatsApp" protocolo="P1" dia="2026-11-25" />);
    expect(screen.getByTestId("carregar-conversa").textContent).toContain("Carregar conversa");
    expect(buscar).not.toHaveBeenCalled();
  });
});
