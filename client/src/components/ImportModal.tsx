import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useLumoData } from "@/contexts/LumoDataContext";
import {
  buildImportPlan,
  getAcompanhamentoDiarioMapping,
  type ImportBatchOptions,
  type ImportPlan,
  type ParsedSheet,
} from "@/lib/spreadsheetImport";
import { loadImportLog, type ImportLogEntry } from "@/lib/importLogStorage";
import { parseImportNumber } from "@shared/importMapping";
import type { AttendanceChannel } from "@/types/goals";

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ModalStep = "upload" | "configure" | "import";

interface SheetData {
  titleRow: string[];
  headerRow: string[];
  sampleRows: string[][];
  allRows: string[][];
  totalRows: number;
}

const ALL_FIELDS = [
  { key: "col_data", label: "📅 Data" },
  { key: "col_nome_agente", label: "👤 Nome do Agente" },
  { key: "col_recebidas", label: "📥 Recebidas / Oferecidas" },
  { key: "col_atendidas", label: "✅ Atendidas" },
  { key: "col_sem_atendimento", label: "❌ Sem Atendimento" },
  { key: "col_recuperadas", label: "🔄 Únicas Recuperadas" },
  { key: "col_atend_apos_recup", label: "📈 % Atend. após Recuperação" },
  { key: "col_taxa_perda", label: "📉 Taxa de Perda" },
  { key: "col_pct_atend", label: "% Atendimento" },
  { key: "col_tma", label: "⏱ TMA" },
  { key: "col_login", label: "🕐 Login" },
  { key: "col_pausa", label: "⏸ Pausa" },
  { key: "col_pct_pausa", label: "% Pausa" },
  { key: "col_atend_hora", label: "⚡ Atend. / Hora" },
  { key: "col_lig_ativas", label: "📤 Ligações Ativas" },
  { key: "col_entrada_chat", label: "💬 Entrada (chat)" },
  { key: "col_saida_chat", label: "💬 Saída (chat)" },
] as const;

type FieldKey = (typeof ALL_FIELDS)[number]["key"];

const TYPE_SUGGESTIONS: Record<string, FieldKey[]> = {
  voz_diario: [
    "col_data",
    "col_recebidas",
    "col_atendidas",
    "col_sem_atendimento",
    "col_recuperadas",
    "col_atend_apos_recup",
    "col_taxa_perda",
  ],
  voz_produtividade: [
    "col_data",
    "col_nome_agente",
    "col_recebidas",
    "col_atendidas",
    "col_pct_atend",
    "col_tma",
    "col_login",
    "col_pct_pausa",
    "col_atend_hora",
  ],
  chat_diario: ["col_data", "col_recebidas", "col_tma"],
  chat_produtividade: [
    "col_data",
    "col_nome_agente",
    "col_entrada_chat",
    "col_pct_pausa",
    "col_atend_hora",
    "col_login",
  ],
  outro: [],
};

interface SheetConfig {
  ativo: boolean;
  tipo: string;
  campos: Partial<Record<FieldKey, number | null>>;
}

const UNIFIED = {
  colaborador: "Colaborador",
  data: "Data",
  canal: "Canal",
  quantidade: "Quantidade",
  tempo: "Tempo médio",
} as const;

function parseDateForImport(val: string | undefined): string {
  if (!val) return "";
  const text = val.trim();
  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) {
    return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return text.substring(0, 10);
}

function autoDetectType(name: string, titleRow: string[], headerRow: string[]): string {
  const n = name.toLowerCase();
  const t = (titleRow[0] ?? "").toLowerCase();
  const h = headerRow.map((x) => x.toLowerCase()).join(" ");
  if (t.includes("090") || n.includes("090") || h.includes("entrada")) return "chat_produtividade";
  if (t.includes("091") || n.includes("091")) return "chat_diario";
  if (t.includes("025") || n.includes("025") || t.includes("produtividade") || h.includes("oferecidas")) {
    return "voz_produtividade";
  }
  if (t.includes("067") || n.includes("067") || t.includes("liga") || h.includes("sem atend")) {
    return "voz_diario";
  }
  return "outro";
}

