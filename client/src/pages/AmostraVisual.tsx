import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle } from "lucide-react";
import ChannelBadge from "@/components/ChannelBadge";
import ChartAreaGradient from "@/components/ChartAreaGradient";
import { ToneMark, ToneValue } from "@/components/ToneMark";
import { demoPermitida } from "@/lib/escalloDemo";
import {
  chartActiveDot,
  chartAxisProps,
  chartColors,
  chartGridProps,
  chartLineCursor,
  chartTooltipContentStyle,
} from "@/lib/chartTheme";
import NotFound from "@/pages/NotFound";

// Dados inventados, só para comparar cores (rota /amostra-visual, que só existe em pré-visualização).
const DADOS = [
  { dia: "01/10", total: 880, ligacao: 310, whatsapp: 570 },
  { dia: "02/10", total: 960, ligacao: 340, whatsapp: 620 },
  { dia: "03/10", total: 910, ligacao: 300, whatsapp: 610 },
  { dia: "04/10", total: 1040, ligacao: 380, whatsapp: 660 },
  { dia: "05/10", total: 1120, ligacao: 420, whatsapp: 700 },
  { dia: "06/10", total: 1090, ligacao: 400, whatsapp: 690 },
];

export default function AmostraVisual() {
  if (typeof window === "undefined" || !demoPermitida(window.location.hostname)) return <NotFound />;
  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Amostra de cores (só na pré-visualização)</h1>
        <p className="mt-1 text-muted-foreground">Dados inventados. Serve para comparar Ligação, WhatsApp, “bom” e “atenção” lado a lado.</p>
      </div>

      <section className="ellos-panel-sm p-5">
        <h2 className="text-base font-bold text-foreground">Ligação, WhatsApp e indicador de “bom” juntos</h2>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <ChannelBadge channel="Ligação" />
          <ChannelBadge channel="WhatsApp" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
            <ToneMark tone="good" /> Meta atingida
          </span>
          <ToneValue tone="good" className="text-sm font-semibold">
            ▲ 12,4% vs período anterior
          </ToneValue>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: chartColors.total }} />Total</span>
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: chartColors.ligacao }} />Ligação</span>
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: chartColors.whatsapp }} />WhatsApp</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={DADOS} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs><ChartAreaGradient id="amostra-total" color={chartColors.total} /></defs>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="dia" {...chartAxisProps} />
            <YAxis {...chartAxisProps} width={44} />
            <Tooltip contentStyle={chartTooltipContentStyle} cursor={chartLineCursor} />
            <Area type="monotone" dataKey="total" name="Total" stroke={chartColors.total} strokeWidth={2.4} fill="url(#amostra-total)" dot={false} activeDot={chartActiveDot(chartColors.total)} />
            <Area type="monotone" dataKey="ligacao" name="Ligação" stroke={chartColors.ligacao} strokeWidth={2} fill="none" dot={false} activeDot={chartActiveDot(chartColors.ligacao)} />
            <Area type="monotone" dataKey="whatsapp" name="WhatsApp" stroke={chartColors.whatsapp} strokeWidth={2} fill="none" dot={false} activeDot={chartActiveDot(chartColors.whatsapp)} />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <section className="ellos-panel-sm p-5">
        <h2 className="text-base font-bold text-foreground">Alerta de “atenção” perto de algo da Ligação</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card-raised p-4">
            <div className="space-y-1">
              <ChannelBadge channel="Ligação" />
              <p className="text-2xl font-bold tabular-nums text-foreground">423</p>
              <p className="text-xs text-muted-foreground">atendimentos de ligação</p>
            </div>
            <div className="rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-foreground">
              <p className="flex items-center gap-2 font-semibold text-warning"><AlertTriangle aria-hidden className="h-4 w-4" />Atenção</p>
              <p className="mt-1 text-xs text-muted-foreground">Pausa perto do limite em 3 pessoas</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card-raised p-4">
            <div className="space-y-1">
              <ChannelBadge channel="WhatsApp" />
              <p className="text-2xl font-bold tabular-nums text-foreground">612</p>
              <p className="text-xs text-muted-foreground">atendimentos de WhatsApp</p>
            </div>
            <div className="rounded-lg border border-success/40 bg-success-soft p-3 text-sm text-foreground">
              <p className="flex items-center gap-2 font-semibold text-success"><ToneMark tone="good" />Bom</p>
              <p className="mt-1 text-xs text-muted-foreground">Meta atingida em 9 de 11 pessoas</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
