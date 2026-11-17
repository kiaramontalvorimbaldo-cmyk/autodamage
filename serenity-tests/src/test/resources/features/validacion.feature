# language: es
@api @validacion
Característica: Validación de solicitudes de autenticación
  Se usan valores ficticios. No se crean cuentas ni se utiliza el servicio de autenticación real.

  Esquema del escenario: Rechazo de datos de acceso inválidos
    Cuando envío POST a "/api/auth/login" con este contenido
      """
      <contenido>
      """
    Entonces la API responde con estado 400
    Y el código de error es "VALIDACION_ERROR"
    Ejemplos:
      | contenido                                            |
      | {}                                                   |
      | {"email":"invalido","password":"prueba123"}          |
      | {"email":"prueba@example.test","password":""}        |
      | {"email":"prueba@example.test","password":"123"}     |

  Esquema del escenario: JSON malformado no provoca un error interno
    Cuando envío POST a "<ruta>" con este contenido
      """
      {"email":
      """
    Entonces la API responde con estado 400
    Y el código de error es "BODY_INVALIDO"
    Ejemplos:
      | ruta               |
      | /api/auth/login    |
      | /api/auth/registro |

  Esquema del escenario: Registro incompleto o inválido no crea cuentas
    Cuando envío POST a "/api/auth/registro" con este contenido
      """
      <contenido>
      """
    Entonces la API responde con estado 400
    Y el código de error es "VALIDACION_ERROR"
    Ejemplos:
      | contenido                                                                              |
      | {}                                                                                     |
      | {"nombreCompleto":"A","email":"prueba@example.test","password":"prueba123"}             |
      | {"nombreCompleto":"Ana Prueba","email":"incorrecto","password":"prueba123"}             |

  Escenario: Credenciales rechazadas por la dependencia simulada
    Cuando envío POST a "/api/auth/login" con este contenido
      """
      {"email":"inexistente@example.test","password":"ficticia123"}
      """
    Entonces la API responde con estado 401
    Y el código de error es "CREDENCIALES_INVALIDAS"
