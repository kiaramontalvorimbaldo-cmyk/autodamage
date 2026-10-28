/**
 * Evalúa la IA real de Gemini contra el set de validación
 * (`tests/validation/etiquetas.csv`). Genera `docs/informe-validacion.md`.
 *
 * Plan local: npx tsx scripts/evaluar-ia.ts --plan
 * Evaluación real: npx tsx scripts/evaluar-ia.ts --apply
 * Requiere GEMINI_API_KEY real y AI_PROVIDER=gemini. Respeta AI_MAX_RPM.
 * Guarda el progreso en `docs/informe-validacion-progreso.json` y puede reanudarse.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { VERSION_PROMPT } from '@/infrastructure/ai/prompt-v1';
import { leerEtiquetasCsv, alinearResultados } from './lib/evaluation-data';
import { GeminiProvider } from '@/infrastructure/ai/gemini-provider';
import {
  metricasPiezas,
  metricasRecaptura,
  metricasSeveridad,
  percentil,
  type Prediccion,
} from '@/lib/metricas-evaluacion';
import { loadEnvLocal, requireEnv } from './lib/load-env';

loadEnvLocal();

const CSV = resolve(process.cwd(), 'tests/validation/etiquetas.csv');
const IMPORTANTE_PROGRESO = resolve(process.cwd(), 'docs/informe-validacion-progreso.json');
const INFORME = resolve(process.cwd(), 'docs/informe-validacion.md');

async function main() {
  const opciones = process.argv.slice(2);
  if (
    opciones.some((opcion) => !['--plan', '--apply'].includes(opcion)) ||
    (opciones.includes('--plan') && opciones.includes('--apply'))
  )
    throw new Error('Usa --plan o --apply');
  const baremo = z
    .array(z.object({ codigo_pieza: z.string().min(1) }))
    .min(1)
    .parse(JSON.parse(readFileSync(resolve(process.cwd(), 'supabase/seed/baremo.json'), 'utf8')));
  const codigos = baremo.map((p) => p.codigo_pieza);
  const csv = readFileSync(CSV, 'utf8');
  const etiquetas = leerEtiquetasCsv(csv, codigos);
  const hash = createHash('sha256')
    .update(csv)
    .update(JSON.stringify(codigos))
    .update(VERSION_PROMPT)
    .update(process.env.GEMINI_MODEL ?? '');
  // Comprobar todos los archivos antes de consumir cuota.
  for (const etiqueta of etiquetas)
    hash.update(
      createHash('sha256')
        .update(readFileSync(resolve(process.cwd(), 'tests/validation/imagenes', etiqueta.archivo)))
        .digest(),
    );
  const firma = hash.digest('hex');
  if (!opciones.includes('--apply')) {
    console.log(
      `Plan local: ${etiquetas.length} fotos y ${codigos.length} códigos. No se llamó a Gemini.`,
    );
    return;
  }
  if (process.env.AI_PROVIDER !== 'gemini') throw new Error('Se requiere AI_PROVIDER=gemini');
  requireEnv('GEMINI_API_KEY');
  const proveedor = new GeminiProvider();

  const progreso: { archivo: string; pred: Prediccion; latenciaMs: number }[] = [];
  if (existsSync(IMPORTANTE_PROGRESO)) {
    const previo = z
      .object({
        firma: z.string(),
        resultados: z.array(
          z.object({
            archivo: z.string(),
            latenciaMs: z.number().finite().nonnegative(),
            pred: z.object({
              severidad: z.enum(['LEVE', 'MODERADO', 'SEVERO']),
              piezas: z.array(z.string()),
              esRecaptura: z.boolean(),
            }),
          }),
        ),
      })
      .parse(JSON.parse(readFileSync(IMPORTANTE_PROGRESO, 'utf8')));
    if (previo.firma !== firma)
      throw new Error(
        'El progreso pertenece a otro conjunto, modelo o prompt; consérvalo con otro nombre',
      );
    progreso.push(...previo.resultados);
    alinearResultados(etiquetas, progreso);
  }
  const hechos = new Set(progreso.map((p) => p.archivo));

  const rpm = Number(process.env.AI_MAX_RPM ?? '10');
  const pausaMs = Math.ceil(60_000 / Math.max(1, rpm));

  for (const etiqueta of etiquetas) {
    if (hechos.has(etiqueta.archivo)) continue;
    const rutaImagen = resolve(process.cwd(), 'tests/validation/imagenes', etiqueta.archivo);
    const base64 = readFileSync(rutaImagen).toString('base64');
    const inicio = Date.now();
    try {
      const analisis = await proveedor.analizarDanos({
        imagenes: [{ base64, mimeType: 'image/jpeg' }],
        codigosPiezasValidos: codigos,
      });
      progreso.push({
        archivo: etiqueta.archivo,
        latenciaMs: Date.now() - inicio,
        pred: {
          severidad: analisis.nivel_severidad,
          piezas: analisis.piezas_detectadas.map((p) => p.codigo_pieza),
          esRecaptura: analisis.sospecha_recaptura,
        },
      });
    } catch (error) {
      writeFileSync(IMPORTANTE_PROGRESO, JSON.stringify({ firma, resultados: progreso }, null, 2));
      throw error;
    }
    writeFileSync(IMPORTANTE_PROGRESO, JSON.stringify({ firma, resultados: progreso }, null, 2));
    await new Promise((r) => setTimeout(r, pausaMs));
  }

  const { reales, predichas, latencias } = alinearResultados(etiquetas, progreso);
  const severidad = metricasSeveridad(reales, predichas);
  const piezas = metricasPiezas(reales, predichas);
  const recaptura = metricasRecaptura(reales, predichas);

  const informe = `# Informe de validación de la IA

- Modelo: ${process.env.GEMINI_MODEL}
- Prompt: ${VERSION_PROMPT}
- Total de fotos: ${reales.length}
- Concordancia de severidad: ${severidad.aciertos}/${severidad.total}
- Matriz de confusión: ${JSON.stringify(severidad.matriz)}
- Piezas — precisión: ${piezas.precision.toFixed(3)}, recall: ${piezas.recall.toFixed(3)}, F1: ${piezas.f1.toFixed(3)}
- Recaptura — VP: ${recaptura.vp}, FP: ${recaptura.fp}, VN: ${recaptura.vn}, FN: ${recaptura.fn}
- Latencia p50: ${percentil(latencias, 50)} ms, p95: ${percentil(latencias, 95)} ms
- Fecha: ${new Date().toISOString()}
`;
  writeFileSync(INFORME, informe);
  console.log(informe);
}

main().catch(() => {
  console.error(
    'Evaluación detenida: revisa el conjunto, configuración y compatibilidad del progreso. No se publican resultados incompletos.',
  );
  process.exit(1);
});
