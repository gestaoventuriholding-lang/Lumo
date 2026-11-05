// Ellos: dados INVENTADOS para a demonstração da tela "Vincular com a Escallo".
// Nenhum nome ou código aqui é real, e a demonstração nunca grava nada no banco.
import type { Attendant } from "@/types/attendant";
import type { RespostaEscallo, SobraEscallo } from "@/lib/escalloVinculos";

function colaborador(id: number, name: string, escalloCodigo: number | null = null): Attendant {
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

export function dadosDemonstracao(): { colaboradores: Attendant[]; resposta: RespostaEscallo } {
  // Ids negativos: não existem no banco e não podem se misturar com colaboradores reais.
  const colaboradores = [
    colaborador(-1, "Ana Demonstração"),
    colaborador(-2, "Bruno Demonstração"),
    colaborador(-3, "Carla Demonstração"),
    colaborador(-4, "Diego Demonstração"),
    colaborador(-5, "Elisa Demonstração"),
    colaborador(-6, "Fábio Demonstração", 900),
    colaborador(-7, "Gabi Demonstração"),
  ];

  const sobras: SobraEscallo[] = [
    { codigo: 101, nome: "Ana Demonstração", motivo: "sem_vinculo", detalhe: "", sugestao: { id: -1, nome: "Ana Demonstração" } },
    { codigo: 102, nome: "Bruno Demonstração", motivo: "sem_vinculo", detalhe: "", sugestao: { id: -2, nome: "Bruno Demonstração" } },
    // Sugestão errada de propósito: dá para treinar a troca escolhendo outro colaborador.
    { codigo: 103, nome: "Carla Demonstração", motivo: "sem_vinculo", detalhe: "", sugestao: { id: -4, nome: "Diego Demonstração" } },
    {
      codigo: 104,
      nome: "Elisa Demonstração",
      motivo: "revisar",
      detalhe: "tempo de login acima de 24 horas: confira este registro",
      sugestao: { id: -5, nome: "Elisa Demonstração" },
    },
    { codigo: 201, nome: "Supervisor Demonstração", motivo: "sem_vinculo", detalhe: "", sugestao: null },
    { codigo: 202, nome: "Usuário de Sistema Demonstração", motivo: "sem_vinculo", detalhe: "", sugestao: null },
    { codigo: null, nome: "Registro Sem Código Demonstração", motivo: "revisar", detalhe: "registro sem código válido", sugestao: null },
    // Já vinculado (o Fábio acima tem o código 900).
    { codigo: 900, nome: "Fábio Demonstração", motivo: "sem_vinculo", detalhe: "", sugestao: { id: -6, nome: "Fábio Demonstração" } },
  ];

  return {
    colaboradores,
    resposta: {
      dia: "2026-01-01",
      migracaoPendente: false,
      escallo: { registros: sobras.length },
      resumo: { vinculados: 0, semVinculo: 6, paraRevisar: 2, comSugestaoPorNome: 5 },
      sobras,
    },
  };
}

/**
 * A demonstração só existe na pré-visualização (e no computador de quem desenvolve), nunca no Ellos oficial.
 * É uma lista do que PODE (e não do que não pode): qualquer endereço desconhecido, inclusive o oficial,
 * o antigo lumo.venturiholding.com.br e o alias lumo-lyart.vercel.app, fica sem demonstração.
 */
export function demoPermitida(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") return true;
  // Pré-visualizações da Vercel: lumo-git-<branch>-venturi-holding.vercel.app e lumo-<código>-venturi-holding.vercel.app
  return /^lumo-(git-[a-z0-9-]+|[a-z0-9]+)-venturi-holding\.vercel\.app$/.test(h);
}
