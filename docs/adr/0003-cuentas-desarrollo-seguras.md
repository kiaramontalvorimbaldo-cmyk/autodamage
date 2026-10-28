# Cuentas de desarrollo: plan y compensación por cuenta

Contexto: el seed anterior seguía ante errores de asignación de rol o ficha y podía dejar cuentas incompletas, además de actualizar roles de cuentas existentes. El usuario mantiene el trabajo solo local.

Decisión: el comando sin argumentos y --plan solo muestran el plan, sin abrir conexiones. --apply valida las cinco configuraciones antes de escribir. El caso de uso reutiliza una cuenta existente únicamente si coincide el rol y tiene ficha; nunca la modifica ni la borra. Una cuenta nueva se compensa eliminando su alta de Auth si falla la asignación de rol o ficha. Se comprueban errores y filas actualizadas y se pagina la búsqueda de usuarios. Un error detiene el proceso con código distinto de cero; no se anuncian éxitos parciales como un lote completado. No se imprimen contraseñas ni detalles internos.

Consecuencias: la compensación es por cuenta, no una transacción de todo el lote entre Auth y Postgres. Si falla la eliminación compensatoria se informa explícitamente y se requiere revisar el correo antes de reintentar. No se restablecen contraseñas de cuentas existentes. Las pruebas usan dobles en memoria y no crean usuarios reales. Estos cambios no cierran por sí solos el Sprint 1.
