// Mostra a conversa do WhatsApp ou toca a gravação da ligação de um atendimento, buscando na Escallo na hora.
// A pessoa escolhe colaborador + dia + canal; o Ellos lista os atendimentos dele nesse dia e ela escolhe um.
// Nada é guardado: ao fechar a tela a conversa e o áudio somem (LGPD). Para a auditoria vai só o identificador (onEscolher).
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, MessageSquare, Phone, Play, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  atendimentoInventado,
  buscarAudio,
  buscarConversa,
  horaDaMensagem,
  listarConversas,
  listarLigacoes,
  MENSAGEM_ATENDIMENTO_TESTE,
  pareceIdLigacao,
  type ConversaDaLista,
  type ConversaWhatsapp,
  type LigacaoDaLista,
} from "@/lib/atendimentoEscallo";
import { cn } from "@/lib/utils";
import type { AuditChannel } from "@/types/audit";

interface Props {
  canal: AuditChannel | "";
  /** Identificador do atendimento escolhido (protocolo no WhatsApp, identificador da ligação na Ligação); é o que a auditoria guarda */
  protocolo: string;
  dia: string;
  /** Código do agente na Escallo (cadastro do colaborador); sem ele não dá para listar os atendimentos */
  codigoAgente?: number | null;
  /** Atendimento escolhido na lista: devolve o identificador para a auditoria */
  onEscolher?: (identificador: string) => void;
  /** Mostra só o atendimento do protocolo informado, sem busca do dia (Follow-up) */
  somenteEste?: boolean;
}

