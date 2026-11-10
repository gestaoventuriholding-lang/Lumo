// Mostra a conversa do WhatsApp ou toca a gravação da ligação de um atendimento, buscando na Escallo na hora.
// Nada é guardado: ao fechar a tela a conversa e o áudio somem (LGPD).
import { useEffect, useRef, useState } from "react";
import { Loader2, MessageSquare, Phone, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  atendimentoInventado,
  buscarAtendimento,
  buscarAudio,
  horaDaMensagem,
  MENSAGEM_ATENDIMENTO_TESTE,
  type AtendimentoBuscado,
} from "@/lib/atendimentoEscallo";
import { cn } from "@/lib/utils";
import type { AuditChannel } from "@/types/audit";

interface Props {
  canal: AuditChannel | "";
  protocolo: string;
  dia: string;
}

export default function AtendimentoViewer({ canal, protocolo, dia }: Props) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<AtendimentoBuscado | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [carregandoAudio, setCarregandoAudio] = useState(false);
  const pedido = useRef(0);

  // trocar protocolo, canal ou data descarta o que estava na tela
  useEffect(() => {
    pedido.current += 1;
    setResultado(null);
    setErro(null);
    setAudioUrl((antigo) => {
      if (antigo) URL.revokeObjectURL(antigo);
      return null;
    });
  }, [canal, protocolo, dia]);

  useEffect(() => () => setAudioUrl((a) => (a && URL.revokeObjectURL(a), null)), []);

  const podeBuscar = Boolean(canal && protocolo.trim() && dia);

  const buscar = async () => {
    if (!canal) return;
    const minha = ++pedido.current;
    setCarregando(true);
    setErro(null);
    setResultado(null);
    try {
      const r = await buscarAtendimento(canal, protocolo.trim(), dia);
      if (minha !== pedido.current) return;
      setResultado(r);
    } catch (e) {
      if (minha === pedido.current) setErro(e instanceof Error ? e.message : "Não consegui buscar o atendimento.");
    } finally {
      if (minha === pedido.current) setCarregando(false);
    }
  };

  const carregarAudio = async () => {
    if (resultado?.tipo !== "ligacao") return;
    const minha = pedido.current;
    setCarregandoAudio(true);
    setErro(null);
    try {
      const blob = await buscarAudio(resultado.uniqueid);
      if (minha !== pedido.current) return;
      setAudioUrl(URL.createObjectURL(blob));
    } catch (e) {
      if (minha === pedido.current) setErro(e instanceof Error ? e.message : "Não consegui carregar a gravação.");
    } finally {
      setCarregandoAudio(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-3" data-testid="atendimento-viewer">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={buscar} disabled={!podeBuscar || carregando} data-testid="buscar-atendimento">
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {canal === "Ligação" ? "Buscar gravação" : "Buscar conversa"}
        </Button>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Não é salvo no Ellos: vem da Escallo na hora e some ao fechar.
        </p>
      </div>

      {atendimentoInventado() && (
        <p className="rounded-lg bg-warning/10 p-2 text-xs text-warning" data-testid="aviso-inventado">
          {MENSAGEM_ATENDIMENTO_TESTE}
        </p>
      )}

      {erro && (
        <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger" data-testid="erro-atendimento">
          {erro}
        </p>
      )}

      {!resultado && !erro && !carregando && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Informe o canal, a data e o protocolo e clique em buscar para ver a conversa ou ouvir a gravação.
        </p>
      )}

      {resultado?.tipo === "conversa" && (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-muted/30 p-3" data-testid="conversa">
          <p className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" /> Protocolo {resultado.protocolo}
            {resultado.agentes.length > 0 ? ` · Agente: ${resultado.agentes.join(", ")}` : ""}
          </p>
          <ul className="space-y-2">
            {resultado.mensagens.map((m) => {
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

      {resultado?.tipo === "ligacao" && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4" data-testid="ligacao">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Phone className="h-4 w-4" /> Ligação encontrada · protocolo {resultado.protocolo}
          </p>
          <p className="text-xs text-muted-foreground">
            {resultado.agente ? `Agente: ${resultado.agente} · ` : ""}Conversa de {resultado.segundosConversa} segundos
          </p>
          {audioUrl ? (
            <audio controls src={audioUrl} className="w-full" data-testid="player-audio" />
          ) : (
            <Button type="button" size="sm" onClick={carregarAudio} disabled={carregandoAudio} data-testid="carregar-audio">
              {carregandoAudio && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Carregar gravação
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
