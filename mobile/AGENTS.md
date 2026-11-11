# LoyLoop Mobile — instrucciones para agentes

## Contexto obligatorio

Antes de implementar una historia de usuario (HU), leer [docs/project-context.md](docs/project-context.md). Contiene el mapa del código, las decisiones del producto, la integración con admin y los límites conocidos.

Esta carpeta contiene la app móvil de fidelización de LoyLoop dentro del repositorio compartido. El panel admin y el backend de reclamos Next.js están en la raíz (`..`); la base Django está en `../backend`. Usan el mismo proyecto Supabase cuando las variables locales/de despliegue están configuradas para ello. Revisar el estado actual del código y de Git: los documentos históricos no son evidencia de que una funcionalidad esté terminada o desplegada.

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code. El proyecto usa Expo SDK 57, React Native, TypeScript y Expo Router. Mantener las dependencias compatibles con ese SDK.

## Cómo abordar una HU

1. Leer la HU y sus criterios de aceptación; identificar actores, estados, permisos, datos y rutas afectadas.
2. Inspeccionar los componentes, loaders, contratos del backend y tablas existentes antes de crear equivalentes.
3. Implementar sobre la arquitectura útil actual. Reutilizar componentes y variantes; evitar duplicar pantallas, lógica o datos.
4. Si hacen falta cambios en admin/backend o SQL, indicarlos y mantener cada cambio en su repositorio correspondiente. Una migración guardada no equivale a una migración aplicada.
5. Verificar los criterios de aceptación con comprobaciones adecuadas al cambio. Informar qué se comprobó y qué depende de un dispositivo, cuenta real o despliegue.
6. Actualizar `docs/project-context.md` cuando cambie una decisión vigente, contrato o pendiente. Registrar solo estados confirmados; no guardar credenciales ni datos personales.

Resolver decisiones rutinarias con el contexto disponible. Pedir aclaración cuando falte una regla de negocio que afecte al resultado; no inventar criterios de aceptación, permisos o contratos.

## Pruebas y criterios de terminado

Cada HU, corrección o cambio debe tener una verificación proporcional a su riesgo. Relacionar los criterios de aceptación con las comprobaciones que los demuestran antes de implementar. Reutilizar las pruebas existentes y añadir solo las necesarias para cubrir comportamientos nuevos o riesgos concretos.

- **Lógica:** probar reglas de negocio, validaciones y casos límite con pruebas unitarias. En una corrección, reproducir el fallo y añadir una prueba de regresión cuando aporte protección útil.
- **Datos e integración:** comprobar contratos, persistencia, errores y estados vacíos. Para SQL/RPC/RLS, verificar permisos positivos y negativos, aislamiento entre usuarios y conservación de datos; probar idempotencia cuando corresponda. Usar entornos aislados y datos de prueba, sin modificar producción ni enviar correos reales por defecto.
- **Interfaz:** revisar las pantallas modificadas contra Figma o la referencia aprobada, mediante capturas actuales. Comprobar tamaños de pantalla relevantes, legibilidad, estados, etiquetas accesibles, teclado y acciones. Las comprobaciones automáticas de layout no sustituyen la revisión visual.
- **Flujos:** recorrer el camino principal y los fallos relevantes: visitante/miembro, permiso denegado, sesión vencida, reintentos o conectividad, según el cambio. Reservar las pruebas completas de interacción para recorridos que necesiten comprobar varias partes juntas.
- **Nativo:** comprobar en dispositivo o emulador las funciones dependientes de cámara, permisos, SecureStore, enlaces y ciclo de vida cuando resulten afectadas. Una prueba web o un bundle correcto no demuestra comportamiento nativo.
- **Comprobaciones técnicas:** ejecutar TypeScript y las suites afectadas para cambios de código. Verificar los bundles afectados cuando cambien dependencias, configuración, navegación o integración nativa. Para documentación, verificar contenido, rutas y diferencias; no ejecutar suites de la app sin una razón concreta.

