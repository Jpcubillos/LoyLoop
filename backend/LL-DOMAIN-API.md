# LoyLoop — API DRF y servicios de dominio (HU infraestructura LL-231)

**Base inspeccionada:** monorepositorio del ZIP del 20 de noviembre de 2026, que contiene migraciones de `loyalty` 0001–0008 y la integración Supabase JWT/JWKS. **Entrega:** nueva migración `0009_domain_services`, servicios transaccionales, contratos `/api/v1/` y pruebas aisladas. No se alteran las HUs de producto ni las credenciales de Supabase.

## Reutilizado (no reimplementado)

- Supabase Auth/JWKS y la resolución de roles/tenants (`config.authentication`, `loyalty.access`), sin recibir IDs de actor ni roles del cliente.
- Migraciones 0001–0008 y fronteras RLS/rol de runtime PostgreSQL existentes; no se reconstruyen tablas del sistema de fidelización.
- Endpoints sin versión `/api/` para sesión, inscripción, perfiles, publicación de beneficios/misiones/campañas, staff, leads, cuenta y descubrimiento. Se mantiene la compatibilidad y **los canjes antiguos delegan en los mismos servicios** de la API nueva.

## Nuevo contrato `/api/v1/`

Todos los endpoints de negocio requieren JWT de Supabase y migración 0009 aplicada; los recursos comerciales también necesitan permiso por tenant, salvo las rutas de descubrimiento / alta pública heredadas. El prefijo HTTP de la aplicación es `/api/v1/` (no `/v1/`).

| Método / ruta | Actor | Contrato |
| --- | --- | --- |
| `GET session/` | Autenticado | Sesión y comercios habilitados (existente) |
| `GET/PATCH me/profile/` | Cliente | Nombre/teléfono, nunca identidad o correo arbitrarios |
| `GET me/memberships/` | Cliente | Membresías propias con puntos acumulados y nivel local |
| `GET me/points/` | Cliente | Puntos históricos locales y últimos 100 eventos propios |
| `GET me/stamps/` | Cliente | Tarjetas y ciclos terminados propios |
| `POST me/identity/` | Cliente | Alias de bootstrap existente |
| `GET businesses/` y `GET businesses/{id}/` | Autenticado | Catálogo público de comercios, sin datos administrativos |
| `GET businesses/{id}/memberships/` | Dueño/gerente | Clientes miembros de su tenant, máximo 100 |
| `POST businesses/{id}/activities/` | Dueño/gerente/cajero | Compra o actividad confirmada que acredita puntos/sellos, con `Idempotency-Key` |
| `GET businesses/{id}/activities/` | Dueño/gerente | Comprobantes de actividad, máximo 100 |
| `GET/POST businesses/{id}/stamps/` | Dueño/gerente | Consultar o crear tarjeta de sellos para una membresía propia |
| `POST identity/issue/` | Cliente | QR aleatorio y código numérico temporal para identificarse, 90 segundos |
| `POST businesses/{id}/identify/` | Dueño/gerente/cajero | Consumir identidad temporal una sola vez, en su comercio |
| `POST claims/` | Cliente | Emitir QR de canje; **requiere `Idempotency-Key`** |
| `GET claims/{code}/` | Cliente | Estado de su propio canje |
| `POST businesses/{id}/validate-claim/` | Dueño/gerente/cajero | Confirmación comercial por QR o código numérico, una sola vez |
| `GET plans/` | Autenticado | STARTER/GROWTH/PRO, sin precios inventados |
| `GET businesses/{id}/plan/` | Dueño/gerente o admin de plataforma | Asignación manual vigente (si existe) |
| `PUT businesses/{id}/plan/` | Admin plataforma | Asignar plan y estado manualmente; no cobra ni factura |
| `GET platform/overview/` | Admin plataforma | Contadores agregados internos |
| `businesses/{id}/rewards/, missions/, campaigns/` | Dueño/gerente | CRUD heredado de beneficios y campañas, ahora con límite opcional de redenciones |
| `businesses/{id}/staff/`, `segmentation/`; `platform/business-leads/` | Roles originales | Contratos administrativos heredados, sin reabrir privilegios |

### Ejemplo: actividad confirmada

`POST /api/v1/businesses/{business_uuid}/activities/`

```http
Authorization: Bearer <JWT>
Idempotency-Key: pos-order-20261120-0001
Content-Type: application/json
```

```json
{
  "membershipId": "00000000-0000-4000-8000-000000000001",
  "pointsAwarded": 12,
  "stampsAdded": 1,
  "stampCardId": "00000000-0000-4000-8000-000000000002",
  "reason": "Compra validada en caja"
}
```

- `201`: aplicada; `200`: reintento exacto, mismo comprobante; `409`: misma referencia con contenido distinto; `400`: datos inválidos; `403`: rol/tenant incorrectos; `404`: membresía/tarjeta no pertenecen al comercio.
- La referencia es única **por negocio**, no por usuario, y debe ser estable para el mismo evento POS. No introducir correo, teléfono ni datos bancarios en `reason`/clave.
- El backend valida que haya puntos o sellos, comprueba la pertenencia de tarjeta y cliente, bloquea la membresía y usa un `pg_advisory_xact_lock` por `business_id+reference`, una `UniqueConstraint`, `transaction.atomic` y actualizaciones `F()`. Ningún reintento produce una segunda acreditación. Los puntos históricos **nunca disminuyen** en canjes.

### QR y canjes

