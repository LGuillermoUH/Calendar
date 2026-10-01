# Requerimientos — Bug: al eliminar/editar un registro la UI no se refresca y el modal de edición falla las validaciones

## Resumen

En la vista de administrador del calendario (`frontend/src/components/Calendar.jsx`) existen dos fallos relacionados con el mismo flujo de CRUD de eventos:

1. **La UI no refleja la eliminación.** Al eliminar un evento, la petición `DELETE /api/events/{id}` responde correctamente (204) y el `GET /api/events` posterior devuelve el mes ya sin ese evento, pero la rejilla del calendario sigue mostrando el día como "con eventos"/"apartado" con los datos previos.
2. **El modal de edición falla las validaciones.** Al pulsar "Editar" en un evento existente y guardar (`PUT`), el formulario impide o entorpece el envío por validaciones sobre campos que deberían ser opcionales. El único campo que no puede quedar vacío o nulo es el **nombre de la persona** (`personName`).

Ambos fallos están en el **frontend**. El backend (validación, DELETE, PUT, GET) se comporta como se espera.

## Alcance

- **Afectado:** vista admin del calendario y su modal de eventos.
  - `frontend/src/components/Calendar.jsx` (estado `eventsByDay`, función `mergeMap`, `invalidateAndReload`, `handleDelete`, `handleSubmit`).
  - `frontend/src/components/EventForm.jsx` (inicialización de valores al editar y validación de campos).
- **No afectado / fuera de alcance:**
  - Backend .NET (`EventsController`, `EventService`, `EventRepository`): la lógica de borrado, actualización y validación server-side es correcta y no se toca.
  - Vista pública (disponibilidad) y `RentalsList.jsx`: `RentalsList` recarga con `setRows(events)` (reemplazo total), por lo que no sufre el fallo de refresco; no se modifica.

## Síntomas observados

- **S1 (eliminación):** El administrador abre el modal de un día con evento(s), pulsa "Eliminar" y confirma. El modal se cierra, pero el día sigue pintado como apartado/con eventos y el contador "N días apartados" no baja. Recargar la página (F5) muestra el estado correcto, lo que confirma que la base de datos y el GET son correctos y que el problema es de estado en cliente.
- **S2 (eliminación del último evento del día):** El fallo es más evidente cuando se elimina el **último** evento de un día: el día debería quedar libre, pero conserva la marca y los datos anteriores.
- **S3 (edición):** El administrador pulsa "Editar" sobre un evento que tiene teléfono, correo, título o nota vacíos (nulos en la base). El formulario aparece con inputs en estado incontrolado (advertencias de React en consola: "A component is changing an uncontrolled input to be controlled") y, al guardar, la validación nativa del navegador sobre `type="email"` / `type="number"` puede bloquear el envío pese a que el único obligatorio es el nombre.

## Pasos para reproducir

### Fallo de refresco al eliminar (S1/S2)
1. Iniciar sesión como administrador.
2. En el calendario, abrir un día que tenga exactamente un evento.
3. Pulsar "Eliminar" y luego "Confirmar eliminación".
4. Observar: el modal se cierra y la petición `DELETE` responde 204; en la pestaña de red, el `GET /api/events?year=..&month=..` posterior devuelve la lista **sin** ese evento.
5. **Resultado actual:** el día sigue mostrándose como apartado/con eventos con los datos previos; el contador de días apartados no cambia.
6. **Resultado esperado:** el día queda libre inmediatamente, sin recargar la página.

### Fallo de validación al editar (S3)
1. Iniciar sesión como administrador.
2. Crear (o localizar) un evento con solo el nombre de la persona relleno (sin teléfono, correo, título ni nota).
3. Abrir el día, pulsar "Editar".
4. **Resultado actual:** aparecen advertencias de input controlado/incontrolado en consola; al pulsar "Guardar" el envío puede quedar bloqueado por la validación nativa de los campos de correo/número aunque estén vacíos y sean opcionales.
5. **Resultado esperado:** el formulario se abre con los campos vacíos como cadenas vacías controladas y se guarda sin problema; solo el nombre es obligatorio.

## Causa raíz

### Causa raíz del fallo de refresco (S1/S2)

`Calendar.jsx` mantiene `eventsByDay` (un `Map` `"YYYY-MM-DD" -> Event[]`) y, tras cualquier alta/edición/borrado, llama a `invalidateAndReload(fecha)`, que borra la caché del mes y llama a `loadMonth(y, m, force=true)`. Pero `loadMonth` **no reemplaza** el estado; lo fusiona:

