import { describe, expect, it } from "vitest";
import { lerCodigoDigitado, prepararVinculos, validarVinculo, type SobraEscallo } from "./escalloVinculos";
import type { Attendant } from "@/types/attendant";

// Dados inventados.
function colab(id: number, name: string, escalloCodigo: number | null = null): Attendant {
  return {
    id,
    name,
    role: "Atendente",
    serviceChannel: "Ligação",
    workingHours: "6h20",
    jornadaStart: "08:00",
    jornadaEnd: "14:20",
    observation: "",
    registrationDate: "2026-01-01",
    escalloCodigo,
  };
}

const sobra = (extra: Partial<SobraEscallo>): SobraEscallo => ({
  codigo: 1,
  nome: "Agente",
  motivo: "sem_vinculo",
  detalhe: "",
  sugestao: null,
  ...extra,
});

const equipe = [colab(1, "Ana Teste"), colab(2, "Bruno Teste"), colab(3, "Carla Teste", 300)];

describe("vínculo com a Escallo: listas", () => {
  it("separa sugestões, sem sugestão, sem código e já vinculados", () => {
    const l = prepararVinculos(
      [
        sobra({ codigo: 100, nome: "Ana T.", sugestao: { id: 1, nome: "Ana Teste" } }),
        sobra({ codigo: 200, nome: "Supervisor X" }),
        sobra({ codigo: null, nome: "Sem código", motivo: "revisar" }),
        sobra({ codigo: 300, nome: "Carla", sugestao: { id: 3, nome: "Carla Teste" } }),
      ],
      equipe
    );
    expect(l.sugestoes.map((x) => x.codigo)).toEqual([100]);
    expect(l.sugestoes[0].sugestaoId).toBe(1);
    expect(l.semSugestao.map((x) => x.codigo)).toEqual([200]);
    expect(l.semCodigo).toHaveLength(1);
    expect(l.jaVinculados).toBe(1);
    expect(l.colaboradoresSemCodigo.map((a) => a.id)).toEqual([1, 2]);
  });

  it("registro com problema continua podendo ser vinculado e é marcado", () => {
    const l = prepararVinculos(
      [sobra({ codigo: 100, motivo: "revisar", detalhe: "login acima de 24 horas", sugestao: { id: 1, nome: "Ana Teste" } })],
      equipe
    );
    expect(l.sugestoes[0].comProblema).toBe(true);
  });

  it("ignora sugestão de colaborador que não existe mais", () => {
    const l = prepararVinculos([sobra({ codigo: 100, sugestao: { id: 99, nome: "Fantasma" } })], equipe);
    expect(l.sugestoes).toHaveLength(0);
    expect(l.semSugestao).toHaveLength(1);
  });

  it("depois de vincular, a linha sai da lista de pendentes", () => {
    const s = [sobra({ codigo: 100, sugestao: { id: 1, nome: "Ana Teste" } })];
    expect(prepararVinculos(s, equipe).sugestoes).toHaveLength(1);
    const depois = equipe.map((a) => (a.id === 1 ? { ...a, escalloCodigo: 100 } : a));
    const l = prepararVinculos(s, depois);
    expect(l.sugestoes).toHaveLength(0);
    expect(l.jaVinculados).toBe(1);
  });
});

describe("vínculo com a Escallo: validação", () => {
  it("aceita colaborador livre com código livre", () => {
    expect(validarVinculo(100, 1, equipe)).toBeNull();
  });
  it("recusa sem colaborador escolhido, colaborador inexistente e código inválido", () => {
    expect(validarVinculo(100, null, equipe)).toMatch(/Escolha/);
    expect(validarVinculo(100, 99, equipe)).toMatch(/não existe/);
    expect(validarVinculo(-1, 1, equipe)).toMatch(/inteiro/);
    expect(validarVinculo(1.5, 1, equipe)).toMatch(/inteiro/);
  });
  it("recusa colaborador que já tem outro código e código que já é de outra pessoa", () => {
    expect(validarVinculo(100, 3, equipe)).toMatch(/já tem outro código/);
    expect(validarVinculo(300, 1, equipe)).toMatch(/já pertence a Carla/);
  });
  it("aceita repetir o mesmo par (idempotente)", () => {
    expect(validarVinculo(300, 3, equipe)).toBeNull();
  });
  it("recusa o mesmo colaborador escolhido em outra linha", () => {
    expect(validarVinculo(101, 1, equipe, new Map([[100, 1]]))).toMatch(/outra linha/);
    expect(validarVinculo(100, 1, equipe, new Map([[100, 1]]))).toBeNull();
  });
});

describe("vínculo com a Escallo: campo digitado", () => {
  it("vazio vira null, número vira número, o resto é recusado", () => {
    expect(lerCodigoDigitado("  ")).toEqual({ codigo: null });
    expect(lerCodigoDigitado(" 123 ")).toEqual({ codigo: 123 });
    expect(lerCodigoDigitado("12a")).toHaveProperty("erro");
    expect(lerCodigoDigitado("-4")).toHaveProperty("erro");
    expect(lerCodigoDigitado("1,5")).toHaveProperty("erro");
  });
});
