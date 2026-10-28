import { ScanLine } from 'lucide-react';

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-3 ${inverse ? 'text-white' : 'text-slate-900'}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-300 text-slate-950 shadow-sm">
        <ScanLine className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="text-lg font-bold tracking-tight">
        AutoDamage{' '}
        <span
          className={`ml-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${inverse ? 'bg-white/10 text-emerald-200' : 'bg-emerald-100 text-emerald-800'}`}
        >
          AI
        </span>
      </span>
    </span>
  );
}