```js
setEventsByDay((prev) => mergeMap(prev, map))
```

y `mergeMap` es **aditivo**: copia todas las claves previas y encima sobreescribe las nuevas, pero **nunca elimina** claves que ya no aparecen en el mapa recién cargado:

```js
function mergeMap(prev, next) {
  const merged = new Map(prev)
  for (const [k, v] of next) merged.set(k, v)  // solo añade/sobreescribe
  return merged
}
```

Cuando se borra el **único** evento de un día, el `GET /api/events` recién cargado devuelve un mapa **sin** esa clave de día. `mergeMap` conserva la clave vieja de `prev`, así que el día sigue mostrando el evento eliminado. El mismo defecto afecta a mover un evento de fecha: la fecha origen queda con datos huérfanos si ya no tiene otros eventos.

`mergeMap` existe deliberadamente para que, en vista semanal que cruza dos meses, ambos meses coexistan en el estado. Por eso no se puede reemplazar el estado completo sin más: la corrección debe **eliminar las claves del mes recargado que ya no vienen en la respuesta**, sin tocar las claves de otros meses.

### Causa raíz del fallo de validación al editar (S3)

Al editar, `EventModal` renderiza `<EventForm initial={editing} .../>`. `EventForm` inicializa su estado con:

```js
const [values, setValues] = useState({ ...EMPTY, ...initial })
```

El objeto `editing` proviene del `EventDto` del backend, donde `contactPhone`, `contactEmail`, `title` y `notes` son **`null`** cuando están vacíos, y `amountPaid` es un número. Al hacer el spread `{ ...EMPTY, ...initial }`, esos `null` sobrescriben las cadenas vacías de `EMPTY` y quedan como `value={null}` en inputs controlados. Esto provoca dos problemas:

- React advierte que un input pasa de incontrolado a controlado (`value={null}` se trata como incontrolado).
- Los inputs `type="email"` y `type="number"` con valor `null`/no-cadena pueden fallar la validación nativa del navegador al enviar, aunque el campo sea opcional.

La regla de negocio real (confirmada en `EventForm.validateForm` y en `EventService.Validate` del backend) es: **solo `personName` es obligatorio**; `amountPaid` debe ser un número ≥ 0 (0 por defecto); el resto es opcional y puede ir vacío/nulo. La corrección debe normalizar los valores nulos a cadena vacía al cargar el formulario de edición, de modo que los inputs sean siempre controlados y las validaciones nativas no bloqueen campos opcionales vacíos.

## Comportamiento esperado

1. **Eliminar** un evento actualiza la rejilla al instante: el día se libera si era su último evento, y el contador de días apartados se recalcula, sin recargar la página.
2. **Editar/mover** un evento entre fechas deja la fecha origen sin datos huérfanos y refleja la fecha destino correctamente.
3. **El estado de otros meses** cargados (vista semanal a caballo entre dos meses) se conserva; solo se sincroniza el mes recargado.
4. **El formulario de edición** abre siempre con inputs controlados (nulos mostrados como cadena vacía) y guarda con solo el nombre relleno; los campos opcionales vacíos no bloquean el envío. `amountPaid` vacío se envía como `0`.

## Criterios de aceptación

- **CA1:** Tras eliminar el único evento de un día, ese día ya no aparece como apartado/con eventos ni conserva datos, sin recargar.
- **CA2:** Tras eliminar uno de varios eventos de un día, los restantes siguen mostrándose y el eliminado desaparece.
- **CA3:** Al mover un evento a otra fecha (editar cambiando el día), la fecha origen queda sin el evento y la destino lo muestra; ambos meses implicados se refrescan.
- **CA4:** En vista semanal que cruza dos meses, refrescar un mes no borra los datos del otro mes visible.
- **CA5:** Al editar un evento sin teléfono/correo/título/nota, el formulario no genera advertencias de input controlado/incontrolado y se guarda correctamente con solo el nombre.
- **CA6:** Guardar la edición con `amountPaid` vacío persiste `0`; con un número válido persiste ese número; el nombre vacío sigue siendo rechazado con el mensaje existente.
- **CA7:** Existe una prueba de regresión (unitaria) que reproduce el defecto de `mergeMap`/normalización y que habría fallado antes de la corrección.
