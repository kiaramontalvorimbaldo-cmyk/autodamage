# Sprint 2: revisión local del análisis

Fecha: 20 de octubre de 2026.

El usuario indicó continuar el desarrollo local y posponer migraciones y despliegue. Esta indicación permite avanzar con el backend existente aunque el prerrequisito de cierre del Sprint 1 siga pendiente. No se considera cerrado ningún sprint por esta revisión.

## Corrección realizada

Al descartar códigos desconocidos del baremo, el cálculo de costos reducía la lista de piezas, pero la persistencia seguía consultando la confianza y bbox por posición en la lista original. Esto asociaba datos de otra detección. Ahora se usa la misma lista filtrada y el índice de imagen devuelto por el proveedor para conservar la evidencia de origen. Los códigos repetidos conservan sus metadatos por posición, sin usar una búsqueda por código que mezcle detecciones.

La prueba de regresión incluye un código desconocido inicial y dos detecciones del mismo código válido con coordenadas, confianza e imágenes distintas. Comprueba costos, etiqueta y asociaciones persistidas con adaptadores en memoria.

## Validación

- Pruebas del caso de uso: 19 aprobadas.
- Batería completa con cobertura: código de salida 0.
- ESLint y TypeScript: código de salida 0.
- No se llamó a Gemini ni se escribieron datos remotos.

## Trabajo pendiente

Revisar validación de coordenadas bbox e índices de imagen, concurrencia del análisis y compensación de subidas fallidas. Después verificar los contratos HTTP del Sprint 2 y los flujos de captura/perito/taller de los siguientes sprints. Las pruebas reales de Supabase, teléfonos, cuotas de IA, CI y despliegue continúan pendientes.

Compilación de producción: aprobada (código 0).
