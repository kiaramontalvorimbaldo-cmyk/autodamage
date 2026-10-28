-- Operaciones críticas: todas sus escrituras se confirman o se revierten juntas.
-- Solo servidor (service_role). Las rutas validan sesión/rol y pasan el actor autenticado.
BEGIN;
ALTER TABLE public.siniestros ADD COLUMN IF NOT EXISTS analisis_token uuid;
ALTER TABLE public.siniestros ADD COLUMN IF NOT EXISTS analisis_iniciado_en timestamptz;
UPDATE public.siniestros SET analisis_token=gen_random_uuid(),analisis_iniciado_en=now() WHERE analisis_estado='EN_PROCESO' AND analisis_iniciado_en IS NULL;
CREATE OR REPLACE FUNCTION public.registrar_dictamen_atomico(p_siniestro uuid, p_inspeccion uuid, p_cambios jsonb, p_ajustes jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s public.siniestros%ROWTYPE; i public.inspecciones_periciales%ROWTYPE;
  perito uuid; ajuste jsonb; nuevo text; afectados int;
BEGIN
  SELECT * INTO s FROM public.siniestros WHERE id=p_siniestro FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SINIESTRO_NO_ENCONTRADO'; END IF;
  IF s.estado <> 'EN_REVISION' OR s.analisis_estado='EN_PROCESO' THEN RAISE EXCEPTION 'ESTADO_INVALIDO'; END IF;
  SELECT * INTO i FROM public.inspecciones_periciales WHERE siniestro_id=p_siniestro ORDER BY fecha_inspeccion DESC, id DESC LIMIT 1 FOR UPDATE;
  IF i.id IS NULL OR i.id<>p_inspeccion THEN RAISE EXCEPTION 'INSPECCION_CAMBIO'; END IF;
  SELECT p.id INTO perito FROM public.peritos p JOIN public.usuarios u ON u.id=p.usuario_id
    WHERE p.usuario_id=(p_cambios->>'peritoId')::uuid AND p.estado<>'INACTIVO' AND u.rol='PERITO';
  IF perito IS NULL THEN RAISE EXCEPTION 'SIN_PERMISO'; END IF;
  IF p_cambios->>'dictamenFinal' NOT IN ('APROBADO','RECHAZADO','AMPLIACION_REQUERIDA') THEN RAISE EXCEPTION 'VALIDACION_ERROR'; END IF;
  IF p_cambios->>'dictamenFinal' IN ('RECHAZADO','AMPLIACION_REQUERIDA') AND length(trim(coalesce(p_cambios->>'observacionesPerito','')))=0 THEN RAISE EXCEPTION 'VALIDACION_ERROR'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_ajustes)) <> (SELECT count(DISTINCT a->>'id') FROM jsonb_array_elements(p_ajustes) a) THEN RAISE EXCEPTION 'AJUSTE_DUPLICADO'; END IF;
  FOR ajuste IN SELECT value FROM jsonb_array_elements(p_ajustes) LOOP
    UPDATE public.evaluacion_detallada_danos SET
      accion_requerida=coalesce(ajuste->'cambios'->>'accionRequerida',accion_requerida),
      costo_pieza_estimado=coalesce((ajuste->'cambios'->>'costoPiezaEstimado')::numeric,costo_pieza_estimado),
      aprobado_por_perito=(ajuste->'cambios'->>'aprobadoPorPerito')::boolean,
      observacion_pieza=ajuste->'cambios'->>'observacionPieza'
    WHERE id=(ajuste->>'id')::uuid AND inspeccion_id=p_inspeccion;
    GET DIAGNOSTICS afectados = ROW_COUNT;
    IF afectados<>1 THEN RAISE EXCEPTION 'EVALUACION_AJENA'; END IF;
  END LOOP;
  nuevo=CASE p_cambios->>'dictamenFinal' WHEN 'APROBADO' THEN 'APROBADO' WHEN 'RECHAZADO' THEN 'RECHAZADO' ELSE 'EN_REVISION' END;
  UPDATE public.inspecciones_periciales SET perito_id=perito, dictamen_final=p_cambios->>'dictamenFinal',
    observaciones_perito=p_cambios->>'observacionesPerito',kilometraje=(p_cambios->>'kilometraje')::int,
    costo_total_estimado=(p_cambios->>'costoTotalEstimado')::numeric WHERE id=p_inspeccion;
  UPDATE public.siniestros SET estado=nuevo,
    etiquetas=CASE WHEN p_cambios->>'dictamenFinal'='AMPLIACION_REQUERIDA' THEN array_remove(etiquetas,'AMPLIACION_RECIBIDA') ELSE etiquetas END
    WHERE id=p_siniestro;
  INSERT INTO public.audit_log(entidad,entidad_id,accion,actor_tipo,actor_id,datos)
    VALUES ('siniestros',p_siniestro,'DICTAMEN_REGISTRADO','USUARIO',(p_cambios->>'peritoId')::uuid,
      p_cambios || jsonb_build_object('estadoAnterior',s.estado,'estadoNuevo',nuevo,'costoAnterior',i.costo_total_estimado,'numeroAjustes',jsonb_array_length(p_ajustes)));
