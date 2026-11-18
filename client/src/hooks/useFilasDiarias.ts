import { useEffect, useState } from "react";
import { subscribeCloudRefresh } from "@/lib/cloudStore";
import { buscarFilasDiarias } from "@/lib/filasApi";
import type { FilaDia } from "@/lib/filasMetrics";

/** Totais de fila do período. Busca de novo quando o período muda e quando a sincronização traz dados novos. */
export function useFilasDiarias(start: string, end: string): { rows: FilaDia[]; carregado: boolean } {
  const [estado, setEstado] = useState<{ chave: string; rows: FilaDia[] }>({ chave: "", rows: [] });
  const [versao, setVersao] = useState(0);

  useEffect(() => subscribeCloudRefresh(() => setVersao((v) => v + 1)), []);

  useEffect(() => {
    let cancelado = false;
    void buscarFilasDiarias(start, end).then((rows) => {
      if (!cancelado) setEstado({ chave: `${start}|${end}`, rows });
    });
    return () => {
      cancelado = true;
    };
  }, [start, end, versao]);

  return { rows: estado.rows, carregado: estado.chave === `${start}|${end}` };
}
