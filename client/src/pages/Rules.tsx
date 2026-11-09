import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, CheckCircle2, ChevronDown, ChevronUp, GitBranch, History, PenLine, Plus, ScrollText, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEllosData } from "@/contexts/EllosDataContext";
import { isTerminated } from "@/lib/attendantStatus";
import { getLocalDateString } from "@/lib/performanceStorage";
import { pageContainerVariants, pageItemVariants, motion } from "@/lib/motionVariants";
import {
  APLICA_A,
  appliesToLabel,
  applyRuleUpdate,
  archiveRule,
  canUnarchive,
  createNewVersion,
  createRule,
  filterRules,
  removeSignature,
  ruleStatus,
  setSignature,
  signAllPending,
  summarizeRules,
  unarchiveRule,
  validateRuleInput,
  validateSignedOn,
  versionChain,
  type RuleFilter,
  type RuleStatus,
} from "@/lib/ruleLogic";
import { cn } from "@/lib/utils";
import {
  RULE_CATEGORY_MAX,
  RULE_DESCRIPTION_MAX,
  RULE_NOTE_MAX,
  RULE_TITLE_MAX,
  type Rule,
  type RuleAppliesTo,
  type RuleInput,
} from "@/types/rule";

const formatDate = (iso: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR") : "—");

interface RuleForm {
  title: string;
  description: string;
  category: string;
  effectiveFrom: string;
  appliesTo: RuleAppliesTo;
}

const emptyForm = (): RuleForm => ({ title: "", description: "", category: "", effectiveFrom: getLocalDateString(), appliesTo: "all" });
const formFromRule = (rule: Rule): RuleForm => ({
  title: rule.title,
  description: rule.description,
  category: rule.category ?? "",
  effectiveFrom: rule.effectiveFrom,
  appliesTo: rule.appliesTo,
});

type Dialogo =
  | { tipo: "regra"; modo: "nova" }
  | { tipo: "regra"; modo: "editar"; rule: Rule }
  | { tipo: "regra"; modo: "versao"; rule: Rule }
  | { tipo: "todos"; rule: Rule }
  | { tipo: "pessoa"; rule: Rule; attendantId: number }
  | { tipo: "versoes"; rule: Rule }
  | null;

export default function Rules() {
  const { attendants, rules, ruleSignatures, setRules, setRuleSignatures } = useEllosData();
  const { user } = useAuth();
  const today = getLocalDateString();
  const email = user?.email ?? "";

  const [filtro, setFiltro] = useState<RuleFilter>("todas");
  const [busca, setBusca] = useState("");
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);
  const [abertas, setAbertas] = useState<Set<number>>(new Set());
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [form, setForm] = useState<RuleForm>(emptyForm);
  const [dataAssinatura, setDataAssinatura] = useState(today);
  const [observacao, setObservacao] = useState("");

  const statusOf = useMemo(() => {
    const cache = new Map<number, RuleStatus>();
    return (rule: Rule) => {
      let s = cache.get(rule.id);
      if (!s) {
        s = ruleStatus(rule, attendants, ruleSignatures, today);
        cache.set(rule.id, s);
      }
      return s;
    };
  }, [attendants, ruleSignatures, today]);

  const resumo = useMemo(() => summarizeRules(rules, statusOf), [rules, statusOf]);
  const lista = useMemo(() => filterRules(rules, statusOf, filtro, mostrarArquivadas, busca), [rules, statusOf, filtro, mostrarArquivadas, busca]);
  const categorias = useMemo(() => [...new Set(rules.map((r) => r.category).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b, "pt-BR")), [rules]);
  const nomeDe = (id: number) => attendants.find((a) => a.id === id)?.name ?? "Colaborador removido";

  const alternar = (id: number) =>
    setAbertas((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const abrirNova = () => {
    setForm(emptyForm());
    setDialogo({ tipo: "regra", modo: "nova" });
  };
  const abrirEditar = (rule: Rule) => {
    setForm(formFromRule(rule));
    setDialogo({ tipo: "regra", modo: "editar", rule });
  };
  const abrirNovaVersao = (rule: Rule) => {
    setForm({ ...formFromRule(rule), effectiveFrom: today });
    setDialogo({ tipo: "regra", modo: "versao", rule });
  };
  const abrirTodos = (rule: Rule) => {
    setDataAssinatura(today);
    setObservacao("");
    setDialogo({ tipo: "todos", rule });
  };
  const abrirPessoa = (rule: Rule, attendantId: number) => {
    const existente = ruleSignatures.find((s) => s.ruleId === rule.id && s.attendantId === attendantId);
    setDataAssinatura(existente?.signedOn ?? today);
    setObservacao(existente?.note ?? "");
    setDialogo({ tipo: "pessoa", rule, attendantId });
  };

  const inputDoForm = (): RuleInput => ({
    title: form.title,
    description: form.description,
    category: form.category,
    effectiveFrom: form.effectiveFrom,
    appliesTo: form.appliesTo,
  });

  const salvarRegra = () => {
    if (!dialogo || dialogo.tipo !== "regra") return;
    const erro = validateRuleInput(inputDoForm());
    if (erro) {
      toast.error(erro);
      return;
    }
    if (dialogo.modo === "nova") {
      setRules((prev) => [...prev, createRule(inputDoForm(), email)]);
      toast.success("Regra cadastrada.");
    } else if (dialogo.modo === "editar") {
      const { rule } = dialogo;
      setRules((prev) => prev.map((r) => (r.id === rule.id ? applyRuleUpdate(r, inputDoForm()) : r)));
      toast.success("Regra atualizada.");
    } else {
      const { rule } = dialogo;
      const { archivedOld, created } = createNewVersion(rule, inputDoForm(), email);
      setRules((prev) => [...prev.map((r) => (r.id === rule.id ? archivedOld : r)), created]);
      toast.success(`Versão ${created.version} criada. A versão ${rule.version} ficou arquivada com as assinaturas dela.`);
    }
    setDialogo(null);
  };

  const confirmarTodos = () => {
    if (!dialogo || dialogo.tipo !== "todos") return;
    const erro = validateSignedOn(dataAssinatura, today, observacao);
    if (erro) {
      toast.error(erro);
      return;
    }
    const { rule } = dialogo;
    const pendentes = statusOf(rule).pending;
    if (pendentes.length === 0) {
      toast.info("Ninguém está pendente nesta regra.");
      setDialogo(null);
      return;
    }
    setRuleSignatures((prev) => signAllPending(prev, rule, pendentes, dataAssinatura, observacao));
    toast.success(`${pendentes.length} ${pendentes.length === 1 ? "pessoa marcada" : "pessoas marcadas"} como assinadas em ${formatDate(dataAssinatura)}.`);
    setDialogo(null);
  };

  const confirmarPessoa = () => {
    if (!dialogo || dialogo.tipo !== "pessoa") return;
    const erro = validateSignedOn(dataAssinatura, today, observacao);
    if (erro) {
      toast.error(erro);
      return;
    }
    const { rule, attendantId } = dialogo;
    setRuleSignatures((prev) => setSignature(prev, rule.id, attendantId, dataAssinatura, observacao));
    toast.success(`Assinatura de ${nomeDe(attendantId)} registrada em ${formatDate(dataAssinatura)}.`);
    setDialogo(null);
  };

  const removerAssinatura = (id: number, nome: string) => {
    setRuleSignatures((prev) => removeSignature(prev, id));
    toast.success(`Assinatura de ${nome} removida.`);
  };

  const arquivar = (rule: Rule) => {
    setRules((prev) => prev.map((r) => (r.id === rule.id ? archiveRule(r) : r)));
    toast.success("Regra arquivada. O histórico e as assinaturas continuam guardados.");
  };
  const reativar = (rule: Rule) => {
    setRules((prev) => prev.map((r) => (r.id === rule.id ? unarchiveRule(r) : r)));
    toast.success("Regra reativada.");
  };

  const cartoes = [
    { rotulo: "Regras em vigor", valor: resumo.ativas, tom: "text-foreground" },
    { rotulo: "Com assinaturas pendentes", valor: resumo.pendentes, tom: resumo.pendentes > 0 ? "text-warning" : "text-foreground" },
    { rotulo: "Assinadas por todos", valor: resumo.assinadasPorTodos, tom: "text-success" },
    { rotulo: "Assinaturas que faltam", valor: resumo.pessoasPendentes, tom: resumo.pessoasPendentes > 0 ? "text-warning" : "text-foreground" },
  ];

  return (
    <motion.div className="space-y-6 pb-8" variants={pageContainerVariants} initial="hidden" animate="visible">
      <motion.div
        variants={pageItemVariants}
        className="flex flex-col gap-4 rounded-lg border border-primary/20 bg-primary-soft p-6 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:flex">
            <ScrollText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Regras</h1>
            <p className="mt-1 text-muted-foreground">Regras do setor e a assinatura de cada pessoa, normalmente colhida em treinamento</p>
          </div>
        </div>
        <Button className="gap-2" onClick={abrirNova} data-testid="nova-regra">
          <Plus className="h-[18px] w-[18px]" />
          Nova regra
        </Button>
      </motion.div>

      <motion.div variants={pageItemVariants} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cartoes.map((c) => (
          <Card key={c.rotulo}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.rotulo}</p>
              <p className={cn("mt-1 font-display text-2xl font-bold tabular-nums", c.tom)}>{c.valor}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div variants={pageItemVariants} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input placeholder="Buscar por título ou categoria…" value={busca} onChange={(e) => setBusca(e.target.value)} className="sm:max-w-xs" aria-label="Buscar regra" />
        <Select value={filtro} onValueChange={(v: RuleFilter) => setFiltro(v)}>
          <SelectTrigger className="w-full sm:w-60" data-testid="filtro-regras" aria-label="Filtrar regras">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="pendentes">Pendentes de assinatura</SelectItem>
            <SelectItem value="assinadas">Assinadas por todos</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={mostrarArquivadas} onCheckedChange={setMostrarArquivadas} aria-label="Mostrar arquivadas" />
          Mostrar arquivadas
        </label>
      </motion.div>

      <motion.div variants={pageItemVariants} className="space-y-3">
        {lista.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground" data-testid="regras-vazio">
              {rules.length === 0 ? "Nenhuma regra cadastrada ainda. Use “Nova regra” para começar." : "Nenhuma regra neste filtro."}
            </CardContent>
          </Card>
        )}
        {lista.map((rule) => {
          const status = statusOf(rule);
          const aberta = abertas.has(rule.id);
          const arquivada = rule.status === "archived";
          const assinada = status.signatures.length > 0;
          return (
            <Card key={rule.id} data-testid="regra" data-rule-id={rule.id} className={cn(arquivada && "opacity-80")}>
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-foreground">{rule.title}</h2>
                      {rule.category && <Badge variant="outline">{rule.category}</Badge>}
                      {rule.version > 1 && <Badge variant="secondary" data-testid="selo-versao">v{rule.version}</Badge>}
                      {arquivada && <Badge variant="secondary" data-testid="selo-arquivada">Arquivada</Badge>}
                      {!arquivada && (
                        <Badge
                          data-testid="status-regra"
                          className={cn(
                            "border",
                            status.allSigned ? "border-success/30 bg-success/10 text-success" : status.required.length === 0 ? "border-border bg-muted text-muted-foreground" : "border-warning/30 bg-warning/10 text-warning"
                          )}
                        >
                          {status.allSigned && <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                          {status.label}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Vigência desde {formatDate(rule.effectiveFrom)} · Aplica-se a: {appliesToLabel(rule.appliesTo)}
                      {rule.createdByEmail ? ` · Cadastrada por ${rule.createdByEmail}` : ""} em {formatDate(rule.createdAt.slice(0, 10))}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!arquivada && (
                      <Button size="sm" className="gap-1.5" onClick={() => abrirTodos(rule)} disabled={status.pending.length === 0} data-testid="marcar-todos">
                        <Users className="h-4 w-4" />
                        Marcar todos como assinados
                      </Button>
                    )}
                    {!arquivada && !assinada && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => abrirEditar(rule)}>
                        <PenLine className="h-4 w-4" />
                        Editar
                      </Button>
                    )}
                    {!arquivada && assinada && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => abrirNovaVersao(rule)} title="O texto de uma regra assinada não muda: crie uma nova versão" data-testid="nova-versao">
                        <GitBranch className="h-4 w-4" />
                        Criar nova versão
                      </Button>
                    )}
                    {rule.version > 1 || rules.some((r) => r.previousId === rule.id) ? (
                      <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setDialogo({ tipo: "versoes", rule })}>
                        <History className="h-4 w-4" />
                        Versões
                      </Button>
                    ) : null}
                    {!arquivada ? (
                      <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => arquivar(rule)}>
                        <Archive className="h-4 w-4" />
                        Arquivar
                      </Button>
                    ) : (
                      canUnarchive(rule, rules) && (
                        <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => reativar(rule)}>
                          <ArchiveRestore className="h-4 w-4" />
                          Reativar
                        </Button>
                      )
                    )}
                  </div>
                </div>

                <TextoDaRegra texto={rule.description} />

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-muted-foreground tabular-nums">
                    {arquivada ? `${status.signatures.length} assinaturas registradas` : `${status.signedCount} de ${status.required.length} assinaram`}
                  </span>
                  <Button variant="link" size="sm" className="h-auto gap-1 p-0" onClick={() => alternar(rule.id)} aria-expanded={aberta} data-testid="ver-assinaturas">
                    {aberta ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {aberta ? "Ocultar assinaturas" : "Ver assinaturas"}
                  </Button>
                </div>

                {!arquivada && status.pending.length > 0 && (
                  <p className="text-sm text-muted-foreground" data-testid="faltam-nomes">
                    <span className="font-medium text-foreground">Faltam: </span>
                    {status.pending.map((a) => a.name).join(", ")}
                  </p>
                )}

                {aberta && <AssinaturasDaRegra rule={rule} status={status} nomeDe={nomeDe} attendants={attendants} onAssinar={abrirPessoa} onRemover={removerAssinatura} somenteLeitura={arquivada} />}
              </CardContent>
            </Card>
          );
        })}
      </motion.div>

      {/* Nova regra, edição e nova versão */}
      <Dialog open={dialogo?.tipo === "regra"} onOpenChange={(aberto) => !aberto && setDialogo(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {dialogo?.tipo === "regra" && dialogo.modo === "nova" && "Nova regra"}
              {dialogo?.tipo === "regra" && dialogo.modo === "editar" && "Editar regra"}
              {dialogo?.tipo === "regra" && dialogo.modo === "versao" && `Nova versão da regra (v${dialogo.rule.version + 1})`}
            </DialogTitle>
            <DialogDescription>
              {dialogo?.tipo === "regra" && dialogo.modo === "versao"
                ? "A versão atual fica arquivada, com as assinaturas dela. A nova versão começa sem assinaturas."
                : "Depois da primeira assinatura o texto não muda mais: será preciso criar uma nova versão."}
            </DialogDescription>
          </DialogHeader>
          <div className="-mx-1 space-y-4 overflow-y-auto px-1" data-testid="regra-formulario">
            <div className="space-y-2">
              <Label htmlFor="regra-titulo">Título *</Label>
              <Input id="regra-titulo" value={form.title} maxLength={RULE_TITLE_MAX} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="regra-descricao">Descrição *</Label>
              <Textarea id="regra-descricao" rows={6} className="max-h-60 overflow-y-auto" value={form.description} maxLength={RULE_DESCRIPTION_MAX} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <ContadorDescricao tamanho={form.description.length} max={RULE_DESCRIPTION_MAX} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="regra-categoria">Categoria (opcional)</Label>
                <Input id="regra-categoria" list="regra-categorias" value={form.category} maxLength={RULE_CATEGORY_MAX} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                <datalist id="regra-categorias">
                  {categorias.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="regra-vigencia">Início da vigência *</Label>
                <Input id="regra-vigencia" type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="regra-aplica">Aplica-se a</Label>
              <Select value={form.appliesTo} onValueChange={(v: RuleAppliesTo) => setForm({ ...form, appliesTo: v })}>
                <SelectTrigger id="regra-aplica">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APLICA_A.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Quem cadastra fica registrado pelo seu login{email ? ` (${email})` : ""}.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarRegra} data-testid="salvar-regra">
              {dialogo?.tipo === "regra" && dialogo.modo === "versao" ? "Criar nova versão" : "Salvar regra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Marcar todos */}
      <Dialog open={dialogo?.tipo === "todos"} onOpenChange={(aberto) => !aberto && setDialogo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar todos como assinados</DialogTitle>
            <DialogDescription>
              {dialogo?.tipo === "todos" ? `Marca como assinada, na data do treinamento, cada pessoa pendente da regra “${dialogo.rule.title}”. Quem já assinou não muda. Depois dá para ajustar alguém individualmente.` : ""}
            </DialogDescription>
          </DialogHeader>
          {dialogo?.tipo === "todos" && (
            <div className="space-y-4">
              <p className="rounded-lg border border-border bg-muted p-3 text-sm" data-testid="todos-resumo">
                {statusOf(dialogo.rule).pending.length} {statusOf(dialogo.rule).pending.length === 1 ? "pessoa será marcada" : "pessoas serão marcadas"}:{" "}
                {statusOf(dialogo.rule).pending.map((a) => a.name).join(", ")}
              </p>
              <div className="space-y-2">
                <Label htmlFor="todos-data">Data do treinamento *</Label>
                <Input id="todos-data" type="date" max={today} value={dataAssinatura} onChange={(e) => setDataAssinatura(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="todos-obs">Observação (opcional)</Label>
                <Input id="todos-obs" value={observacao} maxLength={RULE_NOTE_MAX} placeholder="Ex.: treinamento de segunda-feira" onChange={(e) => setObservacao(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmarTodos} data-testid="confirmar-todos">
              Marcar como assinados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assinatura de uma pessoa */}
      <Dialog open={dialogo?.tipo === "pessoa"} onOpenChange={(aberto) => !aberto && setDialogo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogo?.tipo === "pessoa" ? `Assinatura de ${nomeDe(dialogo.attendantId)}` : ""}</DialogTitle>
            <DialogDescription>Marque ou ajuste o dia em que a pessoa assinou, por exemplo quem faltou ao treinamento e assinou depois.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pessoa-data">Data da assinatura *</Label>
              <Input id="pessoa-data" type="date" max={today} value={dataAssinatura} onChange={(e) => setDataAssinatura(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pessoa-obs">Observação (opcional)</Label>
              <Input id="pessoa-obs" value={observacao} maxLength={RULE_NOTE_MAX} placeholder="Ex.: faltou ao treinamento, assinou depois" onChange={(e) => setObservacao(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmarPessoa} data-testid="confirmar-pessoa">
              Salvar assinatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Versões */}
      <Dialog open={dialogo?.tipo === "versoes"} onOpenChange={(aberto) => !aberto && setDialogo(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Versões da regra</DialogTitle>
            <DialogDescription>Cada versão guarda o texto e as assinaturas dela.</DialogDescription>
          </DialogHeader>
          {dialogo?.tipo === "versoes" && (
            <ul className="max-h-[60vh] space-y-3 overflow-y-auto" data-testid="lista-versoes">
              {versionChain(rules, dialogo.rule).map((v) => (
                <li key={v.id} className="space-y-1 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">v{v.version}</Badge>
                    <span className="font-medium text-foreground">{v.title}</span>
                    {v.status === "active" ? <Badge className="border border-success/30 bg-success/10 text-success">Em vigor</Badge> : <Badge variant="outline">Arquivada</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Vigência desde {formatDate(v.effectiveFrom)} · {ruleSignatures.filter((s) => s.ruleId === v.id).length} assinaturas registradas
                  </p>
                  <p className="whitespace-pre-line text-sm text-foreground">{v.description}</p>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function AssinaturasDaRegra({
  rule,
  status,
  attendants,
  nomeDe,
  onAssinar,
  onRemover,
  somenteLeitura,
}: {
  rule: Rule;
  status: RuleStatus;
  attendants: ReturnType<typeof useEllosData>["attendants"];
  nomeDe: (id: number) => string;
  onAssinar: (rule: Rule, attendantId: number) => void;
  onRemover: (signatureId: number, nome: string) => void;
  somenteLeitura: boolean;
}) {
  // quem precisa assinar + quem já assinou mesmo sem precisar mais (ex.: desligado depois)
  const ids = new Set<number>([...status.required.map((a) => a.id), ...status.signatures.map((s) => s.attendantId)]);
  const pessoas = attendants.filter((a) => ids.has(a.id)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const assinaturaDe = new Map(status.signatures.map((s) => [s.attendantId, s]));
  const exigidos = new Set(status.required.map((a) => a.id));
  const orfas = status.signatures.filter((s) => !attendants.some((a) => a.id === s.attendantId));

  return (
    <div className="overflow-x-auto rounded-lg border border-border" data-testid="tabela-assinaturas">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Pessoa</th>
            <th className="px-3 py-2 font-medium">Situação</th>
            {!somenteLeitura && <th className="px-3 py-2 text-right font-medium">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {pessoas.map((a) => {
            const s = assinaturaDe.get(a.id);
            return (
              <tr key={a.id} className="border-t border-border" data-testid="linha-assinatura">
                <td className="px-3 py-2 text-foreground">
                  {a.name}
                  {isTerminated(a) && <span className="ml-2 text-xs text-muted-foreground">Desligado{!exigidos.has(a.id) ? "" : " (ainda no último dia)"}</span>}
                </td>
                <td className="px-3 py-2">
                  {s ? (
                    <span className="text-foreground">
                      Assinou em <span className="tabular-nums">{formatDate(s.signedOn)}</span>
                      {s.note && <span className="text-muted-foreground"> · {s.note}</span>}
                    </span>
                  ) : (
                    <span className="font-medium text-warning">Pendente</span>
                  )}
                </td>
                {!somenteLeitura && (
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => onAssinar(rule, a.id)}>
                        {s ? "Ajustar" : "Marcar assinatura"}
                      </Button>
                      {s && (
                        <Button size="sm" variant="ghost" onClick={() => onRemover(s.id, a.name)}>
                          Remover
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
          {orfas.map((s) => (
            <tr key={s.id} className="border-t border-border">
              <td className="px-3 py-2 text-muted-foreground">{nomeDe(s.attendantId)}</td>
              <td className="px-3 py-2 text-muted-foreground">Assinou em {formatDate(s.signedOn)}</td>
              {!somenteLeitura && <td />}
            </tr>
          ))}
          {pessoas.length === 0 && orfas.length === 0 && (
            <tr>
              <td className="px-3 py-4 text-center text-muted-foreground" colSpan={3}>
                Nenhuma pessoa se aplica a esta regra.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Descrição da regra no cartão: resumida em 3 linhas, com "Ver mais" quando passa disso */
const LINHAS_RESUMO = 3;
const CARACTERES_POR_LINHA = 110;
const QUEBRA_DE_LINHA = new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10));
export function descricaoLonga(texto: string): boolean {
  const linhas = texto.split(QUEBRA_DE_LINHA).reduce((n, l) => n + Math.max(1, Math.ceil(l.length / CARACTERES_POR_LINHA)), 0);
  return linhas > LINHAS_RESUMO;
}

function TextoDaRegra({ texto }: { texto: string }) {
  const [aberto, setAberto] = useState(false);
  const longo = descricaoLonga(texto);
  return (
    <div className="min-w-0 space-y-1">
      <p className={cn("whitespace-pre-line break-words text-sm text-foreground", longo && !aberto && "line-clamp-3")} data-testid="texto-regra">
        {texto}
      </p>
      {longo && (
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setAberto(!aberto)} aria-expanded={aberto} data-testid="ver-mais">
          {aberto ? "Ver menos" : "Ver mais"}
        </Button>
      )}
    </div>
  );
}

/** Contador de caracteres: avisa a partir de 90% do limite do banco */
export function ContadorDescricao({ tamanho, max }: { tamanho: number; max: number }) {
  const perto = tamanho >= max * 0.9;
  const cheio = tamanho >= max;
  return (
    <p className={cn("text-xs tabular-nums", perto ? "text-warning" : "text-muted-foreground")} data-testid="contador-descricao" role={perto ? "status" : undefined}>
      {tamanho.toLocaleString("pt-BR")} de {max.toLocaleString("pt-BR")} caracteres
      {cheio ? ". Limite atingido: resuma o texto para poder salvar tudo." : perto ? ". Você está chegando ao limite." : ""}
    </p>
  );
}
