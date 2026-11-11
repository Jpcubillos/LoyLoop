# Activación y comprobación remota de LL-11

## Orden de despliegue

1. En el proyecto Supabase compartido, aplicar `supabase/migrations/202610290001_customer_identity.sql` desde SQL Editor o el flujo de migraciones del equipo. La migración crea una tabla protegida de vínculos y la RPC `ensure_loyloop_customer_identity`. No necesita la migración de avatar de 20261020.
2. Si se detiene por correos duplicados, revisar con `select lower(btrim(email)) as email_normalizado, count(*) from public.customer_profiles where email is not null group by 1 having count(*) > 1;`. Resolver cada caso preservando las relaciones de fidelidad; no borrar ni fusionar saldos automáticamente. Volver a aplicar la migración completa.
3. En Authentication → proveedores de email, mantener registro por correo/contraseña y confirmación de correo habilitados. Configurar un mínimo de contraseña de al menos 8 caracteres; la app también valida ese mínimo. Las reglas adicionales de Supabase siguen aplicando.
4. En Authentication → plantillas de correo, copiar `supabase/email-templates/confirm-signup.html` a **Confirm signup** y `supabase/email-templates/recovery.html` a **Reset password**. Ambas utilizan `{{ .Token }}`. Asuntos sugeridos: «Confirma tu cuenta de LoyLoop» y «Tu código para recuperar LoyLoop». La app acepta códigos numéricos de 6 a 10 dígitos. Mantener su longitud dentro de ese rango en Auth.
5. Comprobar SMTP, remitente, caducidad y límites de envío del proyecto. El proveedor por defecto puede restringir destinatarios; configurar SMTP para usuarios reales. No se incluyen claves SMTP ni contraseñas en este repo.
6. Publicar la app después del SQL y las plantillas. Mantener `EXPO_PUBLIC_DEMO_MODE=false` y las variables Supabase reales. Reiniciar Expo al cambiar variables. La recuperación por código no necesita un redirect de Expo Go.

## Comprobación manual con cuentas de prueba autorizadas

- Registrar un correo nuevo; recibir el código; confirmar; comprobar que puede acceder. El vínculo en `customer_identities` debe tener el ID de Auth y un único `customer_id`.
- Cerrar sesión, reiniciar la app y comprobar que no reaparecen datos de la cuenta. Iniciar sesión, reiniciar y comprobar restauración.
- Repetir registro con un correo existente: respuesta neutral, sin indicar existencia. Probar contraseña incorrecta y correo inexistente: mismo mensaje de acceso.
- Solicitar recuperación con correo existente e inexistente: misma respuesta. Verificar recepción real solo donde corresponda.
- Probar código incorrecto/vencido: no cambia contraseña. Con un código válido, guardar nueva contraseña y volver al acceso sin una sesión de recuperación persistida. Verificar contraseña nueva y rechazo de la anterior.
- Iniciar desde dos dispositivos para el mismo usuario: mismo perfil y saldos existentes, sin duplicados.
- Comprobar SecureStore, restauración y renovación al regresar del segundo plano en iOS/Android; el navegador no cubre almacenamiento nativo.

Las pruebas automatizadas locales no envían correos ni modifican la base remota. No marcar esta lista como verificada hasta ejecutarla contra el proyecto real. El endurecimiento de políticas heredadas de fidelidad y el backend de reclamos sigue en LL-96/LL-12; esta entrega protege específicamente la nueva tabla de identidad.

## Referencias técnicas

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [Supabase: autenticación por contraseña](https://supabase.com/docs/guides/auth/passwords)
- [Supabase: verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp)
- [Supabase: resetPasswordForEmail](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)
- [Supabase: React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native)
