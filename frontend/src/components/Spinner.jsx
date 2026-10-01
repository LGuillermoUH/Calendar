/**
 * Spinner inline reutilizable. Decorativo (aria-hidden): el estado de carga
 * lo comunica el contenedor con aria-busy y/o un texto adyacente.
 */
export default function Spinner({ label }) {
  return (
    <span className="spinner-wrap">
      <span className="spinner" aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  )
}
