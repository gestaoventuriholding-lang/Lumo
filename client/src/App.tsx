import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { MotionConfig } from "framer-motion";
import { AnimatePresence, motion, pageTransitionProps } from "@/lib/motionVariants";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { applyPreset, ACTIVE_PRESET } from "./lib/themePreset";
import { EllosDataProvider } from "./contexts/EllosDataContext";
import { UserPreferencesProvider } from "./contexts/UserPreferencesContext";
import { PeriodFilterProvider } from "./contexts/PeriodFilterContext";
import { SyncStatusProvider } from "./contexts/SyncStatusContext";
import ImportPage from "@/pages/Import";
import DashboardLayout from "./components/DashboardLayout";
import AuthGate from "./components/AuthGate";
import { AuthProvider } from "./contexts/AuthContext";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Attendants = lazy(() => import("./pages/Attendants"));
const Rules = lazy(() => import("./pages/Rules"));
const Performance = lazy(() => import("./pages/Performance"));
const Absences = lazy(() => import("./pages/Absences"));
const Incidents = lazy(() => import("./pages/Incidents"));
const EscalloVinculos = lazy(() => import("./pages/EscalloVinculos"));
const AmostraVisual = lazy(() => import("./pages/AmostraVisual"));
const Settings = lazy(() => import("./pages/Settings"));
const Structure = lazy(() => import("./pages/Structure"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const UsersPage = lazy(() => import("./pages/Users"));

function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function AppRoutes() {
  const [location] = useLocation();

  // A página que sai e a que entra ficam sobrepostas (popLayout); só a área de conteúdo anima.
  // O Switch recebe a localização da própria chave para a página que sai não trocar de tela no meio do fade.
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={location}
          className="flex min-h-0 flex-1 flex-col"
          {...pageTransitionProps}
        >
          <Suspense fallback={<PageLoader />}>
            <Switch location={location}>
              <Route path="/" component={Dashboard} />
              <Route path="/attendants" component={Attendants} />
              <Route path="/performance" component={Performance} />
              <Route path="/absences" component={Absences} />
              <Route path="/incidents" component={Incidents} />
              <Route path="/rules" component={Rules} />
              <Route path="/escallo-vinculos" component={EscalloVinculos} />
              <Route path="/amostra-visual" component={AmostraVisual} />
              <Route path="/structure" component={Structure} />
              <Route path="/calendar" component={CalendarPage} />
              <Route path="/import" component={ImportPage} />
              <Route path="/users" component={UsersPage} />
              <Route path="/settings" component={Settings} />
              <Route path="/404" component={NotFound} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Router() {
  return (
    <DashboardLayout>
      <AppRoutes />
    </DashboardLayout>
  );
}

function App() {
  applyPreset(ACTIVE_PRESET);
  useEffect(() => {
    const prefetchRoutes = () => {
      void import("./pages/Dashboard");
      void import("./pages/Attendants");
      void import("./pages/Performance");
      void import("./pages/Absences");
      void import("./pages/Incidents");
      void import("./pages/Settings");
      void import("./pages/Structure");
      void import("./pages/CalendarPage");
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = requestIdleCallback(prefetchRoutes);
      return () => cancelIdleCallback(id);
    }

    const timer = window.setTimeout(prefetchRoutes, 400);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster />
          <AuthProvider>
            <AuthGate>
              <EllosDataProvider>
                <PeriodFilterProvider>
                  <UserPreferencesProvider>
                    <SyncStatusProvider>
                      <Router />
                    </SyncStatusProvider>
                  </UserPreferencesProvider>
                </PeriodFilterProvider>
              </EllosDataProvider>
            </AuthGate>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}

export default App;
