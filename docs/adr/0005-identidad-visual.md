# Identidad visual compartida

## Contexto

El usuario solicitó una interfaz con personalidad sin afectar los flujos existentes. La configuración de Tailwind no incluía todos los colores usados por los componentes y referenciaba valores HSL sin su función CSS.

## Decisión

Completar los tokens de color, adoptar azul noche y verde menta, reutilizar una marca compartida y una ilustración SVG local. Modificar los layouts y componentes visuales, manteniendo contratos, campos, rutas y lógica. Usar fuentes del sistema para evitar dependencias de red.

## Consecuencias

El acceso y los portales comparten identidad sin añadir paquetes ni servicios. La ilustración es decorativa y no contiene resultados reales. La portada de administración comunica que sus módulos siguen en preparación. La compilación de revisión se aísla mediante una opción de directorio para no reemplazar la salida del servidor que el usuario ya está ejecutando.
