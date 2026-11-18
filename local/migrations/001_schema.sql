CREATE TABLE public.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

ALTER TABLE public.usuarios ADD COLUMN activo BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX usuarios_email_normalizado ON public.usuarios(lower(email));
CREATE TABLE public.credenciales (usuario_id UUID PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE, password_hash TEXT NOT NULL, actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE public.sesiones (token_hash CHAR(64) PRIMARY KEY, usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE, expira_en TIMESTAMPTZ NOT NULL, creado_en TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX sesiones_usuario ON public.sesiones(usuario_id);
CREATE INDEX sesiones_expiracion ON public.sesiones(expira_en);
CREATE FUNCTION public.usuario_actual() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.usuario_id', true), '')::UUID $$;
CREATE FUNCTION public.rol_actual() RETURNS VARCHAR(20) LANGUAGE sql STABLE AS $$ SELECT rol::VARCHAR(20) FROM public.usuarios WHERE id=public.usuario_actual() AND activo $$;
-- Migración 003: Añadir columna creado_en a vehiculos
ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ DEFAULT now();

