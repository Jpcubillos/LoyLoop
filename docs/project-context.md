# Contexto vigente de LoyLoop

Actualizado: 2026-11-08. Base para implementar historias de usuario sobre la app existente.

## Producto

LoyLoop conecta personas con comercios mediante fidelización. El recorrido esperado es descubrir → unirse → participar → progresar → desbloquear → reclamar → volver.

El cliente descubre comercios, se inscribe, participa en misiones/visitas/compras, completa sellos y obtiene beneficios. El comercio administra sus ofertas y valida reclamos desde el panel. El nivel global de la plataforma no se confunde con el nivel dentro de cada comercio.

## Repositorios y arquitectura

| Área | Ubicación | Responsabilidad |
| --- | --- | --- |
| Móvil | Este repositorio, `LoyLoopMobile` | Expo SDK 57, React Native, TypeScript, Expo Router, Supabase |
| Admin/backend | `../LoyLoop` | Panel web, acciones de ofertas, validación de reclamos, esquema SQL y aprobación de comercios |
| Django API (base local) | `backend/` en este workspace | Bootstrap independiente LL-232; todavía sin conexión a PostgreSQL ni endpoints de negocio |
| Base de datos | Supabase compartido | Comercios, perfiles, membresías, ofertas, progreso y reclamos |

Remotos: `Jpcubillos/LoyLoopMobile` y `Jpcubillos/LoyLoop`. Son repositorios independientes: commits y despliegues se gestionan por separado. El proyecto Supabase configurado durante esta entrega es `phvuowulzkrttgcfnvly`; verificar siempre el entorno antes de ejecutar SQL.

La decisión objetivo de la épica Jira **LL-231** es Django/DRF como API y dueño de la lógica/esquema de negocio, PostgreSQL alojado en Supabase y Supabase Auth para identidad. La migración es progresiva: en el estado actual, móvil y admin todavía usan las integraciones existentes descritas abajo; el bootstrap Django de LL-232 no las reemplaza ni se conecta todavía a Supabase. LL-235 cubre la conexión y gestión del esquema PostgreSQL. No presentar la arquitectura objetivo como ya desplegada.

## Mapa del código móvil

| Ruta/archivo | Uso |
| --- | --- |
| `src/app/_layout.tsx` | Stack, fuentes Inter, safe areas, apariencia y escáner modal |
| `src/app/index.tsx` | Inicio, un solo scroll con secciones de descubrimiento |
| `src/app/comercios.tsx` | Mis comercios y Explorar dentro de la misma sección |
| `src/app/comercio/[slug].tsx` | Detalle dinámico de visitante/miembro |
| `src/app/recompensas.tsx` | Sección principal Beneficios y tabs internos; el nombre de archivo es histórico |
| `src/app/beneficio.tsx` | Detalle secundario de una oferta |
| `src/app/escanear.tsx` | Escáner QR |
| `src/app/perfil.tsx` | LoyLevel global, cuenta y ayuda |
| `src/app/informacion-personal.tsx` | Edición de datos personales |
| `src/lib/loyloop-data.ts` | Loaders, mapeo de datos reales y ruta demo explícita |
| `src/lib/loyalty-rules.ts` | Reglas compartidas de elegibilidad y vigencia |
| `src/lib/claims.ts`, `claim-status.ts` | Contrato y estados de reclamos |
| `src/lib/profile.ts`, `auth.ts`, `supabase.ts` | Perfil, autenticación y cliente Supabase |
| `src/lib/auth-service.ts`, `auth-rules.ts` | Registro, confirmación, acceso y recuperación por OTP; mensajes seguros |
| `src/lib/customer-identity.ts` | Perfil propio mediante RPC de identidad verificada |
| `src/lib/secure-session-storage.ts`, `src/components/SessionLifecycle.tsx` | Sesión nativa en SecureStore y renovación en primer plano |
| `src/hooks/use-resource.ts` | Carga, error y recarga al enfocar; evita respuestas obsoletas |
| `src/components/ui/loyloop.tsx` | Primitivas del sistema visual |
| `src/constants/loyloop.ts` | Tokens del producto |

Componentes existentes a inspeccionar antes de crear nuevos: `CommerceCard`, `CommerceControls`, `CommerceHero`, `RewardCard`, `LevelBenefitCard`, `MembershipProgressCard`, `StampCard`, `QRClaimCard`, `ScanQrCta`, `PremiumIcon`, `BottomTabs` y `AppearanceProvider`.

## Navegación y comportamiento acordado

