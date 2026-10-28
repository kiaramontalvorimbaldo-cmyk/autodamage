/**
 * Estado de carga con mensaje accesible.
 */
export function LoadingState({ mensaje = 'Cargando…' }: { mensaje?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 p-4 text-gray-600">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
      <span>{mensaje}</span>
    </div>
  );
}
