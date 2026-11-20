# Activación y aceptación de LL-11 con Django

## Orden de despliegue

1. Utilizar el esquema de negocio adoptado mediante las ocho migraciones Django de LL-235. No reaplicar supabase/migrations/202610290001_customer_identity.sql ni restaurar la RPC como alternativa: esos archivos son históricos.
2. Desplegar primero la API actual, incluidos customer-identity y discovery. Mantener runtime loyloop_backend separado del propietario de migraciones; el arranque no migra automáticamente. Confirmar health/readiness y pruebas de aislamiento.
3. Configurar las variables públicas de la app: URL/clave pública Supabase Auth, URL DRF y DEMO_MODE=false. Nunca incluir credenciales DB o service_role. Reiniciar/recompilar tras cambios. No reutilizar la configuración ficticia de CI para una prueba real.
4. En Supabase Auth comprobar correo/contraseña y confirmación habilitados, contraseña mínima y política vigentes, SMTP/remitente/límites, caducidad OTP y plantillas. La app espera código numérico de 6 a 10 dígitos; las plantillas de referencia usan {{ .Token }} en supabase/email-templates. La lectura pública de settings confirmó que el registro/email están habilitados y se exige confirmación; las plantillas/SMTP siguen sin verificación real.
5. Ejecutar CI móvil y backend; revisar los artefactos. El smoke automatizado simula Auth y DRF, y no demuestra recepción de correos.

## Prueba real preparada en PC

`python backend/scripts/run_local_runtime.py` inicia únicamente loopback 127.0.0.1:8001 con el secreto privado del rol mínimo y TLS hacia Supabase. No ejecuta migraciones. La app de pruebas reales está en http://localhost:8092/login, con la URL DRF loopback y las claves públicas reales cargadas solo en el proceso. No usar esa URL de API en un teléfono: localhost allí corresponde al propio teléfono.

El test simulado usa otro servidor (8091) y dominios ficticios. Mantener ambos separados. No enviar tokens de usuario mediante pruebas automatizadas al túnel Cloudflare: el recorrido operativo automatizado permanece en el origen local autorizado.

## Checklist con cuenta de pruebas autorizada

- Alta nueva y confirmación mediante correo recibido; identidad única en Django.
- Repetir registro existente: respuesta neutra, sin filtrar existencia.
- Acceso correcto; contraseña incorrecta y correo inexistente con mensaje equivalente.
- Logout, reapertura y ausencia de información de la sesión anterior.
- Recuperación existente/inexistente con respuesta neutra; código inválido/vencido no cambia contraseña.
- Código válido y contraseña nueva: retorno al acceso sin sesión de recuperación persistente; acceso con la nueva y rechazo de la anterior.
- Reintentar/bootstrap concurrente sin duplicar perfil o alterar beneficios.
- En teléfono: SecureStore/restauración, renovación al volver al primer plano y cambio de cuenta. Registrar plataforma/versión, pasos y resultado sin datos personales.

No marcar pasos como comprobados antes de realizarlos. QR/cámara/canje no se modifican en esta HU y no se añaden a este checklist como alcance nuevo. Si falta correo o acceso a dispositivo, mantener LL-11 abierta con ese pendiente explícito.
