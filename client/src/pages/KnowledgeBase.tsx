import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { pageContainerVariants, pageItemVariants, motion } from "@/lib/motionVariants";
import {
  KNOWLEDGE_CATEGORY_MAX,
  KNOWLEDGE_CONTENT_MAX,
  KNOWLEDGE_TITLE_MAX,
  filterKnowledge,
  knowledgeCategories,
  validateKnowledge,
  type KnowledgeArticle,
  type KnowledgeInput,
} from "@/lib/knowledge";
import { atualizarConhecimento, criarConhecimento, excluirConhecimento, listarConhecimentos } from "@/lib/knowledgeApi";

const TODAS = "__todas";
const formatDate = (iso: string) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const vazio = (): KnowledgeInput => ({ title: "", category: "", content: "" });

type Dialogo = { tipo: "form"; id: number | null } | { tipo: "excluir"; item: KnowledgeArticle } | null;

/** Resumo de 4 linhas com "Ver tudo" quando o texto é maior */
function Texto({ texto }: { texto: string }) {
  const [aberto, setAberto] = useState(false);
  const longo = texto.length > 320 || texto.split("\n").length > 4;
  return (
    <div className="min-w-0 space-y-1">
      <p className={`whitespace-pre-wrap break-words text-sm text-foreground ${aberto || !longo ? "" : "line-clamp-4"}`}>{texto}</p>
      {longo && (
        <button type="button" onClick={() => setAberto((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          {aberto ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" /> Ver menos
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" /> Ver tudo
            </>
          )}
        </button>
      )}
    </div>
  );
}

export default function KnowledgeBase() {
  const { isAdmin } = useAuth();
  const [itens, setItens] = useState<KnowledgeArticle[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [form, setForm] = useState<KnowledgeInput>(vazio);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    listarConhecimentos()
      .then((r) => !cancelado && setItens(r))
      .catch((e: Error) => !cancelado && setErro(e.message))
      .finally(() => !cancelado && setCarregando(false));
    return () => {
      cancelado = true;
    };
  }, []);

  const categorias = useMemo(() => knowledgeCategories(itens), [itens]);
  const lista = useMemo(() => filterKnowledge(itens, busca, categoria), [itens, busca, categoria]);

  const abrirNovo = () => {
    setForm(vazio());
    setDialogo({ tipo: "form", id: null });
  };
  const abrirEditar = (a: KnowledgeArticle) => {
    setForm({ title: a.title, category: a.category ?? "", content: a.content });
    setDialogo({ tipo: "form", id: a.id });
  };

  const salvar = async () => {
    if (dialogo?.tipo !== "form") return;
    const problema = validateKnowledge(form);
    if (problema) {
      toast.error(problema);
      return;
    }
    setSalvando(true);
    try {
      if (dialogo.id === null) {
        const novo = await criarConhecimento(form);
        setItens((prev) => [novo, ...prev]);
        toast.success("Conhecimento salvo.");
      } else {
        const atualizado = await atualizarConhecimento(dialogo.id, form);
        setItens((prev) => prev.map((x) => (x.id === atualizado.id ? atualizado : x)));
        toast.success("Mudanças salvas.");
      }
      setDialogo(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (dialogo?.tipo !== "excluir") return;
    setSalvando(true);
    try {
      await excluirConhecimento(dialogo.item.id);
      setItens((prev) => prev.filter((x) => x.id !== dialogo.item.id));
      toast.success("Conhecimento excluído.");
      setDialogo(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui excluir. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <motion.div className="space-y-6 pb-8" variants={pageContainerVariants} initial="hidden" animate="visible">
      <motion.div
        variants={pageItemVariants}
        className="flex flex-col gap-4 rounded-lg border border-primary/20 bg-primary-soft p-6 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:flex">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Base de conhecimento</h1>
            <p className="mt-1 text-muted-foreground">O que o call center precisa saber: procedimentos, orientações e respostas prontas, num só lugar</p>
          </div>
        </div>
        <Button className="gap-2" onClick={abrirNovo} data-testid="novo-conhecimento">
          <Plus className="h-[18px] w-[18px]" />
          Novo conhecimento
        </Button>
      </motion.div>

      <motion.div variants={pageItemVariants} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input placeholder="Buscar por título, categoria ou texto…" value={busca} onChange={(e) => setBusca(e.target.value)} className="sm:max-w-sm" aria-label="Buscar conhecimento" />
        <Select value={categoria || TODAS} onValueChange={(v) => setCategoria(v === TODAS ? "" : v)}>
          <SelectTrigger className="w-full sm:w-60" aria-label="Filtrar por categoria" data-testid="filtro-categoria">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas as categorias</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!carregando && !erro && (
          <span className="text-sm text-muted-foreground tabular-nums" data-testid="conhecimento-total">
            {lista.length} {lista.length === 1 ? "conhecimento" : "conhecimentos"}
          </span>
        )}
      </motion.div>

      <motion.div variants={pageItemVariants} className="space-y-3">
        {carregando && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">Carregando…</CardContent>
          </Card>
        )}
        {!carregando && erro && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-danger" data-testid="conhecimento-erro">
              {erro}
            </CardContent>
          </Card>
        )}
        {!carregando && !erro && lista.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground" data-testid="conhecimento-vazio">
              {itens.length === 0 ? "Nenhum conhecimento cadastrado ainda. Use “Novo conhecimento” para começar." : "Nenhum conhecimento encontrado para essa busca."}
            </CardContent>
          </Card>
        )}
        {lista.map((a) => (
          <Card key={a.id} data-testid="conhecimento">
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h2 className="break-words text-base font-semibold text-foreground">{a.title}</h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {a.category && <Badge variant="secondary">{a.category}</Badge>}
                    <span className="tabular-nums">Atualizado em {formatDate(a.updatedAt)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" className="gap-1" onClick={() => abrirEditar(a)}>
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Button>
                  {isAdmin && (
                    <Button size="sm" variant="ghost" className="gap-1 text-danger" onClick={() => setDialogo({ tipo: "excluir", item: a })}>
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </Button>
                  )}
                </div>
              </div>
              <Texto texto={a.content} />
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <Dialog open={dialogo?.tipo === "form"} onOpenChange={(aberto) => !aberto && !salvando && setDialogo(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialogo?.tipo === "form" && dialogo.id !== null ? "Editar conhecimento" : "Novo conhecimento"}</DialogTitle>
            <DialogDescription>Não coloque nome, telefone nem CPF de paciente. Escreva o procedimento de forma que qualquer atendente entenda.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="kb-titulo">Título</Label>
              <Input id="kb-titulo" value={form.title} maxLength={KNOWLEDGE_TITLE_MAX} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Como agendar ressonância com contraste" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kb-categoria">Categoria (opcional)</Label>
              <Input id="kb-categoria" list="kb-categorias" value={form.category} maxLength={KNOWLEDGE_CATEGORY_MAX} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex.: Imagem, Laboratório, Cardiologia" />
              <datalist id="kb-categorias">
                {categorias.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kb-conteudo">Conteúdo</Label>
              <Textarea id="kb-conteudo" rows={10} value={form.content} maxLength={KNOWLEDGE_CONTENT_MAX} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Passo a passo, orientações ao paciente, quando transferir…" />
              <p className="text-right text-xs text-muted-foreground tabular-nums">
                {form.content.length.toLocaleString("pt-BR")} / {KNOWLEDGE_CONTENT_MAX.toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando} data-testid="salvar-conhecimento">
              {salvando ? "Salvando…" : "Salvar conhecimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogo?.tipo === "excluir"} onOpenChange={(aberto) => !aberto && !salvando && setDialogo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir conhecimento?</DialogTitle>
            <DialogDescription>
              “{dialogo?.tipo === "excluir" ? dialogo.item.title : ""}” será apagado para todos e não dá para desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={excluir} disabled={salvando}>
              {salvando ? "Excluindo…" : "Excluir conhecimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
