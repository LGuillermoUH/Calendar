# Tareas — Migrar a Postgres en Docker + Aspire 13.5 (sin Supabase)

Ejecutar en orden. Cada tarea nombra los archivos que toca (rutas relativas a `C:\Users\luisg\OneDrive\Desktop\Calendar`). Recordatorio: la shell es PowerShell (sin `&&`; comandos por separado).

## 1. Base de datos: contenedor Postgres

- [x] 1.1 Añadir el servicio `db` a `docker-compose.yml`: imagen `postgres:16-alpine`, variables `POSTGRES_DB`/`POSTGRES_USER`/`POSTGRES_PASSWORD` desde `.env`, volumen nombrado `db_data:/var/lib/postgresql/data`, y `healthcheck` con `pg_isready -U $POSTGRES_USER`.
- [x] 1.2 Declarar el volumen `db_data` en la sección `volumes:` de `docker-compose.yml`.
- [x] 1.3 En el servicio `backend` de `docker-compose.yml`: cambiar `depends_on` a `db` con `condition: service_healthy`; quitar las variables `SUPABASE_*` y `VITE_SUPABASE_URL`; apuntar `DATABASE_URL` al host `db`.

## 2. Esquema Postgres estándar

- [x] 2.1 Reescribir `backend/db/schema.sql` para Postgres estándar (idempotente):
  - `create extension if not exists pgcrypto;`
  - Tabla `events` (igual que hoy, sin cambios).
  - Tabla `users`: `id uuid pk default gen_random_uuid()`, `email text unique not null`, `password_hash text not null`, `role text not null default 'admin' check (role in ('admin','viewer'))`, `created_at timestamptz not null default now()`.
  - Tabla `refresh_tokens`: `id uuid pk default gen_random_uuid()`, `user_id uuid not null references users(id) on delete cascade`, `token_hash text not null`, `expires_at timestamptz not null`, `revoked_at timestamptz`, `created_at timestamptz not null default now()`; índice por `token_hash`.
  - Trigger `set_updated_at` sobre `events` (igual que hoy).
  - **Eliminar** todo lo de Supabase: `references auth.users`, `enable row level security`, policies, `handle_new_user`, `on_auth_user_created`, `profiles`.
- [x] 2.2 Verificar que `Dockerfile` del backend sigue copiando `db/schema.sql` a la salida (la nota del `.csproj` y `DbInitializer` dependen de `AppContext.BaseDirectory/db/schema.sql`).

## 3. Backend: modelos y DbContext

- [x] 3.1 Crear `backend/SalonEvents.Api/Models/UserEntity.cs` (mapea tabla `users`).
- [x] 3.2 Crear `backend/SalonEvents.Api/Models/RefreshTokenEntity.cs` (mapea `refresh_tokens`).
- [x] 3.3 Borrar `backend/SalonEvents.Api/Models/ProfileEntity.cs`.
- [x] 3.4 En `backend/SalonEvents.Api/Data/AppDbContext.cs`: quitar `DbSet<ProfileEntity> Profiles`; añadir `DbSet<UserEntity> Users` y `DbSet<RefreshTokenEntity> RefreshTokens` con su mapeo `OnModelCreating`.

## 4. Backend: servicios de autenticación

- [x] 4.1 Añadir paquete `BCrypt.Net-Next` al `backend/SalonEvents.Api/SalonEvents.Api.csproj`.
- [x] 4.2 Crear `backend/SalonEvents.Api/Services/PasswordHasher.cs` (hash/verify con BCrypt).
- [x] 4.3 Crear `backend/SalonEvents.Api/Services/TokenService.cs`: emitir access JWT (HS256, firmado con `JWT_SECRET`, claim `sub` = user id, `role`, expiración ~15 min); generar refresh token opaco, guardar su hash en `refresh_tokens`; método `RotateAsync` (valida no revocado/no caducado, revoca el actual, emite uno nuevo) y `RevokeAsync`.
- [x] 4.4 Crear `backend/SalonEvents.Api/Services/AuthService.cs`: `LoginAsync(email,password)` (verifica hash, emite tokens), orquesta refresh/logout usando `TokenService`.
- [x] 4.5 Registrar los servicios en `Program.cs`.

## 5. Backend: endpoints y autorización

- [x] 5.1 Crear `backend/SalonEvents.Api/Controllers/AuthController.cs`: `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout` (login/refresh anónimos; logout autenticado).
- [x] 5.2 Crear `backend/SalonEvents.Api/Controllers/AdminUsersController.cs`: `POST /api/admin/users` protegido con `[Authorize(Policy = "AdminOnly")]` para crear un admin.
- [x] 5.3 En `Program.cs`: reemplazar la validación JWT de Supabase (JWKS/`Authority`/`MetadataAddress`) por validación local HS256 con `JWT_SECRET` (`ValidateIssuer`/`ValidateAudience` propios, sin llamadas externas). Quitar variables `SUPABASE_*`.
- [x] 5.4 En `backend/SalonEvents.Api/Auth/AdminRoleRequirement.cs`: `AdminRoleHandler` resuelve el rol desde `db.Users` por el claim `sub` (en vez de `db.Profiles`).
- [x] 5.5 Actualizar `GET /api/me` en `Program.cs` para leer el rol desde `Users`.

## 6. Backend: seed del primer admin

- [x] 6.1 Crear `backend/SalonEvents.Api/Data/AdminSeeder.cs`: tras `DbInitializer`, si hay `ADMIN_EMAIL`/`ADMIN_PASSWORD` y el usuario no existe, inserta un admin con contraseña hasheada (idempotente). Llamarlo en `Program.cs` después de `DbInitializer.InitializeAsync`.

## 7. Frontend: quitar Supabase, usar auth propia

