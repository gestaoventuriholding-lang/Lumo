import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import AttendantOccupancyMap from "./AttendantOccupancyMap";
import type { Attendant } from "@/types/attendant";

const base: Attendant = {
  id: 1,
  name: "Ana Lydya",
  role: "Atendente",
  serviceChannel: "WhatsApp",
  workingHours: "8h",
  jornadaStart: "08:00",
  jornadaEnd: "17:00",
  observation: "",
  registrationDate: "2026-01-01",
};

describe("AttendantOccupancyMap", () => {
  it("mostra colaboradores, jornada e faixas sem cobertura", () => {
    const html = renderToString(
      <AttendantOccupancyMap
        attendants={[
          base,
          { ...base, id: 2, name: "Sem Jornada", jornadaStart: "", jornadaEnd: "" },
          { ...base, id: 3, name: "Carlos Voz", serviceChannel: "Ligação", jornadaStart: "12:00", jornadaEnd: "18:00" },
        ]}
      />
    );
    expect(html).toContain("Ana Lydya");
    expect(html).toContain("08:00–17:00");
    expect(html).toContain("Jornada não informada");
    expect(html).toContain("Pessoas escaladas");
  });
});
