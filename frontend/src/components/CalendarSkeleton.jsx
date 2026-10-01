/**
 * Placeholder de la rejilla del mes mientras se cargan los datos.
 * Mantiene el mismo layout (7 columnas × 6 filas) para evitar saltos.
 * Es puramente decorativo: se anuncia la carga por separado con role="status".
 */
export default function CalendarSkeleton({ weeks = 6 }) {
  const cells = Array.from({ length: weeks * 7 })
  return (
    <div className="calendar-grid calendar-grid--skeleton" aria-hidden="true">
      {cells.map((_, i) => (
        <div key={i} className="day-cell day-cell--skeleton">
          <span className="skeleton-line skeleton-line--num" />
        </div>
      ))}
    </div>
  )
}
