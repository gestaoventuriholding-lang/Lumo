import { useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, ArrowLeftRight, CheckCheck, Loader2, Search } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEllosData } from "@/contexts/EllosDataContext";
import {
  buscarVinculosNaEscallo,
  prepararVinculos,
  validarVinculo,
  type LinhaVinculo,
  type RespostaEscallo,
} from "@/lib/escalloVinculos";
import { dadosDemonstracao, demoPermitida } from "@/lib/escalloDemo";
import type { Attendant } from "@/types/attendant";

/** Ontem, no horário de São Paulo (a Escallo só fecha o relatório do dia depois que ele acaba). */
function ontem(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() - 86_400_000));
}

function comoEntrada(a: Attendant, escalloCodigo: number) {
  return {
    name: a.name,
    role: a.role,
    serviceChannel: a.serviceChannel,
    workingHours: a.workingHours,
    jornadaStart: a.jornadaStart,
    jornadaEnd: a.jornadaEnd,
    observation: a.observation,
    escalloCodigo,
  };
}

export default function EscalloVinculos() {
  const { attendants: reais, updateAttendant } = useEllosData();
  // Demonstração: dados inventados e nada é salvo. Abre também com ?demo=1 no endereço.
  // Só existe na pré-visualização: no Ellos oficial o botão some e ?demo=1 é ignorado.
  const demoDisponivel = typeof window !== "undefined" && demoPermitida(window.location.hostname);
  const [demo, setDemo] = useState(() => demoDisponivel && new URLSearchParams(window.location.search).get("demo") === "1");
  const [colaboradoresDemo, setColaboradoresDemo] = useState<Attendant[]>(() => dadosDemonstracao().colaboradores);
  const attendants = demo ? colaboradoresDemo : reais;
  const [dia, setDia] = useState(ontem);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resposta, setResposta] = useState<RespostaEscallo | null>(null);
  // Escolha de colaborador em cada linha (código da Escallo -> id). Começa na sugestão, e a pessoa pode trocar.
  const [escolhas, setEscolhas] = useState<Record<number, number | null>>({});
  const [confirmarTodas, setConfirmarTodas] = useState(false);

  const ordenados = useMemo(() => [...attendants].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [attendants]);
  const listas = useMemo(() => (resposta ? prepararVinculos(resposta.sobras, attendants) : null), [resposta, attendants]);

  const escolhaDe = (l: LinhaVinculo): number | null => (l.codigo in escolhas ? escolhas[l.codigo] : l.sugestaoId);

  /** Colaboradores escolhidos em mais de uma linha: o aviso aparece na tela e a confirmação é recusada. */
  const repetidos = useMemo(() => {
    if (!listas) return new Set<number>();
    const contagem = new Map<number, number>();
    for (const l of [...listas.sugestoes, ...listas.semSugestao]) {
      const id = l.codigo in escolhas ? escolhas[l.codigo] : l.sugestaoId;
      if (id !== null && id !== undefined) contagem.set(id, (contagem.get(id) ?? 0) + 1);
    }
    return new Set([...contagem].filter(([, n]) => n > 1).map(([id]) => id));
  }, [listas, escolhas]);

  function alternarDemo(ligar: boolean) {
    setDemo(ligar && demoDisponivel);
    setColaboradoresDemo(dadosDemonstracao().colaboradores);
    setResposta(null);
    setErro(null);
    setEscolhas({});
  }

  async function buscar() {
    if (demo && demoDisponivel) {
      setErro(null);
      setEscolhas({});
      setResposta(dadosDemonstracao().resposta);
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      setResposta(await buscarVinculosNaEscallo(dia));
      setEscolhas({});
    } catch (e) {
      setResposta(null);
      setErro(e instanceof Error ? e.message : "Não consegui buscar na Escallo. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  /** Confirma UM vínculo. Só acontece quando a pessoa clica. Devolve true se gravou. */
  function confirmar(l: LinhaVinculo, aceitos: Map<number, number> = new Map()): boolean {
    const id = escolhaDe(l);
    if (repetidos.has(id ?? -1)) {
      toast.error("Este colaborador foi escolhido em mais de uma linha. Troque uma das escolhas.");
      return false;
    }
    const problema = validarVinculo(l.codigo, id, attendants, aceitos);
    if (problema) {
      toast.error(problema);
      return false;
    }
    const colaborador = attendants.find((a) => a.id === id)!;
    if (demo) {
      // Demonstração: só a cópia local muda. Nada vai para o banco.
      setColaboradoresDemo((prev) => prev.map((a) => (a.id === colaborador.id ? { ...a, escalloCodigo: l.codigo } : a)));
    } else {
      updateAttendant(colaborador.id, comoEntrada(colaborador, l.codigo));
    }
    aceitos.set(l.codigo, colaborador.id);
    return true;
  }

  function confirmarUma(l: LinhaVinculo) {
    if (confirmar(l)) toast.success(demo ? "Vínculo confirmado na demonstração (nada foi salvo)." : "Vínculo confirmado.");
  }

  function confirmarSugestoes() {
    if (!listas) return;
    const aceitos = new Map<number, number>();
    let feitos = 0;
    let recusados = 0;
    for (const l of listas.sugestoes) {
      if (escolhaDe(l) === null) continue;
      if (confirmar(l, aceitos)) feitos += 1;
      else recusados += 1;
    }
    setConfirmarTodas(false);
    if (feitos) toast.success(demo ? `${feitos} vínculo(s) confirmado(s) na demonstração (nada foi salvo).` : `${feitos} vínculo(s) confirmado(s).`);
    if (recusados) toast.warning(`${recusados} linha(s) ficaram de fora: confira os avisos na tela.`);
  }

  function linha(l: LinhaVinculo, ehSugestao: boolean) {
    const id = escolhaDe(l);
    const sugerido = ehSugestao && id === l.sugestaoId;
    const repetido = id !== null && repetidos.has(id);
    return (
      <div key={l.codigo} className="flex flex-col gap-3 border-b border-border/60 py-3 last:border-b-0 md:flex-row md:items-center">
        <div className="min-w-0 md:w-[40%]">
          <p className="truncate text-sm font-medium text-foreground">{l.nome || "(sem nome)"}</p>
          <p className="text-xs text-muted-foreground tabular-nums">Escallo · código {l.codigo}</p>
          {l.comProblema && (
            <p className="mt-1 text-xs text-warning">Neste dia o registro tem problema e não seria gravado ({l.detalhe}). O vínculo vale mesmo assim.</p>
          )}
        </div>
        <ArrowLeftRight className="hidden h-4 w-4 shrink-0 text-muted-foreground md:block" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <Select
            value={id !== null && id !== undefined ? String(id) : undefined}
            onValueChange={(v) => setEscolhas((e) => ({ ...e, [l.codigo]: Number(v) }))}
          >
            <SelectTrigger aria-label={`Colaborador para o código ${l.codigo}`} className="w-full">
              <SelectValue placeholder="Escolher colaborador" />
            </SelectTrigger>
            <SelectContent>
              {ordenados.map((a) => (
                <SelectItem key={a.id} value={String(a.id)} disabled={typeof a.escalloCodigo === "number"}>
                  {a.name}
                  {typeof a.escalloCodigo === "number" ? ` (já vinculado: ${a.escalloCodigo})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {sugerido && <p className="text-xs text-muted-foreground">Sugerido pelo nome.</p>}
          {ehSugestao && !sugerido && id !== null && <p className="text-xs text-muted-foreground">Você trocou a sugestão.</p>}
          {repetido && <p className="text-xs text-danger">Este colaborador está escolhido em outra linha também.</p>}
        </div>
        <Button size="sm" onClick={() => confirmarUma(l)} disabled={id === null || id === undefined || repetido}>
          Confirmar vínculo
        </Button>
      </div>
    );
  }

  const nSugestoes = listas?.sugestoes.length ?? 0;
  const prontas = listas ? listas.sugestoes.filter((l) => escolhaDe(l) !== null).length : 0;

  return (
    <div className="space-y-6 pb-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-2">
          <Link href="/attendants">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Atendentes
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Vincular com a Escallo</h1>
        <p className="max-w-3xl text-muted-foreground">
          Ligue cada agente da Escallo ao colaborador do Ellos. O vínculo guarda o código do agente, e é por ele que os
          relatórios da Escallo serão associados às pessoas. Nada é vinculado sozinho e nenhum colaborador é criado:
          cada vínculo só vale depois que você confirmar.
        </p>
      </div>

      {demo && (
        <div
          role="status"
          className="sticky top-0 z-30 -mx-1 flex flex-col gap-2 rounded-lg border-4 border-warning bg-foreground px-4 py-3 text-background sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="text-base font-extrabold uppercase tracking-wide">MODO DEMONSTRAÇÃO — nada é salvo</span>
          <span className="text-sm">Nomes e códigos inventados. Nenhum botão grava no banco nem na Escallo.</span>
          <Button size="sm" variant="secondary" onClick={() => alternarDemo(false)}>
            Sair da demonstração
          </Button>
        </div>
      )}


      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <label htmlFor="dia-escallo" className="block text-sm font-medium text-foreground">
              Dia do relatório
            </label>
            <Input id="dia-escallo" type="date" value={dia} max={ontem()} onChange={(e) => setDia(e.target.value)} className="w-44" />
          </div>
          <Button onClick={buscar} disabled={carregando || !dia} className="gap-2">
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {carregando ? "Buscando…" : "Buscar da Escallo"}
          </Button>
          <p className="text-xs text-muted-foreground sm:ml-2">
            Só lê a lista de agentes do dia escolhido. Não grava nada no Ellos.
          </p>
          {!demo && demoDisponivel && (
            <Button variant="link" size="sm" className="sm:ml-auto" onClick={() => alternarDemo(true)}>
              Ver demonstração
            </Button>
          )}
        </CardContent>
      </Card>

      {erro && (
        <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-foreground">
          {erro}
        </div>
      )}

      {resposta && listas && (
        <>
          {resposta.migracaoPendente && (
            <div role="alert" className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
              O banco ainda não tem o campo de código da Escallo. Aplique a migração escallo_codigo antes de confirmar vínculos.
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">{resposta.escallo.registros} agentes na Escallo</Badge>
            <Badge variant="secondary">{listas.jaVinculados} já vinculado(s)</Badge>
            <Badge variant="secondary">{nSugestoes} com sugestão</Badge>
            <Badge variant="secondary">{listas.semSugestao.length} sem sugestão</Badge>
            <Badge variant="secondary">{listas.colaboradoresSemCodigo.length} colaboradores sem código</Badge>
          </div>

          <section className="space-y-2" aria-labelledby="titulo-sugestoes">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="titulo-sugestoes" className="text-lg font-semibold text-foreground">Sugestões pelo nome</h2>
                <p className="text-sm text-muted-foreground">
                  Confira cada par. Se estiver errado, escolha outro colaborador na lista antes de confirmar.
                </p>
              </div>
              <Button
                variant="outline"
                className="gap-2"
                disabled={prontas === 0 || resposta.migracaoPendente}
                onClick={() => setConfirmarTodas(true)}
              >
                <CheckCheck className="h-4 w-4" />
                Confirmar todas ({prontas})
              </Button>
            </div>
            <Card>
              <CardContent className="pt-2">
                {nSugestoes === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">Nenhuma sugestão pendente neste dia.</p>
                ) : (
                  listas.sugestoes.map((l) => linha(l, true))
                )}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-2" aria-labelledby="titulo-sem-sugestao">
            <div>
              <h2 id="titulo-sem-sugestao" className="text-lg font-semibold text-foreground">Sem sugestão ({listas.semSugestao.length})</h2>
              <p className="text-sm text-muted-foreground">
                Vieram da Escallo e nenhum colaborador tem esse nome. Provavelmente são supervisores ou usuários de sistema.
                Eles ficam de fora e <strong>ninguém é criado</strong>. Se algum for mesmo um colaborador, escolha quem é e confirme.
              </p>
            </div>
            <Card>
              <CardContent className="pt-2">
                {listas.semSugestao.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">Nenhum.</p>
                ) : (
                  listas.semSugestao.map((l) => linha(l, false))
                )}
                {listas.semCodigo.length > 0 && (
                  <p className="border-t border-border/60 py-3 text-sm text-muted-foreground">
                    {listas.semCodigo.length} registro(s) vieram sem código da Escallo e não podem ser vinculados.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          {listas.colaboradoresSemCodigo.length > 0 && (
            <section className="space-y-2" aria-labelledby="titulo-sem-codigo">
              <h2 id="titulo-sem-codigo" className="text-lg font-semibold text-foreground">
                Colaboradores do Ellos ainda sem código ({listas.colaboradoresSemCodigo.length})
              </h2>
              <p className="text-sm text-muted-foreground">
                {listas.colaboradoresSemCodigo.map((a) => a.name).join(", ")}. Se algum não aparece na Escallo neste dia,
                tente outro dia ou preencha o código à mão no cadastro.
              </p>
            </section>
          )}
        </>
      )}

      <AlertDialog open={confirmarTodas} onOpenChange={setConfirmarTodas}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar {prontas} vínculo(s){demo ? " (demonstração)" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              Cada código da Escallo será gravado no colaborador mostrado ao lado dele, com as trocas que você fez. Linhas com problema (colaborador repetido ou já vinculado)
              ficam de fora. Você pode corrigir depois no cadastro do colaborador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar e conferir</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarSugestoes}>Confirmar todas</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
