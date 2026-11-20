# Contexto vigente de LoyLoop

Actualizado: 2026-11-17. Base para implementar historias de usuario sobre la app existente.

## Producto

LoyLoop conecta personas con comercios mediante fidelización. El recorrido esperado es descubrir → unirse → participar → progresar → desbloquear → reclamar → volver.

El cliente descubre comercios, se inscribe, participa en misiones/visitas/compras, completa sellos y obtiene beneficios. El comercio administra sus ofertas y valida reclamos desde el panel. El nivel global de la plataforma no se confunde con el nivel dentro de cada comercio.

## Repositorios y arquitectura

| Área | Ubicación | Responsabilidad |
| --- | --- | --- |
| Móvil | `mobile/` en el repositorio `LoyLoop` | Expo SDK 57, React Native, TypeScript, Expo Router, Supabase |
| Admin/backend | Raíz del repositorio | Panel web, acciones de ofertas, validación de reclamos, esquema SQL y aprobación de comercios |
| Django API (base local) | `backend/` en la raíz | Django/DRF, PostgreSQL Supabase, API de negocio y migraciones LL-235 |
| Base de datos | Supabase compartido | Comercios, perfiles, membresías, ofertas, progreso y reclamos |

El repositorio integrado usa `Jpcubillos/LoyLoop`; el historial anterior de `Jpcubillos/LoyLoopMobile` se preserva en la integración. Los despliegues web, móvil y Django siguen siendo independientes. El proyecto Supabase configurado anteriormente es `phvuowulzkrttgcfnvly`; verificar siempre el entorno antes de ejecutar SQL.

La arquitectura de LL-231 tiene su conexión y corte LL-235 aplicado al proyecto de pruebas existente: Django gestiona esquema y escrituras de negocio; Supabase aloja PostgreSQL, Auth y Storage. Ocho migraciones aplicadas; rol runtime mínimo separado del propietario; clientes sin escritura directa/RPC de negocio. El catálogo conserva lecturas Supabase. Docker local y el túnel temporal no actualizan el admin publicado: cada cliente requiere su despliegue/configuración. Evidencia: [LL-235](hus/LL-235.md).

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
| `src/lib/customer-identity.ts` | Perfil propio mediante API Django autenticada |
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
- En admin, `/dashboard/solicitudes` permite a una cuenta autorizada usar «Aprobar y publicar». Django aprueba y vincula el comercio de forma idempotente; la RPC histórica ya no permite escritura de clientes.
- La autorización para publicar se guarda en `platform_business_approvers`. Django comprueba UUID Auth y autorización global. Ser dueño de un comercio no implica autorización global para aprobar otros.
- Crear un comercio no acredita por sí solo que exista un panel multiempresa completo ni que la cuenta del solicitante haya sido aprovisionada. Revisar la selección de `business_id` del admin antes de una HU multiempresa: Django resuelve el comercio autorizado desde la cuenta; no conceder permisos mediante un slug fijo.

## Estado confirmado y pendientes

LL-232 aportó el bootstrap seguro. LL-235 añade conexión PostgreSQL/TLS/pooling, ocho migraciones de adopción, rol mínimo, API autenticada y consumidores sin escritura directa. Adopción remota verificada preservando datos, restore aislado de 51 tablas y CRUD con Auth real por HTTPS local. Ver [LL-235](hus/LL-235.md). LL-244 conserva su alcance separado de CI/observabilidad/despliegue/recuperación; no se declara cerrada por estas comprobaciones.

LL-11 integra alta/confirmación/acceso/cierre/recuperación en la app. Supabase Auth proporciona identidad/sesiones; customer-identity y las lecturas de negocio pasan por DRF. El esquema e identidad de negocio se gestionan mediante las migraciones Django LL-235: no reaplicar el SQL/RPC histórico de LL-11. SecureStore y cliente de recuperación no persistente se conservan. CI añade mobile-auth; 28 pruebas móviles y el recorrido visual con mocks pasaron localmente, además de PostgreSQL/roles/aislamiento. Falta completar aceptación con correo/OTP real y dispositivo antes de Listo; ver [LL-11](hus/LL-11.md) y [activación](hus/LL-11-deployment.md). No guardar correo, contraseña ni OTP de pruebas en este contexto.

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

## LL-235 y Docker — estado confirmado 2026-11-16

Django Docker ya opera sobre la base Supabase existente. Ocho migraciones aplicadas sin alterar valores originales; escrituras/RPC de negocio revocadas a clientes y consumidores migrados a API. HTTPS local y health/readiness públicos correctos; Auth real y CRUD de oferta inactiva verificados por HTTPS local. Pool remoto: 60 consultas concurrentes sin préstamos pendientes. Respaldo/restore aislado de public/auth/storage: 51 tablas coinciden por SHA-256. Secretos y artefactos privados en backend/.docker, fuera de Git. Ver [LL-235](hus/LL-235.md), [POSTGRES.md](../../backend/POSTGRES.md) y [DOCKER.md](../../backend/DOCKER.md).

El túnel temporal cambia de URL y necesita PC/Docker encendidos. El admin publicado y el dispositivo requieren sus propias configuraciones/despliegues; no se declara probado el recorrido autenticado por Cloudflare ni el dispositivo físico. LL-244 y Jira permanecen separados de la evidencia técnica local/remota de LL-235.

## LL-244 — evidencia vigente 2026-11-17

CI remoto con cinco jobs correctos y checks requeridos en main autorizados; observabilidad con actor/tenant/trace_id sin secretos; receptor de alertas independiente con caída/recuperación real de API y DB; despliegue inmutable, migración controlada, rollback compatible y restauración de 51 tablas con API operativa en staging Docker aislado. Ver [LL-244](hus/LL-244.md). Los párrafos anteriores que separaban LL-244 de la entrega LL-235 describen su alcance, no un pendiente que continúe sin verificar. No se declara hosting permanente, merge a main ni cierre Jira. Para reiniciar el staging recuperado se debe conservar el override privado de imagen/socket, según OPERATIONS.md.

## Cierre de hallazgos LL-235/LL-244 — 2026-11-17

API/CI prueban contratos con permisos loyloop_backend; staging usa login mínimo y credencial separada del mantenimiento. Verificados dos ciclos sobre el mismo socket y recuperación ante fallos reales controlados de migración/arranque. Estados privados por ejecución, imagen de rollback retenida antes del build. La auditoría y su resolución se conservan en docs/hus/LL-235-LL-244-review.md. No hay pendientes de esos tres hallazgos; merge/Jira/hosting permanente siguen siendo estados independientes.

## LL-238 — 2026-11-20

Django valida firma JWKS ES256/RS256 y claims exactos antes del control remoto de cuenta. HS256/none y claves de servicio no se aceptan como sesiones. Roles/tenant se resuelven en servidor y se conserva RLS con rol mínimo. Política explícita: JWT válido hasta exp, refresh revocado al logout; no revocación inmediata de access-token por suposición. Ver docs/hus/LL-238.md y backend/AUTH-API.md. Esta revisión necesita instalar las dependencias fijadas y desplegar la nueva imagen; no se declara activada en los contenedores anteriores.
