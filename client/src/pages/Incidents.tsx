import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  ClipboardList,
  Copy,
  Edit2,
  MessageCircle,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import AnimatedNumber from "@/components/AnimatedNumber";
import { useEllosData } from "@/contexts/EllosDataContext";
import { looksLikePersonalData, validateIncidentInput } from "@/lib/incidentStorage";
import { getLocalDateString } from "@/lib/performanceStorage";
import {
  motion,
  pageContainerVariants,
  pageItemVariants,
  staggerContainerVariants,
  cardItemVariants,
} from "@/lib/motionVariants";
import { cn } from "@/lib/utils";
import {
  INCIDENT_DESCRIPTION_MAX,
  INCIDENT_PROTOCOL_MAX,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_TYPE_LABELS,
  type Incident,
  type IncidentChannel,
  type IncidentInput,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentType,
} from "@/types/incident";

const severityStyle: Record<IncidentSeverity, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-warning/10 text-warning border-warning/30",
  high: "bg-danger/10 text-danger border-danger/30",
};

const statusStyle: Record<IncidentStatus, string> = {
  open: "bg-warning/10 text-warning border-warning/30",
  in_progress: "bg-primary-soft text-primary border-primary/30",
  resolved: "bg-success/10 text-success border-success/30",
};

const statusRank: Record<IncidentStatus, number> = { open: 0, in_progress: 1, resolved: 2 };
const severityRank: Record<IncidentSeverity, number> = { high: 0, medium: 1, low: 2 };

type FormState = {
  type: IncidentType | "";
  occurredOn: string;
  channel: IncidentChannel | "";
  attendantId: string;
  protocol: string;
  description: string;
  severity: IncidentSeverity | "";
  status: IncidentStatus;
  actionTaken: string;
};

const emptyForm = (): FormState => ({
  type: "",
  occurredOn: getLocalDateString(),
  channel: "",
  attendantId: "",
  protocol: "",
  description: "",
  severity: "",
  status: "open",
  actionTaken: "",
});

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");
}

