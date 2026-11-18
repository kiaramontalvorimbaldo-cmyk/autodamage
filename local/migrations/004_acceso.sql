CREATE TABLE public.intentos_acceso (
  correo_hash CHAR(64) PRIMARY KEY,
  ventana TIMESTAMPTZ NOT NULL DEFAULT now(),
  intentos INTEGER NOT NULL DEFAULT 1 CHECK (intentos > 0)
);
