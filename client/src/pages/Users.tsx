import { useCallback, useEffect, useState, type FormEvent } from "react";
import { KeyRound, Loader2, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion, pageContainerVariants, pageItemVariants } from "@/lib/motionVariants";
import { useAuth } from "@/_core/hooks/useAuth";
import { getSupabase } from "@/lib/supabase";

interface AccessUser {
  id: string;
  email: string;
  isAdmin: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
}

async function callUsers<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke("gerenciar-usuarios", { body });
  if (error) {
    // a função responde { error: "mensagem" } com status 4xx
    const response = (error as { context?: Response }).context;
    if (response) {
      try {
        const payload = await response.json();
        if (payload?.error) throw new Error(payload.error as string);
      } catch (inner) {
        if (inner instanceof Error && inner.message) throw inner;
      }
    }
    throw new Error("Não foi possível falar com o servidor. Verifique a internet e tente de novo.");
  }
  return data as T;
}

function formatDate(value: string | null) {
  if (!value) return "Nunca entrou";
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function UsersPage() {
  const { isAdmin, user } = useAuth();
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const [passwordTarget, setPasswordTarget] = useState<AccessUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<AccessUser | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await callUsers<{ users: AccessUser[] }>({ action: "list" });
      setUsers(result.users);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erro ao carregar os usuários.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Só administradores podem gerenciar usuários.</p>
      </div>
    );
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      await callUsers({ action: "create", email, password });
      toast.success("Acesso liberado", { description: `${email.trim()} já pode entrar no Elos.` });
      setEmail("");
      setPassword("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar o usuário.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSetPassword(event: FormEvent) {
    event.preventDefault();
    if (!passwordTarget) return;
    setSavingPassword(true);
    try {
      await callUsers({ action: "set-password", userId: passwordTarget.id, password: newPassword });
      toast.success("Senha alterada", { description: passwordTarget.email });
      setPasswordTarget(null);
      setNewPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar a senha.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    try {
      await callUsers({ action: "remove", userId: removeTarget.id });
      toast.success("Acesso removido", { description: removeTarget.email });
      setRemoveTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover o acesso.");
    }
  }

  return (
    <motion.div
      className="mx-auto w-full max-w-4xl space-y-6 p-6"
      variants={pageContainerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={pageItemVariants}>
        <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina quem pode entrar no Elos. Todos veem e editam os mesmos dados da central.
        </p>
      </motion.div>

      <motion.div variants={pageItemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4" />
              Liberar novo acesso
            </CardTitle>
            <CardDescription>
              A pessoa entra com este e-mail e esta senha. Combine a senha com ela e peça para guardá-la.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="new-user-email">E-mail</Label>
                <Input
                  id="new-user-email"
                  type="email"
                  autoComplete="off"
                  placeholder="nome@empresa.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-password">Senha (mínimo 8 caracteres)</Label>
                <Input
                  id="new-user-password"
                  type="text"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" disabled={creating} className="gap-2">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Liberar acesso
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={pageItemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quem pode entrar</CardTitle>
            <CardDescription>{users.length} pessoa(s) com acesso</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : loadError ? (
              <div className="space-y-3 py-4">
                <p className="text-sm text-destructive">{loadError}</p>
                <Button variant="outline" onClick={() => void load()}>
                  Tentar de novo
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Último acesso</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.email}</TableCell>
                      <TableCell>
                        {item.isAdmin ? (
                          <Badge className="gap-1">
                            <ShieldCheck className="h-3 w-3" /> Administrador
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Usuário</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(item.lastSignInAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => setPasswordTarget(item)}
                          >
                            <KeyRound className="h-4 w-4" /> Trocar senha
                          </Button>
                          {!item.isAdmin && item.id !== user?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-destructive hover:text-destructive"
                              onClick={() => setRemoveTarget(item)}
                            >
                              <Trash2 className="h-4 w-4" /> Remover
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={passwordTarget != null} onOpenChange={(open) => !open && setPasswordTarget(null)}>
        <DialogContent>
          <form onSubmit={handleSetPassword} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Trocar senha</DialogTitle>
              <DialogDescription>{passwordTarget?.email}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="change-password">Nova senha (mínimo 8 caracteres)</Label>
              <Input
                id="change-password"
                type="text"
                autoComplete="off"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPasswordTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingPassword}>
                {savingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar senha
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removeTarget != null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover o acesso de {removeTarget?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              A pessoa não consegue mais entrar no Elos. Os dados que ela cadastrou continuam na central. Você
              pode liberar o acesso de novo depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleRemove()}>Remover acesso</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
