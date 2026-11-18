-- Permite que el exportador administrativo incluya el chat en el respaldo.
-- No concede acceso al cliente público ni permite modificar conversaciones.
GRANT SELECT ON TABLE public.mensajes_siniestro TO service_role;
NOTIFY pgrst, 'reload schema';
