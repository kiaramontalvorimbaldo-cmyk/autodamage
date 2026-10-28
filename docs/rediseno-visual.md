# Identidad visual de AutoDamage AI

Fecha: 27 de octubre de 2026.

Trabajo aplicado en C:/Users/HP/Documents/Codex/2026-10-20/le/outputs/preparacion-sprint-1/proyecto, la copia que utiliza el usuario.

## Resultado

Acceso y registro con composición de dos paneles en escritorio, ilustración vectorial propia de vehículo, identidad azul noche/menta, formulario con superficies suaves, foco visible y adaptación móvil. Los portales comparten marca, navegación lateral oscura, cabecera y fondos claros. La portada de administración añade accesos visuales a sus rutas existentes y conserva la indicación de módulos en preparación; el cambio no completa sus funciones pendientes.

Se corrigió la configuración de Tailwind: las variables HSL necesitan hsl(var(...)); faltaban colores card, input, muted, accent, ring, popover y secondary. La corrección elimina colores y bordes de reserva no previstos. Se respetan las preferencias de movimiento reducido.

## Comprobaciones

- ESLint y TypeScript: aprobados.
- Batería completa: 588 pruebas aprobadas y tres remotas omitidas.
- Compilación de producción: aprobada.
- Playwright: 24 pruebas de acceso, validación, protección de rutas, CSP y PWA aprobadas sobre la nueva compilación, en escritorio y móvil emulado.
- Revisión visual en navegador: acceso de escritorio y móvil, inicio de sesión real con la cuenta demo de administrador y portada de administración. La revisión móvil no detectó desbordamiento horizontal.
- Capturas en outputs/rediseno: acceso-escritorio.png, acceso-movil.png, administracion-escritorio.png y administracion-movil.png.

No se modificaron APIs, validaciones de formularios, roles, esquema ni secretos. Las credenciales y la lógica del negocio conservan su comportamiento. No se aplicaron migraciones ni se desplegó.

## Archivos

tailwind.config.ts, src/app/globals.css, src/components/brand.tsx, src/components/auth/vehicle-illustration.tsx, src/app/(auth)/layout.tsx, src/components/layout/portal-shell.tsx, src/components/ui/button.tsx y src/app/(admin)/admin/page.tsx.

Para verificar sin interrumpir el servidor del usuario se añadió un directorio de compilación opcional mediante AUTODAMAGE_BUILD_DIR en next.config.ts. Su valor por defecto sigue siendo .next. La salida de revisión .next-design está ignorada y Next añadió sus tipos al tsconfig. La vista previa revisada funciona en el puerto 3012. El servidor de desarrollo habitual puede requerir reiniciarse para cargar los cambios de configuración de Tailwind.
