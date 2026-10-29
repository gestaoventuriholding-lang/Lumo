import { useState, useCallback, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AnimatedText } from "@/components/AnimatedNumber";
import ProductivityReportReview from "@/components/ProductivityReportReview";
import { useLumoData } from "@/contexts/LumoDataContext";
import { parseProductivityWorkbook, type ProductivityReport } from "@/lib/reportParser";
import { previewProductivityImport } from "@/lib/productivityImport";
import type { AttendanceChannel } from "@/types/goals";
import { CHART_DRAW_MS, motion, pageContainerVariants, pageItemVariants } from "@/lib/motionVariants";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle,
  Loader2, BarChart3, Phone, MessageSquare, Users,
  TrendingUp, Clock, RefreshCw, ChevronRight, Settings2,
  Eye, EyeOff, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

// ----------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------
type Step = "upload" | "analyzing" | "configure" | "dashboard" | "report";

interface SheetData {
  titleRow: string[];
  headerRow: string[];
  sampleRows: string[][];
  allRows: string[][];
  totalRows: number;
}

// Todos os campos possíveis do sistema
const ALL_FIELDS = [
  { key: "col_data",            label: "📅 Data",                     group: "base" },
  { key: "col_nome_agente",     label: "👤 Nome do Agente",            group: "base" },
  { key: "col_recebidas",       label: "📥 Recebidas / Oferecidas",    group: "voz" },
  { key: "col_atendidas",       label: "✅ Atendidas",                  group: "voz" },
  { key: "col_sem_atendimento", label: "❌ Sem Atendimento",            group: "voz" },
  { key: "col_recuperadas",     label: "🔄 Únicas Recuperadas",         group: "voz" },
  { key: "col_atend_apos_recup",label: "📈 % Atend. após Recuperação",  group: "voz" },
  { key: "col_taxa_perda",      label: "📉 Taxa de Perda",              group: "voz" },
  { key: "col_pct_atend",       label: "% Atendimento",                group: "voz" },
  { key: "col_tma",             label: "⏱ TMA",                        group: "tempo" },
  { key: "col_login",           label: "🕐 Login (tempo logado)",       group: "tempo" },
  { key: "col_pausa",           label: "⏸ Pausa (tempo)",               group: "tempo" },
  { key: "col_pct_pausa",       label: "% Pausa",                      group: "tempo" },
  { key: "col_atend_hora",      label: "⚡ Atend. / Hora",              group: "prod"  },
  { key: "col_lig_ativas",      label: "📤 Ligações Ativas",            group: "prod"  },
  { key: "col_entrada_chat",    label: "💬 Entrada (chat)",             group: "chat"  },
  { key: "col_saida_chat",      label: "💬 Saída (chat)",               group: "chat"  },
] as const;

type FieldKey = typeof ALL_FIELDS[number]["key"];

// Sugestões automáticas por tipo de aba
const TYPE_SUGGESTIONS: Record<string, FieldKey[]> = {
  voz_diario: ["col_data","col_recebidas","col_atendidas","col_sem_atendimento","col_recuperadas","col_atend_apos_recup","col_taxa_perda"],
  voz_produtividade: ["col_data","col_nome_agente","col_recebidas","col_atendidas","col_pct_atend","col_tma","col_login","col_pct_pausa","col_atend_hora"],
  chat_diario: ["col_data","col_recebidas","col_tma"],
  chat_produtividade: ["col_data","col_nome_agente","col_entrada_chat","col_saida_chat","col_tma","col_login","col_pct_pausa","col_atend_hora"],
  outro: [],
};

interface SheetConfig {
  ativo: boolean;
  tipo: string;
  campos: Partial<Record<FieldKey, number | null>>;
}

interface ParsedRecord {
  data: string;
  nome?: string;
  recebidas?: number;
  atendidas?: number;
  sem_atendimento?: number;
  recuperadas?: number;
  atend_apos_recup?: number;
  taxa_perda?: number;
  pct_atend?: number;
  tma?: number;
  login?: number;
  pct_pausa?: number;
  atend_hora?: number;
  entrada_chat?: number;
  saida_chat?: number;
}

