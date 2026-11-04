'use client';
import { useState } from 'react';

export function PrintReport() {
  const [error, setError] = useState('');
  async function imprimir() {
    setError('');
    const imagenes = Array.from(
      document.querySelectorAll<HTMLImageElement>('.insurance-report img'),
    );
    await Promise.all(
      imagenes.map((i) =>
        typeof i.decode === 'function' ? i.decode().catch(() => undefined) : Promise.resolve(),
      ),
    );
    if (imagenes.some((i) => !i.naturalWidth)) {
      setError('Hay evidencias que no cargaron. Recarga el informe antes de imprimirlo.');
      return;
    }
    window.print();
  }
  return (
    <div className="report-tools space-y-2">
      <button
        onClick={() => void imprimir()}
        className="rounded-xl bg-primary px-5 py-3 font-semibold text-white"
      >
        Imprimir / Guardar PDF
      </button>
      <p className="text-sm text-muted-foreground">
        En el diálogo de impresión selecciona «Guardar como PDF», papel A4 y desactiva los
        encabezados del navegador.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
