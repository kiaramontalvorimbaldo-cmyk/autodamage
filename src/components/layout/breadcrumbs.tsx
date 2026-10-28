import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export type Miga = { etiqueta: string; href?: string };

/**
 * Migas de pan: salida visible de cualquier pantalla anidada.
 */
export function Breadcrumbs({ migas }: { migas: Miga[] }) {
  if (migas.length === 0) return null;

  return (
    <nav aria-label="Ruta de navegación" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {migas.map((miga, indice) => {
          const esUltima = indice === migas.length - 1;
          return (
            <li key={`${miga.etiqueta}-${indice}`} className="flex items-center gap-1">
              {indice > 0 && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />}
              {miga.href && !esUltima ? (
                <Link href={miga.href} className="hover:text-foreground hover:underline">
                  {miga.etiqueta}
                </Link>
              ) : (
                <span aria-current={esUltima ? 'page' : undefined} className="text-foreground">
                  {miga.etiqueta}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}