import { useState } from 'react'
import Spinner from './Spinner'
import { normalizeInitial } from '../lib/eventsState'

/** Valida el formulario en el cliente. Devuelve un array de mensajes. */
export function validateForm(values) {
  const errors = []
  if (!values.personName || !values.personName.trim())
    errors.push('El nombre de la persona es obligatorio.')
  const amount = values.amountPaid === '' ? 0 : Number(values.amountPaid)
  if (Number.isNaN(amount) || amount < 0)
    errors.push('El monto pagado debe ser un número no negativo.')
  return errors
}

export default function EventForm({ dateKey, initial, onSubmit, onCancel, submitting }) {
  const [values, setValues] = useState(normalizeInitial(initial))
  const [errors, setErrors] = useState([])

  const update = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setValues((v) => ({ ...v, [field]: val }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const found = validateForm(values)
    setErrors(found)
    if (found.length > 0) return
    onSubmit({
      eventDate: dateKey,
      isReserved: values.isReserved,
      personName: values.personName.trim(),
      contactPhone: values.contactPhone.trim() || null,
      contactEmail: values.contactEmail.trim() || null,
      amountPaid: values.amountPaid === '' ? 0 : Number(values.amountPaid),
      title: values.title.trim() || null,
      notes: values.notes.trim() || null,
    })
  }

  return (
    <form className="event-form" onSubmit={handleSubmit}>
      <p className="event-form__date">Fecha: <strong>{dateKey}</strong></p>

      <label className="field field--check">
        <input type="checkbox" checked={values.isReserved} onChange={update('isReserved')} />
        Día apartado
      </label>

      <label className="field">
        Persona *
        <input type="text" value={values.personName} onChange={update('personName')} required />
      </label>

      <label className="field">
        Teléfono
        <input type="tel" value={values.contactPhone} onChange={update('contactPhone')} />
      </label>

      <label className="field">
        Correo
        <input type="email" value={values.contactEmail} onChange={update('contactEmail')} />
      </label>

      <label className="field">
        Monto pagado
        <input type="number" min="0" step="0.01" value={values.amountPaid} onChange={update('amountPaid')} />
      </label>

      <label className="field">
        Título / descripción
        <input type="text" value={values.title} onChange={update('title')} />
      </label>

      <label className="field">
        Nota interna
        <textarea value={values.notes} onChange={update('notes')} rows={3} />
      </label>

      {errors.length > 0 && (
        <ul className="form-errors" role="alert">
          {errors.map((err, i) => <li key={i}>{err}</li>)}
        </ul>
      )}

      <div className="modal-actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn" disabled={submitting} aria-busy={submitting}>
          {submitting ? <Spinner label="Guardando…" /> : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
