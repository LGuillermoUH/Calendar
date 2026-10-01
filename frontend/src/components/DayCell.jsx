export default function DayCell({ day, reserved, hasEvents, isSelected, isToday, onClick }) {
  if (day == null) return <div className="day-cell day-cell--empty" aria-hidden="true" />

  const classes = ['day-cell']
  if (reserved) classes.push('day-cell--reserved')
  if (isToday) classes.push('day-cell--today')
  if (isSelected) classes.push('day-cell--selected')

  const label = `Día ${day}${isToday ? ' (hoy)' : ''}, ${reserved ? 'apartado' : 'disponible'}`

  return (
    <button
      type="button"
      className={classes.join(' ')}
      onClick={onClick}
      aria-pressed={isSelected}
      aria-current={isToday ? 'date' : undefined}
      aria-label={label}
    >
      <span className="day-number">{day}</span>
      {reserved && <span className="day-tag">Apartado</span>}
      {!reserved && hasEvents && <span className="day-dot" aria-hidden="true" />}
    </button>
  )
}
