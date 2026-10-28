export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4 p-6">
      <span className="sr-only">Cargando tu espacio…</span>
      <div className="bg-muted h-8 w-48 animate-pulse rounded" />
      <div className="bg-muted h-40 animate-pulse rounded-xl" />
      <div className="bg-muted h-24 animate-pulse rounded-xl" />
    </div>
  );
}
