// Ellos: presets de tema. As cores de cada preset ficam em client/src/index.css (nenhuma tela tem cor própria).
// "checkup" (azul, estética da Check-Up) é o padrão e vive nos blocos :root e .dark. "laranja" é o tema anterior,
// guardado em html[data-preset="laranja"]. Para trocar de tema no futuro basta mudar ACTIVE_PRESET (ou o atributo), sem mexer nas telas.
export const PRESETS = ["checkup", "laranja"] as const;
export type ThemePreset = (typeof PRESETS)[number];

/** Preset em uso. Os códigos oficiais de cor da marca entram no preset "checkup" (index.css). */
export const ACTIVE_PRESET: ThemePreset = "checkup";

export function isPreset(valor: unknown): valor is ThemePreset {
  return typeof valor === "string" && (PRESETS as readonly string[]).includes(valor);
}

/** Aplica o preset no <html>: o padrão (checkup) não precisa de atributo; os outros usam data-preset. */
export function applyPreset(preset: ThemePreset, root: HTMLElement = document.documentElement): void {
  if (preset === "checkup") root.removeAttribute("data-preset");
  else root.setAttribute("data-preset", preset);
}
