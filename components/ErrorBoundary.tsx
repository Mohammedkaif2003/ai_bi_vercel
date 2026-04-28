import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-[#030712] flex items-center justify-center p-6 text-white font-sans">
          <div className="max-w-md w-full bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-10 text-center backdrop-blur-xl shadow-2xl">
            <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-rose-500/20">
              <AlertTriangle className="text-rose-500" size={40} />
            </div>
            
            <h1 className="text-3xl font-bold mb-4 tracking-tight">Something went wrong</h1>
            <p className="text-slate-400 mb-10 leading-relaxed text-lg">
              The application encountered an unexpected error. Don&apos;t worry, your data is safe.
            </p>

            <div className="space-y-4">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-500/20"
              >
                <RefreshCcw size={20} />
                Try again
              </button>
              
              <button
                onClick={() => window.location.href = "/"}
                className="w-full bg-white/5 hover:bg-white/10 text-slate-300 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all border border-white/10"
              >
                <Home size={20} />
                Go to Home
              </button>
            </div>

            {process.env.NODE_ENV === "development" && (
              <div className="mt-8 p-4 bg-black/40 rounded-xl text-left overflow-auto max-h-40 border border-white/5">
                <p className="text-rose-400 font-mono text-xs break-all">
                  {this.state.error?.toString()}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
