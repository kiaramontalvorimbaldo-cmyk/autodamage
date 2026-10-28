-- Migración 003: Añadir columna creado_en a vehiculos
ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ DEFAULT now();
