# LL-244 — operación y recuperación en staging Docker

Estado verificado: 2026-11-17. Staging es un entorno Docker aislado en este PC, separado de la base de negocio Supabase. No se presenta como hosting permanente ni alta disponibilidad. La evidencia está en [LL-244](../mobile/docs/hus/LL-244.md).

## CI y bloqueo de fallos

`.github/workflows/django-backend.yml` se ejecuta en cada push/PR y manualmente, sin filtros de rutas que dejarían checks obligatorios pendientes. Jobs: `verify (3.11)`, `verify (3.12)`, `postgres`, `docker`, `monitoring-rules`. Cubren dependencias fijadas, configuración segura, contratos/autorización, PostgreSQL 17 real, migraciones, concurrencia, imagen Linux sin secretos y reglas Prometheus. Un fallo de prueba devuelve error al job; no se desactivan pruebas ni se despliega desde un job fallido.

Con autorización explícita del propietario se activaron los cinco checks obligatorios en main, con validación estricta de la base actual e inclusión de administradores. No se modificó la política de aprobaciones de PR. La rama de entrega conserva sus cambios sin fusionar a main.

## Identidad, logs y observabilidad

La API verifica Supabase Auth y autoriza el comercio desde datos del servidor. Los eventos de negocio se emiten tras commit con actor, tenant y trace_id; spans HTTP correlacionados y métricas usan rutas normalizadas. No registrar cuerpos, emails, códigos QR, contraseñas ni tokens. Los tests comprueban redacción y correlación, y el smoke real verifica eventos de la acción validada.

Prometheus recoge contadores/histogramas multiproceso y Blackbox verifica HTTPS health/readiness con el CA de staging. Retención local Prometheus: 24 horas/128 MB; logs API y receptor: 3 archivos de 5 MB. UI solo en loopback: http://localhost:19090 y Alertmanager en http://localhost:19093. No exponer esos puertos a internet.

Las alertas cubren liveness, readiness, scrape, tasa de errores y latencia. Alertmanager entrega notificaciones autenticadas a un receptor independiente de Django, sin puerto publicado. El enlace HTTP entre ambos queda en la red Docker privada; los sondeos de aplicación usan HTTPS validado. El receptor solo emite nombres/estados/severidad permitidos y descarta contenido arbitrario. No hay envío a email/Slack ni guardia externa configurados: el operador consulta Alertmanager/logs locales.

## Arranque después de apagar el PC

Iniciar Docker Desktop. Desde la raíz del repo, en el staging ya recuperado:

```powershell
$stageState = Get-Content backend/.docker/staging-state.json | ConvertFrom-Json
docker start $stageState.recovery_container
docker compose --env-file backend/docker/compose.env --project-name $stageState.project -f backend/compose.staging.yaml -f backend/.docker/ll244-release-override.json up --detach --wait --no-deps api proxy
.\backend\.venv\Scripts\python.exe backend/scripts/observability.py up
.\backend\.venv\Scripts\python.exe backend/scripts/observability.py check
.\backend\.venv\Scripts\python.exe backend/scripts/staging_smoke.py --login-configured-demo
```

El override privado conserva la imagen exacta y el socket de la base recuperada: no iniciar la API recuperada usando solo el compose base, pues apuntaría al socket anterior. No copiar ni imprimir los secretos de `.docker`. La sesión de prueba se obtiene en memoria y solo se envía a https://localhost:8444, con CA verificado y redirecciones rechazadas. Si el DNS de Python en Windows falla, resolver Auth con Resolve-DnsName y pasar su dirección recién obtenida mediante `--resolved-auth-address`; esto no desactiva TLS ni modifica DNS/hosts del PC. No guardar direcciones IP como configuración permanente.

El servicio principal tiene su arranque separado: `python backend/scripts/docker.py up`; no comparte el socket o datos de staging. El túnel público temporal requiere PC/Docker y puede cambiar de URL; no se usaron tokens a través del túnel para estos ensayos.

## Crear y ensayar otro staging

