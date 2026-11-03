import { useMemo, useState } from "react";
import { addMonths, subMonths } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  MapPin,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "@/lib/motionVariants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEllosData } from "@/contexts/EllosDataContext";
import { getLocalDateString } from "@/lib/performanceStorage";
import {
  buildMonthDays,
  formatDayLabel,
  formatEventTime,
  formatMonthLabel,
  getEventsForDate,
  isSameDay,
  isSameMonth,
} from "@/lib/calendarMetrics";
import {
  CALENDAR_EVENT_TYPE_COLORS,
  CALENDAR_EVENT_TYPE_DOT,
  CALENDAR_EVENT_TYPE_LABELS,
  type CalendarEvent,
  type CalendarEventType,
} from "@/types/calendarEvent";
import { pageContainerVariants, pageItemVariants } from "@/lib/motionVariants";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

type EventFormState = {
  title: string;
  type: CalendarEventType;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
};

function emptyForm(date = getLocalDateString()): EventFormState {
  return {
    title: "",
    type: "meeting",
    date,
    endDate: date,
    startTime: "",
    endTime: "",
    location: "",
    description: "",
  };
}

function formFromEvent(event: CalendarEvent): EventFormState {
  return {
    title: event.title,
    type: event.type,
    date: event.date,
    endDate: event.endDate ?? event.date,
    startTime: event.startTime ?? "",
    endTime: event.endTime ?? "",
    location: event.location ?? "",
    description: event.description ?? "",
  };
}

