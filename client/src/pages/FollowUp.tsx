// Ellos: Follow-up de orçamentos. A equipe resgata quem recebeu orçamento no WhatsApp e ainda não tem registro de que fez.
// A lista vem da classificação das conversas na Escallo; o resultado do contato é marcado aqui.
// Sem nome nem telefone do paciente (LGPD): o protocolo localiza o atendimento na Escallo.
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, MessageSquare, Search, UserRoundSearch } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import AtendimentoViewer from "@/components/AtendimentoViewer";
import PeriodFilterBar from "@/components/PeriodFilterBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { usePeriodFilter } from "@/contexts/PeriodFilterContext";
import { buscarFollowUps, salvarFollowUp } from "@/lib/followUpApi";
import {
  aplicarContato,
  diasDesde,
  filtrarFollowUps,
  motivosDePerda,
  resumirFollowUps,
  retornoVencido,
  validarContato,
  type FiltroFollowUp,
} from "@/lib/followUpLogic";
import { looksLikePersonalData } from "@/lib/incidentStorage";
import { motion, pageContainerVariants, pageItemVariants } from "@/lib/motionVariants";
import { getLocalDateString } from "@/lib/performanceStorage";
import { cn } from "@/lib/utils";
import {
  DECLINE_REASON_LABELS,
  FOLLOW_UP_AREA_LABELS,
  FOLLOW_UP_NOTE_MAX,
  FOLLOW_UP_STATUS_HINTS,
  FOLLOW_UP_STATUS_LABELS,
  type DeclineReason,
  type FollowUp,
  type FollowUpArea,
  type FollowUpStatus,
  type FollowUpUpdate,
} from "@/types/followUp";

const POR_PAGINA = 50;
const SITUACOES = Object.keys(FOLLOW_UP_STATUS_LABELS) as FollowUpStatus[];
const AREAS = Object.keys(FOLLOW_UP_AREA_LABELS) as FollowUpArea[];

const estiloSituacao: Record<FollowUpStatus, string> = {
  pending: "bg-warning/10 text-warning border-warning/30",
  waiting: "bg-primary-soft text-primary border-primary/30",
  recovered: "bg-success/10 text-success border-success/30",
  already_done: "bg-muted text-muted-foreground border-border",
  declined: "bg-danger/10 text-danger border-danger/30",
};

const dataBr = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
const numero = (n: number) => n.toLocaleString("pt-BR");

