-- ============================================================
-- Sprint 1: Esquema completo de AutoDamage AI (11 tablas)
-- Convenciones: PK UUID (excepto baremo_mock SERIAL), TIMESTAMPTZ, snake_case
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Tablas
-- ------------------------------------------------------------

CREATE TABLE public.usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  rol VARCHAR(20) NOT NULL CHECK (rol IN ('ASEGURADO','PERITO','TALLER','ADMIN')),
  creado_en TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.vehiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asegurado_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  matricula VARCHAR(20) UNIQUE NOT NULL,
  marca VARCHAR(50) NOT NULL,
  modelo VARCHAR(50) NOT NULL,
  numero_poliza VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE public.peritos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID UNIQUE NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  numero_licencia VARCHAR(50) UNIQUE NOT NULL,
  especialidad VARCHAR(100) DEFAULT 'Vehiculos Livianos',
  estado VARCHAR(20) DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','OCUPADO','INACTIVO'))
);

CREATE TABLE public.talleres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID UNIQUE NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  nombre VARCHAR(150) NOT NULL,
  direccion TEXT,
  telefono VARCHAR(30),
  activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE public.baremo_mock (
  id SERIAL PRIMARY KEY,
  codigo_pieza VARCHAR(50) UNIQUE NOT NULL,
  pieza_nombre VARCHAR(100) NOT NULL,
  marca_vehiculo VARCHAR(50) NOT NULL DEFAULT 'GENERICO',
  costo_repuesto_base NUMERIC(10,2) NOT NULL CHECK (costo_repuesto_base >= 0),
  horas_mano_obra NUMERIC(4,2) NOT NULL CHECK (horas_mano_obra >= 0),
  costo_hora_mo NUMERIC(10,2) NOT NULL DEFAULT 30.00
);

CREATE TABLE public.siniestros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asegurado_id UUID NOT NULL REFERENCES public.usuarios(id),
  vehiculo_id UUID NOT NULL REFERENCES public.vehiculos(id),
  fecha_registro TIMESTAMPTZ DEFAULT now(),
  fecha_incidente TIMESTAMPTZ NOT NULL,
  latitud NUMERIC(10,8) NOT NULL,
  longitud NUMERIC(11,8) NOT NULL,
  descripcion TEXT,
  estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado IN ('PENDIENTE','FAST_TRACK','EN_REVISION','APROBADO','RECHAZADO','FINALIZADO')),
  ruta VARCHAR(10) CHECK (ruta IN ('VERDE','AMARILLA','ROJA')),
  analisis_estado VARCHAR(15) NOT NULL DEFAULT 'NO_INICIADO'
    CHECK (analisis_estado IN ('NO_INICIADO','EN_PROCESO','COMPLETADO','FALLIDO')),
  requiere_inspeccion_presencial BOOLEAN NOT NULL DEFAULT FALSE,
  etiquetas TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE public.imagenes_siniestro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siniestro_id UUID NOT NULL REFERENCES public.siniestros(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  hash_perceptual CHAR(16) NOT NULL,
  capturada_en TIMESTAMPTZ NOT NULL,
  latitud NUMERIC(10,8),
  longitud NUMERIC(11,8),
  precision_gps_m NUMERIC(8,2),
  user_agent TEXT,
  orden SMALLINT NOT NULL DEFAULT 0,
  rostros_difuminados BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.inspecciones_periciales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siniestro_id UUID NOT NULL REFERENCES public.siniestros(id) ON DELETE CASCADE,
  perito_id UUID REFERENCES public.peritos(id),
  fecha_inspeccion TIMESTAMPTZ DEFAULT now(),
  tipo_inspeccion VARCHAR(30) NOT NULL DEFAULT 'DIGITAL_IA'
    CHECK (tipo_inspeccion IN ('DIGITAL_IA','PRESENCIAL')),
  kilometraje INT,
  observaciones_perito TEXT,
  dictamen_final VARCHAR(30) CHECK (dictamen_final IN ('APROBADO','RECHAZADO','AMPLIACION_REQUERIDA')),
  verdict_fraude VARCHAR(30) NOT NULL DEFAULT 'SIN_RIESGO'
    CHECK (verdict_fraude IN ('SOSPECHA_RECAPTURA','INCONSISTENCIA_GPS','INCONSISTENCIA_TEMPORAL','FOTO_DUPLICADA','SIN_RIESGO')),
  indicadores_fraude TEXT[] NOT NULL DEFAULT '{}',
  nivel_severidad VARCHAR(10) CHECK (nivel_severidad IN ('LEVE','MODERADO','SEVERO')),
  costo_total_estimado NUMERIC(10,2),
  confianza_global NUMERIC(4,3),
  modelo_ia VARCHAR(80),
  version_prompt VARCHAR(20),
  respuesta_ia JSONB
);

