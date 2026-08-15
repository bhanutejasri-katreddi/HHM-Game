import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  className?: string;
}

export function Input({ label, className = '', ...props }: InputProps) {
  return (
    <div className="w-full flex flex-col gap-2">
      {label && <label className="text-sm font-bold text-secondary uppercase tracking-wider">{label}</label>}
      <input 
        className={`w-full bg-black/10 dark:bg-black/30 backdrop-blur-md text-primary placeholder-muted p-4 rounded-xl border border-border-glass focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all duration-200 ${className}`} 
        {...props} 
      />
    </div>
  );
}