Las pruebas deben comprobar resultados observables y contratos, sin duplicar la implementación. Mantenerlas deterministas y aisladas, sin secretos, cuentas personales, esperas arbitrarias o dependencia innecesaria de servicios externos. Identificar claramente cuándo se usan mocks: una respuesta simulada no acredita que Supabase remoto, SMTP o un comercio real funcionen.

Después de cambiar código, ejecutar las comprobaciones afectadas y leer sus resultados completos. Corregir los fallos introducidos; distinguir los fallos previos y los bloqueos del entorno. No desactivar pruebas, relajar permisos ni cambiar expectativas solo para conseguir un resultado verde. Ampliar la verificación cuando exista un riesgo pendiente; detener comprobaciones redundantes una vez cubierto.

Registrar en `docs/hus/<id>.md` los criterios comprobados, comandos o pasos reproducibles, entorno, resultados, evidencia visual cuando aplique y pendientes. Añadir esa evidencia a la historia de Jira dentro del alcance autorizado. No incluir credenciales, tokens ni datos personales en capturas o informes.

**Una HU no está terminada solo porque compila o pasan pruebas con mocks.** Antes de cerrarla, confirmar sus criterios de aceptación y subtareas, documentar migraciones/configuración/despliegues necesarios y completar las verificaciones exigidas por su alcance. Si falta acceso, un dispositivo o activación remota, entregar el trabajo realizado con el pendiente explícito y mantener la HU abierta hasta comprobarlo. No declarar «probado», «aplicado», «desplegado» o «terminado» sin evidencia correspondiente.

## Reglas del producto que deben conservarse

- Navegación principal: Inicio, Comercios, Beneficios y Perfil. QR es una acción rápida central que abre el escáner.
- Inicio es un único scroll. Mis comercios/Explorar y los tabs de Beneficios son estados internos, no nuevas entradas del navbar.
- El detalle de comercio comparte pantalla entre visitante y miembro, según membresía. Los sellos se despliegan dentro de la card de progreso.
- LoyLevel global y nivel/puntos de cada comercio son conceptos separados. Los puntos de fidelidad del comercio acumulan progreso y no se gastan.
- Beneficio disponible, promoción temporal y recompensa por condición conservan sus diferencias.
- Reclamar genera QR y código alternativo; el éxito requiere validación real del comercio. No simular aprobación ni guardar un cupón para después.
- Supabase es la fuente persistente de datos reales. Una lista vacía o un error no se sustituye por datos demo.
- La demo solo se activa explícitamente con `EXPO_PUBLIC_DEMO_MODE=true`. No adjudicar puntos, niveles, beneficios o permisos inventados a cuentas reales.

## Sistema visual

Figma es la referencia visual principal; conservar las mejoras de coherencia aprobadas por el usuario. Archivo: `UITegQ7U4n3fBriaUnLZZE`, tablero principal `528:2009`.

- Reutilizar tokens de `src/constants/loyloop.ts`, componentes de `src/components/ui/loyloop.tsx` y variantes existentes.
- Inter 400/500/600/700; coral base `#FF6B6B`, CTA coral/rosa, texto azul muy oscuro y secundarios gris azulado.
- El usuario eligió `#FA4059` para el destacado de 15% de descuento; evitar el rosa fluorescente anterior.
- Beneficios conserva la card desplegable de nivel con banner dorado premium y corona. Inicio tiene su propia presentación de beneficios de nivel: no sustituir ambas por el mismo diseño sin que la HU lo pida.
- Reutilizar `PremiumIcon`, assets existentes e iconos funcionales coherentes; mantener radios, alturas, sombras y jerarquía consistentes.

## Datos y seguridad

- Variables documentadas en `.env.example`; los archivos `.env` locales y credenciales no se publican.
- Nunca incluir `service_role` ni credenciales administrativas en la app o en variables `EXPO_PUBLIC_*`.
- Comprobar autorización en backend/RLS/RPC, además de los estados visuales. No ampliar permisos para ocultar un error.
- Conservar estados de carga, vacío, error, visitante, miembro y oferta bloqueada según corresponda.
- No asumir Realtime: la implementación actual recarga datos al enfocar la pantalla mediante `useResource`.
