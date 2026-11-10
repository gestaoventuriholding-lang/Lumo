import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Plus, ShieldAlert, Trash2 } from "lucide-react";
import AuditDialog from "@/components/AuditDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEllosData } from "@/contexts/EllosDataContext";
import { auditMonths, buildAuditPanel, filterAudits, monthKey, monthLabel, monthlyAverages } from "@/lib/auditLogic";
import { getLocalDateString } from "@/lib/performanceStorage";
import { pageContainerVariants, pageItemVariants, motion } from "@/lib/motionVariants";
import { cn } from "@/lib/utils";
import type { Audit, AuditChannel } from "@/types/audit";

const formatDate = (iso: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR") : "—");
const formatScore = (n: number | undefined) => (n === undefined ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
const TODOS = "todos";

export default function Audits() {
  const { isAdmin } = useAuth();
  const { attendants, audits, auditSettings, setAudits } = useEllosData();
  const hoje = getLocalDateString();

  const meses = useMemo(() => auditMonths(audits, hoje), [audits, hoje]);
  const [mes, setMes] = useState(monthKey(hoje));
  const [aba, setAba] = useState("painel");
  const [dialogo, setDialogo] = useState<{ audit?: Audit; attendantId?: number } | null>(null);
  const [excluir, setExcluir] = useState<Audit | null>(null);

  const [fColab, setFColab] = useState(TODOS);
  const [fCanal, setFCanal] = useState(TODOS);
  const [fMes, setFMes] = useState(TODOS);
  const [fAbaixo, setFAbaixo] = useState(false);
  const [busca, setBusca] = useState("");

  const painel = useMemo(() => buildAuditPanel(audits, attendants, auditSettings, mes), [audits, attendants, auditSettings, mes]);
  const nomeDe = (id: number) => attendants.find((a) => a.id === id)?.name ?? "Colaborador removido";

  const lista = useMemo(
    () =>
      filterAudits(
        audits,
        attendants,
        {
          month: fMes === TODOS ? undefined : fMes,
          attendantId: fColab === TODOS ? undefined : Number(fColab),
          channel: fCanal === TODOS ? undefined : (fCanal as AuditChannel),
          onlyBelowMin: fAbaixo,
          search: busca,
        },
        auditSettings.minScore
      ),
    [audits, attendants, fMes, fColab, fCanal, fAbaixo, busca, auditSettings.minScore]
  );

  // matriz: nota média dos últimos 6 meses por colaborador
  const ultimosMeses = useMemo(() => {
    const todos = auditMonths(audits, hoje).slice(0, 6);
    return todos.sort();
  }, [audits, hoje]);
  const matriz = useMemo(
    () =>
      painel.rows.map((r) => {
        const porMes = new Map(monthlyAverages(audits, r.attendant.id).map((m) => [m.month, m]));
        return { row: r, porMes };
      }),
    [painel.rows, audits]
  );

  const confirmarExclusao = () => {
    if (!excluir) return;
    setAudits((prev) => prev.filter((a) => a.id !== excluir.id));
    toast.success("Auditoria excluída.");
    setExcluir(null);
  };

  const cartoes = [
    { rotulo: "Auditorias no mês", valor: String(painel.totalAudits), tom: "" },
    { rotulo: "Nota média", valor: formatScore(painel.overallAverage), tom: painel.overallAverage !== undefined && painel.overallAverage < auditSettings.minScore ? "text-danger" : "" },
    { rotulo: `Abaixo de ${auditSettings.minScore}`, valor: String(painel.belowMin.length), tom: painel.belowMin.length > 0 ? "text-danger" : "" },
    { rotulo: `Sem a meta de ${auditSettings.monthlyTarget}`, valor: String(painel.withoutAudit.length), tom: painel.withoutAudit.length > 0 ? "text-warning" : "" },
  ];

  return (
    <motion.div className="space-y-6 pb-8" variants={pageContainerVariants} initial="hidden" animate="visible">
      <motion.div
        variants={pageItemVariants}
        className="flex flex-col gap-4 rounded-lg border border-primary/20 bg-primary-soft p-6 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:flex">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Auditoria</h1>
            <p className="mt-1 text-muted-foreground">Qualidade dos atendimentos: escolha pelo protocolo, avalie o checklist e dê o feedback</p>
          </div>
        </div>
        <Button className="gap-2" onClick={() => setDialogo({})} data-testid="nova-auditoria">
          <Plus className="h-[18px] w-[18px]" />
          Nova auditoria
        </Button>
      </motion.div>

      <motion.div variants={pageItemVariants}>
        <Tabs value={aba} onValueChange={setAba}>
          <TabsList>
            <TabsTrigger value="painel">Painel</TabsTrigger>
            <TabsTrigger value="lista" data-testid="aba-lista">
              Auditorias
            </TabsTrigger>
          </TabsList>

          <TabsContent value="painel" className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="w-56" aria-label="Mês" data-testid="painel-mes">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((m) => (
                    <SelectItem key={m} value={m}>
                      {monthLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Nota mínima {auditSettings.minScore} · meta de {auditSettings.monthlyTarget} auditorias por agente por mês (em Configurações)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {cartoes.map((c) => (
                <Card key={c.rotulo}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{c.rotulo}</p>
                    <p className={cn("mt-1 font-display text-2xl font-bold tabular-nums", c.tom)}>{c.valor}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por colaborador em {monthLabel(mes)}</CardTitle>
              </CardHeader>
              <CardContent>
                {painel.rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum colaborador cadastrado.</p>
                ) : (
                  <Table data-testid="painel-colaboradores">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead className="text-right">Auditorias</TableHead>
                        <TableHead className="text-right">Nota média</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead className="w-28" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {painel.rows.map((r) => (
                        <TableRow key={r.attendant.id} className={r.belowMin ? "bg-danger/5" : undefined} data-testid={`linha-${r.attendant.id}`}>
                          <TableCell className="font-medium">{r.attendant.name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.count}/{r.target}
                          </TableCell>
                          <TableCell className={cn("text-right tabular-nums", r.belowMin && "font-semibold text-danger")}>{formatScore(r.average)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {r.belowMin && (
                                <Badge className="gap-1 border border-danger/40 bg-danger/10 text-danger" data-testid="selo-abaixo-minimo">
                                  <AlertTriangle className="h-3 w-3" /> Abaixo de {auditSettings.minScore}
                                </Badge>
                              )}
                              {r.eliminatedCount > 0 && (
                                <Badge variant="outline" className="gap-1 border-danger/40 text-danger">
                                  <ShieldAlert className="h-3 w-3" /> {r.eliminatedCount} eliminatória{r.eliminatedCount > 1 ? "s" : ""}
                                </Badge>
                              )}
                              {r.missing === 0 ? (
                                <Badge className="gap-1 border border-success/30 bg-success/10 text-success">
                                  <CheckCircle2 className="h-3 w-3" /> Meta cumprida
                                </Badge>
                              ) : (
                                <Badge variant="outline">Faltam {r.missing}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => setDialogo({ attendantId: r.attendant.id })}>
                              Auditar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nota média por mês</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table data-testid="matriz-mensal">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      {ultimosMeses.map((m) => (
                        <TableHead key={m} className="text-right">
                          {m.slice(5, 7)}/{m.slice(0, 4)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matriz.map(({ row, porMes }) => (
                      <TableRow key={row.attendant.id}>
                        <TableCell className="font-medium">{row.attendant.name}</TableCell>
                        {ultimosMeses.map((m) => {
                          const v = porMes.get(m);
                          const baixo = v?.average !== undefined && v.average < auditSettings.minScore;
                          return (
                            <TableCell key={m} className={cn("text-right tabular-nums", baixo && "text-danger")}>
                              {v ? `${formatScore(v.average)} (${v.count})` : "—"}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-2 text-xs text-muted-foreground">Entre parênteses, quantas auditorias entraram na média.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lista" className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
              <Input placeholder="Buscar por protocolo ou nome…" value={busca} onChange={(e) => setBusca(e.target.value)} className="lg:max-w-xs" aria-label="Buscar auditoria" />
              <Select value={fMes} onValueChange={setFMes}>
                <SelectTrigger className="w-full lg:w-48" aria-label="Filtrar por mês">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos os meses</SelectItem>
                  {meses.map((m) => (
                    <SelectItem key={m} value={m}>
                      {monthLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={fColab} onValueChange={setFColab}>
                <SelectTrigger className="w-full lg:w-56" aria-label="Filtrar por colaborador">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos os colaboradores</SelectItem>
                  {[...attendants]
                    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                    .map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select value={fCanal} onValueChange={setFCanal}>
                <SelectTrigger className="w-full lg:w-40" aria-label="Filtrar por canal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos os canais</SelectItem>
                  <SelectItem value="Ligação">Ligação</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
              <Button variant={fAbaixo ? "default" : "outline"} size="sm" onClick={() => setFAbaixo((v) => !v)} aria-pressed={fAbaixo}>
                Só abaixo da nota mínima
              </Button>
            </div>

            {lista.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground" data-testid="lista-vazia">
                  {audits.length === 0 ? "Nenhuma auditoria feita ainda. Clique em “Nova auditoria”." : "Nenhuma auditoria com esses filtros."}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="overflow-x-auto p-0">
                  <Table data-testid="lista-auditorias">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Canal</TableHead>
                        <TableHead>Protocolo</TableHead>
                        <TableHead className="text-right">Nota</TableHead>
                        <TableHead>Feedback</TableHead>
                        <TableHead>Auditor</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lista.map((a) => {
                        const abaixo = a.score !== undefined && a.score < auditSettings.minScore;
                        return (
                          <TableRow key={a.id} className="cursor-pointer" onClick={() => setDialogo({ audit: a })} data-testid="linha-auditoria">
                            <TableCell className="tabular-nums">{formatDate(a.attendedOn)}</TableCell>
                            <TableCell className="font-medium">{nomeDe(a.attendantId)}</TableCell>
                            <TableCell>{a.channel}</TableCell>
                            <TableCell className="tabular-nums">{a.protocol}</TableCell>
                            <TableCell className="text-right">
                              <span className={cn("tabular-nums", abaixo && "font-semibold text-danger")}>{formatScore(a.score)}</span>
                              {a.eliminated && <ShieldAlert className="ml-1 inline h-3.5 w-3.5 text-danger" aria-label="Eliminatória" />}
                            </TableCell>
                            <TableCell>
                              {a.feedbackGivenOn ? <Badge variant="secondary">Dado em {formatDate(a.feedbackGivenOn)}</Badge> : <Badge variant="outline">Pendente</Badge>}
                            </TableCell>
                            <TableCell className="max-w-[10rem] truncate text-xs text-muted-foreground">{a.auditorEmail}</TableCell>
                            <TableCell className="text-right">
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Excluir auditoria"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExcluir(a);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

      {dialogo && <AuditDialog audit={dialogo.audit} initialAttendantId={dialogo.attendantId} onClose={() => setDialogo(null)} />}

      <Dialog open={excluir !== null} onOpenChange={(o) => !o && setExcluir(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir esta auditoria?</DialogTitle>
            <DialogDescription>
              A auditoria do protocolo {excluir?.protocol} de {excluir ? nomeDe(excluir.attendantId) : ""} será apagada e a nota deixa de contar. Não dá para desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluir(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarExclusao}>
              Excluir auditoria
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
