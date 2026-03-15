import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { memoryHook, memorySearchHook } from "@/lib/memory-router";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { initThemeMode } from "@/lib/theme-mode";
import { RealtimeInvalidation } from "@/components/realtime/RealtimeInvalidation";

const lazyWithRetry = <T extends ComponentType<any>>(importer: () => Promise<{ default: T }>) =>
  lazy(async () => {
    try {
      const mod = await importer();
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("vhub_lazy_import_retry");
      }
      return mod;
    } catch (error) {
      if (typeof window !== "undefined") {
        const hasRetried = sessionStorage.getItem("vhub_lazy_import_retry") === "1";
        if (!hasRetried) {
          sessionStorage.setItem("vhub_lazy_import_retry", "1");
          window.location.reload();
          await new Promise(() => undefined);
        }
      }
      throw error;
    }
  });

const NotFound = lazyWithRetry(() => import("@/pages/not-found"));
const Landing = lazyWithRetry(() => import("@/components/presentation/PresentationLanding"));
const HubAlign = lazyWithRetry(() => import("@/pages/hub-align"));
// Studio Pages (imported from the HUBDUB-STUDIO folder)
const Login = lazyWithRetry(() => import("@studio/pages/login"));
const StudioSelect = lazyWithRetry(() => import("@studio/pages/studio-select"));
const Dashboard = lazyWithRetry(() => import("@studio/pages/dashboard"));
const Productions = lazyWithRetry(() => import("@studio/pages/productions"));
const Sessions = lazyWithRetry(() => import("@studio/pages/sessions"));
const RecordingRoom = lazyWithRetry(() => import("@studio/pages/room"));
const Staff = lazyWithRetry(() => import("@studio/pages/staff"));
const Admin = lazyWithRetry(() => import("@studio/pages/admin"));
const Notifications = lazyWithRetry(() => import("@studio/pages/notifications"));
const Members = lazyWithRetry(() => import("@studio/pages/members"));
const StudioAdmin = lazyWithRetry(() => import("@studio/pages/studio-admin"));
const Takes = lazyWithRetry(() => import("@studio/pages/takes"));
const Profile = lazyWithRetry(() => import("@studio/pages/profile"));
const Daw = lazyWithRetry(() => import("@studio/pages/daw"));
const SecretariaLogin = lazyWithRetry(() => import("@studio/pages/secretaria-login"));

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

function Router() {
  const [location] = useLocation();

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <AnimatePresence mode="wait">
        <Switch location={location} key={location}>
          <Route path="/">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
              className="w-full min-h-screen bg-background"
            >
              <Landing />
            </motion.div>
          </Route>

          <Route path="/hub-align">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full min-h-screen bg-background"
            >
              <HubAlign />
            </motion.div>
          </Route>

          {/* HUBDUB-STUDIO Fusion Routes */}
          <Route path="/hub-dub">
            <Redirect to="/hub-dub/login" />
          </Route>



          <Route path="/hub-dub/login">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full fixed inset-0 bg-background overflow-y-auto z-50">
              <Login />
            </motion.div>
          </Route>

          <Route path="/hub-dub/secretaria/login">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full fixed inset-0 bg-background overflow-y-auto z-50">
              <SecretariaLogin />
            </motion.div>
          </Route>

          <Route path="/hub-dub/studios">
            {() => <ProtectedRoute component={StudioSelect} />}
          </Route>

          <Route path="/hub-dub/admin">
            {() => <ProtectedRoute component={Admin} />}
          </Route>

          <Route path="/hub-dub/profile">
            {() => <ProtectedRoute component={Profile} />}
          </Route>

          <Route path="/hub-dub/daw">
            {() => <ProtectedRoute component={Daw} />}
          </Route>

          <Route path="/hub-dub/studio/:studioId/dashboard">
            {params => (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                <ProtectedRoute component={Dashboard} requireStudio params={params} />
              </motion.div>
            )}
          </Route>

          <Route path="/hub-dub/studio/:studioId/productions">
            {params => (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                <ProtectedRoute component={Productions} requireStudio params={params} />
              </motion.div>
            )}
          </Route>

          <Route path="/hub-dub/studio/:studioId/sessions">
            {params => (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                <ProtectedRoute component={Sessions} requireStudio params={params} />
              </motion.div>
            )}
          </Route>

          <Route path="/hub-dub/studio/:studioId/staff">
            {params => <ProtectedRoute component={Staff} requireStudio params={params} />}
          </Route>

          <Route path="/hub-dub/studio/:studioId/members">
            {params => <ProtectedRoute component={Members} requireStudio params={params} />}
          </Route>

          <Route path="/hub-dub/studio/:studioId/notifications">
            {params => <ProtectedRoute component={Notifications} requireStudio params={params} />}
          </Route>

          <Route path="/hub-dub/studio/:studioId/takes">
            {params => <ProtectedRoute component={Takes} requireStudio params={params} />}
          </Route>

          <Route path="/hub-dub/studio/:studioId/admin">
            {params => <ProtectedRoute component={StudioAdmin} requireStudio params={params} />}
          </Route>

          <Route path="/hub-dub/studio/:studioId/sessions/:sessionId/room">
            {params => (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full fixed inset-0 bg-background overflow-y-auto z-50">
                <ProtectedRoute component={RecordingRoom} params={params} />
              </motion.div>
            )}
          </Route>

          <Route path="/hub-dub/studio/:studioId/notifications">
            {params => (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                <ProtectedRoute component={Notifications} requireStudio params={params} />
              </motion.div>
            )}
          </Route>

          <Route path="/hub-dub/studio/:studioId/takes">
            {params => (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                <ProtectedRoute component={Takes} requireStudio params={params} />
              </motion.div>
            )}
          </Route>

          <Route path="/hub-dub/studio/:studioId/admin">
            {params => (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                <ProtectedRoute component={StudioAdmin} requireStudio params={params} />
              </motion.div>
            )}
          </Route>

          <Route path="/hub-dub/studio/:studioId/staff">
            {params => (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                <ProtectedRoute component={Staff} requireStudio params={params} />
              </motion.div>
            )}
          </Route>

          <Route path="/hub-dub/studio/:studioId/members">
            {params => (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                <ProtectedRoute component={Members} requireStudio params={params} />
              </motion.div>
            )}
          </Route>


        </Switch>
      </AnimatePresence>
    </Suspense>
  );
}

export default function App() {
  useEffect(() => {
    initThemeMode();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <WouterRouter hook={memoryHook} searchHook={memorySearchHook}>
            <Toaster />
            <RealtimeInvalidation />
            <Router />
          </WouterRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
