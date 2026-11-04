import { getAdminClient } from '@/infrastructure/supabase/admin-client';
import { z } from 'zod';

/** Invocar solo tras autorizar ADMIN y obtener el caso. */
export async function consultarIdentificacionReporte(aseguradoId: string, vehiculoId: string) {
  const db = getAdminClient();
  const [persona, vehiculo] = await Promise.all([
    db.from('usuarios').select('nombre_completo').eq('id', aseguradoId).maybeSingle(),
    db
      .from('vehiculos')
      .select('matricula,marca,modelo,numero_poliza')
      .eq('id', vehiculoId)
      .maybeSingle(),
  ]);
  if (persona.error || vehiculo.error)
    throw new Error('No se pudo cargar la identificación del informe');
  const p = z.object({ nombre_completo: z.string().nullable() }).nullable().parse(persona.data);
  const v = z
    .object({
      matricula: z.string(),
      marca: z.string(),
      modelo: z.string(),
      numero_poliza: z.string(),
    })
    .nullable()
    .parse(vehiculo.data);
  return {
    asegurado: p?.nombre_completo ?? null,
    matricula: v?.matricula ?? null,
    marca: v?.marca ?? null,
    modelo: v?.modelo ?? null,
    poliza: v?.numero_poliza ?? null,
  };
}
