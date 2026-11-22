// Mostra a conversa do WhatsApp (por protocolo) ou toca a gravação de uma ligação (escolhida na lista do agente no dia),
// buscando na Escallo na hora. Nada é guardado: ao fechar a tela a conversa e o áudio somem (LGPD).
// Da ligação só o identificador vai para a auditoria (via onEscolher).
import { useEffect, useRef, useState } from "react";
import { Loader2, MessageSquare, Phone, Play, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  atendimentoInventado,
  buscarAudio,
  buscarConversa,
  horaDaMensagem,
  listarLigacoes,
  MENSAGEM_ATENDIMENTO_TESTE,
  pareceIdLigacao,
  type ConversaWhatsapp,
  type LigacaoDaLista,
} from "@/lib/atendimentoEscallo";
import { cn } from "@/lib/utils";
import type { AuditChannel } from "@/types/audit";

interface Props {
  canal: AuditChannel | "";
  /** WhatsApp: protocolo digitado. Ligação: identificador da ligação escolhida (guardado na auditoria). */
  protocolo: string;
  dia: string;
  /** Código do agente na Escallo (cadastro do colaborador); sem ele não dá para listar as ligações */
  codigoAgente?: number | null;
  /** Ligação escolhida na lista: devolve o identificador para a auditoria */
  onEscolherLigacao?: (uniqueid: string) => void;
}

const duracao = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function AtendimentoViewer({ canal, protocolo, dia, codigoAgente, onEscolherLigacao }: Props) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conversa, setConversa] = useState<ConversaWhatsapp | null>(null);
  const [ligacoes, setLigacoes] = useState<LigacaoDaLista[] | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [carregandoAudio, setCarregandoAudio] = useState<string | null>(null);
  const pedido = useRef(0);

  const ehLigacao = canal === "Ligação";
  const idEscolhido = ehLigacao && pareceIdLigacao(protocolo) ? protocolo.trim() : "";

  // trocar canal, data, colaborador (ou o protocolo do WhatsApp) descarta o que estava na tela.
  // Na ligação, o "protocolo" muda quando a pessoa escolhe uma ligação: isso não deve apagar o áudio.
  const chaveReset = `${canal}|${dia}|${codigoAgente ?? ""}|${ehLigacao ? "" : protocolo}`;
  useEffect(() => {
    pedido.current += 1;
    setConversa(null);
    setLigacoes(null);
    setErro(null);
    setCarregando(false);
    setCarregandoAudio(null);
    setAudioUrl((antigo) => {
      if (antigo) URL.revokeObjectURL(antigo);
      return null;
    });
  }, [chaveReset]);

  useEffect(() => () => setAudioUrl((a) => (a && URL.revokeObjectURL(a), null)), []);

  const semCodigo = ehLigacao && !codigoAgente;
  const podeBuscar = Boolean(canal && dia && (ehLigacao ? codigoAgente : protocolo.trim()));

  const buscar = async () => {
    if (!canal) return;
    const minha = ++pedido.current;
    setCarregando(true);
    setErro(null);
    setConversa(null);
    setLigacoes(null);
    try {
      if (ehLigacao) {
        const lista = await listarLigacoes(dia, codigoAgente as number);
        if (minha === pedido.current) setLigacoes(lista);
      } else {
        const r = await buscarConversa(protocolo.trim(), dia);
        if (minha === pedido.current) setConversa(r);
      }
    } catch (e) {
      if (minha === pedido.current) setErro(e instanceof Error ? e.message : "Não consegui buscar o atendimento.");
    } finally {
      if (minha === pedido.current) setCarregando(false);
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

  const escolher = (l: LigacaoDaLista) => {
    onEscolherLigacao?.(l.uniqueid);
    void carregarAudio(l.uniqueid);
  };

  return (
    <div className="flex min-h-0 flex-col gap-3" data-testid="atendimento-viewer">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={buscar} disabled={!podeBuscar || carregando} data-testid="buscar-atendimento">
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {ehLigacao ? "Buscar ligações do dia" : "Buscar conversa"}
        </Button>
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
          Para listar as ligações, escolha o colaborador. Se ele já estiver escolhido, falta o código da Escallo no cadastro: vincule em Atendentes → Vínculos com a Escallo.
        </p>
      )}

      {erro && (
        <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger" data-testid="erro-atendimento">
          {erro}
        </p>
      )}

      {/* Ligação já escolhida (ex.: ao editar uma auditoria): toca sem precisar listar de novo */}
      {ehLigacao && idEscolhido && !ligacoes && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4" data-testid="ligacao-registrada">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Phone className="h-4 w-4" /> Ligação desta auditoria
          </p>
          <p className="text-xs text-muted-foreground">Identificador {idEscolhido}. Para trocar de ligação, busque as ligações do dia.</p>
          {audioUrl ? (
            <audio controls src={audioUrl} className="w-full" data-testid="player-audio" />
          ) : (
            <Button type="button" size="sm" onClick={() => carregarAudio(idEscolhido)} disabled={carregandoAudio !== null} data-testid="carregar-audio">
              {carregandoAudio && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Carregar gravação
            </Button>
          )}
        </div>
      )}

      {!conversa && !ligacoes && !erro && !carregando && !idEscolhido && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {ehLigacao
            ? "Escolha o colaborador e a data e clique em buscar. Depois escolha a ligação na lista."
            : "Preencha canal, data e protocolo e clique em buscar."}
        </p>
      )}

      {conversa && (
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
      )}

      {ligacoes && (
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
              const ativa = idEscolhido === l.uniqueid;
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
                    onClick={() => escolher(l)}
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
