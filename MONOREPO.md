# LoyLoop: web, móvil y backend

Este repositorio reúne el panel web Next.js en la raíz, la app Expo en `mobile/` y la base Django en `backend/`. Se conservan los historiales previos de ambos proyectos. Cada aplicación tiene dependencias y comandos propios.

## Panel web

Desde la raíz: `npm install` y `npm run dev`. La raíz web no cambió, para conservar la configuración existente del despliegue. Configurar sus variables en `.env.local`, que se ignora en Git.

## App móvil

Desde `mobile/`: `npm install` y `npm start`. Mantener sus variables en `mobile/.env`, según `mobile/.env.example`; nunca incluir claves administrativas. El proyecto Expo/EAS conserva su configuración anterior.

Para verificar: `cd mobile`, `npm run typecheck` y `npm test`.

## Django

Seguir [backend/README.md](backend/README.md). El workflow de CI está en `.github/workflows/django-backend.yml`. El healthcheck de Django comprueba únicamente que el proceso está vivo; la conexión a PostgreSQL de Supabase continúa pendiente en LL-235.

## Estado de la integración

El repo `LoyLoop` es el destino de esta unión. El proyecto móvil anterior permanece como respaldo independiente hasta que se decida retirarlo. La integración de código no aplica migraciones, configura servicios remotos ni despliega aplicaciones; comprobar cada entorno por separado.