function autoDetectCols(
  headerRow: string[],
  suggestedFields: FieldKey[]
): Partial<Record<FieldKey, number | null>> {
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
    col_sem_atendimento: () => find("sem atend"),
    col_recuperadas: () => find("única", "recup"),
    col_atend_apos_recup: () => find("após recup", "apos recup"),
    col_taxa_perda: () => find("perda", "abandon"),
    col_pct_atend: () => find("% atend"),
    col_tma: () => find("tma"),
    col_login: () => find("login"),
    col_pausa: () => find("pausa"),
    col_pct_pausa: () => find("% pausa", "%pausa"),
    col_atend_hora: () => find("qtde", "atend./hora", "hora"),
    col_lig_ativas: () => find("ativas"),
    col_entrada_chat: () => find("entrada"),
    col_saida_chat: () => find("saída", "saida"),
  };
  const result: Partial<Record<FieldKey, number | null>> = {};
  for (const key of suggestedFields) {
    result[key] = detectors[key]?.() ?? null;
  }
  return result;
}

function getCell(row: string[], idx: number | null | undefined): string {
  if (idx == null || idx < 0) return "";
  return row[idx] ?? "";
}

function inferSummaryLabel(sheet: SheetData, sheetName: string): string {
  return sheet.titleRow[0]?.trim() || sheetName;
}

