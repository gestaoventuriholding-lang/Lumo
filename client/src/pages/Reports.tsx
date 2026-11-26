import { useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEllosData } from "@/contexts/EllosDataContext";
import { buscarFilasDiarias } from "@/lib/filasApi";
import { buscarConsumoIA } from "@/lib/iaApi";
import { motion, pageContainerVariants, pageItemVariants } from "@/lib/motionVariants";
import { getLocalDateString } from "@/lib/performanceStorage";
import {
  DIAS_PARA_AVISAR,
  RELATORIOS_GUARDADOS,
  RELATORIOS_NA_HORA,
  diasSemDado,
  ultimaData,
  type FonteUltimoDado,
  type RelatorioUsado,
} from "@/lib/reportCatalog";

const ORIGEM_API = "API Escallo";
const dataBr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");

/** "carregando" enquanto busca; null quando não há dado */
type Ultimo = string | null | "carregando";

export default function Reports() {
  const { productivityRecords } = useEllosData();
  const hoje = getLocalDateString();
  const [banco, setBanco] = useState<Record<"fila-ligacao" | "fila-whatsapp" | "ia", Ultimo>>({
    "fila-ligacao": "carregando",
    "fila-whatsapp": "carregando",
    ia: "carregando",
  });

  useEffect(() => {
    let vivo = true;
    // 90 dias bastam para achar o último dado; a IA traz no máximo uma linha por dia
    const inicio = new Date(Date.parse(`${hoje}T12:00:00Z`) - 90 * 86_400_000).toISOString().slice(0, 10);
    void Promise.all([buscarFilasDiarias(inicio, hoje), buscarConsumoIA(inicio, hoje)]).then(([filas, ia]) => {
      if (!vivo) return;
      setBanco({
        "fila-ligacao": ultimaData(filas.filter((f) => f.channel === "Ligação").map((f) => f.date)) ?? null,
        "fila-whatsapp": ultimaData(filas.filter((f) => f.channel === "WhatsApp").map((f) => f.date)) ?? null,
        ia: ultimaData(ia.map((d) => d.date)) ?? null,
      });
    });
    return () => {
      vivo = false;
    };
  }, [hoje]);

  const produtividade = useMemo(() => {
    const doCanal = (canal: string) =>
      ultimaData(productivityRecords.filter((r) => r.channel === canal && r.sourceFile === ORIGEM_API).map((r) => r.periodStart)) ?? null;
    return { "produtividade-ligacao": doCanal("Ligação"), "produtividade-whatsapp": doCanal("WhatsApp") };
  }, [productivityRecords]);

  const ultimos: Record<FonteUltimoDado, Ultimo> = { ...banco, ...produtividade };

  return (
    <motion.div className="space-y-6 pb-8" variants={pageContainerVariants} initial="hidden" animate="visible">
      <motion.div variants={pageItemVariants} className="flex items-center gap-4 rounded-lg border border-primary/20 bg-primary-soft p-6">
        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:flex">
          <FileText className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="mt-1 text-muted-foreground">Quais relatórios da Escallo o Ellos usa e o que cada um traz</p>
        </div>
      </motion.div>

      <motion.section variants={pageItemVariants} className="space-y-3" aria-labelledby="rel-guardados">
        <div>
          <h2 id="rel-guardados" className="text-lg font-semibold text-foreground">Atualizados automaticamente</h2>
          <p className="text-sm text-muted-foreground">
            De segunda a sábado, de hora em hora entre 06:00 e 20:00. De terça a sábado e no domingo, às 03:30, o dia anterior é fechado.
            O domingo não é sincronizado.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {RELATORIOS_GUARDADOS.map((r) => (
            <CartaoRelatorio key={r.codigo} relatorio={r} ultimo={r.fonte ? ultimos[r.fonte] : undefined} hoje={hoje} />
          ))}
        </div>
      </motion.section>

      <motion.section variants={pageItemVariants} className="space-y-3" aria-labelledby="rel-na-hora">
        <div>
          <h2 id="rel-na-hora" className="text-lg font-semibold text-foreground">Consultados na hora</h2>
          <p className="text-sm text-muted-foreground">Só quando alguém pede. Conversas e áudios não ficam guardados no Ellos (LGPD).</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {RELATORIOS_NA_HORA.map((r) => (
            <CartaoRelatorio key={r.codigo} relatorio={r} hoje={hoje} />
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}

function CartaoRelatorio({ relatorio, ultimo, hoje }: { relatorio: RelatorioUsado; ultimo?: Ultimo; hoje: string }) {
  const atraso = ultimo && ultimo !== "carregando" ? diasSemDado(ultimo, hoje) : 0;
  return (
    <article className="ellos-panel-sm flex flex-col gap-4 p-5" data-testid={`relatorio-${relatorio.codigo}`}>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="tabular-nums">{relatorio.codigo}</Badge>
          <Badge variant="secondary">{relatorio.canal}</Badge>
        </div>
        <h3 className="font-semibold text-foreground">{relatorio.nome}</h3>
      </header>
      <Bloco titulo="O que traz" itens={relatorio.traz} />
      {relatorio.guarda && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">O que o Ellos guarda</p>
          <p className="text-sm text-foreground">{relatorio.guarda}</p>
        </div>
      )}
      <Bloco titulo="Onde aparece" itens={relatorio.ondeAparece} />
      {ultimo !== undefined && (
        <footer className="mt-auto border-t border-border pt-3 text-sm tabular-nums" data-testid="ultimo-dado">
          {ultimo === "carregando" ? (
            <span className="text-muted-foreground">Verificando o último dado…</span>
          ) : ultimo === null ? (
            <span className="text-warning">Nenhum dado recebido nos registros consultados.</span>
          ) : atraso >= DIAS_PARA_AVISAR ? (
            <span className="text-warning">
              Último dado: {dataBr(ultimo)}. Sem dado novo há {atraso} dias: confira esse relatório na Escallo.
            </span>
          ) : (
            <span className="text-muted-foreground">Último dado: {dataBr(ultimo)}</span>
          )}
        </footer>
      )}
    </article>
  );
}

function Bloco({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
      <ul className="list-disc space-y-0.5 pl-4 text-sm text-foreground marker:text-muted-foreground">
        {itens.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
