import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { useTheme } from "@/contexts/ThemeContext";
import { LayoutDashboard, Users, BarChart3, Calendar, CalendarDays, LayoutGrid, Settings as SettingsIcon, Moon, Sun, Upload, LogOut } from "lucide-react";
import {
  CSSProperties,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import NotificationCenter from "./NotificationCenter";
import { ElosLogo } from "./ElosLogo";
import { useLumoData } from "@/contexts/LumoDataContext";
import { buildPerformanceAlerts } from "@/lib/performanceMetrics";
import type { PerformanceAlert } from "@/types/goals";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, smoothEase } from "@/lib/motionVariants";

const mainMenuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Users, label: "Atendentes", path: "/attendants" },
  { icon: BarChart3, label: "Desempenho", path: "/performance" },
  { icon: Calendar, label: "Ausências", path: "/absences" },
  { icon: LayoutGrid, label: "Estruturas", path: "/structure" },
  { icon: CalendarDays, label: "Calendário", path: "/calendar" },
  { icon: Upload, label: "Importar Relatório", path: "/import" },
];

const settingsMenuItem = {
  icon: SettingsIcon,
  label: "Configurações",
  path: "/settings",
};

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const SIDEBAR_WIDTH_VERSION = "hover-v1";
const SIDEBAR_WIDTH_VERSION_KEY = "sidebar-width-version";
const DEFAULT_WIDTH = 212;
const MIN_WIDTH = 168;
const MAX_WIDTH = 360;
const SIDEBAR_COLLAPSE_DELAY_MS = 80;

type MenuItem = (typeof mainMenuItems)[number] | typeof settingsMenuItem;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const version = localStorage.getItem(SIDEBAR_WIDTH_VERSION_KEY);
    if (version !== SIDEBAR_WIDTH_VERSION) {
      localStorage.setItem(SIDEBAR_WIDTH_VERSION_KEY, SIDEBAR_WIDTH_VERSION);
      localStorage.removeItem(SIDEBAR_WIDTH_KEY);
    }
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  return (
    <SidebarProvider
      defaultOpen={false}
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
          "--sidebar-width-icon": "3.5rem",
          "--sidebar-mobile-width": "17.5rem",
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { todayIndicators } = useLumoData();
  const performanceAlerts = useMemo(
    () => buildPerformanceAlerts(todayIndicators),
    [todayIndicators]
  );
  const [location, setLocation] = useLocation();
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const activeMenuItem =
    mainMenuItems.find((item) => item.path === location) ??
    (location === settingsMenuItem.path ? settingsMenuItem : undefined);
  const isStructurePage = location === "/structure";

  const handleNavigate = useCallback(
    (path: string) => {
      setLocation(path);
      if (isMobile) {
        setOpenMobile(false);
      }
    },
    [isMobile, setLocation, setOpenMobile]
  );

  return (
    <>
      {isMobile && !openMobile && (
        <button
          type="button"
          className="fixed inset-y-0 left-0 z-30 w-3 md:hidden"
          onClick={() => setOpenMobile(true)}
          aria-label="Abrir menu"
        />
      )}

      <AppSidebarPanel location={location} onNavigate={handleNavigate} setSidebarWidth={setSidebarWidth} />

      <LayoutMain
        pageTitle={activeMenuItem?.label ?? "Elos"}
        performanceAlerts={performanceAlerts}
        isStructurePage={isStructurePage}
      >
        {children}
      </LayoutMain>
    </>
  );
}

type AppSidebarPanelProps = {
  location: string;
  onNavigate: (path: string) => void;
  setSidebarWidth: (width: number) => void;
};

