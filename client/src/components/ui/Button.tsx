import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive';
  className?: string;
}

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center rounded-xl font-bold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-brand hover:bg-brand-hover text-white py-3 px-6 shadow-lg shadow-brand/20",
    secondary: "bg-white/10 hover:bg-white/20 text-primary border border-border-glass py-3 px-6 backdrop-blur-md",
    destructive: "bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/50 py-3 px-6 backdrop-blur-md"
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
