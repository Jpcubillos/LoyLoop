# Frontera de API autenticada — avance de LL-235

La API está activada en Docker y el esquema de pruebas existente ya fue adoptado. Los clientes de negocio usan Django; las escrituras/RPC directas de clientes están revocadas. Estado y evidencia vigentes en [LL-235](../mobile/docs/hus/LL-235.md).

## Identidad y permisos

Las peticiones usan `Authorization: Bearer <access token>` de Supabase Auth. Django valida la sesion con `GET /auth/v1/user` del proyecto configurado mediante HTTPS, con tiempo de espera, respuesta limitada y sin seguir redirecciones. Soporta las claves de firma del proyecto sin copiar su secreto JWT al backend. Requiere email confirmado; los datos editables de `user_metadata` solo pueden aportar el nombre visible, nunca roles o comercios.

Configurar en el secreto privado `SUPABASE_AUTH_URL=https://<proyecto>.supabase.co/auth/v1` y `SUPABASE_PUBLISHABLE_KEY` (clave publica del mismo proyecto). Nunca una clave service_role en los clientes. Fallos de sesion devuelven 401; indisponibilidad del proveedor devuelve 503 sin exponer su respuesta ni el token.

`AppUser.auth_user_id` vincula permisos a UUID Auth estable. Los registros heredados de equipo sin vincular no conceden permisos por coincidencia de correo. Una migracion de datos vincula solo coincidencias inequivocas con Auth confirmado y se detiene ante ambiguedades. No cambia roles, membresias ni saldos. Las cuentas inactivas no obtienen acceso. Los roles se leen del servidor y se aplican al comercio solicitado.

## Rutas preparadas

- `GET /api/session/`: identidad y perfil propio; no crea privilegios.
- `POST /api/customer-identity/`, cuerpo vacio: crea o adopta el perfil propio y conserva su ID/saldos; serializa peticiones concurrentes con locks transaccionales.
- `GET/POST /api/businesses/<uuid>/{rewards,missions,campaigns}/`.
- `GET/PATCH/DELETE /api/businesses/<uuid>/{rewards,missions,campaigns}/<uuid>/`.

Gestionar ofertas exige owner/manager del comercio. Cashier no puede administrarlas. Una peticion no puede cambiar el comercio, ID o columnas no admitidas de un registro; los accesos a IDs de otro comercio se rechazan. La auditoria de una escritura exitosa se emite despues del commit, con UUID de actor y tenant, sin token ni contenido del formulario.

## Rutas adicionales y evidencia

También están implementados equipo, configuración del comercio, solicitudes/aprobación autorizada, membresías, perfil propio, preparación/borrado de cuenta y QR/códigos de reclamos. Los permisos se verifican en servidor, y los reclamos se validan transaccionalmente una sola vez. Los puntos acumulan progreso y no se gastan al reclamar.

24 pruebas unitarias y suites PostgreSQL/API aisladas correctas; Auth se simula solamente en estas suites. La comprobación operativa separada usó Supabase Auth real y CRUD de oferta inactiva por HTTPS local, con denegación REST directa comprobada. Ver LL-235 para comandos, alcance y límites. Un recorrido nativo o admin publicado requiere despliegue propio y no se acredita con el bundle.

## HTTPS publico de pruebas

`python scripts/public_tunnel.py up` publica el origen Docker en una URL temporal `trycloudflare.com`, verificando tambien el certificado TLS local. `url` muestra la direccion; `down` detiene solo el tunel. No aplica migraciones, no activa la API ni modifica las variables del movil/admin. La URL puede cambiar al reiniciar y requiere mantener encendidos el PC, Docker y el tunel. Es para pruebas; una direccion estable requiere configurar un tunel persistente/dominio. No interpretar health200 como readiness: el script informa por separado si siguen pendientes las migraciones.