- Cuatro secciones: Inicio, Comercios, Beneficios, Perfil. El QR central es una acción rápida.
- Inicio contiene saludo, recomendaciones, CTA de unirse por QR, beneficios de nivel, tus comercios y descubrimiento, incluidos Destacados, En tendencia y Más beneficios. Respetar el orden del diseño correspondiente.
- Mis comercios y Explorar comparten pantalla con búsqueda, ordenación y sus estados internos.
- El visitante puede conocer ofertas y ventajas del comercio. Las acciones exclusivas requieren unirse; después se actualiza el mismo detalle.
- El miembro ve nivel y puntos de ese comercio, progreso, sellos, ofertas, misiones y ubicaciones. Los sellos son un acordeón dentro del progreso.
- Beneficios agrega ofertas elegibles de comercios donde existe membresía y mantiene separados los beneficios globales.
- Perfil muestra nivel/XP global, beneficios globales e insignias; cuenta y ayuda. Información personal es una ruta secundaria.
- El reclamo sigue detalle → QR/código manual → validación del comercio → éxito. Un estado pendiente nunca se presenta como aprobado.

## Integración de datos existente

Tablas relevantes: `businesses`, `business_leads`, `customer_profiles`, `app_users`, `business_memberships`, `rewards`, `campaigns`, `missions`, progreso de misiones, `stamp_cards`, `claim_requests` y eventos de fidelidad. Consultar el esquema del admin y las migraciones antes de asumir columnas o relaciones.

- Admin guarda recompensas en `rewards`, promociones en `campaigns` y misiones en `missions`. Las escrituras deben mostrar errores; las lecturas vacías no se rellenan con demo.
- Móvil consulta datos reales y aplica disponibilidad, estado activo, fechas y segmento cuando corresponda. No introducir valores de fidelidad ficticios para cuentas reales.
- `useResource` vuelve a consultar al enfocar la pantalla. No hay sincronización Realtime ni garantía de actualización en segundo plano.
- El catálogo móvil lee `businesses`; el registro público de un comercio crea una solicitud en `business_leads`.
- En admin, `/dashboard/solicitudes` permite a una cuenta autorizada usar «Aprobar y publicar». La RPC `approve_business_lead` crea el comercio y vincula la solicitud mediante `business_id`; repetir la aprobación no debe duplicarlo.
- La autorización para publicar se guarda en `platform_business_approvers`. La RPC comprueba la cuenta autenticada. Ser dueño de un comercio no implica autorización global para aprobar otros.
- Crear un comercio no acredita por sí solo que exista un panel multiempresa completo ni que la cuenta del solicitante haya sido aprovisionada. Revisar la selección de `business_id` del admin antes de una HU multiempresa: parte de la implementación conserva Café Central como comercio objetivo.

## Estado confirmado y pendientes

LL-232/LL-233/LL-234: se añadió en `backend/` un bootstrap Django/DRF independiente con settings local/producción, variables explícitas para clave, hosts, CORS y TLS, `GET /health/` de vida, pruebas y workflow de CI. El healthcheck no comprueba la base de datos. SQLite se usa solo en local; producción usa un motor dummy hasta LL-235. No hay endpoints de negocio, verificación JWT, despliegue ni conexión real a Supabase en esta entrega. Detalles y evidencia: [LL-232](hus/LL-232.md) y [README del backend](../backend/README.md).

LL-11 (LL-39 y LL-40) tiene implementación local de registro, confirmación por código, acceso/cierre y recuperación por código. La identidad nueva se vincula por `auth.users.id` a través de `customer_identities` y `ensure_loyloop_customer_identity`, sin recrear perfiles históricos. La recuperación usa un cliente sin persistencia; la sesión normal nativa se guarda en SecureStore. Las consultas limpian datos al reenfocar o cambiar de cuenta y el modo demo ahora requiere activación explícita.

**Antes de activar LL-11:** aplicar `supabase/migrations/202610290001_customer_identity.sql` y configurar las plantillas de confirmación/recuperación con `{{ .Token }}`. No se han aplicado/configurado remotamente en esta entrega. Ver [evidencia de la HU](hus/LL-11.md) y [activación](hus/LL-11-deployment.md). Las políticas demo heredadas de tablas de fidelidad y el contrato de reclamos requieren el refuerzo previsto en LL-96/LL-12; no confundir la RLS de la nueva tabla de identidad con protección completa del backend.

El 2026-10-21 se subieron a `main` los commits móvil `c9740c0` y admin `b0ffa2ce`. Son referencias históricas; consultar Git para conocer el estado actual.

La migración del admin `supabase/migrations/202610210001_approve_business_leads.sql` fue ejecutada por el usuario en Supabase. Compartió el resultado «Success. No rows returned» y confirmó **1 cuenta autorizada** en `platform_business_approvers`. No se comprobó una aprobación real completa ni la identidad de esa cuenta en esta conversación.

