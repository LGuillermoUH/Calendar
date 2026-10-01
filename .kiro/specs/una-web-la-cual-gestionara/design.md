# Diseño — Gestión de eventos del salón

## Visión general

Arquitectura de tres capas, contenerizada:

1. **Frontend** — SPA con **Vite + React 19 (JavaScript)**. Calendario público (solo lectura) y vista privada de gestión. El login del administrador usa **Supabase Auth (correo y contraseña)**; el frontend guarda el JWT y lo envía al backend.
2. **Backend** — **ASP.NET Core Web API (.NET 8)**. Concentra todo el acceso a datos, valida el JWT de Supabase en los endpoints protegidos, aplica validación y reglas de negocio del lado servidor y expone la disponibilidad pública sin autenticación.
3. **Base de datos** — **Supabase (Postgres)**. El backend se conecta con credenciales de servidor (service role o cadena de conexión Postgres). RLS se mantiene como defensa en profundidad.

Frontend y backend se empaquetan en **imágenes Docker** y se orquestan con **Docker Compose**.

## Arquitectura

```
┌──────────────── Navegador ────────────────┐
│  React SPA (Vite)                          │
│   AuthProvider (Supabase Auth, correo+contraseña) │
│   guarda JWT ─┐                            │
│   Header · Calendar · EventModal · Form    │
└───────────────┼────────────────────────────┘
                │ HTTPS  (Authorization: Bearer <JWT Supabase>)
                ▼
┌──────────────── ASP.NET Core Web API (.NET 8) ────────────────┐
│  Middleware: CORS · JWT Bearer (valida token Supabase)        │
│  Controllers:                                                 │
│    GET  /api/availability?year&month     (público)           │
│    GET  /api/events?year&month           (protegido)         │
│    POST /api/events                       (protegido)         │
│    PUT  /api/events/{id}                  (protegido)         │
│    DELETE /api/events/{id}                (protegido)         │
│    GET  /health                           (público)          │
│  Services: EventService (reglas + validación)                 │
│  Data:     EventRepository (EF Core / Npgsql)                 │
└───────────────┬───────────────────────────────────────────────┘
                │ Postgres (service credentials, solo servidor)
                ▼
┌──────────────── Supabase (Postgres) ────────────────┐
│  Auth (correo + contraseña, correo del admin)      │
│  tabla events · RLS defensa en profundidad          │
└──────────────────────────────────────────────────────┘
```

### Por qué el backend valida el JWT de Supabase (y no auth propia)

El frontend obtiene un JWT firmado por Supabase al iniciar sesión con correo y contraseña. El backend .NET valida ese token contra el **JWKS** del proyecto (claves públicas asimétricas ES256/RS256, descubiertas vía el documento OIDC en `{SUPABASE_URL}/auth/v1/.well-known/openid-configuration` → `jwks.json`), verificando firma, emisor (`{SUPABASE_URL}/auth/v1`), audiencia (`authenticated`) y expiración. `Microsoft.AspNetCore.Authentication.JwtBearer` descarga, cachea y rota las claves automáticamente. *(Fallback legacy: si se define `SUPABASE_JWT_SECRET`, valida con ese secreto simétrico HS256.)* Tras validar la firma, la política `AdminOnly` resuelve el rol del usuario en `profiles`.

### Autorización

- Endpoints públicos: `/api/availability`, `/health` — sin token.
- Endpoints protegidos: `[Authorize(Policy="AdminOnly")]` — exige JWT válido de Supabase **y** rol `admin` resuelto desde la tabla `profiles` (por el claim `sub`). Sin token → 401; sin rol admin → 403. Endpoint `GET /api/me` (solo autenticado) devuelve `{ role, isAdmin }` para que el frontend adapte la UI.

## Estructura del repositorio

