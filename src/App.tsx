import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { StoreProvider, ToastViewport, useStore } from "@/lib/store";
import Layout from "@/components/Layout";
import DualControlOverlay from "@/components/DualControlOverlay";
import CookieConsent from "@/components/CookieConsent";
import Login from "@/pages/auth/Login";
import ChangePassword from "@/pages/auth/ChangePassword";
import DeviceConfirm from "@/pages/DeviceConfirm";
import Register from "@/pages/auth/Register";
import Privacy from "@/pages/auth/Privacy";
import Terms from "@/pages/auth/Terms";
import AUP from "@/pages/auth/AUP";
import Cookies from "@/pages/auth/Cookies";
import PasswordResetRequest from "@/pages/auth/PasswordResetRequest";
import PasswordResetComplete from "@/pages/auth/PasswordResetComplete";
import SetupWizard from "@/pages/setup/SetupWizard";
import Dashboard from "@/pages/Dashboard";
import Identity from "@/pages/Identity";
import Companies from "@/pages/Companies";
import Users from "@/pages/Users";
import Connections from "@/pages/Connections";
import GithubIntegration from "@/pages/Github";
import Applications from "@/pages/Applications";
import Tools from "@/pages/Tools";
import Billing from "@/pages/Billing";
import AiSettings from "@/pages/AiSettings";
import AgiSettings from "@/pages/AgiSettings";
import { AGI_ENABLED } from "@/lib/api";
import Support from "@/pages/Support";
import Audit from "@/pages/Audit";
import AgentActivity from "@/pages/AgentActivity";
import Alerts from "@/pages/Alerts";
import Integrations from "@/pages/Integrations";
import Sandbox from "@/pages/Sandbox";
import DangerZone from "@/pages/DangerZone";
import Docs from "@/pages/Docs";
import DocPage from "@/pages/DocPage";

// Authenticated + setup-complete gate for management routes
function RequireManagement({ children }: { children: React.ReactNode }) {
  const { session, state, sessionLoading } = useStore();
  const location = useLocation();
  // Verify the session before rendering OR redirecting — no flash of the app
  // or of the login page while the stored session is still being restored.
  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-phantix-500 border-t-gold-400" />
          <p className="mt-3 text-sm text-slate-400">Verifying access...</p>
        </div>
      </div>
    );
  }
  if (!session?.authenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  // Admin-assigned password: change it before touching any management screen.
  if (session?.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (!state.setup.setup_complete) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

// Setup wizard requires auth; once complete there is nothing to resume
function SetupRoute() {
  const { session, state, sessionLoading } = useStore();
  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-phantix-500 border-t-gold-400" />
          <p className="mt-3 text-sm text-slate-400">Verifying access...</p>
        </div>
      </div>
    );
  }
  if (!session?.authenticated) return <Navigate to="/login" replace />;
  if (session?.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (state.setup.setup_complete) return <Navigate to="/dashboard" replace />;
  return <SetupWizard />;
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/device-confirm" element={<DeviceConfirm />} />
          <Route path="/register" element={<Register />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/aup" element={<AUP />} />
          <Route path="/cookies" element={<Cookies />} />
          <Route path="/password-reset" element={<PasswordResetRequest />} />
          <Route path="/reset-password" element={<PasswordResetComplete />} />
          <Route path="/setup" element={<SetupRoute />} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<RequireManagement><Dashboard /></RequireManagement>} />
            <Route path="/sandbox" element={<RequireManagement><Sandbox /></RequireManagement>} />
            <Route path="/identity" element={<RequireManagement><Identity /></RequireManagement>} />
            <Route path="/companies" element={<RequireManagement><Companies /></RequireManagement>} />
            <Route path="/users" element={<RequireManagement><Users /></RequireManagement>} />
            <Route path="/connections" element={<RequireManagement><Connections /></RequireManagement>} />
            <Route path="/github" element={<RequireManagement><GithubIntegration /></RequireManagement>} />
            <Route path="/integrations/github/callback" element={<RequireManagement><GithubIntegration /></RequireManagement>} />
            <Route path="/applications" element={<RequireManagement><Applications /></RequireManagement>} />
            <Route path="/tools" element={<RequireManagement><Tools /></RequireManagement>} />
            <Route path="/billing" element={<RequireManagement><Billing /></RequireManagement>} />
            <Route path="/ai" element={<RequireManagement><AiSettings /></RequireManagement>} />
            {AGI_ENABLED && <Route path="/agi" element={<RequireManagement><AgiSettings /></RequireManagement>} />}
            <Route path="/support" element={<RequireManagement><Support /></RequireManagement>} />
            <Route path="/audit" element={<RequireManagement><Audit /></RequireManagement>} />
            <Route path="/agent-activity" element={<RequireManagement><AgentActivity /></RequireManagement>} />
            <Route path="/alerts" element={<RequireManagement><Alerts /></RequireManagement>} />
            <Route path="/integrations" element={<RequireManagement><Integrations /></RequireManagement>} />
            <Route path="/danger-zone" element={<RequireManagement><DangerZone /></RequireManagement>} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/docs/:docId" element={<DocPage />} />
            <Route path="/settings" element={<Navigate to="/identity" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
        <ToastViewport />
        <DualControlOverlay />
        <CookieConsent />
      </BrowserRouter>
    </StoreProvider>
  );
}
