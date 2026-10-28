-- Preparada el 20/10/2026. NO aplicada al servicio remoto.
-- Conserva las migraciones 001–003 y todos los registros.
-- Ver docs/despliegue.md antes de aplicar y probar los permisos en desarrollo.
BEGIN;

-- UPDATE sobre una fila propia nunca debe permitir cambiar su rol o identidad.
REVOKE UPDATE ON public.usuarios FROM authenticated, anon;
REVOKE UPDATE(id, nombre_completo, email, rol, creado_en) ON public.usuarios FROM authenticated, anon;
GRANT UPDATE(nombre_completo) ON public.usuarios TO authenticated;
REVOKE INSERT, DELETE ON public.usuarios FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM authenticated, anon;
-- Las órdenes y sus montos se escriben a través de casos de uso con service role.
REVOKE INSERT, UPDATE, DELETE ON public.ordenes_trabajo FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.rol_actual()
RETURNS VARCHAR(20) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT rol::VARCHAR(20) FROM public.usuarios WHERE id=(select auth.uid()) $$;
REVOKE ALL ON FUNCTION public.rol_actual() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rol_actual() TO authenticated, service_role;

-- Estos auxiliares leen las relaciones sin volver a entrar en las políticas
-- siniestros -> órdenes -> siniestros. Nunca admiten un id de usuario externo.
CREATE FUNCTION public.es_dueno_siniestro(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS(SELECT 1 FROM public.siniestros s WHERE s.id=p_id AND s.asegurado_id=(select auth.uid()) AND (select public.rol_actual())='ASEGURADO') $$;
CREATE FUNCTION public.es_taller_siniestro(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS(SELECT 1 FROM public.ordenes_trabajo o JOIN public.talleres t ON t.id=o.taller_id WHERE o.siniestro_id=p_id AND t.usuario_id=(select auth.uid()) AND t.activo=true AND (select public.rol_actual())='TALLER') $$;
CREATE FUNCTION public.puede_leer_siniestro(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT (select public.rol_actual()) IN ('PERITO','ADMIN') OR public.es_dueno_siniestro(p_id) OR public.es_taller_siniestro(p_id) $$;
REVOKE ALL ON FUNCTION public.es_dueno_siniestro(uuid), public.es_taller_siniestro(uuid), public.puede_leer_siniestro(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_dueno_siniestro(uuid), public.es_taller_siniestro(uuid), public.puede_leer_siniestro(uuid) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_vehiculos_asegurado ON public.vehiculos(asegurado_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_taller_estado ON public.ordenes_trabajo(taller_id,estado);
CREATE INDEX IF NOT EXISTS idx_inspecciones_siniestro ON public.inspecciones_periciales(siniestro_id);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_inspeccion ON public.evaluacion_detallada_danos(inspeccion_id);

-- Sustituye únicamente las políticas conocidas de 001, sin eliminar políticas ajenas.
DROP POLICY IF EXISTS p_usuarios_select_own ON public.usuarios;
DROP POLICY IF EXISTS p_usuarios_update_own ON public.usuarios;
DROP POLICY IF EXISTS p_usuarios_select_admin ON public.usuarios;
DROP POLICY IF EXISTS p_vehiculos_asegurado ON public.vehiculos;
DROP POLICY IF EXISTS p_vehiculos_select_perito ON public.vehiculos;
DROP POLICY IF EXISTS p_vehiculos_select_admin ON public.vehiculos;
DROP POLICY IF EXISTS p_siniestros_asegurado ON public.siniestros;
DROP POLICY IF EXISTS p_siniestros_select_perito ON public.siniestros;
DROP POLICY IF EXISTS p_siniestros_update_perito ON public.siniestros;
DROP POLICY IF EXISTS p_siniestros_select_admin ON public.siniestros;
DROP POLICY IF EXISTS p_siniestros_select_taller ON public.siniestros;
DROP POLICY IF EXISTS p_imagenes_asegurado ON public.imagenes_siniestro;
DROP POLICY IF EXISTS p_imagenes_perito ON public.imagenes_siniestro;
DROP POLICY IF EXISTS p_imagenes_admin ON public.imagenes_siniestro;
DROP POLICY IF EXISTS p_imagenes_taller ON public.imagenes_siniestro;
DROP POLICY IF EXISTS p_inspecciones_asegurado ON public.inspecciones_periciales;
DROP POLICY IF EXISTS p_inspecciones_perito ON public.inspecciones_periciales;
DROP POLICY IF EXISTS p_inspecciones_admin ON public.inspecciones_periciales;
DROP POLICY IF EXISTS p_inspecciones_taller ON public.inspecciones_periciales;
DROP POLICY IF EXISTS p_evaluacion_asegurado ON public.evaluacion_detallada_danos;
DROP POLICY IF EXISTS p_evaluacion_perito ON public.evaluacion_detallada_danos;
DROP POLICY IF EXISTS p_evaluacion_admin ON public.evaluacion_detallada_danos;
DROP POLICY IF EXISTS p_evaluacion_taller ON public.evaluacion_detallada_danos;
DROP POLICY IF EXISTS p_ordenes_asegurado ON public.ordenes_trabajo;
DROP POLICY IF EXISTS p_ordenes_perito ON public.ordenes_trabajo;
DROP POLICY IF EXISTS p_ordenes_admin ON public.ordenes_trabajo;
DROP POLICY IF EXISTS p_ordenes_taller ON public.ordenes_trabajo;
DROP POLICY IF EXISTS p_baremo_select ON public.baremo_mock;
DROP POLICY IF EXISTS p_audit_perito ON public.audit_log;
DROP POLICY IF EXISTS p_audit_admin ON public.audit_log;

CREATE POLICY p_usuarios_select_own ON public.usuarios FOR SELECT TO authenticated USING (id=(select auth.uid()));
CREATE POLICY p_usuarios_update_own ON public.usuarios FOR UPDATE TO authenticated USING (id=(select auth.uid())) WITH CHECK (id=(select auth.uid()));
CREATE POLICY p_usuarios_select_admin ON public.usuarios FOR SELECT TO authenticated USING ((select public.rol_actual())='ADMIN');
CREATE POLICY p_peritos_own ON public.peritos FOR SELECT TO authenticated USING (usuario_id=(select auth.uid()));
CREATE POLICY p_peritos_admin ON public.peritos FOR SELECT TO authenticated USING ((select public.rol_actual())='ADMIN');
CREATE POLICY p_talleres_own ON public.talleres FOR SELECT TO authenticated USING (usuario_id=(select auth.uid()));
CREATE POLICY p_talleres_admin ON public.talleres FOR SELECT TO authenticated USING ((select public.rol_actual())='ADMIN');

CREATE POLICY p_vehiculos_asegurado ON public.vehiculos FOR ALL TO authenticated USING ((select public.rol_actual())='ASEGURADO' AND asegurado_id=(select auth.uid())) WITH CHECK ((select public.rol_actual())='ASEGURADO' AND asegurado_id=(select auth.uid()));
CREATE POLICY p_vehiculos_read_staff ON public.vehiculos FOR SELECT TO authenticated USING ((select public.rol_actual()) IN ('PERITO','ADMIN'));

-- La fila propia se evalúa directamente para permitir INSERT ... RETURNING.
-- Un auxiliar STABLE que vuelve a consultar la tabla no ve la fila recién insertada.
CREATE POLICY p_siniestros_read ON public.siniestros FOR SELECT TO authenticated USING (
 (select public.rol_actual()) IN ('PERITO','ADMIN')
 OR ((select public.rol_actual())='ASEGURADO' AND asegurado_id=(select auth.uid()))
 OR public.es_taller_siniestro(id));
CREATE POLICY p_siniestros_insert_own ON public.siniestros FOR INSERT TO authenticated WITH CHECK (
 (select public.rol_actual())='ASEGURADO' AND asegurado_id=(select auth.uid())
 AND estado='PENDIENTE' AND ruta IS NULL AND analisis_estado='NO_INICIADO'
 AND requiere_inspeccion_presencial=false AND cardinality(etiquetas)=0
 AND EXISTS(SELECT 1 FROM public.vehiculos v WHERE v.id=vehiculo_id AND v.asegurado_id=(select auth.uid())));
CREATE POLICY p_siniestros_update_perito ON public.siniestros FOR UPDATE TO authenticated USING ((select public.rol_actual())='PERITO') WITH CHECK ((select public.rol_actual())='PERITO');

CREATE POLICY p_imagenes_read ON public.imagenes_siniestro FOR SELECT TO authenticated USING (public.puede_leer_siniestro(siniestro_id));
CREATE POLICY p_imagenes_insert_perito ON public.imagenes_siniestro FOR INSERT TO authenticated WITH CHECK ((select public.rol_actual())='PERITO');
CREATE POLICY p_imagenes_update_perito ON public.imagenes_siniestro FOR UPDATE TO authenticated USING ((select public.rol_actual())='PERITO') WITH CHECK ((select public.rol_actual())='PERITO');

-- El taller recibe las piezas autorizadas por el servidor, no inspecciones privadas.
CREATE POLICY p_inspecciones_read ON public.inspecciones_periciales FOR SELECT TO authenticated USING ((select public.rol_actual()) IN ('PERITO','ADMIN') OR public.es_dueno_siniestro(siniestro_id));
CREATE POLICY p_inspecciones_insert_perito ON public.inspecciones_periciales FOR INSERT TO authenticated WITH CHECK ((select public.rol_actual())='PERITO');
CREATE POLICY p_inspecciones_update_perito ON public.inspecciones_periciales FOR UPDATE TO authenticated USING ((select public.rol_actual())='PERITO') WITH CHECK ((select public.rol_actual())='PERITO');

CREATE POLICY p_evaluacion_read ON public.evaluacion_detallada_danos FOR SELECT TO authenticated USING ((select public.rol_actual()) IN ('PERITO','ADMIN') OR EXISTS(SELECT 1 FROM public.inspecciones_periciales i WHERE i.id=inspeccion_id AND public.es_dueno_siniestro(i.siniestro_id)));
CREATE POLICY p_evaluacion_insert_perito ON public.evaluacion_detallada_danos FOR INSERT TO authenticated WITH CHECK ((select public.rol_actual())='PERITO');
CREATE POLICY p_evaluacion_update_perito ON public.evaluacion_detallada_danos FOR UPDATE TO authenticated USING ((select public.rol_actual())='PERITO') WITH CHECK ((select public.rol_actual())='PERITO');

CREATE POLICY p_ordenes_read ON public.ordenes_trabajo FOR SELECT TO authenticated USING (public.puede_leer_siniestro(siniestro_id));
CREATE POLICY p_baremo_select ON public.baremo_mock FOR SELECT TO authenticated USING (true);
CREATE POLICY p_audit_staff ON public.audit_log FOR SELECT TO authenticated USING ((select public.rol_actual()) IN ('PERITO','ADMIN'));

INSERT INTO storage.buckets(id,name,public) VALUES('evidencias','evidencias',false)
ON CONFLICT(id) DO UPDATE SET public=false;

COMMIT;
