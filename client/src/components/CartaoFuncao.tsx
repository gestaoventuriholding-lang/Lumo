import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Cartão de uma função que fica fora das médias do atendimento (Confirmação de agenda, Triagem): quem é, os números e a regra. */
export default function CartaoFuncao({
  testId,
  icon: Icon,
  titulo,
  pessoas,
  nota,
  metricas,
  children,
}: {
  testId: string;
  icon: LucideIcon;
  titulo: string;
  pessoas: string;
  /** Como esta função entra (ou não) nos números do atendimento */
  nota: string;
  metricas: { rotulo: string; valor: string }[];
  /** Conteúdo extra embaixo dos números (ex.: transferências do dia) */
  children?: ReactNode;
}) {
  return (
    <section className="ellos-panel-sm flex h-full flex-col gap-4 p-5" data-testid={testId}>
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
          <Icon aria-hidden className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-foreground">{titulo}</h2>
          <p className="truncate text-sm text-muted-foreground" title={pessoas}>{pessoas}</p>
        </div>
      </header>
      <dl className="grid grid-cols-2 gap-3 [&>*:only-child]:col-span-2">
        {metricas.map((m) => (
          <div key={m.rotulo} className="flex flex-col-reverse justify-end rounded-lg border border-border px-4 py-3">
            <dt className="text-xs text-muted-foreground">{m.rotulo}</dt>
            <dd className="font-display text-2xl font-bold text-foreground tabular-nums">{m.valor}</dd>
          </div>
        ))}
      </dl>
      {children}
      <p className="mt-auto text-xs text-muted-foreground">{nota}</p>
    </section>
  );
}
