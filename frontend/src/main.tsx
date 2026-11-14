import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("VisionX App Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen grid place-items-center p-4 bg-slate-900 text-white font-sans">
          <div className="card w-full max-w-md space-y-4 p-6 bg-slate-800 rounded-2xl border border-red-500/30 text-center shadow-2xl">
            <h1 className="text-2xl font-bold text-white">
              Vision<span className="text-indigo-400">X</span> AI
            </h1>
            <p className="text-red-400 text-sm font-medium">Application encountered an unexpected error.</p>
            <div className="text-xs bg-slate-950 p-3 rounded-xl overflow-auto max-h-36 text-slate-300 text-left border border-slate-800">
              {this.state.error?.message || "Unknown rendering exception"}
            </div>
            <button
              className="btn btn-p w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
              onClick={() => {
                localStorage.clear();
                sessionStorage.clear();
                window.location.reload();
              }}
            >
              Clear Cache & Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElem = document.getElementById("root");
if (rootElem) {
  createRoot(rootElem).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
