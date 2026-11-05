import { useEffect, useState } from "react";
import { demoPermitida } from "@/lib/escalloDemo";
import {
  ON_ORANGE_STORAGE_KEY,
  applyOnOrange,
  readOnOrangeFromSearch,
  resolveOnOrange,
  type OnOrange,
} from "@/lib/onOrange";

// Lido assim que o arquivo carrega: o roteador pode trocar o endereço (e perder o ?laranja=) antes de a tela montar.
const ESCOLHA_DO_ENDERECO: OnOrange | null =
  typeof window !== "undefined" ? readOnOrangeFromSearch(window.location.search) : null;

function guardado(): string | null {
  try {
    return window.localStorage.getItem(ON_ORANGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Alternador A/B do texto sobre o laranja. SÓ existe em pré-visualização (e no computador de quem desenvolve):
 * no Ellos oficial não aparece e a escolha nunca é aplicada. Também aceita ?laranja=a ou ?laranja=b no endereço.
 */
export default function OnOrangeSwitch() {
  const permitido = typeof window !== "undefined" && demoPermitida(window.location.hostname);
  const [valor, setValor] = useState<OnOrange>(() =>
    permitido ? (ESCOLHA_DO_ENDERECO ?? resolveOnOrange("", guardado())) : "a"
  );

  useEffect(() => {
    if (!permitido) return;
    applyOnOrange(valor);
    try {
      window.localStorage.setItem(ON_ORANGE_STORAGE_KEY, valor);
    } catch {
      /* sem armazenamento: só vale nesta tela */
    }
  }, [permitido, valor]);

  if (!permitido) return null;

  const opcao = (v: OnOrange, rotulo: string) => (
    <button
      type="button"
      onClick={() => setValor(v)}
      aria-pressed={valor === v}
      className={
        valor === v
          ? "rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
          : "rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      }
    >
      {rotulo}
    </button>
  );

  return (
    <div
      role="group"
      aria-label="Comparar texto sobre o laranja (só na pré-visualização)"
      className="glass fixed right-3 bottom-3 z-[60] flex items-center gap-1 rounded-lg p-1"
    >
      <span className="px-2 text-xs text-muted-foreground">Prévia:</span>
      {opcao("a", "A · texto escuro")}
      {opcao("b", "B · texto branco")}
    </div>
  );
}
