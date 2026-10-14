import { Component } from "react";
import { AlertTriangle } from "lucide-react";

// Keeps one crashing page from blanking the whole app.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Page crashed:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="panel">
        <div className="empty">
          <AlertTriangle size={36} strokeWidth={1.4} />
          <h3>This page hit an error</h3>
          <p className="muted">{String(this.state.error?.message ?? this.state.error)}</p>
          <button className="btn primary" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}