CREATE TABLE public.evaluacion_detallada_danos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspeccion_id UUID NOT NULL REFERENCES public.inspecciones_periciales(id) ON DELETE CASCADE,
  codigo_pieza VARCHAR(50) NOT NULL REFERENCES public.baremo_mock(codigo_pieza),
  accion_requerida VARCHAR(20) NOT NULL CHECK (accion_requerida IN ('REPARAR','PINTAR','SUSTITUIR')),
  horas_mano_obra NUMERIC(4,2) NOT NULL,
  costo_pieza_estimado NUMERIC(10,2) NOT NULL,
  confianza NUMERIC(4,3),
  imagen_id UUID REFERENCES public.imagenes_siniestro(id),
  bbox JSONB,
  aprobado_por_perito BOOLEAN NOT NULL DEFAULT TRUE,
  observacion_pieza TEXT
);

CREATE TABLE public.ordenes_trabajo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siniestro_id UUID UNIQUE NOT NULL REFERENCES public.siniestros(id) ON DELETE CASCADE,
  taller_id UUID NOT NULL REFERENCES public.talleres(id),
  estado VARCHAR(20) NOT NULL DEFAULT 'EMITIDA'
    CHECK (estado IN ('EMITIDA','RECIBIDO','EN_REPARACION','COMPLETADO')),
  monto_autorizado NUMERIC(10,2) NOT NULL,
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad VARCHAR(40) NOT NULL,
  entidad_id UUID NOT NULL,
  accion VARCHAR(60) NOT NULL,
  actor_tipo VARCHAR(10) NOT NULL CHECK (actor_tipo IN ('USUARIO','SISTEMA','IA')),
  actor_id UUID,
  datos JSONB,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------

CREATE INDEX idx_siniestros_asegurado ON public.siniestros(asegurado_id);
CREATE INDEX idx_siniestros_estado_ruta ON public.siniestros(estado, ruta);
CREATE INDEX idx_imagenes_siniestro_id ON public.imagenes_siniestro(siniestro_id);
CREATE INDEX idx_imagenes_hash ON public.imagenes_siniestro(hash_perceptual);
CREATE INDEX idx_audit_log_entidad ON public.audit_log(entidad, entidad_id);

-- ------------------------------------------------------------
-- Funciones auxiliares
-- ------------------------------------------------------------

-- Rol del usuario autenticado (lee la tabla pública de usuarios)
CREATE OR REPLACE FUNCTION public.rol_actual()
RETURNS VARCHAR(20)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT u.rol::VARCHAR(20)
  FROM public.usuarios u
  WHERE u.id = auth.uid();
$$;

