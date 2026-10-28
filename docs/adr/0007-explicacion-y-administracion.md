# 0007 — Evidencia del análisis, personal y asignación de talleres

Fecha: 27 de octubre de 2026.

## Contexto

El usuario solicitó mostrar el fundamento del análisis, comprobar la asignación de su caso, habilitar administración, corregir ubicación y resolver el fallo al rechazar un siniestro.

## Decisión

- Presentar la respuesta de IA conservada: piezas, foto, confianza, severidad, indicios estructurales y motivo de recaptura. El prompt v1.2 solicita además `evidencia_visible` por pieza. Es opcional al leer para mantener compatibilidad histórica. No se reconstruyen explicaciones que no se guardaron ni se muestra razonamiento interno.
- Mantener diferenciados diagnóstico de IA, reglas del triaje, presupuesto del baremo y dictamen humano. Mostrar las razones originales del triaje en auditoría.
- Resolver la clave de `peritos.id` a partir de `peritos.usuario_id` antes de guardar el dictamen: el identificador de sesión no es la clave foránea de la inspección.
- Administración consulta datos mediante una API exclusiva de ADMIN con `no-store`; permite crear personal y activar/desactivar mediante los puertos existentes. Las pantallas indican límites de consulta y no modifican decisiones ni asignaciones.
- GPS reintenta sin alta precisión ante indisponibilidad o timeout; nunca reintenta una denegación. Existe selección manual en mapa, identificada como tal. Un mapa inicial no establece automáticamente la ubicación del siniestro.

## Consecuencias

No requiere migraciones. Los casos anteriores conservan sus resultados y su taller. Los nuevos análisis pueden incluir descripciones de evidencia visual; no garantizan autenticidad. La ubicación depende de permisos, disponibilidad del navegador y servicios del dispositivo.