```
Calendar/
├── docker-compose.yml
├── .env.example                 (variables de compose; no versionar .env real)
├── frontend/
│   ├── Dockerfile               (multi-stage: build Vite -> Nginx)
│   ├── nginx.conf               (SPA fallback + proxy /api al backend, opcional)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.example             (VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── lib/
│       │   ├── supabase.js       cliente Supabase (solo para Auth)
│       │   └── api.js            fetch al backend .NET con Bearer token
│       ├── context/
│       │   └── AuthContext.jsx
│       ├── components/
│       │   ├── Header.jsx
│       │   ├── Calendar.jsx
│       │   ├── DayCell.jsx
│       │   ├── EventModal.jsx
│       │   └── EventForm.jsx
│       └── styles/app.css
└── backend/
    ├── Dockerfile               (multi-stage: sdk build -> aspnet runtime)
    ├── SalonEvents.sln
    ├── SalonEvents.Api/
    │   ├── SalonEvents.Api.csproj
    │   ├── Program.cs           (CORS, JWT Bearer, DI, health)
    │   ├── appsettings.json     (sin secretos; overrides por entorno)
    │   ├── Controllers/
    │   │   ├── AvailabilityController.cs
    │   │   └── EventsController.cs
    │   ├── Models/
    │   │   ├── EventEntity.cs
    │   │   └── EventDto.cs
    │   ├── Data/
    │   │   ├── AppDbContext.cs   (EF Core + Npgsql)
    │   │   └── EventRepository.cs
    │   ├── Services/
    │   │   └── EventService.cs   (validación + reglas)
    │   └── Auth/
    │       └── AdminEmailRequirement.cs
    └── SalonEvents.Tests/
        └── EventServiceTests.cs
```

## Stack y dependencias

**Frontend**
- `react` ^19, `react-dom` ^19, `vite`
- `@supabase/supabase-js` ^2 (solo para Auth con correo/contraseña y obtener el JWT)
- Llamadas al backend con `fetch` (sin cliente pesado)
- Vitest + React Testing Library (pruebas)

**Backend**
- .NET 8, ASP.NET Core Web API
- `Microsoft.EntityFrameworkCore` + `Npgsql.EntityFrameworkCore.PostgreSQL` (acceso a Postgres)
- `Microsoft.AspNetCore.Authentication.JwtBearer` (validar JWT de Supabase)
- xUnit (pruebas)

## Modelo de datos (Supabase / Postgres)

### Tabla `events`

| Columna         | Tipo            | Notas                                             |
|-----------------|-----------------|---------------------------------------------------|
| `id`            | `uuid`          | PK, `default gen_random_uuid()`                   |
| `event_date`    | `date`          | Día del evento (un solo día). Indexado.          |
| `is_reserved`   | `boolean`       | `true` = apartado (visible como "Apartado"). Default `false`. |
| `person_name`   | `text`          | Obligatorio.                                      |
| `contact_phone` | `text`          | Opcional.                                         |
| `contact_email` | `text`          | Opcional.                                         |
| `amount_paid`   | `numeric(10,2)` | `>= 0`. Default `0`.                              |
| `title`         | `text`          | Opcional.                                         |
| `notes`         | `text`          | Nota interna. Opcional.                           |
| `created_at`    | `timestamptz`   | `default now()`                                   |
| `updated_at`    | `timestamptz`   | `default now()`, trigger en update.               |

Restricción: `CHECK (amount_paid >= 0)`. Índice `events_event_date_idx (event_date)`.

### Tabla `profiles` (usuarios y roles)

| Columna      | Tipo          | Notas                                                        |
|--------------|---------------|--------------------------------------------------------------|
| `id`         | `uuid`        | PK, FK → `auth.users(id)` `on delete cascade`.               |
| `email`      | `text`        | Correo del usuario (copiado en el trigger de alta).          |
| `role`       | `text`        | `admin` \| `viewer`. Default `viewer`. `CHECK` en esos valores. |
| `created_at` | `timestamptz` | `default now()`.                                             |

