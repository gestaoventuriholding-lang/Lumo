// Ellos: quais dias entram na Meta Média. Sábado, domingo e feriado nacional têm escala reduzida e não contam;
// o dia em andamento também fica de fora quando o período tem outros dias.

/** Feriados nacionais de data fixa (MM-DD). Feriados estaduais e municipais não estão aqui. */
const FERIADOS_FIXOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Sexta-feira Santa do ano (2 dias antes da Páscoa; cálculo gregoriano de Meeus) */
export function sextaFeiraSanta(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const h = (19 * a + b - Math.floor(b / 4) - Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3) + 15) % 30;
  const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(new Date(Date.UTC(ano, mes - 1, dia - 2)));
}

export function ehFeriadoNacional(data: string): boolean {
  return FERIADOS_FIXOS.includes(data.slice(5)) || data === sextaFeiraSanta(Number(data.slice(0, 4)));
}

/** Segunda a sexta, sem feriado nacional */
export function ehDiaDeMeta(data: string): boolean {
  const semana = new Date(`${data}T12:00:00Z`).getUTCDay();
  return semana !== 0 && semana !== 6 && !ehFeriadoNacional(data);
}

/** O registro deste dia entra na meta do período? Hoje só conta quando o período é só hoje. */
export function contaNaMeta(data: string, periodo: { start: string }, hoje: string): boolean {
  if (!ehDiaDeMeta(data)) return false;
  return data !== hoje || periodo.start >= hoje;
}

/** Texto curto que as telas mostram junto da Meta Média */
export const LEGENDA_META = "sem sábados, feriados e o dia em andamento";