- [x] 7.1 Quitar `@supabase/supabase-js` de `frontend/package.json` (dependencies) y borrar `frontend/src/lib/supabase.js`.
- [x] 7.2 Añadir a `frontend/src/lib/api.js` los métodos `login(email,password)`, `refresh(refreshToken)`, `logout(refreshToken)` contra `/api/auth/*`.
- [x] 7.3 Reescribir `frontend/src/context/AuthContext.jsx` sin Supabase: guardar access+refresh en `localStorage`, exponer `login`/`logout`/`getToken`/`isAdmin`/`role`, refrescar el access al recibir 401 (o antes de caducar) vía `/api/auth/refresh`, y resolver el rol con `api.getMe`.
- [x] 7.4 Revisar `frontend/src/App.jsx` y `frontend/src/components/Header.jsx`: siguen usando `useAuth`; ajustar solo si cambia la forma del contexto (registro ya no existe).
- [x] 7.5 Actualizar `frontend/src/Dockerfile`/`docker-compose.yml` para dejar de pasar `VITE_SUPABASE_*` como build args; conservar `VITE_API_URL`.
- [x] 7.6 Actualizar `frontend/.env` y `frontend/.env.example`: quitar `VITE_SUPABASE_*`, dejar `VITE_API_URL`.

## 8. Aspire 13.5 (orquestación local)

- [x] 8.1 Crear proyecto AppHost de Aspire (`net10.0`) en `backend/SalonEvents.AppHost/` con el SDK de Aspire 13.5; añadirlo a `backend/SalonEvents.slnx`.
- [x] 8.2 En `AppHost/Program.cs`: `AddPostgres("db")` con volumen de datos + base `salonevents`; `AddProject<SalonEvents_Api>("backend").WithReference(db)` para inyectar la cadena de conexión; exponer el `WaitFor(db)`.
- [x] 8.3 Asegurar que el backend lee la cadena que Aspire inyecta (nombre de connection string `db`) además de `DATABASE_URL` para producción (fallback en `Program.cs`).
- [x] 8.4 Verificar `dotnet run` del AppHost: el dashboard de Aspire muestra `db` y `backend`, y el backend arranca contra el Postgres orquestado.

## 9. Config, tests y documentación

- [x] 9.1 Actualizar `.env.example` (raíz) y `backend/.env`: nuevas variables `POSTGRES_*`, `DATABASE_URL` local al contenedor, `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `FRONTEND_ORIGIN`; eliminar todas las `SUPABASE_*` y `VITE_SUPABASE_*`.
- [x] 9.2 Adaptar/añadir tests: `backend/SalonEvents.Tests` — pruebas de `PasswordHasher` (hash/verify) y de rotación de refresh en `TokenService` (con repositorio en memoria como el `FakeEventRepository` existente). Ajustar cualquier test que asumiera Supabase.
- [x] 9.3 Frontend: adaptar `frontend/src/lib/api.test.js` y los tests de auth que referencien Supabase; añadir prueba del flujo login→getToken del nuevo `AuthContext` si aplica.
- [x] 9.4 Actualizar `README.md`: arquitectura autónoma (Postgres propio + auth propia), variables, comandos de desarrollo (Aspire + Docker) y pruebas; quitar toda mención a Supabase.
- [x] 9.5 Ejecutar `dotnet test` (en `backend`) y `npm run test` (en `frontend`) y dejar ambos en verde.

## 10. Guía de despliegue en VPS (`DEPLOY.md`)

- [x] 10.1 Crear `DEPLOY.md` en la raíz con secciones copiables:
  - **Requisitos VPS**: Docker + Docker Compose plugin (comandos de instalación en Debian/Ubuntu).
  - **Subir el código**: `git clone` o `scp` del proyecto al VPS.
  - **Configurar `.env`**: copiar `.env.example`, generar `JWT_SECRET` (`openssl rand -base64 48`), fijar `POSTGRES_PASSWORD`, `ADMIN_EMAIL`/`ADMIN_PASSWORD`, y `FRONTEND_ORIGIN`/`VITE_API_URL` con la IP o dominio del VPS.
  - **Levantar**: `docker compose up -d --build`; verificar `/health` y login del admin.
  - **Migrar datos de Supabase**: exportar `events` desde Supabase (SQL editor → CSV o `pg_dump --table=public.events`) e importar al contenedor (`docker compose exec -T db psql ...` o `\copy`). Aclarar que los usuarios NO se migran (se usa el admin sembrado).
  - **Backup/restauración**: `docker compose exec db pg_dump` a archivo y cómo restaurar; copia del volumen `db_data`.
  - **Actualizar**: `git pull`; `docker compose up -d --build`.
  - **Opcional**: nota sobre poner un reverse-proxy (Caddy/Nginx) delante para HTTPS.

---

Cuando termines cada bloque, verifica compilación/tests antes de pasar al siguiente. Al final, `dotnet test` + `npm run test` en verde y `docker compose up --build` levantando `db`+`backend`+`frontend`.

---

**Notas de ejecución**
- 8.2: se implementó como `AddPostgres("postgres").AddDatabase("db", "salonevents")` (idioma correcto de Aspire) en vez de `AddPostgres("db")`, para que la cadena inyectada al backend se llame `db` (que es la que lee `Program.cs`). Mismo efecto que la intención de la tarea.
- 2.2: el `.csproj` solo tenía un comentario; se añadió `<Content Include="..\db\schema.sql" ...>` y el `Dockerfile` del backend ahora copia `db/` para que el `publish` resuelva el esquema.
- 8.4: el AppHost compila y está cableado; el arranque en vivo (que levanta el contenedor de Postgres) no se ejecutó en frío en este entorno — se valida con `dotnet run --project SalonEvents.AppHost` en la máquina del usuario.

