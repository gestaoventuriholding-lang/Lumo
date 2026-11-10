// Janela de auditar um atendimento: à esquerda a conversa/gravação (buscada na Escallo, nunca salva),
// à direita o checklist com a nota calculada ao vivo, o feedback e o registro de "feedback dado em".
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import AtendimentoViewer from "@/components/AtendimentoViewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEllosData } from "@/contexts/EllosDataContext";
import { attendantsActiveOn } from "@/lib/attendantStatus";
import {
  activeChecklist,
  CANAIS_AUDITORIA,
  clearFeedbackRegistration,
  computeScore,
  createAudit,
  funcaoDe,
  itemsOf,
  pareceDadoPessoal,
  registerFeedback,
  RESULTADOS,
  updateAudit,
  validateAuditInput,
  validateFeedbackDate,
} from "@/lib/auditLogic";
import { getLocalDateString } from "@/lib/performanceStorage";
import { cn } from "@/lib/utils";
import {
  AUDIT_FEEDBACK_MAX,
  AUDIT_GENERAL_NOTE_MAX,
  AUDIT_NOTE_MAX,
  type Audit,
  type AuditAnswer,
  type AuditChannel,
  type AuditResult,
} from "@/types/audit";

interface Props {
  /** undefined = nova auditoria */
  audit?: Audit;
  onClose: () => void;
  initialAttendantId?: number;
}

const TOM_RESULTADO: Record<AuditResult, string> = {
  atende: "border-success/40 bg-success/10 text-success",
  parcial: "border-warning/40 bg-warning/10 text-warning",
  nao_atende: "border-danger/40 bg-danger/10 text-danger",
  nao_aplica: "border-border bg-muted text-foreground",
};

