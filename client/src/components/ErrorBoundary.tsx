import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { GlassCard } from './ui/GlassCard';
import { Button } from './ui/Button';

interface Props {
  children?: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-mesh">
          <GlassCard className="w-full max-w-lg p-6 sm:p-8 animate-in text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4 border border-red-500/30">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-display font-black text-primary tracking-tight mb-2">
              Something went wrong
            </h2>
            <p className="text-secondary text-sm mb-6 max-w-md">
              {this.props.fallbackMessage || "An unexpected error occurred while rendering this page."}
            </p>
            
            {this.state.error && (
               <div className="w-full text-left bg-black/40 p-4 rounded-xl border border-border-glass mb-6 overflow-x-auto text-xs text-red-400 font-mono">
                 {this.state.error.message}
               </div>
            )}
            
            <Button 
              onClick={() => window.location.reload()} 
              className="px-6 py-2 flex items-center gap-2"
            >
              <RefreshCcw size={16} /> Reload Page
            </Button>
          </GlassCard>
        </div>
      );
    }

    return this.props.children;
  }
}
