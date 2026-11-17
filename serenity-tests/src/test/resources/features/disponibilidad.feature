# language: es
@api @disponibilidad
Característica: Disponibilidad de AutoDamage y contratos HTTP
  Las solicitudes llegan a la aplicación Next.js real. La dependencia de datos se simula localmente.

  Escenario: Servicio disponible cuando la dependencia responde
    Dado que la dependencia de datos está disponible
    Cuando envío GET a "/api/health" sin sesión
    Entonces la API responde con estado 200
    Y el campo "status" es "ok"
    Y el campo "db" es "ok"
    Y la respuesta no permite almacenar el estado de salud
    Y la respuesta incluye protección contra interpretación de contenido

  Escenario: Servicio informa el fallo de su dependencia
    Dado que la dependencia de datos está indisponible
    Cuando envío GET a "/api/health" sin sesión
    Entonces la API responde con estado 503
    Y el campo "status" es "error"
    Y el campo "db" es "error"
    Y la respuesta no permite almacenar el estado de salud

  Esquema del escenario: Métodos no disponibles en rutas de autenticación
    Cuando envío GET a "<ruta>" sin sesión
    Entonces la API responde con estado 405
    Ejemplos:
      | ruta               |
      | /api/auth/login    |
      | /api/auth/registro |

  Escenario: Cierre de una sesión ausente sin alterar usuarios
    Cuando envío POST a "/api/auth/logout" sin sesión
    Entonces la API responde con estado 200
    Y el cierre de sesión es correcto
