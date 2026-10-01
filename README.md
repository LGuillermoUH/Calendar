# Salón de Eventos — Gestión de calendario

Aplicación web para gestionar los eventos de un salón de eventos. **100% autohospedada**: base de datos y autenticación propias, sin servicios externos.

- **Vista pública:** calendario de solo lectura que muestra los días apartados.
- **Vista privada:** gestión de eventos (crear/editar/eliminar), protegida con login por correo y contraseña.

## Arquitectura

- **frontend/** — SPA Vite + React 19. Login contra la API .NET (`/api/auth/*`); los datos se leen/escriben vía la misma API.
- **backend/SalonEvents.Api/** — ASP.NET Core Web API (.NET 10). Autenticación propia: contraseñas con **BCrypt**, **access token JWT (HS256, ~15 min) + refresh token con rotación** (tabla `refresh_tokens`). Rol `admin` requerido para la parte privada. Acceso a Postgres con EF Core + Npgsql.
- **backend/SalonEvents.AppHost/** — orquestación local con **.NET Aspire 13.5**: levanta Postgres + backend y le inyecta la cadena de conexión.
- **Postgres 16** — base de datos, en un contenedor Docker (volumen persistente).

No hay registro público: el **primer admin** se siembra al arrancar desde `ADMIN_EMAIL` / `ADMIN_PASSWORD`; los admins adicionales se crean con `POST /api/admin/users` (protegido).

## Variables de entorno

Copia `.env.example` a `.env` y complétalo (no se versiona).

| Variable | Lado | Descripción |
|----------|------|-------------|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | db | Credenciales del contenedor Postgres |
| `DATABASE_URL` | backend | Cadena de conexión Npgsql al Postgres (`Host=db` en Docker) |
| `JWT_SECRET` | backend | Secreto para firmar los JWT (HS256). Genera uno con `openssl rand -base64 48` |
| `JWT_ISSUER` / `JWT_AUDIENCE` | backend | Emisor/audiencia de los tokens |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | backend | Primer admin sembrado al arrancar |
| `FRONTEND_ORIGIN` | backend | Origen permitido por CORS |
| `VITE_API_URL` | frontend | URL de la API .NET (se hornea en el build) |

## Desarrollo local

**Opción A — Aspire (recomendada):** levanta Postgres + backend juntos.

```bash
cd backend
dotnet run --project SalonEvents.AppHost
```

Abre el dashboard de Aspire que imprime la consola; el backend arranca contra el Postgres orquestado.

**Opción B — backend suelto** (necesitas un Postgres local y `backend/.env` configurado):

```bash
cd backend
dotnet run --project SalonEvents.Api
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Con Docker (todo el stack)

```bash
cp .env.example .env   # y completa los valores (JWT_SECRET, contraseñas, admin)
docker compose up --build
```

- Frontend: http://localhost:8080
- Backend:  http://localhost:5080  (health: http://localhost:5080/health)
- Postgres: contenedor `db` (volumen `db_data`)

El backend espera a que `db` esté sana (healthcheck) antes de arrancar, aplica el esquema y siembra el primer admin.

## Base de datos

El esquema (`backend/db/schema.sql`) se aplica automáticamente al arrancar el backend (idempotente): crea `events`, `users`, `refresh_tokens`, el trigger de `updated_at` e índices. No hace falta ejecutarlo a mano.

## Despliegue

- **Producción con imágenes publicadas + Traefik (recomendado):** [DEPLOY-TRAEFIK.md](DEPLOY-TRAEFIK.md) — construye y publica las imágenes en Docker Hub y el VPS solo hace `pull`, enrutado por el Traefik existente con TLS.
- **Build en el VPS / referencia (incl. Caddy):** [DEPLOY.md](DEPLOY.md) — subir el código, configurar `.env`, `docker compose up`, sembrar el admin, migrar datos y backups.

## Pruebas

```bash
cd backend && dotnet test
cd frontend && npm run test
```
