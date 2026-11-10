// Configurações → Auditoria de atendimento: checklist (criar, editar, desativar, pesos, eliminatório, versões),
// nota mínima e meta de auditorias por agente por mês. Só o administrador altera; a equipe vê.
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, GitBranch, Lock, Pencil, Plus, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEllosData } from "@/contexts/EllosDataContext";
import {
  activeChecklist,
  createChecklistVersion,
  createDefaultChecklist,
  isChecklistUsed,
  itemsOf,
  totalWeight,
  validateItem,
  validateSettings,
} from "@/lib/auditLogic";
import { newId } from "@/lib/ids";
import { AUDIT_ITEM_HINT_MAX, AUDIT_ITEM_TITLE_MAX, type AuditItem } from "@/types/audit";

interface ItemForm {
  title: string;
  hint: string;
  weight: string;
  eliminatory: boolean;
}
const emptyItem = (): ItemForm => ({ title: "", hint: "", weight: "10", eliminatory: false });

export default function AuditChecklistCard() {
  const { isAdmin } = useAuth();
  const { auditChecklists, auditItems, audits, auditSettings, setAuditChecklists, setAuditItems, setAuditSettings } = useEllosData();

  const checklist = activeChecklist(auditChecklists, "Atendente");
  const itens = useMemo(() => (checklist ? itemsOf(auditItems, checklist.id) : []), [auditItems, checklist]);
  const usado = checklist ? isChecklistUsed(audits, checklist.id) : false;
  const totalAuditorias = checklist ? audits.filter((a) => a.checklistId === checklist.id).length : 0;
  const versoes = useMemo(
    () => auditChecklists.filter((c) => c.funcao === "Atendente").sort((a, b) => b.version - a.version),
    [auditChecklists]
  );

  const [minScore, setMinScore] = useState(String(auditSettings.minScore));
  const [target, setTarget] = useState(String(auditSettings.monthlyTarget));
  useEffect(() => {
    setMinScore(String(auditSettings.minScore));
    setTarget(String(auditSettings.monthlyTarget));
  }, [auditSettings.minScore, auditSettings.monthlyTarget]);

  const [editing, setEditing] = useState<AuditItem | "novo" | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyItem());
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmVersion, setConfirmVersion] = useState(false);

  const salvarMetas = () => {
    const parsed = { minScore: Number(minScore.replace(",", ".")), monthlyTarget: Number(target) };
    const erro = validateSettings(parsed);
    if (erro) {
      toast.error(erro);
      return;
    }
    setAuditSettings({ id: 1, ...parsed });
    toast.success("Metas da auditoria salvas.");
  };

  const usarSugeridos = () => {
    const { checklist: c, items } = createDefaultChecklist("Atendente");
    setAuditChecklists((prev) => [...prev, c]);
    setAuditItems((prev) => [...prev, ...items]);
    toast.success("Critérios sugeridos cadastrados. Ajuste pesos e critérios como precisar.");
  };

  const criarNovaVersao = () => {
    if (!checklist) return;
    const { archivedOld, created, items } = createChecklistVersion(checklist, auditItems);
    // grava na ordem: o checklist novo antes dos critérios dele
    setAuditChecklists((prev) => [...prev.map((c) => (c.id === archivedOld.id ? archivedOld : c)), created]);
    setAuditItems((prev) => [...prev, ...items]);
    setConfirmVersion(false);
    toast.success(`Versão ${created.version} criada. As auditorias antigas continuam na versão ${checklist.version}.`);
  };

  const abrir = (item: AuditItem | "novo") => {
    setEditing(item);
    setFormError(null);
    setForm(item === "novo" ? emptyItem() : { title: item.title, hint: item.hint, weight: String(item.weight), eliminatory: item.eliminatory });
  };

  const salvarItem = () => {
    if (!checklist || !editing) return;
    const weight = Number(form.weight.replace(",", "."));
    const erro = validateItem({ title: form.title, hint: form.hint, weight });
    if (erro) {
      setFormError(erro);
      return;
    }
    if (editing === "novo") {
      const proxima = itens.reduce((n, i) => Math.max(n, i.position), 0) + 1;
      setAuditItems((prev) => [
        ...prev,
        { id: newId(), checklistId: checklist.id, position: proxima, title: form.title.trim(), hint: form.hint.trim(), weight, eliminatory: form.eliminatory, active: true },
      ]);
      toast.success("Critério adicionado.");
    } else {
      setAuditItems((prev) =>
        prev.map((i) => (i.id === editing.id ? { ...i, title: form.title.trim(), hint: form.hint.trim(), weight, eliminatory: form.eliminatory } : i))
      );
      toast.success("Critério salvo.");
    }
    setEditing(null);
  };

  const alternarAtivo = (item: AuditItem) => setAuditItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, active: !i.active } : i)));

  const mover = (item: AuditItem, delta: -1 | 1) => {
    const idx = itens.findIndex((i) => i.id === item.id);
    const outro = itens[idx + delta];
    if (!outro) return;
    setAuditItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, position: outro.position } : i.id === outro.id ? { ...i, position: item.position } : i))
    );
  };

  const soma = totalWeight(itens);

  return (
    <div className="space-y-6" data-testid="config-auditoria">
      {/* Metas */}
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="audit-min">Nota mínima (0 a 100)</Label>
          <Input id="audit-min" inputMode="decimal" value={minScore} disabled={!isAdmin} onChange={(e) => setMinScore(e.target.value)} />
          <p className="text-xs text-muted-foreground">Quem ficar abaixo aparece em destaque no painel.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-meta">Meta de auditorias por agente por mês</Label>
          <Input id="audit-meta" inputMode="numeric" value={target} disabled={!isAdmin} onChange={(e) => setTarget(e.target.value)} />
          <p className="text-xs text-muted-foreground">Padrão: 4.</p>
        </div>
        {isAdmin && <Button onClick={salvarMetas}>Salvar metas</Button>}
      </div>

      {/* Checklist */}
      {!checklist ? (
        <div className="rounded-lg border border-dashed p-4 text-sm">
          <p className="font-medium">Ainda não há critérios de auditoria.</p>
          <p className="mt-1 text-muted-foreground">Use os critérios sugeridos e ajuste pesos e itens depois.</p>
          {isAdmin ? (
            <Button className="mt-3" onClick={usarSugeridos}>
              Usar critérios sugeridos
            </Button>
          ) : (
            <p className="mt-2 text-muted-foreground">Peça a um administrador para cadastrar o checklist.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{checklist.name}</p>
              <Badge variant="outline">Versão {checklist.version}</Badge>
              <span className="text-xs text-muted-foreground tabular-nums">Soma dos pesos: {soma}</span>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                {usado && (
                  <Button variant="outline" size="sm" onClick={() => setConfirmVersion(true)}>
                    <GitBranch className="mr-1 h-4 w-4" /> Criar nova versão
                  </Button>
                )}
                <Button size="sm" onClick={() => abrir("novo")} disabled={usado}>
                  <Plus className="mr-1 h-4 w-4" /> Adicionar critério
                </Button>
              </div>
            )}
          </div>

          {usado && (
            <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm" data-testid="checklist-travado">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Este checklist já foi usado em {totalAuditorias} {totalAuditorias === 1 ? "auditoria" : "auditorias"}. Para mudar nome, peso ou eliminatório,
                crie uma nova versão: as auditorias antigas continuam com a versão em que foram feitas. Desativar um critério continua permitido.
              </span>
            </p>
          )}

          <ul className="divide-y rounded-lg border" data-testid="lista-criterios">
            {itens.map((item, idx) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 p-3" data-testid={`criterio-${item.position}`}>
                <div className="min-w-0 flex-1">
                  <p className={item.active ? "font-medium" : "font-medium text-muted-foreground line-through"}>{item.title}</p>
                  {item.hint && <p className="text-xs text-muted-foreground">{item.hint}</p>}
                </div>
                {item.eliminatory && (
                  <Badge variant="outline" className="gap-1 border-danger/40 text-danger">
                    <ShieldAlert className="h-3 w-3" /> Eliminatório
                  </Badge>
                )}
                <span className="w-16 text-right text-sm tabular-nums">Peso {item.weight}</span>
                {isAdmin ? (
                  <div className="flex items-center gap-1">
                    <Switch checked={item.active} onCheckedChange={() => alternarAtivo(item)} aria-label={`Critério ${item.title} ativo`} />
                    <Button variant="ghost" size="icon" aria-label="Subir" disabled={idx === 0} onClick={() => mover(item, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Descer" disabled={idx === itens.length - 1} onClick={() => mover(item, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Editar ${item.title}`} disabled={usado} onClick={() => abrir(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  !item.active && <Badge variant="outline">Desativado</Badge>
                )}
              </li>
            ))}
          </ul>

          {versoes.length > 1 && (
            <div className="text-sm">
              <p className="mb-1 font-medium">Versões</p>
              <ul className="space-y-1 text-muted-foreground">
                {versoes.map((v) => (
                  <li key={v.id}>
                    Versão {v.version} {v.status === "active" ? "(em uso)" : "(arquivada)"}: {audits.filter((a) => a.checklistId === v.id).length} auditorias
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === "novo" ? "Novo critério" : "Editar critério"}</DialogTitle>
            <DialogDescription>O peso mostra o quanto o critério vale na nota. Eliminatório em "Não atende" zera a nota.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="criterio-titulo">Critério</Label>
              <Input id="criterio-titulo" value={form.title} maxLength={AUDIT_ITEM_TITLE_MAX} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="criterio-orientacao">Orientação para quem audita (opcional)</Label>
              <Textarea id="criterio-orientacao" rows={3} value={form.hint} maxLength={AUDIT_ITEM_HINT_MAX} onChange={(e) => setForm({ ...form, hint: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="criterio-peso">Peso</Label>
                <Input id="criterio-peso" inputMode="decimal" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Switch id="criterio-elim" checked={form.eliminatory} onCheckedChange={(v) => setForm({ ...form, eliminatory: v })} />
                <Label htmlFor="criterio-elim">Eliminatório</Label>
              </div>
            </div>
            {formError && (
              <p role="alert" className="text-sm text-danger">
                {formError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarItem}>Salvar critério</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmVersion} onOpenChange={setConfirmVersion}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar nova versão do checklist?</DialogTitle>
            <DialogDescription>
              Os critérios atuais são copiados para a versão {checklist ? checklist.version + 1 : ""}, que passa a valer para as próximas auditorias. A versão atual fica
              arquivada com as auditorias que já foram feitas nela.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmVersion(false)}>
              Cancelar
            </Button>
            <Button onClick={criarNovaVersao}>Criar nova versão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
