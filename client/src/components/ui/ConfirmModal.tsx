import { useEffect } from 'react';
import { 
  AlertTriangle, Trash2, RefreshCw, Shuffle, 
  Key, HelpCircle, X, Check, AlertCircle, Info 
} from 'lucide-react';
import { Button } from './Button';

export interface ConfirmModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'destructive' | 'primary' | 'warning';
  icon?: 'trash' | 'alert' | 'refresh' | 'shuffle' | 'key' | 'help' | 'info';
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ConfirmModalProps {
  config: ConfirmModalConfig | null;
  onClose: () => void;
}

export function ConfirmModal({ config, onClose }: ConfirmModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && config?.isOpen) {
        if (config.onCancel) config.onCancel();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config, onClose]);

  if (!config || !config.isOpen) return null;

  const {
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'primary',
    icon = 'alert',
    onConfirm,
    onCancel
  } = config;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    onClose();
  };

  const renderIcon = () => {
    const iconSize = 24;
    switch (icon) {
      case 'trash':
        return <Trash2 size={iconSize} className="text-red-400" />;
      case 'refresh':
        return <RefreshCw size={iconSize} className="text-sky-400" />;
      case 'shuffle':
        return <Shuffle size={iconSize} className="text-indigo-400" />;
      case 'key':
        return <Key size={iconSize} className="text-amber-400" />;
      case 'help':
        return <HelpCircle size={iconSize} className="text-brand-light" />;
      case 'info':
        return <Info size={iconSize} className="text-brand-light" />;
      case 'alert':
      default:
        return variant === 'destructive' 
          ? <AlertTriangle size={iconSize} className="text-red-400" />
          : <AlertCircle size={iconSize} className="text-amber-400" />;
    }
  };

  const getIconBg = () => {
    if (variant === 'destructive' || icon === 'trash') return 'bg-red-500/20 border-red-500/30';
    if (icon === 'refresh') return 'bg-sky-500/20 border-sky-500/30';
    if (icon === 'shuffle') return 'bg-indigo-500/20 border-indigo-500/30';
    if (icon === 'key') return 'bg-amber-500/20 border-amber-500/30';
    return 'bg-brand/20 border-brand/30';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in overflow-y-auto">
      <div 
        className="relative w-full max-w-md bg-slate-900/95 border border-white/15 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close icon in top corner */}
        <button 
          onClick={handleCancel}
          className="absolute right-4 top-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Icon & Title */}
        <div className="flex items-start gap-4 pr-6">
          <div className={`p-3 rounded-2xl border shrink-0 ${getIconBg()}`}>
            {renderIcon()}
          </div>
          <div>
            <h3 className="text-lg font-display font-bold text-white leading-snug">{title}</h3>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed whitespace-pre-line">{message}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
          <Button 
            variant="secondary" 
            onClick={handleCancel}
            className="text-xs py-2 px-4"
          >
            {cancelText}
          </Button>

          <Button 
            variant={variant === 'destructive' ? 'destructive' : 'primary'}
            onClick={handleConfirm}
            className="text-xs py-2 px-5 gap-1.5 shadow-lg"
          >
            {variant === 'destructive' ? <Trash2 size={14} /> : <Check size={14} />}
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