export default function CalendarPage() {
  const { calendarEvents, addCalendarEvent, updateCalendarEvent, removeCalendarEvent } =
    useEllosData();

  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [typeFilter, setTypeFilter] = useState<CalendarEventType | "all">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [form, setForm] = useState<EventFormState>(() => emptyForm());

  const monthDays = useMemo(() => buildMonthDays(currentMonth), [currentMonth]);
  const selectedDateIso = getLocalDateString(selectedDate);

  const filteredEvents = useMemo(() => {
    if (typeFilter === "all") return calendarEvents;
    return calendarEvents.filter((event) => event.type === typeFilter);
  }, [calendarEvents, typeFilter]);

  const selectedDayEvents = useMemo(
    () => getEventsForDate(filteredEvents, selectedDateIso),
    [filteredEvents, selectedDateIso]
  );

  const upcomingEvents = useMemo(() => {
    const today = getLocalDateString();
    return [...filteredEvents]
      .filter((event) => (event.endDate ?? event.date) >= today)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.startTime ?? "").localeCompare(b.startTime ?? "");
      })
      .slice(0, 6);
  }, [filteredEvents]);

  const monthEventCount = useMemo(() => {
    const monthPrefix = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;
    return filteredEvents.filter((event) => event.date.startsWith(monthPrefix)).length;
  }, [filteredEvents, currentMonth]);

  const openCreateModal = (date?: Date) => {
    const iso = getLocalDateString(date ?? selectedDate);
    setEditingId(null);
    setForm(emptyForm(iso));
    setIsModalOpen(true);
  };

  const openEditModal = (event: CalendarEvent) => {
    setEditingId(event.id);
    setForm(formFromEvent(event));
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!form.title.trim()) {
      toast.error("Informe o título do evento");
      return;
    }
    if (!form.date) {
      toast.error("Informe a data");
      return;
    }
    if (form.endDate && form.endDate < form.date) {
      toast.error("A data final não pode ser anterior à data inicial");
      return;
    }

    const payload = {
      title: form.title.trim(),
      type: form.type,
      date: form.date,
      endDate: form.endDate !== form.date ? form.endDate : undefined,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      location: form.location || undefined,
      description: form.description || undefined,
    };

    if (editingId) {
      updateCalendarEvent(editingId, payload);
      toast.success("Evento atualizado");
    } else {
      addCalendarEvent(payload);
      toast.success("Evento adicionado ao calendário");
    }

    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleDelete = () => {
    if (deleteConfirm == null) return;
    removeCalendarEvent(deleteConfirm);
    setDeleteConfirm(null);
    toast.success("Evento removido");
  };

  return (
    <motion.div
      className="space-y-6 pb-8"
      variants={pageContainerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        variants={pageItemVariants}
        className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Calendário</h1>
          <p className="mt-1 text-muted-foreground">
            Compromissos, reuniões e acontecimentos da equipe
          </p>
        </div>
        <Button onClick={() => openCreateModal()} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          Novo evento
        </Button>
      </motion.div>

      <motion.div variants={pageItemVariants} className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="ellos-panel-sm p-5 xl:col-span-2">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth((month) => subMonths(month, 1))}
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="min-w-[10rem] text-center text-base font-bold capitalize text-foreground">
                {formatMonthLabel(currentMonth)}
              </h2>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth((month) => addMonths(month, 1))}
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  setCurrentMonth(today);
                  setSelectedDate(today);
                }}
              >
                Hoje
              </Button>
              <Select
                value={typeFilter}
                onValueChange={(value) => setTypeFilter(value as CalendarEventType | "all")}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filtrar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {(Object.keys(CALENDAR_EVENT_TYPE_LABELS) as CalendarEventType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {CALENDAR_EVENT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="py-1 text-center text-xs font-medium text-muted-foreground"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((day) => {
              const dayIso = getLocalDateString(day);
              const dayEvents = getEventsForDate(filteredEvents, dayIso);
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());
              const inCurrentMonth = isSameMonth(day, currentMonth);

              return (
                <button
                  key={dayIso}
                  type="button"
                  onClick={() => {
                    setSelectedDate(day);
                    if (!isSameMonth(day, currentMonth)) {
                      setCurrentMonth(day);
                    }
                  }}
                  onDoubleClick={() => openCreateModal(day)}
                  className={cn(
                    "flex min-h-[5.5rem] flex-col rounded-lg border p-1.5 text-left transition-colors",
                    inCurrentMonth ? "bg-card" : "bg-muted/30 text-muted-foreground",
                    isSelected && "border-primary ring-2 ring-primary/20",
                    !isSelected && "border-border/60 hover:border-primary/40 hover:bg-accent/40"
                  )}
                >
                  <span
                    className={cn(
                      "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      isToday && "bg-primary text-primary-foreground",
                      !isToday && "text-foreground"
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className={cn(
                          "truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight",
                          CALENDAR_EVENT_TYPE_COLORS[event.type]
                        )}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <p className="px-1 text-[10px] text-muted-foreground">
                        +{dayEvents.length - 2} mais
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {monthEventCount} evento(s) neste mês · clique duplo em um dia para criar evento
          </p>
        </div>

        <div className="space-y-4">
          <div className="ellos-panel-sm p-5">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-foreground">Agenda do dia</h2>
                <p className="text-sm text-muted-foreground">{formatDayLabel(selectedDate)}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => openCreateModal(selectedDate)}>
                Adicionar
              </Button>
            </div>

            {selectedDayEvents.length > 0 ? (
              <div className="space-y-3">
                {selectedDayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg border border-border/60 bg-card p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              CALENDAR_EVENT_TYPE_DOT[event.type]
                            )}
                          />
                          <p className="truncate font-medium text-foreground">{event.title}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("mt-2", CALENDAR_EVENT_TYPE_COLORS[event.type])}
                        >
                          {CALENDAR_EVENT_TYPE_LABELS[event.type]}
                        </Badge>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditModal(event)}
                          aria-label="Editar evento"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirm(event.id)}
                          aria-label="Excluir evento"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <p className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {formatEventTime(event)}
                      </p>
                      {event.location && (
                        <p className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {event.location}
                        </p>
                      )}
                      {event.description && (
                        <p className="line-clamp-2 text-xs">{event.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum evento neste dia
              </p>
            )}
          </div>

          <div className="ellos-panel-sm p-5">
            <h2 className="text-base font-bold text-foreground">Próximos eventos</h2>
            <p className="mb-4 text-sm text-muted-foreground">Agenda dos próximos dias</p>
            {upcomingEvents.length > 0 ? (
              <div className="space-y-2">
                {upcomingEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => {
                      const date = new Date(`${event.date}T12:00:00`);
                      setSelectedDate(date);
                      setCurrentMonth(date);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-left transition-colors hover:bg-accent/40"
                  >
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        CALENDAR_EVENT_TYPE_DOT[event.type]
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.date.split("-").reverse().join("/")} · {formatEventTime(event)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhum evento futuro
              </p>
            )}
          </div>
        </div>
      </motion.div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar evento" : "Novo evento"}</DialogTitle>
            <DialogDescription>
              Cadastre compromissos, reuniões, acontecimentos ou lembretes
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="event-title">Título</Label>
              <Input
                id="event-title"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Ex.: Reunião de alinhamento semanal"
              />
            </div>

            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, type: value as CalendarEventType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CALENDAR_EVENT_TYPE_LABELS) as CalendarEventType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {CALENDAR_EVENT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="event-date">Data início</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={form.date}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      date: event.target.value,
                      endDate:
                        !prev.endDate || prev.endDate < event.target.value
                          ? event.target.value
                          : prev.endDate,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="event-end-date">Data fim</Label>
                <Input
                  id="event-end-date"
                  type="date"
                  value={form.endDate}
                  min={form.date}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, endDate: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="event-start-time">Hora início</Label>
                <Input
                  id="event-start-time"
                  type="time"
                  value={form.startTime}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, startTime: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="event-end-time">Hora fim</Label>
                <Input
                  id="event-end-time"
                  type="time"
                  value={form.endTime}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, endTime: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="event-location">Local</Label>
              <Input
                id="event-location"
                value={form.location}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, location: event.target.value }))
                }
                placeholder="Ex.: Sala de reuniões, Teams, etc."
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="event-description">Descrição</Label>
              <Textarea
                id="event-description"
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Detalhes, pauta ou observações"
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              {editingId ? "Salvar alterações" : "Adicionar evento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm != null} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O evento será removido do calendário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
