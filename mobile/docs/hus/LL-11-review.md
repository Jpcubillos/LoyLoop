# Revisión LL-11 según la HU actual — 2026-11-17

Fuente: historia y tres subtareas compartidas por el usuario en esta conversación. Revisión de código actual, no solo de documentos históricos. No se modificó la app, Auth ni la base remota. No se enviaron correos. Comprobaciones repetidas: `npm test` (27/27) y `npm run typecheck` correctos desde mobile/. Las pruebas de Auth y transporte usan mocks; la prueba PGlite de identidad ejecuta SQL histórico, no sustituye los contratos Django actuales.

## Estado por subtarea

1. Modelo de identidad/sesiones: implementado sustancialmente. Supabase Auth administra la sesión, cliente de recuperación sin persistencia, SecureStore para nativo y ciclo de renovación en primer plano. currentCustomerId llama POST /api/customer-identity/ con el JWT; Django verifica la sesión mediante Supabase Auth, exige confirmación, usa ORM, transacción y bloqueos para idempotencia, y conserva perfiles existentes. LL-235/244 aportan migraciones y pruebas de aislamiento/concurrencia con permisos mínimos. Pendiente completar evidencia propia LL-11 sobre el flujo cliente/Auth/Django y persistencia nativa.

2. Pantallas de alta/acceso/recuperación: implementadas en login.tsx con estados internos, validaciones, confirmación/reenvío por OTP y mensajes neutros. Perfil permite cerrar sesión y useResource limpia resultados al cambiar de cuenta. Pendiente probar el flujo completo real, revisar capturas actuales y comprobar persistencia/cierre/segundo plano en dispositivo. No se necesita añadir QR o canje a esta HU.

3. Aceptación/integración: parcial. Hay pruebas automatizadas de reglas y errores, recuperación, almacenamiento simulado, transporte e identidad; los contratos backend aportan permisos/concurrencia. Falta ejecutar las pruebas móviles en CI, actualizar el smoke UI para Django y obtener evidencia real de registro/confirmación/recuperación.

## Pendientes concretos para completar

- CI: solo existe django-backend.yml; no ejecuta npm ci/test/typecheck de mobile ni el smoke de autenticación. Añadir el job móvil y exigir sus resultados para esta HU.
- Smoke UI obsoleto: auth-mobile-smoke.cjs:81 intercepta /rpc/ensure_loyloop_customer_identity; customer-identity.ts ahora llama /api/customer-identity/. Actualizar el transporte simulado y probar composición real de Auth con el adapter Django. Una respuesta simulada no demuestra correo ni proveedor remoto.
- Lecturas de negocio directas: loyloop-data.ts:191–226 consulta businesses, business_memberships, loyalty_events, rewards y campaigns vía Supabase. También existen lecturas de detalle. Aunque las escrituras ya migraron y el catálogo directo estaba admitido en la arquitectura previa, la HU nueva dice Supabase solo identidad/JWT y evitar acceso directo a tablas de negocio. Migrar los datos de negocio afectados a DRF; una excepción de catálogo público requeriría una aclaración explícita y no debe presumirse. Revisar el aislamiento de los datos personales del cliente, no solo filtrarlos en UI.
- Configuración remota sin confirmar: revisar confirmación email, política de contraseña, plantillas con Token, longitud/caducidad OTP y SMTP/remitente/límites. No se afirma que estén mal: falta verificación actual. No enviar mensajes a direcciones reales sin cuenta de pruebas autorizada.
- Recorrido real con cuenta de pruebas: alta nueva y confirmación; duplicado con respuesta neutra; login correcto/incorrecto/inexistente; cierre y reapertura; recuperación y código inválido/vencido; contraseña nueva válida y anterior rechazada; identidad única tras reintentos/concurrencia y conservación de beneficios existentes. Comprobar integración completa en cliente o panel, no solo solicitudes API.
- Dispositivo: SecureStore, reinicio, segundo plano/renovación, cambio de cuenta y ausencia de datos previos tras logout. Un test web o almacenamiento mock no acredita estas funciones nativas.
- Documentación: LL-11.md, LL-11-deployment.md y el párrafo histórico de contexto todavía indican aplicar SQL/RPC manual antiguos. Sustituir esa activación por migraciones Django y endpoints DRF; no reaplicar el SQL antiguo sobre el esquema adoptado. Incorporar la tercera subtarea y vincular resultados CI, capturas y evidencias reales a la historia. Jira no accesible en esta sesión.

## Conclusión

LL-11 no está completa conforme al Definition of Done recibido. No hace falta reconstruir todas las pantallas ni sustituir Supabase Auth. Se debe actualizar integración/CI/documentación y demostrar los flujos reales y nativos. Las implementaciones y evidencias de LL-235/LL-244 son dependencias útiles, pero no demuestran por sí mismas registro/OTP/recuperación en la app.