-- Al registrarse en auth.users se crea la fila en public.usuarios
-- con rol forzado 'ASEGURADO' (se ignora cualquier rol en metadatos)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nombre VARCHAR(150);
BEGIN
  nombre := COALESCE(
    NEW.raw_user_meta_data->>'nombre_completo',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  INSERT INTO public.usuarios (id, nombre_completo, email, rol)
  VALUES (NEW.id, nombre, NEW.email, 'ASEGURADO');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- audit_log es inmutable: niega UPDATE y DELETE
CREATE OR REPLACE FUNCTION public.audit_log_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es inmutable: no se permite UPDATE ni DELETE';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_no_update ON public.audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_immutable();

-- Ping para el endpoint /api/health
CREATE OR REPLACE FUNCTION public.ping()
RETURNS INT
LANGUAGE sql
STABLE
AS $$ SELECT 1; $$;

-- ------------------------------------------------------------
-- Row Level Security (activado en TODAS las tablas)
-- ------------------------------------------------------------

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talleres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baremo_mock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.siniestros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imagenes_siniestro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspecciones_periciales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluacion_detallada_danos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes_trabajo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Force RLS: incluso el dueño ve solo lo que las políticas permiten
ALTER TABLE public.usuarios FORCE ROW LEVEL SECURITY;
ALTER TABLE public.vehiculos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.peritos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.talleres FORCE ROW LEVEL SECURITY;
ALTER TABLE public.baremo_mock FORCE ROW LEVEL SECURITY;
ALTER TABLE public.siniestros FORCE ROW LEVEL SECURITY;
ALTER TABLE public.imagenes_siniestro FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inspecciones_periciales FORCE ROW LEVEL SECURITY;
ALTER TABLE public.evaluacion_detallada_danos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes_trabajo FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Políticas RLS
-- Matriz: ASEGURADO / PERITO / TALLER / ADMIN
-- Las escrituras del sistema se hacen con service role (no pasan por RLS)
-- ------------------------------------------------------------

-- usuarios: cada rol ve/edita SU fila; ADMIN ve todas
CREATE POLICY p_usuarios_select_own ON public.usuarios
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY p_usuarios_update_own ON public.usuarios
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY p_usuarios_select_admin ON public.usuarios
  FOR SELECT TO authenticated USING (rol_actual() = 'ADMIN');

-- vehiculos: ASEGURADO CRUD de los suyos; PERITO y ADMIN leen todos
CREATE POLICY p_vehiculos_asegurado ON public.vehiculos
  FOR ALL TO authenticated
  USING (asegurado_id = auth.uid())
  WITH CHECK (asegurado_id = auth.uid());
CREATE POLICY p_vehiculos_select_perito ON public.vehiculos
  FOR SELECT TO authenticated USING (rol_actual() = 'PERITO');
CREATE POLICY p_vehiculos_select_admin ON public.vehiculos
  FOR SELECT TO authenticated USING (rol_actual() = 'ADMIN');

-- siniestros: ASEGURADO CRUD de los suyos; PERITO lee/actualiza todos;
-- TALLER lee solo los vinculados a sus ordenes; ADMIN lee todos
CREATE POLICY p_siniestros_asegurado ON public.siniestros
  FOR ALL TO authenticated
  USING (asegurado_id = auth.uid())
  WITH CHECK (asegurado_id = auth.uid());
CREATE POLICY p_siniestros_select_perito ON public.siniestros
  FOR SELECT TO authenticated USING (rol_actual() = 'PERITO');
CREATE POLICY p_siniestros_update_perito ON public.siniestros
  FOR UPDATE TO authenticated USING (rol_actual() = 'PERITO');
CREATE POLICY p_siniestros_select_admin ON public.siniestros
  FOR SELECT TO authenticated USING (rol_actual() = 'ADMIN');
CREATE POLICY p_siniestros_select_taller ON public.siniestros
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordenes_trabajo ot
      JOIN public.talleres t ON t.id = ot.taller_id
      WHERE ot.siniestro_id = siniestros.id AND t.usuario_id = auth.uid()
    )
  );

-- imagenes_siniestro: ASEGURADO lee las de sus siniestros; PERITO CRUD;
-- TALLER lee las de sus ordenes; ADMIN lee todas
CREATE POLICY p_imagenes_asegurado ON public.imagenes_siniestro
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.siniestros s
      WHERE s.id = imagenes_siniestro.siniestro_id AND s.asegurado_id = auth.uid()
    )
  );
CREATE POLICY p_imagenes_perito ON public.imagenes_siniestro
  FOR ALL TO authenticated USING (rol_actual() = 'PERITO');
