# Diseño — Corrección del refresco al eliminar y de la validación al editar

## Objetivo

Corregir los dos defectos del frontend descritos en `requirements.md`, sin tocar el backend ni cambiar el contrato de la API, y añadiendo pruebas de regresión que habrían detectado ambos fallos.

## Fix 1 — Refresco de la rejilla tras eliminar/mover (S1/S2/S3 de datos)

### Diagnóstico

`loadMonth` sincroniza el estado con `setEventsByDay((prev) => mergeMap(prev, map))`. `mergeMap` solo **añade/sobreescribe**, nunca elimina, así que una clave de día que desaparece del `GET` (porque se borró su último evento o el evento se movió a otro mes) sobrevive en el estado con datos obsoletos.

No se puede reemplazar `eventsByDay` por completo porque el estado puede contener **varios meses a la vez** (vista semanal a caballo entre dos meses). La corrección debe reconciliar **solo el mes recargado**.

### Enfoque

Introducir una función de reconciliación por mes, `replaceMonth(prev, next, year, month)`, que:

1. Parte de una copia de `prev`.
2. **Elimina** de la copia todas las claves cuyo día pertenezca al mes `year-month` (prefijo `"YYYY-MM-"`).
3. **Inserta** todas las entradas de `next` (que por construcción son solo de ese mes).

Así, las claves de otros meses se conservan intactas y el mes recargado queda exactamente igual que la respuesta del servidor (incluida la ausencia de un día borrado).

`loadMonth` recibe ya `year` y `month`, de modo que puede llamar a `replaceMonth(prev, map, year, month)` en lugar de `mergeMap`. El caso público (`availability`) tiene el mismo defecto latente (usa `mergeMap` también), así que se aplica la misma reconciliación por mes a `setAvailability`.

**Rama de caché (`cached && !force`):** hoy usa `mergeMap`. Un mes servido desde caché ya representa el mes completo, así que también debe usar `replaceMonth` para no dejar residuos de una carga previa del mismo mes con más días. Se unifica: tanto la rama de caché como la de red llaman a `replaceMonth`.

### Cambios concretos (`frontend/src/components/Calendar.jsx`)

- Añadir la función pura `replaceMonth(prev, next, year, month)` junto a `mergeMap`.
- Sustituir en `loadMonth` las cuatro llamadas a `mergeMap` (rama caché admin/pub y rama red admin/pub) por `replaceMonth(prev, <map>, year, month)`.
- Conservar `mergeMap` solo si algún otro punto lo usa; si queda sin usos, eliminarlo. (Tras el cambio no quedan usos, así que se elimina para evitar código muerto.)

`replaceMonth` se exporta (o se extrae a `frontend/src/lib/` si conviene testear sin montar el componente) para poder probarla de forma unitaria. Decisión de ubicación: extraerla a `frontend/src/lib/eventsState.js` junto con una función de normalización del formulario (ver Fix 2), porque ambas son lógica pura y así se prueban sin React ni jsdom del componente completo.

### Nota de correctitud sobre el prefijo de mes

Las claves son `"YYYY-MM-DD"` con mes y día **rellenados a 2 dígitos** (`dateKey` usa `padStart`). El prefijo a eliminar debe construirse con el mismo formato: `` `${year}-${String(month).padStart(2, '0')}-` ``. Usar `${year}-${month}-` sin `padStart` fallaría en meses de un dígito (p. ej. `"2026-9-"` no casa con `"2026-09-15"`). Este detalle es la raíz de un posible segundo bug y queda cubierto por la prueba de regresión.

## Fix 2 — Formulario de edición con inputs controlados y validación correcta

### Diagnóstico

`EventForm` hace `useState({ ...EMPTY, ...initial })`. Como `initial` (el `EventDto`) trae `null` en los campos opcionales vacíos, esos `null` pisan las cadenas vacías de `EMPTY` y quedan como `value={null}` en inputs controlados, provocando avisos de React y bloqueos de validación nativa.

### Enfoque

