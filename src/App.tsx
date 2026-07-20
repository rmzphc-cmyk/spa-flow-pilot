import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import Rapports from "./pages/Rapports";
import RapportDetail from "./pages/RapportDetail";
import PostMeetingMode from "./pages/PostMeetingMode";

import DirectionOverview from "./pages/DirectionOverview";
import DirectionSpaDetail from "./pages/DirectionSpaDetail";
import SpaHistory from "./pages/SpaHistory";
import Todos from "./pages/Todos";
import Objectifs from "./pages/Objectifs";
import KpiConfig from "./pages/KpiConfig";
import RespConfig from "./pages/RespConfig";
import UserSettingsPage from "./pages/UserSettings";
import AdminOrganization from "./pages/AdminOrganization";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute() {
  const { session, isLoading, mustChangePassword } = useAuth();
  const location = useLocation();
  if (isLoading) return null;
  if (!session) return <Navigate to="/login" replace />;
  // Force a password change before granting access to anything else.
  if (mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  return <Outlet />;
}

function RoleGuard({ allow }: { allow: Array<"manager" | "direction" | "admin"> }) {
  const { userRole, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return null;
  if (!userRole) return <Navigate to="/login" replace />;
  if (!allow.includes(userRole)) {
    const fallback =
      userRole === "direction" ? "/direction" : userRole === "admin" ? "/admin/organisation" : "/";
    if (location.pathname !== fallback) return <Navigate to={fallback} replace />;
  }
  return <Outlet />;
}

function RootRedirect() {
  const { userRole, isLoading } = useAuth();
  if (isLoading) return null;
  if (userRole === "admin") return <Navigate to="/admin/organisation" replace />;
  if (userRole === "direction") return <Navigate to="/direction" replace />;
  return <Dashboard />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/change-password" element={<ChangePassword />} />

              <Route element={<AppLayout />}>
                <Route path="/" element={<RootRedirect />} />
                <Route path="/parametres" element={<UserSettingsPage />} />
              </Route>

              <Route element={<RoleGuard allow={["manager"]} />}>
                <Route element={<AppLayout />}>
                  <Route path="/rapports" element={<Rapports />} />
                  <Route path="/rapport/:id" element={<RapportDetail />} />
                  <Route path="/todos" element={<Todos />} />
                  <Route path="/objectifs" element={<Objectifs />} />
                </Route>
                <Route path="/post-reunion/:id" element={<PostMeetingMode />} />
                <Route path="/historique" element={<SpaHistory />} />
              </Route>

              <Route element={<RoleGuard allow={["manager", "direction", "admin"]} />}>
                <Route element={<AppLayout />}>
                  <Route path="/admin/kpi" element={<KpiConfig />} />
                  <Route path="/admin/responsabilites" element={<RespConfig />} />
                </Route>
              </Route>


              <Route element={<RoleGuard allow={["direction", "admin"]} />}>
                <Route element={<AppLayout />}>
                  <Route path="/direction" element={<DirectionOverview />} />
                  <Route path="/direction/spa/:id" element={<DirectionSpaDetail />} />
                  <Route path="/admin/organisation" element={<AdminOrganization />} />
                </Route>
                
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
