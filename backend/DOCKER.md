# Django en Docker local

Requiere Docker Desktop iniciado con contenedores Linux, `backend/.env` privado y `backend/supabase-ca.crt`. No es necesario un VPS para probar localmente. Supabase conserva PostgreSQL y Auth. Este despliegue publica solamente en la interfaz local de este PC, no en internet ni en el telefono.

## Arrancar

Desde `backend/`, usando el Python del entorno virtual con `requirements.txt` instalado:

```powershell
.\.venv\Scripts\python.exe scripts\docker.py up
.\.venv\Scripts\python.exe scripts\docker.py ps
.\.venv\Scripts\python.exe scripts\docker.py database-check
.\.venv\Scripts\python.exe scripts\docker.py pool-check
.\.venv\Scripts\python.exe scripts\docker.py check
```

URL: `https://localhost:8443/health/`. El wrapper inicializa una clave Django aleatoria si no existe en el `.env` local; no reemplaza claves existentes. El certificado CA de Supabase verifica TLS hacia la base de datos. Los secretos se montan en tiempo de ejecucion, fuera de la imagen. Compose usa un archivo de variables vacio para evitar interpolar los caracteres especiales de las contrasenas. No usar comandos que impriman el archivo secreto o el entorno del proceso.

Caddy genera una autoridad local para el HTTPS entre navegador y contenedor. El navegador del PC no la confia automaticamente: `docker.py check` exporta su certificado publico a `backend/.docker/local-proxy-ca.crt` y verifica HTTPS usando esa CA sin desactivar la validacion TLS. La instalacion de esa CA en el almacen de confianza del PC es una accion separada y no se realiza automaticamente. Este certificado local es diferente del CA de Supabase.

`/health/` comprueba vida; `/ready/` exige conexion y todas las migraciones registradas. Si faltan las migraciones de adopcion, devuelve HTTP 503 y `docker.py check` termina con error. No interpretar un contenedor healthy como prueba de que los flujos de negocio estan operativos. El perfil Docker no aplica migraciones al arrancar y la base actual ya tiene ocho migraciones aplicadas: ver `POSTGRES.md`.

## Administrar

```powershell
.\.venv\Scripts\python.exe scripts\docker.py logs
.\.venv\Scripts\python.exe scripts\docker.py down
```

`down` conserva los volumenes del certificado local. No cambia datos de Supabase. Un reinicio del contenedor conserva la clave del `.env`. Gunicorn usa dos procesos con dos hilos y hasta cinco conexiones por proceso: presupuestar hasta diez conexiones, ademas de cualquier proceso de comandos. El contenedor API no expone su puerto al host, trabaja sin root, sin capacidades Linux y con filesystem de solo lectura. Solamente Caddy publica el puerto local 8443 y reescribe la cabecera de HTTPS. Los logs tienen rotacion y no habilitan el registro crudo de URLs/cuerpos de solicitudes.

## Pruebas de la imagen

```powershell
docker run --rm --read-only --tmpfs /tmp:rw,noexec,nosuid,size=32m loyloop-django:local python -m unittest discover -s tests -v
```

Las migraciones y concurrencia se verifican aparte contra PostgreSQL 17 aislado. Nunca montar el secreto remoto en esos contenedores de pruebas. La imagen excluye `.env`, certificados, respaldos y entornos virtuales mediante whitelist en `.dockerignore` y copias explicitas en Dockerfile. Python y Caddy estan fijados por digest linux/amd64; Gunicorn y dependencias Python estan fijados por version.

## Respaldo y restauracion aislada

Desde el host, ejecutar deliberadamente `python scripts/backup_restore.py --restore-isolated`. Lee el Supabase configurado con TLS verificado y una transaccion de solo lectura. Exporta un snapshot consistente de `public`, `auth` y `storage` y restaura en un contenedor PostgreSQL nuevo sin red ni puertos publicados. Compara recuentos y hashes SHA-256 de contenido de cada tabla; detiene el destino al terminar. Nunca restaura en la base remota.

Los artefactos estan en `backend/.docker/backups`, fuera de Git. Son copias locales sensibles, sin cifrado de archivo, e incluyen hashes de contrasenas y metadatos de usuarios/archivos. Proteger su acceso y no compartirlos ni publicarlos. El script borra su archivo temporal de credenciales al terminar; conserva el dump, la evidencia privada y el contenedor de recuperacion detenido. Se requiere autorizacion del propietario para ejecutar el respaldo de esos esquemas. Quedan fuera los binarios de Storage, configuracion del proyecto, roles/permisos globales y esquemas no seleccionados: no equivale a recuperacion completa de un proyecto Supabase ni a ensayo en staging externo.

## Estado y límites

LL-235 tiene adopción remota aplicada, API y consumidores migrados y permisos directos de clientes revocados; evidencia en mobile/docs/hus/LL-235.md. Compose usa el archivo secreto `.docker/runtime.env` mediante `LOYLOOP_BACKEND_ENV_FILE` en docker/compose.env. El propietario `.env` se reserva para migraciones/backup. No intercambiar esos roles.

Docker local y el túnel temporal no acreditan staging externo, alertas ni CI remoto de LL-244. El admin publicado requiere configuración y despliegue independientes. Un reinicio conserva la base remota y volúmenes locales; iniciar Docker y ejecutar los comandos de arranque/verificación de POSTGRES.md.
