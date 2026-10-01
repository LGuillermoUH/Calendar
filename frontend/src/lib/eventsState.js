// Lógica pura del estado de eventos del calendario (sin React), para poder
// probarla de forma unitaria como el resto de módulos de `lib/`.

/**
 * Reconcilia UN mes dentro del Map de estado (`"YYYY-MM-DD" -> valor`).
 *
 * Copia `prev`, elimina todas las claves cuyo día pertenece a `year-month`
 * (para que un día borrado desaparezca) y luego inserta las entradas de `next`
 * (que por construcción son solo de ese mes). Las claves de OTROS meses se
 * conservan intactas — necesario para la vista semanal a caballo entre dos meses.
 *
 * El prefijo se genera con relleno a 2 dígitos porque las claves usan padStart
 * (`dateKey`): "2026-9-" no casaría con "2026-09-15".
 */
export function replaceMonth(prev, next, year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`
  const merged = new Map(prev)
  for (const k of [...merged.keys()]) {
    if (k.startsWith(prefix)) merged.delete(k)
  }
  for (const [k, v] of next) merged.set(k, v)
  return merged
}

/**
 * Normaliza el objeto `initial` de un evento a los valores que esperan los
 * inputs controlados del formulario: los campos opcionales nulos/indefinidos
 * pasan a cadena vacía y `isReserved` a booleano. En alta (`initial`
 * indefinido) devuelve el formulario vacío.
 */
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
