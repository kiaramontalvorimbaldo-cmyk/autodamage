import { z } from 'zod';
import { getAdminClient } from '@/infrastructure/supabase/admin-client';

const fecha = z.string().date();
export const filtroReportes = z
  .object({
    desde: fecha.optional(),
    hasta: fecha.optional(),
  })
  .refine((f) => !f.desde || !f.hasta || f.desde <= f.hasta, {
    message: 'La fecha inicial debe ser anterior o igual a la final.',
  });

const registro = z.object({
  id: z.string(),
  fecha_incidente: z.string().datetime({ offset: true }),
  estado: z.string(),
  ruta: z.string().nullable(),
});

export function resumirSiniestros(filas: z.infer<typeof registro>[]) {
  const dias = new Map<string, number>();
  const estados = new Map<string, number>();
  const rutas = new Map<string, number>();
  for (const fila of filas) {
    const dia = new Date(Date.parse(fila.fecha_incidente) - 4 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    dias.set(dia, (dias.get(dia) ?? 0) + 1);
    estados.set(fila.estado, (estados.get(fila.estado) ?? 0) + 1);
    const ruta = fila.ruta ?? 'SIN_CLASIFICAR';
    rutas.set(ruta, (rutas.get(ruta) ?? 0) + 1);
  }
  return {
    total: filas.length,
    dias: [...dias].sort(([a], [b]) => a.localeCompare(b)),
    estados: [...estados].sort(([a], [b]) => a.localeCompare(b)),
    rutas: [...rutas].sort(([a], [b]) => a.localeCompare(b)),
  };
}

export async function consultarEstadisticas(filtro: z.infer<typeof filtroReportes>) {
  const { desde, hasta } = filtroReportes.parse(filtro);
  const db = getAdminClient();
  const filas: z.infer<typeof registro>[] = [];
  const lote = 500;
  for (let inicio = 0; ; inicio += lote) {
    let query = db
      .from('siniestros')
      .select('id,fecha_incidente,estado,ruta')
      .order('fecha_incidente')
      .order('id')
      .range(inicio, inicio + lote - 1);
    if (desde) query = query.gte('fecha_incidente', desde + 'T00:00:00-04:00');
    if (hasta) {
      const siguiente = new Date(hasta + 'T00:00:00Z');
      siguiente.setUTCDate(siguiente.getUTCDate() + 1);
      query = query.lt('fecha_incidente', siguiente.toISOString().slice(0, 10) + 'T00:00:00-04:00');
    }
    const { data, error } = await query;
    if (error) throw new Error('No se pudieron consultar los reportes.');
    const pagina = z.array(registro).parse(data ?? []);
    filas.push(...pagina);
    if (pagina.length < lote) break;
  }
  return resumirSiniestros(filas);
}