const AppSidebarPanel = memo(function AppSidebarPanel({
  location,
  onNavigate,
  setSidebarWidth,
}: AppSidebarPanelProps) {
  const { user, isAdmin, logout } = useAuth();
  const { state, isMobile, setOpen } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const isIconOnly = !isMobile && state === "collapsed";
  const showSidebarLabels = isMobile || !isIconOnly;
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const collapseTimerRef = useRef<number>();
  const isHoveringRef = useRef(false);

  useEffect(() => {
    if (isMobile) {
      setIsResizing(false);
      return;
    }
    setOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (isIconOnly) {
      setIsResizing(false);
    }
  }, [isIconOnly]);

  useEffect(() => {
    return () => {
      window.clearTimeout(collapseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const handleSidebarEnter = useCallback(() => {
    if (isMobile) return;
    isHoveringRef.current = true;
    window.clearTimeout(collapseTimerRef.current);
    setOpen(true);
  }, [isMobile, setOpen]);

  const handleSidebarLeave = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (isMobile || isResizing) return;

      const sidebarRoot = sidebarRef.current?.querySelector('[data-slot="sidebar"]');
      const nextTarget = event.relatedTarget;
      if (
        nextTarget instanceof Node &&
        sidebarRoot instanceof Node &&
        sidebarRoot.contains(nextTarget)
      ) {
        return;
      }

      isHoveringRef.current = false;
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = window.setTimeout(() => {
        if (!isHoveringRef.current) {
          setOpen(false);
        }
      }, SIDEBAR_COLLAPSE_DELAY_MS);
    },
    [isMobile, isResizing, setOpen]
  );

  // Rótulos ficam montados e entram/saem com fade, em vez de aparecer de repente
  const labelClass = cn(
    "transition-[opacity,transform] duration-200 ease-out",
    isIconOnly ? "pointer-events-none -translate-x-2 opacity-0" : "translate-x-0 opacity-100 delay-100"
  );

  const renderMenuButton = (item: MenuItem) => {
    const isActive = location === item.path;
    return (
      <SidebarMenuItem key={item.path}>
        <SidebarMenuButton
          isActive={isActive}
          onClick={() => onNavigate(item.path)}
          tooltip={isIconOnly ? item.label : undefined}
          className={cn(
            "relative h-9 gap-3 rounded-lg px-3 text-sm group-data-[collapsible=icon]:size-auto! group-data-[collapsible=icon]:h-9! group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:px-3!",
            isActive
              ? "font-semibold text-white hover:bg-transparent hover:text-white active:bg-transparent active:text-white data-[active=true]:bg-transparent data-[active=true]:text-white"
              : "font-medium text-slate-300 hover:bg-white/10 hover:text-white active:bg-white/10 active:text-white data-[active=true]:bg-white/10 data-[active=true]:text-white"
          )}
        >
          {isActive && (
            <motion.span
              layoutId="sidebar-active-pill"
              className="absolute inset-0 rounded-lg bg-blue-600 shadow-md shadow-blue-600/25"
              transition={{ duration: 0.3, ease: smoothEase }}
            />
          )}
          <item.icon
            className={cn(
              "relative h-4 w-4",
              isActive ? "text-white" : "text-slate-400 group-hover/menu-button:text-white"
            )}
          />
          <span className={cn("relative whitespace-nowrap", labelClass)}>{item.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <div
      className={cn(
        "relative min-h-svh shrink-0 self-stretch",
        isMobile && "contents"
      )}
      ref={sidebarRef}
    >
      <Sidebar
        collapsible="icon"
        onMouseEnter={handleSidebarEnter}
        onMouseLeave={handleSidebarLeave}
        className={cn(
          "lumo-sidebar-shell overflow-x-hidden border-r shadow-surface",
          !isIconOnly && "lumo-sidebar-expanded"
        )}
        disableTransition={isResizing}
      >
        <SidebarHeader
          className="lumo-sidebar-shell h-14 justify-center border-b p-2"
        >
          <div className="flex w-full items-center justify-start overflow-hidden px-0.5">
            <ElosLogo variant="full" collapsed={isIconOnly} />
          </div>
        </SidebarHeader>

        <SidebarContent className="lumo-sidebar-shell gap-0">
          <SidebarMenu className="px-2 py-3">
            {mainMenuItems.map((item) => renderMenuButton(item))}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter
          className="lumo-sidebar-shell mt-auto space-y-2 border-t p-2"
        >
          <SidebarMenu>
            {renderMenuButton(settingsMenuItem)}
          </SidebarMenu>
          <button
            onClick={(event) => toggleTheme?.(event.currentTarget)}
            className="flex h-9 w-full items-center gap-3 overflow-hidden rounded-lg px-3 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white active:bg-white/10"
            title={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
          >
            <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  className="flex"
                  initial={{ rotate: -90, scale: 0.6, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  exit={{ rotate: 90, scale: 0.6, opacity: 0 }}
                  transition={{ duration: 0.2, ease: smoothEase }}
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className={cn("whitespace-nowrap", labelClass)}>
              {theme === "dark" ? "Modo claro" : "Modo escuro"}
            </span>
          </button>
          <div className="flex w-full items-center gap-2 overflow-hidden rounded-lg px-0.5 py-1">
            <Avatar className="h-9 w-9 shrink-0 border border-slate-700 bg-slate-800">
              <AvatarFallback className="bg-blue-600 text-sm font-bold text-white">
                {(user?.name ?? "Gestor").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className={cn("min-w-0 flex-1", labelClass)}>
              <p className="truncate text-sm font-medium leading-none text-white">
                {user?.name || "Gestor"}
              </p>
              <p className="mt-1 truncate text-xs text-slate-400">
                {isAdmin ? "Administrador" : "Usuário"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              title="Sair"
              aria-label="Sair"
              tabIndex={isIconOnly ? -1 : 0}
              className={cn(
                "shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white",
                labelClass
              )}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>
      {!isMobile && !isIconOnly && (
        <div
          className="absolute top-0 hidden h-full w-1 cursor-col-resize transition-colors hover:bg-blue-500/40 md:block"
          onMouseDown={() => setIsResizing(true)}
          onMouseEnter={handleSidebarEnter}
          style={{ left: "calc(var(--sidebar-width) - 4px)", zIndex: 60 }}
        />
      )}
    </div>
  );
});

type LayoutMainProps = {
  children: ReactNode;
  pageTitle: string;
  performanceAlerts: PerformanceAlert[];
  isStructurePage: boolean;
};

const LayoutMain = memo(function LayoutMain({
  children,
  pageTitle,
  performanceAlerts,
  isStructurePage,
}: LayoutMainProps) {
  return (
    <SidebarInset
      className={cn(
        "min-w-0 flex-1 bg-transparent",
        isStructurePage && "h-svh max-h-svh overflow-hidden"
      )}
    >
      <div className="z-40 flex h-12 shrink-0 items-center justify-between border-b border-border bg-card/85 px-3 backdrop-blur-md shadow-surface md:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-base font-medium tracking-tight text-foreground">
            {pageTitle}
          </span>
        </div>
        <NotificationCenter alerts={performanceAlerts} />
      </div>
      <main
        className={cn(
          "lumo-page-canvas flex-1",
          isStructurePage
            ? "flex min-h-0 flex-col overflow-hidden p-2 md:p-3"
            : "p-3 sm:p-4 md:p-6"
        )}
      >
        {children}
      </main>
    </SidebarInset>
  );
});
