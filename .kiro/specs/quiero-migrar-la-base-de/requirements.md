# Migrar a base de datos propia en Docker + Aspire 13.5 (sin Supabase)

## Objetivo

Eliminar por completo la dependencia de **Supabase** (base de datos **y** autenticación) y pasar a una arquitectura **100% autónoma**: **Postgres propio en un contenedor Docker** y **autenticación propia en el backend .NET**, orquestado con **.NET Aspire 13.5**. Todo debe quedar listo para un despliegue **sencillo con Docker Compose en un VPS Linux propio**, con una guía paso a paso para subirlo.

Tras la migración, la app no necesita ningún servicio externo: se puede desplegar y funcionar solo con Docker en el VPS.

## Decisiones confirmadas

- **Autenticación:** propia, en el backend. Sin Supabase.
- **Tokens:** **access token corto (JWT HS256, ~15 min) + refresh token con rotación**, persistido en Postgres; el refresh usado se invalida al emitir uno nuevo.
- **Registro:** **cerrado**. No hay registro público. El **primer admin** se siembra al arrancar desde variables de entorno (`ADMIN_EMAIL` / `ADMIN_PASSWORD`); los admins adicionales se crean desde un endpoint protegido para admins.

## Estado actual (verificado en el código)

- **backend/** — ASP.NET Core (`net10.0`), EF Core + Npgsql. Se conecta con `DATABASE_URL`; hoy valida el JWT de **Supabase** por JWKS y lee el rol en `profiles`. `DbInitializer` ejecuta `backend/db/schema.sql` al arrancar (idempotente). Auth: `AdminRoleHandler` lee `sub` del JWT y comprueba `role == 'admin'`.
- **frontend/** — SPA Vite + React 19. `AuthContext.jsx` usa `@supabase/supabase-js` (`signInWithPassword`, `signUp`, `onAuthStateChange`, refresco automático). La API .NET se llama con `Authorization: Bearer <token>` (`lib/api.js`). Endpoints: `/api/me`, `/api/availability`, `/api/events` (CRUD).
- **`docker-compose.yml`** — hoy solo `backend` + `frontend`; **sin contenedor de base de datos**.
- **`backend/db/schema.sql`** — específico de Supabase: `references auth.users`, RLS con `auth.uid()`, trigger `on_auth_user_created` sobre `auth.users`. Nada de esto existe en Postgres estándar.

## Alcance

Incluye:
1. **Contenedor Postgres 16** con volumen persistente y healthcheck (`pg_isready`).
2. **Esquema Postgres estándar** (sin `auth.users`, sin RLS de Supabase): tablas `events`, `users` (correo + hash BCrypt + rol), `refresh_tokens` (hash + expiración + revocado), trigger `updated_at`, índices y `pgcrypto`. Idempotente.
3. **Autenticación propia en el backend**:
   - Endpoints `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`.
   - `POST /api/admin/users` (crear admin, protegido `AdminOnly`).
   - Contraseñas con **BCrypt**; access token **JWT HS256** firmado con `JWT_SECRET`; refresh token opaco con **rotación** y revocación en `refresh_tokens`.
   - `AdminRoleHandler` resuelve el rol desde la tabla `users` local por el claim `sub` (ya no depende de Supabase).
   - **Seed del primer admin** al arrancar desde `ADMIN_EMAIL` / `ADMIN_PASSWORD` (idempotente; no re-crea si existe).
4. **Frontend sin Supabase**: quitar `@supabase/supabase-js` y `lib/supabase.js`; reescribir `AuthContext.jsx` para usar los endpoints `/api/auth/*`, guardar tokens, refrescar el access token al caducar y hacer logout. Ajustar `.env`/`.env.example` (fuera variables `VITE_SUPABASE_*`).
5. **AppHost de Aspire 13.5** (`net10.0`) que declara el recurso Postgres y el backend, inyectando la cadena de conexión al backend en desarrollo local; el dashboard de Aspire muestra ambos recursos.
6. **`docker-compose.yml` de producción**: `db` + `backend` + `frontend`, con `depends_on` sobre el healthcheck de `db`.
7. **Guía de despliegue** `DEPLOY.md`: requisitos del VPS, subir el código, configurar `.env`, `docker compose up`, verificación, seed del admin, backup/restauración del volumen y actualización.
8. **Migración de datos existentes**: exportar los `events` de Supabase e importarlos al Postgres del contenedor, documentado en `DEPLOY.md`. (Los usuarios NO se migran: se recrean como admins propios, ya que el esquema de contraseñas cambia.)

No incluye:
- Recuperación de contraseña por correo, verificación por correo, ni proveedores OAuth externos.
- TLS/reverse-proxy avanzado (se menciona como paso opcional en la guía, no se implementa).
- CI/CD.

## Criterios de aceptación

- [ ] El contenedor `db` (Postgres 16) existe en `docker-compose.yml` con volumen nombrado persistente y healthcheck; ni el código ni la config referencian Supabase.
- [ ] `backend/db/schema.sql` corre en Postgres estándar y crea `pgcrypto`, `events`, `users`, `refresh_tokens`, el trigger de `updated_at` e índices, de forma idempotente.
- [ ] `POST /api/auth/login` con credenciales válidas devuelve un access token (JWT HS256) y un refresh token; con credenciales inválidas devuelve 401.
- [ ] `POST /api/auth/refresh` con un refresh válido emite un access nuevo y **rota** el refresh (el anterior queda revocado y ya no sirve); un refresh revocado o caducado devuelve 401.
- [ ] `POST /api/auth/logout` revoca el refresh token del usuario.
- [ ] Las rutas admin siguen protegidas: `AdminOnly` funciona resolviendo el rol desde la tabla `users` local, sin llamar a Supabase.
- [ ] Al arrancar con `ADMIN_EMAIL`/`ADMIN_PASSWORD`, se crea el primer admin si no existe; reiniciar no lo duplica ni lo pisa.
- [ ] `POST /api/admin/users` permite a un admin crear otro admin; sin token admin devuelve 401/403.
- [ ] El frontend ya no importa `@supabase/supabase-js`; el login, refresh y logout funcionan contra `/api/auth/*` y el calendario sigue cargando eventos autenticado.
- [ ] Existe un AppHost de Aspire 13.5 (`net10.0`) que levanta Postgres + backend en local; el backend recibe la cadena de conexión sin editar `.env` a mano y el dashboard muestra ambos recursos.
- [ ] `docker compose up --build` levanta `db`, `backend` y `frontend`; el backend no arranca antes de que `db` esté sana.
- [ ] `.env.example` y `README.md` reflejan el modelo autónomo (Postgres propio + auth propia) sin variables `SUPABASE_*` ni `VITE_SUPABASE_*` obsoletas.
- [ ] Existe `DEPLOY.md` con pasos concretos y copiables para el VPS Linux, incluyendo seed del admin, migración de los `events` desde Supabase y backup del volumen.
- [ ] `dotnet test` y `npm run test` pasan tras los cambios (los tests que dependían de Supabase se adaptan o reemplazan).

---

Revisa este `requirements.md`. Si te encaja, escribo `tasks.md` con la lista ordenada de tareas.
