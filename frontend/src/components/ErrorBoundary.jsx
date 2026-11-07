import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught unhandled exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.hash = '';
      window.location.reload();
    }
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== 'undefined') {
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      window.location.hash = '';
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark-950 text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md text-center">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">
              Something went wrong
            </h2>

            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
              VoiceBridge encountered an unexpected interface issue. Your connection state can be safely restored.
            </p>

            {this.state.error?.message && (
              <div className="mb-6 p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/80 text-left">
                <span className="text-[11px] font-mono text-rose-400/90 break-words block">
                  {this.state.error.message}
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98] cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try Again</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold transition-all border border-zinc-700 active:scale-[0.98] cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Return to Lobby</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
