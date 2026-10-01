import { parseKey, MONTH_NAMES } from './dates'

const DEFAULT_MESSAGE = 'Hola, me interesa el salón para el día {fecha}. ¿Está disponible?'

// Config de runtime cargada desde el backend (GET /api/config) al arrancar.
// Fallback a import.meta.env para `npm run dev` sin backend de config.
let runtimeConfig = null

/** Fija la config de runtime (la llama el frontend tras leer GET /api/config). */
export function setWhatsAppConfig(config) {
  runtimeConfig = config || null
}

function readPhone() {
  if (runtimeConfig && runtimeConfig.whatsappPhone != null) return String(runtimeConfig.whatsappPhone)
  return String(import.meta.env.VITE_WHATSAPP_PHONE ?? '')
}

function readMessageTemplate() {
  if (runtimeConfig && runtimeConfig.whatsappMessage) return String(runtimeConfig.whatsappMessage)
  return import.meta.env.VITE_WHATSAPP_MESSAGE || DEFAULT_MESSAGE
}

/** Número de WhatsApp, normalizado a solo dígitos. '' si no hay. */
export function getWhatsAppPhone() {
  return readPhone().replace(/\D/g, '')
}

/** Fecha legible en español a partir de una clave "YYYY-MM-DD" (ej. "5 de Octubre de 2026"). */
export function formatDateLong(dateKey) {
  if (!dateKey) return ''
  const d = parseKey(dateKey)
  return `${d.getDate()} de ${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}`
}

/** Mensaje predeterminado con {fecha} sustituido por la fecha seleccionada. */
export function buildWhatsAppMessage(dateKey) {
  const template = readMessageTemplate() || DEFAULT_MESSAGE
  return template.replaceAll('{fecha}', formatDateLong(dateKey))
}

/**
 * URL wa.me con teléfono y mensaje precargados. '' si no hay teléfono configurado
 * (la app solo prepara el mensaje; nunca lo envía por el usuario).
 */
export function buildWhatsAppUrl(dateKey) {
  const phone = getWhatsAppPhone()
  if (!phone) return ''
  const text = encodeURIComponent(buildWhatsAppMessage(dateKey))
  return `https://wa.me/${phone}?text=${text}`
}
