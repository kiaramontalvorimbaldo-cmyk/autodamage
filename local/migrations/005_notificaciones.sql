CREATE TABLE public.notificaciones (
  secuencia BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  siniestro_id UUID NOT NULL REFERENCES public.siniestros(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  leido_en TIMESTAMPTZ
);
CREATE INDEX idx_notificaciones_usuario ON public.notificaciones(usuario_id, secuencia DESC);
CREATE INDEX idx_notificaciones_pendientes ON public.notificaciones(usuario_id) WHERE leido_en IS NULL;

CREATE FUNCTION public.notificar_siniestro() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_titulo TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN v_titulo := 'Recibimos tu reporte de siniestro';
  ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN
    v_titulo := CASE NEW.estado
      WHEN 'EN_REVISION' THEN 'Tu siniestro está en revisión del perito'
      WHEN 'FAST_TRACK' THEN 'Tu siniestro pasó a vía rápida'
      WHEN 'APROBADO' THEN 'El perito aprobó tu siniestro'
      WHEN 'RECHAZADO' THEN 'El perito emitió un rechazo: consulta el motivo'
      WHEN 'FINALIZADO' THEN 'La atención de tu siniestro finalizó'
      ELSE 'Cambió el estado de tu siniestro' END;
  ELSIF NEW.analisis_estado = 'FALLIDO' AND OLD.analisis_estado IS DISTINCT FROM NEW.analisis_estado THEN
    v_titulo := 'El análisis no pudo completarse: revisa tu expediente';
  ELSE RETURN NEW;
  END IF;
  INSERT INTO public.notificaciones(usuario_id,siniestro_id,titulo) VALUES(NEW.asegurado_id,NEW.id,v_titulo);
  RETURN NEW;
END;
$$;
CREATE TRIGGER siniestro_notificacion AFTER INSERT OR UPDATE ON public.siniestros FOR EACH ROW EXECUTE FUNCTION public.notificar_siniestro();

CREATE FUNCTION public.notificar_orden() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_titulo TEXT; v_usuario UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN v_titulo := 'Se asignó una orden de trabajo a tu siniestro';
  ELSIF NEW.fecha_estimada_entrega IS DISTINCT FROM OLD.fecha_estimada_entrega THEN
    v_titulo := CASE WHEN NEW.fecha_estimada_entrega IS NULL THEN 'El taller retiró la fecha estimada de entrega' ELSE 'Fecha estimada de entrega: ' || to_char(NEW.fecha_estimada_entrega,'DD/MM/YYYY') END;
  ELSIF NEW.estado IS DISTINCT FROM OLD.estado AND NEW.estado <> 'COMPLETADO' THEN
    v_titulo := CASE NEW.estado WHEN 'RECIBIDO' THEN 'El taller recibió tu vehículo' WHEN 'EN_REPARACION' THEN 'El taller inició la reparación' ELSE 'Se actualizó tu orden de trabajo' END;
  ELSE RETURN NEW;
  END IF;
  SELECT asegurado_id INTO v_usuario FROM public.siniestros WHERE id=NEW.siniestro_id;
  INSERT INTO public.notificaciones(usuario_id,siniestro_id,titulo) VALUES(v_usuario,NEW.siniestro_id,v_titulo);
  RETURN NEW;
END;
$$;
CREATE TRIGGER orden_notificacion AFTER INSERT OR UPDATE ON public.ordenes_trabajo FOR EACH ROW EXECUTE FUNCTION public.notificar_orden();

CREATE FUNCTION public.notificar_ampliacion() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_usuario UUID;
BEGIN
  IF NEW.dictamen_final='AMPLIACION_REQUERIDA' AND (TG_OP='INSERT' OR OLD.dictamen_final IS DISTINCT FROM NEW.dictamen_final) THEN
    SELECT asegurado_id INTO v_usuario FROM public.siniestros WHERE id=NEW.siniestro_id;
    INSERT INTO public.notificaciones(usuario_id,siniestro_id,titulo) VALUES(v_usuario,NEW.siniestro_id,'El perito solicitó información adicional');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ampliacion_notificacion AFTER INSERT OR UPDATE ON public.inspecciones_periciales FOR EACH ROW EXECUTE FUNCTION public.notificar_ampliacion();
