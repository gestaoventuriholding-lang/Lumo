import { useEffect, useState } from "react";
import { subscribeCloudRefresh } from "@/lib/cloudStore";
import { buscarConsumoIA } from "@/lib/iaApi";
import type { IaDia } from "@/lib/filasMetrics";

/** Consumo de IA entre duas datas. Busca de novo quando o período muda e quando a sincronização traz dados novos. */
export function useConsumoIA(start: string, end: string): IaDia[] {
  const [estado, setEstado] = useState<{ chave: string; rows: IaDia[] }>({ chave: "", rows: [] });
  const [versao, setVersao] = useState(0);

  useEffect(() => subscribeCloudRefresh(() => setVersao((v) => v + 1)), []);

  useEffect(() => {
    let cancelado = false;
    void buscarConsumoIA(start, end).then((rows) => {
      if (!cancelado) setEstado({ chave: `${start}|${end}`, rows });
    });
    return () => {
      cancelado = true;
    };
  }, [start, end, versao]);

  return estado.rows;
}
