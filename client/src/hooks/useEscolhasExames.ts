import { useEffect, useState } from "react";
import { subscribeCloudRefresh } from "@/lib/cloudStore";
import { buscarEscolhasExames } from "@/lib/menuApi";
import type { EscolhasDia } from "@/lib/filasMetrics";

/** Escolhas de exame entre duas datas. Busca de novo quando o período muda e quando a sincronização traz dados novos. */
export function useEscolhasExames(start: string, end: string): { rows: EscolhasDia[]; carregado: boolean } {
  const [estado, setEstado] = useState<{ chave: string; rows: EscolhasDia[] }>({ chave: "", rows: [] });
  const [versao, setVersao] = useState(0);

  useEffect(() => subscribeCloudRefresh(() => setVersao((v) => v + 1)), []);

  useEffect(() => {
    let cancelado = false;
    void buscarEscolhasExames(start, end).then((rows) => {
      if (!cancelado) setEstado({ chave: `${start}|${end}`, rows });
    });
    return () => {
      cancelado = true;
    };
  }, [start, end, versao]);

  return { rows: estado.rows, carregado: estado.chave === `${start}|${end}` };
}