interface AppData {
  voz: ParsedRecord[];
  vozProd: ParsedRecord[];
  chat: ParsedRecord[];
  chatProd: ParsedRecord[];
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function parseNum(val: string | undefined): number {
  if (!val) return 0;
  const n = parseFloat(val.replace(",", ".").replace("%", ""));
  return isNaN(n) ? 0 : n;
}
function parseTime(val: string | undefined): number {
  if (!val || val === "00:00:00") return 0;
  const parts = val.split(":").map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0) + (parts[2] || 0) / 60;
}
function parseDate(val: string | undefined): string {
  if (!val) return "";
  return val.trim().substring(0, 10);
}
function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function autoDetectType(name: string, titleRow: string[], headerRow: string[]): string {
  const n = name.toLowerCase();
  const t = (titleRow[0] ?? "").toLowerCase();
  const h = headerRow.map((x) => x.toLowerCase()).join(" ");
  if (t.includes("090") || n.includes("090") || (n.includes("chat") && h.includes("entrada"))) return "chat_produtividade";
  if (t.includes("091") || n.includes("091") || (n.includes("chat") && !h.includes("nome"))) return "chat_diario";
  if (t.includes("025") || n.includes("025") || t.includes("produtividade") || h.includes("oferecidas")) return "voz_produtividade";
  if (t.includes("067") || n.includes("067") || t.includes("liga") || h.includes("sem atend")) return "voz_diario";
  return "outro";
}

function autoDetectCols(headerRow: string[], suggestedFields: FieldKey[]): Partial<Record<FieldKey, number | null>> {
  const find = (...terms: string[]): number | null => {
    const idx = headerRow.findIndex((h) => terms.some((t) => h.toLowerCase().includes(t.toLowerCase())));
    return idx >= 0 ? idx : null;
  };
  const result: Partial<Record<FieldKey, number | null>> = {};
  const detectors: Record<FieldKey, () => number | null> = {
    col_data: () => find("data"),
    col_nome_agente: () => find("nome"),
    col_recebidas: () => find("recebida", "oferecida"),
    col_atendidas: () => find("atendidas", "atendida"),
    col_sem_atendimento: () => find("sem atend"),
    col_recuperadas: () => find("única", "recup"),
    col_atend_apos_recup: () => find("após recup", "apos recup"),
    col_taxa_perda: () => find("perda", "abandon"),
    col_pct_atend: () => find("% atend"),
    col_tma: () => find("tma"),
    col_login: () => find("login"),
    col_pausa: () => find("pausa"),
    col_pct_pausa: () => find("% pausa", "%pausa"),
    col_atend_hora: () => find("qtde", "atend./hora"),
    col_lig_ativas: () => find("ativas"),
    col_entrada_chat: () => find("entrada"),
    col_saida_chat: () => find("saída", "saida"),
  };
  for (const key of suggestedFields) {
    result[key] = detectors[key]?.() ?? null;
  }
  return result;
}

