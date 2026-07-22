import React from "react";
import { ShieldAlert, RefreshCw } from "lucide-react";

type Props = { children: React.ReactNode };
type State = { error: Error | null; info: React.ErrorInfo | null };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error) {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error.message);
    console.error("Component stack:", info.componentStack);
    this.setState({ info });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", background: "#050B1D", color: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ maxWidth: 600, width: "100%", background: "#0d1b3d", border: "1px solid #1e3a5f", borderRadius: 16, padding: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ background: "rgba(244,63,94,0.15)", borderRadius: 12, padding: 10 }}>
                <ShieldAlert size={22} color="#f43f5e" />
              </div>
              <div>
                <h1 style={{ fontSize: 18, margin: 0, fontWeight: 600 }}>Something went wrong</h1>
                <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>The UI crashed while rendering. Check the console for the component stack trace.</p>
              </div>
            </div>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, color: "#f43f5e", background: "#050B1D", padding: 14, borderRadius: 10, margin: "12px 0", maxHeight: 160, overflow: "auto" }}>
              {this.state.error.message}
            </pre>
            {this.state.info && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: "pointer", fontSize: 11, color: "#64748b" }}>Component stack trace</summary>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: 10, color: "#64748b", background: "#050B1D", padding: 10, borderRadius: 8, marginTop: 6, maxHeight: 200, overflow: "auto" }}>
                  {this.state.info.componentStack}
                </pre>
              </details>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => {
                  try { sessionStorage.removeItem("platform_access_token"); } catch {}
                  try { sessionStorage.removeItem("platform_org_user_token"); } catch {}
                  try { sessionStorage.removeItem("platform_dual_control"); } catch {}
                  window.location.href = "/login";
                }}
                style={{ flex: 1, padding: "10px 16px", borderRadius: 10, border: 0, background: "#E8B54D", color: "#050B1D", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
              >
                Clear session and go to login
              </button>
              <button
                type="button"
                onClick={() => { this.setState({ error: null, info: null }); }}
                style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #1e3a5f", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}
              >
                <RefreshCw size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                Dismiss
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
