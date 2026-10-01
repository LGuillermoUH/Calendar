import { useState, useEffect, useRef } from 'react'
import EventForm from './EventForm'
import Spinner from './Spinner'
import { formatAmount } from '../lib/dates'
import { validateAuth, isAuthValid } from '../lib/authValidation'

function LoginBody({ onLogin, onClose }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [touched, setTouched] = useState({ email: false, password: false })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const fieldErrors = validateAuth({ email, password, mode: 'login' })
  const formValid = isAuthValid(fieldErrors)

  const emailRef = useRef(null)
  const messageRef = useRef(null)

  // Al aparecer un error, mueve el foco al mensaje.
  useEffect(() => {
    if (error && messageRef.current) messageRef.current.focus()
  }, [error])

  const submit = async (e) => {
    e.preventDefault()
    setTouched({ email: true, password: true })
    if (!formValid) return
    setBusy(true)
    setError('')
    try {
      await onLogin(email.trim(), password)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="login-body" onSubmit={submit}>
      <label className="field">
        Correo
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          required
          autoComplete="email"
          aria-label="Correo"
          aria-invalid={touched.email && !!fieldErrors.email}
          ref={emailRef}
        />
        {touched.email && fieldErrors.email && (
          <span className="field-error" role="alert">{fieldErrors.email}</span>
        )}
      </label>
      <label className="field">
        Contraseña
        <div className="password-field">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            required
            minLength={6}
            autoComplete="current-password"
            aria-label="Contraseña"
            aria-invalid={touched.password && !!fieldErrors.password}
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((s) => !s)}
            aria-pressed={showPassword}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? '🙈' : '👁'}
          </button>
        </div>
        {touched.password && fieldErrors.password && (
          <span className="field-error" role="alert">{fieldErrors.password}</span>
        )}
      </label>
      {error && (
        <p className="auth-msg auth-msg--error" role="alert" ref={messageRef} tabIndex={-1}>
          <span className="auth-msg__icon" aria-hidden="true">⚠️</span>
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn" disabled={busy || !formValid} aria-busy={busy}>
          {busy ? <Spinner label="Procesando…" /> : 'Iniciar sesión'}
        </button>
      </div>
    </form>
  )
}

function ViewBody({ events, onEdit, onDelete, submitting }) {
  const [confirmId, setConfirmId] = useState(null)

  if (!events || events.length === 0) {
    return (
      <div className="empty-state" role="status">
        <span className="empty-state__icon" aria-hidden="true">📅</span>
        <p className="empty-state__title">No hay eventos en este día</p>
        <p className="empty-state__hint">Cierra este cuadro y elige un día libre para agendar uno.</p>
      </div>
    )
  }

  return (
    <ul className="event-list">
      {events.map((ev) => (
        <li key={ev.id} className="event-item">
          <div className="event-item__head">
            <strong>{ev.title || ev.personName}</strong>
            <span className={`day-tag${ev.isReserved ? '' : ' day-tag--free'}`}>
              {ev.isReserved ? 'Apartado' : 'Disponible'}
            </span>
          </div>
          <dl className="event-item__data">
            {ev.eventDate && <div><dt>Fecha</dt><dd>{ev.eventDate}</dd></div>}
            {ev.title && <div><dt>Título</dt><dd>{ev.title}</dd></div>}
            <div><dt>Persona</dt><dd>{ev.personName}</dd></div>
            {ev.contactPhone && <div><dt>Teléfono</dt><dd>{ev.contactPhone}</dd></div>}
            {ev.contactEmail && <div><dt>Correo</dt><dd>{ev.contactEmail}</dd></div>}
            <div><dt>Pago</dt><dd>{formatAmount(ev.amountPaid)}</dd></div>
            {ev.notes && <div><dt>Nota</dt><dd>{ev.notes}</dd></div>}
          </dl>
          <div className="modal-actions">
            <button className="btn btn--ghost" onClick={() => onEdit(ev)} disabled={submitting}>Editar</button>
            {confirmId === ev.id ? (
              <button
                className="btn btn--danger"
                onClick={() => onDelete(ev)}
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? <Spinner label="Eliminando…" /> : 'Confirmar eliminación'}
              </button>
            ) : (
              <button className="btn btn--danger" onClick={() => setConfirmId(ev.id)} disabled={submitting}>
                Eliminar
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function EventModal({
  mode, dateKey, events, editing, submitting, error,
  onLogin, onSubmit, onEdit, onDelete, onClose,
}) {
  const titles = {
    add: 'Nuevo evento',
    view: editing ? 'Editar evento' : `Eventos del ${dateKey}`,
    login: 'Acceso',
  }

  // Bloquea el scroll del fondo mientras el modal está abierto.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={titles[mode]}>
      <div className="modal">
        <div className="modal-header">
          <h2>{titles[mode]}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        {error && <p className="form-errors" role="alert">{error}</p>}

        {mode === 'login' && <LoginBody onLogin={onLogin} onClose={onClose} />}

        {mode === 'add' && (
          <EventForm dateKey={dateKey} onSubmit={onSubmit} onCancel={onClose} submitting={submitting} />
        )}

        {mode === 'view' && !editing && (
          <ViewBody events={events} onEdit={onEdit} onDelete={onDelete} submitting={submitting} />
        )}

        {mode === 'view' && editing && (
          <EventForm
            dateKey={dateKey}
            initial={editing}
            onSubmit={onSubmit}
            onCancel={onClose}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  )
}