Normalizar `initial` a la forma que esperan los inputs **antes** de inicializar el estado: cada campo de texto opcional (`personName`, `contactPhone`, `contactEmail`, `title`, `notes`) se convierte de `null`/`undefined` a `''`, y `amountPaid` de `null`/`undefined` a `''` (cadena vacía en el input; el submit ya la convierte a `0`). `isReserved` se normaliza a booleano.

Se añade una función pura `normalizeInitial(initial)` en `frontend/src/lib/eventsState.js`:

```js
export function normalizeInitial(initial) {
  const src = initial ?? {}
  return {
    isReserved: Boolean(src.isReserved),
    personName: src.personName ?? '',
    contactPhone: src.contactPhone ?? '',
    contactEmail: src.contactEmail ?? '',
    amountPaid: src.amountPaid ?? '',
    title: src.title ?? '',
    notes: src.notes ?? '',
  }
}
```

`EventForm` la usa así: `const [values, setValues] = useState(normalizeInitial(initial))`. En alta (`initial` indefinido) devuelve el equivalente a `EMPTY`, por lo que `EMPTY` puede quedar solo como referencia interna o eliminarse en favor de `normalizeInitial(undefined)`.

La validación de envío no cambia de reglas: `validateForm` ya exige solo `personName` y un `amountPaid` numérico ≥ 0; se mantiene tal cual. El bloqueo real venía de los `null` en inputs `email`/`number`, que desaparece al normalizar.

### Cambios concretos (`frontend/src/components/EventForm.jsx`)

- Importar `normalizeInitial` desde `../lib/eventsState`.
- Inicializar el estado con `normalizeInitial(initial)`.
- Mantener `validateForm` y `handleSubmit` sin cambios de reglas (el submit sigue enviando `null` para opcionales vacíos y `Number(amountPaid) || 0`).

## Módulo nuevo: `frontend/src/lib/eventsState.js`

Contiene dos funciones puras, sin dependencias de React:

- `replaceMonth(prev, next, year, month)` — reconciliación de un mes en un `Map` de estado.
- `normalizeInitial(initial)` — normalización de valores del formulario de evento.

Extraerlas aquí permite probarlas con Vitest sin montar componentes ni jsdom pesado, alineado con las pruebas de `lib/` ya existentes (`dates.test.js`, `whatsapp.test.js`, `authValidation.test.js`).

## Pruebas

Nuevo archivo `frontend/src/lib/eventsState.test.js` (Vitest, como el resto de `lib/*.test.js`):

- **replaceMonth**
  - Borrado del último evento de un día: `prev` con `"2026-09-15"` poblado; `next` vacío para septiembre ⇒ el resultado no contiene `"2026-09-15"`. *(Reproduce el bug: con el `mergeMap` anterior esta prueba fallaría.)*
  - Preservación de otros meses: `prev` con `"2026-08-10"` y `"2026-09-15"`; recargar septiembre no borra agosto.
  - Mes de un dígito: claves de `"2026-9-..."`/`"2026-09-..."` se manejan con `padStart`, confirmando que el prefijo casa.
  - Sobrescritura: un día con datos nuevos reemplaza los viejos del mismo mes.
- **normalizeInitial**
  - `null` en campos opcionales ⇒ `''`.
  - `initial` indefinido (alta) ⇒ todos los campos vacíos, `isReserved=false`, `amountPaid=''`.
  - Valores existentes se conservan; `amountPaid` numérico se mantiene.

No se añaden pruebas de backend (no cambia).

## Riesgos y consideraciones

- **Vista semanal entre dos meses:** cubierta por la prueba de preservación de otros meses; `replaceMonth` solo toca el mes recargado.
- **Caché:** al unificar la rama de caché a `replaceMonth`, un mes servido de caché se sincroniza igual que uno de red; no hay regresión porque el mapa cacheado ya es el mes completo.
- **Sin cambios de contrato:** el submit sigue enviando el mismo payload; el backend no se toca.

## Verificación

- `npm run lint` y `npm run test` (Vitest) en `frontend/` deben pasar, con las nuevas pruebas de `eventsState.test.js` verdes.
- Verificación manual de CA1–CA6 en la app admin (borrar único evento, borrar uno de varios, mover de fecha, editar evento sin campos opcionales, guardar con monto vacío).
