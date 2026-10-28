import { getAdminClient } from '@/infrastructure/supabase/admin-client';

/** Consultas limitadas para el panel; la autorización se realiza antes de invocarlas. */
export async function consultarAdministracion() {
  const db = getAdminClient();
  const resultados = await Promise.all([
    db.from('usuarios').select('id,nombre_completo,email,rol').order('nombre_completo').limit(200),
    db.from('peritos').select('usuario_id,estado').limit(200),
    db.from('talleres').select('id,usuario_id,nombre,activo').limit(200),
    db
      .from('siniestros')
      .select('id,estado,ruta,fecha_incidente,descripcion')
      .order('fecha_incidente', { ascending: false })
      .limit(100),
    db.from('ordenes_trabajo').select('siniestro_id,taller_id,estado').limit(200),
    db
      .from('audit_log')
      .select('id,entidad_id,accion,actor_tipo,creado_en,datos')
      .order('creado_en', { ascending: false })
      .limit(100),
  ]);
  if (resultados.some((r) => r.error)) throw new Error('No se pudo consultar la administración');
  return {
    usuarios: resultados[0].data ?? [],
    peritos: resultados[1].data ?? [],
    talleres: resultados[2].data ?? [],
    casos: resultados[3].data ?? [],
    ordenes: resultados[4].data ?? [],
    registros: resultados[5].data ?? [],
  };
}
