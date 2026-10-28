import { newId } from "@/lib/ids";
import React, { useState } from "react";
import { motion, AnimatePresence } from "@/lib/motionVariants";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionGoal, AttendanceChannel, GoalStatus } from "@/types/goals";
import { useLumoData } from "@/contexts/LumoDataContext";
import { pageContainerVariants, pageItemVariants } from "@/lib/motionVariants";

const channels: AttendanceChannel[] = ["Ligação", "WhatsApp"];
const statuses: GoalStatus[] = ["Ativo", "Inativo"];

interface GoalsManagementProps {
  onDataChange?: (data: { productionGoals: ProductionGoal[] }) => void;
}

export default function GoalsManagement({ onDataChange }: GoalsManagementProps) {
  const { productionGoals, setProductionGoals } = useLumoData();
  const [isProductionModalOpen, setIsProductionModalOpen] = useState(false);
  const [editingProductionId, setEditingProductionId] = useState<number | null>(null);
  const [productionFormData, setProductionFormData] = useState<
    Omit<ProductionGoal, "id" | "createdAt" | "updatedAt">
  >({
    channel: "Ligação",
    dailyTarget: 70,
    status: "Ativo",
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const handleOpenProductionModal = (goal?: ProductionGoal) => {
    if (goal) {
      setEditingProductionId(goal.id);
      setProductionFormData({
        channel: goal.channel,
        dailyTarget: goal.dailyTarget,
        status: goal.status,
      });
    } else {
      setEditingProductionId(null);
      setProductionFormData({
        channel: "Ligação",
        dailyTarget: 70,
        status: "Ativo",
      });
    }
    setIsProductionModalOpen(true);
  };

  const handleSaveProductionGoal = () => {
    if (!productionFormData.channel || productionFormData.dailyTarget <= 0) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (editingProductionId) {
      const updated = productionGoals.map((goal) =>
        goal.id === editingProductionId
          ? {
              ...goal,
              channel: productionFormData.channel,
              dailyTarget: productionFormData.dailyTarget,
              status: productionFormData.status,
              updatedAt: new Date().toISOString().split("T")[0],
            }
          : goal
      );
      setProductionGoals(updated);
      toast.success("Meta de produção atualizada!");
    } else {
      const newGoal: ProductionGoal = {
        id: newId(),
        channel: productionFormData.channel,
        dailyTarget: productionFormData.dailyTarget,
        status: productionFormData.status,
        createdAt: new Date().toISOString().split("T")[0],
        updatedAt: new Date().toISOString().split("T")[0],
      };
      setProductionGoals([...productionGoals, newGoal]);
      toast.success("Meta de produção adicionada!");
    }
    setIsProductionModalOpen(false);
    onDataChange?.({ productionGoals });
  };

  const handleDeleteProductionGoal = (id: number) => {
    setProductionGoals(productionGoals.filter((goal) => goal.id !== id));
    setDeleteConfirmId(null);
    toast.success("Meta de produção removida!");
    onDataChange?.({ productionGoals });
  };

  return (
    <motion.div
      className="space-y-6"
      variants={pageContainerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={pageItemVariants}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Metas de Produção</CardTitle>
                <CardDescription>
                  Ligação e WhatsApp — quantidade diária esperada por colaborador
                </CardDescription>
              </div>
              <Button
                onClick={() => handleOpenProductionModal()}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                size="sm"
              >
                <Plus className="h-4 w-4" />
                Adicionar Meta
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/30">
                    <TableHead className="font-semibold text-foreground">
                      Tipo de Atendimento
                    </TableHead>
                    <TableHead className="font-semibold text-foreground">
                      Quantidade Esperada/Dia
                    </TableHead>
                    <TableHead className="font-semibold text-foreground">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold text-foreground text-right">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {productionGoals.length > 0 ? (
                      productionGoals.map((goal, index) => (
                        <motion.tr
                          key={goal.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ delay: index * 0.05 }}
                          className="border-border hover:bg-muted/50 transition-colors"
                        >
                          <TableCell className="font-medium text-foreground">
                            {goal.channel}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-semibold text-blue-600">
                              {goal.dailyTarget}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                goal.status === "Ativo"
                                  ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {goal.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleOpenProductionModal(goal)}
                                className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="h-4 w-4 text-blue-600" />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setDeleteConfirmId(goal.id)}
                                className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
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
                        className="border-border"
                      >
                        <TableCell colSpan={4} className="text-center py-8">
                          <p className="text-muted-foreground">
                            Nenhuma meta de produção configurada. Clique em Adicionar Meta.
                          </p>
                        </TableCell>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={isProductionModalOpen} onOpenChange={setIsProductionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProductionId ? "Editar Meta de Produção" : "Adicionar Meta de Produção"}
            </DialogTitle>
            <DialogDescription>
              Configure a meta de atendimentos esperados por dia
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="channel">Tipo de Atendimento</Label>
              <Select
                value={productionFormData.channel}
                onValueChange={(value) =>
                  setProductionFormData({
                    ...productionFormData,
                    channel: value as AttendanceChannel,
                  })
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

            <div className="space-y-2">
              <Label htmlFor="dailyTarget">Quantidade Esperada por Dia</Label>
              <Input
                id="dailyTarget"
                type="number"
                min="1"
                value={productionFormData.dailyTarget}
                onChange={(e) =>
                  setProductionFormData({
                    ...productionFormData,
                    dailyTarget: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={productionFormData.status}
                onValueChange={(value) =>
                  setProductionFormData({
                    ...productionFormData,
                    status: value as GoalStatus,
                  })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button variant="outline" onClick={() => setIsProductionModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveProductionGoal} className="bg-blue-600 hover:bg-blue-700">
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {deleteConfirmId !== null && (
          <Dialog open onOpenChange={() => setDeleteConfirmId(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirmar Exclusão</DialogTitle>
                <DialogDescription>
                  Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-3 justify-end pt-4">
                <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteProductionGoal(deleteConfirmId)}
                >
                  Excluir
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
