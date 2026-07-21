import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { StoreProvider, ToastViewport, useStore } from "@/lib/store";
import Layout from "@/components/Layout";
import DualControlOverlay from "@/components/DualControlOverlay";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import Privacy from "@/pages/auth/Privacy";
import SetupWizard from "@/pages/setup/SetupWizard";
import Dashboard from "@/pages/Dashboard";
import Identity from "@/pages/Identity";
import Companies from "@/pages/Companies";
import Users from "@/pages/Users";
import Connections from "@/pages/Connections";
import Tools from "@/pages/Tools";
import Billing from "@/pages/Billing";
import AiSettings from "@/pages/AiSettings";
import Support from "@/pages/Support";
import Audit from "@/pages/Audit";

// Authenticated + setup-complete gate for management routes
function RequireManagement({ children }: { children: React.ReactNode }) {
  const { session, state } = useStore();
  const location = useLocation();
  if (!session?.authenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!state.setup.setup_complete) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

// Setup wizard requires auth; once complete there is nothing to resume
function SetupRoute() {
  const { session, state } = useStore();
  if (!session?.authenticated) return <Navigate to="/login" replace />;
  if (state.setup.setup_complete) return <Navigate to="/dashboard" replace />;
  return <SetupWizard />;
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/setup" element={<SetupRoute />} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<RequireManagement><Dashboard /></RequireManagement>} />
            <Route path="/identity" element={<RequireManagement><Identity /></RequireManagement>} />
            <Route path="/companies" element={<RequireManagement><Companies /></RequireManagement>} />
            <Route path="/users" element={<RequireManagement><Users /></RequireManagement>} />
            <Route path="/connections" element={<RequireManagement><Connections /></RequireManagement>} />
            <Route path="/tools" element={<RequireManagement><Tools /></RequireManagement>} />
            <Route path="/billing" element={<RequireManagement><Billing /></RequireManagement>} />
            <Route path="/ai" element={<RequireManagement><AiSettings /></RequireManagement>} />
            <Route path="/support" element={<RequireManagement><Support /></RequireManagement>} />
            <Route path="/audit" element={<RequireManagement><Audit /></RequireManagement>} />
            <Route path="/settings" element={<Navigate to="/identity" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
        <ToastViewport />
        <DualControlOverlay />
      </BrowserRouter>
    </StoreProvider>
  );
}
