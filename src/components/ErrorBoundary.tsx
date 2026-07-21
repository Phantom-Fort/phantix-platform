import React from "react";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", background: "#050B1D", color: "#e2e8f0", padding: 32, fontFamily: "system-ui,sans-serif" }}>
          <h1 style={{ fontSize: 20, marginBottom: 12 }}>Something went wrong</h1>
          <p style={{ color: "#94a3b8", marginBottom: 16, maxWidth: 520 }}>
            The platform UI crashed while loading. Try a hard refresh. If it keeps happening, clear site data for this domain.
          </p>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#f43f5e", background: "#0d1b3d", padding: 16, borderRadius: 12 }}>
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.clear();
              } catch { /* ignore */ }
              window.location.href = "/login";
            }}
            style={{ marginTop: 16, padding: "10px 16px", borderRadius: 10, border: 0, background: "#E8B54D", color: "#050B1D", fontWeight: 600, cursor: "pointer" }}
          >
            Clear session & go to login
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
