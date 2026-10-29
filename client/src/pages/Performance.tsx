import { newId as createId } from "@/lib/ids";
import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import { chartTooltipContentStyle } from "@/lib/alertColors";
import { toast } from "sonner";
import { useLumoData } from "@/contexts/LumoDataContext";
import { usePeriodFilter } from "@/contexts/PeriodFilterContext";
import {
  buildAttendantSummaries,
  compareAttendantSummaries,
  filterRecordsByRange,
  getDailyTarget,
  getDaysWithRecordsInRange,
} from "@/lib/performanceMetrics";
import {
  formatAverageTime,
  getLocalDateString,
  parseTimeInput,
} from "@/lib/performanceStorage";
import { periodAttendancesLabel, type DateRange } from "@/lib/dateRangeFilter";
import type { AttendanceChannel } from "@/types/goals";
import type { DailyPerformanceRecord } from "@/types/performance";
import { motion } from "@/lib/motionVariants";
import { Plus, Edit2, Trash2, Clock, Phone, Users, Upload, Target } from "lucide-react";
import ImportModal from "@/components/ImportModal";
import ProductivitySection from "@/components/ProductivitySection";
import { mergePeriodTotals } from "@/lib/periodTotals";
import ManagementReportButton from "@/components/ManagementReportButton";
import PeriodFilterBar from "@/components/PeriodFilterBar";
import PerformanceRankings from "@/components/PerformanceRankings";
import { pageContainerVariants, pageItemVariants, staggerContainerVariants, cardItemVariants } from "@/lib/motionVariants";
import { AnimatedText } from "@/components/AnimatedNumber";
import AnimatedNumber from "@/components/AnimatedNumber";

const channels: AttendanceChannel[] = ["Ligação", "WhatsApp"];

type FormState = {
  attendantId: string;
  date: string;
  channel: AttendanceChannel;
  attendancesCount: string;
  averageTime: string;
};

const emptyForm = (): FormState => ({
  attendantId: "",
  date: getLocalDateString(),
  channel: "Ligação",
  attendancesCount: "",
  averageTime: "",
});

