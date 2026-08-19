import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  title?: string;
  durationMs?: number;
}

interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastSingle key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastSingle({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.durationMs || 4000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const getStyle = () => {
    switch (toast.type) {
      case 'success':
        return {
          bg: 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100 shadow-emerald-500/10',
          icon: <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />,
          title: toast.title || 'Success'
        };
      case 'error':
        return {
          bg: 'bg-red-950/90 border-red-500/40 text-red-100 shadow-red-500/10',
          icon: <AlertCircle size={18} className="text-red-400 shrink-0" />,
          title: toast.title || 'Error'
        };
      case 'warning':
        return {
          bg: 'bg-amber-950/90 border-amber-500/40 text-amber-100 shadow-amber-500/10',
          icon: <AlertTriangle size={18} className="text-amber-400 shrink-0" />,
          title: toast.title || 'Warning'
        };
      case 'info':
      default:
        return {
          bg: 'bg-indigo-950/90 border-indigo-500/40 text-indigo-100 shadow-indigo-500/10',
          icon: <Info size={18} className="text-indigo-400 shrink-0" />,
          title: toast.title || 'Notice'
        };
    }
  };

  const style = getStyle();

  return (
    <div 
      className={`pointer-events-auto p-4 rounded-xl border backdrop-blur-xl shadow-2xl flex items-start gap-3 animate-in transition-all ${style.bg}`}
    >
      <div className="mt-0.5">{style.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider opacity-90">{style.title}</p>
        <p className="text-xs mt-0.5 leading-relaxed break-words">{toast.message}</p>
      </div>
      <button 
        onClick={() => onDismiss(toast.id)}
        className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
