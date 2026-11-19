import { describe, expect, it } from "vitest";
import { lerCodigoDigitado, prepararVinculos, validarNovaColaboradora, validarVinculo, type NovaColaboradora, type SobraEscallo } from "./escalloVinculos";
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

import { dadosDemonstracao } from "./escalloDemo";

describe("vínculo com a Escallo: demonstração", () => {
  it("usa só dados inventados (ids negativos, nomes de demonstração) e monta as listas esperadas", () => {
    const { colaboradores, resposta } = dadosDemonstracao();
    expect(colaboradores.every((c) => c.id < 0 && c.name.includes("Demonstração"))).toBe(true);
    expect(resposta.sobras.every((s) => s.nome.includes("Demonstração"))).toBe(true);
    const l = prepararVinculos(resposta.sobras, colaboradores);
    expect(l.sugestoes.map((x) => x.codigo)).toEqual([101, 102, 103, 104]);
    expect(l.semSugestao.map((x) => x.codigo)).toEqual([201, 202]);
    expect(l.semCodigo).toHaveLength(1);
    expect(l.jaVinculados).toBe(1);
    expect(l.colaboradoresSemCodigo).toHaveLength(6);
  });
  it("cada chamada devolve dados novos (confirmar na demonstração não contamina a próxima)", () => {
    expect(dadosDemonstracao().colaboradores).not.toBe(dadosDemonstracao().colaboradores);
  });
});

import { demoPermitida } from "./escalloDemo";

describe("demonstração: só na pré-visualização", () => {
  it("libera o computador local e as pré-visualizações da Vercel", () => {
    expect(demoPermitida("localhost")).toBe(true);
    expect(demoPermitida("lumo-git-feat-escallo-rel025-venturi-holding.vercel.app")).toBe(true);
    expect(demoPermitida("lumo-4k2x9abc1-venturi-holding.vercel.app")).toBe(true);
    // Nome novo do projeto, depois da troca
    expect(demoPermitida("ellos-git-feat-escallo-rel025-venturi-holding.vercel.app")).toBe(true);
    expect(demoPermitida("ellos-4k2x9abc1-venturi-holding.vercel.app")).toBe(true);
  });
  it("bloqueia o Ellos oficial, o domínio antigo, o alias de produção e qualquer endereço desconhecido", () => {
    expect(demoPermitida("ellos.venturiholding.com.br")).toBe(false);
    expect(demoPermitida("lumo.venturiholding.com.br")).toBe(false);
    expect(demoPermitida("lumo-lyart.vercel.app")).toBe(false);
    expect(demoPermitida("lumo-git-x-venturi-holding.vercel.app.outro-site.com")).toBe(false);
    expect(demoPermitida("evil-venturi-holding.vercel.app")).toBe(false);
    expect(demoPermitida("ellos.venturiholding.com.br.outro-site.com")).toBe(false);
    expect(demoPermitida("ellos-git-x-venturi-holding.vercel.app.outro-site.com")).toBe(false);
    expect(demoPermitida("ellos-venturi-holding.vercel.app")).toBe(false);
    expect(demoPermitida("")).toBe(false);
  });
});

import { traduzirErroDaFuncao } from "./escalloVinculos";

describe("vínculo com a Escallo: tradução do erro da função", () => {
  it("função inexistente (404, erro de relay ou mensagem de não encontrada) vira o aviso de não publicada", async () => {
    expect(await traduzirErroDaFuncao({ context: { status: 404 } })).toMatch(/ainda não foi publicada/);
    expect(await traduzirErroDaFuncao({ name: "FunctionsRelayError", context: {} })).toMatch(/ainda não foi publicada/);
    expect(await traduzirErroDaFuncao({ message: "Requested function was not found" })).toMatch(/ainda não foi publicada/);
  });
  it("usa a mensagem que a própria função devolveu", async () => {
    const context = { status: 400, json: async () => ({ error: "A data 2026-02-31 não existe." }) };
    expect(await traduzirErroDaFuncao({ context })).toBe("A data 2026-02-31 não existe.");
  });
  it("não quebra com context sem json, corpo inválido, erro vazio ou de rede", async () => {
    expect(await traduzirErroDaFuncao({ context: { status: 500 } })).toMatch(/falar com o servidor/);
    expect(await traduzirErroDaFuncao({ context: { status: 500, json: async () => { throw new Error("x"); } } })).toMatch(/falar com o servidor/);
    expect(await traduzirErroDaFuncao(undefined)).toMatch(/falar com o servidor/);
    // Função não publicada: o navegador bloqueia a chamada e o erro chega como falha de envio.
    expect(await traduzirErroDaFuncao({ name: "FunctionsFetchError", message: "Failed to send a request" })).toMatch(/provavelmente ainda não foi publicada/);
  });
});

