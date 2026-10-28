BEGIN;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.usuarios,
  public.vehiculos,
  public.peritos,
  public.talleres,
  public.baremo_mock,
  public.siniestros,
  public.imagenes_siniestro,
  public.inspecciones_periciales,
  public.evaluacion_detallada_danos,
  public.ordenes_trabajo,
  public.audit_log
TO authenticated;

GRANT ALL PRIVILEGES ON TABLE
  public.usuarios,
  public.vehiculos,
  public.peritos,
  public.talleres,
  public.baremo_mock,
  public.siniestros,
  public.imagenes_siniestro,
  public.inspecciones_periciales,
  public.evaluacion_detallada_danos,
  public.ordenes_trabajo,
  public.audit_log
TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.baremo_mock_id_seq TO service_role;
GRANT EXECUTE ON FUNCTION public.rol_actual() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ping() TO authenticated, service_role;

COMMIT;
