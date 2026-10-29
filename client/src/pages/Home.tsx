import { useCallback, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Phone,
  MessageSquare,
  TrendingUp,
  Clock,
  BarChart3,
  Users,
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";

// ----------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------
type ImportStep = "upload" | "configure" | "import";

interface SheetData {
  titleRow: string[];
  headerRow: string[];
  sampleRows: string[][];
  allRows: string[][];
  totalRows: number;
}

type SheetTipo = "voz_total" | "voz_agente" | "chat_total" | "chat_agente" | "outro";
type FieldKey =
  | "col_data"
  | "col_nome_agente"
  | "col_recebidas"
  | "col_atendidas"
  | "col_taxa_perda"
  | "col_tma"
  | "col_pct_pausa"
  | "col_atend_hora";

const FIELD_LABELS: Record<FieldKey, string> = {
  col_data: "Data",
  col_nome_agente: "Nome Agente",
  col_recebidas: "Total Recebidas",
  col_atendidas: "Total Atendidas / Atendidas",
  col_taxa_perda: "Taxa de Perda",
  col_tma: "TMA",
  col_pct_pausa: "% Pausa",
  col_atend_hora: "Atend./Hora",
};

const TYPE_FIELDS: Record<SheetTipo, FieldKey[]> = {
  voz_total: ["col_data", "col_recebidas", "col_atendidas", "col_taxa_perda"],
  voz_agente: ["col_data", "col_nome_agente", "col_atendidas", "col_tma", "col_pct_pausa", "col_atend_hora"],
  chat_total: ["col_data", "col_recebidas", "col_tma"],
  chat_agente: ["col_data", "col_nome_agente", "col_atend_hora", "col_pct_pausa"],
  outro: [],
};

interface SheetConfig {
  ativo: boolean;
  tipo: SheetTipo;
  campos: Partial<Record<FieldKey, number | null>>;
}

interface VozRecord {
  data: string;
  recebidas?: number;
  atendidas?: number;
  taxa_perda?: number;
}

interface VozAgentRecord {
  data: string;
  nome: string;
  atendidas?: number;
  tma?: number;
  pct_pausa?: number;
  atend_hora?: number;
}

interface ChatRecord {
  data: string;
  recebidas?: number;
  tma?: number;
}

interface ChatAgentRecord {
  data: string;
  nome: string;
  atend_hora?: number;
  pct_pausa?: number;
}

interface AppData {
  voz: VozRecord[];
  vozAgente: VozAgentRecord[];
  chat: ChatRecord[];
  chatAgente: ChatAgentRecord[];
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function parseNum(val: string | undefined): number {
  if (!val) return 0;
  const trimmed = val.trim().replace("%", "");
  if (/\d\.\d{3}/.test(trimmed)) {
    const n = parseFloat(trimmed.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  const n = parseFloat(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
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

function formatChartDate(iso: string): string {
  const br = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (br) return `${br[3]}/${br[2]}`;
  if (iso.includes("/")) return iso.slice(0, 5);
  return iso.slice(5) || iso;
}

function autoDetectType(name: string, titleRow: string[], headerRow: string[]): SheetTipo {
  const n = name.toLowerCase();
  const t = (titleRow[0] ?? "").toLowerCase();
  const h = headerRow.map((x) => x.toLowerCase()).join(" ");
  if (t.includes("090") || n.includes("090") || h.includes("entrada")) return "chat_agente";
  if (t.includes("091") || n.includes("091") || (n.includes("chat") && !h.includes("nome"))) return "chat_total";
  if (t.includes("025") || n.includes("025") || t.includes("produtividade") || h.includes("oferecidas")) return "voz_agente";
  if (t.includes("067") || n.includes("067") || t.includes("liga") || h.includes("sem atend")) return "voz_total";
  return "outro";
}

function autoDetectCols(headerRow: string[], fields: FieldKey[]): Partial<Record<FieldKey, number | null>> {
  const find = (...terms: string[]): number | null => {
    const idx = headerRow.findIndex((h) =>
      terms.some((term) => h.toLowerCase().includes(term.toLowerCase()))
    );
    return idx >= 0 ? idx : null;
  };
  const detectors: Record<FieldKey, () => number | null> = {
    col_data: () => find("data"),
    col_nome_agente: () => find("nome"),
    col_recebidas: () => find("recebida", "oferecida"),
    col_atendidas: () => find("atendidas", "atendida"),
    col_taxa_perda: () => find("perda", "abandon"),
    col_tma: () => find("tma"),
    col_pct_pausa: () => find("% pausa", "%pausa", "pausa"),
    col_atend_hora: () => find("qtde", "atend./hora", "hora"),
  };
  const result: Partial<Record<FieldKey, number | null>> = {};
  for (const key of fields) {
    result[key] = detectors[key]?.() ?? null;
  }
  return result;
}

function getCell(row: string[], idx: number | null | undefined): string {
  if (idx == null || idx < 0) return "";
  return row[idx] ?? "";
}

function pctColor(p: number): string {
  if (p > 80) return "text-green-600 font-semibold";
  if (p > 60) return "text-yellow-600 font-semibold";
  return "text-red-600 font-semibold";
}

// ----------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------
function KpiCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
          {icon}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function RankRow({
  rank,
  nome,
  value,
  max,
  suffix,
}: {
  rank: number;
  nome: string;
  value: number;
  max: number;
  suffix: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm w-6 text-center">{medal}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{nome}</p>
        <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-sm font-bold tabular-nums">
        {value % 1 !== 0 ? value.toFixed(1) : Math.round(value)}
        {suffix}
      </span>
    </div>
  );
}

function SheetConfigurator({
  sheet,
  config,
  onChange,
}: {
  sheet: SheetData;
  config: SheetConfig;
  onChange: (c: SheetConfig) => void;
}) {
  const [showPreview, setShowPreview] = useState(true);
  const colOptions = sheet.headerRow.map((h, i) => ({
    idx: i,
    label: h?.trim() || `Coluna ${i}`,
  }));
  const selectedCols = new Set(
    Object.values(config.campos).filter((v) => v != null) as number[]
  );

  function setTipo(tipo: SheetTipo) {
    onChange({
      ...config,
      tipo,
      campos: autoDetectCols(sheet.headerRow, TYPE_FIELDS[tipo]),
    });
  }

  function setCampo(key: FieldKey, val: number | null) {
    onChange({ ...config, campos: { ...config.campos, [key]: val } });
  }

  const fields = TYPE_FIELDS[config.tipo];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
        <div>
          <p className="text-sm font-semibold">Importar esta aba</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sheet.totalRows} linhas · &quot;{sheet.titleRow[0] || "—"}&quot;
          </p>
        </div>
        <Switch checked={config.ativo} onCheckedChange={(v) => onChange({ ...config, ativo: v })} />
      </div>

      {config.ativo && (
        <>
          <div className="flex items-center gap-3">
            <Label className="text-sm font-semibold w-24 shrink-0">Tipo da aba</Label>
            <Select value={config.tipo} onValueChange={(v) => setTipo(v as SheetTipo)}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="voz_total">📞 Voz — Total por Dia</SelectItem>
                <SelectItem value="voz_agente">📞 Voz — Por Agente</SelectItem>
                <SelectItem value="chat_total">💬 Chat — Total por Dia</SelectItem>
                <SelectItem value="chat_agente">💬 Chat — Por Agente</SelectItem>
                <SelectItem value="outro">⏭ Ignorar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.tipo !== "outro" && (
            <>
              <div className="rounded-lg border overflow-hidden">
                <div className="grid grid-cols-2 bg-muted px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <span>Campo do sistema</span>
                  <span>Coluna da planilha</span>
                </div>
                {fields.map((key) => (
                  <div
                    key={key}
                    className="grid grid-cols-2 items-center gap-3 border-t px-3 py-2.5 hover:bg-muted/30"
                  >
                    <span className="text-sm font-medium">{FIELD_LABELS[key]}</span>
                    <Select
                      value={config.campos[key] != null ? String(config.campos[key]) : "none"}
                      onValueChange={(v) =>
                        setCampo(key, v === "none" ? null : parseInt(v, 10))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="— não importar —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— não importar —</SelectItem>
                        {colOptions.map((col) => (
                          <SelectItem key={col.idx} value={String(col.idx)}>
                            [{col.idx}] {col.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-primary"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPreview ? "Ocultar" : "Ver"} preview
              </button>

              {showPreview && (
                <>
                  <div className="overflow-x-auto rounded-lg border text-xs">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8 bg-muted/60">#</TableHead>
                          {sheet.headerRow.map((h, i) => (
                            <TableHead
                              key={i}
                              className={`whitespace-nowrap ${
                                selectedCols.has(i)
                                  ? "bg-primary/10 text-primary font-bold"
                                  : "bg-muted/30"
                              }`}
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
                            <TableCell className="font-mono text-muted-foreground">{ri + 1}</TableCell>
                            {sheet.headerRow.map((_, ci) => (
                              <TableCell
                                key={ci}
                                className={`whitespace-nowrap ${
                                  selectedCols.has(ci)
                                    ? "bg-primary/5 font-semibold text-primary"
                                    : ""
                                }`}
                              >
                                {row[ci] || "—"}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">● Colunas em azul = selecionadas</p>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function ImportDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (data: AppData) => void;
}) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [sheetsRaw, setSheetsRaw] = useState<Record<string, SheetData>>({});
  const [sheetConfigs, setSheetConfigs] = useState<Record<string, SheetConfig>>({});
  const [previewData, setPreviewData] = useState<AppData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sheetNames = Object.keys(sheetsRaw);

  const reset = useCallback(() => {
    setStep("upload");
    setFileName("");
    setSheetsRaw({});
    setSheetConfigs({});
    setPreviewData(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    reset();
  }, [onOpenChange, reset]);

  const readFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      toast.error("Use XLSX, XLS ou CSV.");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, {
          type: "binary",
          cellDates: false,
          raw: false,
          dateNF: "dd/mm/yyyy",
        });
        const sheets: Record<string, SheetData> = {};
        const configs: Record<string, SheetConfig> = {};
        wb.SheetNames.forEach((name) => {
          const ws = wb.Sheets[name];
          const json: string[][] = XLSX.utils.sheet_to_json(ws, {
            header: 1,
            defval: "",
            raw: false,
          }) as string[][];
          const cleaned = json.map((row) => row.map((cell) => String(cell ?? "")));
          const sheet: SheetData = {
            titleRow: cleaned[0] ?? [],
            headerRow: cleaned[1] ?? [],
            sampleRows: cleaned.slice(2, 7),
            allRows: cleaned.slice(2),
            totalRows: Math.max(0, cleaned.length - 2),
          };
          sheets[name] = sheet;
          const tipo = autoDetectType(name, sheet.titleRow, sheet.headerRow);
          configs[name] = {
            ativo: tipo !== "outro",
            tipo,
            campos: autoDetectCols(sheet.headerRow, TYPE_FIELDS[tipo]),
          };
        });
        setSheetsRaw(sheets);
        setSheetConfigs(configs);
        toast.success(`${wb.SheetNames.length} aba(s) encontrada(s)`);
      } catch {
        toast.error("Erro ao ler o arquivo.");
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  function buildData(): AppData {
    const result: AppData = { voz: [], vozAgente: [], chat: [], chatAgente: [] };

    for (const [sheetName, config] of Object.entries(sheetConfigs)) {
      if (!config.ativo || config.tipo === "outro") continue;
      const sheet = sheetsRaw[sheetName];
      if (!sheet) continue;
      const { tipo, campos } = config;

      sheet.allRows.forEach((row) => {
        if (!row || row.every((c) => !c)) return;
        const dateVal = parseDate(getCell(row, campos.col_data));
        if (!dateVal) return;

        if (tipo === "voz_total") {
          result.voz.push({
            data: dateVal,
            recebidas: campos.col_recebidas != null ? parseNum(getCell(row, campos.col_recebidas)) : undefined,
            atendidas: campos.col_atendidas != null ? parseNum(getCell(row, campos.col_atendidas)) : undefined,
            taxa_perda: campos.col_taxa_perda != null ? parseNum(getCell(row, campos.col_taxa_perda)) : undefined,
          });
        } else if (tipo === "voz_agente") {
          const nome = getCell(row, campos.col_nome_agente);
          if (!nome) return;
          result.vozAgente.push({
            data: dateVal,
            nome,
            atendidas: campos.col_atendidas != null ? parseNum(getCell(row, campos.col_atendidas)) : undefined,
            tma: campos.col_tma != null ? parseTime(getCell(row, campos.col_tma)) : undefined,
            pct_pausa: campos.col_pct_pausa != null ? parseNum(getCell(row, campos.col_pct_pausa)) : undefined,
            atend_hora: campos.col_atend_hora != null ? parseNum(getCell(row, campos.col_atend_hora)) : undefined,
          });
        } else if (tipo === "chat_total") {
          result.chat.push({
            data: dateVal,
            recebidas: campos.col_recebidas != null ? parseNum(getCell(row, campos.col_recebidas)) : undefined,
            tma: campos.col_tma != null ? parseTime(getCell(row, campos.col_tma)) : undefined,
          });
        } else if (tipo === "chat_agente") {
          const nome = getCell(row, campos.col_nome_agente);
          if (!nome) return;
          result.chatAgente.push({
            data: dateVal,
            nome,
            atend_hora: campos.col_atend_hora != null ? parseNum(getCell(row, campos.col_atend_hora)) : undefined,
            pct_pausa: campos.col_pct_pausa != null ? parseNum(getCell(row, campos.col_pct_pausa)) : undefined,
          });
        }
      });
    }

    return result;
  }

  function goToImportStep() {
    const data = buildData();
    const total = data.voz.length + data.vozAgente.length + data.chat.length + data.chatAgente.length;
    if (total === 0) {
      toast.error("Nenhum dado para importar. Verifique o mapeamento.");
      return;
    }
    setPreviewData(data);
    setStep("import");
  }

  function confirmImport() {
    if (!previewData) return;
    const agents = new Set([
      ...previewData.vozAgente.map((r) => r.nome),
      ...previewData.chatAgente.map((r) => r.nome),
    ]).size;
    onImport(previewData);
    toast.success(
      `${previewData.voz.length} registros de voz, ${previewData.chat.length} de chat, ${agents} agente(s)`
    );
    handleClose();
  }

  const agentCount = previewData
    ? new Set([
        ...previewData.vozAgente.map((r) => r.nome),
        ...previewData.chatAgente.map((r) => r.nome),
      ]).size
    : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="flex max-h-[90dvh] w-[min(52rem,calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle>Importar Relatório</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Carregue sua planilha de acompanhamento diário."}
            {step === "configure" && "Configure o mapeamento de colunas por aba."}
            {step === "import" && "Confirme a importação para ver o dashboard."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === "upload" && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const f = e.dataTransfer.files[0];
                  if (f) readFile(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
                  isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) readFile(f);
                  }}
                />
                <Upload className="mx-auto h-10 w-10 text-primary mb-3" />
                <p className="font-medium">Arraste ou clique para selecionar</p>
                <p className="text-sm text-muted-foreground mt-1">XLSX, XLS ou CSV</p>
              </div>
              {fileName && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium flex-1 truncate">{fileName}</span>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
              )}
              {sheetNames.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {sheetNames.map((n) => (
                    <Badge key={n} variant="secondary">
                      {n}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "configure" && (
            <Tabs defaultValue={sheetNames[0]}>
              <TabsList className="mb-4 h-auto flex-wrap gap-1">
                {sheetNames.map((name) => {
                  const cfg = sheetConfigs[name];
                  const emoji = !cfg?.ativo
                    ? "⏭"
                    : cfg.tipo.startsWith("voz")
                      ? "📞"
                      : cfg.tipo.startsWith("chat")
                        ? "💬"
                        : "❓";
                  return (
                    <TabsTrigger key={name} value={name} className="text-xs gap-1">
                      {emoji} {name}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {sheetNames.map((name) => (
                <TabsContent key={name} value={name}>
                  <SheetConfigurator
                    sheet={sheetsRaw[name]}
                    config={sheetConfigs[name] ?? { ativo: false, tipo: "outro", campos: {} }}
                    onChange={(c) => setSheetConfigs((prev) => ({ ...prev, [name]: c }))}
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}

          {step === "import" && previewData && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <p className="text-sm font-semibold">Resumo da importação</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• {previewData.voz.length} registros de voz (total por dia)</li>
                  <li>• {previewData.vozAgente.length} registros de voz por agente</li>
                  <li>• {previewData.chat.length} registros de chat (total por dia)</li>
                  <li>• {previewData.chatAgente.length} registros de chat por agente</li>
                  <li>• {agentCount} agente(s) distintos</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t px-5 py-3 sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            {step !== "upload" && (
              <Button
                variant="outline"
                onClick={() => {
                  if (step === "import") setStep("configure");
                  else reset();
                }}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Voltar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step === "upload" && sheetNames.length > 0 && (
              <Button onClick={() => setStep("configure")} className="gap-1">
                Configurar colunas
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {step === "configure" && (
              <Button onClick={goToImportStep} className="gap-1">
                Continuar
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {step === "import" && (
              <Button onClick={confirmImport} className="gap-1">
                Importar e ver Dashboard
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------
// Dashboard principal
// ----------------------------------------------------------------
export default function Home() {
  const [appData, setAppData] = useState<AppData | null>(null);
  const [showImport, setShowImport] = useState(false);

  const hasData =
    appData &&
    (appData.voz.length > 0 ||
      appData.vozAgente.length > 0 ||
      appData.chat.length > 0 ||
      appData.chatAgente.length > 0);

  const kpis = useMemo(() => {
    if (!appData) return null;
    const totalRecebidas = appData.voz.reduce((a, r) => a + (r.recebidas ?? 0), 0);
    const totalAtendidas = appData.voz.reduce((a, r) => a + (r.atendidas ?? 0), 0);
    const pctAtend = totalRecebidas ? ((totalAtendidas / totalRecebidas) * 100).toFixed(1) : "0";
    const taxaPerdaArr = appData.voz.filter((r) => r.taxa_perda != null && r.taxa_perda > 0);
    const taxaPerdaMedia = taxaPerdaArr.length
      ? (
          taxaPerdaArr.reduce((a, r) => {
            const v = r.taxa_perda!;
            return a + (v > 1 ? v : v * 100);
          }, 0) / taxaPerdaArr.length
        ).toFixed(2)
      : "—";
    const totalChats = appData.chat.reduce((a, r) => a + (r.recebidas ?? 0), 0);
    const tmaArr = appData.chat.filter((r) => r.tma && r.tma > 0).map((r) => r.tma!);
    const tmaMedio = tmaArr.length
      ? (tmaArr.reduce((a, b) => a + b, 0) / tmaArr.length).toFixed(1)
      : "0";

    return { totalRecebidas, totalAtendidas, pctAtend, taxaPerdaMedia, totalChats, tmaMedio };
  }, [appData]);

  const vozChartData = useMemo(
    () =>
      appData?.voz.map((r) => ({
        data: formatChartDate(r.data),
        Recebidas: r.recebidas ?? 0,
        Atendidas: r.atendidas ?? 0,
      })) ?? [],
    [appData]
  );

  const chatBarData = useMemo(
    () =>
      appData?.chat.map((r) => ({
        data: formatChartDate(r.data),
        Chats: r.recebidas ?? 0,
      })) ?? [],
    [appData]
  );

  const chatTmaData = useMemo(
    () =>
      appData?.chat.map((r) => ({
        data: formatChartDate(r.data),
        TMA: r.tma ? Number(r.tma.toFixed(1)) : 0,
      })) ?? [],
    [appData]
  );

  const vozRank = useMemo(() => {
    if (!appData) return [];
    const agents: Record<string, number> = {};
    appData.vozAgente.forEach((r) => {
      if (r.nome && r.atendidas) agents[r.nome] = (agents[r.nome] ?? 0) + r.atendidas;
    });
    return Object.entries(agents)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
  }, [appData]);

  const chatRank = useMemo(() => {
    if (!appData) return [];
    const agents: Record<string, number[]> = {};
    appData.chatAgente.forEach((r) => {
      if (r.nome && r.atend_hora && r.atend_hora > 0) {
        if (!agents[r.nome]) agents[r.nome] = [];
        agents[r.nome].push(r.atend_hora);
      }
    });
    return Object.entries(agents)
      .map(([nome, vals]) => [nome, vals.reduce((a, b) => a + b, 0) / vals.length] as [string, number])
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
  }, [appData]);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {hasData ? "Visão geral do relatório importado" : "Carregue sua planilha para começar"}
            </p>
          </div>
          <Button onClick={() => setShowImport(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Importar Relatório
          </Button>
        </div>

        {!hasData && (
          <Card className="border-dashed">
            <CardContent className="py-16 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Bem-vindo ao Elos</h2>
                <p className="text-muted-foreground text-sm mt-1 max-w-md">
                  Carregue sua planilha de acompanhamento diário para visualizar ligações, chat e
                  produtividade por agente.
                </p>
              </div>
              <Button size="lg" onClick={() => setShowImport(true)} className="gap-2">
                <Upload className="h-4 w-4" />
                Importar Relatório
              </Button>
            </CardContent>
          </Card>
        )}

        {hasData && kpis && appData && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <KpiCard
                icon={<Phone className="w-4 h-4 text-blue-600" />}
                label="Ligações Recebidas"
                value={kpis.totalRecebidas.toLocaleString("pt-BR")}
                color="bg-blue-50 dark:bg-blue-950"
              />
              <KpiCard
                icon={<CheckCircle2 className="w-4 h-4 text-green-600" />}
                label="Ligações Atendidas"
                value={kpis.totalAtendidas.toLocaleString("pt-BR")}
                color="bg-green-50 dark:bg-green-950"
              />
              <KpiCard
                icon={<TrendingUp className="w-4 h-4 text-yellow-600" />}
                label="% Atendimento"
                value={`${kpis.pctAtend}%`}
                color="bg-yellow-50 dark:bg-yellow-950"
              />
              <KpiCard
                icon={<AlertCircle className="w-4 h-4 text-red-600" />}
                label="Taxa de Perda média"
                value={kpis.taxaPerdaMedia === "—" ? "—" : `${kpis.taxaPerdaMedia}%`}
                color="bg-red-50 dark:bg-red-950"
              />
              <KpiCard
                icon={<MessageSquare className="w-4 h-4 text-blue-600" />}
                label="Total Chats"
                value={kpis.totalChats.toLocaleString("pt-BR")}
                color="bg-blue-50 dark:bg-blue-950"
              />
              <KpiCard
                icon={<Clock className="w-4 h-4 text-amber-600" />}
                label="TMA médio Chat"
                value={`${kpis.tmaMedio} min`}
                color="bg-amber-50 dark:bg-amber-950"
              />
            </div>

            {/* Seção Ligações */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Ligações
              </h2>
              {appData.voz.length > 0 ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Recebidas vs Atendidas por dia</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={vozChartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="Recebidas"
                            stroke="#2563EB"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="Atendidas"
                            stroke="#10B981"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Detalhes por data</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Data</TableHead>
                              <TableHead className="text-right">Recebidas</TableHead>
                              <TableHead className="text-right">Atendidas</TableHead>
                              <TableHead className="text-right">% Atend.</TableHead>
                              <TableHead className="text-right">Taxa de Perda</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {appData.voz.map((r, i) => {
                              const p = r.recebidas
                                ? ((r.atendidas ?? 0) / r.recebidas) * 100
                                : 0;
                              const taxa =
                                r.taxa_perda != null
                                  ? (r.taxa_perda > 1 ? r.taxa_perda : r.taxa_perda * 100).toFixed(2) + "%"
                                  : "—";
                              return (
                                <TableRow key={i}>
                                  <TableCell>{r.data}</TableCell>
                                  <TableCell className="text-right">{r.recebidas ?? "—"}</TableCell>
                                  <TableCell className="text-right">{r.atendidas ?? "—"}</TableCell>
                                  <TableCell className={`text-right ${pctColor(p)}`}>
                                    {p.toFixed(1)}%
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">{taxa}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum dado de ligações (Voz — Total por Dia) importado.
                  </CardContent>
                </Card>
              )}
            </section>

            {/* Seção Chat */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                WhatsApp / Chat
              </h2>
              {appData.chat.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Chats atendidos por dia</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={chatBarData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="Chats" fill="#2563EB" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">TMA por dia (min)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={chatTmaData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="TMA"
                            stroke="#F59E0B"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum dado de chat (Chat — Total por Dia) importado.
                  </CardContent>
                </Card>
              )}
            </section>

            {/* Seção Produtividade */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5" />
                Produtividade por Agente
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Ranking — Ligações Atendidas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {vozRank.length > 0 ? (
                      vozRank.map(([nome, val], i) => (
                        <RankRow
                          key={nome}
                          rank={i + 1}
                          nome={nome}
                          value={val}
                          max={vozRank[0]?.[1] ?? 1}
                          suffix=""
                        />
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Importe aba Voz — Por Agente para ver o ranking.
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Ranking — Atend./hora (Chat)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {chatRank.length > 0 ? (
                      chatRank.map(([nome, val], i) => (
                        <RankRow
                          key={nome}
                          rank={i + 1}
                          nome={nome}
                          value={val}
                          max={chatRank[0]?.[1] ?? 1}
                          suffix="/h"
                        />
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Importe aba Chat — Por Agente para ver o ranking.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </section>
          </>
        )}
      </div>

      <ImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImport={(data) => setAppData(data)}
      />
    </DashboardLayout>
  );
}
