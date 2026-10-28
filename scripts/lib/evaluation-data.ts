import { z } from 'zod';
import type { Etiqueta, Prediccion } from '@/lib/metricas-evaluacion';

const filaSchema = z.object({
  archivo: z.string().regex(/^[\w -]+\.jpe?g$/i, 'Usa un nombre JPEG sin directorios'),
  severidad: z.enum(['LEVE', 'MODERADO', 'SEVERO']),
  piezas: z.array(z.string().min(1)),
  esRecaptura: z.boolean(),
});

/** CSV de cuatro columnas sin comillas ni comas dentro de las celdas. */
export function leerEtiquetasCsv(csv: string, codigosValidos: readonly string[]): Etiqueta[] {
  const [cabecera, ...filas] = csv
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/);
  if (cabecera !== 'archivo,severidad,piezas,es_recaptura')
    throw new Error('Cabecera CSV inválida');
  const archivos = new Set<string>();
  const codigos = new Set(codigosValidos);
  const etiquetas = filas
    .filter((fila) => fila.trim())
    .map((fila) => {
      const celdas = fila.split(',');
      if (celdas.length !== 4 || !['true', 'false'].includes(celdas[3]))
        throw new Error('Fila CSV inválida');
      const etiqueta = filaSchema.parse({
        archivo: celdas[0],
        severidad: celdas[1],
        piezas: celdas[2] ? celdas[2].split('|') : [],
        esRecaptura: celdas[3] === 'true',
      });
      const clave = etiqueta.archivo.toLowerCase();
      if (archivos.has(clave)) throw new Error('Archivo duplicado en el conjunto');
      if (etiqueta.piezas.some((codigo) => !codigos.has(codigo)))
        throw new Error('Código fuera del baremo en las etiquetas');
      archivos.add(clave);
      return etiqueta;
    });
  if (etiquetas.length === 0) throw new Error('El conjunto de validación está vacío');
  return etiquetas;
}

export type ResultadoEvaluacion = { archivo: string; latenciaMs: number; pred: Prediccion };

/** Ordena por identidad de archivo, nunca por llegada del progreso. */
export function alinearResultados(etiquetas: Etiqueta[], resultados: ResultadoEvaluacion[]) {
  const porArchivo = new Map(resultados.map((r) => [r.archivo, r]));
  if (porArchivo.size !== resultados.length) throw new Error('Resultados duplicados');
  const reales = etiquetas.filter((e) => porArchivo.has(e.archivo));
  const ordenados = reales.map((e) => porArchivo.get(e.archivo)!);
  return {
    reales,
    predichas: ordenados.map((r) => r.pred),
    latencias: ordenados.filter((r) => r.pred.severidad !== 'ERROR').map((r) => r.latenciaMs),
  };
}
