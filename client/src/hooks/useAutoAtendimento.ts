import { useEffect, useState } from "react";
import { subscribeCloudRefresh } from "@/lib/cloudStore";
import { buscarAutoDiario } from "@/lib/autoApi";
import type { AutoDia } from "@/lib/filasMetrics";

/** Auto-atendimento do robô no período. Busca de novo quando o período muda e quando a sincronização traz dados novos. */
export function useAutoAtendimento(start: string, end: string): AutoDia[] {
  const [estado, setEstado] = useState<{ chave: string; rows: AutoDia[] }>({ chave: "", rows: [] });
  const [versao, setVersao] = useState(0);

  useEffect(() => subscribeCloudRefresh(() => setVersao((v) => v + 1)), []);

  useEffect(() => {
    let cancelado = false;
    void buscarAutoDiario(start, end).then((rows) => {
      if (!cancelado) setEstado({ chave: `${start}|${end}`, rows });
    });
    return () => {
      cancelado = true;
    };
  }, [start, end, versao]);

  return estado.rows;
}
