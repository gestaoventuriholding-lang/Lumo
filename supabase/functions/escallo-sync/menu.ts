// Ellos: escolhas no menu principal do WhatsApp (rel092 "Estatísticas de respostas de chat"), sem rede e sem banco.
// Só contagens por dia: quantas vezes cada tipo de exame foi escolhido. Sem telefone, nome nem protocolo.

/** Interação "[ AT Principal ] 0 ME - Menu Principal" na Escallo (a pergunta sobre o tipo de exame) */
export const INTERACAO_MENU_PRINCIPAL = 258;

export interface EscolhasMenuDia {
  dia: string;
  imagem: number;
  laboratoriais: number;
  cardiologicos: number;
  /** Contatos que não responderam com uma opção válida */
  invalidas: number;
}

const limpar = (t: unknown) => String(t ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
const inteiro = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

/**
 * `registros` é o data.registros do rel092 (lista ou objeto). Devolve null se ninguém passou pelo menu no dia.
 * Falha se a interação não for o menu principal ou se aparecer uma opção desconhecida com respostas:
 * é melhor ficar sem o dia do que gravar número errado depois de uma mudança no menu.
 */
export function resumirMenu(dia: string, registros: unknown): EscolhasMenuDia | null {
  const lista = (Array.isArray(registros) ? registros : registros && typeof registros === "object" ? Object.values(registros) : []) as Record<string, unknown>[];
  if (lista.length === 0) return null;
  const r = lista[0];
  if (!limpar(r.interacao).includes("menu principal")) throw new Error(`rel092: a interação ${INTERACAO_MENU_PRINCIPAL} não é mais o Menu Principal`);
  const linha: EscolhasMenuDia = { dia, imagem: 0, laboratoriais: 0, cardiologicos: 0, invalidas: inteiro(r.naoRespondidasQtde) };
  for (const o of Array.isArray(r.respostas) ? (r.respostas as Record<string, unknown>[]) : []) {
    const nome = limpar(o.resposta);
    const campo = nome.includes("imagem") ? "imagem" : nome.includes("laboratori") ? "laboratoriais" : nome.includes("cardiolog") ? "cardiologicos" : null;
    const n = inteiro(o.quantidade);
    if (campo) linha[campo] += n;
    else if (n > 0) throw new Error(`rel092: o menu ganhou uma opção nova ("${String(o.resposta).slice(0, 60)}")`);
  }
  return linha.imagem + linha.laboratoriais + linha.cardiologicos + linha.invalidas > 0 ? linha : null;
}

/** Linha como vai para a tabela exam_choices_daily */
export const menuParaTabela = (l: EscolhasMenuDia) => ({
  date: l.dia,
  imaging: l.imagem,
  laboratory: l.laboratoriais,
  cardiology: l.cardiologicos,
  invalid: l.invalidas,
});
