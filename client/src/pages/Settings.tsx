import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { motion } from "@/lib/motionVariants";
import { Input } from "@/components/ui/input";
import { Bell, Shield, LogOut, Target, Moon, Trash2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { useState } from "react";
import { toast } from "sonner";
import GoalsManagement from "@/components/GoalsManagement";
import { pageContainerVariants, pageItemVariants } from "@/lib/motionVariants";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { clearAllLumoOperationalData } from "@/lib/clearAllLumoData";
import { flushCloud } from "@/lib/cloudStore";

export default function Settings() {
  const { logout, isAdmin } = useAuth();
  const [confirmText, setConfirmText] = useState("");
  const { theme, setTheme } = useTheme();
  const { preferences, savePreferences } = useUserPreferences();

  /** Cada mudança é gravada na hora, sem botão de salvar */
  const updatePreference = (patch: Partial<typeof preferences>) => {
    savePreferences({ ...preferences, ...patch });
    toast.success("Preferência salva", { id: "preference-saved", duration: 1800 });
  };

  return (
    <motion.div
      className="space-y-4"
      variants={pageContainerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={pageItemVariants} className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Gerencie as preferências do sistema</p>
      </motion.div>

      {/* Appearance Section */}
      <motion.div variants={pageItemVariants}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Moon className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Aparência</CardTitle>
                <CardDescription>Personalize o visual do sistema</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg lumo-inset hover:bg-muted/30 transition-colors">
              <div>
                <p className="font-medium text-foreground">Modo escuro</p>
                <p className="text-sm text-muted-foreground">
                  Ative o tema escuro para reduzir o brilho da tela
                </p>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme?.(checked ? "dark" : "light")}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Preferences Section */}
      <motion.div variants={pageItemVariants}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Preferências</CardTitle>
                <CardDescription>Customize sua experiência</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              {/* Notifications */}
              <div className="flex items-center justify-between p-4 rounded-lg lumo-inset hover:bg-muted/30 transition-colors">
                <div>
                  <p className="font-medium text-foreground">Notificações</p>
                  <p className="text-sm text-muted-foreground">
                    Receber notificações do sistema
                  </p>
                </div>
                <Switch
                  checked={preferences.notifications}
                  onCheckedChange={(checked) => updatePreference({ notifications: checked })}
                />
              </div>

              {/* Email Reports */}
              <div className="flex items-center justify-between p-4 rounded-lg lumo-inset hover:bg-muted/30 transition-colors">
                <div>
                  <p className="font-medium text-foreground">Relatórios por Email</p>
                  <p className="text-sm text-muted-foreground">
                    Receber relatórios semanais
                  </p>
                </div>
                <Switch
                  checked={preferences.emailReports}
                  onCheckedChange={(checked) => updatePreference({ emailReports: checked })}
                />
              </div>

              {/* Language */}
              <div className="space-y-2">
                <Label htmlFor="language">Idioma</Label>
                <Select
                  value={preferences.language}
                  onValueChange={(value) => updatePreference({ language: value })}
                >
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                    <SelectItem value="en-US">English (USA)</SelectItem>
                    <SelectItem value="es-ES">Español (España)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Timezone */}
              <div className="space-y-2">
                <Label htmlFor="timezone">Fuso Horário</Label>
                <Select
                  value={preferences.timezone}
                  onValueChange={(value) => updatePreference({ timezone: value })}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Sao_Paulo">
                      São Paulo (GMT-3)
                    </SelectItem>
                    <SelectItem value="America/New_York">
                      New York (GMT-5)
                    </SelectItem>
                    <SelectItem value="Europe/London">
                      London (GMT+0)
                    </SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo (GMT+9)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          </CardContent>
        </Card>
      </motion.div>

      {/* Security Section */}
      <motion.div variants={pageItemVariants}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Segurança</CardTitle>
                <CardDescription>Gerencie a segurança da sua conta</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg lumo-inset">
              <p className="font-medium text-foreground mb-2">Autenticação</p>
              <p className="text-sm text-muted-foreground mb-3">
                Sua conta está protegida com autenticação OAuth
              </p>
              <Button variant="outline" size="sm">
                Gerenciar Autenticação
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Goals and Alerts Section */}
      <motion.div variants={pageItemVariants}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Metas e Alertas</CardTitle>
                <CardDescription>
                  Quantidades de referência por canal e critérios de alerta de desempenho
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <GoalsManagement />
          </CardContent>
        </Card>
      </motion.div>

      {/* Reset operational data: apaga os dados da central inteira, só admin */}
      {isAdmin && <motion.div variants={pageItemVariants}>
        <Card className="border-destructive/40">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-destructive" />
              <div>
                <CardTitle>Recomeçar do zero</CardTitle>
                <CardDescription>
                  Apaga colaboradores, desempenho, ausências, metas, estrutura e histórico de
                  importação de toda a central
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Use antes de cadastrar uma operação nova. Como os dados são compartilhados, isso apaga
              para TODOS os usuários. Login e usuários cadastrados são mantidos. Não pode ser desfeito.
            </p>
            <AlertDialog onOpenChange={(open) => !open && setConfirmText("")}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full md:w-auto">
                  Limpar todos os dados operacionais
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar tudo e recomeçar?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>Serão removidos permanentemente:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Colaboradores e jornadas</li>
                        <li>Registros de desempenho e histórico de importação</li>
                        <li>Ausências</li>
                        <li>Metas de produção</li>
                        <li>Layout de estruturas</li>
                        <li>Filtro de período salvo</li>
                      </ul>
                      <p className="font-medium text-foreground">Vale para todos os usuários da central.</p>
                      <Label htmlFor="confirm-clear" className="pt-1">Digite APAGAR para confirmar</Label>
                      <Input
                        id="confirm-clear"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    disabled={confirmText.trim().toUpperCase() !== "APAGAR"}
                    onClick={() => {
                      clearAllLumoOperationalData();
                      toast.success("Dados apagados. Recarregando…");
                      void flushCloud().then(() =>
                        window.setTimeout(() => window.location.reload(), 400)
                      );
                    }}
                  >
                    Sim, limpar tudo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </motion.div>}

      {/* Logout Section */}
      <motion.div variants={pageItemVariants}>
        <Card className="border-destructive/40">
          <CardHeader>
            <div className="flex items-center gap-3">
              <LogOut className="h-5 w-5 text-destructive" />
              <div>
                <CardTitle>Sair</CardTitle>
                <CardDescription>Encerre sua sessão</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={logout}
              variant="destructive"
              className="w-full md:w-auto"
            >
              Sair da Conta
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
