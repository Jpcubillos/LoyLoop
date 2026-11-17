# LL-244: operaciones y pendientes de staging

Este documento describe una preparación inicial. Todavía no existe un despliegue Django ni una base PostgreSQL configurada para este backend. El endpoint `/health/` es de vida; no demuestra que la base esté disponible ni que el servicio pueda atender operaciones de negocio.

## CI y protección de cambios

El workflow `django-backend.yml` instala dependencias fijadas, comprueba su consistencia, ejecuta pruebas, smoke HTTP, `check --deploy` y migraciones incorporadas sobre SQLite efímero en Python 3.11 y 3.12. Un fallo termina el job con error. Para impedir merges, un administrador debe configurar los checks requeridos en la protección de rama o ruleset; el archivo de workflow por sí solo no la activa.

Faltan LL-235 y la integración PostgreSQL de Django antes de poder verificar migraciones reales, transacciones, concurrencia, aislamiento, permisos y restauraciones contra PostgreSQL. Las pruebas SQLite actuales no acreditan esos criterios. A medida que se creen endpoints y permisos se añadirán pruebas de contrato y de acceso para cada caso positivo y negativo.

## Auditoría

`config.audit.record_event` emite JSON con fecha UTC, tipo y resultado predefinidos, y UUID de actor y comercio. Solo deben pasarse identificadores obtenidos del contexto autenticado y autorizado en el servidor, nunca de cabeceras confiadas ciegamente. No admite cargas arbitrarias ni registra secretos. Los tipos existentes son una base, no constituyen evidencia de eventos reales: todavía no hay endpoints de negocio Django que la invoquen ni almacenamiento o retención configurados.

## Procedimiento propuesto para staging

1. Preparar un proyecto de staging aislado, servidor, secretos, dominio y permisos. No utilizar la base compartida de producción para ensayos de migración o recuperación.
2. Una vez implementada LL-235, validar la conexión TLS y la identidad del destino; ejecutar pruebas PostgreSQL y comprobar que CI y las reglas de protección terminan correctamente.
3. Crear un respaldo consistente con herramientas compatibles con la versión PostgreSQL, almacenarlo cifrado con acceso restringido y comprobar una restauración en una base separada. Incluir en el plan esquema, datos, roles y demás recursos necesarios; verificar qué queda fuera del backup del proveedor.
4. Publicar una versión inmutable identificada por commit. Ejecutar migraciones controladas una sola vez mediante un trabajo separado, registrar el resultado y después iniciar instancias. Comprobar health, readiness real y recorrido de prueba, sin registrar credenciales.
5. Para rollback, verificar previamente la compatibilidad entre la versión anterior y el esquema actualizado. Si no son compatibles, utilizar una migración correctiva o un plan de recuperación aprobado; restaurar una copia implica pérdida potencial de escrituras posteriores y debe ensayarse primero en un destino aislado.
6. Configurar recopilación de logs, trazas, métricas y alertas con un proveedor elegido, políticas de retención y responsables. Alertar por fallos de health/readiness, tasa de errores, latencia y fallo o antigüedad del backup. No exportar tokens, contraseñas, datos de solicitudes ni información personal como etiquetas.
7. Guardar evidencia de ejecución, versión, hora, resultados de restauración y tiempos observados sin credenciales ni datos personales. Repetir el ensayo tras cambios relevantes.

No se ha elegido plataforma, proveedor de observabilidad, destino de staging, ni configurado respaldos o alertas. Tampoco se ha probado un despliegue, rollback o restore en staging.
