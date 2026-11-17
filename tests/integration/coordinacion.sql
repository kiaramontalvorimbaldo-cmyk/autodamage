-- Ejecutar únicamente en una base local desechable con las migraciones aplicadas.
BEGIN;
INSERT INTO auth.users(id, email, raw_user_meta_data)
  SELECT ('00000000-0000-4000-8000-' || lpad(n::TEXT, 12, '0'))::UUID,
    'coordinacion' || n || '@example.test', '{"nombre_completo":"Prueba"}'::JSONB
  FROM generate_series(1, 5) n;
UPDATE public.usuarios SET rol = CASE
  WHEN id IN ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004') THEN 'PERITO'
  WHEN id IN ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005') THEN 'TALLER'
  ELSE 'ASEGURADO' END;
INSERT INTO public.peritos(id, usuario_id, numero_licencia) VALUES
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000002', 'TEST-CHAT-1'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000004', 'TEST-CHAT-2');
INSERT INTO public.talleres(id, usuario_id, nombre) VALUES
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000003', 'Taller chat'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000005', 'Otro taller');
INSERT INTO public.vehiculos(id, asegurado_id, matricula, marca, modelo, numero_poliza) VALUES
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000001', 'CHAT-TEST', 'Prueba', 'Prueba', 'CHAT-TEST');
INSERT INTO public.siniestros(id, asegurado_id, vehiculo_id, fecha_incidente, latitud, longitud) VALUES
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000301', now(), -17, -66),
  ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000301', now(), -17, -66);
INSERT INTO public.inspecciones_periciales(siniestro_id, perito_id) VALUES
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000101');
INSERT INTO public.ordenes_trabajo(siniestro_id, taller_id, monto_autorizado) VALUES
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000201', 100),
  ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000202', 200);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
DO $$
DECLARE caso UUID := '00000000-0000-4000-8000-000000000401';
  mensaje UUID := '00000000-0000-4000-8000-000000000701'; fecha DATE := current_date + 10;
BEGIN
  PERFORM public.enviar_mensaje_siniestro(caso, mensaje, 'Hallazgo nuevo');
  PERFORM public.enviar_mensaje_siniestro(caso, mensaje, 'Hallazgo nuevo');
  IF (SELECT count(*) FROM public.mensajes_siniestro) <> 1 THEN RAISE EXCEPTION 'Mensaje duplicado'; END IF;
  BEGIN
    PERFORM public.enviar_mensaje_siniestro(caso, mensaje, 'Contenido diferente');
    RAISE EXCEPTION 'Se aceptó cambiar un mensaje existente';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'SOLICITUD_CONFLICTIVA' THEN RAISE; END IF;
  END;
  PERFORM public.programar_entrega(caso, fecha, NULL);
  PERFORM public.programar_entrega(caso, fecha, NULL);
  IF public.consultar_coordinacion(caso)->>'fechaEntrega' <> fecha::TEXT THEN RAISE EXCEPTION 'Fecha incorrecta'; END IF;
  BEGIN
    PERFORM public.programar_entrega(caso, fecha + 1, NULL);
    RAISE EXCEPTION 'Se sobrescribió una fecha concurrente';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'FECHA_CAMBIADA' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.consultar_coordinacion('00000000-0000-4000-8000-000000000402');
    RAISE EXCEPTION 'Taller accedió a otro caso';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'SIN_PERMISO' THEN RAISE; END IF;
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
DO $$
DECLARE caso UUID := '00000000-0000-4000-8000-000000000401';
BEGIN
  PERFORM public.consultar_coordinacion(caso);
  PERFORM public.enviar_mensaje_siniestro(caso, '00000000-0000-4000-8000-000000000702', 'Voy a revisar');
  BEGIN
    PERFORM public.programar_entrega(caso, current_date + 20, current_date + 10);
    RAISE EXCEPTION 'Perito cambió la entrega';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'SIN_PERMISO' THEN RAISE; END IF;
  END;
END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.mensajes_siniestro) <> 0 THEN RAISE EXCEPTION 'RLS expuso mensajes ajenos'; END IF;
  BEGIN
    PERFORM public.consultar_coordinacion('00000000-0000-4000-8000-000000000401');
    RAISE EXCEPTION 'Otro perito accedió al caso';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'SIN_PERMISO' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.audit_log WHERE accion = 'MENSAJE_ENVIADO') <> 2 THEN RAISE EXCEPTION 'Auditoría duplicada'; END IF;
  IF (SELECT count(*) FROM public.audit_log WHERE accion = 'ENTREGA_PROGRAMADA') <> 1 THEN RAISE EXCEPTION 'Auditoría de entrega duplicada'; END IF;
END $$;
INSERT INTO public.mensajes_siniestro(id, siniestro_id, autor_id, autor_nombre, autor_rol, contenido)
  SELECT gen_random_uuid(), '00000000-0000-4000-8000-000000000401',
    '00000000-0000-4000-8000-000000000003', 'Taller', 'TALLER', n::TEXT
  FROM generate_series(1, 105) n;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
DO $$ DECLARE pagina JSONB; siguiente JSONB; primero BIGINT; BEGIN
  pagina := public.consultar_coordinacion('00000000-0000-4000-8000-000000000401');
  IF jsonb_array_length(pagina->'mensajes') <> 101 THEN RAISE EXCEPTION 'Límite de página incorrecto'; END IF;
  IF pagina->'mensajes'->100->>'contenido' <> '105' THEN RAISE EXCEPTION 'Orden numérico incorrecto'; END IF;
  primero := (pagina->'mensajes'->0->>'secuencia')::BIGINT;
  siguiente := public.consultar_coordinacion('00000000-0000-4000-8000-000000000401', primero);
  IF jsonb_array_length(siguiente->'mensajes') <> 6 THEN RAISE EXCEPTION 'Historial incompleto'; END IF;
  BEGIN
    INSERT INTO public.mensajes_siniestro(id, siniestro_id, autor_id, autor_nombre, autor_rol, contenido)
      VALUES (gen_random_uuid(), '00000000-0000-4000-8000-000000000401',
        '00000000-0000-4000-8000-000000000003', 'Nombre falso', 'PERITO', 'Directo');
    RAISE EXCEPTION 'Inserción directa permitida';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
ROLLBACK;
