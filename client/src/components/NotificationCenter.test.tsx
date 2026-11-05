import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import NotificationCenter from "./NotificationCenter";
import { buildLoginAlerts } from "@/lib/loginLimit";
import type { LoginAlert } from "@/types/loginAlert";

vi.mock("@/contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({ preferences: { notifications: true } }),
}));
vi.mock("wouter", () => ({ useLocation: () => ["/", () => undefined] }));

// Dados inventados.
const H = 3600;
function alerta(over: Partial<LoginAlert>): LoginAlert {
  return {
    id: 1,
    attendantId: 1,
    attendantName: "Agente Teste Um",
    date: "2026-10-26",
    loginSeconds: 18 * H + 11 * 60,
    limitSeconds: 12 * H,
    status: "open",
    createdAt: "2026-11-05T10:00:00.000Z",
    updatedAt: "2026-11-05T10:00:00.000Z",
    ...over,
  };
}

function abrir(alerts: LoginAlert[], onAction = vi.fn()) {
  render(<NotificationCenter alerts={buildLoginAlerts(alerts)} onSharedAlertAction={onAction} />);
  fireEvent.click(screen.getByRole("button", { name: /Notificações/ }));
  return onAction;
}

describe("sininho: alerta de tempo logado desconsiderado", () => {
  it("mostra colaborador, dia, tempo da Escallo e a frase, e conta como não lido", () => {
    abrir([alerta({})]);
    expect(screen.getByRole("button", { name: /1 não lidas/ })).toBeTruthy();
    expect(screen.getByText("Agente Teste Um")).toBeTruthy();
    expect(screen.getByText("Tempo logado desconsiderado — verificar se a pessoa deslogou")).toBeTruthy();
    expect(screen.getByText(/26\/10\/2026 · tempo na Escallo: 18h11/)).toBeTruthy();
  });

  it("'Marcar como visto' e 'Marcar como resolvido' chamam a ação com o id do alerta", () => {
    const onAction = abrir([alerta({ id: 42 })]);
    fireEvent.click(screen.getByRole("button", { name: /Marcar como visto/ }));
    expect(onAction).toHaveBeenCalledWith(42, "seen");
    fireEvent.click(screen.getByRole("button", { name: /Marcar como resolvido/ }));
    expect(onAction).toHaveBeenCalledWith(42, "resolved");
  });

  it("alerta visto continua na lista, sem contar como não lido e sem o botão de visto", () => {
    abrir([alerta({ status: "seen" })]);
    expect(screen.queryByRole("button", { name: /não lidas/ })).toBeNull();
    expect(screen.getByText("Visto")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Marcar como visto/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Marcar como resolvido/ })).toBeTruthy();
  });

  it("alerta resolvido não aparece", () => {
    abrir([alerta({ status: "resolved" })]);
    expect(screen.getByText("Nenhum alerta")).toBeTruthy();
  });

  it("não tem o X de descartar (o alerta só sai quando resolvido) e 'Marcar todas' marca como visto", () => {
    const onAction = abrir([alerta({ id: 7 }), alerta({ id: 8, attendantId: 2, attendantName: "Agente Teste Dois" })]);
    expect(screen.queryByRole("button", { name: /Descartar alerta/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Marcar todas/ }));
    expect(onAction).toHaveBeenCalledWith(7, "seen");
    expect(onAction).toHaveBeenCalledWith(8, "seen");
  });
});
