
import { Toaster } from "@/components/safe-ui/toaster";
import { Toaster as Sonner } from "@/components/safe-ui/sonner";
import { TooltipProvider } from "@/components/safe-ui/tooltip";
import { QueryClient } from "@tanstack/query-core";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AccessModeProvider } from "@/contexts/AccessModeContext";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import Homepage from "./pages/Homepage";
import AdminDashboard from "./pages/AdminDashboard";
import DevAdminDashboard from "./pages/DevAdminDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import StudentsSystem from "./pages/StudentsSystem";
import StudentsViewSystem from "./pages/StudentsViewSystem";
import NotFound from "./pages/NotFound";
import Metronome from "./pages/Metronome";
import BsiataDishmaya from "./components/ui/BsiataDishmaya";

const queryClient = new QueryClient();

const AppContent = () => {
  useVersionCheck();
  
  return (
    <>
      <BsiataDishmaya />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Homepage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/dev-admin" element={<DevAdminDashboard />} />
          <Route path="/student/:studentId" element={<StudentDashboard />} />
          <Route path="/students-system" element={<StudentsSystem />} />
          <Route path="/students-view" element={<StudentsViewSystem />} />
          <Route path="/metronome" element={<Metronome />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AccessModeProvider>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </AccessModeProvider>
  </QueryClientProvider>
);

export default App;
