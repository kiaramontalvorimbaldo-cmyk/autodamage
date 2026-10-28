# Cuotas de la IA (Google AI Studio)

Modelo confirmado mediante la API y dos controles de imagen el 27/10/2026.
Las cuotas efectivas de esta cuenta aún deben leerse en AI Studio; no se infieren del éxito de dos llamadas.

| Dato                                         | Valor                                          |
| -------------------------------------------- | ---------------------------------------------- |
| Fecha de comprobación del modelo             | 27/10/2026 por API                             |
| Modelo (`GEMINI_MODEL`)                      | gemini-3.5-flash-lite                         |
| RPM (requests por minuto)                    | pendiente                                      |
| RPD (requests por día)                       | pendiente                                      |
| Tope interno diario (`DAILY_AI_QUOTA_LIMIT`) | 200 (escenario conservador)                    |
| Tope interno por minuto (`AI_MAX_RPM`)       | 10 (por instancia)                             |

## Notas

- Las cuotas se aplican **por proyecto**, no por clave, y Google las cambia
  con frecuencia.
- **No evadir cuotas:** no se crean múltiples proyectos o claves para
  multiplicar el límite (puede violar los términos de uso).
- **Privacidad:** en el nivel gratuito Google puede usar los datos enviados
  para mejorar sus productos; el MVP solo usa fotos de prueba/propias o de
  datasets públicos, nunca datos reales de clientes.
- **Degradación elegante:** si la cuota se agota o la IA falla, el siniestro
  pasa a `EN_REVISION` con la etiqueta `IA_NO_DISPONIBLE` y lo atiende un
  perito. El flujo nunca se bloquea.
