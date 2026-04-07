import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Rapports from "./pages/Rapports";
import RapportDetail from "./pages/RapportDetail";
import MeetingMode from "./pages/MeetingMode";
import PostMeetingMode from "./pages/PostMeetingMode";
import DirectionView from "./pages/DirectionView";
import SpaHistory from "./pages/SpaHistory";
import Todos from "./pages/Todos";
import Objectifs from "./pages/Objectifs";
import KpiConfig from "./pages/KpiConfig";
import RespConfig from "./pages/RespConfig";
import UserSettingsPage from "./pages/UserSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/rapports" element={<Rapports />} />
            <Route path="/rapport/:id" element={<RapportDetail />} />
            <Route path="/todos" element={<Todos />} />
            <Route path="/objectifs" element={<Objectifs />} />
            <Route path="/admin/kpi" element={<KpiConfig />} />
            <Route path="/admin/responsabilites" element={<RespConfig />} />
            <Route path="/parametres" element={<UserSettingsPage />} />
          </Route>
          <Route path="/reunion/:id" element={<MeetingMode />} />
          <Route path="/post-reunion/:id" element={<PostMeetingMode />} />
          <Route path="/direction/:id" element={<DirectionView />} />
          <Route path="/historique/:spa" element={<SpaHistory />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
