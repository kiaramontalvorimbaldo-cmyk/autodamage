# Correcciones de análisis, ubicación, administración y dictamen

27 de octubre de 2026. Proyecto: `outputs/preparacion-sprint-1/proyecto`.

## Resultado

- Explicación del análisis visible en asegurado, perito y detalle administrativo, a partir de la respuesta realmente guardada. Gemini v1.2 solicita una descripción de evidencia visible por pieza para análisis nuevos; no se reanalizaron casos históricos.
- Perito ve el taller asignado y el estado de su orden. Las razones del triaje registradas aparecen en el historial, separadas de las observaciones de IA.
- Se corrigió el uso de la clave de usuario en `inspecciones_periciales.perito_id`: ahora se consulta el registro del perito y se escribe su identificador. El formulario conserva observaciones si falla el envío.
- Ubicación: mensajes específicos, búsqueda deshabilitada mientras está en curso, segundo intento con menor precisión ante errores del proveedor y selección manual sobre el mapa.
- Administración: consulta de casos y detalle con evidencias, historial de auditoría, listado de personal, creación de cuentas y activación/desactivación. Se corrigieron las llamadas que omitían inyectar `StaffRepository`. Contraseñas temporales generadas criptográficamente, mostradas solo en la respuesta de creación con `no-store`.

## Comprobaciones remotas de solo lectura

El caso `eca2b956-3ab3-4ad5-bcc6-045529503aff` tiene orden EMITIDA para **Taller Auditoría**. La cuenta `taller@demo.com` corresponde a **Taller El Freno Demo**, otro taller. Por eso no puede ver esa orden. No se reasignó ni se amplió acceso entre talleres.

Las seis consultas del panel respondieron correctamente: 8 usuarios, 2 peritos, 2 talleres, 6 casos, 2 órdenes y 13 eventos en el momento de la verificación. Los casos recientes permanecían EN_REVISION. No se registraron dictámenes reales, no se crearon usuarios ni se cambiaron estados para probar la interfaz.

## Validación

- 619 pruebas aprobadas; 3 de RLS remoto omitidas por la configuración de prueba.
- Lint, comprobación de tipos y compilación de producción aprobados.
- 24 pruebas públicas de navegador aprobadas. Comprobación autenticada de administración (casos, detalle, personal y auditoría) y explicación del perito, sin enviar dictámenes ni modificar cuentas.
- 76 archivos de cliente inspeccionados: sin valores privados de Gemini ni Supabase.
- Regresiones: clave del perito al rechazar, bloqueo de perito inactivo, conservación del formulario ante error, GPS alternativo, evidencia histórica, asignación visible, administración y autorización previa a consultar datos.
- Las pruebas de IA usan simulaciones; esta corrección no consumió llamadas de análisis real de Gemini.

## Para probar

Reiniciar el servidor local desde este proyecto y recargar la página. Abrir un caso en revisión como perito; revisar evidencias y registrar manualmente el dictamen deseado. La corrección no volvió a enviar el rechazo fallido del usuario. En ubicación, habilitar el permiso del navegador y del sistema; si el servicio no responde, seleccionar el lugar sobre el mapa.

No se aplicaron migraciones ni se desplegó en este trabajo.

Capturas de comprobación en `outputs/correcciones-admin-ubicacion/`: `personal.png` y `fundamento-ia.png`. La captura del análisis excluye fotografías personales.
