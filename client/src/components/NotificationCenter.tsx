import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "@/lib/motionVariants";
import { Bell, Check, AlertCircle, X, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { PerformanceAlert, AlertLevel } from "@/types/goals";
import { alertIconClass, alertSurfaceClass } from "@/lib/alertColors";
import {
  loadDismissedAlertIds,
  loadReadAlertIds,
  persistDismissedAlertIds,
  persistReadAlertIds,
} from "@/lib/alertStateStorage";
import { getLocalDateString } from "@/lib/performanceStorage";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";

interface NotificationCenterProps {
  alerts: PerformanceAlert[];
}

const getAlertIcon = (level: AlertLevel) => (
  <AlertCircle className={`h-5 w-5 ${alertIconClass(level)}`} />
);

export default function NotificationCenter({ alerts }: NotificationCenterProps) {
  const { preferences } = useUserPreferences();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<number>>(() => loadReadAlertIds());
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(() => loadDismissedAlertIds());

  const today = getLocalDateString();

  useEffect(() => {
    setReadIds(loadReadAlertIds());
    setDismissedIds(loadDismissedAlertIds());
  }, [today]);

  const visibleAlerts = useMemo(
    () => alerts.filter((alert) => !dismissedIds.has(alert.id)),
    [alerts, dismissedIds]
  );

  const unreadCount = visibleAlerts.filter((alert) => !readIds.has(alert.id)).length;
  const criticalCount = visibleAlerts.filter(
    (alert) => alert.alertLevel === "red" && !readIds.has(alert.id)
  ).length;

  const handleMarkAsRead = (id: number) => {
    setReadIds((prev) => {
      const next = new Set([...prev, id]);
      persistReadAlertIds(next);
      return next;
    });
  };

  const handleMarkAllAsRead = () => {
    setReadIds((prev) => {
      const next = new Set([...prev, ...visibleAlerts.map((a) => a.id)]);
      persistReadAlertIds(next);
      return next;
    });
  };

  const handleDismiss = (id: number) => {
    setDismissedIds((prev) => {
      const next = new Set([...prev, id]);
      persistDismissedAlertIds(next);
      return next;
    });
  };

  if (!preferences.notifications) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative p-2 hover:bg-muted rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Notificações${unreadCount > 0 ? `, ${unreadCount} não lidas` : ""}`}
        >
          {criticalCount > 0 ? (
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          ) : (
            <Bell className="h-5 w-5 text-primary" />
          )}
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold h-5 w-5 rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="font-semibold text-foreground text-sm">Alertas</h3>
            <p className="text-xs text-muted-foreground">
              Metas de produção e limites de pausa e ocupação
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={handleMarkAllAsRead}>
              Marcar todas
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto p-3 space-y-2">
          <AnimatePresence mode="popLayout">
            {visibleAlerts.length > 0 ? (
              visibleAlerts.map((alert) => {
                const isUnread = !readIds.has(alert.id);
                return (
                  <motion.div
                    key={alert.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    className={`p-3 rounded-lg border transition-all ${alertSurfaceClass(alert.alertLevel)} ${isUnread ? "" : "opacity-70"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getAlertIcon(alert.alertLevel)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {alert.attendantName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {alert.footer ?? `${alert.percentage.toFixed(1)}% da meta · ${alert.role}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDismiss(alert.id)}
                        className="p-1 hover:bg-foreground/10 rounded transition-colors shrink-0"
                        aria-label="Descartar alerta"
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                    {isUnread && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(alert.id)}
                        className="mt-2 text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"
                      >
                        <Check className="h-3 w-3" />
                        Marcar como lido
                      </button>
                    )}
                  </motion.div>
                );
              })
            ) : (
              <div className="py-8 px-4 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">
                  Nenhum alerta
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Todos estão dentro das metas e dos limites.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-xs"
            onClick={() => {
              setOpen(false);
              setLocation("/performance");
            }}
          >
            <BarChart3 className="h-4 w-4" />
            Ver desempenho
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
