# Tareas — Agregar el frontend a Aspire + mejoras de UI

Orden pensado para minimizar retrabajo: primero Aspire y deploy (infra), luego
la base de layout de la UI, y encima las funcionalidades.

## 1. Aspire — agregar el frontend como recurso

> Nota de implementación: `Aspire.Hosting.NodeJs` no publica una versión
> alineada al esquema 13.x (se detuvo en 9.x) y el CommunityToolkit para 13.x
> sigue en prerelease. Para no mezclar paquetes incompatibles, el frontend se
> orquesta con `AddExecutable` (API core del AppHost, sin dependencias nuevas).

- [x] 1.1 (Sustituida) No se añade `Aspire.Hosting.NodeJs`: se usa
      `AddExecutable` de `Aspire.Hosting.AppHost` (ya referenciado). El csproj
      del AppHost queda sin cambios.
- [x] 1.2 En `backend/SalonEvents.AppHost/AppHost.cs`, el frontend se declara
      con `AddExecutable("frontend", npm, "../../frontend", "run", "dev")`
      (`npm.cmd` en Windows), con `WithHttpEndpoint(env:"PORT", port:5173)`,
      `WithEnvironment("VITE_API_URL", backend.GetEndpoint("http"))`,
      `WithReference(backend)`, `WaitFor(backend)` y
      `WithExternalHttpEndpoints()`.
- [x] 1.3 `frontend/src/lib/api.js` ya lee `import.meta.env.VITE_API_URL` con
      fallback `http://localhost:5080`. `frontend/vite.config.js` ahora usa
      `Number(process.env.PORT) || 5173` y `host:true` para respetar el puerto
      que inyecta Aspire.
- [x] 1.4 Verificado por compilación: `dotnet build` del AppHost pasa (0
      errores) con la API de `AddExecutable`. El arranque completo con
      `aspire run` se valida en 8.2 (levanta contenedores).

## 2. Deploy — reflejar el cambio

- [x] 2.1 Revisado `docker-compose.yml`: el servicio `frontend` sigue coherente
      (build arg `VITE_API_URL`, puertos 8080/5080, `depends_on`). No cambió
      ningún puerto ni variable por lo anterior; se deja igual.
- [x] 2.2 `DEPLOY.md` actualizado: nueva sección "0. Desarrollo local con
      Aspire" (`aspire run` levanta los tres recursos) y nota de que Docker
      Compose sigue siendo la vía de producción en el VPS.

## 3. UI — calendario a pantalla completa (sin scroll)

- [x] 3.1 `app.css`: `html, body, #root { height:100% }`, `.app` en `100dvh`
      como columna flex, `.app-main` con `flex:1; min-height:0`, `.calendar`
      como columna flex que llena el alto.
- [x] 3.2 `.calendar-grid` con `flex:1; min-height:0; grid-auto-rows:1fr` para
      repartir el alto entre semanas. En móvil (`max-width:560px`) `.app` pasa a
      `min-height:100vh` con filas `minmax(44px,auto)` y scroll interno si no
      cabe. (Se corrigió además un `@media` mal anidado preexistente.)

## 4. UI — vista semanal

- [x] 4.1 `dates.js`: añadidos `parseKey`, `buildWeekGrid(key)`,
      `shiftWeek(key, delta)`, `monthsInWeek(key)`, `formatWeekRange(key)` +
      11 tests en `dates.test.js` (verdes).
- [x] 4.2 `Calendar.jsx`: estado `viewMode ('month'|'week')`, conmutador
      Mes/Semana en la barra, render de `buildWeekGrid` reutilizando `DayCell`,
      `isReserved`, `hasEvents`. `loadMonth` ahora fusiona meses (`mergeMap`) para
      semanas que cruzan dos meses.
- [x] 4.3 Navegación ‹/› y "Hoy" adaptadas al modo (semana avanza 7 días; "Hoy"
      salta a la semana/mes actual). `switchMode` sincroniza mes↔semana.

## 5. UI — animaciones

- [x] 5.1 `app.css`: clase `.view-fade` (fade+slide) aplicada al grid con `key`
      por periodo; modal ya tenía `modal-in`/`overlay-in`.
- [x] 5.2 Bloque `@media (prefers-reduced-motion: reduce)` desactiva
      animaciones/transiciones (ya existía; se reubicó al arreglar el media roto).

## 6. UI — vista detallada del evento (admin)

- [x] 6.1 `EventModal.jsx` (`ViewBody`): muestra todos los campos del DTO
      (fecha, título, persona, teléfono, correo, pago, nota) y estado explícito
      Apartado/Disponible.
- [x] 6.2 Acciones Editar/Eliminar por evento conservadas (con confirmación).

## 7. UI — pantalla de listado de rentas (admin)

- [x] 7.1 Creado `frontend/src/components/RentalsList.jsx`: tabla de rentas del
      **rango visible** con alternancia Mensual/Semanal usando
      `api.getEvents(year, month)` (semana: carga los meses que toca y filtra a
      sus 7 días), con totales de pago y conteo de apartadas.
- [x] 7.2 `App.jsx` refactorizado a `AppContent` (consume `useAuth`) con
      pestañas Calendario/Rentas visibles solo para admin; al hacer logout cae
      de vuelta al calendario.

## 8. Verificación final

- [x] 8.1 `npm run lint` limpio, `npm run test` 34/34 verdes (incluye 11 de
      `dates.js`), `npm run build` de producción correcto.
- [x] 8.2 `aspire run` ejecutado: Aspire compiló el AppHost y levantó
      **postgres** (contenedor `postgres:18.3`) y **frontend**
      (`npm run dev -- --port 5173 --host 127.0.0.1`, escuchando en 127.0.0.1:5173,
      HTTP 200). El puerto/host inyectados por Aspire se respetan. Recursos
      detenidos al terminar la verificación (el volumen `salonevents-pgdata`
      persiste por diseño).