// ----------------------------------------------------------------
// Sub-components UI
// ----------------------------------------------------------------
function StepBar({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] =
    current === "report"
      ? [
          { id: "upload", label: "Upload" },
          { id: "report", label: "Conferir e importar" },
        ]
      : [
          { id: "upload", label: "Upload" },
          { id: "analyzing", label: "Lendo" },
          { id: "configure", label: "Configurar" },
          { id: "dashboard", label: "Dashboard" },
        ];
  const idx = steps.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 text-sm font-medium ${i < idx ? "text-green-600" : i === idx ? "text-primary" : "text-muted-foreground"}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < idx ? "bg-green-100 text-green-600" : i === idx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {i < idx ? "✓" : i + 1}
            </div>
            {s.label}
          </div>
          {i < steps.length - 1 && <div className={`h-px w-6 ${i < idx ? "bg-green-300" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>{icon}</div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1"><AnimatedText text={value} /></p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

function RankRow({ rank, nome, value, max, suffix }: { rank: number; nome: string; value: number; max: number; suffix: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm w-6 text-center">{medal}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{nome}</p>
        <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-sm font-bold tabular-nums">{typeof value === "number" && value % 1 !== 0 ? value.toFixed(1) : Math.round(value)}{suffix}</span>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">{label}</p>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------
// Sheet Configurator — coração da solução
// ----------------------------------------------------------------
function SheetConfigurator({
  sheetName,
  sheet,
  config,
  onChange,
}: {
  sheetName: string;
  sheet: SheetData;
  config: SheetConfig;
  onChange: (c: SheetConfig) => void;
}) {
  const [showPreview, setShowPreview] = useState(true);
  const [expandFields, setExpandFields] = useState(true);

  const colOptions = sheet.headerRow
    .map((h, i) => ({ idx: i, label: h?.trim() || `Coluna ${i}` }))
    .filter((c) => c.label !== `Coluna ${c.idx}` || true);

  const suggestedKeys = TYPE_SUGGESTIONS[config.tipo] ?? [];
  const selectedCols = new Set(Object.values(config.campos).filter((v) => v != null) as number[]);

  function setTipo(tipo: string) {
    const newFields = autoDetectCols(sheet.headerRow, TYPE_SUGGESTIONS[tipo] ?? []);
    onChange({ ...config, tipo, campos: newFields });
  }

  function setCampo(key: FieldKey, val: number | null) {
    onChange({ ...config, campos: { ...config.campos, [key]: val } });
  }

  function toggleField(key: FieldKey) {
    if (key in config.campos) {
      const next = { ...config.campos };
      delete next[key];
      onChange({ ...config, campos: next });
    } else {
      const detected = autoDetectCols(sheet.headerRow, [key])[key] ?? null;
      onChange({ ...config, campos: { ...config.campos, [key]: detected } });
    }
  }

  const activeFields = ALL_FIELDS.filter((f) => f.key in config.campos);
  const inactiveFields = ALL_FIELDS.filter((f) => !(f.key in config.campos));

  return (
    <div className="space-y-5">
      {/* Ativar/desativar aba */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-muted/40 border">
        <div>
          <p className="font-semibold text-sm">Importar esta aba</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sheet.totalRows} linhas · título: "{sheet.titleRow[0] || "—"}"
          </p>
        </div>
        <Switch
          checked={config.ativo}
          onCheckedChange={(v) => onChange({ ...config, ativo: v })}
        />
      </div>

      {config.ativo && (
        <>
          {/* Tipo */}
          <div className="flex items-center gap-3">
            <Label className="text-sm font-semibold w-28 shrink-0">Tipo da aba</Label>
            <Select value={config.tipo} onValueChange={setTipo}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="voz_diario">📞 Voz — Diário (REL067)</SelectItem>
                <SelectItem value="voz_produtividade">📞 Voz — Produtividade (REL025)</SelectItem>
                <SelectItem value="chat_diario">💬 Chat — Diário (REL091)</SelectItem>
                <SelectItem value="chat_produtividade">💬 Chat — Produtividade (REL090)</SelectItem>
                <SelectItem value="outro">⏭ Ignorar esta aba</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.tipo !== "outro" && (
            <>
              {/* Campos ativos */}
              <div>
                <button
                  className="flex items-center gap-2 text-sm font-semibold mb-3 hover:text-primary transition-colors"
                  onClick={() => setExpandFields(!expandFields)}
                >
                  {expandFields ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Campos a importar ({activeFields.length})
                </button>

                {expandFields && (
                  <div className="rounded-lg border overflow-hidden">
                    {/* Header */}
                    <div className="grid grid-cols-[1fr_1fr_auto] bg-muted px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wide gap-4">
                      <span>Campo do Elos</span>
                      <span>Coluna da planilha</span>
                      <span>Remover</span>
                    </div>

                    {/* Campos ativos */}
                    {activeFields.map((field) => (
                      <div key={field.key} className="grid grid-cols-[1fr_1fr_auto] items-center px-4 py-3 border-t gap-4 hover:bg-muted/30">
                        <span className="text-sm font-medium">{field.label}</span>
                        <Select
                          value={config.campos[field.key] != null ? String(config.campos[field.key]) : "none"}
                          onValueChange={(v) => setCampo(field.key as FieldKey, v === "none" ? null : parseInt(v))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="— não importar —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— não importar —</SelectItem>
                            {colOptions.map((col) => (
                              <SelectItem key={col.idx} value={String(col.idx)}>
                                <span className={selectedCols.has(col.idx) && config.campos[field.key] !== col.idx ? "opacity-40" : ""}>
                                  [{col.idx}] {col.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <button
                          onClick={() => toggleField(field.key as FieldKey)}
                          className="text-muted-foreground hover:text-red-500 transition-colors text-xs font-medium"
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    {activeFields.length === 0 && (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                        Nenhum campo selecionado. Adicione abaixo.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Adicionar campos */}
              {inactiveFields.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                    + Adicionar campos opcionais
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {inactiveFields.map((f) => (
                      <button
                        key={f.key}
                        onClick={() => toggleField(f.key as FieldKey)}
                        className="text-xs px-3 py-1.5 rounded-full border border-dashed hover:border-primary hover:text-primary hover:bg-primary/5 transition-all text-muted-foreground"
                      >
                        + {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              <div>
                <button
                  className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2 hover:text-primary transition-colors uppercase tracking-wide"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showPreview ? "Ocultar" : "Ver"} preview das primeiras linhas
                </button>

                {showPreview && (
                  <>
                    <div className="overflow-x-auto rounded-lg border text-xs">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs py-2 bg-muted/60 font-bold w-8">#</TableHead>
                            {sheet.headerRow.map((h, i) => (
                              <TableHead
                                key={i}
                                className={`text-xs py-2 whitespace-nowrap ${selectedCols.has(i) ? "bg-primary/10 text-primary font-bold" : "bg-muted/30"}`}
                              >
                                {selectedCols.has(i) && <span className="mr-1">●</span>}
                                {h || `Col ${i}`}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sheet.sampleRows.slice(0, 5).map((row, ri) => (
                            <TableRow key={ri}>
                              <TableCell className="text-xs py-1.5 text-muted-foreground font-mono">{ri + 1}</TableCell>
                              {sheet.headerRow.map((_, ci) => (
                                <TableCell
                                  key={ci}
                                  className={`text-xs py-1.5 whitespace-nowrap ${selectedCols.has(ci) ? "bg-primary/5 font-semibold text-primary" : ""}`}
                                >
                                  {row[ci] || "—"}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ● Colunas marcadas = selecionadas para importação
                    </p>
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// Dashboards
// ----------------------------------------------------------------
function VozDashboard({ data }: { data: ParsedRecord[] }) {
  if (!data.length) return <EmptyState label="Nenhum dado de voz importado" />;
  const total = data.reduce((a, r) => a + (r.recebidas ?? 0), 0);
  const totalAte = data.reduce((a, r) => a + (r.atendidas ?? 0), 0);
  const pct = total ? ((totalAte / total) * 100).toFixed(1) : "0";
  const chartData = data.map((r) => ({ data: r.data.slice(5), Recebidas: r.recebidas, Atendidas: r.atendidas, "Sem Atend.": r.sem_atendimento }));
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard icon={<Phone className="w-4 h-4 text-blue-600" />} label="Recebidas" value={total.toLocaleString("pt-BR")} sub="no período" color="bg-blue-50 dark:bg-blue-950" />
        <KpiCard icon={<CheckCircle2 className="w-4 h-4 text-green-600" />} label="Atendidas" value={totalAte.toLocaleString("pt-BR")} sub="no período" color="bg-green-50 dark:bg-green-950" />
        <KpiCard icon={<TrendingUp className="w-4 h-4 text-yellow-600" />} label="% Atendimento" value={pct + "%"} sub="taxa média" color="bg-yellow-50 dark:bg-yellow-950" />
        <KpiCard icon={<BarChart3 className="w-4 h-4 text-purple-600" />} label="Média/Dia" value={(total / data.length).toFixed(0)} sub="ligações/dia" color="bg-purple-50 dark:bg-purple-950" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm">Ligações por Dia</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                <Tooltip /><Legend />
                <Line type="monotone" dataKey="Recebidas" stroke="#2563EB" strokeWidth={2} dot={false} animationDuration={CHART_DRAW_MS} animationEasing="ease-in-out" />
                <Line type="monotone" dataKey="Atendidas" stroke="#10B981" strokeWidth={2} dot={false} animationDuration={CHART_DRAW_MS} animationEasing="ease-in-out" />
                <Line type="monotone" dataKey="Sem Atend." stroke="#EF4444" strokeWidth={2} dot={false} animationDuration={CHART_DRAW_MS} animationEasing="ease-in-out" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Distribuição</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={[{ name: "Atendidas", value: totalAte }, { name: "Não atendidas", value: total - totalAte }]} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                  <Cell fill="#10B981" /><Cell fill="#EF4444" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">Tabela Detalhada</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Recebidas</TableHead>
                  <TableHead className="text-right">Atendidas</TableHead>
                  <TableHead className="text-right">Sem Atend.</TableHead>
                  <TableHead className="text-right">Recup.</TableHead>
                  <TableHead className="text-right">% Atend.</TableHead>
                  <TableHead className="text-right">Taxa Perda</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r, i) => {
                  const p = r.recebidas ? ((r.atendidas ?? 0) / r.recebidas * 100) : 0;
                  return (
                    <TableRow key={i}>
                      <TableCell>{r.data}</TableCell>
                      <TableCell className="text-right">{r.recebidas ?? "—"}</TableCell>
                      <TableCell className="text-right">{r.atendidas ?? "—"}</TableCell>
                      <TableCell className="text-right">{r.sem_atendimento ?? "—"}</TableCell>
                      <TableCell className="text-right">{r.recuperadas ?? "—"}</TableCell>
                      <TableCell className={`text-right font-semibold ${p > 80 ? "text-green-600" : p > 60 ? "text-yellow-600" : "text-red-600"}`}>{p.toFixed(1)}%</TableCell>
                      <TableCell className="text-right text-muted-foreground">{r.taxa_perda != null ? (r.taxa_perda > 1 ? r.taxa_perda : r.taxa_perda * 100).toFixed(2) + "%" : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function ChatDashboard({ data }: { data: ParsedRecord[] }) {
  if (!data.length) return <EmptyState label="Nenhum dado de chat importado" />;
  const total = data.reduce((a, r) => a + (r.recebidas ?? 0), 0);
  const tmaArr = data.filter((r) => r.tma && r.tma > 0).map((r) => r.tma!);
  const tmaMedia = tmaArr.length ? (tmaArr.reduce((a, b) => a + b, 0) / tmaArr.length).toFixed(1) : "0";
  const chartData = data.map((r) => ({ data: r.data.slice(5), Chats: r.recebidas, TMA: r.tma?.toFixed(1) }));
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <KpiCard icon={<MessageSquare className="w-4 h-4 text-blue-600" />} label="Total Chats" value={total.toLocaleString("pt-BR")} sub="no período" color="bg-blue-50 dark:bg-blue-950" />
        <KpiCard icon={<Clock className="w-4 h-4 text-green-600" />} label="TMA Médio" value={tmaMedia + " min"} sub="tempo médio" color="bg-green-50 dark:bg-green-950" />
        <KpiCard icon={<BarChart3 className="w-4 h-4 text-purple-600" />} label="Média/Dia" value={(total / data.length).toFixed(0)} sub="chats/dia" color="bg-purple-50 dark:bg-purple-950" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle className="text-sm">Volume por Dia</CardTitle></CardHeader>
          <CardContent><ResponsiveContainer width="100%" height={220}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="data" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="Chats" fill="#2563EB" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-sm">TMA por Dia (min)</CardTitle></CardHeader>
          <CardContent><ResponsiveContainer width="100%" height={220}><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="data" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="TMA" stroke="#F59E0B" strokeWidth={2} dot={false} animationDuration={CHART_DRAW_MS} animationEasing="ease-in-out" /></LineChart></ResponsiveContainer></CardContent>
        </Card>
      </div>
    </>
  );
}

function ProdDashboard({ vozProd, chatProd }: { vozProd: ParsedRecord[]; chatProd: ParsedRecord[] }) {
  const vozAgents: Record<string, number> = {};
  vozProd.forEach((r) => { if (r.nome && r.atendidas) vozAgents[r.nome] = (vozAgents[r.nome] ?? 0) + r.atendidas; });
  const vozRank = Object.entries(vozAgents).sort(([, a], [, b]) => b - a).slice(0, 10);
  const chatAgents: Record<string, number[]> = {};
  chatProd.forEach((r) => { if (r.nome && r.atend_hora && r.atend_hora > 0) { if (!chatAgents[r.nome]) chatAgents[r.nome] = []; chatAgents[r.nome].push(r.atend_hora); } });
  const chatRank = Object.entries(chatAgents).map(([n, v]) => [n, v.reduce((a, b) => a + b, 0) / v.length] as [string, number]).sort(([, a], [, b]) => b - a).slice(0, 10);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><Phone className="w-4 h-4" />Ranking Voz</CardTitle></CardHeader>
        <CardContent className="space-y-2">{vozRank.map(([nome, val], i) => <RankRow key={nome} rank={i+1} nome={nome} value={val} max={vozRank[0]?.[1]??1} suffix="" />)}{!vozRank.length && <p className="text-sm text-muted-foreground">Sem dados</p>}</CardContent>
      </Card>
      <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4" />Ranking Chat</CardTitle></CardHeader>
        <CardContent className="space-y-2">{chatRank.map(([nome, val], i) => <RankRow key={nome} rank={i+1} nome={nome} value={val} max={chatRank[0]?.[1]??1} suffix="/h" />)}{!chatRank.length && <p className="text-sm text-muted-foreground">Sem dados</p>}</CardContent>
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------
// Main Page
// ----------------------------------------------------------------
export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [progressLogs, setProgressLogs] = useState<string[]>([]);
  const [sheetsRaw, setSheetsRaw] = useState<Record<string, SheetData>>({});
  const [sheetConfigs, setSheetConfigs] = useState<Record<string, SheetConfig>>({});
  const [appData, setAppData] = useState<AppData>({ voz: [], vozProd: [], chat: [], chatProd: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();
  const { attendants, productivityRecords, importProductivityReport } = useLumoData();
  // Relatório de produtividade reconhecido sozinho (ex.: REL090): sem mapear colunas
  const [report, setReport] = useState<ProductivityReport | null>(null);
  const [reportChannel, setReportChannel] = useState<AttendanceChannel | "">("");
  const [reportStart, setReportStart] = useState("");
  const [reportEnd, setReportEnd] = useState("");
  const [createAttendants, setCreateAttendants] = useState(true);

  const reportPreview = useMemo(
    () =>
      report && reportChannel
        ? previewProductivityImport(report, attendants, productivityRecords, {
            channel: reportChannel,
            periodStart: reportStart || undefined,
            periodEnd: reportEnd || undefined,
          })
        : { matched: [], toCreate: [], alreadyImported: [] },
    [report, reportChannel, reportStart, reportEnd, attendants, productivityRecords]
  );
  const reportReady =
    report != null &&
    reportChannel !== "" &&
    (report.mode === "daily" || (reportStart !== "" && reportEnd !== "" && reportEnd >= reportStart));

  function handleImportReport() {
    if (!report || !reportChannel || !reportReady) return;
    try {
      const result = importProductivityReport(report, {
        channel: reportChannel,
        periodStart: reportStart || undefined,
        periodEnd: reportEnd || undefined,
        createAttendants,
        fileName,
      });
      toast.success("Importação concluída", { description: result.logMessage });
      if (result.summary.unmatchedNames.length > 0) {
        toast.warning(
          `${result.summary.unmatchedNames.length} colaborador(es) não foram importados porque não estão cadastrados: ${result.summary.unmatchedNames.join(", ")}`
        );
      }
      resetAll();
      navigate("/performance");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar o relatório");
    }
  }

  const readFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) { toast.error("Use XLSX, XLS ou CSV."); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "binary", cellDates: false, raw: false, dateNF: "dd/mm/yyyy" });
        const productivity = parseProductivityWorkbook(wb, file.name);
        if (productivity) {
          setReport(productivity);
          setReportChannel(productivity.channel ?? "");
          setReportStart(productivity.periodStart ?? "");
          setReportEnd(productivity.periodEnd ?? "");
          setStep("report");
          toast.success("Relatório reconhecido automaticamente");
          return;
        }
        setReport(null);
        const sheets: Record<string, SheetData> = {};
        wb.SheetNames.forEach((name) => {
          const ws = wb.Sheets[name];
          const json: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as string[][];
          const cleaned = json.map((row) => row.map((cell) => String(cell ?? "")));
          sheets[name] = { titleRow: cleaned[0] ?? [], headerRow: cleaned[1] ?? [], sampleRows: cleaned.slice(2, 7), allRows: cleaned.slice(2), totalRows: Math.max(0, cleaned.length - 2) };
        });
        setSheetsRaw(sheets);
        toast.success(`${wb.SheetNames.length} aba(s) encontrada(s): ${wb.SheetNames.join(", ")}`);
      } catch { toast.error("Erro ao ler o arquivo."); }
    };
    reader.readAsBinaryString(file);
  }, []);

  async function startAnalysis() {
    if (!Object.keys(sheetsRaw).length) { toast.error("Carregue um arquivo primeiro."); return; }
    setStep("analyzing"); setProgressLogs([]);
    const addLog = (msg: string) => setProgressLogs((l) => [...l, msg]);
    setProgress(10); setProgressMsg("Lendo abas...");

    const configs: Record<string, SheetConfig> = {};
    for (const [name, sheet] of Object.entries(sheetsRaw)) {
      await delay(120);
      const tipo = autoDetectType(name, sheet.titleRow, sheet.headerRow);
      const campos = autoDetectCols(sheet.headerRow, TYPE_SUGGESTIONS[tipo] ?? []);
      configs[name] = { ativo: tipo !== "outro", tipo, campos };
      addLog(`✓ "${name}" → ${tipo === "outro" ? "não reconhecida" : tipo.replace("_", " ")}`);
      setProgress(10 + (Object.keys(configs).length / Object.keys(sheetsRaw).length) * 80);
    }

    setSheetConfigs(configs);
    setProgress(100); setProgressMsg("Pronto! Revise e ajuste as colunas.");
    await delay(300);
    setStep("configure");
  }

  function updateConfig(sheetName: string, config: SheetConfig) {
    setSheetConfigs((prev) => ({ ...prev, [sheetName]: config }));
  }

  function confirmImport() {
    const result: AppData = { voz: [], vozProd: [], chat: [], chatProd: [] };

    for (const [sheetName, config] of Object.entries(sheetConfigs)) {
      if (!config.ativo || config.tipo === "outro") continue;
      const sheet = sheetsRaw[sheetName];
      const { tipo, campos } = config;
      if (!sheet) continue;

      sheet.allRows.forEach((row) => {
        if (!row || row.every((c) => !c)) return;
        const dateVal = parseDate(campos.col_data != null ? row[campos.col_data!] : row[0]);
        if (!dateVal) return;

        const get = (key: FieldKey) => campos[key] != null ? row[campos[key]!] : undefined;
        const getNum = (key: FieldKey) => { const v = get(key); return v != null ? parseNum(v) : undefined; };
        const getTime = (key: FieldKey) => { const v = get(key); return v != null ? parseTime(v) : undefined; };

        if (tipo === "voz_diario") {
          result.voz.push({ data: dateVal, recebidas: getNum("col_recebidas"), atendidas: getNum("col_atendidas"), sem_atendimento: getNum("col_sem_atendimento"), recuperadas: getNum("col_recuperadas"), atend_apos_recup: getNum("col_atend_apos_recup"), taxa_perda: getNum("col_taxa_perda") });
        } else if (tipo === "voz_produtividade") {
          const nome = get("col_nome_agente"); if (!nome) return;
          result.vozProd.push({ data: dateVal, nome, atendidas: getNum("col_atendidas"), tma: getTime("col_tma"), pct_pausa: getNum("col_pct_pausa"), atend_hora: getNum("col_atend_hora") });
        } else if (tipo === "chat_diario") {
          result.chat.push({ data: dateVal, recebidas: getNum("col_recebidas"), tma: getTime("col_tma") });
        } else if (tipo === "chat_produtividade") {
          const nome = get("col_nome_agente"); if (!nome) return;
          result.chatProd.push({ data: dateVal, nome, recebidas: getNum("col_entrada_chat") ?? getNum("col_recebidas"), pct_pausa: getNum("col_pct_pausa"), atend_hora: getNum("col_atend_hora") });
        }
      });
    }

    const total = result.voz.length + result.vozProd.length + result.chat.length + result.chatProd.length;
    if (total === 0) { toast.error("Nenhum dado importado. Verifique o mapeamento das colunas."); return; }
    toast.success(`${total} registros importados com sucesso!`);
    setAppData(result);
    setStep("dashboard");
  }

  function resetAll() {
    setStep("upload"); setFileName(""); setProgress(0); setProgressMsg(""); setProgressLogs([]);
    setReport(null); setReportChannel(""); setReportStart(""); setReportEnd("");
    setSheetsRaw({}); setSheetConfigs({}); setAppData({ voz: [], vozProd: [], chat: [], chatProd: [] });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const sheetNames = Object.keys(sheetsRaw);
  const activeSheets = Object.values(sheetConfigs).filter((c) => c.ativo && c.tipo !== "outro").length;

  return (
    <motion.div
      className="p-6 max-w-7xl mx-auto space-y-6"
      variants={pageContainerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={pageItemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Importar Relatório</h1>
          <p className="text-muted-foreground text-sm mt-1">Envie o relatório: o Elos reconhece as colunas sozinho</p>
        </div>
      </motion.div>

      <motion.div variants={pageItemVariants}>
        <StepBar current={step} />
      </motion.div>

      {/* UPLOAD */}
      {step === "upload" && (
        <motion.div variants={pageItemVariants} initial="hidden" animate="visible">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4 text-primary" />Selecionar Arquivo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) readFile(f); }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"}`}
            >
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }} />
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center"><FileSpreadsheet className="w-6 h-6 text-primary" /></div>
                <div><p className="font-semibold">Arraste ou clique para selecionar</p><p className="text-sm text-muted-foreground mt-1">XLSX, XLS ou CSV</p></div>
                <div className="flex gap-2"><Badge variant="outline">XLSX</Badge><Badge variant="outline">XLS</Badge><Badge variant="outline">CSV</Badge></div>
              </div>
            </div>
            {fileName && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <FileSpreadsheet className="w-5 h-5 text-primary shrink-0" />
                <span className="font-medium text-sm flex-1">{fileName}</span>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
            )}
            {sheetNames.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sheetNames.map((n) => <Badge key={n} variant="secondary">{n}</Badge>)}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={startAnalysis} disabled={!sheetNames.length} className="gap-2">
                Configurar colunas <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
        </motion.div>
      )}

      {/* RELATÓRIO DE PRODUTIVIDADE RECONHECIDO */}
      {step === "report" && report && (
        <motion.div variants={pageItemVariants} initial="hidden" animate="visible">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Relatório reconhecido automaticamente
                </CardTitle>
                <Badge variant="outline" className="text-xs">{fileName}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <ProductivityReportReview
                report={report}
                preview={reportPreview}
                channel={reportChannel}
                onChannelChange={setReportChannel}
                periodStart={reportStart}
                periodEnd={reportEnd}
                onPeriodStartChange={setReportStart}
                onPeriodEndChange={setReportEnd}
                createAttendants={createAttendants}
                onCreateAttendantsChange={setCreateAttendants}
              />
              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={resetAll} className="gap-2">
                  <RefreshCw className="w-4 h-4" /> Novo arquivo
                </Button>
                <Button onClick={handleImportReport} disabled={!reportReady} className="gap-2">
                  Importar relatório <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ANALYZING */}
      {step === "analyzing" && (
        <motion.div variants={pageItemVariants} initial="hidden" animate="visible">
        <Card>
          <CardContent className="pt-12 pb-12 flex flex-col items-center gap-6">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <div className="text-center">
              <h3 className="text-lg font-bold">Lendo estrutura das abas...</h3>
              <p className="text-muted-foreground text-sm mt-1">{progressMsg}</p>
            </div>
            <Progress value={progress} className="w-80" />
            <div className="space-y-2 w-80">
              {progressLogs.map((log, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />{log}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        </motion.div>
      )}

      {/* CONFIGURE */}
      {step === "configure" && (
        <motion.div variants={pageItemVariants} initial="hidden" animate="visible">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-primary" />
                    Configurar importação
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activeSheets} de {sheetNames.length} aba(s) ativas · Ajuste o tipo e as colunas de cada aba
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">{fileName}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={sheetNames[0]}>
                <TabsList className="flex-wrap h-auto gap-1 mb-6">
                  {sheetNames.map((name) => {
                    const cfg = sheetConfigs[name];
                    const emoji = !cfg?.ativo ? "⏭" : cfg.tipo.includes("voz") ? "📞" : cfg.tipo.includes("chat") ? "💬" : "❓";
                    return (
                      <TabsTrigger key={name} value={name} className="text-xs gap-1.5">
                        {emoji} {name}
                        {!cfg?.ativo && <span className="opacity-40 text-xs">(ignorada)</span>}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {sheetNames.map((name) => (
                  <TabsContent key={name} value={name}>
                    <SheetConfigurator
                      sheetName={name}
                      sheet={sheetsRaw[name]}
                      config={sheetConfigs[name] ?? { ativo: false, tipo: "outro", campos: {} }}
                      onChange={(c) => updateConfig(name, c)}
                    />
                  </TabsContent>
                ))}
              </Tabs>

              <div className="flex justify-between pt-6 border-t mt-6">
                <Button variant="outline" onClick={resetAll} className="gap-2">
                  <RefreshCw className="w-4 h-4" /> Novo arquivo
                </Button>
                <Button onClick={confirmImport} className="gap-2">
                  <BarChart3 className="w-4 h-4" /> Importar e ver Dashboard <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        </motion.div>
      )}

      {/* DASHBOARD */}
      {step === "dashboard" && (
        <motion.div variants={pageItemVariants} initial="hidden" animate="visible">
        <div className="space-y-4">
          <Tabs defaultValue="voz">
            <TabsList>
              <TabsTrigger value="voz" className="gap-2"><Phone className="w-4 h-4" />Ligações ({appData.voz.length})</TabsTrigger>
              <TabsTrigger value="chat" className="gap-2"><MessageSquare className="w-4 h-4" />Chat ({appData.chat.length})</TabsTrigger>
              <TabsTrigger value="prod" className="gap-2"><Users className="w-4 h-4" />Produtividade</TabsTrigger>
            </TabsList>
            <TabsContent value="voz" className="space-y-4 mt-4"><VozDashboard data={appData.voz} /></TabsContent>
            <TabsContent value="chat" className="space-y-4 mt-4"><ChatDashboard data={appData.chat} /></TabsContent>
            <TabsContent value="prod" className="space-y-4 mt-4"><ProdDashboard vozProd={appData.vozProd} chatProd={appData.chatProd} /></TabsContent>
          </Tabs>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setStep("configure")} className="gap-2"><Settings2 className="w-4 h-4" />Ajustar colunas</Button>
            <Button variant="outline" onClick={resetAll} className="gap-2"><Upload className="w-4 h-4" />Novo arquivo</Button>
          </div>
        </div>
        </motion.div>
      )}
    </motion.div>
  );
}
