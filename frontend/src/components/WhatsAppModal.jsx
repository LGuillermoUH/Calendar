import { useEffect } from 'react'
import { buildWhatsAppUrl, buildWhatsAppMessage, formatDateLong, getWhatsAppPhone } from '../lib/whatsapp'

/**
 * Modal de contacto para el usuario público: al tocar un día disponible,
 * muestra el mensaje predeterminado y abre WhatsApp con el texto precargado.
 * La app NO envía el mensaje por el usuario; solo lo prepara.
 */
export default function WhatsAppModal({ dateKey, onClose }) {
  // Bloquea el scroll del fondo mientras el modal está abierto (igual que EventModal).
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const phone = getWhatsAppPhone()
  const message = buildWhatsAppMessage(dateKey)
  const url = buildWhatsAppUrl(dateKey)

  const openWhatsApp = () => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Contactar por WhatsApp">
      <div className="modal">
        <div className="modal-header">
          <h2>Consultar disponibilidad</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <p className="wa-date">Fecha seleccionada: <strong>{formatDateLong(dateKey)}</strong></p>

        {phone ? (
          <>
            <p className="wa-lead">Se abrirá WhatsApp con este mensaje ya redactado. Podrás revisarlo y enviarlo tú mismo:</p>
            <blockquote className="wa-preview">{message}</blockquote>
            <div className="modal-actions">
              <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
              <button type="button" className="btn" onClick={openWhatsApp}>Enviar WhatsApp</button>
            </div>
          </>
        ) : (
          <>
            <p className="banner" role="status">
              El contacto por WhatsApp no está disponible en este momento.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={onClose}>Cerrar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
