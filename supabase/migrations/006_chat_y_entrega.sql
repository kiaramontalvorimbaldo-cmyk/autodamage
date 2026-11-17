BEGIN;

ALTER TABLE public.ordenes_trabajo ADD COLUMN fecha_estimada_entrega DATE;

CREATE TABLE public.mensajes_siniestro (
  secuencia BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id UUID NOT NULL UNIQUE,
  siniestro_id UUID NOT NULL REFERENCES public.siniestros(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES public.usuarios(id),
  autor_nombre TEXT NOT NULL,
  autor_rol TEXT NOT NULL CHECK (autor_rol IN ('TALLER', 'PERITO')),
  contenido TEXT NOT NULL CHECK (length(btrim(contenido)) BETWEEN 1 AND 2000),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mensajes_siniestro_pagina
  ON public.mensajes_siniestro(siniestro_id, secuencia DESC);
ALTER TABLE public.mensajes_siniestro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajes_siniestro FORCE ROW LEVEL SECURITY;

-- El taller asignado y el perito del último análisis comparten el expediente.
-- Los casos de vía rápida sin perito pueden ser atendidos por un perito activo.
CREATE FUNCTION public.puede_coordinar_siniestro(p_siniestro UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ordenes_trabajo o
    JOIN public.usuarios u ON u.id = auth.uid()
    WHERE o.siniestro_id = p_siniestro AND (
      (u.rol = 'TALLER' AND EXISTS (
        SELECT 1 FROM public.talleres t
        WHERE t.id = o.taller_id AND t.usuario_id = u.id AND t.activo
      )) OR
      (u.rol = 'PERITO' AND EXISTS (
        SELECT 1 FROM public.peritos p
        WHERE p.usuario_id = u.id AND p.estado IN ('ACTIVO', 'OCUPADO')
          AND (p.id = (
            SELECT i.perito_id FROM public.inspecciones_periciales i
            WHERE i.siniestro_id = p_siniestro
            ORDER BY i.fecha_inspeccion DESC, i.id DESC LIMIT 1
          ) OR (
            SELECT i.perito_id FROM public.inspecciones_periciales i
            WHERE i.siniestro_id = p_siniestro
            ORDER BY i.fecha_inspeccion DESC, i.id DESC LIMIT 1
          ) IS NULL)
      ))
    )
  );
$$;
REVOKE ALL ON FUNCTION public.puede_coordinar_siniestro(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puede_coordinar_siniestro(UUID) TO authenticated;
CREATE POLICY mensajes_lectura ON public.mensajes_siniestro FOR SELECT TO authenticated
  USING (public.puede_coordinar_siniestro(siniestro_id));
REVOKE ALL ON public.mensajes_siniestro FROM anon, authenticated;
GRANT SELECT ON public.mensajes_siniestro TO authenticated;

CREATE FUNCTION public.consultar_coordinacion(p_siniestro UUID, p_antes BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mensajes JSONB; v_fecha DATE;
BEGIN
  SELECT fecha_estimada_entrega INTO v_fecha FROM public.ordenes_trabajo
    WHERE siniestro_id = p_siniestro FOR SHARE;
  IF NOT public.puede_coordinar_siniestro(p_siniestro) THEN
    RAISE EXCEPTION 'SIN_PERMISO';
  END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.secuencia::BIGINT), '[]'::JSONB)
    INTO v_mensajes FROM (
      SELECT id, secuencia::TEXT AS secuencia, autor_nombre AS nombre,
        autor_rol AS rol, contenido, creado_en AS fecha
      FROM public.mensajes_siniestro
      WHERE siniestro_id = p_siniestro AND (p_antes IS NULL OR secuencia < p_antes)
      ORDER BY mensajes_siniestro.secuencia DESC LIMIT 101
    ) m;
  RETURN jsonb_build_object('fechaEntrega', v_fecha, 'mensajes', v_mensajes);
END;
$$;

CREATE FUNCTION public.enviar_mensaje_siniestro(p_siniestro UUID, p_id UUID, p_contenido TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_existente public.mensajes_siniestro; v_orden UUID;
BEGIN
  SELECT id INTO v_orden FROM public.ordenes_trabajo
    WHERE siniestro_id = p_siniestro FOR SHARE;
  IF NOT public.puede_coordinar_siniestro(p_siniestro) THEN RAISE EXCEPTION 'SIN_PERMISO'; END IF;
  IF p_contenido IS NULL OR length(btrim(p_contenido)) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'VALIDACION_ERROR';
  END IF;
  INSERT INTO public.mensajes_siniestro(id, siniestro_id, autor_id, autor_nombre, autor_rol, contenido)
    SELECT p_id, p_siniestro, u.id, u.nombre_completo, u.rol, btrim(p_contenido)
    FROM public.usuarios u WHERE u.id = auth.uid()
    ON CONFLICT (id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO v_existente FROM public.mensajes_siniestro WHERE id = p_id;
    IF v_existente.siniestro_id IS DISTINCT FROM p_siniestro
      OR v_existente.autor_id IS DISTINCT FROM auth.uid()
      OR v_existente.contenido IS DISTINCT FROM btrim(p_contenido) THEN
      RAISE EXCEPTION 'SOLICITUD_CONFLICTIVA';
    END IF;
    RETURN;
  END IF;
  INSERT INTO public.audit_log(entidad, entidad_id, accion, actor_tipo, actor_id, datos)
    VALUES ('siniestro', p_siniestro, 'MENSAJE_ENVIADO', 'USUARIO', auth.uid(),
      jsonb_build_object('mensaje_id', p_id));
END;
$$;

CREATE FUNCTION public.programar_entrega(p_siniestro UUID, p_fecha DATE, p_anterior DATE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_orden public.ordenes_trabajo;
BEGIN
  SELECT * INTO v_orden FROM public.ordenes_trabajo
    WHERE siniestro_id = p_siniestro FOR UPDATE;
  IF NOT public.puede_coordinar_siniestro(p_siniestro) THEN RAISE EXCEPTION 'SIN_PERMISO'; END IF;
  IF public.rol_actual() IS DISTINCT FROM 'TALLER' THEN RAISE EXCEPTION 'SIN_PERMISO'; END IF;
  IF v_orden.estado = 'COMPLETADO' THEN RAISE EXCEPTION 'ESTADO_INVALIDO'; END IF;
  IF p_fecha IS NULL OR p_fecha < (now() AT TIME ZONE 'America/La_Paz')::DATE THEN
    RAISE EXCEPTION 'VALIDACION_ERROR';
  END IF;
  IF v_orden.fecha_estimada_entrega IS NOT DISTINCT FROM p_fecha THEN RETURN; END IF;
  IF v_orden.fecha_estimada_entrega IS DISTINCT FROM p_anterior THEN
    RAISE EXCEPTION 'FECHA_CAMBIADA';
  END IF;
  UPDATE public.ordenes_trabajo SET fecha_estimada_entrega = p_fecha, actualizado_en = now()
    WHERE id = v_orden.id;
  INSERT INTO public.audit_log(entidad, entidad_id, accion, actor_tipo, actor_id, datos)
    VALUES ('ordenes_trabajo', v_orden.id, 'ENTREGA_PROGRAMADA', 'USUARIO', auth.uid(),
      jsonb_build_object('anterior', p_anterior, 'fecha', p_fecha));
END;
$$;

REVOKE ALL ON FUNCTION public.consultar_coordinacion(UUID, BIGINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enviar_mensaje_siniestro(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.programar_entrega(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consultar_coordinacion(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enviar_mensaje_siniestro(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.programar_entrega(UUID, DATE, DATE) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
