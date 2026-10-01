import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api, ApiError } from '../lib/api'
import {
  MONTH_NAMES, buildWeekGrid, shiftWeek, monthsInWeek,
  formatWeekRange, formatAmount, todayKey,
} from '../lib/dates'

/**
 * Pantalla de administrador: listado de todas las rentas (eventos) del rango
 * visible, con alternancia Mensual / Semanal. Usa api.getEvents(year, month);
 * para la vista semanal carga el/los mes(es) que toca la semana y filtra a sus
 * 7 días. No requiere endpoints nuevos.
 */
export default function RentalsList() {
  const { isAdmin, getToken, logout } = useAuth()

  const now = new Date()
  const [range, setRange] = useState('month') // 'month' | 'week'
  const [viewDate, setViewDate] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [anchorKey, setAnchorKey] = useState(todayKey())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = await getToken()
      const months = range === 'month'
        ? [{ year: viewDate.year, month: viewDate.month }]
        : monthsInWeek(anchorKey)

      const lists = await Promise.all(
        months.map((m) => api.getEvents(m.year, m.month, token))
      )
      let events = lists.flat()

      if (range === 'week') {
        const weekKeys = new Set(buildWeekGrid(anchorKey).map((c) => c.key))
        events = events.filter((e) => weekKeys.has(e.eventDate))
      }

      events.sort((a, b) => a.eventDate.localeCompare(b.eventDate))
      setRows(events)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        await logout()
        setError('Tu sesión expiró. Inicia sesión de nuevo.')
      } else {
        setError(err.message || 'Error al cargar las rentas.')
      }
    } finally {
      setLoading(false)
    }
  }, [range, viewDate.year, viewDate.month, anchorKey, getToken, logout])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  const changePrevNext = (delta) => {
    if (range === 'week') { setAnchorKey((k) => shiftWeek(k, delta)); return }
    setViewDate((v) => {
      const d = new Date(v.year, v.month - 1 + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() + 1 }
    })
  }

  const switchRange = (r) => {
    if (r === range) return
    if (r === 'week') {
      const inMonth = `${viewDate.year}-${String(viewDate.month).padStart(2, '0')}`
      setAnchorKey((k) => (k.startsWith(inMonth) ? k : `${inMonth}-01`))
    } else {
      const [y, m] = anchorKey.split('-').map(Number)
      setViewDate({ year: y, month: m })
    }
    setRange(r)
  }

  if (!isAdmin) {
    return <p className="banner" role="status">Necesitas acceso de administrador para ver las rentas.</p>
  }

  const title = range === 'month'
    ? `${MONTH_NAMES[viewDate.month - 1]} ${viewDate.year}`
    : formatWeekRange(anchorKey)

  const total = rows.reduce((sum, e) => sum + (Number(e.amountPaid) || 0), 0)
  const reservedCount = rows.filter((e) => e.isReserved).length

  return (
    <section className="rentals">
      <div className="calendar-nav">
        <button
          className="btn btn--ghost"
          onClick={() => changePrevNext(-1)}
          aria-label={range === 'week' ? 'Semana anterior' : 'Mes anterior'}
          disabled={loading}
        >‹</button>
        <h2 className="calendar-title" aria-live="polite">{title}</h2>
        <div className="calendar-nav__right">
          <div className="view-toggle" role="group" aria-label="Agrupación">
            <button
              className={`btn btn--ghost${range === 'month' ? ' is-active' : ''}`}
              onClick={() => switchRange('month')}
              aria-pressed={range === 'month'}
            >Mensual</button>
            <button
              className={`btn btn--ghost${range === 'week' ? ' is-active' : ''}`}
              onClick={() => switchRange('week')}
              aria-pressed={range === 'week'}
            >Semanal</button>
          </div>
          <button
            className="btn btn--ghost"
            onClick={() => changePrevNext(1)}
            aria-label={range === 'week' ? 'Semana siguiente' : 'Mes siguiente'}
            disabled={loading}
          >›</button>
        </div>
      </div>

      {error && <p className="banner banner--error" role="alert">{error}</p>}

      {loading ? (
        <p className="hint" role="status">Cargando rentas…</p>
      ) : rows.length === 0 ? (
        <div className="empty-state" role="status">
          <span className="empty-state__icon" aria-hidden="true">🗒️</span>
          <p className="empty-state__title">Sin rentas en este periodo</p>
          <p className="empty-state__hint">Cambia de {range === 'week' ? 'semana' : 'mes'} o registra una desde el calendario.</p>
        </div>
      ) : (
        <div className="rentals-table-wrap">
          <table className="rentals-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Título</th>
                <th>Persona</th>
                <th>Contacto</th>
                <th>Estado</th>
                <th className="rentals-table__amount">Pago</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>{e.eventDate}</td>
                  <td>{e.title || '—'}</td>
                  <td>{e.personName}</td>
                  <td>
                    {e.contactPhone || e.contactEmail || '—'}
                  </td>
                  <td>
                    <span className={`day-tag${e.isReserved ? '' : ' day-tag--free'}`}>
                      {e.isReserved ? 'Apartado' : 'Disponible'}
                    </span>
                  </td>
                  <td className="rentals-table__amount">{formatAmount(e.amountPaid)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>
                  {rows.length} {rows.length === 1 ? 'renta' : 'rentas'} · {reservedCount} apartada{reservedCount === 1 ? '' : 's'}
                </td>
                <td>Total</td>
                <td className="rentals-table__amount">{formatAmount(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}