END $$;

CREATE OR REPLACE FUNCTION public.avanzar_orden_atomico(p_orden uuid,p_usuario uuid,p_estado text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE o public.ordenes_trabajo%ROWTYPE; s public.siniestros%ROWTYPE; anterior text;
BEGIN
  SELECT * INTO o FROM public.ordenes_trabajo WHERE id=p_orden FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDEN_NO_ENCONTRADA'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.talleres t JOIN public.usuarios u ON u.id=t.usuario_id WHERE t.id=o.taller_id AND t.usuario_id=p_usuario AND t.activo AND u.rol='TALLER') THEN RAISE EXCEPTION 'SIN_PERMISO'; END IF;
  SELECT * INTO s FROM public.siniestros WHERE id=o.siniestro_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SINIESTRO_NO_ENCONTRADO'; END IF;
  IF p_estado NOT IN ('RECIBIDO','EN_REPARACION','COMPLETADO') THEN RAISE EXCEPTION 'TRANSICION_INVALIDA'; END IF;
  IF o.estado<>p_estado AND NOT ((o.estado='EMITIDA' AND p_estado='RECIBIDO') OR (o.estado='RECIBIDO' AND p_estado='EN_REPARACION') OR (o.estado='EN_REPARACION' AND p_estado='COMPLETADO')) THEN RAISE EXCEPTION 'TRANSICION_INVALIDA'; END IF;
  IF s.estado NOT IN ('FAST_TRACK','APROBADO','FINALIZADO') THEN RAISE EXCEPTION 'ESTADO_INVALIDO'; END IF;
  IF s.estado='FINALIZADO' AND p_estado<>'COMPLETADO' THEN RAISE EXCEPTION 'ESTADO_INVALIDO'; END IF;
  anterior=o.estado;
  UPDATE public.ordenes_trabajo SET estado=p_estado,actualizado_en=now() WHERE id=p_orden AND estado<>p_estado;
  IF p_estado='COMPLETADO' THEN UPDATE public.siniestros SET estado='FINALIZADO' WHERE id=o.siniestro_id; END IF;
  IF anterior<>p_estado THEN
    INSERT INTO public.audit_log(entidad,entidad_id,accion,actor_tipo,actor_id,datos)
      VALUES('ordenes_trabajo',p_orden,'ESTADO_ORDEN_ACTUALIZADO','USUARIO',p_usuario,jsonb_build_object('estadoAnterior',anterior,'estadoNuevo',p_estado));
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.registrar_dictamen_atomico(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.avanzar_orden_atomico(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_dictamen_atomico(uuid,uuid,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.avanzar_orden_atomico(uuid,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.emitir_orden_atomico(p_siniestro uuid,p_actor_tipo text,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.siniestros%ROWTYPE; i public.inspecciones_periciales%ROWTYPE; o public.ordenes_trabajo%ROWTYPE; elegido uuid; aprobado boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(74021931);
  SELECT * INTO s FROM public.siniestros WHERE id=p_siniestro FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SINIESTRO_NO_ENCONTRADO'; END IF;
  SELECT * INTO o FROM public.ordenes_trabajo WHERE siniestro_id=p_siniestro;
  IF FOUND THEN RETURN to_jsonb(o); END IF;
  SELECT * INTO i FROM public.inspecciones_periciales WHERE siniestro_id=p_siniestro ORDER BY fecha_inspeccion DESC,id DESC LIMIT 1;
  IF i.id IS NULL OR i.costo_total_estimado IS NULL THEN RAISE EXCEPTION 'SIN_COSTO_ESTIMADO'; END IF;
  aprobado=s.estado='APROBADO' OR i.dictamen_final='APROBADO';
  IF s.estado NOT IN ('FAST_TRACK','APROBADO','EN_REVISION') OR NOT (aprobado OR (s.ruta='VERDE' AND i.dictamen_final IS NULL)) THEN RAISE EXCEPTION 'ESTADO_INVALIDO'; END IF;
  SELECT t.id INTO elegido FROM public.talleres t LEFT JOIN public.ordenes_trabajo x ON x.taller_id=t.id AND x.estado IN ('EMITIDA','RECIBIDO','EN_REPARACION')
    WHERE t.activo GROUP BY t.id ORDER BY count(x.id),min(x.creado_en) NULLS LAST,t.id LIMIT 1;
  IF elegido IS NULL THEN
    UPDATE public.siniestros SET estado='EN_REVISION' WHERE id=p_siniestro;
    INSERT INTO public.audit_log(entidad,entidad_id,accion,actor_tipo,actor_id,datos) VALUES('siniestros',p_siniestro,'SIN_TALLERES_DISPONIBLES',p_actor_tipo,p_actor,jsonb_build_object('ruta',s.ruta));
    RETURN NULL;
  END IF;
  PERFORM 1 FROM public.talleres WHERE id=elegido AND activo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SIN_TALLERES_DISPONIBLES'; END IF;
  INSERT INTO public.ordenes_trabajo(siniestro_id,taller_id,monto_autorizado) VALUES(p_siniestro,elegido,i.costo_total_estimado) RETURNING * INTO o;
  IF s.estado='EN_REVISION' THEN UPDATE public.siniestros SET estado=CASE WHEN aprobado THEN 'APROBADO' ELSE 'FAST_TRACK' END WHERE id=p_siniestro; END IF;
  INSERT INTO public.audit_log(entidad,entidad_id,accion,actor_tipo,actor_id,datos) VALUES('ordenes_trabajo',o.id,'ORDEN_EMITIDA',p_actor_tipo,p_actor,jsonb_build_object('siniestroId',p_siniestro,'tallerId',elegido,'montoAutorizado',o.monto_autorizado));
  RETURN to_jsonb(o);
END $$;

CREATE OR REPLACE FUNCTION public.registrar_imagen_atomica(p_foto jsonb,p_ampliacion uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.siniestros%ROWTYPE; i public.inspecciones_periciales%ROWTYPE; f public.imagenes_siniestro%ROWTYPE; solicitud uuid; prefijo text; cantidad int;
BEGIN
  SELECT * INTO s FROM public.siniestros WHERE id=(p_foto->>'siniestroId')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SINIESTRO_NO_ENCONTRADO'; END IF;
  prefijo=s.id::text || '/';
  IF p_ampliacion IS NULL THEN
    IF s.estado<>'PENDIENTE' OR s.analisis_estado<>'NO_INICIADO' THEN RAISE EXCEPTION 'ESTADO_INVALIDO'; END IF;
  ELSE
    SELECT * INTO i FROM public.inspecciones_periciales WHERE siniestro_id=s.id ORDER BY fecha_inspeccion DESC,id DESC LIMIT 1;
    SELECT id INTO solicitud FROM public.audit_log WHERE entidad_id=s.id AND entidad IN ('siniestro','siniestros') AND accion='DICTAMEN_REGISTRADO' ORDER BY creado_en DESC,id DESC LIMIT 1;
    IF s.estado<>'EN_REVISION' OR s.analisis_estado='EN_PROCESO' OR i.dictamen_final IS DISTINCT FROM 'AMPLIACION_REQUERIDA' OR solicitud IS DISTINCT FROM p_ampliacion THEN RAISE EXCEPTION 'ESTADO_INVALIDO'; END IF;
    IF EXISTS(SELECT 1 FROM public.audit_log WHERE entidad_id=s.id AND accion='AMPLIACION_ENTREGADA' AND datos->>'ampliacionId'=p_ampliacion::text) THEN RAISE EXCEPTION 'ESTADO_INVALIDO'; END IF;
    prefijo=prefijo || 'ampliaciones/' || p_ampliacion::text || '/';
  END IF;
  IF left(p_foto->>'storagePath',length(prefijo))<>prefijo THEN RAISE EXCEPTION 'VALIDACION_ERROR'; END IF;
  SELECT * INTO f FROM public.imagenes_siniestro WHERE id=(p_foto->>'id')::uuid;
  IF FOUND THEN
    IF f.siniestro_id<>s.id OR f.hash_perceptual<>p_foto->>'hashPerceptual' THEN RAISE EXCEPTION 'SOLICITUD_CONFLICTIVA'; END IF;
    RETURN to_jsonb(f);
  END IF;
  SELECT count(*) INTO cantidad FROM public.imagenes_siniestro WHERE siniestro_id=s.id AND left(storage_path,length(prefijo))=prefijo;
  IF cantidad>=5 THEN RAISE EXCEPTION 'LIMITE_IMAGENES'; END IF;
  INSERT INTO public.imagenes_siniestro(id,siniestro_id,storage_path,hash_perceptual,capturada_en,latitud,longitud,precision_gps_m,user_agent,orden,rostros_difuminados)
    VALUES((p_foto->>'id')::uuid,s.id,p_foto->>'storagePath',p_foto->>'hashPerceptual',(p_foto->>'capturadaEn')::timestamptz,(p_foto->>'latitud')::numeric,(p_foto->>'longitud')::numeric,(p_foto->>'precisionGpsM')::numeric,p_foto->>'userAgent',(p_foto->>'orden')::int,(p_foto->>'rostrosDifuminados')::boolean) RETURNING * INTO f;
  RETURN to_jsonb(f);
END $$;

CREATE OR REPLACE FUNCTION public.entregar_ampliacion_atomica(p_siniestro uuid,p_usuario uuid,p_ampliacion uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.siniestros%ROWTYPE; i public.inspecciones_periciales%ROWTYPE; solicitud uuid; cantidad int; prefijo text;
BEGIN
  SELECT * INTO s FROM public.siniestros WHERE id=p_siniestro FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SINIESTRO_NO_ENCONTRADO'; END IF;
  IF s.asegurado_id<>p_usuario THEN RAISE EXCEPTION 'SIN_PERMISO'; END IF;
  SELECT * INTO i FROM public.inspecciones_periciales WHERE siniestro_id=s.id ORDER BY fecha_inspeccion DESC,id DESC LIMIT 1;
  SELECT id INTO solicitud FROM public.audit_log WHERE entidad_id=s.id AND entidad IN ('siniestro','siniestros') AND accion='DICTAMEN_REGISTRADO' ORDER BY creado_en DESC,id DESC LIMIT 1;
  IF s.estado<>'EN_REVISION' OR s.analisis_estado='EN_PROCESO' OR i.dictamen_final IS DISTINCT FROM 'AMPLIACION_REQUERIDA' OR solicitud IS DISTINCT FROM p_ampliacion THEN RAISE EXCEPTION 'ESTADO_INVALIDO'; END IF;
  IF EXISTS(SELECT 1 FROM public.audit_log WHERE entidad_id=s.id AND accion='AMPLIACION_ENTREGADA' AND datos->>'ampliacionId'=p_ampliacion::text) THEN RETURN; END IF;
  prefijo=s.id::text || '/ampliaciones/' || p_ampliacion::text || '/';
  SELECT count(*) INTO cantidad FROM public.imagenes_siniestro WHERE siniestro_id=s.id AND left(storage_path,length(prefijo))=prefijo;
  IF cantidad<1 THEN RAISE EXCEPTION 'SIN_IMAGENES'; END IF;
  UPDATE public.siniestros SET etiquetas=ARRAY(SELECT DISTINCT x FROM unnest(etiquetas || ARRAY['AMPLIACION_RECIBIDA']) x) WHERE id=s.id;
  INSERT INTO public.audit_log(entidad,entidad_id,accion,actor_tipo,actor_id,datos) VALUES('siniestros',s.id,'AMPLIACION_ENTREGADA','USUARIO',p_usuario,jsonb_build_object('ampliacionId',p_ampliacion,'cantidadFotos',cantidad));
END $$;
REVOKE ALL ON FUNCTION public.emitir_orden_atomico(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.registrar_imagen_atomica(jsonb,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.entregar_ampliacion_atomica(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.emitir_orden_atomico(uuid,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_imagen_atomica(jsonb,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.entregar_ampliacion_atomica(uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.guardar_analisis_atomico(p_datos jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.siniestros%ROWTYPE; i jsonb; cambios jsonb; nueva uuid; e jsonb; r jsonb;
BEGIN
  i=p_datos->'inspeccion'; cambios=p_datos->'cambios';
  SELECT * INTO s FROM public.siniestros WHERE id=(i->>'siniestroId')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SINIESTRO_NO_ENCONTRADO'; END IF;
  IF s.estado NOT IN ('PENDIENTE','EN_REVISION') OR s.analisis_estado<>'EN_PROCESO' THEN RAISE EXCEPTION 'ESTADO_INVALIDO'; END IF;
  IF s.analisis_token::text IS DISTINCT FROM p_datos->>'token' THEN RAISE EXCEPTION 'ESTADO_INVALIDO'; END IF;
  IF 'AMPLIACION_RECIBIDA'=ANY(s.etiquetas) AND (cambios->>'estado'<>'EN_REVISION' OR cambios->>'ruta'='VERDE') THEN RAISE EXCEPTION 'VALIDACION_ERROR'; END IF;
  IF cambios->>'estado' NOT IN ('FAST_TRACK','EN_REVISION') OR cambios->>'ruta' NOT IN ('VERDE','AMARILLA','ROJA') OR cambios->>'analisisEstado'<>'COMPLETADO' THEN RAISE EXCEPTION 'VALIDACION_ERROR'; END IF;
  INSERT INTO public.inspecciones_periciales(siniestro_id,tipo_inspeccion,verdict_fraude,indicadores_fraude,nivel_severidad,costo_total_estimado,confianza_global,modelo_ia,version_prompt,respuesta_ia)
  VALUES(s.id,i->>'tipoInspeccion',i->>'verdictFraude',ARRAY(SELECT jsonb_array_elements_text(i->'indicadoresFraude')),i->>'nivelSeveridad',(i->>'costoTotalEstimado')::numeric,(i->>'confianzaGlobal')::numeric,i->>'modeloIa',i->>'versionPrompt',i->'respuestaIa') RETURNING id INTO nueva;
  FOR e IN SELECT value FROM jsonb_array_elements(p_datos->'evaluaciones') LOOP
    IF e->>'imagenId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.imagenes_siniestro WHERE id=(e->>'imagenId')::uuid AND siniestro_id=s.id) THEN RAISE EXCEPTION 'EVALUACION_AJENA'; END IF;
    INSERT INTO public.evaluacion_detallada_danos(inspeccion_id,codigo_pieza,accion_requerida,horas_mano_obra,costo_pieza_estimado,confianza,imagen_id,bbox)
    VALUES(nueva,e->>'codigoPieza',e->>'accionRequerida',(e->>'horasManoObra')::numeric,(e->>'costoPiezaEstimado')::numeric,(e->>'confianza')::numeric,(e->>'imagenId')::uuid,e->'bbox');
  END LOOP;
  UPDATE public.siniestros SET estado=cambios->>'estado',ruta=cambios->>'ruta',analisis_estado='COMPLETADO',requiere_inspeccion_presencial=(cambios->>'requiereInspeccionPresencial')::boolean,etiquetas=ARRAY(SELECT jsonb_array_elements_text(cambios->'etiquetas')) WHERE id=s.id;
  FOR r IN SELECT value FROM jsonb_array_elements(p_datos->'auditoria') LOOP
    IF r->>'entidadId' <> s.id::text THEN RAISE EXCEPTION 'VALIDACION_ERROR'; END IF;
    INSERT INTO public.audit_log(entidad,entidad_id,accion,actor_tipo,actor_id,datos) VALUES(r->>'entidad',(r->>'entidadId')::uuid,r->>'accion',r->>'actorTipo',(r->>'actorId')::uuid,r->'datos');
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.guardar_analisis_atomico(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_analisis_atomico(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.fallar_analisis_reservado(p_siniestro uuid,p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n int;
BEGIN
 UPDATE public.siniestros SET analisis_estado='FALLIDO' WHERE id=p_siniestro AND analisis_estado='EN_PROCESO' AND analisis_token IS NOT DISTINCT FROM p_token;
 GET DIAGNOSTICS n = ROW_COUNT; RETURN n=1;
END $$;
CREATE OR REPLACE FUNCTION public.recuperar_analisis_detenido(p_siniestro uuid,p_usuario uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.siniestros%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.usuarios u WHERE u.id=p_usuario AND (u.rol='ADMIN' OR (u.rol='PERITO' AND EXISTS(SELECT 1 FROM public.peritos p WHERE p.usuario_id=u.id AND p.estado<>'INACTIVO')))) THEN RAISE EXCEPTION 'SIN_PERMISO'; END IF;
 SELECT * INTO s FROM public.siniestros WHERE id=p_siniestro FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SINIESTRO_NO_ENCONTRADO'; END IF;
 IF s.estado NOT IN ('PENDIENTE','EN_REVISION') OR s.analisis_estado<>'EN_PROCESO' OR s.analisis_iniciado_en IS NULL OR s.analisis_iniciado_en > now()-interval '5 minutes' THEN RAISE EXCEPTION 'ESTADO_INVALIDO'; END IF;
 UPDATE public.siniestros SET analisis_estado='FALLIDO',analisis_token=NULL WHERE id=p_siniestro;
 INSERT INTO public.audit_log(entidad,entidad_id,accion,actor_tipo,actor_id,datos) VALUES('siniestros',p_siniestro,'ANALISIS_DETENIDO_RECUPERADO','USUARIO',p_usuario,jsonb_build_object('iniciadoEn',s.analisis_iniciado_en));
END $$;
REVOKE ALL ON FUNCTION public.fallar_analisis_reservado(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.recuperar_analisis_detenido(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fallar_analisis_reservado(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recuperar_analisis_detenido(uuid,uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
