import { useCallback, useEffect, useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { api, ApiError } from '../lib/api'
import {
  MONTH_NAMES, WEEKDAY_NAMES, buildMonthGrid, buildWeekGrid,
  shiftWeek, monthsInWeek, formatWeekRange, todayKey,
} from '../lib/dates'
import DayCell from './DayCell'
import EventModal from './EventModal'
import WhatsAppModal from './WhatsAppModal'
import CalendarSkeleton from './CalendarSkeleton'
import { setWhatsAppConfig } from '../lib/whatsapp'
import { replaceMonth } from '../lib/eventsState'

export default function Calendar({ loginOpen, onCloseLogin }) {
  const { isAdmin, isAuthenticated, getToken, logout, login } = useAuth()

  const now = new Date()
  const [viewMode, setViewMode] = useState('month')       // 'month' | 'week'
  const [viewDate, setViewDate] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [anchorKey, setAnchorKey] = useState(todayKey())  // día de referencia en modo semana
  const [availability, setAvailability] = useState(new Map()) // key -> reserved (público)
  const [eventsByDay, setEventsByDay] = useState(new Map())    // key -> Event[]   (admin)
  const [selectedKey, setSelectedKey] = useState(null)
  const [modalMode, setModalMode] = useState(null)            // 'add' | 'view' | 'login' | 'whatsapp' | null
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Config pública de runtime (GET /api/config): teléfono de WhatsApp, etc.
  // Se carga una vez; hasta entonces, el modal público no se ofrece.
  const [whatsappReady, setWhatsappReady] = useState(false)

  // Caché local por mes: clave `${scope}:${year}-${month}` -> Map ya construido.
  // scope distingue vista admin (eventos) de pública (disponibilidad).
  const cacheRef = useRef(new Map())

  // Abrir el modal de login cuando el Header lo pide.
  useEffect(() => {
    if (loginOpen) setModalMode('login')
  }, [loginOpen])

  // Carga la config pública de runtime una sola vez al montar.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cfg = await api.getConfig()
        if (!cancelled) {
          setWhatsAppConfig(cfg)
          setWhatsappReady(Boolean(cfg?.whatsappPhone))
        }
      } catch {
        // Sin config disponible: el modal público simplemente no se ofrece.
        if (!cancelled) setWhatsappReady(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Carga UN mes indicado en el estado correspondiente. Usa caché salvo force=true.
  const loadMonth = useCallback(async (year, month, force = false) => {
    const key = `${isAdmin ? 'admin' : 'pub'}:${year}-${month}`
    const cached = cacheRef.current.get(key)
    if (cached && !force) {
      if (isAdmin) setEventsByDay((prev) => replaceMonth(prev, cached, year, month))
      else setAvailability((prev) => replaceMonth(prev, cached, year, month))
      return
    }

    setLoading(true)
    setError('')
    try {
      if (isAdmin) {
        const list = await api.getEvents(year, month, await getToken())
        const map = new Map()
        for (const ev of list) {
          const arr = map.get(ev.eventDate) ?? []
          arr.push(ev)
          map.set(ev.eventDate, arr)
        }
        cacheRef.current.set(key, map)
        setEventsByDay((prev) => replaceMonth(prev, map, year, month))
      } else {
        const list = await api.getAvailability(year, month)
        const map = new Map(list.map((a) => [a.date, a.reserved]))
        cacheRef.current.set(key, map)
        setAvailability((prev) => replaceMonth(prev, map, year, month))
      }
    } catch (err) {
      // 401/403 => sesión inválida: degradar a público.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        await logout()
        setError('Tu sesión expiró. Inicia sesión de nuevo.')
      } else {
        setError(err.message || 'Error al cargar el mes.')
      }
    } finally {
      setLoading(false)
    }
  }, [isAdmin, getToken, logout])

  // Meses que la vista actual necesita cargar.
  const monthsToLoad = viewMode === 'month'
    ? [{ year: viewDate.year, month: viewDate.month }]
    : monthsInWeek(anchorKey)

  // Carga los meses de la vista visible cuando cambia el mes/semana o el rol.
  const loadKey = viewMode === 'month'
    ? `m:${viewDate.year}-${viewDate.month}`
    : `w:${anchorKey}`
  useEffect(() => {
    for (const { year, month } of monthsToLoad) loadMonth(year, month)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey, isAdmin])

  // Al dejar de ser admin (logout), descarta cualquier dato de eventos cacheado.
  useEffect(() => {
    if (!isAdmin) {
      for (const k of [...cacheRef.current.keys()]) {
        if (k.startsWith('admin:')) cacheRef.current.delete(k)
      }
      setEventsByDay(new Map())
    }
  }, [isAdmin])

  // Invalida la caché de un mes (por su fecha 'YYYY-MM-DD') en ambos scopes y recarga.
  const invalidateAndReload = useCallback(async (dateKeyStr) => {
    const [y, m] = dateKeyStr.split('-').map(Number)
    cacheRef.current.delete(`admin:${y}-${m}`)
    cacheRef.current.delete(`pub:${y}-${m}`)
    await loadMonth(y, m, true)
  }, [loadMonth])

  const changePrevNext = (delta) => {
    if (viewMode === 'week') {
      setAnchorKey((k) => shiftWeek(k, delta))
      return
    }
    setViewDate((v) => {
      const d = new Date(v.year, v.month - 1 + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() + 1 }
    })
  }

  const goToday = () => {
    const d = new Date()
    setViewDate({ year: d.getFullYear(), month: d.getMonth() + 1 })
    setAnchorKey(todayKey(d))
  }

  const switchMode = (mode) => {
    if (mode === viewMode) return
    if (mode === 'week') {
      // Ancla la semana a un día del mes visible (el día 1 si no hay otro).
      setAnchorKey((k) => {
        const inMonth = `${viewDate.year}-${String(viewDate.month).padStart(2, '0')}`
        return k.startsWith(inMonth) ? k : `${inMonth}-01`
      })
    } else {
      // Al volver a mes, sincroniza el mes con la semana anclada.
      const [y, m] = anchorKey.split('-').map(Number)
      setViewDate({ year: y, month: m })
    }
    setViewMode(mode)
  }

  const handleDayClick = (key) => {
    setSelectedKey(key)
    setEditing(null)
    setError('')
    if (!isAdmin) {
      // Vista pública: solo los días DISPONIBLES abren el modal de contacto,
      // y solo si hay WhatsApp configurado en runtime (GET /api/config).
      // Los días apartados siguen en solo lectura (sin modal).
      if (whatsappReady && !isReserved(key)) setModalMode('whatsapp')
      return
    }
    const dayEvents = eventsByDay.get(key)
    setModalMode(dayEvents && dayEvents.length > 0 ? 'view' : 'add')
  }

  const closeModal = () => {
    setModalMode(null)
    setEditing(null)
    setError('')
    if (loginOpen) onCloseLogin?.()
  }

  const handleSubmit = async (payload) => {
    setSubmitting(true)
    setError('')
    try {
      if (editing) await api.updateEvent(editing.id, payload, await getToken())
      else await api.createEvent(payload, await getToken())
      const newDate = payload.eventDate || selectedKey
      const oldDate = editing?.eventDate
      closeModal()
      if (newDate) await invalidateAndReload(newDate)
      if (oldDate && oldDate.slice(0, 7) !== (newDate ?? '').slice(0, 7)) {
        await invalidateAndReload(oldDate)
      }
    } catch (err) {
      setError(err.message || 'No se pudo guardar.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (ev) => {
    setSubmitting(true)
    setError('')
    try {
      await api.deleteEvent(ev.id, await getToken())
      const affected = ev.eventDate || selectedKey
      closeModal()
      if (affected) await invalidateAndReload(affected)
    } catch (err) {
      setError(err.message || 'No se pudo eliminar.')
    } finally {
      setSubmitting(false)
    }
  }

  const today = todayKey()

  const isReserved = (key) =>
    isAdmin
      ? (eventsByDay.get(key) ?? []).some((e) => e.isReserved)
      : availability.get(key) === true

  const hasEvents = (key) => isAdmin && (eventsByDay.get(key) ?? []).length > 0

  // Celdas visibles según el modo.
  const weeks = viewMode === 'month'
    ? buildMonthGrid(viewDate.year, viewDate.month)
    : [buildWeekGrid(anchorKey)]
  const cells = weeks.flat()

  const reservedCount = cells.filter((c) => c != null && isReserved(c.key)).length

  const title = viewMode === 'month'
    ? `${MONTH_NAMES[viewDate.month - 1]} ${viewDate.year}`
    : formatWeekRange(anchorKey)

  // ¿La vista muestra el periodo actual? (para atenuar "Hoy").
  const isCurrentPeriod = viewMode === 'month'
    ? today.startsWith(`${viewDate.year}-${String(viewDate.month).padStart(2, '0')}`)
    : buildWeekGrid(anchorKey).some((c) => c.key === today)

  return (
    <section className="calendar">
      <div className="calendar-nav">
        <button
          className="btn btn--ghost"
          onClick={() => changePrevNext(-1)}
          aria-label={viewMode === 'week' ? 'Semana anterior' : 'Mes anterior'}
          disabled={loading}
        >‹</button>
        <h2 className="calendar-title" aria-live="polite">{title}</h2>
        <div className="calendar-nav__right">
          <div className="view-toggle" role="group" aria-label="Modo de vista">
            <button
              className={`btn btn--ghost${viewMode === 'month' ? ' is-active' : ''}`}
              onClick={() => switchMode('month')}
              aria-pressed={viewMode === 'month'}
            >Mes</button>
            <button
              className={`btn btn--ghost${viewMode === 'week' ? ' is-active' : ''}`}
              onClick={() => switchMode('week')}
              aria-pressed={viewMode === 'week'}
            >Semana</button>
          </div>
          <button
            className="btn btn--ghost calendar-today"
            onClick={goToday}
            disabled={loading || isCurrentPeriod}
            title={viewMode === 'week' ? 'Ir a la semana actual' : 'Ir al mes actual'}
          >Hoy</button>
          <button
            className="btn btn--ghost"
            onClick={() => changePrevNext(1)}
            aria-label={viewMode === 'week' ? 'Semana siguiente' : 'Mes siguiente'}
            disabled={loading}
          >›</button>
        </div>
      </div>

      {error && <p className="banner banner--error" role="alert">{error}</p>}
      <p className="sr-only" role="status" aria-live="polite">
        {loading ? 'Cargando el calendario…' : ''}
      </p>

      <div className="weekday-row">
        {WEEKDAY_NAMES.map((d) => <div key={d} className="weekday">{d}</div>)}
      </div>

      {loading ? (
        <CalendarSkeleton weeks={weeks.length} />
      ) : (
        <div className="calendar-grid view-fade" key={loadKey}>
          {cells.map((cell, i) =>
            cell == null ? (
              <DayCell key={`e-${i}`} day={null} />
            ) : (
              <DayCell
                key={cell.key}
                day={cell.day}
                reserved={isReserved(cell.key)}
                hasEvents={hasEvents(cell.key)}
                isSelected={selectedKey === cell.key}
                isToday={cell.key === today}
                onClick={() => handleDayClick(cell.key)}
              />
            )
          )}
        </div>
      )}

      <div className="calendar-legend" aria-hidden="true">
        <span className="legend-item"><span className="legend-swatch legend-swatch--today" /> Hoy</span>
        <span className="legend-item"><span className="legend-swatch legend-swatch--reserved" /> Apartado</span>
        {isAdmin && <span className="legend-item"><span className="legend-swatch legend-swatch--events" /> Con eventos</span>}
        <span className="legend-item"><span className="legend-swatch legend-swatch--free" /> Disponible</span>
      </div>

      {isAdmin && (
        <p className="calendar-count" role="status" aria-live="polite">
          {reservedCount === 0
            ? `Ningún día apartado ${viewMode === 'week' ? 'esta semana' : 'este mes'}.`
            : `${reservedCount} ${reservedCount === 1 ? 'día apartado' : 'días apartados'} ${viewMode === 'week' ? 'esta semana' : 'este mes'}.`}
        </p>
      )}

      {!isAdmin && isAuthenticated && (
        <p className="banner" role="status">
          Tu cuenta no tiene permisos de administrador. Un administrador debe asignarte el rol para gestionar eventos.
        </p>
      )}

      {!isAdmin && (
        <p className="hint">{whatsappReady
          ? 'Toca un día disponible para consultar por WhatsApp. Los días marcados como “Apartado” no están disponibles.'
          : 'Vista pública de solo lectura. Los días marcados como “Apartado” no están disponibles.'}</p>
      )}

      {modalMode === 'whatsapp' ? (
        <WhatsAppModal dateKey={selectedKey} onClose={closeModal} />
      ) : modalMode && (
        <EventModal
          mode={modalMode}
          dateKey={selectedKey}
          events={selectedKey ? eventsByDay.get(selectedKey) : []}
          editing={editing}
          submitting={submitting}
          error={error}
          onLogin={async (email, password) => { await login(email, password) }}
          onSubmit={handleSubmit}
          onEdit={(ev) => setEditing(ev)}
          onDelete={handleDelete}
          onClose={closeModal}
        />
      )}
    </section>
  )
}