export default function AuditDialog({ audit, onClose, initialAttendantId }: Props) {
  const { user } = useAuth();
  const { attendants, auditChecklists, auditItems, audits, auditSettings, setAudits } = useEllosData();
  const hoje = getLocalDateString();
  const editando = audit !== undefined;

  const [attendantId, setAttendantId] = useState<number | undefined>(audit?.attendantId ?? initialAttendantId);
  const [channel, setChannel] = useState<AuditChannel | "">(audit?.channel ?? "");
  const [attendedOn, setAttendedOn] = useState(audit?.attendedOn ?? hoje);
  const [protocol, setProtocol] = useState(audit?.protocol ?? "");
  const [respostas, setRespostas] = useState<Record<number, AuditAnswer>>(
    Object.fromEntries((audit?.answers ?? []).map((a) => [a.itemId, a]))
  );
  const [generalNote, setGeneralNote] = useState(audit?.generalNote ?? "");
  const [feedback, setFeedback] = useState(audit?.feedback ?? "");
  const [givenOn, setGivenOn] = useState(audit?.feedbackGivenOn ?? "");
  const [erro, setErro] = useState<string | null>(null);

  const colaboradores = useMemo(() => {
    const lista = attendantsActiveOn(attendants, attendedOn);
    if (audit && !lista.some((a) => a.id === audit.attendantId)) {
      const dele = attendants.find((a) => a.id === audit.attendantId);
      if (dele) lista.push(dele);
    }
    return lista.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [attendants, attendedOn, audit]);

  const colaborador = attendants.find((a) => a.id === attendantId);

  // auditoria salva fica com o checklist em que foi feita; nova usa o checklist ativo da função da pessoa
  const checklist = useMemo(() => {
    if (audit) return auditChecklists.find((c) => c.id === audit.checklistId);
    if (!colaborador) return activeChecklist(auditChecklists, "Atendente");
    return activeChecklist(auditChecklists, funcaoDe(colaborador)) ?? activeChecklist(auditChecklists, "Atendente");
  }, [audit, auditChecklists, colaborador]);

  const itens = useMemo(() => {
    if (!checklist) return [];
    const todos = itemsOf(auditItems, checklist.id);
    // nova: só critérios ativos; salva: os ativos e os que ela já respondeu
    return todos.filter((i) => i.active || (audit?.answers ?? []).some((a) => a.itemId === i.id));
  }, [auditItems, checklist, audit]);

  const listaRespostas = itens.map((i) => respostas[i.id]).filter((r): r is AuditAnswer => Boolean(r));
  const { score, eliminated } = computeScore(listaRespostas, itens);
  const faltam = itens.length - listaRespostas.length;
  const abaixo = score !== undefined && score < auditSettings.minScore;

  const definir = (itemId: number, resultado: AuditResult) =>
    setRespostas((p) => ({ ...p, [itemId]: { itemId, result: resultado, note: p[itemId]?.note ?? "" } }));
  const anotar = (itemId: number, note: string) =>
    setRespostas((p) => (p[itemId] ? { ...p, [itemId]: { ...p[itemId], note } } : p));

  const salvar = () => {
    if (!checklist) {
      setErro("Não há checklist ativo. Peça a um administrador para cadastrar os critérios em Configurações.");
      return;
    }
    const input = { attendantId, channel, attendedOn, protocol, answers: listaRespostas, generalNote, feedback };
    const problema = validateAuditInput(input, itens, audits, hoje, audit?.id);
    if (problema) {
      setErro(problema);
      return;
    }
    if (givenOn) {
      const p = validateFeedbackDate(givenOn, hoje, attendedOn);
      if (p) {
        setErro(p);
        return;
      }
    }
    let salva = audit ? updateAudit(audit, input, itens) : createAudit(input, checklist, itens, user?.email ?? "");
    if (givenOn && givenOn !== audit?.feedbackGivenOn) salva = registerFeedback(salva, givenOn);
    if (!givenOn && audit?.feedbackGivenOn) salva = clearFeedbackRegistration(salva);
    setAudits((prev) => (audit ? prev.map((a) => (a.id === salva.id ? salva : a)) : [...prev, salva]));
    toast.success(editando ? "Auditoria atualizada." : "Auditoria salva.");
    onClose();
  };

  const alertaPessoal = pareceDadoPessoal(`${generalNote} ${feedback} ${listaRespostas.map((r) => r.note).join(" ")}`);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="grid max-h-[94vh] max-w-6xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden" data-testid="auditoria-dialogo">
        <DialogHeader>
          <DialogTitle>{editando ? "Auditoria de atendimento" : "Nova auditoria de atendimento"}</DialogTitle>
          <DialogDescription>
            Escolha o atendimento pelo protocolo, avalie cada critério e registre o feedback. A conversa e a gravação não são salvas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-4 overflow-y-auto lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:overflow-hidden">
          {/* Lado esquerdo: atendimento */}
          <div className="flex min-h-0 flex-col gap-3 lg:overflow-hidden">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="aud-colab">Colaborador</Label>
                <Select value={attendantId !== undefined ? String(attendantId) : ""} onValueChange={(v) => setAttendantId(Number(v))} disabled={editando}>
                  <SelectTrigger id="aud-colab" data-testid="aud-colaborador">
                    <SelectValue placeholder="Escolha quem foi auditado" />
                  </SelectTrigger>
                  <SelectContent>
                    {colaboradores.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="aud-canal">Canal</Label>
                <Select value={channel} onValueChange={(v) => setChannel(v as AuditChannel)}>
                  <SelectTrigger id="aud-canal" data-testid="aud-canal">
                    <SelectValue placeholder="Canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {CANAIS_AUDITORIA.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="aud-data">Data do atendimento</Label>
                <Input id="aud-data" type="date" max={hoje} value={attendedOn} onChange={(e) => setAttendedOn(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="aud-protocolo">Protocolo da Escallo</Label>
                <Input id="aud-protocolo" value={protocol} maxLength={60} onChange={(e) => setProtocol(e.target.value)} placeholder="Ex.: 202611100001" />
                <p className="text-xs text-muted-foreground">Use só o protocolo. Não digite nome, CPF nem dados do paciente (LGPD).</p>
              </div>
            </div>
            <div className="min-h-0 flex-1 lg:overflow-hidden">
              <AtendimentoViewer canal={channel} protocolo={protocol} dia={attendedOn} />
            </div>
          </div>

          {/* Lado direito: checklist */}
          <div className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto lg:pr-1" data-testid="checklist-auditoria">
            {!checklist ? (
              <p className="rounded-lg border border-dashed p-4 text-sm">
                Não há checklist ativo. Peça a um administrador para cadastrar os critérios em Configurações → Critérios de auditoria.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3" data-testid="nota-ao-vivo">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {checklist.name} · versão {checklist.version}
                    </p>
                    <p className="font-display text-3xl font-bold tabular-nums">{score !== undefined ? score.toLocaleString("pt-BR") : "—"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs">
                    {eliminated && (
                      <Badge className="gap-1 border border-danger/40 bg-danger/10 text-danger" data-testid="selo-eliminatorio">
                        <ShieldAlert className="h-3.5 w-3.5" /> Critério eliminatório: nota zerada
                      </Badge>
                    )}
                    {!eliminated && abaixo && (
                      <Badge className="gap-1 border border-danger/40 bg-danger/10 text-danger" data-testid="selo-abaixo">
                        <AlertTriangle className="h-3.5 w-3.5" /> Abaixo da nota mínima ({auditSettings.minScore})
                      </Badge>
                    )}
                    {!eliminated && score !== undefined && !abaixo && (
                      <Badge className="gap-1 border border-success/30 bg-success/10 text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Na meta (mínimo {auditSettings.minScore})
                      </Badge>
                    )}
                    <span className="text-muted-foreground">{faltam > 0 ? `Faltam ${faltam} de ${itens.length} critérios` : "Todos os critérios avaliados"}</span>
                  </div>
                </div>

                <ul className="space-y-3">
                  {itens.map((item) => {
                    const r = respostas[item.id];
                    return (
                      <li key={item.id} className="rounded-lg border p-3" data-testid={`aud-item-${item.position}`}>
                        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">
                              {item.title}
                              {!item.active && <span className="ml-2 text-xs text-muted-foreground">(critério desativado depois)</span>}
                            </p>
                            {item.hint && <p className="text-xs text-muted-foreground">{item.hint}</p>}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="tabular-nums">Peso {item.weight}</span>
                            {item.eliminatory && (
                              <Badge variant="outline" className="gap-1 border-danger/40 text-danger">
                                <ShieldAlert className="h-3 w-3" /> Eliminatório
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div role="radiogroup" aria-label={item.title} className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                          {RESULTADOS.map((opcao) => (
                            <button
                              key={opcao.value}
                              type="button"
                              role="radio"
                              aria-checked={r?.result === opcao.value}
                              onClick={() => definir(item.id, opcao.value)}
                              className={cn(
                                "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors hover:bg-muted",
                                r?.result === opcao.value && TOM_RESULTADO[opcao.value]
                              )}
                            >
                              {opcao.label}
                            </button>
                          ))}
                        </div>
                        {r && (
                          <Input
                            className="mt-2 h-8 text-xs"
                            placeholder="Observação sobre este critério (opcional)"
                            aria-label={`Observação: ${item.title}`}
                            maxLength={AUDIT_NOTE_MAX}
                            value={r.note}
                            onChange={(e) => anotar(item.id, e.target.value)}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>

                <div className="space-y-1.5">
                  <Label htmlFor="aud-obs">Observação geral</Label>
                  <Textarea id="aud-obs" rows={2} value={generalNote} maxLength={AUDIT_GENERAL_NOTE_MAX} onChange={(e) => setGeneralNote(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aud-feedback">Feedback para o agente</Label>
                  <Textarea
                    id="aud-feedback"
                    rows={4}
                    className="max-h-48 overflow-y-auto"
                    value={feedback}
                    maxLength={AUDIT_FEEDBACK_MAX}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Pontos fortes, o que melhorar e combinados."
                  />
                  <p className="text-right text-xs tabular-nums text-muted-foreground">
                    {feedback.length}/{AUDIT_FEEDBACK_MAX}
                  </p>
                </div>
                <div className="space-y-1.5 rounded-lg border p-3">
                  <Label htmlFor="aud-dado">Feedback dado em</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input id="aud-dado" type="date" min={attendedOn} max={hoje} className="w-44" value={givenOn} onChange={(e) => setGivenOn(e.target.value)} />
                    <Button type="button" variant="outline" size="sm" onClick={() => setGivenOn(hoje)}>
                      Foi hoje
                    </Button>
                    {givenOn && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setGivenOn("")}>
                        Limpar
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {audit?.ackAt && audit.ackMode === "supervisora"
                      ? "Registrado pela supervisão. A confirmação pelo próprio agente (com login) vem numa próxima etapa."
                      : "Preencha quando o feedback for conversado com o agente. A confirmação pelo próprio agente (com login) vem numa próxima etapa."}
                  </p>
                </div>
                {alertaPessoal && (
                  <p className="flex items-start gap-2 rounded-lg bg-warning/10 p-2 text-xs text-warning" role="note">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Parece haver CPF ou e-mail no texto. Não registre dados do paciente: use só o protocolo.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <p role="alert" className="text-sm text-danger">
            {erro}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={salvar} data-testid="salvar-auditoria">
              {editando ? "Salvar alterações" : "Salvar auditoria"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