function formatDayTabLabel(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function resolveDisplayRange(
  period: "day" | "week" | "month",
  dateRange: DateRange,
  drillDownDay: string
): DateRange {
  if (period === "day") return dateRange;
  if (drillDownDay) {
    const label = new Date(`${drillDownDay}T12:00:00`).toLocaleDateString("pt-BR");
    return { start: drillDownDay, end: drillDownDay, label };
  }
  return dateRange;
}

const DRILL_ALL = "__all__";

export default function Performance() {
  const {
    attendants,
    performanceRecords: records,
    productivityRecords,
    productionGoals,
    addPerformanceRecord,
    updatePerformanceRecord,
    removePerformanceRecord,
  } = useLumoData();
  const {
    period,
    dateRange,
    drillDownDay,
    setDrillDownDay,
    setPeriod,
    setSelectedDay,
  } = usePeriodFilter();
  const [showImportModal, setShowImportModal] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [lastSavedId, setLastSavedId] = useState<number | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const displayRange = useMemo(
    () => resolveDisplayRange(period, dateRange, drillDownDay),
    [period, dateRange, drillDownDay]
  );

  const isDayDetailView = period === "day" || drillDownDay !== "";

  const attendantIds = useMemo(() => new Set(attendants.map((a) => a.id)), [attendants]);

  const availableDays = useMemo(
    () => getDaysWithRecordsInRange(records, dateRange),
    [records, dateRange]
  );

  const filteredRecords = useMemo(
    () =>
      [...filterRecordsByRange(records, displayRange)].sort(
        (a, b) => b.date.localeCompare(a.date) || a.attendantName.localeCompare(b.attendantName)
      ),
    [records, displayRange]
  );

  // totais de período de relatórios (sem dia a dia) entram quando cabem no filtro
  const summaryRecords = useMemo(
    () => mergePeriodTotals(records, productivityRecords, displayRange),
    [records, productivityRecords, displayRange]
  );

  const attendantSummaries = useMemo(
    () => buildAttendantSummaries(summaryRecords, attendants, productionGoals, displayRange),
    [summaryRecords, attendants, productionGoals, displayRange]
  );

  const ligacaoSummaries = useMemo(
    () =>
      buildAttendantSummaries(summaryRecords, attendants, productionGoals, displayRange, "Ligação"),
    [summaryRecords, attendants, productionGoals, displayRange]
  );

  const whatsappSummaries = useMemo(
    () =>
      buildAttendantSummaries(summaryRecords, attendants, productionGoals, displayRange, "WhatsApp"),
    [summaryRecords, attendants, productionGoals, displayRange]
  );

  const kpis = useMemo(() => {
    const withData = attendantSummaries.filter((summary) => summary.totalAttendances > 0);

    if (withData.length === 0) {
      return {
        totalAttendances: 0,
        averageTime: 0,
        attendantsCount: 0,
        averagePercentage: 0,
      };
    }

    const totalAttendances = withData.reduce((sum, summary) => sum + summary.totalAttendances, 0);
    const weightedTime =
      withData.reduce(
        (sum, summary) => sum + summary.averageTimeMinutes * summary.totalAttendances,
        0
      ) / totalAttendances;
    const averagePercentage =
      withData.reduce((sum, summary) => sum + summary.averagePercentage, 0) / withData.length;

    return {
      totalAttendances,
      averageTime: weightedTime,
      attendantsCount: withData.length,
      averagePercentage,
    };
  }, [attendantSummaries]);

  const summaryRows = useMemo(
    () =>
      attendantSummaries
        .filter((summary) => summary.totalAttendances > 0)
        .sort(compareAttendantSummaries)
        .map((summary, index) => ({
          ...summary,
          ranking: index + 1,
        })),
    [attendantSummaries]
  );

  const ligacaoGoal = getDailyTarget("Ligação", productionGoals);
  const whatsappGoal = getDailyTarget("WhatsApp", productionGoals);

  const chartData = useMemo(() => {
    const byAttendant = new Map<
      number,
      { name: string; ligacao: number; whatsapp: number }
    >();

    for (const record of filteredRecords) {
      const current = byAttendant.get(record.attendantId) ?? {
        name: record.attendantName.split(" ")[0],
        ligacao: 0,
        whatsapp: 0,
      };

      if (record.channel === "Ligação") {
        current.ligacao += record.attendancesCount;
      } else if (record.channel === "WhatsApp") {
        current.whatsapp += record.attendancesCount;
      }

      byAttendant.set(record.attendantId, current);
    }

    return Array.from(byAttendant.values())
      .filter((item) => item.ligacao > 0 || item.whatsapp > 0)
      .sort((a, b) => b.ligacao + b.whatsapp - (a.ligacao + a.whatsapp));
  }, [filteredRecords]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(emptyForm());
    setIsModalOpen(true);
  };

  const openEditModal = (record: DailyPerformanceRecord) => {
    setEditingId(record.id);
    setForm({
      attendantId: String(record.attendantId),
      date: record.date,
      channel: record.channel,
      attendancesCount: String(record.attendancesCount),
      averageTime: formatAverageTime(record.averageTimeMinutes),
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    const attendant = attendants.find((a) => a.id === Number(form.attendantId));
    const attendancesCount = parseInt(form.attendancesCount, 10);
    const averageTimeMinutes = parseTimeInput(form.averageTime);

    if (!attendant) {
      toast.error("Selecione um colaborador");
      return;
    }
    if (!form.date) {
      toast.error("Informe a data");
      return;
    }
    if (!attendancesCount || attendancesCount <= 0) {
      toast.error("Informe a quantidade de atendimentos do dia");
      return;
    }
    if (!averageTimeMinutes || averageTimeMinutes <= 0) {
      toast.error("Informe o tempo médio (ex: 4m 30s ou 4.5)");
      return;
    }

    const duplicate = records.find(
      (r) =>
        r.attendantId === attendant.id &&
        r.date === form.date &&
        r.channel === form.channel &&
        r.id !== editingId
    );
    if (duplicate) {
      toast.error("Já existe registro para este colaborador, data e canal");
      return;
    }

    const now = new Date().toISOString();

    if (editingId) {
      updatePerformanceRecord(editingId, {
        attendantId: attendant.id,
        attendantName: attendant.name,
        date: form.date,
        channel: form.channel,
        attendancesCount,
        averageTimeMinutes,
      });
      setLastSavedId(editingId);
      toast.success("Registro atualizado — visível no Dashboard!");
    } else {
      const newRecordId = createId();
      const newRecord: DailyPerformanceRecord = {
        id: newRecordId,
        attendantId: attendant.id,
        attendantName: attendant.name,
        date: form.date,
        channel: form.channel,
        attendancesCount,
        averageTimeMinutes,
        createdAt: now,
        updatedAt: now,
      };
      addPerformanceRecord(newRecord);
      setLastSavedId(newRecordId);
      toast.success("Registro salvo — visível no Dashboard!");
    }

    setIsModalOpen(false);
    setPeriod("day");
    setSelectedDay(form.date);
    setDrillDownDay("");

    requestAnimationFrame(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleDelete = (id: number) => {
    removePerformanceRecord(id);
    setDeleteId(null);
    toast.success("Registro removido");
  };

  const activeTab = period === "day" ? dateRange.start : drillDownDay || DRILL_ALL;

  return (
    <motion.div
      className="space-y-4"
      variants={pageContainerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={pageItemVariants} className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Desempenho</h1>
          <p className="text-muted-foreground">
            Registre atendimentos e acompanhe quem está performando melhor — sincronizado com o Dashboard
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
          <ManagementReportButton className="gap-2" />
          <Button variant="outline" onClick={() => setShowImportModal(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Importar Planilha
          </Button>
          <Button onClick={openCreateModal} className="gap-2">
            <Plus className="h-4 w-4" />
            Registrar Atendimento
          </Button>
        </div>
      </motion.div>

      <motion.div variants={pageItemVariants}>
        <PeriodFilterBar />
      </motion.div>

      {period !== "day" && availableDays.length > 0 && (
        <motion.div variants={pageItemVariants}>
          <Tabs
            value={activeTab}
            onValueChange={(value) => setDrillDownDay(value === DRILL_ALL ? "" : value)}
          >
            <div className="overflow-x-auto pb-1">
              <TabsList className="inline-flex h-auto w-max min-w-full flex-wrap justify-start gap-1 p-1">
                <TabsTrigger value={DRILL_ALL} className="shrink-0 px-3 py-1.5 text-xs sm:text-sm">
                  Período completo
                </TabsTrigger>
                {availableDays.map((day) => (
                  <TabsTrigger key={day} value={day} className="shrink-0 px-3 py-1.5 text-xs sm:text-sm">
                    {formatDayTabLabel(day)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
        </motion.div>
      )}

      <motion.div variants={pageItemVariants}>
        <PerformanceRankings
          ligacaoSummaries={ligacaoSummaries}
          whatsappSummaries={whatsappSummaries}
          overallSummaries={attendantSummaries}
          period={period}
        />
      </motion.div>

      <motion.div variants={staggerContainerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={cardItemVariants} className="h-full [&>*]:h-full">
<Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Phone className="h-4 w-4" />
              {periodAttendancesLabel(period)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold"><AnimatedNumber value={kpis.totalAttendances} /></p>
          </CardContent>
        </Card>
</motion.div>

        <motion.div variants={cardItemVariants} className="h-full [&>*]:h-full">
<Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tempo Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              <AnimatedText text={kpis.averageTime > 0 ? formatAverageTime(kpis.averageTime) : "—"} />
            </p>
          </CardContent>
        </Card>
</motion.div>

        <motion.div variants={cardItemVariants} className="h-full [&>*]:h-full">
<Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Colaboradores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold"><AnimatedNumber value={kpis.attendantsCount} /></p>
          </CardContent>
        </Card>
</motion.div>

        <motion.div variants={cardItemVariants} className="h-full [&>*]:h-full">
<Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Média da Meta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              <AnimatedText text={kpis.averagePercentage > 0 ? `${Math.round(kpis.averagePercentage)}%` : "—"} />
            </p>
          </CardContent>
        </Card>
</motion.div>
      </motion.div>

      <motion.div variants={pageItemVariants}>
        <ProductivitySection
          records={productivityRecords}
          attendantIds={attendantIds}
          range={displayRange}
        />
      </motion.div>

      <motion.div variants={pageItemVariants} ref={tableRef}>
        <Card>
          <CardHeader>
            <CardTitle>
              {isDayDetailView ? "Registros do Dia" : "Resumo por Colaborador"}
            </CardTitle>
            <CardDescription>
              {filteredRecords.length} registro(s) · {displayRange.label}
              {!isDayDetailView && " — totais agregados do período"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {isDayDetailView ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Atendimentos</TableHead>
                      <TableHead>Tempo Médio</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.length > 0 ? (
                      filteredRecords.map((record) => (
                        <TableRow
                          key={record.id}
                          className={
                            record.id === lastSavedId
                              ? "bg-primary/10 border-primary/30"
                              : undefined
                          }
                        >
                          <TableCell className="font-medium">{record.attendantName}</TableCell>
                          <TableCell>{record.channel}</TableCell>
                          <TableCell>
                            <span className="font-semibold text-primary">{record.attendancesCount}</span>
                          </TableCell>
                          <TableCell>{formatAverageTime(record.averageTimeMinutes)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditModal(record)}
                                title="Editar"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteId(record.id)}
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                          Nenhum registro neste dia. Registre ou importe uma planilha.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>#</TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Pontuação</TableHead>
                      <TableHead>Atendimentos</TableHead>
                      <TableHead>Tempo Médio</TableHead>
                      <TableHead>% Meta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryRows.length > 0 ? (
                      summaryRows.map((row) => (
                        <TableRow key={row.attendantId}>
                          <TableCell className="font-bold text-primary">#{row.ranking}</TableCell>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell>
                            <span className="font-semibold text-primary">
                              {row.performanceScore.toFixed(1)} pts
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">{row.totalAttendances}</span>
                          </TableCell>
                          <TableCell>{formatAverageTime(row.averageTimeMinutes)}</TableCell>
                          <TableCell>
                            <span
                              className={
                                row.averagePercentage >= 90
                                  ? "font-bold text-green-600 dark:text-green-400"
                                  : row.averagePercentage >= 80
                                    ? "font-bold text-yellow-600 dark:text-yellow-400"
                                    : "font-bold text-red-600 dark:text-red-400"
                              }
                            >
                              {Math.round(row.averagePercentage)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                          Nenhum registro no período. Ajuste o filtro ou importe uma planilha.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {chartData.length > 0 && (
        <motion.div variants={pageItemVariants}>
          <Card>
            <CardHeader>
              <CardTitle>Atendimentos por Colaborador</CardTitle>
              <CardDescription>
                {displayRange.label} · Barras azuis = Ligação · Barras verdes = WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} barGap={4} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    contentStyle={chartTooltipContentStyle}
                    formatter={(value: number, name: string) => {
                      const goal = name === "Ligação" ? ligacaoGoal : whatsappGoal;
                      const status = value >= goal ? "✓ acima da meta" : "abaixo da meta";
                      return [`${value} (${status})`, name];
                    }}
                  />
                  <Legend />
                  <ReferenceLine
                    y={ligacaoGoal}
                    stroke="#1d4ed8"
                    strokeDasharray="8 4"
                    strokeWidth={2}
                  />
                  <ReferenceLine
                    y={whatsappGoal}
                    stroke="#059669"
                    strokeDasharray="8 4"
                    strokeWidth={2}
                  />
                  <Bar dataKey="ligacao" fill="#2563eb" name="Ligação" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="whatsapp" fill="#10b981" name="WhatsApp" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Registro" : "Registrar Atendimento do Dia"}
            </DialogTitle>
            <DialogDescription>
              Informe quantos atendimentos o colaborador realizou e o tempo médio por atendimento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="attendant">Colaborador</Label>
              <Select
                value={form.attendantId}
                onValueChange={(value) => {
                  const attendant = attendants.find((a) => a.id === Number(value));
                  setForm({
                    ...form,
                    attendantId: value,
                    channel: attendant?.serviceChannel ?? form.channel,
                  });
                }}
              >
                <SelectTrigger id="attendant">
                  <SelectValue placeholder="Selecione o colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {attendants.map((attendant) => (
                    <SelectItem key={attendant.id} value={String(attendant.id)}>
                      {attendant.name} · {attendant.serviceChannel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Data</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="channel">Canal</Label>
                <Select
                  value={form.channel}
                  onValueChange={(value) =>
                    setForm({ ...form, channel: value as AttendanceChannel })
                  }
                >
                  <SelectTrigger id="channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => (
                      <SelectItem key={channel} value={channel}>
                        {channel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="attendancesCount">Atendimentos no dia</Label>
                <Input
                  id="attendancesCount"
                  type="number"
                  min={1}
                  placeholder="Ex: 70"
                  value={form.attendancesCount}
                  onChange={(e) => setForm({ ...form, attendancesCount: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="averageTime">Tempo médio por atendimento</Label>
                <Input
                  id="averageTime"
                  placeholder="Ex: 4m 30s ou 4.5"
                  value={form.averageTime}
                  onChange={(e) => setForm({ ...form, averageTime: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Use minutos e segundos (4m 30s) ou decimal (4.5 = 4min30s)
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>Salvar Registro</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir registro</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este registro de atendimento?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ImportModal open={showImportModal} onOpenChange={setShowImportModal} />
    </motion.div>
  );
}