- **Alta automática:** un trigger `on_auth_user_created` (función `handle_new_user`, `security definer`) inserta una fila `profiles` con rol `viewer` cada vez que se registra un usuario en `auth.users`.
- **Promoción a admin:** manual — `update public.profiles set role='admin' where email='…';`.
- **RLS:** habilitada; policy `profiles_select_own` permite a un usuario leer solo su propia fila. El backend usa el rol de servicio (bypass) para resolver roles en `/api/me` y en la política `AdminOnly`.

### RLS (defensa en profundidad)

El backend accede con credenciales de servicio (service role / usuario Postgres dedicado), por lo que la lógica de autorización principal vive en el backend .NET. Aun así se habilita RLS para que un acceso directo con la `anon key` no pueda leer datos de cliente:

```sql
alter table events enable row level security;
-- anon: sin policy => sin acceso a la tabla.
-- El backend usa una conexión de servicio que hace bypass de RLS (service role).
```

> No se expone una vista pública a `anon`: la disponibilidad pública la sirve el backend por `/api/availability`, agregando `event_date` + `bool_or(is_reserved)` sin datos de cliente.

## Backend .NET — detalle

### `Program.cs`
- Configura CORS para `FRONTEND_ORIGIN`.
- Configura `JwtBearer`: `Authority`/`Issuer` = URL de Supabase, valida firma con el JWT secret del proyecto (`SUPABASE_JWT_SECRET`), `ValidateAudience`, `ValidateLifetime`.
- Registra `AppDbContext` con la cadena de conexión Postgres (`DATABASE_URL`).
- DI de `EventService`, `EventRepository`.
- Política `AdminOnly`: `RequireAuthenticatedUser` + `AdminRoleRequirement`; el `AdminRoleHandler` (en `Auth/AdminRoleRequirement.cs`) resuelve el `sub` del JWT, consulta `profiles.role` en Postgres y solo tiene éxito si el rol es `admin`.
- Mapea `/health`.

### Controllers
- **AvailabilityController** — `GET /api/availability?year&month`: llama a `EventService.GetAvailability` y devuelve `[{ date, reserved }]`. Sin `[Authorize]`.
- **EventsController** — `[Authorize(Policy="AdminOnly")]`:
  - `GET /api/events?year&month` → lista `EventDto` completos del mes.
  - `POST /api/events` → valida y crea; 201 con el recurso.
  - `PUT /api/events/{id}` → valida y actualiza; 200 o 404.
  - `DELETE /api/events/{id}` → 204 o 404.

### `EventService` (validación de negocio)
- Fecha obligatoria, `person_name` obligatorio, `amount_paid >= 0`. Devuelve errores de validación → el controller responde 400 con detalle.
- Normaliza fechas a `date` (sin hora/zonas).

### `EventRepository` (EF Core / Npgsql)
- Consultas por rango de mes (`event_date >= inicio && < siguienteMes`).
- CRUD estándar; `updated_at` gestionado en `SaveChanges`.

## Frontend — detalle

### `lib/supabase.js`
Cliente Supabase usado **solo** para Auth: `signInWithOtp`, `getSession`, `onAuthStateChange`, `signOut`. No consulta datos de eventos directamente.

### `lib/api.js`
Envoltura de `fetch` contra `VITE_API_URL`:
- `getAvailability(year, month)` → `GET /api/availability` (sin token).
- `getEvents(year, month, token)` → `GET /api/events` con `Authorization: Bearer`.
- `createEvent(payload, token)`, `updateEvent(id, payload, token)`, `deleteEvent(id, token)`.
- Traduce respuestas de error (400/401/500) a mensajes en español.

### `context/AuthContext.jsx`
Igual que antes (Magic Link), y además expone `getToken()` (el `access_token` de la sesión) para que `api.js` lo adjunte.

