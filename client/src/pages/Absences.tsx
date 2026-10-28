import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { motion } from "@/lib/motionVariants";
import { Plus, Calendar as CalendarIcon, Clock, AlertCircle, Edit2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLumoData } from "@/contexts/LumoDataContext";
import { countAbsenceDays } from "@/lib/absenceStorage";
import { getAbsencesForDate } from "@/lib/absenceMetrics";
import { getLocalDateString } from "@/lib/performanceStorage";
import { getMonthString } from "@/lib/dateRangeFilter";
import type { Absence, AbsenceType } from "@/types/absence";
import { pageContainerVariants, pageItemVariants, staggerContainerVariants, cardItemVariants } from "@/lib/motionVariants";
import AnimatedNumber from "@/components/AnimatedNumber";

const absenceTypes = {
  vacation: { label: "Férias", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  sick: { label: "Licença Médica", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  personal: { label: "Motivo Pessoal", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
};

const statusConfig = {
  approved: { label: "Aprovado", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  pending: { label: "Pendente", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  rejected: { label: "Rejeitado", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

const emptyForm = {
  attendantId: "",
  type: "" as AbsenceType | "",
  startDate: getLocalDateString(),
  endDate: getLocalDateString(),
  reason: "",
};

export default function Absences() {
  const {
    attendants,
    absences,
    addAbsence,
    updateAbsence,
    updateAbsenceStatus,
    removeAbsence,
  } = useLumoData();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [calendarFilterDate, setCalendarFilterDate] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const currentMonth = getMonthString();

  const absentDates = useMemo(() => {
    const dates: Date[] = [];
    for (const absence of absences.filter((a) => a.status !== "rejected")) {
      const current = new Date(`${absence.startDate}T12:00:00`);
      const end = new Date(`${absence.endDate}T12:00:00`);
      while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
    }
    return dates;
  }, [absences]);

  const selectedDateStr = selectedDate ? getLocalDateString(selectedDate) : null;

  const filteredAbsences = useMemo(() => {
    return absences
      .filter((absence) => typeFilter === "all" || absence.type === typeFilter)
      .filter((absence) => {
        if (!calendarFilterDate) return true;
        return (
          calendarFilterDate >= absence.startDate && calendarFilterDate <= absence.endDate
        );
      })
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [absences, typeFilter, calendarFilterDate]);

  const absencesThisMonth = useMemo(() => {
    const [year, month] = currentMonth.split("-").map(Number);
    return absences.filter((absence) => {
      const start = new Date(`${absence.startDate}T12:00:00`);
      return start.getFullYear() === year && start.getMonth() + 1 === month;
    }).length;
  }, [absences, currentMonth]);

  const pendingCount = absences.filter((a) => a.status === "pending").length;
  const approvedVacations = absences.filter(
    (a) => a.type === "vacation" && a.status === "approved"
  ).length;

  const handleOpenModal = (absence?: Absence) => {
    if (absence) {
      setEditingId(absence.id);
      setForm({
        attendantId: String(absence.attendantId),
        type: absence.type,
        startDate: absence.startDate,
        endDate: absence.endDate,
        reason: absence.reason,
      });
    } else {
      setEditingId(null);
      setForm(emptyForm);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = () => {
    if (!form.attendantId || !form.type || !form.startDate || !form.endDate) {
      toast.error("Preencha colaborador, tipo e datas.");
      return;
    }
    if (form.endDate < form.startDate) {
      toast.error("A data final deve ser igual ou posterior à inicial.");
      return;
    }

    const payload = {
      attendantId: Number(form.attendantId),
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      reason: form.reason,
    };

    if (editingId) {
      updateAbsence(editingId, payload);
      toast.success("Ausência atualizada com sucesso!");
    } else {
      addAbsence({ ...payload, status: "approved" });
      toast.success("Ausência registrada com sucesso!");
    }

    setCalendarFilterDate(null);
    setSelectedDate(new Date(`${form.startDate}T12:00:00`));
    handleCloseModal();
  };

  const handleDelete = (id: number) => {
    removeAbsence(id);
    setDeleteConfirm(null);
    toast.success("Ausência excluída.");
  };

  const absencesOnSelectedDay = selectedDateStr
    ? getAbsencesForDate(absences, selectedDateStr)
    : [];

  return (
    <motion.div
      className="space-y-4"
      variants={pageContainerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={pageItemVariants} className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Ausências</h1>
        <p className="text-muted-foreground">Gerencie afastamentos e férias da equipe</p>
      </motion.div>

      <motion.div variants={pageItemVariants}>
        <Button
          className="gap-2 bg-primary hover:bg-primary/90"
          onClick={() => handleOpenModal()}
          disabled={attendants.length === 0}
        >
          <Plus className="h-4 w-4" />
          Registrar Ausência
        </Button>
        {attendants.length === 0 && (
          <p className="text-sm text-muted-foreground mt-2">
            Cadastre colaboradores em Atendentes antes de registrar ausências.
          </p>
        )}
      </motion.div>

      <motion.div variants={pageItemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Calendário</CardTitle>
            <CardDescription>
              {selectedDateStr
                ? `${absencesOnSelectedDay.length} ausência(s) neste dia`
                : "Selecione um dia"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                setCalendarFilterDate(date ? getLocalDateString(date) : null);
              }}
              modifiers={{ absent: absentDates }}
              modifiersClassNames={{ absent: "bg-primary/20 font-semibold text-primary" }}
              className="rounded-md border border-border lumo-inset"
            />
            {calendarFilterDate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full mt-3"
                onClick={() => {
                  setCalendarFilterDate(null);
                  setSelectedDate(new Date());
                }}
              >
                Ver todas as ausências
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>Ausências Registradas</CardTitle>
                <CardDescription>
                  {filteredAbsences.length} ausência(s)
                  {calendarFilterDate
                    ? ` em ${selectedDate?.toLocaleDateString("pt-BR")}`
                    : " registradas"}
                </CardDescription>
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Tipos</SelectItem>
                  <SelectItem value="vacation">Férias</SelectItem>
                  <SelectItem value="sick">Licença Médica</SelectItem>
                  <SelectItem value="personal">Motivo Pessoal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredAbsences.length > 0 ? (
                filteredAbsences.map((absence, index) => (
                  <motion.div
                    key={absence.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 rounded-lg bg-background/50 hover:bg-background/80 transition-colors border border-border/30"
                  >
                    <div className="flex items-start justify-between mb-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{absence.attendantName}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {absence.reason || absenceTypes[absence.type].label}
                        </p>
                      </div>
                      <div className="flex items-start gap-2 shrink-0">
                        <div className="flex gap-2">
                          <Badge variant="outline" className={absenceTypes[absence.type].color}>
                            {absenceTypes[absence.type].label}
                          </Badge>
                          <Badge variant="outline" className={statusConfig[absence.status].color}>
                            {statusConfig[absence.status].label}
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenModal(absence)}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4 text-primary" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(absence.id)}
                            className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-4 w-4" />
                        <span>
                          {new Date(`${absence.startDate}T12:00:00`).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      {absence.startDate !== absence.endDate && (
                        <>
                          <span>até</span>
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="h-4 w-4" />
                            <span>
                              {new Date(`${absence.endDate}T12:00:00`).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                        </>
                      )}
                      <span className="ml-auto">
                        {countAbsenceDays(absence.startDate, absence.endDate)} dia(s)
                      </span>
                    </div>

                    {absence.status === "pending" && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            updateAbsenceStatus(absence.id, "approved");
                            toast.success("Ausência aprovada.");
                          }}
                        >
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-destructive hover:text-destructive"
                          onClick={() => {
                            updateAbsenceStatus(absence.id, "rejected");
                            toast.success("Ausência rejeitada.");
                          }}
                        >
                          Rejeitar
                        </Button>
                      </div>
                    )}
                  </motion.div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma ausência encontrada. Registre uma nova ou ajuste os filtros.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={staggerContainerVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div variants={cardItemVariants} className="h-full [&>*]:h-full">
<Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Ausências Este Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground"><AnimatedNumber value={absencesThisMonth} /></p>
          </CardContent>
        </Card>
</motion.div>

        <motion.div variants={cardItemVariants} className="h-full [&>*]:h-full">
<Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pendentes de Aprovação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-400"><AnimatedNumber value={pendingCount} /></p>
          </CardContent>
        </Card>
</motion.div>

        <motion.div variants={cardItemVariants} className="h-full [&>*]:h-full">
<Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Férias Aprovadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-400"><AnimatedNumber value={approvedVacations} /></p>
          </CardContent>
        </Card>
</motion.div>
      </motion.div>

      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseModal();
          else setIsModalOpen(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Ausência" : "Registrar Nova Ausência"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Atualize os dados do afastamento ou férias"
                : "Adicione um afastamento ou férias para um colaborador"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="absence-attendant">Colaborador</Label>
              <Select
                value={form.attendantId}
                onValueChange={(value) => setForm({ ...form, attendantId: value })}
              >
                <SelectTrigger id="absence-attendant">
                  <SelectValue placeholder="Selecione o colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {attendants.map((attendant) => (
                    <SelectItem key={attendant.id} value={String(attendant.id)}>
                      {attendant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="absence-type">Tipo de ausência</Label>
              <Select
                value={form.type}
                onValueChange={(value) => setForm({ ...form, type: value as AbsenceType })}
              >
                <SelectTrigger id="absence-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacation">Férias</SelectItem>
                  <SelectItem value="sick">Licença Médica</SelectItem>
                  <SelectItem value="personal">Motivo Pessoal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="absence-start">Data inicial</Label>
                <Input
                  id="absence-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="absence-end">Data final</Label>
                <Input
                  id="absence-end"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="absence-reason">Motivo (opcional)</Label>
              <Input
                id="absence-reason"
                placeholder="Ex.: consulta médica, viagem..."
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button type="button" className="flex-1" onClick={handleSubmit}>
                {editingId ? "Salvar alterações" : "Registrar Ausência"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {deleteConfirm !== null && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="lumo-panel p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 dark:bg-red-950/40 rounded-full p-3">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground">Excluir ausência?</h3>
                <p className="text-sm text-muted-foreground">
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setDeleteConfirm(null)}
                variant="outline"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => handleDelete(deleteConfirm)}
                variant="destructive"
                className="flex-1"
              >
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
