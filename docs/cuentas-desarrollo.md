# Cuentas de desarrollo

El comando sin argumentos y npm run seed:users:plan muestran cinco cuentas propuestas y si falta su contraseña. No conectan con Supabase. Nunca imprimen contraseñas.

Configurar en .env.local DEV_ASEGURADO_PASSWORD, DEV_PERITO_PASSWORD, DEV_TALLER_1_PASSWORD, DEV_TALLER_2_PASSWORD y DEV_ADMIN_PASSWORD, con al menos ocho caracteres. Los correos se pueden cambiar con las variables DEV_*_EMAIL; no deben repetirse entre roles.

Solo al retomar la autorización de modificar desarrollo, ejecutar npm run seed:users:apply. Antes de crear la primera cuenta se valida toda la configuración. Cada cuenta nueva se registra primero en Auth, recibe su rol y, si corresponde, su ficha de perito o taller. Si falla un paso, se intenta revertir únicamente esa alta nueva. No es una transacción de todo el lote: las cuentas completadas antes de un error se conservan y un reintento las reconoce.

Las cuentas existentes no se cambian ni se borran. Si ya existe el correo pero falta la ficha o el rol difiere, el proceso se detiene para revisión. Si falla la reversión de una cuenta nueva se informa explícitamente; revisar ese correo antes de reintentar. Un fallo impide anunciar el lote como completado.

La búsqueda pagina los resultados de Auth: no se limita a las primeras doscientas cuentas. Todas las operaciones de asignación y ficha comprueban el resultado. El adaptador de Supabase se prueba con dobles; las pruebas del comando real sustituyen los adaptadores para no crear usuarios.

En esta sesión no se ejecutó --apply. El lanzamiento de --plan con tsx quedó bloqueado por uv_os_get_passwd en el entorno aislado de Windows; se verificó el flujo del mismo script mediante Vitest, incluidos plan por defecto, configuración incompleta, apply con adaptadores falsos, reversión y opciones inválidas. Falta comprobar el lanzamiento desde una terminal local normal y la creación real cuando se autorice.

Verificación de esta continuación: 53 pruebas nuevas, 521 aprobadas en el conjunto completo y tres de integración remota omitidas. Lint, tipos, cobertura y build verificados; las cuentas reales no se crearon.
