# Tareas — Gestión de eventos del salón

Lista ordenada de implementación. Cada tarea es marcable y referencia los requisitos que cumple (R#.#). Ejecutar de arriba hacia abajo; las dependencias van implícitas en el orden.

## 1. Andamiaje del monorepo

- [x] 1.1 Crear la estructura raíz: carpetas `frontend/` y `backend/`, `docker-compose.yml`, `.env.example` y `.gitignore` (ignora `.env`, `node_modules`, `bin/`, `obj/`, `dist/`). (R8.5)
- [x] 1.2 Documentar en `README.md` los comandos de arranque (dev y `docker compose up`) y las variables de entorno requeridas. (R8.6)

## 2. Base de datos (Supabase / Postgres)

- [ ] 2.1 Crear el proyecto Supabase y anotar URL, `anon key`, `service key`, `JWT secret` y cadena de conexión Postgres. (R7.5) — **Manual (requiere cuenta Supabase).**
- [x] 2.2 Escribir el script SQL de la tabla `events` (columnas `id`, `event_date`, `is_reserved`, `person_name`, `contact_phone`, `contact_email`, `amount_paid numeric(10,2)`, `title`, `notes`, `created_at`, `updated_at`), el `CHECK (amount_paid >= 0)` y el índice `events_event_date_idx`. (R4.2, R4.8) — `backend/db/schema.sql`
- [x] 2.3 Añadir el trigger que actualiza `updated_at` en cada `update`. (R4.6) — `backend/db/schema.sql`
- [x] 2.4 Habilitar RLS en `events` sin policies para `anon` (defensa en profundidad). Guardar el SQL en `backend/db/schema.sql`. (R3.5)
- [x] 2.4b Crear la tabla `profiles` (`id uuid` FK→`auth.users`, `email`, `role text check(admin|viewer) default 'viewer'`, `created_at`), la policy RLS `profiles_select_own`, y el trigger `on_auth_user_created`/`handle_new_user` que inserta el perfil con rol `viewer` al registrarse. (R2.3, R3.3) — `backend/db/schema.sql`
- [ ] 2.5 En Supabase Auth dejar habilitado el registro (Email signups) para permitir signup; tras registrarte, promover tu usuario a admin con `update public.profiles set role='admin' where email='…';`. (R2.3, R3.3) — **Manual (panel/SQL de Supabase).**

## 3. Backend .NET — andamiaje y configuración

- [x] 3.1 Crear la solución `backend/SalonEvents.sln` y el proyecto Web API `SalonEvents.Api` (.NET 10, instalado en el entorno). Añadir paquetes: `Microsoft.EntityFrameworkCore`, `Npgsql.EntityFrameworkCore.PostgreSQL`, `Microsoft.AspNetCore.Authentication.JwtBearer`. (R7.1)
- [x] 3.2 Definir configuración por variables de entorno en `Program.cs`/`appsettings`: `DATABASE_URL`, `SUPABASE_URL`, `FRONTEND_ORIGIN` (y `SUPABASE_JWT_SECRET` opcional/legacy). Sin secretos en el repo. (R7.5, R8.5)
- [x] 3.3 Configurar CORS para `FRONTEND_ORIGIN` y mapear el endpoint público `/health`. (R7.6)

## 4. Backend .NET — autenticación y autorización

- [x] 4.1 Configurar `JwtBearer` para validar el JWT de Supabase vía **JWKS** (Authority/MetadataAddress = `{SUPABASE_URL}/auth/v1`, descubrimiento OIDC de claves asimétricas), verificando firma, emisor, audiencia (`authenticated`) y expiración. Fallback HS256 con `SUPABASE_JWT_SECRET` si se define. (R3.3, R7.2)
- [x] 4.2 Implementar la política `AdminOnly` basada en rol: `RequireAuthenticatedUser` + `AdminRoleRequirement`/`AdminRoleHandler` (`Auth/AdminRoleRequirement.cs`) que resuelve el `sub` del JWT y consulta `profiles.role` en Postgres. 401 sin token, 403 sin rol `admin`. Endpoint `GET /api/me` devuelve el rol. (R2.4, R3.3, R7.2)

## 5. Backend .NET — datos, servicio y endpoints

- [x] 5.1 Crear `Models/EventEntity.cs` (mapea la tabla) y `Models/EventDto.cs` (contrato de la API). (R7.1)
- [x] 5.2 Crear `Data/AppDbContext.cs` (EF Core + Npgsql) y `Data/EventRepository.cs` con: consulta por rango de mes, `GetById`, `Add`, `Update`, `Delete`, y agregación de disponibilidad (`event_date` + `bool_or(is_reserved)`). (R7.1, R7.4)
- [x] 5.3 Crear `Services/EventService.cs` con validación server-side: fecha presente, `person_name` presente, `amount_paid >= 0`; devolver errores estructurados. (R7.3, R4.8, R4.9)
- [x] 5.4 Implementar `AvailabilityController` — `GET /api/availability?year&month`, público, devuelve solo `[{ date, reserved }]`. (R1.2, R3.4, R7.4)
- [x] 5.5 Implementar `EventsController` con `[Authorize(Policy="AdminOnly")]`: `GET /api/events?year&month`, `POST /api/events` (201), `PUT /api/events/{id}` (200/404), `DELETE /api/events/{id}` (204/404). (R4.1, R4.4, R4.5, R4.6, R4.7)
- [x] 5.6 Añadir middleware de manejo de errores que devuelva JSON consistente (400/401/403/404/500) sin filtrar detalles sensibles. (R6.1)

## 6. Backend .NET — pruebas

- [x] 6.1 Crear el proyecto `SalonEvents.Tests` (xUnit) y escribir `EventServiceTests`: persona obligatoria, monto ≥ 0, fecha obligatoria, y agregación de disponibilidad por día. (R7.3, R4.8)
- [x] 6.2 Ejecutar `dotnet test` y dejar la suite en verde. (R7.3) — **7/7 pruebas en verde.**

## 7. Frontend — andamiaje y cliente

- [x] 7.1 Crear el proyecto Vite + React 19 en `frontend/`, `.env.example` (`VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) y ESLint. (R6.4)
- [x] 7.2 Implementar `src/lib/supabase.js` (cliente Supabase usado solo para Auth). (R2.2)
- [x] 7.3 Implementar `src/lib/api.js`: `getAvailability`, `getEvents(token)`, `createEvent(token)`, `updateEvent(token)`, `deleteEvent(token)`, con manejo de errores traducido al español. (R4.4, R6.1)

## 8. Frontend — autenticación

- [x] 8.1 Implementar `src/context/AuthContext.jsx`: `getSession` al montar, `onAuthStateChange`, `login(email, password)` con `signInWithPassword`, `logout`, `isAdmin`, `getToken()`. (R2.2, R2.5, R2.6, R2.7)
- [x] 8.2 Implementar `src/components/Header.jsx`: título del salón + botón "Iniciar sesión"/"Cerrar sesión", sin opción de registro. (R2.1, R2.3, R2.5, R2.6)

## 9. Frontend — calendario y modales

- [x] 9.1 Implementar `src/components/Calendar.jsx`: estado central (`viewDate`, `selectedDay`, `modalMode`, `availability`|`events`, `loading`, `error`), generación de la rejilla del mes con nombres en español, navegación anterior/siguiente. (R1.1, R1.5, R1.7, R6.2)
- [x] 9.2 Implementar `src/components/DayCell.jsx`: marca visual "Apartado"/disponible/seleccionado; en modo público no ofrece acciones de edición. (R1.2, R1.4, R1.6, R5.1)
- [x] 9.3 Modo público en `Calendar`: carga `api.getAvailability`; clic en día apartado muestra solo "Apartado", clic en día libre muestra "Disponible", sin datos de cliente. (R1.3, R1.4, R3.4)
- [x] 9.4 Modo admin en `Calendar`: carga `api.getEvents(token)`; clic en día con eventos abre `EventModal mode="view"`, clic en día libre abre `mode="add"`. (R4.1, R4.5)
- [x] 9.5 Implementar `src/components/EventForm.jsx`: campos fecha (fija), interruptor "Día apartado", persona (obligatorio), teléfono, correo, monto (≥ 0), título, notas; validación en cliente. (R4.2, R4.3, R4.8, R4.9)
- [x] 9.6 Implementar `src/components/EventModal.jsx` con modos `add`, `view` (ver/editar/eliminar con confirmación) y `login` (correo + contraseña + "Iniciar sesión"). (R2.1, R4.5, R4.6, R4.7)
- [x] 9.7 Conectar CRUD: guardar/editar/eliminar vía `api.js` con `getToken()`, y recargar el mes tras cada operación; reflejar "apartado" según `is_reserved`. (R4.4, R4.7, R5.1, R5.3)
- [x] 9.8 Manejar 401 del backend: degradar a vista pública y pedir re-login; mostrar mensajes de error legibles y estados de carga. (R3.2, R6.1, R6.2)

## 10. Frontend — estilos y pruebas

- [x] 10.1 Implementar `src/styles/app.css`: rejilla responsiva que colapsa a una columna en móvil, foco visible, etiquetas `aria` en login y modal. (R6.3)
- [x] 10.2 Configurar Vitest + React Testing Library y escribir pruebas: generación de la rejilla del mes; modo público no renderiza botones de edición ni datos de cliente; validación de `EventForm`; `api.js` con `fetch` simulado. (R1.6, R4.8)
- [x] 10.3 Ejecutar `npm run lint` y `npm run test` y dejarlos en verde. (R6.1) — **lint limpio, 16/16 pruebas en verde, `npm run build` OK.**

## 11. Docker y orquestación

- [x] 11.1 Escribir `backend/Dockerfile` multi-etapa (SDK build → aspnet runtime, expone 8080). (R8.1, R8.4)
- [x] 11.2 Escribir `frontend/Dockerfile` multi-etapa (node build Vite → Nginx) y `frontend/nginx.conf` con fallback SPA a `index.html`. (R8.2, R8.4)
- [x] 11.3 Escribir `docker-compose.yml` con servicios `backend` y `frontend`, variables de entorno, puertos y `depends_on`. (R8.3, R8.5) — `docker compose config` valida correctamente.
- [x] 11.4 Verificar `docker compose up`: frontend sirve la SPA, backend responde en `/health`, y el flujo público de disponibilidad funciona extremo a extremo. (R8.6) — Verificado en vivo con Docker 29.1.2: `/health` → `200 {"status":"ok"}`; SPA servida por Nginx con fallback a `index.html`; `GET /api/availability?year=2026&month=9` → `200 [{"date":"2026-09-27","reserved":true}]` desde el frontend→backend→Supabase; endpoint protegido sin token → 401.

## 12. Verificación de extremo a extremo

- [ ] 12.1 Probar manualmente el inicio de sesión con correo y contraseña del administrador: login → vista admin → crear/editar/eliminar evento → cerrar sesión → vista pública refleja los días apartados. (R2.2, R4.4, R5.1, R5.3) — **Manual: requiere proyecto Supabase + usuario admin real.**
- [x] 12.2 Confirmar que un usuario sin sesión no puede llamar a los endpoints protegidos (401) y que la vista pública nunca muestra datos de cliente. (R1.3, R3.3, R3.4) — Verificado en vivo bajo Docker: sin token, `GET/POST/PUT/DELETE /api/events` y `GET /api/me` → **401**. El endpoint público `GET /api/availability` → `200 [{"date":"2026-09-27","reserved":true}]`, sin ningún campo de cliente. Confirmado también en código: `AvailabilityController` (sin `[Authorize]`) solo devuelve `AvailabilityDto(Date, Reserved)`; los datos completos (`EventDto` con nombre/teléfono/correo/monto) solo salen por `EventsController` con política `AdminOnly`. Backend 7/7 tests en verde.
- [x] 12.3 Confirmar que ninguna credencial de servicio aparece en el bundle del frontend ni en las imágenes Docker. (R6.4, R8.5) — El frontend solo usa `VITE_*` (públicas); `DATABASE_URL`/`SUPABASE_JWT_SECRET` viven solo en el backend por entorno; `.env` está en `.gitignore` y `.dockerignore`.