### Componentes
- **App.jsx** — `AuthProvider`, `Header`, `Calendar`.
- **Header.jsx** — botón "Iniciar sesión" / "Cerrar sesión". Sin registro.
- **Calendar.jsx** — estado central (`viewDate`, `selectedDay`, `modalMode`, `availability` | `events`, `loading`, `error`). Modo público → `api.getAvailability`; modo admin → `api.getEvents`. Tras CRUD, recarga el mes.
- **DayCell.jsx** — marca "Apartado" / disponible / seleccionado.
- **EventModal.jsx** — `add` | `view` | `login`.
- **EventForm.jsx** — validación en cliente (persona obligatoria, monto ≥ 0) antes de llamar a la API; el backend revalida.

Textos de la interfaz en español.

## Flujos clave

### Login (Magic Link)
1. "Iniciar sesión" → modal `login` → `signInWithOtp(email)`.
2. Correo → clic → vuelve a la app con sesión; `onAuthStateChange` marca `isAdmin`.
3. El JWT queda disponible para `api.js`.

### Crear evento (admin)
1. Clic en día libre → modal `add` → formulario.
2. Validación cliente → `api.createEvent(payload, token)` → backend valida y escribe en Postgres.
3. Éxito → recarga el mes; día apartado si `is_reserved`.

### Vista pública
1. Sin sesión → `Calendar` público.
2. `api.getAvailability(year, month)` → marca días apartados; clic muestra solo "Apartado"/"Disponible".

## Docker

### `backend/Dockerfile` (multi-stage)
```dockerfile
# build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet restore SalonEvents.Api/SalonEvents.Api.csproj
RUN dotnet publish SalonEvents.Api/SalonEvents.Api.csproj -c Release -o /app

# runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "SalonEvents.Api.dll"]
```

### `frontend/Dockerfile` (multi-stage: Vite → Nginx)
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS final
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```
`nginx.conf` sirve la SPA con fallback a `index.html` y, opcionalmente, hace proxy de `/api` al backend.

### `docker-compose.yml`
```yaml
services:
  backend:
    build: ./backend
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - SUPABASE_JWT_SECRET=${SUPABASE_JWT_SECRET}
      - FRONTEND_ORIGIN=http://localhost:8080
    ports:
      - "5080:8080"
  frontend:
    build: ./frontend
    environment:
      - VITE_API_URL=http://localhost:5080
      - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
      - VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}
    ports:
      - "8080:80"
    depends_on:
      - backend
```
> Las variables `VITE_*` se hornean en tiempo de build de Vite; en la práctica se pasan como build args o se construye con un `.env`. El `.env` real no se versiona; `.env.example` documenta las claves.

## Manejo de errores

- Frontend: cada llamada a `api.js` revisa el estado HTTP; muestra mensaje en español; no muta estado optimistamente sin confirmación. 401 → degrada a público y pide re-login.
- Backend: middleware de excepciones → respuestas JSON consistentes (400 validación, 401/403 auth, 404 no encontrado, 500 con log del lado servidor sin filtrar detalles sensibles).

## Seguridad

- El frontend nunca ve la service key ni la cadena de conexión; solo `VITE_API_URL`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
- El backend guarda `DATABASE_URL`, `SUPABASE_JWT_SECRET` como variables de entorno (nunca en la imagen ni en el repo).
- RLS habilitado como defensa en profundidad; el acceso público a datos de cliente es imposible sin pasar por el backend.

## Responsividad y accesibilidad

- CSS con rejilla que colapsa a una columna en móvil; área táctil adecuada; foco visible; etiquetas `aria` en login y modal.

## Pruebas (estrategia)

- **Backend (xUnit):** `EventServiceTests` — validación (persona obligatoria, monto ≥ 0, fecha), lógica de disponibilidad (agregación por día). Repositorio con base en memoria o Postgres de prueba.
- **Frontend (Vitest + RTL):** generación de la rejilla del mes; modo público no renderiza botones de edición ni datos de cliente; validación de `EventForm`; `api.js` con `fetch` simulado.
- Flujo Magic Link: verificación manual (requiere correo real).
- `docker compose up`: verificación manual de que frontend sirve la SPA y backend responde en `/health`.
