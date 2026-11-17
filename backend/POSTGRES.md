# LL-235: PostgreSQL Supabase y esquema Django

Estado confirmado el 16 de noviembre de 2026 (evidencia UTC del 17): adopción aplicada al proyecto de pruebas existente, ocho migraciones registradas y API Docker operativa. Evidencia y límites en [LL-235](../mobile/docs/hus/LL-235.md).

## Propiedad y permisos

Django administra las 15 tablas de negocio mediante `loyalty/models.py` y `loyalty/migrations/`. Auth y Storage siguen administrados por Supabase; `auth.users` es una referencia externa no administrada. Los SQL históricos son referencia: no reaplicarlos ni usar `--fake`/`--fake-initial` para adoptar una base existente.

El rol de migraciones del archivo privado `backend/.env` es distinto de `loyloop_backend`, usado en Docker mediante `backend/.docker/runtime.env`. El runtime no es superusuario, no crea roles/bases/esquemas ni omite RLS. Tiene políticas específicas sobre las tablas de negocio y ejecución de funciones privadas de identidad/cierre de cuenta; no lectura general de Auth. `provision_backend_role --apply` aprovisiona esa frontera y guarda la credencial privada fuera de Git. La API de negocio en producción rechaza el rol propietario.

PUBLIC/anon/authenticated carecen de escritura directa de negocio, incluidos permisos por columna y ejecución de RPC de escritura SECURITY DEFINER. Las lecturas de catálogo existentes permanecen; los códigos de reclamos y UUID de autorización se consultan mediante API. Auth y Storage conservan sus propias operaciones. No poner contraseñas DB ni service_role en clientes.

## Conexión y pooling

Perfiles: `config.settings.postgres` carga `.env` sin interpolación y respeta variables del proceso; `postgres_production` exige secretos explícitos y TLS; `docker` carga el secreto montado; `postgres_ci` solo permite la base aislada `loyloop_ll235` en loopback. El bootstrap SQLite de LL-232 no es la base de negocio.

Variables: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_POOL_MODE` (session/transaction/direct), `DB_SSLMODE=verify-full`, `DB_SSLROOTCERT`, `DB_POOL_MAX_SIZE` (1–20), `DB_CONNECT_TIMEOUT` (1–60). Usar el hostname original del pooler Supabase y un CA confiable; no desactivar TLS. La contraseña PostgreSQL no es la clave API Supabase.

Pool Psycopg acotado por proceso, cola/espera limitadas, `CONN_MAX_AGE=0`, prepared statements automáticos desactivados y cursores de servidor desactivados en pooling transaccional. Presupuestar procesos × máximo y reservar conexiones administrativas. Docker usa dos procesos y máximo cinco conexiones por proceso; el rol runtime limita a 12. El sondeo de 60 consultas con ocho hilos acredita devolución de conexiones, no capacidad de producción.

## Arranque y comprobación

Desde la raíz del repositorio, con Docker Desktop iniciado y secretos/CA privados ya configurados:

```powershell
.\backend\.venv\Scripts\python.exe backend/scripts/docker.py up
.\backend\.venv\Scripts\python.exe backend/scripts/docker.py check
.\backend\.venv\Scripts\python.exe backend/scripts/docker.py database-check
.\backend\.venv\Scripts\python.exe backend/scripts/docker.py pool-check
.\backend\.venv\Scripts\python.exe backend/scripts/public_tunnel.py up
.\backend\.venv\Scripts\python.exe backend/scripts/public_tunnel.py url
```

`/health/` comprueba vida y `/ready/` conexión/migraciones. El arranque no migra automáticamente. El túnel cambia de URL al reiniciar y requiere PC/Docker encendidos. Actualizar `LOYLOOP_DJANGO_API_URL` en admin y `EXPO_PUBLIC_LOYLOOP_API_URL` en móvil; reiniciar/recompilar clientes. Las variables públicas solo contienen URL y clave pública Auth. El admin ya publicado requiere su propio despliegue/configuración; levantar Docker no lo actualiza.

## Adopción y recuperación

La adopción del proyecto existente ya se ejecutó; no repetirla como parte del arranque. Para otro entorno: inventariar esquema/roles, preparar consumidores API, respaldar con autorización y comprobar restore aislado. `adopt_business_schema --apply --expected-project <ref> --backup-evidence <ruta>` exige proyecto exacto, TLS, propietario de migración, respaldo reciente y ensayo Auth/adopción. Dentro de una transacción bloquea tablas, verifica huellas de columnas originales, aplica migraciones y confirma solo si conserva datos. El ensayo fuerza rollback completo de esquema/ACL/metadatos antes de verificar el commit.

Los dumps privados contienen datos sensibles de public/auth/storage: no publicarlos. La comprobación conservó 51 tablas por recuento y SHA-256. No incluye binarios Storage, configuración del proyecto ni roles globales; no es recuperación completa de Supabase. Después de nuevas escrituras, un restore debe planificarse para no perderlas. No revertir a clientes antiguos que intenten escribir directamente.

## Pruebas reproducibles

Desde `backend/`, instalar requirements y ejecutar `python -m unittest discover -s tests -v`. Para PostgreSQL aislado:

```powershell
docker run --detach --name loyloop-ll235-postgres --publish 127.0.0.1:55435:5432 --env POSTGRES_PASSWORD=isolated-ll235-only --env POSTGRES_DB=loyloop_ll235 postgres:17
$env:LL235_ISOLATED_DATABASE='yes'
$env:DB_PASSWORD='isolated-ll235-only'
python scripts/test_postgres.py
python scripts/test_api.py
```

Estas suites solo admiten esa base local y usan una fixture Auth/transporte simulado. Prueban migraciones reversibles, constraints, permisos, aislamiento, concurrencia, reclamos exactamente una vez y puntos no consumibles. `test_atomic_adoption.py` exige una copia restaurada aislada. `verify_live.py --use-configured-demo` es una comprobación operativa explícita con cuenta de pruebas configurada: autentica contra el proveedor, opera por HTTPS local con CA y crea/elimina una oferta inactiva. La URL pública solo recibe health/readiness sin credenciales. No ejecutarlo por defecto en CI ni sobre cuentas personales.
