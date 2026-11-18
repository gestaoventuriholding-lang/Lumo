// Ellos: números de fila do Dashboard (TME, Análises x Imagem, abandono). Vêm da tabela queue_daily, gravada pela
// sincronização com a Escallo: só totais por dia, canal e área. Funções puras (sem tela, sem banco).

export interface FilaDia {
  date: string;
  channel: "Ligação" | "WhatsApp";
  area: "analises" | "imagem" | "cardiologicos" | "outros" | "total";
  answered: number;
  abandoned: number;
  waitSecondsTotal: number;
}

export interface ResumoFilas {
  /** Há algum dado de fila no período? */
  temDados: boolean;
  /** TME em segundos (média ponderada pelos atendimentos); undefined se não há atendimentos com espera registrada */
  tmeLigacao?: number;
  tmeWhatsapp?: number;
  tmeGeral?: number;
  /** Ligações atendidas por grupo da URA: exames laboratoriais (analises), por imagem, cardiológicos e outras */
  analises: number;
  imagem: number;
  cardiologicos: number;
  outras: number;
  /** Chamadas atendidas e abandonadas (só Ligação: o WhatsApp não tem abandono nos relatórios) */
  ligacoesAtendidas: number;
  ligacoesAbandonadas: number;
  /** % de abandono entre as chamadas que entraram na fila */
  abandonoPct?: number;
}

type Periodo = { start: string; end: string };
const noPeriodo = (rows: FilaDia[], r: Periodo) => rows.filter((x) => x.date >= r.start && x.date <= r.end);
const media = (soma: number, n: number) => (n > 0 ? soma / n : undefined);

export function resumoFilas(rows: FilaDia[], range: Periodo): ResumoFilas {
  const lista = noPeriodo(rows, range);
  const lig = lista.filter((x) => x.channel === "Ligação");
  const wa = lista.filter((x) => x.channel === "WhatsApp");
  const soma = (arr: FilaDia[], f: (x: FilaDia) => number) => arr.reduce((s, x) => s + f(x), 0);
  const ligAt = soma(lig, (x) => x.answered);
  const ligAb = soma(lig, (x) => x.abandoned);
  const waAt = soma(wa, (x) => x.answered);
  const ligEspera = soma(lig, (x) => x.waitSecondsTotal);
  const waEspera = soma(wa, (x) => x.waitSecondsTotal);
  return {
    temDados: lista.length > 0,
    tmeLigacao: media(ligEspera, ligAt),
    tmeWhatsapp: media(waEspera, waAt),
    tmeGeral: media(ligEspera + waEspera, ligAt + waAt),
    analises: soma(lig.filter((x) => x.area === "analises"), (x) => x.answered),
    imagem: soma(lig.filter((x) => x.area === "imagem"), (x) => x.answered),
    cardiologicos: soma(lig.filter((x) => x.area === "cardiologicos"), (x) => x.answered),
    outras: soma(lig.filter((x) => x.area === "outros"), (x) => x.answered),
    ligacoesAtendidas: ligAt,
    ligacoesAbandonadas: ligAb,
    abandonoPct: ligAt + ligAb > 0 ? (ligAb / (ligAt + ligAb)) * 100 : undefined,
  };
}

export interface PontoAreas {
  date: string;
  label: string;
  analises: number;
  imagem: number;
  cardiologicos: number;
}

/** Ligações atendidas dos 3 exames (laboratoriais, imagem, cardiológicos), um ponto por dia com movimento (do mais antigo ao mais novo) */
export function serieExames(rows: FilaDia[], range: Periodo): PontoAreas[] {
  const dias = new Map<string, PontoAreas>();
  for (const x of noPeriodo(rows, range)) {
    if (x.channel !== "Ligação" || (x.area !== "analises" && x.area !== "imagem" && x.area !== "cardiologicos")) continue;
    const [, mes, dia] = x.date.split("-");
    const p = dias.get(x.date) ?? { date: x.date, label: `${dia}/${mes}`, analises: 0, imagem: 0, cardiologicos: 0 };
    p[x.area] += x.answered;
    dias.set(x.date, p);
  }
  return [...dias.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Menor e maior data a buscar para o período e o anterior (uma consulta só) */
export function janelaDeBusca(atual: Periodo, anterior: Periodo): Periodo {
  return { start: atual.start < anterior.start ? atual.start : anterior.start, end: atual.end > anterior.end ? atual.end : anterior.end };
}
