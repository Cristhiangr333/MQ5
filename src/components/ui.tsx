import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { Loader2, TriangleAlert } from 'lucide-react';

/** Fondo y tipografía compartidos por las pantallas de acceso. */
export function Screen({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div
      className={`min-h-screen bg-[#142138] text-slate-100 font-['Nunito_Sans',sans-serif] flex flex-col items-center p-4 sm:p-6 ${
        wide ? 'justify-start' : 'justify-center'
      }`}
    >
      <div className={`w-full ${wide ? 'max-w-3xl' : 'max-w-md'}`}>{children}</div>
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-900/70 border border-slate-700/60 rounded-3xl p-5 sm:p-7 shadow-xl ${className}`}>
      {children}
    </div>
  );
}

export function Spinner({ className = 'w-5 h-5' }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} aria-hidden="true" />;
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

/** Campo con etiqueta visible, error textual y tamaño táctil cómodo. */
export function Field({ label, error, hint, id, className = '', ...rest }: FieldProps) {
  const fieldId = id ?? `f-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const describedBy = error ? `${fieldId}-err` : hint ? `${fieldId}-hint` : undefined;
  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-bold text-slate-200 mb-1.5">
        {label}
      </label>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`w-full min-h-12 rounded-xl bg-slate-950/70 border px-4 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
          error ? 'border-rose-400' : 'border-slate-600 focus:border-emerald-400'
        } ${className}`}
        {...rest}
      />
      {error ? (
        <p id={`${fieldId}-err`} className="mt-1.5 text-sm text-rose-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="mt-1.5 text-xs text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  busy?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function Button({ busy, variant = 'primary', children, disabled, className = '', ...rest }: ButtonProps) {
  const styles = {
    primary: 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/20',
    secondary: 'bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100',
    ghost: 'bg-transparent hover:bg-slate-800/70 text-slate-300',
  }[variant];
  return (
    <button
      disabled={disabled || busy}
      className={`min-h-12 px-5 rounded-xl font-extrabold text-base inline-flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${styles} ${className}`}
      {...rest}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-rose-500/10 border border-rose-400/40 text-rose-200 text-sm p-3.5">
      <TriangleAlert className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function FullScreenLoader({ text = 'Cargando...' }: { text?: string }) {
  return (
    <Screen>
      <div role="status" className="flex flex-col items-center gap-3 text-slate-300 py-16">
        <Spinner className="w-9 h-9 text-emerald-400" />
        <p className="font-bold">{text}</p>
      </div>
    </Screen>
  );
}

export function FullScreenError({ message, onRetry }: { message: string | null; onRetry: () => void | Promise<void> }) {
  return (
    <Screen>
      <Card className="text-center space-y-4">
        <p className="text-3xl" aria-hidden="true">😕</p>
        <h1 className="text-xl font-extrabold font-['Baloo_2']">No pudimos cargar tus datos</h1>
        <p className="text-slate-300 text-sm">{message ?? 'Inténtalo de nuevo en un momento.'}</p>
        <Button onClick={() => void onRetry()} className="w-full">Reintentar</Button>
      </Card>
    </Screen>
  );
}
