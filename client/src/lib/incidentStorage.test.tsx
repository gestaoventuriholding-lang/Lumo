import { describe, expect, it } from "vitest";
import {
  applyIncidentUpdate,
  createIncident,
  looksLikePersonalData,
  validateIncidentInput,
} from "./incidentStorage";
import type { Attendant } from "@/types/attendant";
import type { IncidentInput } from "@/types/incident";

const attendants: Attendant[] = [
  {
    id: 7,
    name: "Maria Souza",
    role: "Atendente",
    serviceChannel: "Ligação",
    workingHours: "8h",
    jornadaStart: "08:00",
    jornadaEnd: "16:00",
    observation: "",
    registrationDate: "2026-01-01",
  },
];

const base: IncidentInput = {
  type: "complaint",
  occurredOn: "2026-11-03",
  channel: "Ligação",
  attendantId: 7,
  protocol: "  PROT-123  ",
  description: "  Paciente reclamou da espera.  ",
  severity: "medium",
  status: "open",
  actionTaken: "",
};

describe("ocorrências", () => {
  it("cria com protocolo e texto sem espaços sobrando e guarda o nome do agente", () => {
    const incident = createIncident(base, attendants);
    expect(incident.protocol).toBe("PROT-123");
    expect(incident.description).toBe("Paciente reclamou da espera.");
    expect(incident.attendantName).toBe("Maria Souza");
    expect(incident.resolvedAt).toBeUndefined();
  });

  it("exige protocolo, agente e texto", () => {
    expect(validateIncidentInput({ ...base, protocol: "  " })).toMatch(/protocolo/i);
    expect(validateIncidentInput({ ...base, attendantId: undefined })).toMatch(/agente/i);
    expect(validateIncidentInput({ ...base, description: "" })).toMatch(/aconteceu/i);
    expect(validateIncidentInput(base)).toBeNull();
  });

  it("só resolve com a ação tomada", () => {
    expect(validateIncidentInput({ ...base, status: "resolved" })).toMatch(/ação tomada/i);
    expect(
      validateIncidentInput({ ...base, status: "resolved", actionTaken: "Liguei de volta e remarquei." })
    ).toBeNull();
  });

  it("marca a data de resolução ao resolver e mantém ao editar", () => {
    const created = createIncident(base, attendants);
    const resolved = applyIncidentUpdate(
      created,
      { ...base, status: "resolved", actionTaken: "Remarcado." },
      attendants
    );
    expect(resolved.resolvedAt).toBeTruthy();
    const edited = applyIncidentUpdate(
      resolved,
      { ...base, status: "resolved", actionTaken: "Remarcado e confirmado." },
      attendants
    );
    expect(edited.resolvedAt).toBe(resolved.resolvedAt);
    const reopened = applyIncidentUpdate(resolved, { ...base, status: "in_progress" }, attendants);
    expect(reopened.resolvedAt).toBeUndefined();
  });

  it("mantém o agente quando a pessoa foi excluída depois do registro", () => {
    const created = createIncident(base, attendants);
    const orphan = { ...created, attendantId: undefined };
    const updated = applyIncidentUpdate(orphan, { ...base, attendantId: 0, status: "in_progress" }, []);
    expect(updated.attendantId).toBeUndefined();
    expect(updated.attendantName).toBe("Maria Souza");
  });

  it("avisa quando o texto parece ter CPF ou e-mail do paciente", () => {
    expect(looksLikePersonalData("CPF 123.456.789-09 ligou")).toBe(true);
    expect(looksLikePersonalData("12345678909")).toBe(true);
    expect(looksLikePersonalData("fulano@email.com pediu retorno")).toBe(true);
    expect(looksLikePersonalData("Protocolo 2026110312345 sem retorno")).toBe(false);
  });
});