Pendientes que deben verificarse antes de una HU relacionada:

1. La aplicación remota de la migración móvil `supabase/migrations/202610200001_mobile_profile.sql` no está confirmada. Incluye funciones relacionadas con perfil/avatar, correo y eliminación de cuenta.
2. El contrato histórico de canje de sellos usa la tarjeta llamada exactamente `Cafe gratis con 10 sellos`. Revisar el backend antes de soportar tarjetas arbitrarias; se necesita un identificador adecuado en el contrato.
3. Recompensas independientes de puntos, crédito o productos pueden necesitar ampliar el backend para tener un canje real. La UI no debe inventar una operación compatible.
4. Los umbrales de progresión por puntos de cada comercio no estaban publicados por el esquema. No inferirlos desde ejemplos visuales.
5. LoyLevel global se lee de metadatos administrados por servidor en `auth.users.raw_app_meta_data.loylevel`, con campos como `xp`, `level`, `nextLevel`, `nextXp`, `badges` y `benefits`. No está confirmado un motor que calcule/actualice esos datos. No usar metadatos editables por el cliente para adjudicar progreso.
6. La gestión de beneficios globales desde admin, los documentos oficiales de términos/privacidad y el soporte multiempresa necesitan confirmar su alcance e implementación.
7. Cámara y permisos nativos, validación presencial de QR y flujo real de aprobación/publicación requieren verificación con los entornos y cuentas correspondientes. Un bundle o una prueba web no los demuestra.

## Referencias visuales y decisiones aprobadas

Figma: https://www.figma.com/design/UITegQ7U4n3fBriaUnLZZE/LoyLoop?node-id=528-2009

| Nodo | Referencia |
| --- | --- |
| `528:2009` | Tablero principal de pantallas nuevas |
| `19:937` | Inicio y cards de descubrimiento |
| `147:522` | Presentación de beneficios de nivel en Inicio |
| `429:2082` | Nivel desplegable y misiones en Beneficios |
| `221:1329` | CTA «Escanear QR del comercio» |

Los frames incluyen estados y posiciones del scroll; no son todos rutas independientes. La fidelidad visual incluye dimensiones, metadatos, badges, espaciados y jerarquía de cards. Los datos de ejemplo del Figma no se fijan en cuentas reales.

Se aprobaron Inter, sistema coral/rosa, iconos premium reutilizables y banner de nivel dorado con corona. El destacado de 15% usa `#FA4059`. Mantener la distinción entre la card de nivel de Inicio y la desplegable de Beneficios. Priorizar la coherencia global frente a imperfecciones puntuales del mockup.

## Entorno local y comprobaciones

Variables disponibles en `.env.example`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_LOYLOOP_API_URL` y `EXPO_PUBLIC_DEMO_MODE`. No guardar valores secretos en documentación ni commits.

- `npm start`: servidor Expo; teléfono y PC en la misma red para LAN. El túnel es una alternativa si la red impide la conexión.
- `npm run web`: vista web local. No sustituye una comprobación nativa.
- `npm run typecheck`: comprobación TypeScript.
- `npm test`: pruebas de fidelidad, autenticación, almacenamiento de sesión y migración de identidad en PostgreSQL aislado.
- `npm run test:mobile`: recorrido web existente; leer su configuración antes de ejecutarlo.
- `npm run test:auth:mobile`: recorrido de autenticación web con transporte simulado; requiere Expo en el puerto 8091 por defecto.

La demo requiere `EXPO_PUBLIC_DEMO_MODE=true`; para cuentas reales usar `false`. Verificar las variables del proceso y reiniciar Expo cuando cambien. Las comprobaciones históricas se describen en `mobile-ui-handoff.md`; no equivalen a resultados actuales.

## Registro de nuevas HUs

Seguir la política de pruebas y criterios de terminado de `AGENTS.md`. Registrar cada HU en `docs/hus/<id>.md`: identificación y objetivo, criterios de aceptación recibidos, pantallas/datos/permisos afectados, decisiones, cambios necesarios en ambos repos o SQL, comprobaciones reproducibles, entorno, resultados y pendientes. Distinguir pruebas simuladas, integración real, revisión visual y comprobaciones nativas. No marcar «aplicado», «desplegado» o «verificado» sin evidencia.

Este archivo reúne decisiones vigentes y límites conocidos. Los planes y especificaciones bajo `docs/superpowers/` conservan su carácter histórico; pueden describir un alcance anterior o tareas sin marcar aunque el código haya cambiado.
