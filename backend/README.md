# LoyLoop Django API — LL-232

Base independiente de Django 5.2 LTS y Django REST Framework. La única ruta pública es `GET /health/`: devuelve `{"status":"ok"}` y comprueba que el proceso HTTP responde. Es una prueba de **vida**, no comprueba PostgreSQL, Supabase Auth ni servicios externos.

## Requisitos

Python 3.11 o 3.12 y acceso a PyPI para instalar `requirements.txt`. Las versiones directas y transitivas están fijadas. Trabajar en `backend/`; el entorno virtual y los archivos locales no se versionan.

## Arranque local en Windows PowerShell

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:DJANGO_SETTINGS_MODULE = "config.settings.local"
$env:DJANGO_SECRET_KEY = python -c "import secrets; print(secrets.token_urlsafe(64))"
$env:DJANGO_ALLOWED_HOSTS = "localhost,127.0.0.1,[::1]"
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

En otra terminal, ejecutar `Invoke-RestMethod http://127.0.0.1:8000/health/`. El comando crea una clave aleatoria para la sesión local; cambiarla invalida las sesiones firmadas previamente. Si PowerShell bloquea la activación, usar directamente `.\.venv\Scripts\python.exe` en lugar de activar el entorno.

En Linux/macOS: `python3 -m venv .venv`, `source .venv/bin/activate`, instalar requisitos, exportar `DJANGO_SETTINGS_MODULE=config.settings.local`, `DJANGO_SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(64))')"` y `DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1`, ejecutar `python manage.py migrate` y luego `python manage.py runserver 127.0.0.1:8000`.

La migración local crea únicamente las tablas incorporadas de Django en `backend/db.sqlite3`; no se conecta a Supabase ni modifica el esquema de negocio.

Los valores de `.env.example` documentan las variables; el proyecto **no carga archivos `.env` automáticamente**. Exportar las variables en el proceso o usar el gestor de secretos del entorno. Nunca reutilizar en producción la clave local o de CI. Si falta `DJANGO_SECRET_KEY`, tiene menos de 50 caracteres o poca variedad, el arranque falla sin imprimir su valor.

## Variables

| Variable | Local | Producción |
| --- | --- | --- |
| `DJANGO_SETTINGS_MODULE` | `config.settings.local` | `config.settings.production`, explícito en el despliegue |
| `DJANGO_SECRET_KEY` | Obligatoria, aleatoria | Obligatoria, aleatoria y gestionada como secreto |
| `DJANGO_ALLOWED_HOSTS` | Por defecto localhost, 127.0.0.1 y [::1] | Obligatoria; hosts explícitos separados por coma, sin `*`, prefijo `.`, esquema ni puerto |
| `DJANGO_CORS_ALLOWED_ORIGINS` | Vacío por defecto; orígenes http/https explícitos separados por coma | Vacío por defecto; solo orígenes HTTPS explícitos, sin `*` ni rutas |
| `DJANGO_DEBUG` | `true` por defecto; `true`/`false` | Debe ser `false` o estar ausente |
| `DJANGO_SECURE_SSL_REDIRECT` | No se aplica | `true` por defecto; debe permanecer activo |
| `DJANGO_SECURE_HSTS_SECONDS` | No se aplica | Por defecto 31536000; mínimo 31536000 |
| `DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS` | No se aplica | `false` por defecto; habilitar solo si todos los subdominios usan HTTPS |
| `DJANGO_SECURE_HSTS_PRELOAD` | No se aplica | `false` por defecto; requiere subdominios habilitados y una decisión explícita |
| `DJANGO_TRUST_PROXY_SSL_HEADER` | No se aplica | `false` por defecto. Activar solo si el proxy confiable elimina el valor entrante y establece `X-Forwarded-Proto` |

En local, `DATABASES` usa un SQLite local vacío. En producción está configurado con el backend **dummy**, que impide acceder a datos: LL-235 implementará la conexión y configuración de PostgreSQL Supabase. El endpoint de vida sigue respondiendo sin base de datos y **no indica que la aplicación esté lista para operar**. No usar esta base como backend de negocio en producción ni crear migraciones en la base compartida desde LL-232.

En producción usar un servidor ASGI/WSGI adecuado con HTTPS terminado de forma segura; `runserver` es exclusivamente local. No habilitar confianza en cabeceras de proxy para una instancia accesible directamente desde internet. El endpoint de health requiere HTTPS en settings de producción; un proxy confiable debe transmitir correctamente el esquema de la solicitud si se activa la opción de proxy. Django avisa sobre subdominios y preload si siguen desactivados: evaluar el dominio real antes de activarlos, pues pueden afectar a otros servicios. El check de CI los activa únicamente para un dominio ficticio.

DRF usa permiso predeterminado `IsAuthenticated` y aún no tiene clases de autenticación: la verificación del JWT de Supabase y los permisos de negocio se implementarán en las HUs correspondientes. No se han creado endpoints de negocio ni se ha cambiado la app, el panel o la base de datos.

## Pruebas locales y CI

```powershell
python -m unittest discover -s tests -v
python scripts/smoke_http.py
python scripts/check_deploy.py
```

Las pruebas aíslan el entorno, crean claves temporales en memoria y comprueban health, CORS, hosts, errores de configuración y opciones de TLS/seguridad. El smoke inicia y cierra un servidor local en un puerto libre. `check_deploy.py` ejecuta `manage.py check --deploy --fail-level WARNING` con configuración ficticia, sin desplegar ni acceder a Supabase. GitHub Actions ejecuta estos comandos en Python 3.11 y 3.12 con `.github/workflows/django-backend.yml`.
