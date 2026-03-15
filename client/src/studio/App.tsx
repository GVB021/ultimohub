import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { memoryHook, memorySearchHook } from "@studio/lib/memory-router";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@studio/components/ui/toaster";
import { TooltipProvider } from "@studio/components/ui/tooltip";
import { useAuth } from "@studio/hooks/use-auth";
import { useStudioAutoEntry } from "@studio/hooks/use-studios";
import { Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";
import { ErrorBoundary } from "@studio/components/ui/error-boundary";
import { resolveStudioAutoEntryTarget } from "@studio/lib/studio-auto-entry";

const NotFound = lazy(() => import("@studio/pages/not-found"));
const Landing = lazy(() => import("@studio/pages/landing"));
const Login = lazy(() => import("@studio/pages/login"));
const SecretariaLogin = lazy(() => import("@studio/pages/secretaria-login"));
const StudioSelect = lazy(() => import("@studio/pages/studio-select"));
const Dashboard = lazy(() => import("@studio/pages/dashboard"));
const Productions = lazy(() => import("@studio/pages/productions"));
const Sessions = lazy(() => import("@studio/pages/sessions"));
const RecordingRoom = lazy(() => import("@studio/pages/room").then(module => ({ default: module.default })));
const Staff = lazy(() => import("@studio/pages/staff"));
const Admin = lazy(() => import("@studio/pages/admin"));
const StudioManagementPage = lazy(() => import("@studio/pages/studio-management"));
const Members = lazy(() => import("@studio/pages/members"));
const StudioAdmin = lazy(() => import("@studio/pages/studio-admin"));
const Takes = lazy(() => import("@studio/pages/takes"));
const Profile = lazy(() => import("@studio/pages/profile"));
const TutorialAudio = lazy(() => import("@studio/pages/tutorial-audio"));

import { StudioLayout } from "@studio/components/layout/studio-layout";

function ProtectedRoute({ component: Component, requireStudio = false, ...rest }: any) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/hub-dub/login" replace />;
  }

  if (requireStudio) {
    const studioId = rest.params?.studioId as string;
    return (
      <StudioLayout studioId={studioId}>
        <ErrorBoundary>
          <Component studioId={studioId} {...rest} />
        </ErrorBoundary>
      </StudioLayout>
    );
  }

  return (
    <ErrorBoundary>
      <Component {...rest} />
    </ErrorBoundary>
  );
}

function StudioSelectRoute() {
  const { user, isLoading } = useAuth();
  const { data: autoEntry, isLoading: isAutoEntryLoading } = useStudioAutoEntry(Boolean(user));

  if (isLoading || isAutoEntryLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/hub-dub/login" replace />;
  }

  const autoTarget = resolveStudioAutoEntryTarget(autoEntry);
  if (autoTarget) {
    return <Redirect to={autoTarget} replace />;
  }

  return <StudioSelect />;
}

function LandingRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Redirect to="/hub-dub/studios" replace />;
  }

  return <Login />;
}

function Router() {
  const [location] = useLocation();

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location}
          className="min-h-screen w-full"
          initial={{ opacity: 0, filter: "blur(4px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(3px)" }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          <Switch location={location}>
            <Route path="/hub-dub" component={LandingRoute} />
            <Route path="/hub-dub/login" component={Login} />
            <Route path="/hub-dub/secretaria/login" component={SecretariaLogin} />
            <Route path="/hub-dub/studios" component={StudioSelectRoute} />

            <Route path="/hub-dub/admin/studios/:studioId/management">
              {params => <ProtectedRoute component={StudioManagementPage} params={params} />}
            </Route>

            <Route path="/hub-dub/admin">
              {() => <ProtectedRoute component={Admin} />}
            </Route>

            <Route path="/hub-dub/profile">
              {() => <ProtectedRoute component={Profile} />}
            </Route>
            <Route path="/hub-dub/daw">
              <Redirect to="/hub-dub/studios" replace />
            </Route>

            <Route path="/hub-dub/studio/:studioId/dashboard">
              {params => <ProtectedRoute component={Dashboard} requireStudio params={params} />}
            </Route>
            <Route path="/hub-dub/studio/:studioId/productions">
              {params => <ProtectedRoute component={Productions} requireStudio params={params} />}
            </Route>
            <Route path="/hub-dub/studio/:studioId/sessions">
              {params => <ProtectedRoute component={Sessions} requireStudio params={params} />}
            </Route>
            <Route path="/hub-dub/studio/:studioId/staff">
              {params => <ProtectedRoute component={Staff} requireStudio params={params} />}
            </Route>
            <Route path="/hub-dub/studio/:studioId/members">
              {params => <ProtectedRoute component={Members} requireStudio params={params} />}
            </Route>
            <Route path="/hub-dub/studio/:studioId/notifications">
              {params => <Redirect to={`/hub-dub/studio/${params.studioId}/dashboard`} replace />}
            </Route>
            <Route path="/hub-dub/studio/:studioId/takes">
              {params => <ProtectedRoute component={Takes} requireStudio params={params} />}
            </Route>
            <Route path="/hub-dub/studio/:studioId/tutorial-audio">
              {params => <ProtectedRoute component={TutorialAudio} requireStudio params={params} />}
            </Route>
            <Route path="/hub-dub/studio/:studioId/admin">
              {params => <ProtectedRoute component={StudioAdmin} requireStudio params={params} />}
            </Route>

            <Route path="/hub-dub/studio/:studioId/sessions/:sessionId/room">
              {params => <ProtectedRoute component={RecordingRoom} params={params} />}
            </Route>

            <Route path="/hub-dub/:rest*">
              <NotFound />
            </Route>
          </Switch>
        </motion.div>
      </AnimatePresence>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <WouterRouter hook={memoryHook} searchHook={memorySearchHook}>
            <Toaster />
            <Router />
          </WouterRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