export default function Incidents() {
  const { attendants, incidents, addIncident, updateIncident, removeIncident } = useEllosData();

  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const sortedAttendants = useMemo(
    () => [...attendants].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [attendants]
  );

  const counts = useMemo(
    () => ({
      open: incidents.filter((i) => i.status === "open").length,
      inProgress: incidents.filter((i) => i.status === "in_progress").length,
      resolved: incidents.filter((i) => i.status === "resolved").length,
      highPending: incidents.filter((i) => i.severity === "high" && i.status !== "resolved").length,
    }),
    [incidents]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return incidents
      .filter((i) => statusFilter === "all" || i.status === statusFilter)
      .filter((i) => typeFilter === "all" || i.type === typeFilter)
      .filter((i) => severityFilter === "all" || i.severity === severityFilter)
      .filter(
        (i) =>
          !term ||
          i.protocol.toLowerCase().includes(term) ||
          i.attendantName.toLowerCase().includes(term) ||
          i.description.toLowerCase().includes(term)
      )
      .sort(
        (a, b) =>
          statusRank[a.status] - statusRank[b.status] ||
          severityRank[a.severity] - severityRank[b.severity] ||
          b.occurredOn.localeCompare(a.occurredOn)
      );
  }, [incidents, statusFilter, typeFilter, severityFilter, search]);

  const hasFilters = statusFilter !== "all" || typeFilter !== "all" || severityFilter !== "all" || search !== "";

  const personalDataWarning =
    looksLikePersonalData(form.description) || looksLikePersonalData(form.actionTaken);

  const handleOpenModal = (incident?: Incident) => {
    if (incident) {
      setEditingId(incident.id);
      setForm({
        type: incident.type,
        occurredOn: incident.occurredOn,
        channel: incident.channel,
        attendantId: incident.attendantId !== undefined ? String(incident.attendantId) : "",
        protocol: incident.protocol,
        description: incident.description,
        severity: incident.severity,
        status: incident.status,
        actionTaken: incident.actionTaken,
      });
    } else {
      setEditingId(null);
      setForm(emptyForm());
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const buildInput = (): Partial<IncidentInput> => ({
    type: form.type || undefined,
    occurredOn: form.occurredOn,
    channel: form.channel || undefined,
    attendantId: form.attendantId ? Number(form.attendantId) : undefined,
    protocol: form.protocol,
    description: form.description,
    severity: form.severity || undefined,
    status: form.status,
    actionTaken: form.actionTaken,
  });

  const handleSubmit = () => {
    const partial = buildInput();
    const error = validateIncidentInput(partial);
    if (error) {
      toast.error(error);
      return;
    }
    const input = partial as IncidentInput;
    if (editingId !== null) {
      updateIncident(editingId, input);
      toast.success("Ocorrência atualizada.");
    } else {
      addIncident(input);
      toast.success("Ocorrência registrada.");
    }
    handleCloseModal();
  };

  const handleDelete = (id: number) => {
    removeIncident(id);
    setDeleteConfirm(null);
    toast.success("Ocorrência excluída.");
  };

  const quickAdvance = (incident: Incident) => {
    if (incident.status === "open") {
      updateIncident(incident.id, { ...incidentToInput(incident), status: "in_progress" });
      toast.success("Ocorrência em tratamento.");
      return;
    }
    // para resolver é preciso informar a ação tomada
    handleOpenModal({ ...incident, status: "resolved" });
  };

  const copyProtocol = async (protocol: string) => {
    try {
      await navigator.clipboard.writeText(protocol);
      toast.success("Protocolo copiado.");
    } catch {
      toast.error("Não consegui copiar. Selecione o protocolo e copie com Ctrl+C.");
    }
  };

  const kpis = [
    { label: "Abertas", value: counts.open, tone: "text-warning" },
    { label: "Em tratamento", value: counts.inProgress, tone: "text-primary" },
    { label: "Resolvidas", value: counts.resolved, tone: "text-success" },
    { label: "Gravidade alta pendente", value: counts.highPending, tone: "text-danger" },
  ];

  return (
    <motion.div className="space-y-6 pb-8" variants={pageContainerVariants} initial="hidden" animate="visible">
      <motion.div
        variants={pageItemVariants}
        className="flex flex-col gap-4 rounded-lg border border-primary/20 bg-primary-soft p-6 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:flex">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ocorrências</h1>
            <p className="mt-1 text-muted-foreground">
              Reclamações, erros de agendamento e agendamentos incorretos, ligados ao atendimento pelo protocolo
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <Button className="gap-2" onClick={() => handleOpenModal()} disabled={attendants.length === 0}>
            <Plus className="h-[18px] w-[18px]" />
            Registrar ocorrência
          </Button>
        </div>
      </motion.div>

      {attendants.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Cadastre colaboradores em Atendentes antes de registrar ocorrências.
        </p>
      )}

      <motion.div variants={staggerContainerVariants} className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <motion.div key={kpi.label} variants={cardItemVariants} className="ellos-panel-sm p-5">
            <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
            <p className={cn("font-display mt-1 text-3xl font-bold", kpi.tone)}>
              <AnimatedNumber value={kpi.value} />
            </p>
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={pageItemVariants} className="ellos-panel-sm p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por protocolo, agente ou texto"
              aria-label="Buscar ocorrências"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Filtrar por situação">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as situações</SelectItem>
              {(Object.keys(INCIDENT_STATUS_LABELS) as IncidentStatus[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {INCIDENT_STATUS_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger aria-label="Filtrar por tipo">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {(Object.keys(INCIDENT_TYPE_LABELS) as IncidentType[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {INCIDENT_TYPE_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger aria-label="Filtrar por gravidade">
              <SelectValue placeholder="Gravidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as gravidades</SelectItem>
              {(Object.keys(INCIDENT_SEVERITY_LABELS) as IncidentSeverity[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {INCIDENT_SEVERITY_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      <motion.div variants={pageItemVariants} className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {filtered.length} ocorrência(s)
          {hasFilters ? " com os filtros escolhidos" : " registradas"}. As abertas e mais graves aparecem primeiro.
        </p>

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-soft">
                <ShieldAlert className="h-6 w-6 text-primary" />
              </div>
              <p className="font-semibold text-foreground">
                {incidents.length === 0 ? "Nenhuma ocorrência registrada" : "Nenhuma ocorrência com esses filtros"}
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                {incidents.length === 0
                  ? "Quando houver uma reclamação ou um erro de agendamento, registre aqui com o protocolo do atendimento."
                  : "Limpe os filtros para ver todas as ocorrências."}
              </p>
              {hasFilters && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatusFilter("all");
                    setTypeFilter("all");
                    setSeverityFilter("all");
                    setSearch("");
                  }}
                >
                  Limpar filtros
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filtered.map((incident) => {
            const ChannelIcon = incident.channel === "WhatsApp" ? MessageCircle : Phone;
            return (
              <article key={incident.id} className="ellos-panel-sm p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{INCIDENT_TYPE_LABELS[incident.type]}</span>
                      <Badge variant="outline" className={severityStyle[incident.severity]}>
                        Gravidade {INCIDENT_SEVERITY_LABELS[incident.severity].toLowerCase()}
                      </Badge>
                      <Badge variant="outline" className={statusStyle[incident.status]}>
                        {INCIDENT_STATUS_LABELS[incident.status]}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <CalendarIcon className="h-4 w-4" />
                        {formatDate(incident.occurredOn)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <ChannelIcon aria-hidden className={`h-4 w-4 ${incident.channel === "WhatsApp" ? "text-channel-whatsapp-text" : "text-channel-ligacao-text"}`} />
                        {incident.channel}
                      </span>
                      <span>Agente: {incident.attendantName}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {incident.status !== "resolved" && (
                      <Button variant="outline" size="sm" onClick={() => quickAdvance(incident)}>
                        {incident.status === "open" ? "Iniciar tratamento" : "Marcar como resolvida"}
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenModal(incident)}
                      className="rounded-md p-2 transition-colors hover:bg-accent"
                      title="Editar"
                      aria-label="Editar ocorrência"
                    >
                      <Edit2 className="h-[18px] w-[18px] text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(incident.id)}
                      className="rounded-md p-2 transition-colors hover:bg-danger/10"
                      title="Excluir"
                      aria-label="Excluir ocorrência"
                    >
                      <Trash2 className="h-[18px] w-[18px] text-danger" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Protocolo</span>
                  <code className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-sm text-foreground">
                    {incident.protocol}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyProtocol(incident.protocol)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary-soft"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </button>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{incident.description}</p>

                {incident.actionTaken && (
                  <div className="mt-3 rounded-lg border border-border bg-background p-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Ação tomada
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-foreground">{incident.actionTaken}</p>
                    {incident.resolvedAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Resolvida em {new Date(incident.resolvedAt).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </motion.div>

      <Dialog open={isModalOpen} onOpenChange={(open) => (open ? setIsModalOpen(true) : handleCloseModal())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? "Editar ocorrência" : "Registrar ocorrência"}</DialogTitle>
            <DialogDescription>
              Use o protocolo do atendimento. Não digite nome nem CPF do paciente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="incident-type">Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as IncidentType })}>
                <SelectTrigger id="incident-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(INCIDENT_TYPE_LABELS) as IncidentType[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {INCIDENT_TYPE_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="incident-date">Data</Label>
                <Input
                  id="incident-date"
                  type="date"
                  max={getLocalDateString()}
                  value={form.occurredOn}
                  onChange={(e) => setForm({ ...form, occurredOn: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="incident-channel">Canal</Label>
                <Select
                  value={form.channel}
                  onValueChange={(v) => setForm({ ...form, channel: v as IncidentChannel })}
                >
                  <SelectTrigger id="incident-channel">
                    <SelectValue placeholder="Ligação ou WhatsApp" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ligação">Ligação</SelectItem>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="incident-attendant">Agente envolvido</Label>
              <Select value={form.attendantId} onValueChange={(v) => setForm({ ...form, attendantId: v })}>
                <SelectTrigger id="incident-attendant">
                  <SelectValue placeholder="Selecione o agente" />
                </SelectTrigger>
                <SelectContent>
                  {sortedAttendants.map((attendant) => (
                    <SelectItem key={attendant.id} value={String(attendant.id)}>
                      {attendant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="incident-protocol">Protocolo do atendimento</Label>
              <Input
                id="incident-protocol"
                maxLength={INCIDENT_PROTOCOL_MAX}
                placeholder="Número do protocolo na Escallo"
                value={form.protocol}
                onChange={(e) => setForm({ ...form, protocol: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                É o elo com a Escallo: com ele a equipe encontra a conversa ou a gravação.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="incident-description">O que aconteceu</Label>
              <Textarea
                id="incident-description"
                rows={4}
                maxLength={INCIDENT_DESCRIPTION_MAX}
                placeholder="Conte em poucas palavras, sem nome nem CPF do paciente."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <p className="text-right text-xs text-muted-foreground">
                {form.description.length}/{INCIDENT_DESCRIPTION_MAX}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="incident-severity">Gravidade</Label>
                <Select
                  value={form.severity}
                  onValueChange={(v) => setForm({ ...form, severity: v as IncidentSeverity })}
                >
                  <SelectTrigger id="incident-severity">
                    <SelectValue placeholder="Baixa, média ou alta" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(INCIDENT_SEVERITY_LABELS) as IncidentSeverity[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {INCIDENT_SEVERITY_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="incident-status">Situação</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as IncidentStatus })}
                >
                  <SelectTrigger id="incident-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(INCIDENT_STATUS_LABELS) as IncidentStatus[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {INCIDENT_STATUS_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.status !== "open" && (
              <div className="space-y-2">
                <Label htmlFor="incident-action">
                  Ação tomada{form.status === "resolved" ? "" : " (opcional por enquanto)"}
                </Label>
                <Textarea
                  id="incident-action"
                  rows={3}
                  maxLength={INCIDENT_DESCRIPTION_MAX}
                  placeholder="O que foi feito para tratar ou resolver"
                  value={form.actionTaken}
                  onChange={(e) => setForm({ ...form, actionTaken: e.target.value })}
                />
                {form.status === "resolved" && (
                  <p className="text-xs text-muted-foreground">Obrigatória para marcar como resolvida.</p>
                )}
              </div>
            )}

            {personalDataWarning && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  O texto parece ter CPF ou e-mail. Para a LGPD, remova e use só o protocolo do atendimento.
                </span>
              </div>
            )}

            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button type="button" className="flex-1" onClick={handleSubmit}>
                {editingId !== null ? "Salvar alterações" : "Registrar ocorrência"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {deleteConfirm !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDeleteConfirm(null)}
        >
          <div className="ellos-panel w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-danger/10 p-3">
                <AlertCircle className="h-6 w-6 text-danger" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Excluir ocorrência?</h3>
                <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setDeleteConfirm(null)} variant="outline" className="flex-1">
                Cancelar
              </Button>
              <Button onClick={() => handleDelete(deleteConfirm)} variant="destructive" className="flex-1">
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function incidentToInput(incident: Incident): IncidentInput {
  return {
    type: incident.type,
    occurredOn: incident.occurredOn,
    channel: incident.channel,
    attendantId: incident.attendantId ?? 0,
    protocol: incident.protocol,
    description: incident.description,
    severity: incident.severity,
    status: incident.status,
    actionTaken: incident.actionTaken,
  };
}
