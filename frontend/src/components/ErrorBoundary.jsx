import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[VoiceBridge ErrorBoundary] Caught unhandled exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#07090C] text-[#F3F4F6] flex items-center justify-center p-4 font-sans select-none">
          <div className="max-w-md w-full bg-[#0B0D11] border border-[#1E232E] rounded p-6 shadow-2xl text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white mb-2">
              VoiceBridge Interface Exception
            </h2>

            <p className="text-xs text-gray-400 mb-4 leading-relaxed font-sans">
              An unexpected interface error occurred. Telemetry and room state can be safely restored without data loss.
            </p>

            {this.state.error?.message && (
              <div className="mb-4 p-2.5 rounded bg-[#13171F] border border-[#1E232E] text-left">
                <span className="text-[11px] font-mono text-rose-400 break-words block">
                  {this.state.error.message}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={this.handleReset}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
