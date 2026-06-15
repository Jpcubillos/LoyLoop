# LoyLoop Auth, Comercios y Roles Demo

Este archivo documenta el flujo de acceso de LoyLoop.

## Clave demo

Para pruebas puedes usar la misma clave en usuarios demo:

```txt
LoyLoopDemo2026!
```

## Login publico

La pantalla `/login` tiene tres modos:

| Modo | Uso |
| --- | --- |
| Cliente | Clientes nuevos o existentes crean cuenta/inician sesion |
| Equipo | Duenios, administradores y cajeros ya creados por el comercio |
| Comercio | Un nuevo duenio solicita activar su negocio |

Las solicitudes de nuevos comercios se guardan en `public.business_leads`.

## Equipo del comercio

Los trabajadores y administradores no se crean desde el login publico. El duenio los crea desde:

```txt
/dashboard/configuracion
```

Roles disponibles:

| Rol | Acceso esperado |
| --- | --- |
| owner | Control total del comercio |
| manager | Gestion de clientes, campanas, misiones y recompensas |
| cashier | Validacion de QR, sellos y redenciones |

Usuarios demo de comercio:

| Email | Rol |
| --- | --- |
| owner@loyloop.app | owner |
| manager@loyloop.app | manager |
| cajero@loyloop.app | cashier |

## Clientes demo

| Email | Segmento | Uso |
| --- | --- | --- |
| cliente.inactivo@loyloop.app | inactive | Campanas para recuperar clientes |
| cliente.riesgo@loyloop.app | at_risk | Campanas para clientes en riesgo |
| cliente.activo@loyloop.app | active | Cliente comun/frecuente |
| cliente.vip@loyloop.app | vip | Beneficios exclusivos |
| juan@loyloop.app | active | Cliente demo actual de Cafe Central |

## Como activarlos en Supabase Auth

El `seed.sql` crea perfiles, segmentos y roles en tablas publicas, pero Supabase Auth maneja sus propios usuarios. Para que el login con password funcione:

1. Ve a Supabase Dashboard.
2. Abre `Authentication > Users`.
3. Crea cada usuario demo con su email.
4. Asigna la clave `LoyLoopDemo2026!`.
5. Si tienes confirmacion de correo activada, marca el usuario como confirmado o desactiva temporalmente la confirmacion para pruebas.
6. Ejecuta `schema.sql` y luego `seed.sql`.

## Gestion dentro de LoyLoop

En la app:

```txt
/dashboard/configuracion
```

ahi puedes:

- Crear administradores y cajeros del comercio.
- Cambiar tipo de cuenta: comercio o cliente.
- Cambiar rol del comercio: owner, manager, cashier.
- Cambiar segmento del cliente: inactive, at_risk, active, vip.
- Cambiar estado activo/inactivo.

## Nota de arquitectura

Supabase Auth autentica el email/password. La tabla `public.app_users` define que puede hacer ese usuario dentro de LoyLoop.

En una siguiente fase conviene agregar proteccion real de rutas:

- `owner` y `manager`: pueden crear/editar/eliminar campanas y misiones.
- `cashier`: puede validar QR, pero no editar configuracion.
- `customer`: solo ve su app de cliente.