function buildParsedSheetFromConfigs(
  sheetsRaw: Record<string, SheetData>,
  sheetConfigs: Record<string, SheetConfig>,
  fileName: string
): ParsedSheet | null {
  const mergedRows: Record<string, string>[] = [];
  const sourceSheets: NonNullable<ParsedSheet["sourceSheets"]> = [];

  for (const [name, config] of Object.entries(sheetConfigs)) {
    if (!config.ativo || config.tipo === "outro") continue;
    const sheet = sheetsRaw[name];
    if (!sheet) continue;

    const { tipo, campos } = config;
    const channel: AttendanceChannel = tipo.includes("chat") ? "WhatsApp" : "Ligação";
    let sheetRowCount = 0;
    let sheetAttendancesTotal = 0;

    if (tipo === "voz_diario" || tipo === "chat_diario") {
      const label = inferSummaryLabel(sheet, name);
      for (const row of sheet.allRows) {
        if (!row || row.every((c) => !c)) continue;
        const date = parseDateForImport(getCell(row, campos.col_data));
        if (!date) continue;

        const countCol =
          tipo === "voz_diario"
            ? (campos.col_atendidas ?? campos.col_recebidas)
            : campos.col_recebidas;
        const count = parseImportNumber(getCell(row, countCol));
        if (count <= 0) continue;

        mergedRows.push({
          [UNIFIED.colaborador]: label,
          [UNIFIED.data]: date,
          [UNIFIED.canal]: channel,
          [UNIFIED.quantidade]: String(Math.round(count)),
          [UNIFIED.tempo]: getCell(row, campos.col_tma),
        });
        sheetRowCount += 1;
        sheetAttendancesTotal += count;
      }

      if (sheetRowCount > 0) {
        sourceSheets.push({
          name,
          channel,
          rowCount: sheetRowCount,
          attendancesTotal: Math.round(sheetAttendancesTotal),
          role: "summary",
        });
      }
      continue;
    }

    for (const row of sheet.allRows) {
      if (!row || row.every((c) => !c)) continue;
      const nome = getCell(row, campos.col_nome_agente);
      if (!nome) continue;

      const date = parseDateForImport(getCell(row, campos.col_data));
      if (!date) continue;

      let count = 0;
      if (tipo === "chat_produtividade") {
        const entrada = parseImportNumber(
          getCell(row, campos.col_entrada_chat ?? campos.col_recebidas)
        );
        const saida =
          campos.col_saida_chat != null
            ? parseImportNumber(getCell(row, campos.col_saida_chat))
            : 0;
        count = campos.col_saida_chat != null ? entrada + saida : entrada;
      } else {
        count = parseImportNumber(getCell(row, campos.col_atendidas ?? campos.col_recebidas));
      }
      if (count <= 0) continue;

      mergedRows.push({
        [UNIFIED.colaborador]: nome,
        [UNIFIED.data]: date,
        [UNIFIED.canal]: channel,
        [UNIFIED.quantidade]: String(Math.round(count)),
        [UNIFIED.tempo]: getCell(row, campos.col_tma),
      });
      sheetRowCount += 1;
      sheetAttendancesTotal += count;
    }

    if (sheetRowCount > 0) {
      sourceSheets.push({
        name,
        channel,
        rowCount: sheetRowCount,
        attendancesTotal: Math.round(sheetAttendancesTotal),
        role: "productivity",
      });
    }
  }

  if (mergedRows.length === 0) return null;

  return {
    headers: [
      UNIFIED.colaborador,
      UNIFIED.data,
      UNIFIED.canal,
      UNIFIED.quantidade,
      UNIFIED.tempo,
    ],
    rows: mergedRows,
    fileName,
    sourceSheets,
    importNotes: sourceSheets.map(
      (s) =>
        `${s.name} (${s.channel}): ${s.rowCount} registro(s), ${s.attendancesTotal} atendimento(s)`
    ),
  };
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
  const [expandFields, setExpandFields] = useState(true);

  const colOptions = sheet.headerRow.map((h, i) => ({
    idx: i,
    label: h?.trim() || `Coluna ${i}`,
  }));

  const selectedCols = new Set(
    Object.values(config.campos).filter((v) => v != null) as number[]
  );

  function setTipo(tipo: string) {
    onChange({
      ...config,
      tipo,
      campos: autoDetectCols(sheet.headerRow, TYPE_SUGGESTIONS[tipo] ?? []),
    });
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
      onChange({
        ...config,
        campos: {
          ...config.campos,
          [key]: autoDetectCols(sheet.headerRow, [key])[key] ?? null,
        },
      });
    }
  }

  const activeFields = ALL_FIELDS.filter((f) => f.key in config.campos);
  const inactiveFields = ALL_FIELDS.filter((f) => !(f.key in config.campos));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
        <div>
          <p className="text-sm font-semibold">Importar esta aba</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sheet.totalRows} linhas · título: &quot;{sheet.titleRow[0] || "—"}&quot;
          </p>
        </div>
        <Switch checked={config.ativo} onCheckedChange={(v) => onChange({ ...config, ativo: v })} />
      </div>

      {config.ativo && (
        <>
          <div className="flex items-center gap-3">
            <Label className="text-sm font-semibold w-24 shrink-0">Tipo da aba</Label>
            <Select value={config.tipo} onValueChange={setTipo}>
              <SelectTrigger className="w-full max-w-sm">
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
              <button
                type="button"
                className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors"
                onClick={() => setExpandFields(!expandFields)}
              >
                {expandFields ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Campos a importar ({activeFields.length})
              </button>

              {expandFields && (
                <div className="rounded-lg border overflow-hidden">
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-3 bg-muted px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <span>Campo do sistema</span>
                    <span>Coluna da planilha</span>
                    <span>Remover</span>
                  </div>
                  {activeFields.length === 0 ? (
                    <div className="px-3 py-5 text-center text-sm text-muted-foreground">
                      Nenhum campo selecionado. Adicione abaixo.
                    </div>
                  ) : (
                    activeFields.map((field) => (
                      <div
                        key={field.key}
                        className="grid grid-cols-[1fr_1fr_auto] items-center gap-3 border-t px-3 py-2.5 hover:bg-muted/30"
                      >
                        <span className="text-sm font-medium">{field.label}</span>
                        <Select
                          value={
                            config.campos[field.key] != null
                              ? String(config.campos[field.key])
                              : "none"
                          }
                          onValueChange={(v) =>
                            setCampo(field.key, v === "none" ? null : parseInt(v, 10))
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="— não importar —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— não importar —</SelectItem>
                            {colOptions.map((col) => (
                              <SelectItem key={col.idx} value={String(col.idx)}>
                                <span
                                  className={
                                    selectedCols.has(col.idx) &&
                                    config.campos[field.key] !== col.idx
                                      ? "opacity-40"
                                      : ""
                                  }
                                >
                                  [{col.idx}] {col.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <button
                          type="button"
                          onClick={() => toggleField(field.key)}
                          className="text-xs font-medium text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {inactiveFields.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    + Adicionar campos opcionais
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {inactiveFields.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => toggleField(f.key)}
                        className="text-xs px-2.5 py-1 rounded-full border border-dashed text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
                      >
                        + {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <button
                  type="button"
                  className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 hover:text-primary transition-colors"
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
                    <p className="text-xs text-muted-foreground mt-1">
                      ● Colunas em azul = selecionadas para importação
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

export default function ImportModal({ open, onOpenChange }: ImportModalProps) {
  const { attendants, performanceRecords, importPerformance } = useLumoData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ModalStep>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [sheetsRaw, setSheetsRaw] = useState<Record<string, SheetData>>({});
  const [sheetConfigs, setSheetConfigs] = useState<Record<string, SheetConfig>>({});
  const [parsedSheet, setParsedSheet] = useState<ParsedSheet | null>(null);
  const [createAttendants, setCreateAttendants] = useState(true);
  const [updateDuplicates, setUpdateDuplicates] = useState(false);
  const [onlyNewDays, setOnlyNewDays] = useState(true);
  const [importLog, setImportLog] = useState<ImportLogEntry[]>(() => loadImportLog());
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importOptions: ImportBatchOptions = useMemo(
    () => ({ createAttendants, updateDuplicates, onlyNewDays }),
    [createAttendants, updateDuplicates, onlyNewDays]
  );

  const mapping = useMemo(() => getAcompanhamentoDiarioMapping(), []);

  const plan: ImportPlan | null = useMemo(() => {
    if (!parsedSheet) return null;
    return buildImportPlan(
      parsedSheet.rows,
      mapping,
      attendants,
      performanceRecords,
      importOptions
    );
  }, [parsedSheet, mapping, attendants, performanceRecords, importOptions]);

  const importableCount = useMemo(() => {
    if (!plan) return 0;
    return plan.valid.filter((row) => row.status !== "skip").length;
  }, [plan]);

  const sheetNames = Object.keys(sheetsRaw);
  const activeSheets = Object.values(sheetConfigs).filter(
    (c) => c.ativo && c.tipo !== "outro"
  ).length;

  const resetAll = useCallback(() => {
    setStep("upload");
    setFileName("");
    setSheetsRaw({});
    setSheetConfigs({});
    setParsedSheet(null);
    setError(null);
    setIsImporting(false);
    setCreateAttendants(true);
    setUpdateDuplicates(false);
    setOnlyNewDays(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    resetAll();
  }, [onOpenChange, resetAll]);

  useEffect(() => {
    if (!open) resetAll();
  }, [open, resetAll]);

  useEffect(() => {
    if (open) setImportLog(loadImportLog());
  }, [open]);

  const readFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      toast.error("Use XLSX, XLS ou CSV.");
      return;
    }

    setError(null);
    setFileName(file.name);
    setParsedSheet(null);

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
        wb.SheetNames.forEach((name) => {
          const ws = wb.Sheets[name];
          const json: string[][] = XLSX.utils.sheet_to_json(ws, {
            header: 1,
            defval: "",
            raw: false,
          }) as string[][];
          const cleaned = json.map((row) => row.map((cell) => String(cell ?? "")));
          sheets[name] = {
            titleRow: cleaned[0] ?? [],
            headerRow: cleaned[1] ?? [],
            sampleRows: cleaned.slice(2, 7),
            allRows: cleaned.slice(2),
            totalRows: Math.max(0, cleaned.length - 2),
          };
        });
        setSheetsRaw(sheets);

        const configs: Record<string, SheetConfig> = {};
        for (const [name, sheet] of Object.entries(sheets)) {
          const tipo = autoDetectType(name, sheet.titleRow, sheet.headerRow);
          configs[name] = {
            ativo: tipo !== "outro",
            tipo,
            campos: autoDetectCols(sheet.headerRow, TYPE_SUGGESTIONS[tipo] ?? []),
          };
        }
        setSheetConfigs(configs);
        toast.success(`${wb.SheetNames.length} aba(s) encontrada(s)`);
      } catch {
        setError("Erro ao ler o arquivo.");
        toast.error("Erro ao ler o arquivo.");
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  function goToImportStep() {
    const sheet = buildParsedSheetFromConfigs(sheetsRaw, sheetConfigs, fileName);
    if (!sheet) {
      toast.error("Nenhum dado para importar. Verifique o mapeamento das colunas.");
      return;
    }
    setParsedSheet(sheet);
    setStep("import");
  }

  function handleImport() {
    if (!plan || importableCount === 0) return;

    setIsImporting(true);
    try {
      const result = importPerformance(plan, importOptions, { fileName });

      toast.success("Importação concluída", {
        description: `${importableCount} registro(s) importado(s). ${result.logMessage}`,
      });

      if (result.createdAttendants > 0) {
        toast.info(`${result.createdAttendants} colaborador(es) criado(s) automaticamente`);
      }

      if (plan.errors.length > 0) {
        toast.warning(`${plan.errors.length} linha(s) com erro foram ignoradas`);
      }

      setImportLog(loadImportLog());
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar dados");
    } finally {
      setIsImporting(false);
    }
  }

  function updateConfig(sheetName: string, config: SheetConfig) {
    setSheetConfigs((prev) => ({ ...prev, [sheetName]: config }));
    setParsedSheet(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="flex h-[min(90dvh,calc(100vh-2rem))] max-h-[min(90dvh,calc(100vh-2rem))] w-[min(52rem,calc(100vw-2rem))] max-w-[min(52rem,calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(52rem,calc(100vw-2rem))]">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <DialogTitle>Importar dados</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Carregue a planilha de acompanhamento diário (XLSX ou CSV)."}
            {step === "configure" &&
              `${activeSheets} de ${sheetNames.length} aba(s) ativas — configure o mapeamento de colunas.`}
            {step === "import" && "Revise e confirme a importação para o Elos."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {/* ETAPA 1 — Upload */}
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
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
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
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Arraste ou clique para selecionar</p>
                    <p className="mt-1 text-xs text-muted-foreground">XLSX, XLS ou CSV</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">XLSX</Badge>
                    <Badge variant="outline">XLS</Badge>
                    <Badge variant="outline">CSV</Badge>
                  </div>
                </div>
              </div>

              {fileName && (
                <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" />
                  <span className="flex-1 truncate text-sm font-medium">{fileName}</span>
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

              {error && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* ETAPA 2 — Configurar */}
          {step === "configure" && (
            <Tabs defaultValue={sheetNames[0]}>
              <TabsList className="mb-4 h-auto flex-wrap gap-1">
                {sheetNames.map((name) => {
                  const cfg = sheetConfigs[name];
                  const emoji = !cfg?.ativo
                    ? "⏭"
                    : cfg.tipo.includes("voz")
                      ? "📞"
                      : cfg.tipo.includes("chat")
                        ? "💬"
                        : "❓";
                  return (
                    <TabsTrigger key={name} value={name} className="gap-1.5 text-xs">
                      {emoji} {name}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {sheetNames.map((name) => (
                <TabsContent key={name} value={name}>
                  <SheetConfigurator
                    sheet={sheetsRaw[name]}
                    config={
                      sheetConfigs[name] ?? { ativo: false, tipo: "outro", campos: {} }
                    }
                    onChange={(c) => updateConfig(name, c)}
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}

          {/* ETAPA 3 — Importar */}
          {step === "import" && parsedSheet && plan && (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
                <p className="text-sm font-medium text-green-900 dark:text-green-300">
                  Pronto para importar
                </p>
                <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                  {importableCount} registro(s) serão importados de {parsedSheet.rows.length}{" "}
                  linha(s) processada(s).
                </p>
                {parsedSheet.importNotes && parsedSheet.importNotes.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-green-700 dark:text-green-400">
                    {parsedSheet.importNotes.map((note) => (
                      <li key={note}>• {note}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatCard label="Novos" value={plan.stats.newRecords} />
                <StatCard label="Atualizações" value={plan.stats.updates} />
                <StatCard label="Dias ignorados" value={plan.stats.skippedExistingDays} />
                <StatCard
                  label="Erros"
                  value={plan.errors.length}
                  variant={plan.errors.length > 0 ? "error" : "default"}
                />
              </div>

              <div className="space-y-2.5 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Importação inteligente</p>
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={onlyNewDays}
                    onCheckedChange={(checked) => setOnlyNewDays(checked === true)}
                  />
                  <span className="text-sm leading-snug">
                    Importar só dias novos (ignorar dias que já existem no sistema)
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={createAttendants}
                    onCheckedChange={(checked) => setCreateAttendants(checked === true)}
                  />
                  <span className="text-sm leading-snug">
                    Criar colaboradores que ainda não existem no Elos
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={updateDuplicates}
                    onCheckedChange={(checked) => setUpdateDuplicates(checked === true)}
                    disabled={onlyNewDays}
                  />
                  <span className="text-sm leading-snug">
                    Atualizar registros já existentes
                  </span>
                </label>
              </div>

              {plan.valid.length > 0 && (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Canal</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plan.valid.slice(0, 5).map((row) => (
                        <TableRow key={`${row.rowNumber}-${row.date}-${row.channel}`}>
                          <TableCell>{row.attendantName}</TableCell>
                          <TableCell className="text-muted-foreground">{row.date}</TableCell>
                          <TableCell>{row.channel}</TableCell>
                          <TableCell className="text-right">{row.attendancesCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {importLog.length > 0 && step === "upload" && (
            <div className="mt-4 space-y-2 rounded-lg border border-border p-3">
              <p className="text-sm font-medium">Histórico de importações</p>
              <div className="max-h-28 space-y-2 overflow-y-auto text-xs">
                {importLog.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="rounded-md bg-muted/30 px-2.5 py-2">
                    <p className="font-medium">{entry.message}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString("pt-BR")}
                      {entry.fileName ? ` · ${entry.fileName}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border bg-background px-5 py-3 sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isImporting}>
              Cancelar
            </Button>
            {step !== "upload" && (
              <Button
                variant="outline"
                onClick={() => {
                  if (step === "import") setStep("configure");
                  else resetAll();
                }}
                disabled={isImporting}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                {step === "import" ? "Ajustar colunas" : "Trocar arquivo"}
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
                Revisar importação
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {step === "import" && (
              <Button onClick={handleImport} disabled={isImporting || importableCount === 0}>
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  `Importar ${importableCount} registro(s)`
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: number;
  variant?: "default" | "error";
}) {
  return (
    <div
      className={`lumo-stat p-2.5 ${
        variant === "error"
          ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20"
          : ""
      }`}
    >
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