const duracao = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function AtendimentoViewer({ canal, protocolo, dia, codigoAgente, onEscolher, somenteEste = false }: Props) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ligacoes, setLigacoes] = useState<LigacaoDaLista[] | null>(null);
  const [conversas, setConversas] = useState<ConversaDaLista[] | null>(null);
  const [conversa, setConversa] = useState<ConversaWhatsapp | null>(null);
  const [carregandoConversa, setCarregandoConversa] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [carregandoAudio, setCarregandoAudio] = useState<string | null>(null);
  const pedido = useRef(0);

  const ehLigacao = canal === "Ligação";
  const escolhido = ehLigacao ? (pareceIdLigacao(protocolo) ? protocolo.trim() : "") : protocolo.trim();

  // trocar canal, data ou colaborador descarta o que estava na tela.
  // O identificador escolhido muda quando a pessoa escolhe um atendimento: isso não deve apagar a conversa nem o áudio.
  const chaveReset = `${canal}|${dia}|${codigoAgente ?? ""}`;
  useEffect(() => {
    pedido.current += 1;
    setLigacoes(null);
    setConversas(null);
    setConversa(null);
    setErro(null);
    setCarregando(false);
    setCarregandoConversa(null);
    setCarregandoAudio(null);
    setAudioUrl((antigo) => {
      if (antigo) URL.revokeObjectURL(antigo);
      return null;
    });
  }, [chaveReset]);

  useEffect(() => () => setAudioUrl((a) => (a && URL.revokeObjectURL(a), null)), []);

  const semCodigo = !somenteEste && Boolean(canal) && !codigoAgente;
  const podeBuscar = Boolean(canal && dia && codigoAgente);

  const buscar = async () => {
    if (!canal || !codigoAgente) return;
    const minha = ++pedido.current;
    setCarregando(true);
    setErro(null);
    setLigacoes(null);
    setConversas(null);
    setConversa(null);
    try {
      if (ehLigacao) {
        const lista = await listarLigacoes(dia, codigoAgente);
        if (minha === pedido.current) setLigacoes(lista);
      } else {
        const lista = await listarConversas(dia, codigoAgente);
        if (minha === pedido.current) setConversas(lista);
      }
    } catch (e) {
      if (minha === pedido.current) setErro(e instanceof Error ? e.message : "Não consegui buscar os atendimentos.");
    } finally {
      if (minha === pedido.current) setCarregando(false);
    }
  };

  const abrirConversa = async (id: string, avisar: boolean) => {
    if (avisar) onEscolher?.(id);
    const minha = pedido.current;
    setCarregandoConversa(id);
    setErro(null);
    try {
      const r = await buscarConversa(id, dia);
      if (minha === pedido.current) setConversa(r);
    } catch (e) {
      if (minha === pedido.current) setErro(e instanceof Error ? e.message : "Não consegui abrir a conversa.");
    } finally {
      setCarregandoConversa(null);
    }
  };

  const carregarAudio = async (uniqueid: string) => {
    const minha = pedido.current;
    setCarregandoAudio(uniqueid);
    setErro(null);
    setAudioUrl((antigo) => {
      if (antigo) URL.revokeObjectURL(antigo);
      return null;
    });
    try {
      const blob = await buscarAudio(uniqueid);
      if (minha !== pedido.current) return;
      setAudioUrl(URL.createObjectURL(blob));
    } catch (e) {
      if (minha === pedido.current) setErro(e instanceof Error ? e.message : "Não consegui carregar a gravação.");
    } finally {
      setCarregandoAudio(null);
    }
  };

  const escolherLigacao = (l: LigacaoDaLista) => {
    onEscolher?.(l.uniqueid);
    void carregarAudio(l.uniqueid);
  };

  const mostrandoLista = Boolean(ligacoes || conversas);
  const vazio = !somenteEste && !mostrandoLista && !conversa && !erro && !carregando && !escolhido;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="atendimento-viewer">
      <div className="flex flex-wrap items-center gap-2">
        {!somenteEste && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={buscar} disabled={!podeBuscar || carregando} data-testid="buscar-atendimento">
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {ehLigacao ? "Buscar ligações do dia" : "Buscar conversas do dia"}
          </Button>
        )}
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Vem da Escallo na hora e não é salvo.
        </p>
      </div>

      {atendimentoInventado() && (
        <p className="rounded-lg bg-warning/10 p-2 text-xs text-warning" data-testid="aviso-inventado">
          {MENSAGEM_ATENDIMENTO_TESTE}
        </p>
      )}

      {semCodigo && (
        <p className="rounded-lg bg-warning/10 p-2 text-xs text-warning" data-testid="sem-codigo">
          Para listar os atendimentos, escolha o colaborador. Se ele já estiver escolhido, falta o código da Escallo no cadastro: vincule em Atendentes → Vínculos com a Escallo.
        </p>
      )}

      {erro && (
        <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger" data-testid="erro-atendimento">
          {erro}
        </p>
      )}

      {vazio && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Escolha o colaborador, o canal e a data e clique em buscar. Depois escolha o atendimento na lista.
        </p>
      )}

      {/* Atendimento já escolhido (ex.: ao editar uma auditoria): abre sem precisar listar de novo */}
      {ehLigacao && escolhido && !ligacoes && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4" data-testid="ligacao-registrada">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Phone className="h-4 w-4" /> Ligação desta auditoria
          </p>
          <p className="text-xs text-muted-foreground">Identificador {escolhido}. Para trocar de ligação, busque as ligações do dia.</p>
          {audioUrl ? (
            <audio controls src={audioUrl} className="w-full" data-testid="player-audio" />
          ) : (
            <Button type="button" size="sm" onClick={() => carregarAudio(escolhido)} disabled={carregandoAudio !== null} data-testid="carregar-audio">
              {carregandoAudio && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Carregar gravação
            </Button>
          )}
        </div>
      )}

      {!ehLigacao && escolhido && !conversas && !conversa && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4" data-testid="conversa-registrada">
          <p className="flex items-center gap-2 text-sm font-medium">
            <MessageSquare className="h-4 w-4" /> {somenteEste ? "Conversa deste atendimento" : "Conversa desta auditoria"}
          </p>
          <p className="text-xs text-muted-foreground">Protocolo {escolhido}.{somenteEste ? "" : " Para trocar de conversa, busque as conversas do dia."}</p>
          <Button type="button" size="sm" onClick={() => abrirConversa(escolhido, false)} disabled={carregandoConversa !== null} data-testid="carregar-conversa">
            {carregandoConversa && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Carregar conversa
          </Button>
        </div>
      )}

      {/* WhatsApp: conversa aberta */}
      {!ehLigacao && conversa && (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {conversas && (
            <Button type="button" variant="ghost" size="sm" className="w-fit gap-1.5" onClick={() => setConversa(null)} data-testid="voltar-lista">
              <ArrowLeft className="h-4 w-4" /> Voltar às conversas do dia
            </Button>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-muted/30 p-3" data-testid="conversa">
            <p className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" /> Protocolo {conversa.protocolo}
              {conversa.agentes.length > 0 ? ` · Agente: ${conversa.agentes.join(", ")}` : ""}
            </p>
            <ul className="space-y-2">
              {conversa.mensagens.map((m) => {
                const agente = m.direcao === "Enviado";
                const auto = m.direcao === "Automático" || m.etapa === "automatico";
                return (
                  <li key={m.id} className={cn("flex", agente ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm",
                        agente ? "bg-primary-soft" : auto ? "border border-dashed bg-background text-muted-foreground" : "border bg-background"
                      )}
                    >
                      <p className="mb-0.5 text-[11px] text-muted-foreground">
                        {agente ? "Agente" : auto ? "Automático" : "Paciente"} · {horaDaMensagem(m.dataHora)}
                      </p>
                      {m.conteudo}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* WhatsApp: conversas do agente no dia */}
      {!ehLigacao && conversas && !conversa && (
        <div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="lista-conversas">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            {conversas.length === 0
              ? "Nenhuma conversa atendida por este colaborador nessa data."
              : `${conversas.length} ${conversas.length === 1 ? "conversa atendida" : "conversas atendidas"} · escolha uma para ver`}
          </p>
          <ul className="min-h-0 flex-1 divide-y overflow-y-auto rounded-lg border">
            {conversas.map((c) => {
              const ativa = escolhido === c.protocolo;
              return (
                <li key={c.protocolo} className={cn("flex items-center justify-between gap-2 px-3 py-2 text-sm", ativa && "bg-primary-soft")} data-testid="conversa-item">
                  <span className="min-w-0 truncate">
                    <span className="font-medium tabular-nums">{horaDaMensagem(c.inicio)}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {duracao(c.segundos)} · {c.mensagens} {c.mensagens === 1 ? "mensagem" : "mensagens"}
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={ativa ? "default" : "outline"}
                    className="gap-1"
                    aria-label={`Ver a conversa das ${horaDaMensagem(c.inicio)}`}
                    onClick={() => abrirConversa(c.protocolo, true)}
                    disabled={carregandoConversa !== null}
                    data-testid="abrir-conversa"
                  >
                    {carregandoConversa === c.protocolo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                    {ativa ? "Escolhida" : "Ver"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Ligação: ligações do agente no dia */}
      {ehLigacao && ligacoes && (
        <div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="lista-ligacoes">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            {ligacoes.length === 0
              ? "Nenhuma ligação atendida por este colaborador nessa data."
              : `${ligacoes.length} ${ligacoes.length === 1 ? "ligação atendida" : "ligações atendidas"} · escolha uma para ouvir`}
          </p>
          {audioUrl && <audio controls autoPlay src={audioUrl} className="w-full" data-testid="player-audio" />}
          <ul className="min-h-0 flex-1 divide-y overflow-y-auto rounded-lg border">
            {ligacoes.map((l) => {
              const ativa = escolhido === l.uniqueid;
              return (
                <li key={l.uniqueid} className={cn("flex items-center justify-between gap-2 px-3 py-2 text-sm", ativa && "bg-primary-soft")} data-testid="ligacao-item">
                  <span className="min-w-0 truncate">
                    <span className="font-medium tabular-nums">{horaDaMensagem(l.inicio)}</span>
                    <span className="text-muted-foreground"> · {l.fila || "Fila"} · {duracao(l.segundos)}</span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={ativa ? "default" : "outline"}
                    className="gap-1"
                    aria-label={`Ouvir a ligação das ${horaDaMensagem(l.inicio)}`}
                    onClick={() => escolherLigacao(l)}
                    disabled={carregandoAudio !== null}
                    data-testid="ouvir-ligacao"
                  >
                    {carregandoAudio === l.uniqueid ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    {ativa ? "Escolhida" : "Ouvir"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
