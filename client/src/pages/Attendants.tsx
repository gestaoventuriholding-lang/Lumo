import React, { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "@/lib/motionVariants";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertCircle,
  Trash,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { useEllosData } from "@/contexts/EllosDataContext";
import type { Attendant } from "@/types/attendant";
import { formatJornada, isValidJornada } from "@/lib/attendantSchedule";
import { lerCodigoDigitado } from "@/lib/escalloVinculos";
import AttendantOccupancyMap from "@/components/AttendantOccupancyMap";
import ChannelBadge from "@/components/ChannelBadge";
import { desligadoEmTexto, isTerminated } from "@/lib/attendantStatus";
import { CANAL_LIGACAO_E_WHATSAPP } from "@/types/attendant";
import { FUNCAO_ATENDIMENTO, FUNCAO_CONFIRMACAO, FUNCOES, isConfirmacao, type Funcao } from "@/lib/attendantRole";
import { pageContainerVariants, pageItemVariants } from "@/lib/motionVariants";


const serviceChannelOptions: { value: Attendant["serviceChannel"]; label: string }[] = [
  { value: "Ligação", label: "Ligação" },
  { value: "WhatsApp", label: "WhatsApp" },
  { value: CANAL_LIGACAO_E_WHATSAPP, label: CANAL_LIGACAO_E_WHATSAPP },
];

type FiltroSituacao = "ativos" | "desligados" | "todos";
type FiltroFuncao = "todas" | Funcao;

export default function Attendants() {
  const {
    attendants,
    workingHoursOptions,
    addAttendant,
    updateAttendant,
    removeAttendant,
    removeAttendants,
  } = useEllosData();
  const [searchTerm, setSearchTerm] = useState("");
  const [situacao, setSituacao] = useState<FiltroSituacao>("ativos");
  const [funcaoFiltro, setFuncaoFiltro] = useState<FiltroFuncao>("todas");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const itemsPerPage = 10;

  // Código da Escallo digitado à mão (texto, para aceitar vazio)
  const [escalloCodigoTexto, setEscalloCodigoTexto] = useState("");
  const [formData, setFormData] = useState<Omit<Attendant, "id" | "registrationDate" | "escalloCodigo">>({
    name: "",
    role: FUNCAO_ATENDIMENTO,
    serviceChannel: "Ligação",
    workingHours: "",
    jornadaStart: "",
    jornadaEnd: "",
    observation: "",
  });

  // Filtrar por busca
  const filteredAttendants = useMemo(() => {
    return attendants
      .filter((attendant) => attendant.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .filter((attendant) =>
        situacao === "todos" ? true : situacao === "desligados" ? isTerminated(attendant) : !isTerminated(attendant)
      )
      .filter((attendant) => funcaoFiltro === "todas" || (funcaoFiltro === FUNCAO_CONFIRMACAO ? isConfirmacao(attendant) : !isConfirmacao(attendant)));
  }, [attendants, searchTerm, situacao, funcaoFiltro]);

  // Paginação
  const totalPages = Math.ceil(filteredAttendants.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAttendants = filteredAttendants.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleOpenModal = (attendant?: Attendant) => {
    if (attendant) {
      setEditingId(attendant.id);
      setFormData({
        name: attendant.name,
        role: isConfirmacao(attendant) ? FUNCAO_CONFIRMACAO : FUNCAO_ATENDIMENTO,
        serviceChannel: attendant.serviceChannel,
        workingHours: attendant.workingHours,
        jornadaStart: attendant.jornadaStart,
        jornadaEnd: attendant.jornadaEnd,
        observation: attendant.observation,
        terminatedOn: attendant.terminatedOn ?? null,
      });
      setEscalloCodigoTexto(attendant.escalloCodigo != null ? String(attendant.escalloCodigo) : "");
    } else {
      setEscalloCodigoTexto("");
      setEditingId(null);
      setFormData({
        name: "",
        role: FUNCAO_ATENDIMENTO,
        serviceChannel: "Ligação",
        workingHours: "",
        jornadaStart: "",
        jornadaEnd: "",
        observation: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setEscalloCodigoTexto("");
    setFormData({
      name: "",
      role: FUNCAO_ATENDIMENTO,
      serviceChannel: "Ligação",
      workingHours: "",
      jornadaStart: "",
      jornadaEnd: "",
      observation: "",
    });
  };

  // a carga atual do colaborador continua escolhível mesmo se saiu da lista de Configurações
  const hoursChoices = useMemo(() => {
    const labels = workingHoursOptions.map((o) => o.label);
    return formData.workingHours && !labels.includes(formData.workingHours)
      ? [...labels, formData.workingHours]
      : labels;
  }, [workingHoursOptions, formData.workingHours]);

  const handleSave = () => {
    if (!formData.name || !formData.workingHours || !formData.serviceChannel) {
      toast.error("Preencha nome, canal e carga horária");
      return;
    }

    if (!isValidJornada(formData.jornadaStart, formData.jornadaEnd)) {
      toast.error("Informe início e fim da jornada (o horário final deve ser após o inicial)");
      return;
    }

    const codigoLido = lerCodigoDigitado(escalloCodigoTexto);
    if ("erro" in codigoLido) {
      toast.error(codigoLido.erro);
      return;
    }
    if (codigoLido.codigo !== null) {
      // Um código da Escallo só pode pertencer a um colaborador.
      const dono = attendants.find((a) => a.escalloCodigo === codigoLido.codigo && a.id !== editingId);
      if (dono) {
        toast.error(`O código ${codigoLido.codigo} já pertence a ${dono.name}.`);
        return;
      }
    }

    // "Desligado" marcado exige o último dia trabalhado
    if (formData.terminatedOn === "") {
      toast.error("Informe o último dia trabalhado do colaborador desligado");
      return;
    }

    const payload = {
      ...formData,
      escalloCodigo: codigoLido.codigo,
      terminatedOn: formData.terminatedOn || null,
    };

    if (editingId) {
      updateAttendant(editingId, payload);
      toast.success("Colaborador atualizado com sucesso!");
    } else {
      addAttendant(payload);
      toast.success("Colaborador adicionado com sucesso!");
    }

    handleCloseModal();
  };

  const handleDelete = (id: number) => {
    removeAttendant(id);
    setDeleteConfirm(null);
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    toast.success("Colaborador removido com sucesso!");
  };

  const handleSelectRow = (id: number) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedAttendants.length && paginatedAttendants.length > 0) {
      setSelectedIds(new Set());
    } else {
      const allIds = new Set(paginatedAttendants.map((att) => att.id));
      setSelectedIds(allIds);
    }
  };

  const handleBulkDelete = () => {
    const count = selectedIds.size;
    removeAttendants(Array.from(selectedIds));
    setSelectedIds(new Set());
    setBulkDeleteConfirm(false);
    toast.success(`${count} colaborador(es) removido(s) com sucesso!`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("pt-BR");
  };

  return (
    <motion.div
      className="space-y-4 pb-6"
      initial="hidden"
      animate="visible"
      variants={pageContainerVariants}
    >
      {/* Header */}
      <motion.div variants={pageItemVariants} className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Atendentes</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie seus colaboradores e suas informações
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link href="/escallo-vinculos">
                <Link2 className="h-4 w-4" />
                Vincular com a Escallo
              </Link>
            </Button>
            <Button
              onClick={() => handleOpenModal()}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Novo Colaborador
            </Button>
          </div>
        </div>

        {/* Search and Bulk Actions */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 h-11 border-border/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="filtro-situacao" className="text-sm text-muted-foreground">
              Situação
            </label>
            <Select
              value={situacao}
              onValueChange={(value: FiltroSituacao) => {
                setSituacao(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger id="filtro-situacao" className="w-44 border-border/50" data-testid="filtro-situacao">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativos">Ativos</SelectItem>
                <SelectItem value="desligados">Desligados</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
            <label htmlFor="filtro-funcao" className="ml-2 text-sm text-muted-foreground">
              Função
            </label>
            <Select
              value={funcaoFiltro}
              onValueChange={(value: FiltroFuncao) => {
                setFuncaoFiltro(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger id="filtro-funcao" className="w-52 border-border/50" data-testid="filtro-funcao">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {FUNCOES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Delete Bar */}
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg p-3"
            >
              <span className="text-sm font-medium text-primary">
                {selectedIds.size} colaborador(es) selecionado(s)
              </span>
              <Button
                onClick={() => setBulkDeleteConfirm(true)}
                variant="destructive"
                size="sm"
                className="gap-2"
              >
                <Trash className="h-4 w-4" />
                Excluir Selecionados
              </Button>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        variants={pageItemVariants}
        className="ellos-panel overflow-hidden"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 bg-muted/30">
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.size === paginatedAttendants.length && paginatedAttendants.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="font-semibold text-foreground">
                  Nome
                </TableHead>
                <TableHead className="font-semibold text-foreground">
                  Canal
                </TableHead>
                <TableHead className="font-semibold text-foreground">
                  Carga Horária
                </TableHead>
                <TableHead className="font-semibold text-foreground">
                  Jornada
                </TableHead>
                <TableHead className="font-semibold text-foreground">
                  Observação
                </TableHead>
                <TableHead className="font-semibold text-foreground">
                  Data de Cadastro
                </TableHead>
                <TableHead className="font-semibold text-foreground text-right">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* sem AnimatePresence: a saída das linhas antigas se sobrepunha às novas ao trocar de página */}
              <>
                {paginatedAttendants.length > 0 ? (
                  paginatedAttendants.map((attendant, index) => (
                    <motion.tr
                      key={attendant.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: Math.min(index, 9) * 0.03 }}
                      className={`border-border/50 transition-colors ${
                        selectedIds.has(attendant.id)
                          ? "bg-primary/10"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <TableCell className="w-12">
                        <Checkbox
                          checked={selectedIds.has(attendant.id)}
                          onCheckedChange={() => handleSelectRow(attendant.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {attendant.name}
                        {isConfirmacao(attendant) && (
                          <span
                            className="ml-2 inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                            data-testid="selo-confirmacao"
                          >
                            {FUNCAO_CONFIRMACAO}
                          </span>
                        )}
                        {attendant.terminatedOn && (
                          <span
                            className="ml-2 inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                            data-testid="selo-desligado"
                          >
                            {desligadoEmTexto(attendant.terminatedOn)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ChannelBadge channel={attendant.serviceChannel} />
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary dark:bg-primary/20">
                          {attendant.workingHours || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatJornada(attendant) || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {attendant.observation || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(attendant.registrationDate)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleOpenModal(attendant)}
                            className="p-2 hover:bg-accent rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="h-[18px] w-[18px] text-muted-foreground" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setDeleteConfirm(attendant.id)}
                            className="p-2 hover:bg-danger/10 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="h-[18px] w-[18px] text-danger" />
                          </motion.button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))
                ) : (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-border/50"
                  >
                    <TableCell colSpan={8} className="text-center py-8">
                      <p className="text-muted-foreground">
                        Nenhum colaborador encontrado
                      </p>
                    </TableCell>
                  </motion.tr>
                )}
              </>
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <motion.div
            variants={pageItemVariants}
            className="flex justify-center items-center gap-2 p-4 border-t border-border/50"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Próxima
            </Button>
          </motion.div>
        )}
      </motion.div>

      <motion.div variants={pageItemVariants}>
        <AttendantOccupancyMap attendants={attendants} />
      </motion.div>

      {/* Modal Cadastro/Edição */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {editingId ? "Editar Colaborador" : "Novo Colaborador"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Atualize os dados do colaborador"
                : "Preencha os dados do novo colaborador"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Nome */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Nome do Colaborador *
              </label>
              <Input
                placeholder="Digite o nome completo"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="border-border/50"
              />
            </div>

            {/* Função */}
            <div className="space-y-2">
              <label htmlFor="funcao" className="text-sm font-medium text-foreground">
                Função *
              </label>
              <Select value={formData.role} onValueChange={(value: Funcao) => setFormData({ ...formData, role: value })}>
                <SelectTrigger id="funcao" className="border-border/50">
                  <SelectValue placeholder="Selecione a função" />
                </SelectTrigger>
                <SelectContent>
                  {FUNCOES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.role === FUNCAO_CONFIRMACAO && (
                <p className="text-xs text-muted-foreground">
                  Fica fora dos rankings, das médias e das metas do atendimento. O trabalho dela continua gravado.
                </p>
              )}
            </div>

            {/* Canal */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Canal de atendimento *
              </label>
              <Select
                value={formData.serviceChannel}
                onValueChange={(value: Attendant["serviceChannel"]) =>
                  setFormData({ ...formData, serviceChannel: value })
                }
              >
                <SelectTrigger className="border-border/50">
                  <SelectValue placeholder="Selecione o canal" />
                </SelectTrigger>
                <SelectContent>
                  {serviceChannelOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Carga Horária */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Carga Horária *
              </label>
              <Select
                value={formData.workingHours}
                onValueChange={(value) =>
                  setFormData({ ...formData, workingHours: value })
                }
              >
                <SelectTrigger className="border-border/50">
                  <SelectValue placeholder="Selecione a carga horária" />
                </SelectTrigger>
                <SelectContent>
                  {hoursChoices.map((hours) => (
                    <SelectItem key={hours} value={hours}>
                      {hours}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {workingHoursOptions.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhuma carga horária cadastrada.{" "}
                  <Link href="/settings" className="font-medium text-primary underline-offset-2 hover:underline">
                    Cadastre em Configurações
                  </Link>
                  .
                </p>
              )}
            </div>

            {/* Jornada */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Jornada
              </label>
              <p className="text-xs text-muted-foreground">
                Horário de trabalho na empresa (ex.: 12:40 até 19:00)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Início</span>
                  <Input
                    type="time"
                    value={formData.jornadaStart}
                    onChange={(e) =>
                      setFormData({ ...formData, jornadaStart: e.target.value })
                    }
                    className="border-border/50"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Fim</span>
                  <Input
                    type="time"
                    value={formData.jornadaEnd}
                    onChange={(e) =>
                      setFormData({ ...formData, jornadaEnd: e.target.value })
                    }
                    className="border-border/50"
                  />
                </div>
              </div>
              {formData.jornadaStart && formData.jornadaEnd && (
                <p className="text-xs text-primary font-medium">
                  {formatJornada(formData)}
                </p>
              )}
            </div>

            {/* Desligamento */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="desligado"
                  checked={formData.terminatedOn != null}
                  onCheckedChange={(marcado) =>
                    setFormData({ ...formData, terminatedOn: marcado === true ? "" : null })
                  }
                />
                <label htmlFor="desligado" className="text-sm font-medium text-foreground">
                  Desligado
                </label>
              </div>
              {formData.terminatedOn != null && (
                <div className="space-y-1">
                  <label htmlFor="terminated-on" className="text-sm font-medium text-foreground">
                    Data de desligamento *
                  </label>
                  <Input
                    id="terminated-on"
                    type="date"
                    value={formData.terminatedOn}
                    onChange={(e) => setFormData({ ...formData, terminatedOn: e.target.value })}
                    className="border-border/50"
                  />
                  <p className="text-xs text-muted-foreground">Último dia trabalhado</p>
                </div>
              )}
            </div>

            {/* Código Escallo */}
            <div className="space-y-2">
              <label htmlFor="escallo-codigo" className="text-sm font-medium text-foreground">
                Código Escallo
              </label>
              <Input
                id="escallo-codigo"
                inputMode="numeric"
                placeholder="Vazio = ainda não vinculado"
                value={escalloCodigoTexto}
                onChange={(e) => setEscalloCodigoTexto(e.target.value)}
                className="border-border/50 tabular-nums"
              />
              <p className="text-xs text-muted-foreground">
                Número do agente no relatório da Escallo. Normalmente é preenchido pela tela Vincular com a Escallo.
              </p>
            </div>

            {/* Observação */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Observação
              </label>
              <Input
                placeholder="Anotações do gestor (opcional)"
                value={formData.observation}
                onChange={(e) =>
                  setFormData({ ...formData, observation: e.target.value })
                }
                className="border-border/50"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleCloseModal}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1"
            >
              {editingId ? "Atualizar" : "Adicionar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      {bulkDeleteConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setBulkDeleteConfirm(false)}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            className="ellos-panel p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-danger/10 rounded-full p-3">
                <AlertCircle className="h-6 w-6 text-danger" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground">
                  Excluir {selectedIds.size} colaborador(es)?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setBulkDeleteConfirm(false)}
                variant="outline"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleBulkDelete}
                variant="destructive"
                className="flex-1"
              >
                Excluir
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setDeleteConfirm(null)}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            className="ellos-panel p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-danger/10 rounded-full p-3">
                <AlertCircle className="h-6 w-6 text-danger" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground">
                  Excluir colaborador?
                </h3>
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
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