export default function FollowUpPage() {
  const { dateRange } = usePeriodFilter();
  const { user } = useAuth();
  const hoje = getLocalDateString();

  const [lista, setLista] = useState<FollowUp[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [filtro, setFiltro] = useState<FiltroFollowUp>({ status: "pending", area: "all", attendant: "all", search: "" });
  const [pagina, setPagina] = useState(0);
  const [emContato, setEmContato] = useState<FollowUp | null>(null);
  const [emConversa, setEmConversa] = useState<FollowUp | null>(null);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro(null);
    buscarFollowUps(dateRange.start, dateRange.end)
      .then((r) => vivo && setLista(r))
      .catch((e) => {
        if (!vivo) return;
        setLista([]);
        setErro(e instanceof Error ? e.message : "Não consegui ler os orçamentos.");
      })
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [dateRange.start, dateRange.end, tentativa]);

  const resumo = useMemo(() => resumirFollowUps(lista, hoje), [lista, hoje]);
  const motivos = useMemo(() => motivosDePerda(lista), [lista]);
  const atendentes = useMemo(
    () => [...new Set(lista.map((f) => f.attendantName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [lista]
  );
  const filtrados = useMemo(() => filtrarFollowUps(lista, filtro), [lista, filtro]);
  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const atual = Math.min(pagina, paginas - 1);
  const visiveis = filtrados.slice(atual * POR_PAGINA, (atual + 1) * POR_PAGINA);

  const mudarFiltro = (parte: Partial<FiltroFollowUp>) => {
    setFiltro((f) => ({ ...f, ...parte }));
    setPagina(0);
  };

  const copiar = async (protocolo: string) => {
    try {
      await navigator.clipboard.writeText(protocolo);
      toast.success("Protocolo copiado.");
    } catch {
      toast.error("Não consegui copiar. Selecione o protocolo e copie com Ctrl+C.");
    }
  };

  const salvar = useCallback(
    async (original: FollowUp, u: FollowUpUpdate) => {
      const novo = aplicarContato(original, u, user?.name ?? "", new Date());
      await salvarFollowUp(novo);
      setLista((l) => l.map((f) => (f.id === novo.id ? novo : f)));
    },
    [user?.name]
  );

  const cartoes = [
    { label: "Orçamentos no período", valor: numero(resumo.total), apoio: "Enviados no WhatsApp", tom: "text-foreground" },
    { label: "A contatar", valor: numero(resumo.pending), apoio: "Sem nenhum retorno ainda", tom: "text-warning" },
    {
      label: "Aguardando retorno",
      valor: numero(resumo.waiting),
      apoio: resumo.dueReturns > 0 ? `${numero(resumo.dueReturns)} para falar hoje ou atrasado` : "Nenhum retorno vencido",
      tom: "text-primary",
    },
    {
      label: "Recuperados",
      valor: numero(resumo.recovered),
      apoio: resumo.recoveryRate === null ? "Sem base para a taxa" : `${resumo.recoveryRate}% de quem precisava de resgate`,
      tom: "text-success",
    },
  ];

  return (
    <motion.div className="space-y-6 pb-8" variants={pageContainerVariants} initial="hidden" animate="visible">
      <motion.div variants={pageItemVariants} className="flex items-center gap-4 rounded-lg border border-primary/20 bg-primary-soft p-6">
        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:flex">
          <UserRoundSearch className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Follow-up</h1>
          <p className="mt-1 text-muted-foreground">
            Resgate de quem recebeu orçamento no WhatsApp e ainda não tem registro de que fez o exame
          </p>
        </div>
      </motion.div>

      <motion.div variants={pageItemVariants}>
        <PeriodFilterBar showScopeHint={false} />
      </motion.div>

      <motion.div variants={pageItemVariants} className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cartoes.map((c) => (
          <div key={c.label} className="ellos-panel-sm p-5" data-testid="cartao-followup">
            <p className="text-sm font-medium text-muted-foreground">{c.label}</p>
            <p className={cn("font-display mt-1 text-3xl font-bold tabular-nums", c.tom)}>{carregando ? "…" : c.valor}</p>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">{carregando ? "" : c.apoio}</p>
          </div>
        ))}
      </motion.div>

      {motivos.length > 0 && (
        <motion.div variants={pageItemVariants} className="ellos-panel-sm flex flex-wrap items-center gap-x-5 gap-y-2 p-4 text-sm">
          <span className="font-medium text-foreground">Por que não fizeram</span>
          {motivos.map((m) => (
            <span key={m.motivo} className="text-muted-foreground tabular-nums">
              {DECLINE_REASON_LABELS[m.motivo]}: <strong className="text-foreground">{numero(m.quantidade)}</strong>
            </span>
          ))}
        </motion.div>
      )}

      <motion.div variants={pageItemVariants} className="ellos-panel-sm space-y-4 p-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por situação">
          {(["all", ...SITUACOES] as const).map((s) => {
            const quantidade = s === "all" ? lista.length : lista.filter((f) => f.status === s).length;
            return (
              <Button key={s} type="button" size="sm" variant={filtro.status === s ? "default" : "outline"} aria-pressed={filtro.status === s} onClick={() => mudarFiltro({ status: s })}>
                {s === "all" ? "Todos" : FOLLOW_UP_STATUS_LABELS[s]}
                <span className="ml-1.5 tabular-nums opacity-80">{numero(quantidade)}</span>
              </Button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por protocolo" aria-label="Buscar por protocolo" value={filtro.search} onChange={(e) => mudarFiltro({ search: e.target.value })} />
          </div>
          <Select value={filtro.area} onValueChange={(v) => mudarFiltro({ area: v as FiltroFollowUp["area"] })}>
            <SelectTrigger aria-label="Filtrar por área" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as áreas</SelectItem>
              {AREAS.map((a) => (
                <SelectItem key={a} value={a}>{FOLLOW_UP_AREA_LABELS[a]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtro.attendant} onValueChange={(v) => mudarFiltro({ attendant: v })}>
            <SelectTrigger aria-label="Filtrar por quem fez o orçamento" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os atendentes</SelectItem>
              {atendentes.map((n) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {erro ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger/10 p-3 text-sm text-danger">
            <span>{erro}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</Button>
          </div>
        ) : carregando ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Lendo os orçamentos…
          </p>
        ) : filtrados.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {lista.length === 0
              ? "Nenhum orçamento nesse período. Eles chegam no fechamento do dia, com as conversas classificadas como orçamento na Escallo em que o orçamento foi enviado."
              : "Nenhum orçamento com esses filtros."}
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Quem fez o orçamento</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Acompanhamento</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.map((f) => {
                  const dias = diasDesde(f.date, hoje);
                  const vencido = retornoVencido(f, hoje);
                  return (
                    <TableRow key={f.id} data-testid="linha-followup">
                      <TableCell className="tabular-nums">
                        {dataBr(f.date)}
                        <span className="block text-xs text-muted-foreground">{dias === 0 ? "hoje" : dias === 1 ? "há 1 dia" : `há ${dias} dias`}</span>
                      </TableCell>
                      <TableCell>
                        <button type="button" onClick={() => void copiar(f.protocol)} className="flex items-center gap-1.5 font-mono text-sm text-foreground hover:text-primary" aria-label={`Copiar protocolo ${f.protocol}`}>
                          {f.protocol}
                          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </TableCell>
                      <TableCell>{FOLLOW_UP_AREA_LABELS[f.area]}</TableCell>
                      <TableCell>{f.attendantName || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={estiloSituacao[f.status]}>{FOLLOW_UP_STATUS_LABELS[f.status]}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[260px] whitespace-normal text-xs text-muted-foreground">
                        {f.status === "pending" && !f.note && f.attempts === 0 ? (
                          "—"
                        ) : (
                          <>
                            {f.nextContactOn && (
                              <span className={cn("block font-medium", vencido ? "text-danger" : "text-foreground")}>
                                Falar {vencido && f.nextContactOn < hoje ? "(atrasado) " : ""}em {dataBr(f.nextContactOn)}
                              </span>
                            )}
                            {f.declineReason && <span className="block text-foreground">{DECLINE_REASON_LABELS[f.declineReason]}</span>}
                            <span className="block tabular-nums">
                              {f.attempts} {f.attempts === 1 ? "contato" : "contatos"}
                              {f.handledBy ? ` · ${f.handledBy}` : ""}
                            </span>
                            {f.note && <span className="line-clamp-2 block">{f.note}</span>}
                          </>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => setEmConversa(f)}>
                            <MessageSquare className="h-4 w-4" /> Ver conversa
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => setEmContato(f)}>Registrar contato</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span className="tabular-nums">
                {numero(filtrados.length)} {filtrados.length === 1 ? "orçamento" : "orçamentos"}
              </span>
              {paginas > 1 && (
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={atual === 0} onClick={() => setPagina(atual - 1)}>Anterior</Button>
                  <span className="tabular-nums">Página {atual + 1} de {paginas}</span>
                  <Button type="button" variant="outline" size="sm" disabled={atual >= paginas - 1} onClick={() => setPagina(atual + 1)}>Próxima</Button>
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>

      {emContato && <DialogoContato key={emContato.id} item={emContato} hoje={hoje} onFechar={() => setEmContato(null)} onSalvar={salvar} />}

      <Dialog open={emConversa !== null} onOpenChange={(aberto) => !aberto && setEmConversa(null)}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Conversa do orçamento</DialogTitle>
            <DialogDescription>
              {emConversa ? `Protocolo ${emConversa.protocol}, de ${dataBr(emConversa.date)}.` : ""} Para falar com o paciente, procure o protocolo na Escallo.
            </DialogDescription>
          </DialogHeader>
          {emConversa && <AtendimentoViewer canal="WhatsApp" protocolo={emConversa.protocol} dia={emConversa.date} somenteEste />}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function DialogoContato({ item, hoje, onFechar, onSalvar }: { item: FollowUp; hoje: string; onFechar: () => void; onSalvar: (f: FollowUp, u: FollowUpUpdate) => Promise<void> }) {
  const [form, setForm] = useState<FollowUpUpdate>({
    status: item.status === "pending" ? "waiting" : item.status,
    declineReason: item.declineReason,
    note: item.note,
    nextContactOn: item.nextContactOn,
    countAttempt: true,
  });
  const [salvando, setSalvando] = useState(false);
  const temDadoPessoal = looksLikePersonalData(form.note);

  const enviar = async () => {
    const falta = validarContato(form, hoje);
    if (falta) {
      toast.error(falta);
      return;
    }
    setSalvando(true);
    try {
      await onSalvar(item, form);
      toast.success("Contato registrado.");
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui salvar o contato.");
      setSalvando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar contato</DialogTitle>
          <DialogDescription>
            Protocolo {item.protocol}, orçamento de {dataBr(item.date)}. Não digite nome, CPF ou telefone do paciente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="followup-situacao">Resultado</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as FollowUpStatus })}>
              <SelectTrigger id="followup-situacao" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SITUACOES.map((s) => (
                  <SelectItem key={s} value={s}>{FOLLOW_UP_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{FOLLOW_UP_STATUS_HINTS[form.status]}</p>
          </div>

          {form.status === "declined" && (
            <div className="space-y-2">
              <Label htmlFor="followup-motivo">Motivo</Label>
              <Select value={form.declineReason ?? ""} onValueChange={(v) => setForm({ ...form, declineReason: v as DeclineReason })}>
                <SelectTrigger id="followup-motivo" className="w-full">
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DECLINE_REASON_LABELS) as DeclineReason[]).map((m) => (
                    <SelectItem key={m} value={m}>{DECLINE_REASON_LABELS[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.status === "waiting" && (
            <div className="space-y-2">
              <Label htmlFor="followup-proximo">Falar de novo em (opcional)</Label>
              <Input id="followup-proximo" type="date" min={hoje} value={form.nextContactOn ?? ""} onChange={(e) => setForm({ ...form, nextContactOn: e.target.value || null })} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="followup-nota">Anotação (opcional)</Label>
            <Textarea id="followup-nota" rows={3} maxLength={FOLLOW_UP_NOTE_MAX} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            {temDadoPessoal && <p className="text-xs text-warning">O texto parece ter CPF ou e-mail. Retire os dados do paciente.</p>}
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox checked={form.countAttempt} onCheckedChange={(v) => setForm({ ...form, countAttempt: v === true })} />
            Contar como uma tentativa de contato
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button type="button" onClick={() => void enviar()} disabled={salvando}>
            {salvando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Salvar contato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
