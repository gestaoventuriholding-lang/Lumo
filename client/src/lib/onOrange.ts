// Ellos: comparação "texto sobre o laranja" (opção A × B) na pré-visualização. Só decide qual opção vale; as cores
// de cada opção ficam em client/src/index.css (html[data-on-orange="b"]).
//  A: um único laranja, texto escuro por cima.  B: texto branco, com laranja mais fechado nos preenchimentos.
export type OnOrange = "a" | "b";

export const ON_ORANGE_STORAGE_KEY = "ellos-on-orange";

/** Lê "?laranja=a|b" do endereço; qualquer outra coisa é ignorada. */
export function readOnOrangeFromSearch(search: string): OnOrange | null {
  const v = new URLSearchParams(search).get("laranja")?.toLowerCase();
  return v === "a" || v === "b" ? v : null;
}

/** Escolha atual: o endereço vence o que ficou guardado; sem nada, vale A. */
export function resolveOnOrange(search: string, stored: string | null): OnOrange {
  return readOnOrangeFromSearch(search) ?? (stored === "a" || stored === "b" ? stored : "a");
}

/** Aplica a escolha na página (A é o padrão do CSS, então só B precisa do atributo). */
export function applyOnOrange(value: OnOrange, root: HTMLElement = document.documentElement): void {
  if (value === "b") root.setAttribute("data-on-orange", "b");
  else root.removeAttribute("data-on-orange");
}
