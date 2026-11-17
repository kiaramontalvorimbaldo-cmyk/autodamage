# language: es
@api @seguridad
Característica: Protección de las API sin una sesión válida
  La ausencia de sesión no permite consultar ni modificar expedientes o personal.

  Esquema del escenario: Acceso anónimo bloqueado antes de consultar datos
    Cuando envío <metodo> a "<ruta>" sin sesión
    Entonces la API responde con estado 401
    Y el código de error es "NO_AUTENTICADO"
    Y la respuesta incluye protección contra interpretación de contenido
    Ejemplos:
      | metodo | ruta                                                    |
      | GET    | /api/admin/resumen                                      |
      | POST   | /api/admin/personal                                     |
      | GET    | /api/siniestros                                         |
      | POST   | /api/siniestros                                         |
      | GET    | /api/vehiculos                                          |
      | POST   | /api/vehiculos                                          |
      | GET    | /api/ordenes                                            |
      | POST   | /api/siniestros/00000000-0000-4000-8000-000000000001/analizar |