Se necesitan un backup autorizado con restore previo verificado, CA/secretos privados y una cuenta de pruebas explícitamente configurada que exista en su snapshot. `prepare_staging.py --archive <database.dump>` crea un proyecto nuevo, restaura sin red y comprueba adopción. Si existe estado anterior, se detiene: no sobreescribe datos/secretos para repetir pruebas. Usar otro checkout/entorno de staging limpio o revisar el estado existente deliberadamente.

Con staging listo y código revisado/commiteado, ejecutar desde la raíz:

```powershell
.\backend\.venv\Scripts\python.exe backend/scripts/rehearse_release.py --apply --archive backend/.docker/backups/<respaldo-autorizado>/database.dump
```

El ensayo construye una imagen identificada por commit e ID SHA-256, aplica migraciones una vez en un comando separado, despliega y comprueba Auth/CRUD/aislamiento/QR/persistencia. Vuelve a la imagen previa con el esquema actualizado y comprueba de nuevo el recorrido. Después restaura en OTRO contenedor nuevo sin red, compara todas las tablas por recuento/SHA-256, adopta las migraciones y despliega el servicio sobre esa copia; repite el smoke autenticado. El script deja estado privado inmediatamente y no reutiliza automáticamente un ensayo anterior. Ante fallo, revisar el diagnóstico privado y los IDs registrados; no borrar volúmenes o forzar migraciones para obtener verde.

El rollback probado es de aplicación sobre esquema compatible, sin deshacer migraciones destructivas. Para un futuro cambio incompatible, hace falta un plan específico de migración correctiva/recuperación. Restaurar un backup en producción podría perder escrituras posteriores: estos scripts solo restauran copias aisladas y no aceptan la base remota como destino.

## Ensayos de alertas

```powershell
.\backend\.venv\Scripts\python.exe backend/scripts/observability.py test-liveness-alert
.\backend\.venv\Scripts\python.exe backend/scripts/observability.py test-alert
```

Detienen exclusivamente la API o la base staging registrada sin red, comprueban firing en Prometheus y entrega al receptor independiente, reinician el objetivo en finally y exigen notificación resolved y recuperación de métricas/sondeos. No apuntan a Supabase ni a otros proyectos Docker. `up` recarga Prometheus/Alertmanager porque cambiar archivos montados no recarga por sí solo esos procesos.

## Respaldos y límites

Los dumps privados autorizados contienen public/auth/storage, incluidos hashes y metadatos; quedan fuera de Git y no están cifrados como archivo. Proteger su acceso y no compartirlos. Los respaldos ensayados no incluyen binarios Storage, configuración Supabase, roles globales ni otros esquemas: no son recuperación completa de toda la plataforma. La restauración verificada de 51 tablas y la operación de la API cubren el backend de esta HU. No se ha configurado backup periódico externo, RPO/RTO contractual, retención de producción ni hosting permanente. Esas decisiones deben definirse antes de producción y no se infieren del ensayo local.

## Ciclos posteriores y fallos controlados

El procedimiento actualizado usa estados privados distintos por ejecución, conserva el socket activo y protege la imagen anterior mediante una etiqueta de rollback por ejecución. `--skip-restore` despliega sobre la misma base recuperada sin restaurar otra copia. Ejecutarlo dos veces comprueba los ciclos sucesivos. `--inject-failure migration` prueba una transacción fallida; `--inject-failure readiness` arranca un candidato que sale con código 42. Usar estas opciones exclusivamente en el staging aislado; ambos ensayos recuperan la imagen y socket previos y exigen el smoke antes de registrar recovered_expected_failure.

La API monta únicamente staging_runtime_env. El servicio maintenance usa staging_env y postgres para migraciones/fixtures/aprovisionamiento. `staging_runtime_role.py` valida privilegios antes de habilitar LOGIN al rol restaurado y aplica los mismos grants de negocio del runtime Supabase. El smoke incluye el override privado tanto para API como maintenance, evitando cambiar al socket anterior.
