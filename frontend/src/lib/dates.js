export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// Semana que empieza en lunes (formato español).
export const WEEKDAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** Clave estable "YYYY-MM-DD" para un día. */
export function dateKey(year, month, day) {
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

/** Clave "YYYY-MM-DD" del día de HOY en hora local (consistente con dateKey). */
export function todayKey(now = new Date()) {
  return dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/**
 * Genera la rejilla del mes como una matriz de semanas.
 * Cada celda es { day, key } o null para huecos de relleno.
 * month es 1-12.
 */
export function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month - 1, 1)
  // getDay(): 0=Dom..6=Sáb -> convertir a 0=Lun..6=Dom.
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month, 0).getDate()

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, key: dateKey(year, month, d) })
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** Formatea un monto como moneda (MXN por defecto). */
export function formatAmount(value) {
  const n = Number(value) || 0
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

/** Parsea una clave "YYYY-MM-DD" a un Date local (mediodía, evita saltos de zona). */
export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

/**
 * Los 7 días (lunes→domingo) de la semana que contiene la fecha dada.
 * Devuelve un arreglo de celdas { day, key, month, year } — sin huecos null,
 * porque una semana siempre tiene 7 días reales.
 */
export function buildWeekGrid(key) {
  const base = parseKey(key)
  // 0=Dom..6=Sáb -> desplazar al lunes de esa semana.
  const offsetToMonday = (base.getDay() + 6) % 7
  const monday = new Date(base)
  monday.setDate(base.getDate() - offsetToMonday)

  const cells = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    cells.push({ day: d.getDate(), key: dateKey(year, month, d.getDate()), month, year })
  }
  return cells
}

/** Devuelve la clave del mismo día ± N semanas. */
export function shiftWeek(key, deltaWeeks) {
  const d = parseKey(key)
  d.setDate(d.getDate() + deltaWeeks * 7)
  return dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

/** Meses (1-12) distintos que toca una semana: 1 o 2 valores {year, month}. */
export function monthsInWeek(key) {
  const cells = buildWeekGrid(key)
  const seen = new Map()
  for (const c of cells) seen.set(`${c.year}-${c.month}`, { year: c.year, month: c.month })
  return [...seen.values()]
}

/** Rango legible de una semana, p. ej. "13 – 19 de octubre 2026". */
export function formatWeekRange(key) {
  const cells = buildWeekGrid(key)
  const a = cells[0]
  const b = cells[6]
  if (a.month === b.month) {
    return `${a.day} – ${b.day} de ${MONTH_NAMES[a.month - 1]} ${a.year}`
  }
  return `${a.day} ${MONTH_NAMES[a.month - 1]} – ${b.day} ${MONTH_NAMES[b.month - 1]} ${b.year}`
}
