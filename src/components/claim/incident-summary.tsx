export function IncidentSummary({ descripcion }: { descripcion: string | null | undefined }) {
  if (!descripcion) return null;
  return (
    <section className="rounded-xl border bg-white p-4">
      <h2 className="text-sm font-semibold">Datos declarados por el asegurado</h2>
      <p className="mt-2 whitespace-pre-line break-words text-sm text-muted-foreground">
        {descripcion}
      </p>
    </section>
  );
}
