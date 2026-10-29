import React, { useState, useMemo, useEffect } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { useLumoData } from "@/contexts/LumoDataContext";
import type { Attendant } from "@/types/attendant";
import { formatJornada, isValidJornada } from "@/lib/attendantSchedule";
import AttendantOccupancyMap from "@/components/AttendantOccupancyMap";
import { pageContainerVariants, pageItemVariants } from "@/lib/motionVariants";

const ATTENDANT_ROLE = "Atendente";

const workingHoursOptions = ["06h20", "08h00", "12x36", "Personalizado"];

const serviceChannelOptions: { value: Attendant["serviceChannel"]; label: string }[] = [
  { value: "Ligação", label: "Ligação" },
  { value: "WhatsApp", label: "WhatsApp" },
];

function serviceChannelBadgeClass(channel: Attendant["serviceChannel"]): string {
  return channel === "WhatsApp"
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : "bg-blue-500/15 text-blue-700 dark:text-blue-300";
}

export default function Attendants() {
  const { attendants, addAttendant, updateAttendant, removeAttendant, removeAttendants } =
    useLumoData();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState<Omit<Attendant, "id" | "registrationDate" | "role">>({
    name: "",
    serviceChannel: "Ligação",
    workingHours: "",
    jornadaStart: "",
    jornadaEnd: "",
    observation: "",
  });

  // Filtrar por busca
  const filteredAttendants = useMemo(() => {
    return attendants.filter((attendant) =>
      attendant.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [attendants, searchTerm]);

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
        serviceChannel: attendant.serviceChannel,
        workingHours: attendant.workingHours,
        jornadaStart: attendant.jornadaStart,
        jornadaEnd: attendant.jornadaEnd,
        observation: attendant.observation,
      });
    } else {
      setEditingId(null);
      setFormData({
        name: "",
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
    setFormData({
      name: "",
      serviceChannel: "Ligação",
      workingHours: "",
      jornadaStart: "",
      jornadaEnd: "",
      observation: "",
    });
  };

  const handleSave = () => {
    if (!formData.name || !formData.workingHours || !formData.serviceChannel) {
      toast.error("Preencha nome, canal e carga horária");
      return;
    }

    if (!isValidJornada(formData.jornadaStart, formData.jornadaEnd)) {
      toast.error("Informe início e fim da jornada (o horário final deve ser após o inicial)");
      return;
    }

    const payload = { ...formData, role: ATTENDANT_ROLE };

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
          <Button
            onClick={() => handleOpenModal()}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Novo Colaborador
          </Button>
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
        className="lumo-panel overflow-hidden"
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
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${serviceChannelBadgeClass(attendant.serviceChannel)}`}
                        >
                          {attendant.serviceChannel}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary dark:bg-primary/20">
                          {attendant.workingHours}
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
                            className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4 text-blue-600" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setDeleteConfirm(attendant.id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
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
                className={
                  currentPage === page
                    ? "bg-blue-600 hover:bg-blue-700"
                    : ""
                }
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
                  {workingHoursOptions.map((hours) => (
                    <SelectItem key={hours} value={hours}>
                      {hours}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
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
            className="lumo-panel p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 dark:bg-red-950/40 rounded-full p-3">
                <AlertCircle className="h-6 w-6 text-red-600" />
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
            className="lumo-panel p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 dark:bg-red-950/40 rounded-full p-3">
                <AlertCircle className="h-6 w-6 text-red-600" />
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
