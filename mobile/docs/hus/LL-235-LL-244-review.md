# Revisión de LL-235 y LL-244 — 2026-11-17

Revisión de código, configuración, pruebas y evidencia histórica. No se reaplicaron migraciones remotas, restauraciones ni caídas de staging. Se reejecutaron 27 pruebas unitarias y las suites PostgreSQL/API en loyloop_ll235 aislada: todas correctas. El transporte Auth de las suites API está simulado. Los resultados remotos de CI y los ensayos staging anteriores son evidencia histórica, no ejecuciones repetidas en esta auditoría.

## Hallazgos

### P1 — la evidencia de staging no acredita los permisos del runtime real

config/settings/staging.py:16 usa postgres y postgres_ci también usa el propietario. test_api.py:10 ejecuta ese perfil. La prueba de rol en test_postgres.py comprueba algunos permisos SQL, pero no recorre toda la API bajo loyloop_backend. El smoke remoto documentado de LL-235 cubre CRUD de ofertas, no todos los caminos administrativos, identidad y cierre de cuenta con ese rol.

Impacto: un GRANT o permiso de función faltante puede pasar CI/staging y fallar en el servicio real. No se ha demostrado un permiso concreto roto; es una brecha de verificación y paridad. Para cerrarla, ejecutar los contratos API y el smoke de staging con el rol mínimo, dejando postgres exclusivamente para preparación/migraciones, con controles negativos DDL/Auth.

### P2 — el procedimiento de release no contempla un segundo ciclo sobre staging recuperado

scripts/rehearse_release.py:36 rechaza cualquier estado anterior, incluido un ensayo finalizado correctamente. Además compose():63–68 reconstruye el override desde el compose base y solo conserva el socket recuperado cuando se le pasa explícitamente; las fases iniciales no toman recovery_socket del estado. La prohibición actual impide llegar a ese caso, por lo que no hay cambio silencioso de DB en el ensayo realizado. Quitar únicamente la prohibición sería inseguro: podría seleccionar la base anterior.

Impacto: el ensayo inicial pasó, pero no acredita el siguiente despliegue sobre el entorno que él mismo deja funcionando. Corregir con estados por ejecución, preservación del socket activo y dos ciclos consecutivos comprobados; no borrar el guard ni editar a mano el estado para forzar una repetición.

### P2 — rollback probado solo en el recorrido exitoso

scripts/rehearse_release.py:86–89 ejecuta migración, arranque y smoke antes de volver a la imagen previa. Si falla cualquiera de ellos, command/ready/smoke aborta y no se ejercita esa vuelta. El rollback exitoso documentado es real; no demuestra recuperación ante candidato defectuoso o migración fallida.

Impacto: falta comprobar el manejo operativo de un release fallido. Añadir ensayos aislados de fallo de migración y fallo de readiness/smoke, verificar que la imagen/socket seguros se conservan o se recuperan según el procedimiento y que el estado no informa éxito. No revertir destructivamente las migraciones adoptadas.

## Matriz de conclusión

LL-235: verificadas en las suites actuales migraciones limpias reversibles, constraints, frontera de escritura y concurrencia/pool acotado. La evidencia anterior acredita conexión TLS real, adopción conservando datos y denegación REST directa. Falta ampliar la ejecución funcional con el rol runtime para una afirmación integral de todos los consumidores.

LL-244: confirmados código/pruebas de contratos, permisos y concurrencia, auditoría y receptor independiente; existen evidencias de cinco jobs CI, alertas firing/resolved, deploy/rollback y restore de 51 tablas con servicio operativo. La paridad de privilegios y los ciclos/fallos de despliegue anteriores impiden concluir que toda la operación está completamente cubierta.

No se invalida lo que ya pasó; se acota su alcance. No declarar ninguna de las dos como garantía de producción ni usar el número de pruebas como sustituto de estos recorridos pendientes. Se recomienda completar los hallazgos antes del cierre definitivo conjunto. No se cambiaron estados de Jira ni código funcional en esta revisión.

## Resolución de la revisión — 2026-11-17

Los tres hallazgos quedaron comprobados tras los ajustes. Los contratos API completos pasaron bajo SET ROLE loyloop_backend (incluidos administración, identidad y cierre de cuenta; transporte Auth simulado). Staging pasó el recorrido HTTPS con login real loyloop_backend, credencial independiente y sin montar la credencial propietaria en la API. Los fixtures y migraciones se ejecutan en el servicio maintenance separado.

Dos ciclos consecutivos de despliegue/rollback pasaron conservando el mismo recovery_socket. Después pasaron dos ensayos independientes: fallo de migración transaccional (tabla de prueba ausente tras rollback) y fallo de arranque con exit 42. Ambos recuperaron imagen/socket previos y pasaron el smoke autenticado con rol mínimo. Cada ejecución conserva su propio estado; un fallo inesperado no se clasifica como fallo controlado exitoso.

El apagado dejó un ensayo interrumpido, registrado como interrupted_pc_shutdown y repetido en ejecuciones nuevas. Se corrigió además la retención de imágenes de rollback: se resuelve el manifiesto de Config.Image y se conserva una etiqueta privada por ejecución antes de reconstruir una etiqueta existente. No se cambiaron los datos de negocio remotos de Supabase.

Evidencia privada: ll244-release-cb0a9b75e0d6.json y ll244-release-aae4eab22c75.json (ciclos), ll244-release-24a53463ab02.json (migración), ll244-release-c702480ee2e8.json (arranque), bajo backend/.docker, fuera de Git. Los hallazgos anteriores describen la revisión original; ya no constituyen pendientes vigentes con estos resultados. No equivale a hosting permanente, merge a main ni cierre de Jira.
