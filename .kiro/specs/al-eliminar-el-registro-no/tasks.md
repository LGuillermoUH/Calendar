# Tareas — Corrección del refresco al eliminar y de la validación al editar

Ejecutar en orden. Cada tarea indica archivo(s) y qué verificar. Los criterios de aceptación (CA1–CA7) están en `requirements.md`.

## 1. Crear el módulo de lógica pura `frontend/src/lib/eventsState.js`

Añadir dos funciones puras (sin React):

- `replaceMonth(prev, next, year, month)`:
  - Copiar `prev` a un nuevo `Map`.
  - Construir el prefijo del mes con relleno a 2 dígitos: `` `${year}-${String(month).padStart(2, '0')}-` `` .
  - Eliminar de la copia toda clave que empiece por ese prefijo.
  - Insertar todas las entradas de `next`.
  - Devolver el `Map` resultante.
- `normalizeInitial(initial)`:
  - Devolver `{ isReserved: Boolean(src.isReserved), personName: src.personName ?? '', contactPhone: src.contactPhone ?? '', contactEmail: src.contactEmail ?? '', amountPaid: src.amountPaid ?? '', title: src.title ?? '', notes: src.notes ?? '' }` con `src = initial ?? {}`.

**Verificar:** el archivo no importa React; exporta ambas funciones con `export`.

## 2. Escribir la prueba de regresión `frontend/src/lib/eventsState.test.js` (ANTES de tocar los componentes)

Con Vitest (mismo patrón que `dates.test.js`). Casos:

- **replaceMonth — borrado del último evento (reproduce el bug):**
  - `prev = new Map([['2026-09-15', [{ id: 'a' }]]])`, `next = new Map()`, `replaceMonth(prev, next, 2026, 9)` ⇒ el resultado NO contiene `'2026-09-15'` (`.has` es `false`, `.size` es 0).
- **replaceMonth — preserva otros meses:**
  - `prev` con `'2026-08-10'` y `'2026-09-15'`; recargar septiembre (`next` vacío, `month=9`) ⇒ sigue conteniendo `'2026-08-10'` y ya no `'2026-09-15'`.
- **replaceMonth — mes de un dígito casa por padStart:**
  - `prev` con `'2026-09-15'`; `replaceMonth(prev, new Map(), 2026, 9)` elimina la clave (confirma que el prefijo `'2026-09-'` se genera con padStart, no `'2026-9-'`).
- **replaceMonth — sobrescribe días del mismo mes:**
  - `prev` con `'2026-09-15' -> [viejo]`; `next` con `'2026-09-15' -> [nuevo]` ⇒ el resultado tiene el valor nuevo.
- **normalizeInitial — null a cadena vacía:**
  - `normalizeInitial({ personName: 'Ana', contactPhone: null, contactEmail: null, title: null, notes: null, amountPaid: 500, isReserved: true })` ⇒ campos opcionales `''`, `personName='Ana'`, `amountPaid=500`, `isReserved=true`.
- **normalizeInitial — alta (undefined):**
  - `normalizeInitial(undefined)` ⇒ todos los textos `''`, `amountPaid=''`, `isReserved=false`.

**Verificar:** ejecutar `npm run test` en `frontend/`. La suite de `eventsState` debe estar escrita; puede pasar ya (las funciones existen tras la tarea 1) — su valor es que, con el `mergeMap` anterior, el primer caso habría fallado.

## 3. Corregir el refresco en `frontend/src/components/Calendar.jsx`

- Importar `replaceMonth` desde `../lib/eventsState`.
- En `loadMonth`, sustituir las **cuatro** llamadas a `mergeMap` por `replaceMonth(prev, <map>, year, month)`:
  - rama caché admin: `setEventsByDay((prev) => replaceMonth(prev, cached, year, month))`
  - rama caché pública: `setAvailability((prev) => replaceMonth(prev, cached, year, month))`
  - rama red admin: `setEventsByDay((prev) => replaceMonth(prev, map, year, month))`
  - rama red pública: `setAvailability((prev) => replaceMonth(prev, map, year, month))`
- Eliminar la función local `mergeMap` (queda sin usos).

**Verificar:** `npm run lint` sin errores; no queda ninguna referencia a `mergeMap` (búsqueda en el archivo). Manualmente: borrar el único evento de un día libera el día sin recargar (CA1); borrar uno de varios conserva el resto (CA2); mover de fecha limpia origen y puebla destino (CA3); en vista semanal a caballo entre dos meses, refrescar un mes no borra el otro (CA4).

## 4. Corregir el formulario de edición en `frontend/src/components/EventForm.jsx`

- Importar `normalizeInitial` desde `../lib/eventsState`.
- Cambiar la inicialización del estado a `const [values, setValues] = useState(normalizeInitial(initial))`.
- Eliminar o dejar de usar la constante `EMPTY` si queda redundante (comprobar que ningún otro punto la referencia; si no, retirarla).
- No cambiar `validateForm` ni el payload de `handleSubmit` (siguen enviando `null` para opcionales vacíos y `Number(amountPaid) || 0`).

**Verificar:** editar un evento sin teléfono/correo/título/nota no genera advertencias de input controlado/incontrolado en consola y se guarda con solo el nombre (CA5); guardar con `amountPaid` vacío persiste `0`, con número persiste el número, y nombre vacío se sigue rechazando con el mensaje existente (CA6).

## 5. Verificación final

- `npm run lint` en `frontend/` — limpio.
- `npm run test` en `frontend/` — verde, incluyendo `eventsState.test.js` (CA7).
- Repaso manual de CA1–CA6 en la app admin.
- Confirmar que el backend no se ha tocado (sin cambios en `backend/`).

## Fuera de alcance

- Backend .NET (correcto, sin cambios).
- Vista pública y `RentalsList.jsx` (`RentalsList` reemplaza filas por completo, no sufre el fallo).