CREATE POLICY p_imagenes_admin ON public.imagenes_siniestro
  FOR SELECT TO authenticated USING (rol_actual() = 'ADMIN');
CREATE POLICY p_imagenes_taller ON public.imagenes_siniestro
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordenes_trabajo ot
      JOIN public.talleres t ON t.id = ot.taller_id
      WHERE ot.siniestro_id = imagenes_siniestro.siniestro_id AND t.usuario_id = auth.uid()
    )
  );

-- inspecciones_periciales: misma matriz que imagenes
CREATE POLICY p_inspecciones_asegurado ON public.inspecciones_periciales
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.siniestros s
      WHERE s.id = inspecciones_periciales.siniestro_id AND s.asegurado_id = auth.uid()
    )
  );
CREATE POLICY p_inspecciones_perito ON public.inspecciones_periciales
  FOR ALL TO authenticated USING (rol_actual() = 'PERITO');
CREATE POLICY p_inspecciones_admin ON public.inspecciones_periciales
  FOR SELECT TO authenticated USING (rol_actual() = 'ADMIN');
CREATE POLICY p_inspecciones_taller ON public.inspecciones_periciales
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordenes_trabajo ot
      JOIN public.talleres t ON t.id = ot.taller_id
      WHERE ot.siniestro_id = inspecciones_periciales.siniestro_id AND t.usuario_id = auth.uid()
    )
  );

-- evaluacion_detallada_danos: misma matriz, enlazada via inspeccion -> siniestro
CREATE POLICY p_evaluacion_asegurado ON public.evaluacion_detallada_danos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inspecciones_periciales ip
      JOIN public.siniestros s ON s.id = ip.siniestro_id
      WHERE ip.id = evaluacion_detallada_danos.inspeccion_id AND s.asegurado_id = auth.uid()
    )
  );
CREATE POLICY p_evaluacion_perito ON public.evaluacion_detallada_danos
  FOR ALL TO authenticated USING (rol_actual() = 'PERITO');
CREATE POLICY p_evaluacion_admin ON public.evaluacion_detallada_danos
  FOR SELECT TO authenticated USING (rol_actual() = 'ADMIN');
CREATE POLICY p_evaluacion_taller ON public.evaluacion_detallada_danos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inspecciones_periciales ip
      JOIN public.ordenes_trabajo ot ON ot.siniestro_id = ip.siniestro_id
      JOIN public.talleres t ON t.id = ot.taller_id
      WHERE ip.id = evaluacion_detallada_danos.inspeccion_id AND t.usuario_id = auth.uid()
    )
  );

-- ordenes_trabajo: ASEGURADO lee las de sus siniestros; PERITO/ADMIN leen todas;
-- TALLER CRUD de las suyas
CREATE POLICY p_ordenes_asegurado ON public.ordenes_trabajo
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.siniestros s
      WHERE s.id = ordenes_trabajo.siniestro_id AND s.asegurado_id = auth.uid()
    )
  );
CREATE POLICY p_ordenes_perito ON public.ordenes_trabajo
  FOR SELECT TO authenticated USING (rol_actual() = 'PERITO');
CREATE POLICY p_ordenes_admin ON public.ordenes_trabajo
  FOR SELECT TO authenticated USING (rol_actual() = 'ADMIN');
CREATE POLICY p_ordenes_taller ON public.ordenes_trabajo
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.talleres t
      WHERE t.id = ordenes_trabajo.taller_id AND t.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.talleres t
      WHERE t.id = ordenes_trabajo.taller_id AND t.usuario_id = auth.uid()
    )
  );

-- baremo_mock: lectura para todos los roles autenticados
CREATE POLICY p_baremo_select ON public.baremo_mock
  FOR SELECT TO authenticated USING (true);

-- audit_log: lectura para PERITO y ADMIN (inmutable por trigger)
CREATE POLICY p_audit_perito ON public.audit_log
  FOR SELECT TO authenticated USING (rol_actual() = 'PERITO');
CREATE POLICY p_audit_admin ON public.audit_log
  FOR SELECT TO authenticated USING (rol_actual() = 'ADMIN');

COMMIT;
