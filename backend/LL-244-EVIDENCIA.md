# LL-244: evidencia y alcance

La HU solicita pruebas unitarias y de integración PostgreSQL, contratos, permisos, migraciones y concurrencia en CI; observabilidad con actor y tenant; y despliegue y recuperación probados en staging.

Se amplía el workflow existente con comprobación de dependencias y migraciones locales de Django y se incorpora un contrato mínimo de auditoría JSON con pruebas de campos y rechazo de entradas ajenas al contrato. Los comandos están en `OPERATIONS.md` y `README.md`.

Verificación aislada en Windows el 2026-11-15: `python -m unittest discover -s tests -v` ejecutó 11 pruebas correctamente; `python scripts/smoke_http.py` y `python scripts/check_deploy.py` pasaron; `makemigrations --check --dry-run`, `migrate --noinput` y `migrate --check` pasaron usando SQLite aislado. Estas verificaciones no consultan Supabase ni demuestran el funcionamiento en CI o staging.

Pendiente de evidencia real: ejecución del workflow en GitHub Actions, reglas de protección de rama, PostgreSQL y pruebas de concurrencia/aislamiento/contrato/permisos reales, integración de eventos en endpoints autenticados, recopilación de métricas/trazas y alertas, despliegue y restauración en staging. No hay evidencia de que el despliegue o restore hayan ocurrido. El servicio no dispone todavía de PostgreSQL ni endpoints de negocio; LL-235 es una dependencia.

## Evidencia local Docker 2026-11-16

Imagen y Compose con Gunicorn/Caddy, HTTPS local y conexion TLS Supabase comprobados; 19 pruebas en la imagen correctas. Respaldo de public/auth/storage autorizado y restore sin red: 51 tablas coinciden por recuento y SHA-256 de contenido. Evidencia privada ignorada por Git en backend/.docker/backups. Esto no sustituye staging externo, permisos de negocio, metricas/trazas/alertas ni CI real; LL-244 permanece incompleta.
