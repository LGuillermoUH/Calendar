# Agregar el frontend a Aspire + mejoras de UI

## Objetivo

Incorporar el frontend (Vite + React) al AppHost de Aspire para que `aspire run`
levante Postgres, backend y frontend juntos con service discovery, y actualizar
los archivos de despliegue (`docker-compose.yml`, `DEPLOY.md`) para reflejar el
cambio. En paralelo, mejorar la UI: que el calendario ocupe el alto restante de
la pantalla sin scroll, añadir una vista semanal con animaciones, una vista
detallada del evento para el administrador, y una pantalla de administrador que
liste todas las rentas (mensuales y semanales).

## Contexto del proyecto (lo que ya existe)

- **AppHost** (`backend/SalonEvents.AppHost/AppHost.cs`): orquesta `postgres`
  (con `WithDataVolume`) y el proyecto `backend` (`SalonEvents.Api`) con
  `WithReference(db)`. El frontend NO está en Aspire hoy.
- **Frontend** (`frontend/`): Vite + React 19 (JS), Nginx en producción,
  `VITE_API_URL` horneado en build. Componentes: `Calendar.jsx` (grid mensual,
  navegación de mes, caché por mes, roles público/admin), `EventModal.jsx`
  (add/view/login), `DayCell.jsx`, `Header.jsx`. Estilos en
  `src/styles/app.css` (`.app`, `.app-main`, `.calendar`, `.calendar-grid`).
- **API** (`frontend/src/lib/api.js`): `getAvailability`, `getEvents(year,month)`,
  `createEvent`, `updateEvent`, `deleteEvent`, auth (`login/refresh/logout/getMe`).
  Un evento tiene `id`, `eventDate` (`YYYY-MM-DD`), `title`, `isReserved` y
  campos de detalle que expone el backend.
- **Deploy**: `docker-compose.yml` (db + backend + frontend) y `DEPLOY.md`
  (guía para VPS con Docker Compose).

## Criterios de aceptación

### Aspire

- [ ] El AppHost referencia el frontend como recurso de Aspire (Node/Vite en
      desarrollo) de modo que `aspire run` lo arranca junto a `postgres` y
      `backend`, y aparece en el dashboard de Aspire con su endpoint.
- [ ] El frontend recibe la URL del backend desde Aspire (service discovery /
      variable de entorno inyectada), sin URL hardcodeada en desarrollo; el
      fallback actual (`http://localhost:5080`) se mantiene.
- [ ] El csproj del AppHost declara la dependencia de hosting de Node necesaria
      (p. ej. `Aspire.Hosting.NodeJs`) alineada a la versión 13.5.4 del resto.
- [ ] `aspire run` levanta los tres recursos sin errores y el frontend puede
      llamar al backend a través de la URL inyectada.

### Deploy

- [ ] `docker-compose.yml` sigue reflejando el stack completo (db + backend +
      frontend) de forma coherente con los cambios; si algún puerto/variable
      cambia, se actualiza aquí.
- [ ] `DEPLOY.md` se actualiza para documentar cómo correr con Aspire en
      desarrollo y confirmar que el flujo de Docker Compose para el VPS sigue
      siendo la vía de producción, sin pasos rotos.

### UI — calendario a pantalla completa

- [ ] El calendario ocupa el alto restante de la ventana (debajo del header) sin
      generar scroll vertical de página; el grid se ajusta con `flex`/`height`
      para llenar el espacio disponible en escritorio.
- [ ] Las celdas de día se reparten el alto disponible de forma uniforme; en
      pantallas pequeñas el comportamiento sigue siendo usable (sin romper el
      layout actual).

### UI — vista semanal

- [ ] Existe un conmutador Mes / Semana en la navegación del calendario.
- [ ] La vista semanal muestra los 7 días de la semana visible con sus eventos /
      disponibilidad, reutilizando la lógica de carga y caché existente.
- [ ] La navegación anterior/siguiente y el botón "Hoy" funcionan en modo semana
      (avanzan/retroceden una semana).

### UI — animaciones

- [ ] Transiciones suaves al cambiar de mes/semana y al abrir/cerrar modales
      (fade/slide), respetando `prefers-reduced-motion` (sin animación si el
      usuario lo pide).

### UI — vista detallada del evento (admin)

- [ ] Para el administrador, al abrir un día con eventos se puede ver el detalle
      completo de cada evento (todos los campos que expone el backend, no solo
      título), con acciones de editar/eliminar desde ahí.

### UI — pantalla de listado de rentas (admin)

- [ ] Existe una pantalla/panel de administrador que lista todas las rentas
      (eventos) en formato de listado, con alternancia entre agrupación mensual
      y semanal.
- [ ] El listado usa los endpoints existentes (`getEvents(year,month)`); si se
      requiere un rango que la API no cubre hoy, la tarea lo deja explícito como
      dependencia de backend en `tasks.md`.

## Fuera de alcance

- Cambios de esquema de base de datos o nuevos endpoints de backend salvo que
  una tarea los identifique como dependencia inevitable.
- Despliegue de Aspire a la nube (Azure/AWS); Docker Compose sigue siendo
  producción.
