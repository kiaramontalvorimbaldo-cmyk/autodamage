/**
 * Estado de error con mensaje y reintento opcional.
 */
export function ErrorState({
  mensaje,
  alReintentar,
}: {
  mensaje: string;
  alReintentar?: () => void;
}) {
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4">
      <p className="text-sm text-red-800">{mensaje}</p>
      {alReintentar && (
        <button
          type="button"
          onClick={alReintentar}
          className="mt-2 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