La emisión de `POST /api/v1/claims/` acepta los mismos `actionType`, `businessSlug`, `payload` existentes y requiere `Idempotency-Key` de 8–120 caracteres. Un reintento devuelve `200` y el **mismo código QR** (el numérico alternativo solo se devuelve en la primera emisión porque en DB queda su hash). `POST .../validate-claim/` consume ambos formatos, revalida la campaña/recompensa y sus cupos **en el momento de confirmar**, con bloqueo de fila. El canje no reduce `points_balance`; solo la aprobación del operador genera el evento y el registro único de redención. Una repetición devuelve `409`. El servidor conserva la transición a `expired` aunque responda 409.

`POST /api/v1/identity/issue/` recibe `{ "businessId": "..." }`, y el verificador recibe `{ "code": "..." }` en `POST /api/v1/businesses/{id}/identify/`. El token no contiene información personal; se almacenan hashes SHA-256 del QR y del código manual de 16 dígitos. Se consume una vez, vence a 90 segundos, se valida la membresía real y se limita la tasa (10/min por principal). **La identificación no representa un canje**.

### Planes

`PUT /api/v1/businesses/{id}/plan/` cuerpo `{ "planCode":"GROWTH", "status":"active" }`. Solamente un usuario de `platform_business_approvers` habilitado puede hacerlo. **No implica pago, alta de proveedor financiero, precio ni capacidad aprobada**: eso corresponde a la V1 de facturación. Las tres etiquetas de plan son la decisión de producto vigente.

### Límites y decisiones de producto conservadas

- `points_required` de un beneficio significa umbral de elegibilidad **y nunca costo en puntos**. Descuentos y productos son canjeables; las antiguas recompensas `credit`/`points` quedan fuera del flujo nuevo hasta definir reglas específicas, no se convierten silenciosamente en moneda.
- `redemption_limit` en recompensas y campañas es **opcional**; `NULL` significa sin límite configurado. Se revalida bajo bloqueo en la confirmación. No se inventaron condiciones de vencimiento, tarifas ni reglas comerciales.
- Las tarjetas existentes se mantienen; se agrega historial de ciclos completados. No se inventó un programa de puntos/tiers definitivo ni se migraron saldos previos: esa parametrización se completa en las HUs funcionales.
- El MVP solo implementa **asignación manual** de planes; no checkout automático.
- La limitación de tasa usa DRF/cache de Django. Para varias réplicas **configurar caché compartida Redis** antes de tráfico público. Las pruebas de concurrencia contra PostgreSQL siguen siendo necesarias.
- Los límites máximos de 100 resultados por ruta son una protección inicial, **no paginación completa**. Antes de un despliegue grande se necesita paginación estable.

## Migración y seguridad

Nueva migración: `loyalty/migrations/0009_domain_services.py`:

- Añade columnas nulas de idempotencia y código manual a `claim_requests`; `redemption_limit` (nullable) a campañas y recompensas.
- Crea **5 tablas** nuevas: `activity_receipts`, `identity_challenges`, `stamp_completions`, `business_plan_assignments`, `reward_redemptions`.
- Crea índices, restricciones únicas, un check de actividad no vacía y relaciones FK, más acciones FK compatibles con la función SQL existente de eliminación de cuenta.
- Habilita RLS para las tablas nuevas y revoca permisos de escritura/lectura de los roles cliente `anon`/`authenticated`. Si `loyloop_backend` existe en la instalación, le otorga únicamente CRUD de negocio bajo política; si no existe, ejecutar su aprovisionamiento/reconciliación posterior con el **proceso oficial** de LL-235. No usar claves de servicio en las apps.
- Las funciones de administración y los roles base se reutilizan; no se alteran claves JWT ni variables `SUPABASE_*`.

**Nunca aplicar este ZIP directamente sobre producción sin comparar con la rama actual del equipo**. El cambio de base de datos debe pasar por backup verificado, staging, `sqlmigrate`/`migrate --plan`, migración reversible probada y ventana de despliegue coordinada. Los endpoints nuevos fallan con 503 si 0009 no está aplicada. Los canjes existentes también quedan temporalmente no disponibles durante el corte hasta aplicar 0009: no desplegar código y migración por separado sin plan.

## Cómo validar

Desde PowerShell, después de descomprimir el ZIP en la raíz del monorepo:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:DJANGO_SETTINGS_MODULE = "config.settings.local"
$env:DJANGO_SECRET_KEY = (& .\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(64))")
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Prueba aislada **PostgreSQL solamente**, usando CI o el Docker efímero documentado en `POSTGRES.md` (nunca apuntar a Supabase):

```powershell
# Ejecutar solo con Postgres aislado en 127.0.0.1, base loyloop_ll235,
# LL235_ISOLATED_DATABASE=yes y DB_PASSWORD de ese contenedor.
.\.venv\Scripts\python.exe scripts/test_domain_api.py
```

En CI el workflow `.github/workflows/django-backend.yml` ya ejecuta el test después de `scripts/test_api.py`, de manera que el proceso realiza migraciones desde cero, checks de esquema, permisos, concurrencia, cupones duplicados, aislamiento y eliminación de cuentas **sobre un PostgreSQL temporal**. Este ZIP pasó revisión estática de sintaxis Python; la ejecución de Django/DRF y PostgreSQL real requiere tu instalación o CI y debe comprobarse antes de aprobar el PR.

## Integración frontend

Esta entrega **no edita `mobile/` ni Next.js**. Los endpoints antiguos se conservan; la nueva API está lista para ser consumida gradualmente por las HUs de integración del panel y la app. En las llamadas desde el cliente enviar el `Authorization: Bearer ...` de Supabase Auth, nunca una clave de base de datos. La información de cada negocio solo se obtiene de la identidad autenticada y su autorización en servidor.