describe("vínculo com a Escallo: contador de já vinculados", () => {
  it("conta os registros que a função já devolveu como ligados (eles não vêm nas sobras)", () => {
    const sem = prepararVinculos([sobra({ codigo: 200 })], equipe);
    expect(sem.jaVinculados).toBe(0);
    const com = prepararVinculos([sobra({ codigo: 200 })], equipe, 20);
    expect(com.jaVinculados).toBe(20);
  });
  it("soma os da resposta com os que acabaram de ser confirmados na tela", () => {
    // 300 já é de Carla (id 3): aparece nas sobras e conta como vinculado agora
    const l = prepararVinculos([sobra({ codigo: 300 }), sobra({ codigo: 400 })], equipe, 5);
    expect(l.jaVinculados).toBe(6);
  });
  it("valor inválido não quebra", () => {
    expect(prepararVinculos([], equipe, -3).jaVinculados).toBe(0);
    expect(prepararVinculos([], equipe, 2.9).jaVinculados).toBe(2);
  });
});

describe("vínculo com a Escallo: lista dos já vinculados", () => {
  it("mostra quem a função já ligou, com o nome da colaboradora do Ellos, em ordem de nome", () => {
    const l = prepararVinculos([], equipe, 2, [
      { attendantId: 3, escalloCodigo: 300 },
      { attendantId: 1, escalloCodigo: 100 },
    ]);
    expect(l.vinculadas.map((v) => [v.colaboradorNome, v.codigo, v.nomeEscallo])).toEqual([
      ["Ana Teste", 100, null],
      ["Carla Teste", 300, null],
    ]);
    expect(l.jaVinculados).toBe(2);
  });

  it("agente das sobras que já tem dono entra na lista com o nome que veio da Escallo; sem repetir", () => {
    const l = prepararVinculos([sobra({ codigo: 300, nome: "Carla Escallo" })], equipe, 0, [{ attendantId: 3, escalloCodigo: 300 }]);
    expect(l.vinculadas).toHaveLength(1);
    expect(l.vinculadas[0]).toMatchObject({ colaboradorNome: "Carla Teste", codigo: 300, nomeEscallo: "Carla Escallo" });
  });

  it("ignora vínculo de colaborador que não existe mais, e resposta antiga sem a lista", () => {
    expect(prepararVinculos([], equipe, 1, [{ attendantId: 99, escalloCodigo: 900 }]).vinculadas).toEqual([]);
    expect(prepararVinculos([], equipe, 5).vinculadas).toEqual([]);
  });

  it("depois de confirmar um vínculo, a pessoa sai das pendentes e entra nas já vinculadas", () => {
    const pendente = [sobra({ codigo: 200, nome: "Ana na Escallo" })];
    const antes = prepararVinculos(pendente, equipe);
    expect(antes.semSugestao).toHaveLength(1);
    expect(antes.vinculadas).toHaveLength(0);
    const depois = prepararVinculos(pendente, [colab(1, "Ana Teste", 200), ...equipe.slice(1)]);
    expect(depois.semSugestao).toHaveLength(0);
    expect(depois.vinculadas.map((v) => v.colaboradorNome)).toEqual(["Ana Teste"]);
  });
});

describe("vínculo com a Escallo: cadastrar e vincular quem só existe na Escallo", () => {
  const dados: NovaColaboradora = { name: "Nova Teste", role: "Atendente", serviceChannel: "Ligação", workingHours: "6h20", jornadaStart: "08:00", jornadaEnd: "14:20" };

  it("aceita quando está tudo preenchido e o código e o nome estão livres", () => {
    expect(validarNovaColaboradora(500, dados, equipe)).toBeNull();
  });

  it("pede o que falta, dizendo o que fazer", () => {
    expect(validarNovaColaboradora(500, { ...dados, name: "  " }, equipe)).toContain("nome");
    expect(validarNovaColaboradora(500, { ...dados, serviceChannel: "" }, equipe)).toContain("canal");
    expect(validarNovaColaboradora(500, { ...dados, workingHours: "" }, equipe)).toContain("carga horária");
    expect(validarNovaColaboradora(500, { ...dados, jornadaStart: "" }, equipe)).toContain("jornada");
    expect(validarNovaColaboradora(500, { ...dados, jornadaStart: "15:00", jornadaEnd: "14:00" }, equipe)).toContain("jornada");
  });

  it("recusa código que já tem dona e nome que já existe (sem diferenciar maiúscula)", () => {
    expect(validarNovaColaboradora(300, dados, equipe)).toContain("já pertence a Carla Teste");
    expect(validarNovaColaboradora(500, { ...dados, name: "ana teste" }, equipe)).toContain("Já existe Ana Teste");
  });

  it("código inválido é recusado", () => {
    expect(validarNovaColaboradora(-1, dados, equipe)).toContain("número inteiro");
    expect(validarNovaColaboradora(1.5, dados, equipe)).toContain("número inteiro");
  });
});
